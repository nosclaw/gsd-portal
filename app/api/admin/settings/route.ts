import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { tenants, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";

const ADMIN_ROLES = ["ROOT_ADMIN", "TENANT_ADMIN"];

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const db = await getDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, Number(user.tenantId))
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  return NextResponse.json({
    tenantName: tenant.name,
    settings: tenant.settings ?? {}
  });
});

export const PUT = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  if (!ADMIN_ROLES.includes(user.role)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const body = await req.json();
  const db = await getDb();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, Number(user.tenantId))
  });

  if (!tenant) {
    return NextResponse.json({ error: "Tenant not found." }, { status: 404 });
  }

  const currentSettings = (tenant.settings ?? {}) as any;
  const updatedSettings = { ...currentSettings, ...body };

  await db
    .update(tenants)
    .set({ settings: updatedSettings })
    .where(eq(tenants.id, tenant.id));

  await db.insert(auditLogs).values({
    actor: user.username,
    action: "TENANT_SETTINGS_UPDATED",
    resource: `tenant:${tenant.id}`,
    result: "SUCCESS",
    metadata: { updatedKeys: Object.keys(body) }
  });

  return NextResponse.json({ success: true, settings: updatedSettings });
});
