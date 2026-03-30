import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInstances } from "@/lib/db/schema";
import { getGsdSession } from "@/lib/session-broker";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { ADMIN_ROLES, WorkspaceStatus } from "@/lib/types";

/**
 * GET /api/admin/workspaces/open?userId=X
 * Admin opens another user's running workspace.
 */
export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const actor = req.auth.user as PortalUser;
  if (!ADMIN_ROLES.includes(actor.role)) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) {
    return apiError("MISSING_FIELDS", "userId is required.", 400);
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!targetUser) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
    )
  });

  if (!instance) {
    return apiError("NO_RUNNING_WORKSPACE", "No running workspace for this user.", 404);
  }

  let accessToken: string;
  try {
    const session = await getGsdSession(userId);
    accessToken = session.accessToken;
  } catch {
    return apiError("SESSION_EXPIRED", "Session expired.", 401);
  }

  const baseUrl = await getWorkspaceUrl(userId, targetUser.username, instance.port);
  const workspaceUrl = `${baseUrl}/?_token=${accessToken}#token=${accessToken}`;
  return apiSuccess({ url: workspaceUrl });
});
