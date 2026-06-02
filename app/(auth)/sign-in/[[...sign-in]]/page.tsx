"use client";
import { useState, useEffect } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Loader2, LogIn, Lock, Mail, Shield, Clock } from "lucide-react";

type Tab = "admin" | "employee";

// ── Office hours check (IST) ─────────────────────────────────────────────────
const OPEN_MIN  = 9  * 60 + 58; // 9:58 AM
const CLOSE_MIN = 19 * 60 + 2;  // 7:02 PM

function getOfficeHoursError(): string | null {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000); // IST
  const day = now.getUTCDay(); // 0 = Sunday
  if (day === 0) return "CRM is closed on Sundays. See you Monday!";
  const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (cur < OPEN_MIN)  return "Office hasn't started yet. CRM login opens at 9:58 AM.";
  if (cur > CLOSE_MIN) return "Office hours are over. CRM login closed after 7:02 PM.";
  return null;
}

export default function SignInPage() {
  const { signIn, setActive, isLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  const [tab, setTab]         = useState<Tab>("admin");
  const [error, setError]     = useState("");
  const [loading, setLoading] = useState(false);

  // Admin fields
  const [adminEmail, setAdminEmail]       = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMode, setAdminMode]         = useState<"oauth" | "password">("oauth");

  // Employee fields
  const [empEmail, setEmpEmail]       = useState("");
  const [empPassword, setEmpPassword] = useState("");

  useEffect(() => {
    if (!isSignedIn) return;
    router.replace("/dashboard");
  }, [isSignedIn, router]);

  // Show outside-hours message if redirected from middleware
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "outside-hours") {
      setTab("employee");
      setError("Access denied: CRM is only available Mon–Sat 9:58 AM – 7:02 PM (IST).");
    }
  }, []);

  // ── Admin Login ──────────────────────────────────────────────────────────
  async function handleAdminLogin(e: React.FormEvent, forceMode?: "oauth" | "password") {
    e.preventDefault();
    if (!isLoaded) return;
    const mode = forceMode ?? adminMode;
    setError(""); setLoading(true);
    try {
      const res = await fetch("/api/auth/check-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      if (!res.ok) { setError("You are not authorized as admin."); setLoading(false); return; }

      if (mode === "password") {
        const tokenRes = await fetch("/api/auth/employee-signin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminEmail, password: adminPassword, isAdmin: true }),
        });
        const tokenData = await tokenRes.json();
        if (!tokenRes.ok) { setError(tokenData.error || "Incorrect email or password."); setLoading(false); return; }

        const result = await signIn!.create({ strategy: "ticket", ticket: tokenData.token });
        if (result.status === "complete") {
          await setActive!({ session: result.createdSessionId });
          router.push("/dashboard"); return;
        }
        setError("Login failed. Try again.");
        setLoading(false); return;
      }

      await signIn!.authenticateWithRedirect({
        strategy: "oauth_google",
        redirectUrl: "/sso-callback",
        redirectUrlComplete: "/dashboard",
      });
    } catch (err: any) {
      const code = err?.errors?.[0]?.code || "";
      setError(
        code === "form_password_incorrect"    ? "Incorrect password." :
        code === "form_identifier_not_found"  ? "Admin account not found." :
        code === "strategy_for_user_invalid"  ? "This account uses Google login. Please use OAuth above." :
        code === "single_session_mode_enabled"? "Already signed in. Refresh the page." :
        err?.errors?.[0]?.message || "Login failed"
      );
      setLoading(false);
    }
  }

  // ── Employee Login ───────────────────────────────────────────────────────
  async function handleEmpLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(""); setLoading(true);

    // ── Check office hours on client side first ──
    const hoursError = getOfficeHoursError();
    if (hoursError) {
      setError(hoursError);
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/employee-signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: empEmail, password: empPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Incorrect email or password.";
        if (msg.toLowerCase().includes("hour") || msg.toLowerCase().includes("office") || msg.toLowerCase().includes("9:58") || msg.toLowerCase().includes("7:02")) {
          setError(msg);
        } else if (msg.toLowerCase().includes("password") || msg.toLowerCase().includes("incorrect") || msg.toLowerCase().includes("invalid")) {
          setError("Incorrect password. Please enter the password provided by your admin.");
        } else {
          setError(msg);
        }
        setLoading(false);
        return;
      }

      const tokenResult = await signIn!.create({ strategy: "ticket", ticket: data.token });
      if (tokenResult.status === "complete") {
        await setActive!({ session: tokenResult.createdSessionId });
        router.push("/employee"); return;
      }
      setError("Login failed. Contact admin.");
    } catch (err: any) {
      const code = err?.errors?.[0]?.code || "";
      setError(
        code === "form_password_incorrect"   ? "Incorrect password. Please enter the password provided by your admin." :
        code === "form_identifier_not_found" ? "Email not found. Contact your admin to get access." :
        code === "too_many_requests"         ? "Too many failed attempts. Please wait a few minutes and try again." :
        err?.errors?.[0]?.message || "Login failed. Please contact your admin."
      );
    }
    setLoading(false);
  }

  const officeHoursError = tab === "employee" ? getOfficeHoursError() : null;

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-3/5 relative flex-col justify-between p-10 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-96 h-96 rounded-full bg-estate-600 opacity-15 blur-3xl top-[-10%] left-[-10%]" />
          <div className="absolute w-64 h-64 rounded-full bg-gold-500 opacity-10 blur-3xl bottom-[10%] right-[-5%]" />
        </div>
        <div className="relative z-10 flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white shadow-neon">
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-0.5" />
          </div>
          <div>
            <div className="font-bold text-white text-base leading-none">City Real Space</div>
            <div className="text-xs text-muted-foreground">AI-Powered CRM</div>
          </div>
        </div>
        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
            Ahmedabad&apos;s Most<br />
            <span className="gradient-text">Intelligent CRM</span>
          </h1>
          <p className="text-muted-foreground text-lg max-w-md">
            AI-powered lead scoring, auto property matching, and WhatsApp automation — built for real estate brokers.
          </p>
          <div className="p-4 rounded-xl border border-gold-500/20 bg-gold-500/5 max-w-sm">
            <p className="text-gold-400 text-sm font-medium mb-1">🔐 Secure Access</p>
            <p className="text-muted-foreground text-xs">Only pre-registered employees can access this CRM. Contact your admin if you need access.</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 max-w-sm">
            <p className="text-blue-400 text-sm font-medium mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Office Hours</p>
            <p className="text-muted-foreground text-xs">Employee CRM access: <strong className="text-white">Mon–Sat, 9:58 AM – 7:02 PM</strong> (IST)</p>
          </div>
        </div>
        <div className="relative z-10 text-xs text-muted-foreground">© 2024 City Real Space, Ahmedabad</div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center px-6 py-12 relative min-h-screen">
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden lg:block" />

        <div className="w-full max-w-sm relative z-10">
          {/* Mobile logo */}
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white shadow-neon border-2 border-estate-500/30 mb-3">
              <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-1" />
            </div>
            <h1 className="text-lg font-bold text-white">City Real Space</h1>
          </div>

          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 border border-white/10 p-1 mb-6">
            <button onClick={() => { setTab("admin"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === "admin" ? "bg-estate-600 text-white" : "text-muted-foreground hover:text-white"}`}>
              <Shield className="w-3.5 h-3.5" /> Admin
            </button>
            <button onClick={() => { setTab("employee"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === "employee" ? "bg-estate-600 text-white" : "text-muted-foreground hover:text-white"}`}>
              <Mail className="w-3.5 h-3.5" /> Employee
            </button>
          </div>

          {/* ── ADMIN LOGIN ── */}
          {tab === "admin" && (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-white mb-1">Admin Login</h2>
                <p className="text-muted-foreground text-sm">Sign in with Google or password</p>
              </div>

              <div className="flex rounded-lg bg-white/5 border border-white/10 p-1 mb-4">
                <button type="button" onClick={() => { setAdminMode("oauth"); setError(""); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${adminMode === "oauth" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
                  OAuth
                </button>
                <button type="button" onClick={() => { setAdminMode("password"); setError(""); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${adminMode === "password" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
                  Password
                </button>
              </div>

              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" required value={adminEmail}
                      onChange={e => setAdminEmail(e.target.value)}
                      placeholder="admin@cityrealspace.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>

                {adminMode === "password" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="password" required value={adminPassword}
                        onChange={e => setAdminPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                    </div>
                  </div>
                )}

                {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}

                {adminMode === "password" ? (
                  <button type="submit" disabled={loading || !adminEmail || !adminPassword}
                    className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {loading ? "Signing in..." : "Sign In"}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button type="button" disabled={loading || !adminEmail}
                      onClick={(e) => handleAdminLogin(e as unknown as React.FormEvent, "oauth")}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-white text-gray-800 font-semibold text-sm hover:bg-gray-100 transition-colors disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-800" /> : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      )}
                      {loading ? "Redirecting..." : "Continue with Google"}
                    </button>
                    <button type="button" disabled={loading || !adminEmail}
                      onClick={async () => {
                        if (!isLoaded || !adminEmail) return;
                        setError(""); setLoading(true);
                        try {
                          const res = await fetch("/api/auth/check-admin", {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ email: adminEmail }),
                          });
                          if (!res.ok) { setError("You are not authorized as admin."); setLoading(false); return; }
                          await signIn!.authenticateWithRedirect({
                            strategy: "oauth_microsoft",
                            redirectUrl: "/sso-callback",
                            redirectUrlComplete: "/dashboard",
                          });
                        } catch { setError("Microsoft login failed"); setLoading(false); }
                      }}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#2f2f2f] text-white font-semibold text-sm hover:bg-[#404040] transition-colors disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#F25022" d="M1 1h10v10H1z"/>
                          <path fill="#7FBA00" d="M13 1h10v10H13z"/>
                          <path fill="#00A4EF" d="M1 13h10v10H1z"/>
                          <path fill="#FFB900" d="M13 13h10v10H13z"/>
                        </svg>
                      )}
                      Continue with Microsoft
                    </button>
                  </div>
                )}
                <p className="text-center text-xs text-muted-foreground">Only authorized admin accounts can access</p>
              </form>
            </>
          )}

          {/* ── EMPLOYEE LOGIN ── */}
          {tab === "employee" && (
            <>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-white mb-1">Employee Login</h2>
                <p className="text-muted-foreground text-sm">Enter your email and password given by admin</p>
              </div>

              {/* Office hours banner */}
              {officeHoursError ? (
                <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-400 text-sm font-semibold mb-0.5">Access Restricted</p>
                    <p className="text-red-300 text-xs">{officeHoursError}</p>
                    <p className="text-muted-foreground text-xs mt-1">Office hours: <strong className="text-white">Mon–Sat, 9:58 AM – 7:02 PM</strong> IST</p>
                  </div>
                </div>
              ) : (
                <div className="mb-5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
                  <p className="text-emerald-400 text-xs font-medium">CRM is open — Office hours active</p>
                </div>
              )}

              <form onSubmit={handleEmpLogin} className="space-y-4" autoComplete="off">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Work Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" required value={empEmail}
                      onChange={e => setEmpEmail(e.target.value)}
                      placeholder="you@cityrealspace.com"
                      autoComplete="username"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="password" required value={empPassword}
                      onChange={e => setEmpPassword(e.target.value)}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>

                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <button type="submit" disabled={loading || !!officeHoursError}
                  className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {loading ? "Signing in..." : officeHoursError ? "Outside Office Hours" : "Sign In"}
                </button>
                <p className="text-center text-xs text-muted-foreground">Password is provided by your admin</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
