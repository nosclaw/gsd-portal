import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { ADMIN_ROLES } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const admin = req.auth.user as PortalUser;

  if (!ADMIN_ROLES.includes(admin.role)) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const { userId } = await req.json();

  if (!userId) {
    return apiError("MISSING_FIELDS", "userId is required.", 400);
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, Number(userId))
  });

  if (!targetUser) {
    return apiError("USER_NOT_FOUND", "User not found.", 404);
  }

  try {
    await stopWorkspace(Number(userId), targetUser.username);
    await revokeGsdSession(Number(userId));

    await db.insert(auditLogs).values({
      actor: admin.username,
      action: "ADMIN_FORCE_STOP_WORKSPACE",
      resource: `workspace:${targetUser.username}`,
      result: "SUCCESS",
      metadata: { targetUserId: userId }
    });

    return apiSuccess({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to force stop workspace.";
    return apiError("FORCE_STOP_FAILED", message, 500);
  }
});
