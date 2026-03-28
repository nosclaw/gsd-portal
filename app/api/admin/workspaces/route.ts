import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const user = req.auth.user as any;

  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "Admin access required." } },
      { status: 403 }
    );
  }

  const db = await getDb();

  const instances = await db
    .select({
      id: workspaceInstances.id,
      userId: workspaceInstances.userId,
      port: workspaceInstances.port,
      status: workspaceInstances.status,
      pid: workspaceInstances.pid,
      lastHeartbeat: workspaceInstances.lastHeartbeat,
      error: workspaceInstances.error,
      username: users.username,
      name: users.name,
      email: users.email
    })
    .from(workspaceInstances)
    .leftJoin(users, eq(workspaceInstances.userId, users.id));

  return NextResponse.json(instances);
});
