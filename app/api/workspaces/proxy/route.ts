import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { workspaceInstances } from "@/lib/db/schema";
import { getGsdSession } from "@/lib/session-broker";
import { eq, and } from "drizzle-orm";
import { NextResponse } from "next/server";

async function handleProxy(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as any;
  const db = await getDb();

  const instance = await db.query.workspaceInstances.findFirst({
    where: and(
      eq(workspaceInstances.userId, Number(user.id)),
      eq(workspaceInstances.status, "RUNNING")
    )
  });

  if (!instance) {
    return NextResponse.json({ error: "No running workspace." }, { status: 404 });
  }

  let accessToken: string;
  try {
    const gsdSession = await getGsdSession(Number(user.id));
    accessToken = gsdSession.accessToken;
  } catch {
    return NextResponse.json({ error: "Session expired. Please reconnect." }, { status: 401 });
  }

  // Strip the /api/workspaces/proxy prefix and forward to GSD
  const url = new URL(req.url);
  const targetPath = url.pathname.replace(/^\/api\/workspaces\/proxy/, "") || "/";
  const targetUrl = `http://127.0.0.1:${instance.port}${targetPath}${url.search}`;

  const headers = new Headers(req.headers);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.delete("host");

  try {
    const proxyRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
      // @ts-expect-error duplex is required for streaming request bodies
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

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
