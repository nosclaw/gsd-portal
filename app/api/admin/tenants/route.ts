import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { tenants, auditLogs } from "@/lib/db/schema";
import { NextResponse } from "next/server";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  if (user.role !== "ROOT_ADMIN") {
    return NextResponse.json({ error: "Root admin access required." }, { status: 403 });
  }

  const db = await getDb();
  const allTenants = await db.query.tenants.findMany();
  return NextResponse.json(allTenants);
});

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  if (user.role !== "ROOT_ADMIN") {
    return NextResponse.json({ error: "Root admin access required." }, { status: 403 });
  }

  const { name, settings } = await req.json();

  if (!name) {
    return NextResponse.json(
      { error: { code: "MISSING_FIELDS", message: "Tenant name is required." } },
      { status: 400 }
    );
  }

  const db = await getDb();

  const [tenant] = await db
    .insert(tenants)
    .values({
      name,
      status: "ACTIVE",
      settings: settings ?? { allow_registration: true, idle_timeout_minutes: 60 }
    })
    .returning();

  await db.insert(auditLogs).values({
    actor: user.username,
    action: "TENANT_CREATED",
    resource: `tenant:${tenant.id}`,
    result: "SUCCESS",
    metadata: { tenantName: name }
  });

  return NextResponse.json(tenant, { status: 201 });
});
