import { randomBytes } from "node:crypto";
import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants } from "node:fs/promises";

const execFileAsync = promisify(execFile);
import { request as httpRequest } from "node:http";
import { eq, and, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions, auditLogs } from "@/lib/db/schema";
import { appEnv } from "@/lib/env";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/crypto";

const GSD_BOOT_TIMEOUT_MS = 180_000;
const GSD_BOOT_POLL_INTERVAL_MS = 500;

/**
 * Wait for GSD web server to become ready by polling /api/boot.
 */
async function waitForGsdReady(port: number, authToken: string): Promise<void> {
  const deadline = Date.now() + GSD_BOOT_TIMEOUT_MS;
  const url = `http://127.0.0.1:${port}/api/boot`;

  while (Date.now() < deadline) {
    try {
      const statusCode = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(url, {
          method: "GET",
          timeout: 5_000,
          headers: { Authorization: `Bearer ${authToken}` }
        }, (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        });
        req.once("error", reject);
        req.end();
      });

      if (statusCode >= 200 && statusCode < 300) {
        return;
      }
    } catch {
      // Connection refused / timeout — GSD is still booting
    }

    await new Promise((r) => setTimeout(r, GSD_BOOT_POLL_INTERVAL_MS));
  }

  throw new Error(`GSD web server on port ${port} did not become ready within ${GSD_BOOT_TIMEOUT_MS / 1000}s`);
}

const PORT_RANGE_START = 30000;
const PORT_RANGE_END = 30999;

export async function launchWorkspace(userId: number, username: string, email?: string) {
  const db = await getDb();

  // 1. Check if already running
  const existing = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (existing) {
    logger.info("Workspace already running, returning existing instance.", { userId, operation: "launchWorkspace", resource: `workspace:${username}` });
    return existing;
  }

  // 2. Allocate port
  const activeInstances = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, "RUNNING")
  });
  const usedPorts = new Set(activeInstances.map((i: { port: number }) => i.port));
  let port = PORT_RANGE_START;
  while (usedPorts.has(port) && port <= PORT_RANGE_END) {
    port++;
  }

  if (port > PORT_RANGE_END) {
    logger.error("Port range exhausted.", { userId, operation: "launchWorkspace" });
    throw new Error("No available ports for workspace.");
  }

  // 3. Prepare workspace directory
  const workspaceDir = resolve(appEnv.workspaceRootDir, username);
  await mkdir(workspaceDir, { recursive: true });

  // 3.5 Execute setup.sh if present
  const setupScript = resolve(workspaceDir, "nosclaw/dev-env/setup.sh");
  try {
    await access(setupScript, constants.X_OK);
    logger.info("Executing setup.sh.", { userId, operation: "launchWorkspace", script: setupScript });
    await execFileAsync(setupScript, [], { cwd: workspaceDir, timeout: 120_000 });
    logger.info("setup.sh completed.", { userId, operation: "launchWorkspace" });
  } catch (err: any) {
    if (err.code === "ENOENT" || err.code === "EACCES") {
      logger.debug("setup.sh not found or not executable, skipping.", { userId, operation: "launchWorkspace" });
    } else {
      logger.warn("setup.sh execution failed.", { userId, operation: "launchWorkspace", error: err.message });
    }
  }

  // 4. Update status to STARTING
  const [instance] = await db
    .insert(workspaceInstances)
    .values({
      userId,
      port,
      status: "STARTING"
    })
    .returning();

  try {
    // 5. Generate auth token for GSD web server
    const authToken = randomBytes(32).toString("hex");

    // 6. Spawn GSD web server
    const child = spawn("gsd", [
      "--web",
      "--port", port.toString(),
      workspaceDir
    ], {
      detached: true,
      stdio: ["ignore", "ignore", "pipe"],
      cwd: workspaceDir,
      env: {
        ...process.env,
        GSD_WEB_AUTH_TOKEN: authToken,
        GSD_WEB_HOST: "0.0.0.0",
        GSD_WEB_PORT: port.toString(),
        GSD_WEB_PROJECT_CWD: workspaceDir,
        GIT_AUTHOR_NAME: username,
        GIT_AUTHOR_EMAIL: email ?? `${username}@nosclaw.local`,
        GIT_COMMITTER_NAME: username,
        GIT_COMMITTER_EMAIL: email ?? `${username}@nosclaw.local`
      }
    });

    // Capture stderr for diagnostics
    let stderrOutput = "";
    if (child.stderr) {
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (chunk: string) => {
        stderrOutput += chunk;
        logger.debug("GSD stderr: " + chunk.trim(), { userId, operation: "launchWorkspace", port });
      });
    }

    child.on("exit", (code, signal) => {
      if (code !== null && code !== 0) {
        logger.error("GSD process exited unexpectedly.", {
          userId, operation: "launchWorkspace", port, exitCode: code, signal,
          stderr: stderrOutput.slice(0, 1000)
        });
      }
    });

    child.unref();

    if (!child.pid) {
      throw new Error("Failed to spawn GSD process.");
    }

    // 7. Wait for GSD to be ready before marking as RUNNING
    logger.info("Waiting for GSD web server to become ready.", { userId, operation: "launchWorkspace", port, pid: child.pid });
    await waitForGsdReady(port, authToken);

    // 8. Update workspace instance with PID and RUNNING status
    await db
      .update(workspaceInstances)
      .set({
        pid: child.pid,
        status: "RUNNING",
        lastHeartbeat: new Date()
      })
      .where(eq(workspaceInstances.id, instance.id));

    // 9. Store GSD auth token as encrypted workspace session
    const encryptedToken = encrypt(authToken);
    await db.delete(workspaceSessions).where(eq(workspaceSessions.userId, userId));
    await db.insert(workspaceSessions).values({
      userId,
      accessToken: encryptedToken,
      refreshToken: encryptedToken,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    });

    // 10. Log audit
    await db.insert(auditLogs).values({
      actor: username,
      action: "WORKSPACE_STARTED",
      resource: `workspace:${username}`,
      result: "SUCCESS",
      metadata: { port, pid: child.pid }
    });

    logger.info("Workspace launched successfully.", { userId, operation: "launchWorkspace", resource: `workspace:${username}`, port, pid: child.pid });
    return { ...instance, pid: child.pid, status: "RUNNING" };
  } catch (error: any) {
    logger.error("Workspace launch failed.", { userId, operation: "launchWorkspace", resource: `workspace:${username}`, error: error.message });
    await db
      .update(workspaceInstances)
      .set({ status: "ERROR", error: error.message })
      .where(eq(workspaceInstances.id, instance.id));

    throw error;
  }
}

