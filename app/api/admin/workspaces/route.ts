import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { ADMIN_ROLES } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;

  if (!ADMIN_ROLES.includes(user.role)) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
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

  return apiSuccess(instances);
});
