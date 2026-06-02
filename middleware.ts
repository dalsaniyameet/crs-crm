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
  "/api/admin/daily-summary",
  "/api/admin/test-notify",
  "/api/admin/fix-roles",
]);

// Admin emails — always allowed any time
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "meetdalsaniya143@gmail.com,info@cityrealspace.com")
  .split(",").map(e => e.trim().toLowerCase());

// Office hours (IST): Mon–Sat 9:58 AM – 7:02 PM
const OPEN_MIN  = 9  * 60 + 58;
const CLOSE_MIN = 19 * 60 + 2;

function isWithinOfficeHours(): boolean {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // IST
  const day = now.getUTCDay(); // 0 = Sunday
  if (day === 0) return false;
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  return cur >= OPEN_MIN && cur <= CLOSE_MIN;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Get user role from Clerk session metadata
  const role = ((sessionClaims?.metadata as any)?.role || "").toUpperCase();
  const email = ((sessionClaims?.email as string) || "").toLowerCase();

  // Admins bypass office hours restriction
  const isAdmin = role === "ADMIN" || ADMIN_EMAILS.includes(email);
  if (isAdmin) return NextResponse.next();

  // For employees — block access outside office hours
  // Only block dashboard/app pages, not API routes needed for session
  const path = req.nextUrl.pathname;
  const isAppPage = !path.startsWith("/api/") && !path.startsWith("/_next/");

  if (isAppPage && !isWithinOfficeHours()) {
    const url = new URL("/sign-in", req.url);
    url.searchParams.set("reason", "outside-hours");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "/(api|trpc)(.*)"],
};
