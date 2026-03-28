import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances, auditLogs } from "@/lib/db/schema";
import { eq, and, gte, like, or } from "drizzle-orm";
import { statfs } from "node:fs/promises";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const db = await getDb();

  // Active workspaces
  const running = await db.query.workspaceInstances.findMany({
    where: eq(workspaceInstances.status, "RUNNING")
  });
  const activeWorkspaces = running.length;

  // Failed launches in last 24h
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const failedLogs = await db.query.auditLogs.findMany({
    where: and(
      gte(auditLogs.timestamp, oneDayAgo),
      or(
        like(auditLogs.action, "%FAILED%"),
        like(auditLogs.action, "%ERROR%")
      )
    )
  });
  const failedLaunches24h = failedLogs.length;

  // Disk usage
  let diskUsage = { total: 0, used: 0, free: 0 };
  try {
    const stats = await statfs("/home");
    const total = stats.bsize * stats.blocks;
    const free = stats.bsize * stats.bfree;
    diskUsage = { total, used: total - free, free };
  } catch {
    // /home may not exist on all systems, try root
    try {
      const stats = await statfs("/");
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      diskUsage = { total, used: total - free, free };
    } catch {
      // Ignore
    }
  }

  return NextResponse.json({
    activeWorkspaces,
    failedLaunches24h,
    diskUsage
  });
});
