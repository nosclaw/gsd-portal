import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { getGsdSession } from "@/lib/session-broker";
import { getWorkspaceUrl } from "@/lib/workspace-url";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { WorkspaceStatus } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;
  const db = await getDb();

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, Number(user.id)),
      eq(workspaceInstances.status, WorkspaceStatus.RUNNING)
    )
  });

  if (!instance) {
    return apiError("NO_RUNNING_WORKSPACE", "No running workspace.", 404);
  }

  let accessToken: string;
  try {
    const session = await getGsdSession(Number(user.id));
    accessToken = session.accessToken;
  } catch {
    return apiError("SESSION_EXPIRED", "Session expired. Please reconnect.", 401);
  }

  // Return the URL for client-side redirect (server-side redirect drops hash fragment)
  const baseUrl = await getWorkspaceUrl(Number(user.id), user.username, instance.port);
  const workspaceUrl = `${baseUrl}/?_token=${accessToken}#token=${accessToken}`;
  return apiSuccess({ url: workspaceUrl });
});
