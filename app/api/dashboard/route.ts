import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, workspaceInstances, auditLogs } from "@/lib/db/schema";
import { eq, count, and, gte } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserStatus, WorkspaceStatus } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  const db = await getDb();

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Total users in same tenant
  const [totalUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(eq(users.tenantId, Number(user.tenantId)));

  // Approved users
  const [approvedUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.tenantId, Number(user.tenantId)), eq(users.status, UserStatus.APPROVED)));

  // Pending users
  const [pendingUsers] = await db
    .select({ count: count() })
    .from(users)
    .where(and(eq(users.tenantId, Number(user.tenantId)), eq(users.status, UserStatus.PENDING)));

  // Active workspaces
  const [activeWorkspaces] = await db
    .select({ count: count() })
    .from(workspaceInstances)
    .where(eq(workspaceInstances.status, WorkspaceStatus.RUNNING));

  // Recent audit events (last 24h)
  const [recentAuditCount] = await db
    .select({ count: count() })
    .from(auditLogs)
    .where(gte(auditLogs.timestamp, twentyFourHoursAgo));

  // Recent audit entries for the activity feed
  const recentEvents: {
    actor: string;
    action: string;
    resource: string;
    result: string;
    timestamp: Date | null;
  }[] = await db
    .select({
      actor: auditLogs.actor,
      action: auditLogs.action,
      resource: auditLogs.resource,
      result: auditLogs.result,
      timestamp: auditLogs.timestamp
    })
    .from(auditLogs)
    .orderBy(auditLogs.id)
    .limit(10);

  return apiSuccess({
    totalUsers: totalUsers.count,
    approvedUsers: approvedUsers.count,
    pendingUsers: pendingUsers.count,
    activeWorkspaces: activeWorkspaces.count,
    recentAuditCount: recentAuditCount.count,
    recentEvents
  });
});
