"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, Loader2, Clock, ScanFace, LogIn, LogOut } from "lucide-react";
import Image from "next/image";
import dynamic from "next/dynamic";

const FacePunch = dynamic(() => import("@/components/attendance/FacePunch"), { ssr: false });

// ── Live Clock ────────────────────────────────────────────────────────────────
function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!time) return <div className="h-16" />;
  return (
    <div className="text-center">
      <div className="text-4xl font-bold text-white tabular-nums">
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
      </div>
      <div className="text-muted-foreground text-xs mt-1">
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

// ── Live Work Timer ───────────────────────────────────────────────────────────
function WorkTimer({ since }: { since: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.floor((Date.now() - new Date(since).getTime()) / 1000));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [since]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return (
    <span className="font-mono text-emerald-400 text-2xl font-bold tabular-nums">
      {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
    </span>
  );
}

// ── Main Punch Form ───────────────────────────────────────────────────────────
function PunchForm() {
  const params     = useSearchParams();
  const locationId = params.get("loc") ?? "";
  const locName    = params.get("name") ?? "Office";

  const [step, setStep]         = useState<"verify" | "punched_in" | "done">("verify");
  const [empEmail, setEmpEmail] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [employee, setEmployee] = useState<{ name: string; email: string } | null>(null);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [showFace, setShowFace] = useState(false);
  const [faceAction, setFaceAction] = useState<"IN" | "OUT">("IN");
  const [processing, setProcessing] = useState(false);
  const [result, setResult]   = useState<any>(null);

  // Remember last employee email
  useEffect(() => {
    const saved = localStorage.getItem("crs_punch_email");
    if (saved) setEmpEmail(saved);
  }, []);

  // Verify employee is registered in CRM
  const verifyEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empEmail.trim()) return;
    setVerifying(true); setVerifyError("");
    try {
      const res  = await fetch(`/api/auth/verify-employee?email=${encodeURIComponent(empEmail.trim())}`);
      const data = await res.json();
      if (!res.ok || !data.found) {
        setVerifyError("Employee not found. Admin se contact karo.");
      } else {
        setEmployee({ name: data.name, email: data.email });
        localStorage.setItem("crs_punch_email", data.email);
        // Check today's record
        await checkTodayRecord(data.email);
      }
    } catch { setVerifyError("Network error. Try again."); }
    setVerifying(false);
  };

  const checkTodayRecord = async (email: string) => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const res   = await fetch(`/api/attendance/guest?date=${today}`);
      const recs  = await res.json();
      const myRec = (Array.isArray(recs) ? recs : []).find(
        (r: any) => r.phone === email || r.phone === email.toLowerCase()
      );
      setTodayRecord(myRec || null);
      if (myRec && !myRec.punchOut) setStep("punched_in");
    } catch {}
  };

  // Face scan complete → punch in/out
  const handleFaceSuccess = async (faceImage?: string) => {
    setShowFace(false);
    if (!employee || !locationId) return;
    setProcessing(true);
    try {
      const res  = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       employee.name,
          phone:      employee.email,
          locationId,
          bypass:     true, // no time restriction
          action:     faceAction === "OUT" ? "OUT" : undefined,
          faceImage,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.error || "Failed");
      } else {
        setResult({ type: faceAction, record: data.record });
        if (faceAction === "IN") {
          setTodayRecord(data.record);
          setStep("punched_in");
        } else {
          setStep("done");
        }
      }
    } catch { setVerifyError("Network error."); }
    setProcessing(false);
  };

  // ── DONE screen ──
  if (step === "done" && result) {
    const wh = result.record?.workHours ?? 0;
    const isHalf = result.record?.isHalfDay;
    const isOT   = result.record?.overtimeHours > 0;
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-blue-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-blue-400">Punched Out ✓</h2>
          <p className="text-white text-lg font-medium mt-1">{employee?.name}</p>
          <p className="text-muted-foreground text-sm">{locName}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Punch In</span>
            <span className="text-white font-medium">
              {result.record?.punchIn ? new Date(result.record.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Punch Out</span>
            <span className="text-white font-medium">
              {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
            </span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3">
            <span className="text-muted-foreground">Work Hours</span>
            <span className={`font-bold text-base ${isHalf ? "text-yellow-400" : isOT ? "text-purple-400" : "text-emerald-400"}`}>
              {wh.toFixed(2)}h {isHalf ? "· Half Day" : isOT ? `· +${result.record.overtimeHours.toFixed(1)}h OT` : ""}
            </span>
          </div>
        </div>
        <button onClick={() => { setStep("verify"); setEmployee(null); setTodayRecord(null); setResult(null); setEmpEmail(""); localStorage.removeItem("crs_punch_email"); }}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all">
          Done
        </button>
      </motion.div>
    );
  }

  // ── PUNCHED IN screen ──
  if (step === "punched_in" && employee && todayRecord) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-emerald-400">In Office ✓</h2>
          <p className="text-white font-medium mt-1">{employee.name}</p>
          <p className="text-xs text-muted-foreground">
            Punch In: {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
          </p>
        </div>

        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Time in Office</div>
          <WorkTimer since={todayRecord.punchIn} />
        </div>

        {verifyError && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {verifyError}
          </div>
        )}

        <button
          onClick={() => { setFaceAction("OUT"); setVerifyError(""); setShowFace(true); }}
          disabled={processing}
          className="w-full py-4 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 font-semibold text-lg hover:bg-red-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogOut className="w-5 h-5" />}
          {processing ? "Processing..." : "Face Punch Out"}
        </button>
        <p className="text-xs text-center text-muted-foreground">🤳 Face scan required for punch out</p>
      </motion.div>
    );
  }

  // ── VERIFY + PUNCH IN screen ──
  return (
    <div className="space-y-5">
      {!employee ? (
        <form onSubmit={verifyEmployee} className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-white font-medium">Apna registered email daalo</p>
            <p className="text-xs text-muted-foreground mt-1">Sirf CRM mein registered employees punch kar sakte hain</p>
          </div>
          <input
            type="email" value={empEmail}
            onChange={e => setEmpEmail(e.target.value)}
            placeholder="your@email.com"
            className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-400 text-base"
            required autoComplete="email" />
          {verifyError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {verifyError}
            </div>
          )}
          <button type="submit" disabled={verifying}
            className="w-full py-3 rounded-xl bg-estate-500 hover:bg-estate-600 text-white font-semibold transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {verifying ? <Loader2 className="w-5 h-5 animate-spin" /> : "Verify & Continue →"}
          </button>
        </form>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-10 h-10 rounded-full bg-estate-500/30 flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
              {employee.name[0]}
            </div>
            <div>
              <div className="text-white font-semibold">{employee.name}</div>
              <div className="text-xs text-emerald-400">✓ Verified Employee</div>
            </div>
            <button onClick={() => { setEmployee(null); setVerifyError(""); }}
              className="ml-auto text-muted-foreground hover:text-white">
              <XCircle className="w-4 h-4" />
            </button>
          </div>

          {verifyError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <XCircle className="w-4 h-4 flex-shrink-0" /> {verifyError}
            </div>
          )}

          <button
            onClick={() => { setFaceAction("IN"); setVerifyError(""); setShowFace(true); }}
            disabled={processing}
            className="w-full py-4 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-lg hover:bg-emerald-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {processing ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
            {processing ? "Processing..." : "Face Punch In"}
          </button>
          <p className="text-xs text-center text-muted-foreground">🤳 Face scan compulsory hai</p>
        </motion.div>
      )}

      {/* Face Punch Modal */}
      <AnimatePresence>
        {showFace && employee && (
          <FacePunch
            employeeName={employee.name}
            action={faceAction}
            onSuccess={handleFaceSuccess}
            onClose={() => setShowFace(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default function PunchPage() {
  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-sm">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white border-2 border-estate-500/30">
              <Image src="/logo.jpeg" alt="CRS" fill className="object-contain p-1" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">City Real Space</h1>
          <p className="text-sm text-muted-foreground">Attendance · Face Verification</p>
        </div>

        {/* Clock */}
        <div className="mb-5 p-4 rounded-2xl bg-white/5 border border-white/10">
          <LiveClock />
          <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-estate-300">
            <Clock className="w-3 h-3" /> Face punch compulsory · Any time
          </div>
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 backdrop-blur-xl">
          <Suspense fallback={<div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-estate-400" /></div>}>
            <PunchForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          City Real Space · Ahmedabad · Secure Attendance
        </p>
      </div>
    </div>
  );
}
