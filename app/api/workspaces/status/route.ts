import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { appEnv } from "@/lib/env";
import { eq, and, desc } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { WorkspaceStatus } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  const userId = Number(user.id);
  const db = await getDb();

  // First try to find a RUNNING instance
  let instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
    )
  });

  // If no RUNNING, get the most recent record
  if (!instance) {
    instance = await db.query.workspaceInstances.findFirst({
      where: eq(workspaceInstances.userId, userId),
      orderBy: desc(workspaceInstances.id)
    });
  }

  const session = await db.query.workspaceSessions.findFirst({
    where: eq(workspaceSessions.userId, userId)
  });

  const workspaceUrl = instance?.status === WorkspaceStatus.RUNNING
    ? await getWorkspaceUrl(userId, user.username, instance.port)
    : null;

  let idleTimeoutAt: number | null = null;
  if (instance?.status === WorkspaceStatus.RUNNING && instance.lastHeartbeat) {
    const heartbeatMs = instance.lastHeartbeat instanceof Date
      ? instance.lastHeartbeat.getTime()
      : Number(instance.lastHeartbeat) * 1000;
    idleTimeoutAt = heartbeatMs + appEnv.idleReclaimMinutes * 60 * 1000;
  }

  return apiSuccess({
    instance: instance || { status: WorkspaceStatus.STOPPED },
    session: session ? { expiresAt: session.expiresAt, hasToken: true } : null,
    workspaceUrl,
    idleTimeoutAt
  });
});
