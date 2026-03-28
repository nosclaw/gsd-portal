import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { auditLogs } from "@/lib/db/schema";
import { desc } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || (req.auth.user as any).role === "MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const db = await getDb();
  const logs = await db.query.auditLogs.findMany({
    orderBy: [desc(auditLogs.timestamp)],
    limit: 100
  });

  return NextResponse.json(logs);
});
