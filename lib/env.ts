import { access, constants, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const runtimeRoot = resolve(process.cwd(), process.env.RUNTIME_ROOT_DIR ?? ".runtime");

export const appEnv = {
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:29000",
  workspaceRootDir: resolve(runtimeRoot, process.env.WORKSPACE_ROOT_DIR ?? "workspaces"),
  sqliteDbPath: resolve(runtimeRoot, process.env.SQLITE_DB_PATH ?? "data/portal.db"),
  logRootDir: resolve(runtimeRoot, process.env.LOG_ROOT_DIR ?? "logs"),
  idleReclaimMinutes: Number(process.env.IDLE_RECLAIM_MINUTES ?? "60"),
  sessionRefreshLeewaySeconds: Number(
    process.env.SESSION_REFRESH_LEEWAY_SECONDS ?? "120"
  ),
  workspaceDomain: process.env.WORKSPACE_DOMAIN ?? ""  // e.g. "gsd.example.com"
};

export async function ensureRuntimePaths() {
  await mkdir(appEnv.workspaceRootDir, { recursive: true });
  await mkdir(dirname(appEnv.sqliteDbPath), { recursive: true });
  await mkdir(appEnv.logRootDir, { recursive: true });
}

export async function assertWritable(pathname: string) {
  await access(pathname, constants.R_OK | constants.W_OK);
}

