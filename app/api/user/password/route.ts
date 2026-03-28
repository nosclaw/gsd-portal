import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { apiError, apiSuccess } from "@/lib/api-response";

export const PUT = auth(async (req) => {
  if (!req.auth || !req.auth.user) {
    return apiError("UNAUTHORIZED", "Authentication required.", 401);
  }

  const userId = Number((req.auth.user as { id: string }).id);
  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return apiError("MISSING_FIELDS", "Current password and new password are required.", 400);
  }

  if (newPassword.length < 6) {
    return apiError("WEAK_PASSWORD", "New password must be at least 6 characters.", 400);
  }

  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) });

  if (!user) {
    return apiError("NOT_FOUND", "User not found.", 404);
  }

  const bcrypt = await import("bcryptjs");
  const isValid = await bcrypt.compare(currentPassword, user.password);

  if (!isValid) {
    return apiError("INVALID_PASSWORD", "Current password is incorrect.", 403);
  }

  const hashed = await bcrypt.hash(newPassword, 10);
  await db.update(users).set({ password: hashed }).where(eq(users.id, userId));

  return apiSuccess({ success: true });
});