export async function stopWorkspace(userId: number, username: string) {
  const db = await getDb();
  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance || !instance.pid) {
    logger.info("No running workspace to stop.", { userId, operation: "stopWorkspace" });
    return;
  }

  try {
    process.kill(instance.pid, "SIGTERM");
  } catch (e) {
    // Already gone?
  }

  await db
    .update(workspaceInstances)
    .set({ status: "STOPPED", pid: null })
    .where(eq(workspaceInstances.id, instance.id));

  await db.insert(auditLogs).values({
    actor: username,
    action: "WORKSPACE_STOPPED",
    resource: `workspace:${username}`,
    result: "SUCCESS"
  });
}

export async function reclaimIdleWorkspaces() {
  const db = await getDb();
  const idleThreshold = new Date(Date.now() - appEnv.idleReclaimMinutes * 60 * 1000);

  const idleInstances = await db.query.workspaceInstances.findMany({
    with: {
      user: true
    },
    where: and(
      eq(workspaceInstances.status, "RUNNING"),
      lt(workspaceInstances.lastHeartbeat, idleThreshold)
    )
  } as any);

  for (const instance of idleInstances) {
    await stopWorkspace(instance.userId, instance.user.username);
  }
}

export async function syncWorkspaceStates() {
  const db = await getDb();
  const activeInstances = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, "RUNNING")
  });

  for (const instance of activeInstances) {
    if (instance.pid) {
      try {
        process.kill(instance.pid, 0); // Check if process exists
      } catch {
        logger.warn("Stale workspace detected, marking as STOPPED.", { operation: "syncWorkspaceStates", resource: `workspace:${instance.id}`, pid: instance.pid });
        await db
          .update(workspaceInstances)
          .set({ status: "STOPPED", pid: null })
          .where(eq(workspaceInstances.id, instance.id));
      }
    }
  }
}
