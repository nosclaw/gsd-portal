import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { refreshGsdSession } from "@/lib/session-broker";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { WorkspaceStatus } from "@/lib/types";

export const POST = auth(async (req) => {
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
    return apiError("NO_RUNNING_WORKSPACE", "No running workspace to reconnect.", 404);
  }

  try {
    const session = await refreshGsdSession(Number(user.id), instance.port);
    return apiSuccess({
      success: true,
      session: { expiresAt: session.expiresAt }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reconnect session.";
    return apiError("RECONNECT_FAILED", message, 500);
  }
});
