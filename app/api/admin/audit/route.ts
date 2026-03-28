import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc, and, gte, lte } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || (req.auth.user as any).role === "MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

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

  const db = await getDb();
  const logs = await db.query.auditLogs.findMany({
    where: conditions.length > 0 ? and(...conditions) : undefined,
    orderBy: [desc(auditLogs.timestamp)],
    limit: 500
  });

  return NextResponse.json(logs);
});
