import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants } from "node:fs/promises";
import { resolve, join } from "node:path";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users, tenants, devEnvVersions, auditLogs } from "@/lib/db/schema";
import { logger } from "@/lib/logger";

const execFileAsync = promisify(execFile);
const SETUP_TIMEOUT_MS = 300_000; // 5 minutes for setup.sh

interface DevEnvConfig {
  repoUrl: string;
  branch: string;
}

/**
 * Get the dev-env config from the user's tenant settings.
 */
export async function getDevEnvConfig(userId: number): Promise<DevEnvConfig | null> {
  const db = await getDb();
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: { tenant: true }
  });

  if (!user?.tenant?.settings) return null;

  const settings = user.tenant.settings as any;
  if (!settings.dev_env_repo) return null;

  return {
    repoUrl: settings.dev_env_repo,
    branch: settings.dev_env_branch || "main"
  };
}

/**
 * Get the dev-env directory path for a workspace.
 */
export function getDevEnvDir(workspaceDir: string): string {
  return join(workspaceDir, "dev-env");
}

/**
 * Get the current installed dev-env version for a user.
 */
export async function getDevEnvVersion(userId: number) {
  const db = await getDb();
  return db.query.devEnvVersions.findFirst({
    where: eq(devEnvVersions.userId, userId)
  });
}

/**
 * Get the current git commit hash in a directory.
 */
async function getGitCommit(dir: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["rev-parse", "--short", "HEAD"], { cwd: dir });
  return stdout.trim();
}

/**
 * Get the latest remote commit without pulling.
 */
async function getRemoteCommit(dir: string, branch: string): Promise<string> {
  await execFileAsync("git", ["fetch", "origin", branch], { cwd: dir, timeout: 30_000 });
  const { stdout } = await execFileAsync("git", ["rev-parse", "--short", `origin/${branch}`], { cwd: dir });
  return stdout.trim();
}

/**
 * Initialize dev-env for a user's workspace (first-time clone + setup.sh).
 * No-op if already initialized.
 */
export async function initDevEnv(userId: number, username: string, workspaceDir: string): Promise<void> {
  const config = await getDevEnvConfig(userId);
  if (!config) {
    logger.debug("No dev-env repo configured, skipping init.", { userId, operation: "initDevEnv" });
    return;
  }

  const devEnvDir = getDevEnvDir(workspaceDir);

  // Check if already cloned
  try {
    await access(join(devEnvDir, ".git"), constants.R_OK);
    logger.info("Dev-env already cloned, skipping init.", { userId, operation: "initDevEnv" });
    return;
  } catch {
    // Not cloned yet — proceed
  }

  logger.info("Cloning dev-env repo.", { userId, operation: "initDevEnv", repo: config.repoUrl, branch: config.branch });

  // Clone
  await execFileAsync("git", [
    "clone",
    "--branch", config.branch,
    "--single-branch",
    "--depth", "1",
    config.repoUrl,
    devEnvDir
  ], { cwd: workspaceDir, timeout: 60_000 });

  const commit = await getGitCommit(devEnvDir);
  logger.info("Dev-env cloned.", { userId, operation: "initDevEnv", commit });

  // Run setup.sh
  await runSetupScript(devEnvDir, workspaceDir, userId, username);

  // Record version
  const db = await getDb();
  const now = new Date();
  await db.insert(devEnvVersions).values({
    userId,
    commit,
    repoUrl: config.repoUrl,
    branch: config.branch,
    installedAt: now,
    updatedAt: now
  });

  await db.insert(auditLogs).values({
    actor: username,
    action: "DEV_ENV_INITIALIZED",
    resource: `workspace:${username}`,
    result: "SUCCESS",
    metadata: { commit, repo: config.repoUrl, branch: config.branch }
  });
}

/**
 * Update dev-env to the latest version (git pull + re-run setup.sh).
 */
