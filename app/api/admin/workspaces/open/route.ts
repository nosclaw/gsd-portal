import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInstances } from "@/lib/db/schema";
import { getGsdSession } from "@/lib/session-broker";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

/**
 * GET /api/admin/workspaces/open?userId=X
 * Admin opens another user's running workspace.
 */
export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = req.auth.user as any;
  if (!ADMIN_ROLES.includes(actor.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const url = new URL(req.url);
  const userId = Number(url.searchParams.get("userId"));
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance) {
    return NextResponse.json({ error: "No running workspace for this user." }, { status: 404 });
  }

  let accessToken: string;
  try {
    const session = await getGsdSession(userId);
    accessToken = session.accessToken;
  } catch {
    return NextResponse.json({ error: "Session expired." }, { status: 401 });
  }

  const baseUrl = await getWorkspaceUrl(userId, targetUser.username, instance.port);
  return NextResponse.redirect(`${baseUrl}/#token=${accessToken}`);
});
