import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInstances, workspaceSessions, devEnvVersions, auditLogs } from "@/lib/db/schema";
import { resolveWorkspaceDir } from "@/lib/env";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { logger } from "@/lib/logger";
import { eq, and } from "drizzle-orm";
import { rm } from "node:fs/promises";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const actor = req.auth.user as PortalUser;
  if (actor.role !== UserRole.ROOT_ADMIN && actor.role !== UserRole.TENANT_ADMIN) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const { userId } = await req.json();
  if (!userId) {
    return apiError("MISSING_FIELDS", "userId is required.", 400);
  }

  // Cannot delete yourself
  if (Number(actor.id) === Number(userId)) {
    return apiError("INVALID_OPERATION", "Cannot delete your own account.", 400);
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, Number(userId)), eq(users.tenantId, Number(actor.tenantId)))
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  // Cannot delete ROOT_ADMIN
  if (targetUser.role === UserRole.ROOT_ADMIN) {
    return apiError("FORBIDDEN", "Cannot delete root admin.", 403);
  }

  // 1. Stop workspace if running
  try {
    await stopWorkspace(targetUser.id, targetUser.username);
    await revokeGsdSession(targetUser.id);
  } catch (err) {
    logger.debug("Workspace may not be running during user deletion.", { userId: targetUser.id, error: String(err) });
  }

  // 2. Delete workspace directory
  try {
    const workspaceDir = resolveWorkspaceDir(targetUser.username);
    await rm(workspaceDir, { recursive: true, force: true });
  } catch (err) {
    logger.debug("Workspace directory may not exist.", { userId: targetUser.id, error: String(err) });
  }

  // 3. Delete related DB records in a transaction
  await db.transaction(async (tx) => {
    await tx.delete(workspaceSessions).where(eq(workspaceSessions.userId, targetUser.id));
    await tx.delete(workspaceInstances).where(eq(workspaceInstances.userId, targetUser.id));
    await tx.delete(devEnvVersions).where(eq(devEnvVersions.userId, targetUser.id));
    await tx.delete(users).where(eq(users.id, targetUser.id));

    // 4. Audit log
    await tx.insert(auditLogs).values({
      actor: actor.username,
      action: "USER_DELETED",
      resource: `user:${targetUser.username}`,
      result: "SUCCESS",
      metadata: { deletedUserId: targetUser.id, deletedUsername: targetUser.username }
    });
  });

  return apiSuccess({ success: true });
});
