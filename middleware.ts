import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/punch(.*)",
  "/api/webhooks(.*)",
  "/api/whatsapp(.*)",
  "/api/attendance/locations",
  "/api/attendance/guest",
  "/api/auth/verify-employee",
  "/api/auth/check-admin",
  "/api/auth/employee-signin",
  "/api/google/callback",
  "/api/google/calendar",
  "/api/leads/follow-up",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublic(req)) {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
