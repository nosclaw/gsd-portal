import { statfs } from "node:fs";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { eq } from "drizzle-orm";

import { appEnv, assertWritable, ensureRuntimePaths } from "@/lib/env";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";

const statfsAsync = promisify(statfs);
const execFileAsync = promisify(execFile);

export async function GET() {
  try {
    await ensureRuntimePaths();
    await assertWritable(appEnv.workspaceRootDir);
    await assertWritable(appEnv.logRootDir);

    // Disk space check
    let diskSpace: { availableBytes: number; totalBytes: number; usedPercent: number } | null = null;
    try {
      const stats = await statfsAsync(appEnv.workspaceRootDir);
      const total = stats.blocks * stats.bsize;
      const available = stats.bavail * stats.bsize;
      diskSpace = {
        availableBytes: available,
        totalBytes: total,
        usedPercent: Math.round(((total - available) / total) * 100)
      };
    } catch (err) {
      logger.debug("Disk space check failed.", { error: String(err), operation: "healthReady" });
    }

    // GSD CLI version
    let gsdVersion: string | null = null;
    try {
      const { stdout } = await execFileAsync("gsd", ["--version"], { timeout: 5000 });
      gsdVersion = stdout.trim();
    } catch (err) {
      logger.debug("GSD CLI not available.", { error: String(err), operation: "healthReady" });
    }

    // Active workspace count
    let activeWorkspaces = 0;
    try {
      const db = await getDb();
      const running = await db.query.workspaceInstances.findMany({
        where: eq(workspaceInstances.status, "RUNNING")
      });
      activeWorkspaces = running.length;
    } catch (err) {
      logger.debug("DB check failed during health ready.", { error: String(err), operation: "healthReady" });
    }

    return apiSuccess({
      status: "ready",
      appBaseUrl: appEnv.appBaseUrl,
      workspaceRootDir: appEnv.workspaceRootDir,
      sqliteDbPath: appEnv.sqliteDbPath,
      sessionRefreshLeewaySeconds: appEnv.sessionRefreshLeewaySeconds,
      idleReclaimMinutes: appEnv.idleReclaimMinutes,
      diskSpace,
      gsdVersion,
      activeWorkspaces,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return apiError(
      "NOT_READY",
      error instanceof Error ? error.message : "Unknown error",
      503
    );
  }
}
