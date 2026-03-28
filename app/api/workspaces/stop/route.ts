import { auth } from "@/auth";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
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
    await stopWorkspace(Number(user.id), user.username);
    await revokeGsdSession(Number(user.id));
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to stop workspace.";
    return NextResponse.json(
      { error: { code: "STOP_FAILED", message } },
      { status: 500 }
    );
  }
});
