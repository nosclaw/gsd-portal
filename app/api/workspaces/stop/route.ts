import { auth } from "@/auth";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;

  try {
    await stopWorkspace(Number(user.id), user.username);
    await revokeGsdSession(Number(user.id));
    return apiSuccess({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to stop workspace.";
    return apiError("STOP_FAILED", message, 500);
  }
});
