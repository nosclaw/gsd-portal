import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users, auditLogs } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { stopWorkspace } from "@/lib/orchestrator";
import { revokeGsdSession } from "@/lib/session-broker";
import { NextResponse } from "next/server";

export const POST = auth(async (req) => {
  if (!req.auth || (req.auth.user as any).role === "MEMBER") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  const { userIds, action } = await req.json();
  const actor = req.auth.user as any;

  if (!Array.isArray(userIds) || userIds.length === 0) {
    return NextResponse.json({ error: "No users specified" }, { status: 400 });
  }

  if (!["approve", "reject", "suspend"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const db = await getDb();
  const status = action === "approve" ? "APPROVED" : action === "reject" ? "REJECTED" : "SUSPENDED";

  // Fetch target users, filtering to same tenant
  const targetUsers = await db.query.users.findMany({
    where: and(
      inArray(users.id, userIds),
      eq(users.tenantId, actor.tenantId)
    )
  });

  // Filter out self and ROOT_ADMIN
  const eligible = targetUsers.filter(
    (u: any) => u.id !== Number(actor.id) && u.role !== "ROOT_ADMIN"
  );

  let processed = 0;
  for (const user of eligible) {
    await db
      .update(users)
      .set({ status })
      .where(eq(users.id, user.id));

    if (status === "SUSPENDED" || status === "REJECTED") {
      try {
        await stopWorkspace(user.id, user.username);
        await revokeGsdSession(user.id);
      } catch {
        // Workspace may not be running
      }
    }

    await db.insert(auditLogs).values({
      actor: actor.username,
      action: `USER_${action.toUpperCase()}D`,
      resource: `user:${user.username}`,
      result: "SUCCESS",
      metadata: { bulk: true }
    });

    processed++;
  }

  return NextResponse.json({ success: true, processed });
});
