import { auth } from "@/auth";
import { launchWorkspace } from "@/lib/orchestrator";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const user = req.auth.user as any;

  try {
    const instance = await launchWorkspace(Number(user.id), user.username, user.email);
    return NextResponse.json(instance);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to launch workspace.";
    return NextResponse.json(
      { error: { code: "LAUNCH_FAILED", message } },
      { status: 500 }
    );
  }
});
