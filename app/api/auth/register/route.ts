import { getDb } from "@/lib/db";
import { users, tenants, auditLogs } from "@/lib/db/schema";
import { eq, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { sanitizeUserInput } from "@/lib/sanitize";
import { apiError, apiSuccess } from "@/lib/api-response";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_REGEX = /^[a-z0-9_-]{3,32}$/;
const MIN_PASSWORD_LENGTH = 8;

export async function POST(req: Request) {
  try {
    const ip = getClientIp(req);
    const { success, resetAt } = rateLimit(`register:${ip}`, 5, 15 * 60 * 1000);
    if (!success) {
      // Custom headers required — use NextResponse directly
      return NextResponse.json(
        { error: { code: "RATE_LIMITED", message: "Too many registration attempts. Please try again later." } },
        { status: 429, headers: { "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)) } }
      );
    }

    const raw = await req.json();
    const { password } = raw;
    const { username, name, email } = sanitizeUserInput(raw, ["username", "name", "email"]);

    if (!username || !name || !email || !password) {
      return apiError("MISSING_FIELDS", "All fields are required: username, name, email, password.", 400);
    }

    if (!USERNAME_REGEX.test(username)) {
      return apiError("INVALID_USERNAME", "Username must be 3-32 characters, lowercase letters, numbers, hyphens, or underscores.", 400);
    }

    if (!EMAIL_REGEX.test(email)) {
      return apiError("INVALID_EMAIL", "Please provide a valid email address.", 400);
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return apiError("WEAK_PASSWORD", `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, 400);
    }

    const db = await getDb();

    const existing = await db.query.users.findFirst({
      where: or(eq(users.username, username), eq(users.email, email))
    });

    if (existing) {
      const field = existing.username === username ? "Username" : "Email";
      return apiError("DUPLICATE_IDENTITY", `${field} is already taken.`, 409);
    }

    const firstTenant = await db.query.tenants.findFirst();
    if (!firstTenant) {
      return apiError("SYSTEM_NOT_INITIALIZED", "System not initialized. No tenant found.", 503);
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        username,
        email,
        name,
        password: hashedPassword,
        tenantId: firstTenant.id,
        role: "MEMBER",
        status: "PENDING"
      });

      await tx.insert(auditLogs).values({
        actor: username,
        action: "USER_REGISTERED",
        resource: `user:${username}`,
        result: "SUCCESS",
        metadata: { email }
      });
    });

    return apiSuccess({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return apiError("INTERNAL_ERROR", message, 500);
  }
}
