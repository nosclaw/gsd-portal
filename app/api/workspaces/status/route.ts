import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  const db = await getDb();

  const instance = await db.query.workspaceInstances.findFirst({
    where: eq(workspaceInstances.userId, Number(user.id))
  });

  const session = await db.query.workspaceSessions.findFirst({
    where: eq(workspaceSessions.userId, Number(user.id))
  });

  return NextResponse.json({
    instance: instance || { status: "STOPPED" },
    session: session ? { expiresAt: session.expiresAt, hasToken: true } : null
  });
});
