import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { logger } from "@/lib/logger";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole, UserStatus } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || (req.auth.user as PortalUser).role === UserRole.MEMBER) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const { userId, action } = await req.json();
  const actor = req.auth.user as PortalUser;
  const db = await getDb();

  const status = action === "approve" ? UserStatus.APPROVED : action === "reject" ? UserStatus.REJECTED : UserStatus.SUSPENDED;

  // Get target user info before update
  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.tenantId, Number(actor.tenantId)))
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  await db
    .update(users)
    .set({ status })
    .where(and(eq(users.id, userId), eq(users.tenantId, Number(actor.tenantId))));

  // When suspending or rejecting, forcibly stop workspace and revoke session
  if (status === UserStatus.SUSPENDED || status === UserStatus.REJECTED) {
    try {
      await stopWorkspace(userId, targetUser.username);
      await revokeGsdSession(userId);
    } catch (err) {
      logger.debug("Workspace may not be running during status change.", { userId, error: String(err) });
    }
  }

  await db.insert(auditLogs).values({
    actor: actor.username,
    action: `USER_${action.toUpperCase()}D`,
    resource: `user:${targetUser.username}`,
    result: "SUCCESS"
  });

  return apiSuccess({ success: true });
});
