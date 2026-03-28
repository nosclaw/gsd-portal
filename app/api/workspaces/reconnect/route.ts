import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { refreshGsdSession } from "@/lib/session-broker";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const user = req.auth.user as any;
  const db = await getDb();

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, Number(user.id)),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance) {
    return NextResponse.json(
      { error: { code: "NO_RUNNING_WORKSPACE", message: "No running workspace to reconnect." } },
      { status: 404 }
    );
  }

  try {
    const session = await refreshGsdSession(Number(user.id), instance.port);
    return NextResponse.json({
      success: true,
      session: { expiresAt: session.expiresAt }
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to reconnect session.";
    return NextResponse.json(
      { error: { code: "RECONNECT_FAILED", message } },
      { status: 500 }
    );
  }
});
