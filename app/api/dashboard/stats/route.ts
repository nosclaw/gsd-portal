import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions, users, auditLogs } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = await getDb();

  // Count running workspaces
  const runningInstances = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, "RUNNING")
  });

  // Count pending approvals
  const pendingUsers = await db.query.users.findMany({
    where: eq(users.status, "PENDING")
  });

  // Count total users
  const allUsers = await db.query.users.findMany();

  // Count active sessions
  const allSessions = await db.query.workspaceSessions.findMany();

  // Recent audit logs
  const recentLogs = await db
    .select()
    .from(auditLogs)
    .orderBy(sql`timestamp DESC`)
    .limit(10);

  // Portfolio: runtime allocation per service area
  const portfolioRows = [
    {
      name: "Portal runtime",
      symbol: "PR",
      status: "Healthy",
      count: allUsers.length
    },
    {
      name: "Active workspaces",
      symbol: "AW",
      status: runningInstances.length > 0 ? "Healthy" : "Idle",
      count: runningInstances.length
    },
    {
      name: "Active sessions",
      symbol: "AS",
      status: allSessions.length > 0 ? "Stable" : "None",
      count: allSessions.length
    },
    {
      name: "Pending approvals",
      symbol: "PA",
      status: pendingUsers.length > 0 ? "Review" : "Clear",
      count: pendingUsers.length
    },
    {
      name: "Audit stream",
      symbol: "AL",
      status: "Healthy",
      count: recentLogs.length
    }
  ];

  return NextResponse.json({
    metrics: {
      activeWorkspaces: runningInstances.length,
      totalUsers: allUsers.length,
      pendingApprovals: pendingUsers.length,
      activeSessions: allSessions.length
    },
    portfolioRows,
    recentAuditLogs: recentLogs
  });
});