export async function updateDevEnv(userId: number, username: string, workspaceDir: string): Promise<{ previousCommit: string; newCommit: string; updated: boolean }> {
  const config = await getDevEnvConfig(userId);
  if (!config) {
    throw new Error("No dev-env repo configured for this tenant.");
  }

  const devEnvDir = getDevEnvDir(workspaceDir);

  // Verify it's cloned
  try {
    await access(join(devEnvDir, ".git"), constants.R_OK);
  } catch {
    throw new Error("Dev-env not initialized. Launch workspace first.");
  }

  const previousCommit = await getGitCommit(devEnvDir);

  // Pull latest
  logger.info("Pulling dev-env updates.", { userId, operation: "updateDevEnv" });
  await execFileAsync("git", ["pull", "origin", config.branch], { cwd: devEnvDir, timeout: 60_000 });

  const newCommit = await getGitCommit(devEnvDir);

  if (previousCommit === newCommit) {
    logger.info("Dev-env already up to date.", { userId, operation: "updateDevEnv", commit: newCommit });
    return { previousCommit, newCommit, updated: false };
  }

  // Re-run setup.sh
  await runSetupScript(devEnvDir, workspaceDir, userId, username);

  // Update version record
  const db = await getDb();
  const existing = await db.query.devEnvVersions.findFirst({
    where: eq(devEnvVersions.userId, userId)
  });

  if (existing) {
    await db.update(devEnvVersions)
      .set({ commit: newCommit, updatedAt: new Date() })
      .where(eq(devEnvVersions.id, existing.id));
  } else {
    await db.insert(devEnvVersions).values({
      userId,
      commit: newCommit,
      repoUrl: config.repoUrl,
      branch: config.branch,
      installedAt: new Date(),
      updatedAt: new Date()
    });
  }

  await db.insert(auditLogs).values({
    actor: username,
    action: "DEV_ENV_UPDATED",
    resource: `workspace:${username}`,
    result: "SUCCESS",
    metadata: { previousCommit, newCommit, repo: config.repoUrl }
  });

  logger.info("Dev-env updated.", { userId, operation: "updateDevEnv", previousCommit, newCommit });
  return { previousCommit, newCommit, updated: true };
}

/**
 * Check if an update is available without pulling.
 */
export async function checkDevEnvUpdate(userId: number, workspaceDir: string): Promise<{ currentCommit: string; latestCommit: string; updateAvailable: boolean } | null> {
  const config = await getDevEnvConfig(userId);
  if (!config) return null;

  const devEnvDir = getDevEnvDir(workspaceDir);

  try {
    await access(join(devEnvDir, ".git"), constants.R_OK);
  } catch {
    return null;
  }

  try {
    const currentCommit = await getGitCommit(devEnvDir);
    const latestCommit = await getRemoteCommit(devEnvDir, config.branch);
    return { currentCommit, latestCommit, updateAvailable: currentCommit !== latestCommit };
  } catch {
    return null;
  }
}

/**
 * Run setup.sh from the dev-env directory.
 */
async function runSetupScript(devEnvDir: string, workspaceDir: string, userId: number, username: string): Promise<void> {
  const setupScript = join(devEnvDir, "setup.sh");

  try {
    await access(setupScript, constants.R_OK);
  } catch {
    logger.warn("setup.sh not found in dev-env repo.", { userId, operation: "runSetupScript" });
    return;
  }

  logger.info("Running setup.sh.", { userId, operation: "runSetupScript" });

  try {
    await execFileAsync("bash", [setupScript], {
      cwd: devEnvDir,
      timeout: SETUP_TIMEOUT_MS,
      env: {
        ...process.env,
        HOME: process.env.HOME || "/root",
        USER: username
      }
    });
    logger.info("setup.sh completed.", { userId, operation: "runSetupScript" });
  } catch (err: any) {
    logger.error("setup.sh failed.", { userId, operation: "runSetupScript", error: err.message });

    const db = await getDb();
    await db.insert(auditLogs).values({
      actor: username,
      action: "DEV_ENV_SETUP_FAILED",
      resource: `workspace:${username}`,
      result: "FAILURE",
      metadata: { error: err.message?.slice(0, 500) }
    });

    // Don't throw — dev-env setup failure shouldn't block workspace launch
  }
}
