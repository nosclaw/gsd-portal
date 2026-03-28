import { auth } from "@/auth";
import { updateDevEnv } from "@/lib/dev-env";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const user = req.auth.user as PortalUser;

  try {
    const result = await updateDevEnv(Number(user.id), user.username);
    return apiSuccess(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update dev-env.";
    return apiError("DEV_ENV_UPDATE_FAILED", message, 500);
  }
});
