import { access, constants, mkdir } from "node:fs/promises";
import { dirname, resolve, join } from "node:path";

const runtimeRoot = resolve(process.cwd(), process.env.RUNTIME_ROOT_DIR ?? ".runtime");

export const appEnv = {
  appBaseUrl: process.env.APP_BASE_URL ?? "http://localhost:29000",
  workspaceRootDir: process.env.WORKSPACE_ROOT_DIR ?? "/home",
  devEnvDir: process.env.DEV_ENV_DIR ?? "/opt/dev-env",
  sqliteDbPath: resolve(runtimeRoot, process.env.SQLITE_DB_PATH ?? "data/portal.db"),
  logRootDir: resolve(runtimeRoot, process.env.LOG_ROOT_DIR ?? "logs"),
  idleReclaimMinutes: Number(process.env.IDLE_RECLAIM_MINUTES ?? "60"),
  sessionRefreshLeewaySeconds: Number(
    process.env.SESSION_REFRESH_LEEWAY_SECONDS ?? "120"
  ),
  workspaceDomain: process.env.WORKSPACE_DOMAIN ?? ""
};

/**
 * Resolve a user's workspace directory with jailbreak protection.
 * Always resolves to {WORKSPACE_ROOT_DIR}/{username}, prevents path traversal.
 */
export function resolveWorkspaceDir(username: string): string {
  // Sanitize: strip path separators and special chars
  const safe = username.replace(/[^a-zA-Z0-9_-]/g, "");
  if (!safe) throw new Error("Invalid username for workspace path.");

  const dir = join(appEnv.workspaceRootDir, safe);

  // Verify the resolved path is actually inside workspaceRootDir
  const resolved = resolve(dir);
  const root = resolve(appEnv.workspaceRootDir);
  if (!resolved.startsWith(root + "/") && resolved !== root) {
    throw new Error("Workspace path escapes root directory.");
  }

  return resolved;
}

export async function ensureRuntimePaths() {
  await mkdir(appEnv.workspaceRootDir, { recursive: true });
  await mkdir(dirname(appEnv.sqliteDbPath), { recursive: true });
  await mkdir(appEnv.logRootDir, { recursive: true });
}

export async function assertWritable(pathname: string) {
  await access(pathname, constants.R_OK | constants.W_OK);
}
