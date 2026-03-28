import { NextResponse } from "next/server";

import { appEnv, assertWritable, ensureRuntimePaths } from "@/lib/env";

export async function GET() {
  try {
    await ensureRuntimePaths();
    await assertWritable(appEnv.workspaceRootDir);
    await assertWritable(appEnv.logRootDir);

    return NextResponse.json({
      status: "ready",
      appBaseUrl: appEnv.appBaseUrl,
      workspaceRootDir: appEnv.workspaceRootDir,
      sqliteDbPath: appEnv.sqliteDbPath,
      sessionRefreshLeewaySeconds: appEnv.sessionRefreshLeewaySeconds,
      idleReclaimMinutes: appEnv.idleReclaimMinutes,
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
