import { auth } from "@/auth";
import { stopWorkspace, launchWorkspace } from "@/lib/orchestrator";
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

    const instance = await launchWorkspace(Number(user.id), user.username, user.email);
    return apiSuccess(instance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to restart workspace.";
    return apiError("RESTART_FAILED", message, 500);
  }
});
