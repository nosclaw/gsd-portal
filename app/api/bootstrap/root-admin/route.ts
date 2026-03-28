import { getDb } from "@/lib/db";
import { users, tenants, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";

export async function POST(req: Request) {
  const db = await getDb();

  // Only allow if no ROOT_ADMIN exists
  const existingAdmin = await db.query.users.findFirst({
    where: eq(users.role, "ROOT_ADMIN")
  });

  if (existingAdmin) {
    return apiError("ALREADY_INITIALIZED", "Root admin already exists.", 409);
  }

  const { username, email, password, name, tenantName } = await req.json();

  if (!username || !email || !password || !name) {
    return apiError("MISSING_FIELDS", "username, email, password, and name are required.", 400);
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

  return apiSuccess({
    success: true,
    user: { id: admin.id, username: admin.username, role: admin.role }
  });
}
