import { getDb } from "@/lib/db";
import { users, tenants, auditLogs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const { username, name, email, password } = await req.json();

    if (!username || !name || !email || !password) {
      return NextResponse.json(
        { error: { code: "MISSING_FIELDS", message: "All fields are required: username, name, email, password." } },
        { status: 400 }
      );
    }

    if (!USERNAME_REGEX.test(username)) {
      return NextResponse.json(
        { error: { code: "INVALID_USERNAME", message: "Username must be 3-32 characters, lowercase letters, numbers, hyphens, or underscores." } },
        { status: 400 }
      );
    }

    if (!EMAIL_REGEX.test(email)) {
      return NextResponse.json(
        { error: { code: "INVALID_EMAIL", message: "Please provide a valid email address." } },
        { status: 400 }
      );
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: { code: "WEAK_PASSWORD", message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` } },
        { status: 400 }
      );
    }

    const db = await getDb();

    const existing = await db.query.users.findFirst({
      where: or(eq(users.username, username), eq(users.email, email))
    });

    if (existing) {
      const field = existing.username === username ? "Username" : "Email";
      return NextResponse.json(
        { error: { code: "DUPLICATE_IDENTITY", message: `${field} is already taken.` } },
        { status: 409 }
      );
    }

    const firstTenant = await db.query.tenants.findFirst();
    if (!firstTenant) {
      return NextResponse.json(
        { error: { code: "SYSTEM_NOT_INITIALIZED", message: "System not initialized. No tenant found." } },
        { status: 503 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.insert(users).values({
      username,
      email,
      name,
      password: hashedPassword,
      tenantId: firstTenant.id,
      role: "MEMBER",
      status: "PENDING"
    });

    await db.insert(auditLogs).values({
      actor: username,
      action: "USER_REGISTERED",
      resource: `user:${username}`,
      result: "SUCCESS",
      metadata: { email }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message } },
      { status: 500 }
    );
  }
}
