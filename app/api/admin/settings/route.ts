import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { tenants, auditLogs } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { ADMIN_ROLES } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  if (!ADMIN_ROLES.includes(user.role)) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const db = await getDb();
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, Number(user.tenantId))
  });

  if (!tenant) {
    return apiError("NOT_FOUND", "Tenant not found.", 404);
  }

  return apiSuccess({
    tenantName: tenant.name,
    settings: tenant.settings ?? {}
  });
});

export const PUT = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  if (!ADMIN_ROLES.includes(user.role)) {
    return apiError("FORBIDDEN", "Admin access required.", 403);
  }

  const body = await req.json();
  const db = await getDb();

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, Number(user.tenantId))
  });

  if (!tenant) {
    return apiError("NOT_FOUND", "Tenant not found.", 404);
  }

  const currentSettings = tenant.settings ?? {};
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

  return apiSuccess({ success: true, settings: updatedSettings });
});
