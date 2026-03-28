import { getDb } from "@/lib/db";
import { users, workspaceInstances, workspaceSessions } from "@/lib/db/schema";
import { decrypt } from "@/lib/crypto";
import { appEnv } from "@/lib/env";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

/**
 * Extract username from host header.
 * Format: {username}-{workspace_domain}
 * e.g. "admin-gsd-dev-local.letsme.run" → "admin"
 */
function extractUsername(host: string): string | null {
  const domain = appEnv.workspaceDomain;
  if (!domain) return null;

  const hostname = host.split(":")[0];
  const suffix = `-${domain}`;

  if (!hostname.endsWith(suffix)) return null;

  const username = hostname.slice(0, -suffix.length);
  return username || null;
}

async function handleSubdomainProxy(req: Request) {
  const url = new URL(req.url);

  // Username is passed via query param from middleware, or extracted from host
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || url.host;
  const username = url.searchParams.get("_ws_user") || extractUsername(host);

  if (!username) {
    return NextResponse.json({ error: "Invalid workspace domain." }, { status: 400 });
  }

  const db = await getDb();

  const user = await db.query.users.findFirst({
    where: eq(users.username, username)
  });

  if (!user) {
    return NextResponse.json({ error: `User "${username}" not found.` }, { status: 404 });
  }

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, user.id),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance) {
    return NextResponse.json({ error: `No running workspace for "${username}".` }, { status: 404 });
  }

  // Get auth token
  const session = await db.query.workspaceSessions.findFirst({
    where: eq(workspaceSessions.userId, user.id)
  });

  let accessToken = "";
  if (session) {
    try {
      accessToken = decrypt(session.accessToken);
    } catch {
      // Token decrypt failed
    }
  }

  // Strip internal query param and proxy
  const cleanUrl = new URL(url);
  cleanUrl.searchParams.delete("_ws_user");
  const targetPath = cleanUrl.pathname + (cleanUrl.search || "");
  const targetUrl = `http://127.0.0.1:${instance.port}${targetPath}`;

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
    return NextResponse.json({ error: "Failed to reach workspace." }, { status: 502 });
  }
}

export const GET = handleSubdomainProxy;
export const POST = handleSubdomainProxy;
export const PUT = handleSubdomainProxy;
export const DELETE = handleSubdomainProxy;
export const PATCH = handleSubdomainProxy;
export const HEAD = handleSubdomainProxy;
export const OPTIONS = handleSubdomainProxy;
