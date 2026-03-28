import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaceSessions, auditLogs } from "@/lib/db/schema";
import { decrypt, encrypt } from "@/lib/crypto";
import { logger } from "@/lib/logger";
import { randomBytes } from "node:crypto";

// Mutex to prevent concurrent refreshes per user
const refreshLocks = new Map<number, boolean>();

export async function getGsdSession(userId: number) {
  const db = await getDb();
  const session = await db.query.workspaceSessions.findFirst({
    where: eq(workspaceSessions.userId, userId)
  });

  if (!session) {
    throw new Error("No active GSD session found.");
  }

  return {
    accessToken: decrypt(session.accessToken),
    expiresAt: session.expiresAt
  };
}

/**
 * Refresh the GSD session token for a user.
 * Generates a new auth token and updates the encrypted session.
 * Implements concurrent refresh protection and retry with backoff.
 */
export async function refreshGsdSession(userId: number, port: number): Promise<{ accessToken: string; expiresAt: Date }> {
  if (refreshLocks.get(userId)) {
    logger.warn("Concurrent refresh blocked.", { userId, operation: "refreshGsdSession" });
    throw new Error("Refresh already in progress for this user.");
  }

  refreshLocks.set(userId, true);
  const db = await getDb();
  const retryDelays = [1000, 3000, 5000];

  try {
    for (let attempt = 0; attempt < retryDelays.length; attempt++) {
      try {
        const newToken = randomBytes(32).toString("hex");
        const newExpiresAt = new Date(Date.now() + 24 * 3600 * 1000);
        const encryptedToken = encrypt(newToken);

        await db
          .update(workspaceSessions)
          .set({
            accessToken: encryptedToken,
            refreshToken: encryptedToken,
            expiresAt: newExpiresAt
          })
          .where(eq(workspaceSessions.userId, userId));

        await db.insert(auditLogs).values({
          actor: "system",
          action: "SESSION_REFRESHED",
          resource: `session:user:${userId}`,
          result: "SUCCESS",
          metadata: { port, attempt: attempt + 1 }
        });

        logger.info("GSD session refreshed.", { userId, operation: "refreshGsdSession", attempt: attempt + 1 });
        return { accessToken: newToken, expiresAt: newExpiresAt };
      } catch (error) {
        logger.warn("GSD session refresh attempt failed.", {
          userId,
          operation: "refreshGsdSession",
          attempt: attempt + 1,
          error: error instanceof Error ? error.message : String(error)
        });

        if (attempt < retryDelays.length - 1) {
          await new Promise((r) => setTimeout(r, retryDelays[attempt]));
        }
      }
    }

    // All retries exhausted
    await db.insert(auditLogs).values({
      actor: "system",
      action: "SESSION_REFRESH_FAILED",
      resource: `session:user:${userId}`,
      result: "FAILURE",
      metadata: { port, reason: "retries_exhausted" }
    });

    logger.error("GSD session refresh failed after all retries.", { userId, operation: "refreshGsdSession" });
    throw new Error("GSD session refresh failed after 3 attempts.");
  } finally {
    refreshLocks.delete(userId);
  }
}

export async function revokeGsdSession(userId: number) {
  const db = await getDb();
  await db.delete(workspaceSessions).where(eq(workspaceSessions.userId, userId));
}
