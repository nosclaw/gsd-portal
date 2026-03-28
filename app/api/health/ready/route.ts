import { NextResponse } from "next/server";
import { statfs } from "node:fs";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { eq } from "drizzle-orm";

import { appEnv, assertWritable, ensureRuntimePaths } from "@/lib/env";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";

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
    } catch {
      // Disk check non-fatal
    }

    // GSD CLI version
    let gsdVersion: string | null = null;
    try {
      const { stdout } = await execFileAsync("gsd", ["--version"], { timeout: 5000 });
      gsdVersion = stdout.trim();
    } catch {
      // GSD not available
    }

    // Active workspace count
    let activeWorkspaces = 0;
    try {
      const db = await getDb();
      const running = await db.query.workspaceInstances.findMany({
        where: eq(workspaceInstances.status, "RUNNING")
      });
      activeWorkspaces = running.length;
    } catch {
      // DB check non-fatal
    }

    return NextResponse.json({
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
    return NextResponse.json(
      {
        status: "not-ready",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 503 }
    );
  }
}
