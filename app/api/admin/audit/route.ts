import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, and, gte, lte, like, or, sql, asc } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || (req.auth.user as PortalUser).role === UserRole.MEMBER) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get("perPage")) || 20));
  const sort = url.searchParams.get("sort") || "timestamp";
  const dir = url.searchParams.get("dir") === "asc" ? "asc" : "desc";
  const search = url.searchParams.get("search") || "";

  const conditions = [];
  if (from) {
    conditions.push(gte(auditLogs.timestamp, new Date(from)));
  }
  if (to) {
    // Include the entire "to" day
    const toEnd = new Date(to);
    toEnd.setHours(23, 59, 59, 999);
    conditions.push(lte(auditLogs.timestamp, toEnd));
  }
  if (search) {
    conditions.push(
      or(
        like(auditLogs.actor, `%${search}%`),
        like(auditLogs.action, `%${search}%`),
        like(auditLogs.resource, `%${search}%`)
      )!
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const sortColumn = sort === "actor" ? auditLogs.actor
    : sort === "action" ? auditLogs.action
    : sort === "resource" ? auditLogs.resource
    : auditLogs.timestamp;

  const orderBy = dir === "asc" ? asc(sortColumn) : desc(sortColumn);

  const db = await getDb();

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(auditLogs)
    .where(where);

  const data = await db
    .select()
    .from(auditLogs)
    .where(where)
    .orderBy(orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return apiSuccess({ data, total: totalResult.count, page, perPage });
});
