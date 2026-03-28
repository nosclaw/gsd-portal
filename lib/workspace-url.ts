import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { appEnv } from "@/lib/env";

/**
 * Build the workspace URL.
 * All users share one workspace domain, distinguished by token.
 *
 * With WORKSPACE_DOMAIN: https://gsd-dev-local.nosclaw.com
 * Without:               http://localhost:{port}
 */
export async function getWorkspaceUrl(userId: number, username: string, port: number): Promise<string> {
  let domain = appEnv.workspaceDomain;

  if (!domain) {
    const db = await getDb();
    const dbUser = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: { tenant: true }
    });
    domain = (dbUser?.tenant?.settings as any)?.workspace_domain || "";
  }

  if (domain) {
    const protocol = domain.includes("localhost") ? "http" : "https";
    return `${protocol}://${domain}`;
  }

  return `http://localhost:${port}`;
}
