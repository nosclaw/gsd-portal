import { getDb } from "./lib/db";
import { tenants, users } from "./lib/db/schema";
import bcrypt from "bcryptjs";

async function seed() {
  const db = await getDb();

  console.log("Seeding database...");

  // 1. Create Tenant
  const [tenant] = await db
    .insert(tenants)
    .values({
      name: "Nosclaw Team",
      status: "ACTIVE",
      settings: { allow_registration: true, idle_timeout_minutes: 60 }
    })
    .returning();

  console.log(`Created tenant: ${tenant.name}`);

  // 2. Create Root Admin
  const hashedPassword = await bcrypt.hash("admin123", 10);
  const [rootAdmin] = await db
    .insert(users)
    .values({
      username: "admin",
      email: "admin@nosclaw.com",
      password: hashedPassword,
      name: "Root Admin",
      role: "ROOT_ADMIN",
      status: "APPROVED",
      tenantId: tenant.id
    })
    .returning();

  console.log(`Created root admin: ${rootAdmin.username}`);

  // 3. Create a member (PENDING)
  const memberPassword = await bcrypt.hash("member123", 10);
  const [member] = await db
    .insert(users)
    .values({
      username: "member",
      email: "member@nosclaw.com",
      password: memberPassword,
      name: "Regular Member",
      role: "MEMBER",
      status: "PENDING",
      tenantId: tenant.id
    })
    .returning();

  console.log(`Created member: ${member.username} (PENDING)`);

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
