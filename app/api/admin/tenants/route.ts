import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { tenants, auditLogs } from "@/lib/db/schema";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { UserRole } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  if (user.role !== UserRole.ROOT_ADMIN) {
    return apiError("FORBIDDEN", "Root admin access required.", 403);
  }

  const db = await getDb();
  const allTenants = await db.query.tenants.findMany();
  return apiSuccess(allTenants);
});

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  if (user.role !== UserRole.ROOT_ADMIN) {
    return apiError("FORBIDDEN", "Root admin access required.", 403);
  }

  const { name, settings } = await req.json();

  if (!name) {
    return apiError("MISSING_FIELDS", "Tenant name is required.", 400);
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

  return apiSuccess(tenant, 201);
});
