import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || (req.auth.user as any).role === "MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const user = req.auth.user as any;
  const db = await getDb();

  const allUsers = await db.query.users.findMany({
    where: eq(users.tenantId, user.tenantId)
  });

  return NextResponse.json(allUsers);
});
