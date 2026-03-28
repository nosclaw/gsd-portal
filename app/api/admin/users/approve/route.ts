import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || (req.auth.user as any).role === "MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userId, action } = await req.json();
  const actor = req.auth.user as any;
  const db = await getDb();

  const status = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "SUSPENDED";

  // Get target user info before update
  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, userId), eq(users.tenantId, actor.tenantId))
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  await db
    .update(users)
    .set({ status })
    .where(and(eq(users.id, userId), eq(users.tenantId, actor.tenantId)));

  // When suspending or rejecting, forcibly stop workspace and revoke session
  if (status === "SUSPENDED" || status === "REJECTED") {
    try {
      await stopWorkspace(userId, targetUser.username);
      await revokeGsdSession(userId);
    } catch {
      // Workspace may not be running — that's OK
    }
  }

  await db.insert(auditLogs).values({
    actor: actor.username,
    action: `USER_${action.toUpperCase()}D`,
    resource: `user:${targetUser.username}`,
    result: "SUCCESS"
  });

  return NextResponse.json({ success: true });
});
