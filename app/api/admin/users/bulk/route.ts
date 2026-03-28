import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
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

  const { userIds, action } = await req.json();
  const actor = req.auth.user as PortalUser;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return apiError("MISSING_FIELDS", "No users specified.", 400);
  }

  if (!["approve", "reject", "suspend"].includes(action)) {
    return apiError("INVALID_ACTION", "Invalid action.", 400);
  }

  const db = await getDb();
  const status = action === "approve" ? UserStatus.APPROVED : action === "reject" ? UserStatus.REJECTED : UserStatus.SUSPENDED;

  // Fetch target users, filtering to same tenant
  const targetUsers = await db.query.users.findMany({
    where: and(
      inArray(users.id, userIds),
      eq(users.tenantId, actor.tenantId)
    )
  });

  // Filter out self and ROOT_ADMIN
  const eligible = targetUsers.filter(
    (u) => u.id !== Number(actor.id) && u.role !== UserRole.ROOT_ADMIN
  );

  let processed = 0;
  for (const user of eligible) {
    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status })
        .where(eq(users.id, user.id));

      await tx.insert(auditLogs).values({
        actor: actor.username,
        action: `USER_${action.toUpperCase()}D`,
        resource: `user:${user.username}`,
        result: "SUCCESS",
        metadata: { bulk: true }
      });
    });

    if (status === UserStatus.SUSPENDED || status === UserStatus.REJECTED) {
      try {
        await stopWorkspace(user.id, user.username);
        await revokeGsdSession(user.id);
      } catch (err) {
        logger.debug("Workspace may not be running during bulk status change.", { userId: user.id, error: String(err) });
      }
    }

    processed++;
  }

  return apiSuccess({ success: true, processed });
});
