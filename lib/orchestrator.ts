import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants, readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { eq, and, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users as usersSchema, workspaceInstances, workspaceSessions, auditLogs } from "@/lib/db/schema";
import { appEnv, resolveWorkspaceDir } from "@/lib/env";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { logger } from "@/lib/logger";
import { encrypt, decrypt } from "@/lib/crypto";
import { initDevEnv } from "@/lib/dev-env";
import { WorkspaceStatus } from "@/lib/types";

const execFileAsync = promisify(execFile);

const GSD_LAUNCH_TIMEOUT_MS = 60_000;

const DEFAULT_PORT_START = 30000;
const DEFAULT_PORT_END = 30009;

/**
 * Get port range and default model from tenant settings.
 */
async function getTenantConfig(userId: number) {
  const db = await getDb();
  const user = await db.query.users.findFirst({
    where: eq(usersSchema.id, userId),
    with: { tenant: true }
  });
  const s = user?.tenant?.settings ?? {};
  return {
    portStart: s.port_range_start || DEFAULT_PORT_START,
    portEnd: s.port_range_end || DEFAULT_PORT_END,
    defaultModel: s.default_model || "anthropic/claude-sonnet-4",
    defaultThinkingLevel: s.default_thinking_level || "off",
    gitPostBuffer: s.git_post_buffer || 5242880000
  };
}

/**
 * Launch GSD --web and wait for the "Ready" line in stderr.
 * Returns the auth token extracted from the output.
 */
interface GitConfig {
  authorName: string;
  authorEmail: string;
  githubPat?: string | null;
}

function spawnGsdWeb(
  port: number,
  workspaceDir: string,
  username: string,
  gitConfig: GitConfig
): Promise<{ authToken: string; webPid: number | null }> {
  return new Promise((resolvePromise, reject) => {
    // Build allowed origins for CORS
    const origins: string[] = [
      `http://localhost:${port}`,
      `http://127.0.0.1:${port}`,
      `http://0.0.0.0:${port}`,
      appEnv.appBaseUrl
    ];
    const wsDomain = appEnv.workspaceDomain;
    if (wsDomain) {
      const protocol = wsDomain.includes("localhost") ? "http" : "https";
      origins.push(`${protocol}://${wsDomain}`);
    }

    const args = [
      "--web", workspaceDir,
      "--port", port.toString(),
      "--host", "0.0.0.0",
      "--allowed-origins", origins.join(",")
    ];

    const child = spawn("gsd", args, {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: workspaceDir,
      env: {
        ...process.env,
        HOME: workspaceDir,
        SHELL: "/bin/bash",
        GSD_WEB_DAEMON_MODE: "1",
        GSD_FIRST_RUN_BANNER: "0",
        PI_SKIP_VERSION_CHECK: "1",
        GIT_AUTHOR_NAME: gitConfig.authorName,
        GIT_AUTHOR_EMAIL: gitConfig.authorEmail,
        GIT_COMMITTER_NAME: gitConfig.authorName,
        GIT_COMMITTER_EMAIL: gitConfig.authorEmail,
        ...(gitConfig.githubPat ? { GITHUB_TOKEN: gitConfig.githubPat, GH_TOKEN: gitConfig.githubPat } : {})
      }
    });

    let stderrOutput = "";
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(`GSD web server did not become ready within ${GSD_LAUNCH_TIMEOUT_MS / 1000}s. Output: ${stderrOutput.slice(0, 500)}`));
      }
    }, GSD_LAUNCH_TIMEOUT_MS);

    child.stderr!.setEncoding("utf8");
    child.stderr!.on("data", (chunk: string) => {
      stderrOutput += chunk;
      logger.debug("GSD: " + chunk.trim(), { operation: "launchWorkspace", port });

      // GSD prints: [gsd] Ready → http://host:port/#token=<hex>
      const tokenMatch = stderrOutput.match(/#token=([a-f0-9]+)/);
      if (tokenMatch && !settled) {
        settled = true;
        clearTimeout(timeout);
        resolvePromise({ authToken: tokenMatch[1], webPid: null });
      }
    });

    child.on("error", (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        reject(err);
      }
    });

    child.on("exit", (code) => {
      // GSD parent exits after spawning the web server — this is normal (code=0)
      if (code !== 0 && !settled) {
        settled = true;
        clearTimeout(timeout);
        reject(new Error(`GSD exited with code ${code}. Output: ${stderrOutput.slice(0, 500)}`));
      }
    });
  });
}

