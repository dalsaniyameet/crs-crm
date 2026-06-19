"use client";
import { useState, useEffect, useRef } from "react";
import { useSignIn, useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, LogIn, Lock, Mail, Shield, Clock, CheckCircle2, ScanFace, CheckCircle, XCircle } from "lucide-react";
import dynamic from "next/dynamic";

const FacePunch = dynamic(() => import("@/components/attendance/FacePunch"), { ssr: false });

// ── Punch In/Out section — no login needed ─────────────────────────────
function PunchSection() {
  const [email, setEmail]       = useState("");
  const [verified, setVerified] = useState<{ name: string; email: string } | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyErr, setVerifyErr] = useState("");
  const [showFace, setShowFace]   = useState(false);
  const [action, setAction]       = useState<"IN" | "OUT">("IN");
  const [processing, setProcessing] = useState(false);
  const [done, setDone]           = useState<{ type: "IN" | "OUT"; wh?: number } | null>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);

  // Remember last email
  useEffect(() => {
    const saved = localStorage.getItem("crs_punch_email");
    if (saved) setEmail(saved);
  }, []);

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true); setVerifyErr("");
    try {
      const res  = await fetch(`/api/auth/verify-employee?email=${encodeURIComponent(email.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.found) { setVerifyErr("Employee not found. Please contact your admin."); }
      else {
        setVerified({ name: data.name, email: data.email });
        localStorage.setItem("crs_punch_email", data.email);
        // Check today record
        const today = new Date().toISOString().split("T")[0];
        const recs  = await fetch(`/api/attendance/guest?date=${today}`).then(r => r.json()).catch(() => []);
        const mine  = (Array.isArray(recs) ? recs : []).find((r: any) =>
          r.phone === data.email || r.phone === data.email.toLowerCase()
        );
        setTodayRecord(mine || null);
        setAction(mine && !mine.punchOut ? "OUT" : "IN");
      }
    } catch { setVerifyErr("Network error. Please try again."); }
    setVerifying(false);
  };

  const handleFace = async (faceImage?: string) => {
    setShowFace(false);
    if (!verified) return;
    setProcessing(true);
    try {
      const locs = await fetch("/api/attendance/locations").then(r => r.json()).catch(() => []);
      const loc  = Array.isArray(locs) ? locs[0] : null;
      if (!loc) { setVerifyErr("No office location configured. Contact admin."); setProcessing(false); return; }

      // ── GPS location check ──
      let lat: number, lng: number;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        setVerifyErr("📍 Location access denied. Please allow location permission to punch in/out.");
        setProcessing(false);
        return;
      }

      // Haversine distance
      const R  = 6371e3;
      const p1 = (lat  * Math.PI) / 180;
      const p2 = (loc.latitude  * Math.PI) / 180;
      const dp = ((loc.latitude  - lat) * Math.PI) / 180;
      const dl = ((loc.longitude - lng) * Math.PI) / 180;
      const a  = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist > loc.radius) {
        setVerifyErr(`📍 You are ${Math.round(dist)}m away from office. Must be within ${loc.radius}m of ${loc.name}.`);
        setProcessing(false);
        return;
      }

      const res  = await fetch("/api/attendance/guest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: verified.name, phone: verified.email,
          locationId: loc.id, bypass: true, faceImage,
          ...(action === "OUT" ? { action: "OUT" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setVerifyErr(data.error || "Failed. Try again."); }
      else { setDone({ type: action, wh: data.record?.workHours }); }
    } catch { setVerifyErr("Network error. Please try again."); }
    setProcessing(false);
  };

  // Done screen
  if (done) return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="p-4 rounded-2xl text-center space-y-3"
      style={{ background: done.type === "IN" ? "rgba(16,185,129,0.08)" : "rgba(59,130,246,0.08)", border: `1px solid ${done.type === "IN" ? "rgba(16,185,129,0.3)" : "rgba(59,130,246,0.3)"}` }}>
      <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${ done.type === "IN" ? "bg-emerald-500/20" : "bg-blue-500/20"}`}>
        <CheckCircle className={`w-8 h-8 ${done.type === "IN" ? "text-emerald-400" : "text-blue-400"}`} />
      </div>
      <div className={`text-xl font-bold ${done.type === "IN" ? "text-emerald-400" : "text-blue-400"}`}>
        {done.type === "IN" ? "Punched In ✅" : "Punched Out ✅"}
      </div>
      <div className="text-white font-medium text-sm">{verified?.name}</div>
      {done.wh && <div className="text-muted-foreground text-xs">{done.wh.toFixed(1)}h worked</div>}
      <button onClick={() => { setDone(null); setVerified(null); setEmail(""); localStorage.removeItem("crs_punch_email"); }}
        className="w-full py-2 rounded-xl bg-white/10 text-white text-sm hover:bg-white/20 transition-all">
        Done
      </button>
    </motion.div>
  );

  return (
    <div className="p-4 rounded-2xl space-y-3" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.2)" }}>
      <div className="flex items-center gap-2">
        <ScanFace className="w-4 h-4 text-estate-400" />
        <span className="text-sm font-semibold text-white">Punch In / Out</span>
        <span className="text-xs text-muted-foreground ml-auto">No login needed</span>
      </div>

      {!verified ? (
        <form onSubmit={verify} className="space-y-2">
          <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
            placeholder="Enter your registered email"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
          {verifyErr && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> {verifyErr}</p>}
          <button type="submit" disabled={verifying}
            className="w-full py-2.5 rounded-xl bg-estate-500/20 border border-estate-500/30 text-estate-300 text-sm font-medium hover:bg-estate-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Verify & Continue →"}
          </button>
        </form>
      ) : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-8 h-8 rounded-full bg-estate-500/30 flex items-center justify-center text-white font-bold flex-shrink-0">{verified.name[0]}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-white truncate">{verified.name}</div>
              <div className="text-xs text-emerald-400">
                {todayRecord && !todayRecord.punchOut
                  ? `In office since ${new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                  : "Not punched in today"}
              </div>
            </div>
            <button onClick={() => { setVerified(null); setVerifyErr(""); }} className="text-muted-foreground hover:text-white text-xs">×</button>
          </div>
          {verifyErr && <p className="text-red-400 text-xs flex items-center gap-1"><XCircle className="w-3 h-3" /> {verifyErr}</p>}
          <button onClick={() => { setVerifyErr(""); setShowFace(true); }} disabled={processing}
            className={`w-full py-3 rounded-xl text-sm font-semibold border transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
              action === "IN"
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30"
            }`}>
            {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanFace className="w-4 h-4" />}
            {action === "IN" ? "👉 Face Punch In" : "👈 Face Punch Out"}
          </button>
          <p className="text-xs text-center text-muted-foreground">Face scan is required</p>
        </motion.div>
      )}

      <AnimatePresence>
        {showFace && verified && (
          <FacePunch employeeName={verified.name} action={action}
            onSuccess={handleFace} onClose={() => setShowFace(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}


type Tab = "admin" | "employee";

const OPEN_MIN  = 9  * 60 + 58;
const CLOSE_MIN = 19 * 60 + 2;

function getOfficeHoursError(): string | null {
  const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  const day = now.getUTCDay();
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

  const [tab, setTab]               = useState<Tab>("admin");
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  // Admin
  const [adminEmail, setAdminEmail]       = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminMode, setAdminMode]         = useState<"oauth" | "password">("oauth");
  const [otpStep, setOtpStep]             = useState(false); // password verified → show OTP
  const [otp, setOtp]                     = useState(["", "", "", "", "", ""]);
  const otpInputs = useRef<(HTMLInputElement | null)[]>([]);

  // Employee
  const [empEmail, setEmpEmail]       = useState("");
  const [empPassword, setEmpPassword] = useState("");

  const [otpSuccess, setOtpSuccess] = useState(false);

  // After-hours approval waiting
  const [approvalId, setApprovalId]         = useState<string | null>(null);
  const [approvalStatus, setApprovalStatus] = useState<"PENDING" | "APPROVED" | "DENIED" | "EXPIRED">("PENDING");
  const [approvalToken, setApprovalToken]   = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isSignedIn) return;
    router.replace("/dashboard");
  }, [isSignedIn, router]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("reason") === "outside-hours") {
      setTab("employee");
      setError("Access denied: CRM is only available Mon–Sat 9:58 AM – 7:02 PM (IST).");
    }
  }, []);

  // Poll for approval status every 5s
  useEffect(() => {
    if (!approvalId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/auth/overtime-approval?id=${approvalId}&poll=1`);
        const data = await res.json();
        setApprovalStatus(data.status);
        if (data.status === "APPROVED" && data.token) {
          setApprovalToken(data.token);
          clearInterval(pollRef.current!);
        }
        if (data.status === "DENIED" || data.status === "EXPIRED") {
          clearInterval(pollRef.current!);
        }
      } catch {}
    }, 5000);
    return () => clearInterval(pollRef.current!);
  }, [approvalId]);

  // Auto login once token received
  useEffect(() => {
    if (!approvalToken || !isLoaded) return;
    (async () => {
      try {
        const result = await signIn!.create({ strategy: "ticket", ticket: approvalToken });
        if (result.status === "complete") {
          await setActive!({ session: result.createdSessionId });
          router.push("/employee");
        }
      } catch { setError("Auto-login failed. Please try logging in again."); setApprovalId(null); }
    })();
  }, [approvalToken, isLoaded, signIn, setActive, router]);

  // ── Admin Login ──
  async function handleAdminLogin(e: React.FormEvent, forceMode?: "oauth" | "password") {
    e.preventDefault();
    if (!isLoaded) return;
    const mode = forceMode ?? adminMode;
    setError(""); setLoading(true);
    try {
      if (mode === "password") {
        if (otpStep) {
          // Step 2: Verify OTP → login
          const otpCode = otp.join("");
          const verifyRes = await fetch("/api/auth/verify-otp", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: adminEmail, otp: otpCode }),
          });
          const verifyData = await verifyRes.json();
          if (!verifyRes.ok) { setError(verifyData.error || "Invalid OTP"); setLoading(false); return; }
          setOtpSuccess(true);
          await new Promise(r => setTimeout(r, 1200));
          const result = await signIn!.create({ strategy: "ticket", ticket: verifyData.token });
          if (result.status === "complete") { await setActive!({ session: result.createdSessionId }); router.push("/dashboard"); return; }
          setError("Login failed. Try again.");
          setLoading(false); return;
        }
        // Step 1: Verify password → send OTP
        const adminCheck = await fetch("/api/auth/check-admin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminEmail }),
        });
        if (!adminCheck.ok) { setError("You are not authorized as admin."); setLoading(false); return; }
        const passRes = await fetch("/api/auth/employee-signin", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminEmail, password: adminPassword, isAdmin: true, checkOnly: true }),
        });
        const passData = await passRes.json();
        if (!passRes.ok) { setError(passData.error || "Incorrect email or password."); setLoading(false); return; }
        // Password correct → send OTP
        const otpRes = await fetch("/api/auth/send-otp", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: adminEmail }),
        });
        const otpData = await otpRes.json();
        if (!otpRes.ok) { setError(otpData.error || "Failed to send OTP"); setLoading(false); return; }
        setOtpStep(true); setOtpSuccess(false); setOtp(["", "", "", "", "", ""]);
        setLoading(false);
        setTimeout(() => otpInputs.current[0]?.focus(), 300);
        return;
      }
      // OAuth
      const res = await fetch("/api/auth/check-admin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      if (!res.ok) { setError("You are not authorized as admin."); setLoading(false); return; }
      await signIn!.authenticateWithRedirect({ strategy: "oauth_google", redirectUrl: "/sso-callback", redirectUrlComplete: "/dashboard" });
    } catch (err: any) {
      const code = err?.errors?.[0]?.code || "";
      setError(
        code === "form_password_incorrect"    ? "Incorrect password." :
        code === "form_identifier_not_found"  ? "Admin account not found." :
        code === "strategy_for_user_invalid"  ? "This account uses Google login. Please use OAuth above." :
        err?.errors?.[0]?.message || "Login failed"
      );
      setLoading(false);
    }
  }

  // ── Employee Login ──
  async function handleEmpLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded) return;
    setError(""); setLoading(true);
    try {
      const res  = await fetch("/api/auth/employee-signin", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: empEmail, password: empPassword }),
      });
      const data = await res.json();

      if (!res.ok) {
        const msg = data.error || "Incorrect email or password.";
        setError(msg.toLowerCase().includes("password") || msg.toLowerCase().includes("incorrect")
          ? "Incorrect password. Please enter the password provided by your admin."
          : msg
        );
        setLoading(false); return;
      }

      // After-hours: requires admin approval
      if (data.requiresApproval) {
        setApprovalId(data.approvalId);
        setApprovalStatus("PENDING");
        setLoading(false); return;
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

  // ── APPROVAL WAITING SCREEN ──
  if (approvalId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="glass-card w-full max-w-sm p-8 text-center">
          {approvalStatus === "PENDING" && (
            <>
              <div className="text-5xl mb-4">⏳</div>
              <h2 className="text-xl font-bold text-white mb-2">Waiting for Admin Approval</h2>
              <p className="text-muted-foreground text-sm mb-6">
                Your after-hours login request has been sent to admin. Please wait for approval.
              </p>
              <div className="flex items-center justify-center gap-2 text-yellow-400 text-sm mb-6">
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking every 5 seconds...
              </div>
              <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-300 mb-4">
                📧 An approval email has been sent to admin with <strong>Approve</strong> and <strong>Deny</strong> buttons.
              </div>
              <button onClick={() => { setApprovalId(null); setError(""); }}
                className="text-xs text-muted-foreground hover:text-white underline mt-2">
                Cancel and go back
              </button>
            </>
          )}
          {approvalStatus === "APPROVED" && (
            <>
              <div className="text-5xl mb-4">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Approved!</h2>
              <p className="text-muted-foreground text-sm mb-4">Admin approved your access. Logging you in...</p>
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400 mx-auto" />
            </>
          )}
          {approvalStatus === "DENIED" && (
            <>
              <div className="text-5xl mb-4">❌</div>
              <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
              <p className="text-muted-foreground text-sm mb-6">Admin has denied your after-hours login request.</p>
              <button onClick={() => { setApprovalId(null); setError(""); }}
                className="btn-primary w-full py-3 text-sm font-semibold rounded-xl">
                Go Back
              </button>
            </>
          )}
          {approvalStatus === "EXPIRED" && (
            <>
              <div className="text-5xl mb-4">⏰</div>
              <h2 className="text-xl font-bold text-white mb-2">Request Expired</h2>
              <p className="text-muted-foreground text-sm mb-6">Your approval request expired (2 hour limit). Please try again.</p>
              <button onClick={() => { setApprovalId(null); setError(""); }}
                className="btn-primary w-full py-3 text-sm font-semibold rounded-xl">
                Try Again
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

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
            <p className="text-muted-foreground text-xs">Only pre-registered employees can access this CRM.</p>
          </div>
          <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 max-w-sm">
            <p className="text-blue-400 text-sm font-medium mb-1 flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Office Hours</p>
            <p className="text-muted-foreground text-xs">Employee CRM: <strong className="text-white">Mon–Sat, 9:58 AM – 7:02 PM</strong> (IST)</p>
            <p className="text-muted-foreground text-xs mt-1">After hours? Login and wait for admin approval.</p>
          </div>
        </div>
        <div className="relative z-10 text-xs text-muted-foreground">© 2024 City Real Space, Ahmedabad</div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 xl:w-2/5 flex items-center justify-center px-6 py-12 relative min-h-screen">
        <div className="absolute inset-y-0 left-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent hidden lg:block" />
        <div className="w-full max-w-sm relative z-10">
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
                <button type="button" onClick={() => { setAdminMode("oauth"); setError(""); setOtpStep(false); setOtp(["","","","","",""]); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${adminMode === "oauth" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
                  OAuth
                </button>
                <button type="button" onClick={() => { setAdminMode("password"); setError(""); setOtpStep(false); setOtp(["","","","","",""]); }}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${adminMode === "password" ? "bg-white/10 text-white" : "text-muted-foreground hover:text-white"}`}>
                  Password
                </button>
              </div>
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Admin Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="email" required value={adminEmail} onChange={e => setAdminEmail(e.target.value)} disabled={adminMode === "password" && otpStep}
                      placeholder="admin@cityrealspace.com"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50 disabled:opacity-50" />
                  </div>
                </div>
                {adminMode === "password" && !otpStep && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input type="password" required value={adminPassword} onChange={e => setAdminPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                    </div>
                  </div>
                )}
                {adminMode === "password" && otpStep && (
                  <AnimatePresence mode="wait">
                    {otpSuccess ? (
                      <motion.div key="otp-success"
                        initial={{ opacity: 0, scale: 0.85, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        transition={{ type: "spring", stiffness: 220, damping: 18 }}
                        className="flex flex-col items-center gap-4 py-6"
                      >
                        {/* Triple ripple rings */}
                        <div className="relative flex items-center justify-center">
                          {[0, 1, 2].map(i => (
                            <motion.div key={i}
                              className="absolute rounded-full border border-emerald-400/40"
                              initial={{ width: 56, height: 56, opacity: 0.7 }}
                              animate={{ width: 56 + i * 36, height: 56 + i * 36, opacity: 0 }}
                              transition={{ duration: 1.2, delay: i * 0.22, repeat: Infinity, ease: "easeOut" }}
                            />
                          ))}
                          <motion.div
                            initial={{ scale: 0, rotate: -45 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: "spring", stiffness: 320, damping: 16 }}
                            className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center backdrop-blur-sm"
                          >
                            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                          </motion.div>
                        </div>
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
                          <p className="text-emerald-400 font-bold text-base">OTP Verified!</p>
                          <p className="text-muted-foreground text-xs mt-0.5">Signing you in...</p>
                        </motion.div>
                        {/* Progress bar */}
                        <motion.div className="w-40 h-1 rounded-full bg-white/10 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300"
                            initial={{ width: "0%" }}
                            animate={{ width: "100%" }}
                            transition={{ duration: 1.1, ease: "easeInOut" }}
                          />
                        </motion.div>
                      </motion.div>
                    ) : (
                      <motion.div key="otp-input"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20, scale: 0.96 }}
                        transition={{ duration: 0.28 }}
                      >
                        {/* Header banner */}
                        <motion.div
                          initial={{ opacity: 0, scale: 0.94 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.05 }}
                          className="flex items-center gap-2 mb-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25"
                        >
                          <span className="text-lg">🔐</span>
                          <div>
                            <p className="text-emerald-400 text-xs font-semibold">Password verified</p>
                            <p className="text-muted-foreground text-[11px]">6-digit OTP sent to your email</p>
                          </div>
                        </motion.div>

                        {/* OTP boxes */}
                        <div className="flex gap-2.5 justify-center mb-2">
                          {otp.map((digit, idx) => (
                            <motion.div key={idx}
                              initial={{ opacity: 0, y: 24, scale: 0.6 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{ type: "spring", stiffness: 380, damping: 22, delay: idx * 0.055 }}
                            >
                              <motion.input
                                ref={el => otpInputs.current[idx] = el}
                                type="text" inputMode="numeric" maxLength={1} value={digit}
                                animate={error ? { x: [-6, 6, -5, 5, -3, 3, 0] } : {}}
                                transition={{ duration: 0.4 }}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  if (!/^\d*$/.test(val)) return;
                                  const n = [...otp]; n[idx] = val; setOtp(n);
                                  if (val && idx < 5) otpInputs.current[idx + 1]?.focus();
                                }}
                                onKeyDown={(e) => { if (e.key === "Backspace" && !otp[idx] && idx > 0) otpInputs.current[idx - 1]?.focus(); }}
                                className={`w-11 h-13 bg-white/5 border-2 rounded-xl text-center text-xl font-bold text-white focus:outline-none transition-all duration-150 ${
                                  error
                                    ? "border-red-500 bg-red-500/10 shadow-[0_0_14px_rgba(239,68,68,0.35)]"
                                    : digit
                                    ? "border-gold-500 bg-gold-500/10 shadow-[0_0_16px_rgba(234,179,8,0.4)] scale-105"
                                    : "border-white/10 focus:border-estate-400 focus:bg-estate-500/5 focus:shadow-[0_0_14px_rgba(99,102,241,0.35)]"
                                }`}
                                style={{ width: 44, height: 52 }}
                              />
                            </motion.div>
                          ))}
                        </div>

                        {/* Dot progress indicator */}
                        <div className="flex justify-center gap-1.5 mb-4">
                          {otp.map((d, i) => (
                            <motion.div key={i}
                              animate={{ scale: d ? 1.3 : 1, backgroundColor: d ? "rgb(234,179,8)" : "rgba(255,255,255,0.15)" }}
                              transition={{ type: "spring", stiffness: 400, damping: 20 }}
                              className="w-1.5 h-1.5 rounded-full"
                            />
                          ))}
                        </div>

                        <button type="button" onClick={() => { setOtpStep(false); setOtp(["","","","","",""]); setError(""); setOtpSuccess(false); }}
                          className="text-xs text-muted-foreground hover:text-white underline mx-auto block transition-colors">
                          ← Back / Resend OTP
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                )}
                {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{error}</p>}
                {adminMode === "password" ? (
                  <button type="submit" disabled={loading || !adminEmail || (!otpStep && !adminPassword) || (otpStep && otp.join("").length !== 6)}
                    className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                    {loading ? (otpStep ? "Verifying OTP..." : "Verifying...") : (otpStep ? "Verify & Sign In" : "Continue")}
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
                          const res = await fetch("/api/auth/check-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail }) });
                          if (!res.ok) { setError("You are not authorized as admin."); setLoading(false); return; }
                          await signIn!.authenticateWithRedirect({ strategy: "oauth_microsoft", redirectUrl: "/sso-callback", redirectUrlComplete: "/dashboard" });
                        } catch { setError("Microsoft login failed"); setLoading(false); }
                      }}
                      className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-[#2f2f2f] text-white font-semibold text-sm hover:bg-[#404040] transition-colors disabled:opacity-60">
                      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                          <path fill="#F25022" d="M1 1h10v10H1z"/><path fill="#7FBA00" d="M13 1h10v10H13z"/>
                          <path fill="#00A4EF" d="M1 13h10v10H1z"/><path fill="#FFB900" d="M13 13h10v10H13z"/>
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

              {/* ── PUNCH IN / OUT SECTION ── */}
              <PunchSection />

              {/* Divider */}
              <div className="flex items-center gap-3 my-5">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs text-muted-foreground">ya CRM login karo</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>

              {/* Office hours status banner */}
              {officeHoursError ? (
                <div className="mb-5 p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 flex items-start gap-3">
                  <Clock className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-orange-400 text-sm font-semibold mb-0.5">Outside Office Hours</p>
                    <p className="text-orange-300 text-xs">{officeHoursError}</p>
                    <p className="text-muted-foreground text-xs mt-1">You can still login — admin will receive an <strong className="text-white">approval request</strong>.</p>
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
                    <input type="email" required value={empEmail} onChange={e => setEmpEmail(e.target.value)}
                      placeholder="you@cityrealspace.com" autoComplete="username"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="password" required value={empPassword} onChange={e => setEmpPassword(e.target.value)}
                      placeholder="Enter your password" autoComplete="current-password"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                {error && (
                  <div className="flex items-start gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <button type="submit" disabled={loading}
                  className="btn-primary w-full py-3 text-sm font-semibold rounded-xl flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
                  {loading ? "Signing in..." : officeHoursError ? "Request After-Hours Access" : "Sign In"}
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
