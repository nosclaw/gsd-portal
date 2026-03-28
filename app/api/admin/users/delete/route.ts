import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInstances, workspaceSessions, devEnvVersions, auditLogs } from "@/lib/db/schema";
import { resolveWorkspaceDir } from "@/lib/env";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { eq, and } from "drizzle-orm";
import { rm } from "node:fs/promises";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actor = req.auth.user as any;
  if (actor.role !== "ROOT_ADMIN" && actor.role !== "TENANT_ADMIN") {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "userId is required." }, { status: 400 });
  }

  // Cannot delete yourself
  if (Number(actor.id) === Number(userId)) {
    return NextResponse.json({ error: "Cannot delete your own account." }, { status: 400 });
  }

  const db = await getDb();

  const targetUser = await db.query.users.findFirst({
    where: and(eq(users.id, Number(userId)), eq(users.tenantId, Number(actor.tenantId)))
  });

  if (!targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  // Cannot delete ROOT_ADMIN
  if (targetUser.role === "ROOT_ADMIN") {
    return NextResponse.json({ error: "Cannot delete root admin." }, { status: 403 });
  }

  // 1. Stop workspace if running
  try {
    await stopWorkspace(targetUser.id, targetUser.username);
    await revokeGsdSession(targetUser.id);
  } catch {
    // May not be running
  }

  // 2. Delete workspace directory
  try {
    const workspaceDir = resolveWorkspaceDir(targetUser.username);
    await rm(workspaceDir, { recursive: true, force: true });
  } catch {
    // Directory may not exist
  }

  // 3. Delete related DB records
  await db.delete(workspaceSessions).where(eq(workspaceSessions.userId, targetUser.id));
  await db.delete(workspaceInstances).where(eq(workspaceInstances.userId, targetUser.id));
  await db.delete(devEnvVersions).where(eq(devEnvVersions.userId, targetUser.id));
  await db.delete(users).where(eq(users.id, targetUser.id));

  // 4. Audit log
  await db.insert(auditLogs).values({
    actor: actor.username,
    action: "USER_DELETED",
    resource: `user:${targetUser.username}`,
    result: "SUCCESS",
    metadata: { deletedUserId: targetUser.id, deletedUsername: targetUser.username }
  });

  return NextResponse.json({ success: true });
});
