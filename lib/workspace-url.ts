import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { appEnv } from "@/lib/env";

/**
 * Build the workspace URL for a user.
 * Format: https://{username}-{workspace_domain}
 * e.g. https://admin-gsd-dev-local.letsme.run
 *
 * Falls back to env WORKSPACE_DOMAIN, then tenant settings.
 */
export async function getWorkspaceUrl(userId: number, username: string, port: number): Promise<string | null> {
  let domain = appEnv.workspaceDomain;

  if (!domain) {
    const db = await getDb();
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { tenant: true }
    });
    domain = (dbUser?.tenant?.settings as any)?.workspace_domain || "";
  }

  if (!domain) return null;

  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${username}-${domain}`;
}
