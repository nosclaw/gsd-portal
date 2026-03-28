import { spawn, execFile } from "node:child_process";
import { promisify } from "node:util";
import { access, constants, readFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import { eq, and, lt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions, auditLogs } from "@/lib/db/schema";
import { appEnv } from "@/lib/env";
import { mkdir } from "node:fs/promises";
import { resolve, join } from "node:path";
import { logger } from "@/lib/logger";
import { encrypt } from "@/lib/crypto";
import { initDevEnv } from "@/lib/dev-env";

const execFileAsync = promisify(execFile);

const GSD_LAUNCH_TIMEOUT_MS = 60_000;

const PORT_RANGE_START = 30000;
const PORT_RANGE_END = 30999;

/**
 * Launch GSD --web and wait for the "Ready" line in stderr.
 * Returns the auth token extracted from the output.
 */
function spawnGsdWeb(
  port: number,
  workspaceDir: string,
  username: string,
  email: string | undefined
): Promise<{ authToken: string; webPid: number | null }> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("gsd", [
      "--web", workspaceDir,
      "--port", port.toString(),
      "--host", "0.0.0.0"
    ], {
      stdio: ["ignore", "ignore", "pipe"],
      cwd: workspaceDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: username,
        GIT_AUTHOR_EMAIL: email ?? `${username}@nosclaw.local`,
        GIT_COMMITTER_NAME: username,
        GIT_COMMITTER_EMAIL: email ?? `${username}@nosclaw.local`
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
    // GSD stores web instances in ~/.gsd/web-instances.json
    const home = process.env.HOME || "/root";
    const registryPath = join(home, ".gsd", "web-instances.json");
    const content = await readFile(registryPath, "utf8");
    const registry = JSON.parse(content);
    const resolvedCwd = resolve(workspaceDir);

    for (const [key, entry] of Object.entries(registry)) {
      if (resolve(key) === resolvedCwd && (entry as any).pid) {
        return (entry as any).pid;
      }
    }
  } catch {
    // Registry might not exist yet
  }
  return null;
}

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

  // 3.5 Initialize dev-env (clone repo + run setup.sh on first launch)
  try {
    await initDevEnv(userId, username, workspaceDir);
  } catch (err: any) {
    logger.warn("Dev-env initialization failed, continuing without it.", { userId, operation: "launchWorkspace", error: err.message });
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
    // 5. Spawn GSD web server and wait for ready
    logger.info("Launching GSD web server.", { userId, operation: "launchWorkspace", port });
    const { authToken } = await spawnGsdWeb(port, workspaceDir, username, email);

    // 6. Find the actual web server PID
    const webPid = await findGsdWebPid(workspaceDir);
    logger.info("GSD web server ready.", { userId, operation: "launchWorkspace", port, webPid, tokenLength: authToken.length });

    // 7. Update workspace instance with PID and RUNNING status
    await db
      .update(workspaceInstances)
      .set({
        pid: webPid,
        status: "RUNNING",
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
    return { ...instance, pid: webPid, status: "RUNNING" };
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
    // Try GSD's own stop mechanism
    const workspaceDir = resolve(appEnv.workspaceRootDir, username);
    try {
      await execFileAsync("gsd", ["--web", "stop", workspaceDir], { timeout: 10_000 });
    } catch {
      // Ignore — might not be running
    }

    if (instance) {
      await db
        .update(workspaceInstances)
        .set({ status: "STOPPED", pid: null })
        .where(eq(workspaceInstances.id, instance.id));
    }

    logger.info("No running workspace PID to stop, used GSD stop.", { userId, operation: "stopWorkspace" });
    return;
  }

  try {
    process.kill(instance.pid, "SIGTERM");
  } catch {
    // Already gone
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
