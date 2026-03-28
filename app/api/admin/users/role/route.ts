import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole } from "@/lib/types";

const VALID_ROLES = [UserRole.MEMBER, UserRole.TENANT_ADMIN];

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const actor = req.auth.user as PortalUser;

  // Only ROOT_ADMIN can change roles
  if (actor.role !== UserRole.ROOT_ADMIN) {
    return apiError("FORBIDDEN", "Only root admin can change user roles.", 403);
  }

  const { userId, role } = await req.json();

  if (!userId || !role) {
    return apiError("MISSING_FIELDS", "userId and role are required.", 400);
  }

  if (!VALID_ROLES.includes(role)) {
    return apiError("INVALID_ROLE", `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`, 400);
  }

  // Cannot change own role
  if (Number(actor.id) === Number(userId)) {
    return apiError("INVALID_OPERATION", "Cannot change your own role.", 400);
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, Number(userId))
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  if (targetUser.role === UserRole.ROOT_ADMIN) {
    return apiError("FORBIDDEN", "Cannot change root admin's role.", 403);
  }

  await db
    .update(users)
    .set({ role })
    .where(eq(users.id, Number(userId)));

  await db.insert(auditLogs).values({
    actor: actor.username,
    action: "USER_ROLE_CHANGED",
    resource: `user:${targetUser.username}`,
    result: "SUCCESS",
    metadata: { previousRole: targetUser.role, newRole: role }
  });

  return apiSuccess({ success: true });
});
