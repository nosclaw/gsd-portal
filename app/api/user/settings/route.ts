import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { encrypt, decrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number((req.auth.user as any).id);
  const db = await getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!user) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  return NextResponse.json({
    gitUsername: user.gitUsername || "",
    gitEmail: user.gitEmail || "",
    hasGithubPat: !!user.githubPat
  });
});

export const PUT = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = Number((req.auth.user as any).id);
  const body = await req.json();
  const db = await getDb();

  const updates: any = {};

  if (body.gitUsername !== undefined) updates.gitUsername = body.gitUsername || null;
  if (body.gitEmail !== undefined) updates.gitEmail = body.gitEmail || null;
  if (body.githubPat !== undefined) {
    updates.githubPat = body.githubPat ? encrypt(body.githubPat) : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
});
