import { getDb } from "@/lib/db";
import { users, tenants, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const db = await getDb();

  // Only allow if no ROOT_ADMIN exists
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, "ROOT_ADMIN")
  });

  if (existingAdmin) {
    return NextResponse.json(
      { error: { code: "ALREADY_INITIALIZED", message: "Root admin already exists." } },
      { status: 409 }
    );
  }

  const { username, email, password, name, tenantName } = await req.json();

  if (!username || !email || !password || !name) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELDS", message: "username, email, password, and name are required." } },
      { status: 400 }
    );
  }

  const bcrypt = await import("bcryptjs");
  const hashedPassword = await bcrypt.hash(password, 10);

  // Create default tenant if needed
  let tenant = await db.query.tenants.findFirst();
  if (!tenant) {
    const [newTenant] = await db
      .insert(tenants)
      .values({
        name: tenantName || "Default Team",
        status: "ACTIVE",
        settings: { allow_registration: true, idle_timeout_minutes: 60 }
      })
      .returning();
    tenant = newTenant;
  }

  const [admin] = await db
    .insert(users)
    .values({
      username,
      email,
      password: hashedPassword,
      name,
      role: "ROOT_ADMIN",
      status: "APPROVED",
      tenantId: tenant.id
    })
    .returning();

  await db.insert(auditLogs).values({
    actor: "system",
    action: "ROOT_ADMIN_BOOTSTRAPPED",
    resource: `user:${username}`,
    result: "SUCCESS"
  });

  return NextResponse.json({
    success: true,
    user: { id: admin.id, username: admin.username, role: admin.role }
  });
}
