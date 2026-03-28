export const runtime = "nodejs";

import { auth } from "@/auth";

export default auth((req) => {
  const { nextUrl } = req;
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
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)", "/api/:path*"]
};
