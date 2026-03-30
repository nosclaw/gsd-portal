import { auth } from "@/auth";
import { launchWorkspace } from "@/lib/orchestrator";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";
import { NextRequest } from "next/server";

// Internal relaunch handler — called by ws-proxy with X-Internal-User-Id header
export async function POST(req: NextRequest) {
  const internalUserId = req.headers.get("X-Internal-User-Id");
  const internalUsername = req.headers.get("X-Internal-Username");

  if (internalUserId && internalUsername) {
    try {
      const instance = await launchWorkspace(Number(internalUserId), internalUsername);
      return apiSuccess(instance);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to launch workspace.";
      return apiError("LAUNCH_FAILED", message, 500);
    }
  }

  // Normal auth flow
  return auth(async (authReq) => {
    if (!authReq.auth || !authReq.auth.user) {
      return apiError("UNAUTHORIZED", "Authentication required.", 401);
    }
    const user = authReq.auth.user as PortalUser;
    try {
      const instance = await launchWorkspace(Number(user.id), user.username, user.email);
      return apiSuccess(instance);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to launch workspace.";
      return apiError("LAUNCH_FAILED", message, 500);
    }
  })(req, {} as never);
}
