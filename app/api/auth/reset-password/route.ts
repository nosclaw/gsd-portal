import { getDb } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { success, resetAt } = rateLimit(`reset-pw:${ip}`, 3, 15 * 60 * 1000);
    if (!success) {
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many requests. Please try again later." } },
        { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const { username, email } = await req.json();

    if (!username && !email) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Username or email is required." } },
        { status: 400 }
      );
    }

    // Always return success to avoid revealing if user exists
    const successResponse = { success: true, message: "If the account exists, a reset link has been generated." };

    const db = await getDb();

    const conditions = [];
    if (username) conditions.push(eq(users.username, username));
    if (email) conditions.push(eq(users.email, email));

    const user = await db.query.users.findFirst({
      where: or(...conditions)
    });

    if (!user) {
      return NextResponse.json(successResponse);
    }

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt
    });

    const resetUrl = `/auth/reset-password?token=${token}`;

    return NextResponse.json({ ...successResponse, token, resetUrl });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
