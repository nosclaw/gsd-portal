import { auth } from "@/auth";
import { launchWorkspace } from "@/lib/orchestrator";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;

  try {
    const instance = await launchWorkspace(Number(user.id), user.username, user.email);
    return apiSuccess(instance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to launch workspace.";
    return apiError("LAUNCH_FAILED", message, 500);
  }
});
