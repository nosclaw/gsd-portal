import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { launchWorkspace } from "@/lib/orchestrator";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = req.auth.user as any;
  if (!ADMIN_ROLES.includes(admin.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  const db = await getDb();
  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, Number(userId))
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  try {
    const instance = await launchWorkspace(targetUser.id, targetUser.username, targetUser.email);

    await db.insert(auditLogs).values({
      actor: admin.username,
      action: "ADMIN_LAUNCH_WORKSPACE",
      resource: `workspace:${targetUser.username}`,
      result: "SUCCESS",
      metadata: { targetUserId: targetUser.id }
    });

    return NextResponse.json(instance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to launch workspace.";
    return NextResponse.json({ error: { code: "LAUNCH_FAILED", message } }, { status: 500 });
  }
});
