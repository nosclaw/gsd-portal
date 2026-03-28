import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

const VALID_ROLES = ["MEMBER", "TENANT_ADMIN"];

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = req.auth.user as any;

  // Only ROOT_ADMIN can change roles
  if (actor.role !== "ROOT_ADMIN") {
    return NextResponse.json({ error: "Only root admin can change user roles." }, { status: 403 });
  }

  const { userId, role } = await req.json();

  if (!userId || !role) {
    return NextResponse.json({ error: "userId and role are required." }, { status: 400 });
  }

  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}` }, { status: 400 });
  }

  // Cannot change own role
  if (Number(actor.id) === Number(userId)) {
    return NextResponse.json({ error: "Cannot change your own role." }, { status: 400 });
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: eq(users.id, Number(userId))
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (targetUser.role === "ROOT_ADMIN") {
    return NextResponse.json({ error: "Cannot change root admin's role." }, { status: 403 });
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

  return NextResponse.json({ success: true });
});
