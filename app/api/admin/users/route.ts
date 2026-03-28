import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq, like, or, sql, asc, desc } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || (req.auth.user as PortalUser).role === UserRole.MEMBER) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const user = req.auth.user as PortalUser;
  const db = await getDb();

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const perPage = Math.min(200, Math.max(1, Number(url.searchParams.get("perPage")) || 20));
  const sort = url.searchParams.get("sort") || "id";
  const dir = url.searchParams.get("dir") === "desc" ? "desc" : "asc";
  const search = url.searchParams.get("search") || "";

  const tenantFilter = eq(users.tenantId, user.tenantId);

  const conditions = search
    ? [
        tenantFilter,
        or(
          like(users.username, `%${search}%`),
          like(users.name, `%${search}%`),
          like(users.email, `%${search}%`)
        )!
      ]
    : [tenantFilter];

  const where = conditions.length === 1 ? conditions[0] : sql`${conditions[0]} AND ${conditions[1]}`;

  const sortColumn = sort === "username" ? users.username
    : sort === "name" ? users.name
    : sort === "email" ? users.email
    : sort === "role" ? users.role
    : sort === "status" ? users.status
    : users.id;

  const orderBy = dir === "desc" ? desc(sortColumn) : asc(sortColumn);

  const [totalResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(users)
    .where(where);

  const data = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(orderBy)
    .limit(perPage)
    .offset((page - 1) * perPage);

  return apiSuccess({ data, total: totalResult.count, page, perPage });
});
