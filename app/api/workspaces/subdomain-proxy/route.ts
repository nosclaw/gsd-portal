import { getDb } from "@/lib/db";
import { workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { apiError } from "@/lib/api-response";

/**
 * Resolve the GSD port from the Authorization Bearer token.
 * Each user's token maps to their workspace instance.
 */
async function resolvePortByToken(authHeader: string | null): Promise<{ port: number; accessToken: string } | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const db = await getDb();

  // Find the session that matches this token
  const sessions = await db.query.workspaceSessions.findMany();
  for (const session of sessions) {
    try {
      const decrypted = decrypt(session.accessToken);
      if (decrypted === token) {
        // Found the user, get their running workspace
        const instance = await db.query.workspaceInstances.findFirst({
          where: and(
            eq(workspaceInstances.userId, session.userId),
            eq(workspaceInstances.status, "RUNNING")
          )
        });
        if (instance) {
          return { port: instance.port, accessToken: decrypted };
        }
      }
    } catch (err) {
      logger.debug("Token decrypt failed during port resolution, trying next session.", { error: String(err) });
    }
  }
  return null;
}

/**
 * Get any running GSD instance port (for serving static assets without auth).
 */
async function getAnyRunningPort(): Promise<number | null> {
  const db = await getDb();
  const instance = await db.query.workspaceInstances.findFirst({
    where: eq(workspaceInstances.status, "RUNNING")
  });
  return instance?.port ?? null;
}

async function handleProxy(req: Request) {
  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization");

  let targetPort: number | null = null;
  let accessToken: string | null = null;

  // Try to resolve by token (API calls from GSD JS)
  const resolved = await resolvePortByToken(authHeader);
  if (resolved) {
    targetPort = resolved.port;
    accessToken = resolved.accessToken;
  }

  // For requests without auth (initial HTML load, static assets) -> use any running GSD
  if (!targetPort) {
    targetPort = await getAnyRunningPort();
  }

  if (!targetPort) {
    return apiError("NO_RUNNING_WORKSPACE", "No running workspace.", 404);
  }

  // Strip internal query params
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("_ws_user");
  const targetPath = cleanUrl.pathname + (cleanUrl.search || "");
  const targetUrl = `http://127.0.0.1:${targetPort}${targetPath}`;

  const headers = new Headers(req.headers);
  if (accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }
  headers.delete("host");

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // @ts-expect-error duplex required for streaming
      duplex: "half"
    });

    const responseHeaders = new Headers(proxyRes.headers);
    responseHeaders.delete("transfer-encoding");

    return new NextResponse(proxyRes.body, {
      status: proxyRes.status,
      statusText: proxyRes.statusText,
      headers: responseHeaders
    });
  } catch {
    return apiError("PROXY_FAILED", "Failed to reach workspace.", 502);
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
