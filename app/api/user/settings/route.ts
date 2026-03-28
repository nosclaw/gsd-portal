import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { encrypt } from "@/lib/crypto";
import { eq } from "drizzle-orm";
import { sanitizeUserInput } from "@/lib/sanitize";
import { apiError, apiSuccess } from "@/lib/api-response";
import type { PortalUser } from "@/lib/types";

export const GET = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const userId = Number((req.auth.user as PortalUser).id);
  const db = await getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId)
  });

  if (!user) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  return apiSuccess({
    gitUsername: user.gitUsername || "",
    gitEmail: user.gitEmail || "",
    hasGithubPat: !!user.githubPat
  });
});

export const PUT = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const userId = Number((req.auth.user as PortalUser).id);
  const raw = await req.json();
  const body = sanitizeUserInput(raw, ["gitUsername", "gitEmail"]);
  const db = await getDb();

  const updates: Record<string, string | null> = {};

  if (body.gitUsername !== undefined) updates.gitUsername = body.gitUsername || null;
  if (body.gitEmail !== undefined) updates.gitEmail = body.gitEmail || null;
  if (body.githubPat !== undefined) {
    updates.githubPat = body.githubPat ? encrypt(body.githubPat) : null;
  }

  if (Object.keys(updates).length === 0) {
    return apiError("MISSING_FIELDS", "No fields to update.", 400);
  }

  await db.update(users).set(updates).where(eq(users.id, userId));

  return apiSuccess({ success: true });
});
