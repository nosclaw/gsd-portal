import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { eq, and, desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  const userId = Number(user.id);
  const db = await getDb();

  // First try to find a RUNNING instance
  let instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, userId),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  // If no RUNNING, get the most recent record
  if (!instance) {
    instance = await db.query.workspaceInstances.findFirst({
      where: eq(workspaceInstances.userId, userId),
      orderBy: desc(workspaceInstances.id)
    });
  }

  const session = await db.query.workspaceSessions.findFirst({
    where: eq(workspaceSessions.userId, userId)
  });

  const workspaceUrl = instance?.status === "RUNNING"
    ? await getWorkspaceUrl(userId, user.username, instance.port)
    : null;

  return NextResponse.json({
    instance: instance || { status: "STOPPED" },
    session: session ? { expiresAt: session.expiresAt, hasToken: true } : null,
    workspaceUrl
  });
});
