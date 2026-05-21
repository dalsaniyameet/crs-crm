import { authMiddleware } from "@clerk/nextjs";
import { NextResponse } from "next/server";

export default authMiddleware({
  publicRoutes: [
    "/",
    "/sign-in(.*)",
    "/sign-up(.*)",
    "/sso-callback(.*)",
    "/api/webhooks(.*)",
    "/api/auth/verify-employee",
    "/api/auth/check-admin",
    "/api/auth/employee-signin",
    "/api/whatsapp(.*)",
    "/api/attendance/locations",
    "/api/attendance/guest",
    "/api/google/callback",
    "/api/google/calendar",
    "/punch",
    "/punch(.*)",
  ],
  afterAuth(auth, req) {
    const path = req.nextUrl.pathname;

    // If not logged in and trying to access any protected route → sign-in
    if (!auth.userId) {
      const isPublic =
        path === "/" ||
        path.startsWith("/sign-in") ||
        path.startsWith("/sign-up") ||
        path.startsWith("/sso-callback") ||
        path.startsWith("/punch") ||
        path.startsWith("/api/webhooks") ||
        path.startsWith("/api/whatsapp") ||
        path.startsWith("/api/attendance/locations") ||
        path.startsWith("/api/attendance/guest") ||
        path.startsWith("/api/auth") ||
        path.startsWith("/api/google");

      if (!isPublic) {
        return NextResponse.redirect(new URL("/sign-in", req.url));
      }
    }

    return NextResponse.next();
  },
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