/**
 * Find the web server PID by reading GSD's web-instances.json registry.
 */
async function findGsdWebPid(workspaceDir: string): Promise<number | null> {
  try {
    // GSD stores web instances in ~/.gsd/web-instances.json (HOME = workspaceDir)
    const registryPath = join(workspaceDir, ".gsd", "web-instances.json");
    const content = await readFile(registryPath, "utf8");
    const registry = JSON.parse(content);
    const resolvedCwd = resolve(workspaceDir);

    for (const [key, entry] of Object.entries(registry)) {
      const record = entry as Record<string, unknown>;
      if (resolve(key) === resolvedCwd && record.pid) {
        return record.pid as number;
      }
    }
  } catch (err) {
    logger.debug("GSD web-instances registry not found.", { error: String(err), operation: "findGsdPid" });
  }
  return null;
}

export async function launchWorkspace(userId: number, username: string, email?: string) {
  const db = await getDb();

  // 1. Check if already running
  const existing = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
    )
  });

  if (existing) {
    logger.info("Workspace already running, returning existing instance.", { userId, operation: "launchWorkspace", resource: `workspace:${username}` });
    return existing;
  }

  // 2. Load tenant config and allocate port
  const tenantConfig = await getTenantConfig(userId);
  const activeInstances = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
  });
  const usedPorts = new Set(activeInstances.map((i: { port: number }) => i.port));
  let port = tenantConfig.portStart;
  while (usedPorts.has(port) && port <= tenantConfig.portEnd) {
    port++;
  }

  if (port > tenantConfig.portEnd) {
    logger.error("Port range exhausted.", { userId, operation: "launchWorkspace" });
    throw new Error("No available ports for workspace.");
  }

  // 3. Prepare workspace directory (/home/{username})
  const workspaceDir = resolveWorkspaceDir(username);
  await mkdir(workspaceDir, { recursive: true });
  await mkdir(resolve(workspaceDir, "projects"), { recursive: true });
  await mkdir(resolve(workspaceDir, ".gsd"), { recursive: true });

  // Update status: directory prepared
  await db
    .update(workspaceInstances)
    .set({ status: WorkspaceStatus.PREPARING })
    .where(and(eq(workspaceInstances.userId, userId), eq(workspaceInstances.status, WorkspaceStatus.STARTING)));

  // Lock devRoot to user's home — prevents GSD folder picker from escaping
  const { writeFile, copyFile, access: fsAccess } = await import("node:fs/promises");
  await writeFile(
    resolve(workspaceDir, ".gsd", "web-preferences.json"),
    JSON.stringify({ devRoot: workspaceDir }),
    "utf8"
  );

  // ── GSD agent config initialization ──
  // Priority: User's existing config > Admin shared config > System defaults
  //
  // auth.json:     User's own keys > Admin shared keys > placeholder
  // settings.json: User's own settings > Admin tenant defaults > system defaults
  const agentDir = resolve(workspaceDir, ".gsd", "agent");
  await mkdir(agentDir, { recursive: true });

  // Helper: read JSON file, return null if missing/empty/invalid
  const readJson = async (path: string) => {
    try {
      const content = await readFile(path, "utf8");
      const parsed = JSON.parse(content);
      return parsed && typeof parsed === "object" && Object.keys(parsed).length > 0 ? parsed : null;
    } catch (err) { logger.debug("Failed to read JSON file.", { error: String(err) }); return null; }
  };

  // ── auth.json ──
  const authFile = resolve(agentDir, "auth.json");
  const existingAuth = await readJson(authFile);

  if (!existingAuth) {
    // User has no valid config → try admin shared → fallback
    const sharedAuth = await readJson(resolve(appEnv.workspaceRootDir, ".shared-gsd-config", "auth.json"));
    await writeFile(authFile, JSON.stringify(
      sharedAuth || { openrouter: [{ type: "api_key", key: "CONFIGURE_YOUR_API_KEY" }] },
      null, 2
    ), "utf8");
  }
  // else: user already has valid auth.json → don't touch

  // ── settings.json ──
  const settingsFile = resolve(agentDir, "settings.json");
  const existingSettings = await readJson(settingsFile);

  if (!existingSettings || !existingSettings.defaultProvider) {
    // User has no valid settings → use tenant defaults
    // Merge with existing to preserve any partial user config
    const merged = {
      ...(existingSettings || {}),
      defaultProvider: existingSettings?.defaultProvider || "openrouter",
      defaultModel: existingSettings?.defaultModel || tenantConfig.defaultModel,
      defaultThinkingLevel: existingSettings?.defaultThinkingLevel || tenantConfig.defaultThinkingLevel,
      quietStartup: true
    };
    await writeFile(settingsFile, JSON.stringify(merged, null, 2), "utf8");
  }
  // else: user already has valid settings → don't touch

  // 3.5 Initialize dev-env in background (don't block workspace launch)
  // Update status: initializing dev-env
  await db
    .update(workspaceInstances)
    .set({ status: WorkspaceStatus.INITIALIZING })
    .where(and(eq(workspaceInstances.userId, userId), eq(workspaceInstances.status, WorkspaceStatus.PREPARING)));

  initDevEnv(userId, username).catch((err) => {
    logger.warn("Dev-env initialization failed.", { userId, operation: "launchWorkspace", error: err.message });
  });

  // 4. Update status to STARTING
  const [instance] = await db
    .insert(workspaceInstances)
    .values({
      userId,
      port,
      status: WorkspaceStatus.STARTING
    })
    .returning();

  try {
    // 5. Spawn GSD web server and wait for ready
    logger.info("Launching GSD web server.", { userId, operation: "launchWorkspace", port });
    // Load user's git config from DB
    const dbUser = await db.query.users.findFirst({
      where: eq(usersSchema.id, userId)
    });
    let githubPat: string | null = null;
    if (dbUser?.githubPat) {
      try { githubPat = decrypt(dbUser.githubPat); } catch (err) { logger.warn("Failed to decrypt GitHub PAT.", { userId, error: String(err) }); }
    }

    const gitConfig: GitConfig = {
      authorName: dbUser?.gitUsername || username,
      authorEmail: dbUser?.gitEmail || email || `${username}@gsd.local`,
      githubPat
    };

    // Write .gitconfig so git commands in terminal also use correct identity
    const gitconfigContent = [
      `[user]`,
      `\tname = ${gitConfig.authorName}`,
      `\temail = ${gitConfig.authorEmail}`,
      `[http]`,
      `\tpostBuffer = ${tenantConfig.gitPostBuffer}`,
      ...(gitConfig.githubPat ? [
        `[url "https://${gitConfig.githubPat}@github.com/"]`,
        `\tinsteadOf = https://github.com/`
      ] : [])
    ].join("\n") + "\n";
    await writeFile(resolve(workspaceDir, ".gitconfig"), gitconfigContent, "utf8");

    // Update status: spawning GSD
    await db
      .update(workspaceInstances)
      .set({ status: WorkspaceStatus.SPAWNING })
      .where(eq(workspaceInstances.id, instance.id));

    const { authToken } = await spawnGsdWeb(port, workspaceDir, username, gitConfig);

    // 6. Find the actual web server PID
    const webPid = await findGsdWebPid(workspaceDir);
    logger.info("GSD web server ready.", { userId, operation: "launchWorkspace", port, webPid, tokenLength: authToken.length });

    // 7. Update workspace instance with PID and RUNNING status
    await db
      .update(workspaceInstances)
      .set({
        pid: webPid,
        status: WorkspaceStatus.RUNNING,
        lastHeartbeat: new Date()
      })
      .where(eq(workspaceInstances.id, instance.id));

    // 8. Store GSD auth token as encrypted workspace session
    const encryptedToken = encrypt(authToken);
    await db.delete(workspaceSessions).where(eq(workspaceSessions.userId, userId));
    await db.insert(workspaceSessions).values({
      userId,
      accessToken: encryptedToken,
      refreshToken: encryptedToken,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000)
    });

    // 9. Log audit
    await db.insert(auditLogs).values({
      actor: username,
      action: "WORKSPACE_STARTED",
      resource: `workspace:${username}`,
      result: "SUCCESS",
      metadata: { port, pid: webPid }
    });

    logger.info("Workspace launched successfully.", { userId, operation: "launchWorkspace", resource: `workspace:${username}`, port, pid: webPid });
    return { ...instance, pid: webPid, status: WorkspaceStatus.RUNNING };
  } catch (error: any) {
    logger.error("Workspace launch failed.", { userId, operation: "launchWorkspace", resource: `workspace:${username}`, error: error.message });
    await db
      .update(workspaceInstances)
      .set({ status: WorkspaceStatus.ERROR, error: error.message })
      .where(eq(workspaceInstances.id, instance.id));

    throw error;
  }
}

