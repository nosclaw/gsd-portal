export const runtime = "nodejs";

import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Check if this request is for a workspace domain.
 * Format: {username}-{workspace_domain}
 * e.g. "admin-gsd-dev-local.letsme.run" when WORKSPACE_DOMAIN is "gsd-dev-local.letsme.run"
 */
function extractWorkspaceUser(host: string): string | null {
  const domain = process.env.WORKSPACE_DOMAIN;
  if (!domain) return null;

  const hostname = host.split(":")[0];
  const suffix = `-${domain}`;

  if (!hostname.endsWith(suffix)) return null;

  const username = hostname.slice(0, -suffix.length);
  if (!username) return null;

  return username;
}

export default auth((req) => {
  const { nextUrl } = req;
  const host = req.headers.get("host") || req.headers.get("x-forwarded-host") || nextUrl.host;

  // Workspace domain requests → proxy to GSD
  const workspaceUser = extractWorkspaceUser(host);
  if (workspaceUser) {
    const proxyUrl = new URL(`/api/workspaces/subdomain-proxy${nextUrl.pathname}${nextUrl.search}`, nextUrl.origin);
    proxyUrl.searchParams.set("_ws_user", workspaceUser);
    return NextResponse.rewrite(proxyUrl);
  }

  const isLoggedIn = !!req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/health") || nextUrl.pathname.startsWith("/api/bootstrap");
  const isAuthRoute = nextUrl.pathname.startsWith("/auth");

  if (isApiAuthRoute || isPublicApiRoute) {
    return;
  }

  if (isAuthRoute) {
    if (isLoggedIn) {
      return Response.redirect(new URL("/", nextUrl));
    }
    return;
  }

  if (!isLoggedIn) {
    return Response.redirect(new URL("/auth/sign-in", nextUrl));
  }

  return;
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)", "/api/:path*"]
};
