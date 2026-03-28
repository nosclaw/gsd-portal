import { request as httpRequest } from "node:http";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { syncWorkspaceStates, reclaimIdleWorkspaces } from "@/lib/orchestrator";
import { refreshGsdSession } from "@/lib/session-broker";
import { logger } from "@/lib/logger";
import { appEnv } from "@/lib/env";

const HEARTBEAT_INTERVAL_MS = 30_000;
const REFRESH_LEEWAY_MS = appEnv.sessionRefreshLeewaySeconds * 1000;

let schedulerTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Probe a running GSD instance's /api/boot endpoint to confirm it's alive.
 */
async function probeGsd(port: number, authToken: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = httpRequest(`http://127.0.0.1:${port}/api/boot`, {
      method: "GET",
      timeout: 5_000,
      headers: { Authorization: `Bearer ${authToken}` }
    }, (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300);
    });
    req.once("error", () => resolve(false));
    req.end();
  });
}

/**
 * Run one cycle of background maintenance:
 * 1. Sync workspace states (detect dead PIDs)
 * 2. Heartbeat probe running instances and update lastHeartbeat
 * 3. Auto-refresh sessions nearing expiry
 * 4. Reclaim idle workspaces
 */
async function runCycle() {
  try {
    // 1. Sync states — detect processes that crashed
    await syncWorkspaceStates();

    const db = await getDb();

    // 2. Heartbeat probe
    const runningInstances = await db.query.workspaceInstances.findMany({
      where: eq(workspaceInstances.status, "RUNNING")
    });

    for (const instance of runningInstances) {
      if (!instance.pid) continue;

      const session = await db.query.workspaceSessions.findFirst({
        where: eq(workspaceSessions.userId, instance.userId)
      });

      let token: string | null = null;
      if (session) {
        try {
          token = decrypt(session.accessToken);
        } catch {
          // Token decrypt failed — will be handled by refresh
        }
      }

      const alive = token ? await probeGsd(instance.port, token) : false;

      if (alive) {
        await db
          .update(workspaceInstances)
          .set({ lastHeartbeat: new Date() })
          .where(eq(workspaceInstances.id, instance.id));
      } else {
        logger.warn("GSD heartbeat probe failed.", {
          operation: "scheduler",
          resource: `workspace:${instance.id}`,
          port: instance.port
        });
      }

      // 3. Auto-refresh if session nearing expiry
      if (session && session.expiresAt) {
        const expiresAt = session.expiresAt instanceof Date
          ? session.expiresAt.getTime()
          : Number(session.expiresAt) * 1000;
        const timeUntilExpiry = expiresAt - Date.now();

        if (timeUntilExpiry > 0 && timeUntilExpiry <= REFRESH_LEEWAY_MS) {
          try {
            await refreshGsdSession(instance.userId, instance.port);
          } catch (err) {
            logger.error("Auto-refresh failed for workspace.", {
              operation: "scheduler",
              resource: `workspace:${instance.id}`,
              error: err instanceof Error ? err.message : String(err)
            });
          }
        }
      }
    }

    // 4. Reclaim idle workspaces
    await reclaimIdleWorkspaces();
  } catch (err) {
    logger.error("Scheduler cycle error.", {
      operation: "scheduler",
      error: err instanceof Error ? err.message : String(err)
    });
  }
}

/**
 * Start the background scheduler. Safe to call multiple times.
 */
export function startScheduler() {
  if (schedulerTimer) return;

  logger.info("Background scheduler started.", { operation: "scheduler", intervalMs: HEARTBEAT_INTERVAL_MS });

  // Run initial sync on startup
  runCycle().catch(() => {});

  schedulerTimer = setInterval(runCycle, HEARTBEAT_INTERVAL_MS);
  // Don't prevent Node from exiting
  schedulerTimer.unref();
}

/**
 * Stop the background scheduler.
 */
export function stopScheduler() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
    logger.info("Background scheduler stopped.", { operation: "scheduler" });
  }
}
