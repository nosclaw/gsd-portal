import { getDb } from "@/lib/db";
import { users, passwordResetTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const { token, newPassword } = await req.json();

    if (!token || !newPassword) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "Token and new password are required." } },
        { status: 400 }
      );
    }

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: { code: "WEAK_PASSWORD", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const resetToken = await db.query.passwordResetTokens.findFirst({
      where: eq(passwordResetTokens.token, token)
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: { code: "INVALID_TOKEN", message: "Invalid or expired reset token." } },
        { status: 400 }
      );
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: { code: "TOKEN_USED", message: "This reset token has already been used." } },
        { status: 400 }
      );
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: { code: "TOKEN_EXPIRED", message: "This reset token has expired." } },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, resetToken.userId));
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, resetToken.id));

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