export async function stopWorkspace(userId: number, username: string) {
  const db = await getDb();
  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
    )
  });

  if (!instance || !instance.pid) {
    // Try GSD's own stop mechanism
    const workspaceDir = resolveWorkspaceDir(username);
    try {
      await execFileAsync("gsd", ["--web", "stop", workspaceDir], { timeout: 10_000 });
    } catch (err) {
      logger.debug("GSD stop command failed — workspace may not be running.", { error: String(err), operation: "stopWorkspace" });
    }

    if (instance) {
      await db
        .update(workspaceInstances)
        .set({ status: WorkspaceStatus.STOPPED, pid: null })
        .where(eq(workspaceInstances.id, instance.id));
    }

    logger.info("No running workspace PID to stop, used GSD stop.", { userId, operation: "stopWorkspace" });
    return;
  }

  try {
    process.kill(instance.pid, "SIGTERM");
  } catch (err) {
    logger.debug("Process already gone.", { pid: instance.pid, error: String(err), operation: "stopWorkspace" });
  }

  await db
    .update(workspaceInstances)
    .set({ status: WorkspaceStatus.STOPPED, pid: null })
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
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING),
      lt(workspaceInstances.lastHeartbeat, idleThreshold)
    )
  }) as Array<{ userId: number; user: { username: string } }>;

  for (const instance of idleInstances) {
    await stopWorkspace(instance.userId, instance.user.username);
  }
}

export async function stopAllWorkspaces() {
  const db = await getDb();
  const running = await db.query.workspaceInstances.findMany({
    with: { user: true },
    where: eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
  }) as Array<{ userId: number; user: { username: string } }>;

  for (const instance of running) {
    try {
      await stopWorkspace(instance.userId, instance.user.username);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      logger.warn("Failed to stop workspace during shutdown.", { userId: instance.userId, error: message });
    }
  }

  logger.info(`Stopped ${running.length} workspace(s) during shutdown.`);
}

export async function syncWorkspaceStates() {
  const db = await getDb();
  const activeInstances = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
  });

  for (const instance of activeInstances) {
    if (instance.pid) {
      try {
        process.kill(instance.pid, 0); // Check if process exists
      } catch {
        logger.warn("Stale workspace detected, marking as STOPPED.", { operation: "syncWorkspaceStates", resource: `workspace:${instance.id}`, pid: instance.pid });
        await db
          .update(workspaceInstances)
          .set({ status: WorkspaceStatus.STOPPED, pid: null })
          .where(eq(workspaceInstances.id, instance.id));
      }
    }
  }
}
