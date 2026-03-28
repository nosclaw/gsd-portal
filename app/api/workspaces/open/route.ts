import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { getGsdSession } from "@/lib/session-broker";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * GET /api/workspaces/open
 * Server-side redirect to the GSD workspace with auth token injected.
 * The token never touches the frontend — it's added server-side in the redirect URL.
 */
export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;
  const db = await getDb();

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, Number(user.id)),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance) {
    return NextResponse.json(
      { error: { code: "NO_RUNNING_WORKSPACE", message: "No running workspace." } },
      { status: 404 }
    );
  }

  let accessToken: string;
  try {
    const session = await getGsdSession(Number(user.id));
    accessToken = session.accessToken;
  } catch {
    return NextResponse.json(
      { error: { code: "SESSION_EXPIRED", message: "Session expired. Please reconnect." } },
      { status: 401 }
    );
  }

  // Build the workspace URL with token in hash fragment.
  // Use the Host header to determine the correct hostname for the redirect.
  const reqUrl = new URL(req.url);
  const host = reqUrl.hostname;
  const workspaceUrl = `http://${host}:${instance.port}/#token=${accessToken}`;

  return NextResponse.redirect(workspaceUrl);
});
