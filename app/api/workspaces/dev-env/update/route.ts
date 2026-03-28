import { auth } from "@/auth";
import { updateDevEnv } from "@/lib/dev-env";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = req.auth.user as any;

  try {
    const result = await updateDevEnv(Number(user.id), user.username);
    return NextResponse.json(result);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update dev-env.";
    return NextResponse.json(
      { error: { code: "DEV_ENV_UPDATE_FAILED", message } },
      { status: 500 }
    );
  }
});
