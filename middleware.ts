export const runtime = "nodejs";

import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
  const isLoggedIn = !!req.auth;

  const isApiAuthRoute = nextUrl.pathname.startsWith("/api/auth");
  const isPublicApiRoute = nextUrl.pathname.startsWith("/api/health") || nextUrl.pathname.startsWith("/api/bootstrap");
  const isAuthRoute = nextUrl.pathname.startsWith("/auth");

  // Allow internal ws-proxy relaunch calls
  const isInternalRequest = req.headers.get("X-Internal-User-Id") !== null;

  if (isApiAuthRoute || isPublicApiRoute || isInternalRequest) return;

  if (isAuthRoute) {
    if (isLoggedIn) return Response.redirect(new URL("/", nextUrl));
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
