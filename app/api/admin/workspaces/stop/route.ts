import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const admin = req.auth.user as any;

  if (!ADMIN_ROLES.includes(admin.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required." } },
      { status: 403 }
    );
  }

  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELDS", message: "userId is required." } },
      { status: 400 }
    );
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, Number(userId))
  });

  if (!targetUser) {
    return NextResponse.json(
      { error: { code: "USER_NOT_FOUND", message: "User not found." } },
      { status: 404 }
    );
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

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to force stop workspace.";
    return NextResponse.json(
      { error: { code: "FORCE_STOP_FAILED", message } },
      { status: 500 }
    );
  }
});
