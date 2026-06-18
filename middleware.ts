import { clerkMiddleware, createRouteMatcher, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublic = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/sso-callback(.*)",
  "/punch(.*)",
  "/api/webhooks(.*)",
  "/api/whatsapp(.*)",
  "/api/wp-inbox(.*)",
  "/api/wp-numbers(.*)",
  "/api/attendance/locations",
  "/api/attendance/guest(.*)",
  "/api/attendance/overtime-punch(.*)",
  "/api/auth/verify-employee(.*)",
  "/api/auth/check-admin",
  "/api/auth/employee-signin",
  "/api/auth/overtime-approval",
  "/api/auth/send-otp",
  "/api/auth/verify-otp",
  "/api/google/callback",
  "/api/google/calendar",
  "/api/leads/follow-up",
  "/api/admin/daily-summary",
  "/api/admin/test-notify",
  "/api/admin/fix-roles",
  "/api/free-trial",
  "/free-trial(.*)",
  "/demo(.*)",
]);

// Admin-only pages — employees get redirected to /dashboard
const isAdminOnly = createRouteMatcher([
  "/admin-panel(.*)",
  "/admin-users(.*)",
  "/admin-employees(.*)",
  "/attendance$",
  "/attendance/scan(.*)",
  "/live-location(.*)",
  "/settings(.*)",
  "/reports(.*)",
  "/commissions(.*)",
  "/agreements(.*)",
]);

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || "meetdalsaniya143@gmail.com,info@cityrealspace.com")
  .split(",").map(e => e.trim().toLowerCase());

// Office hours IST: Mon–Sat 9:00 AM – 11:00 PM
const OPEN_MIN  = 9  * 60;
const CLOSE_MIN = 23 * 60;

function isWithinOfficeHours(): boolean {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = now.getUTCDay();
  if (day === 0) return false; // Sunday closed
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  return cur >= OPEN_MIN && cur <= CLOSE_MIN;
}

export default clerkMiddleware(async (auth, req) => {
  if (isPublic(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Clerk stores publicMetadata under `metadata` key in sessionClaims
  const meta = (sessionClaims as any)?.metadata || (sessionClaims as any)?.publicMetadata || {};
  const role  = (meta?.role || "").toUpperCase();
  const email = (meta?.email || (sessionClaims as any)?.email || "").toLowerCase();

  // Primary check: role from JWT claims
  // Fallback: fetch live from Clerk (catches stale JWT)
  let isAdmin = role === "ADMIN" || ADMIN_EMAILS.includes(email);

  if (!isAdmin) {
    try {
      const client = await clerkClient();
      const clerkUser = await client.users.getUser(userId);
      const liveRole  = ((clerkUser.publicMetadata as any)?.role || "").toUpperCase();
      const liveEmail = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase() || "";
      isAdmin = liveRole === "ADMIN" || ADMIN_EMAILS.includes(liveEmail);
    } catch {}
  }

  // Admin bypasses everything
  if (isAdmin) return NextResponse.next();

  const path = req.nextUrl.pathname;
  const isAppPage = !path.startsWith("/api/") && !path.startsWith("/_next/");

  // Block employee from admin-only pages
  if (isAdminOnly(req)) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // Block API writes for admin-only resources
  const isAdminAPI = (
    path.startsWith("/api/admin/") ||
    path.startsWith("/api/reports") ||
    path.startsWith("/api/commissions") ||
    path.startsWith("/api/agreements") ||
    path.startsWith("/api/admin-users")
  );
  if (isAdminAPI && req.method !== "GET") {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Block employees outside office hours (app pages only)
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
