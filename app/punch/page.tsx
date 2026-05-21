"use client";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Loader2, User, Phone, MapPin, Clock, Coffee } from "lucide-react";
import Image from "next/image";

const BREAK_MIN = 45;

function fmt(h: number, m: number) {
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}

function LiveClock() {
  const [time, setTime] = useState<Date | null>(null);
  useEffect(() => {
    setTime(new Date());
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!time) return <div className="text-center h-16" />;
  return (
    <div className="text-center">
      <div className="text-5xl font-bold text-white tabular-nums">
        {time.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
      </div>
      <div className="text-muted-foreground text-sm mt-1">
        {time.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
      </div>
    </div>
  );
}

function PunchForm() {
  const params     = useSearchParams();
  const locationId = params.get("loc") ?? "";
  const locName    = params.get("name") ?? "Office";

  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [step, setStep]       = useState<"form" | "punched_in" | "done">("form");
  const [punchInTime, setPunchInTime] = useState<Date | null>(null);
  const [elapsed, setElapsed]         = useState("00:00:00");
  const [breakUsed, setBreakUsed]     = useState(false);
  const [breakActive, setBreakActive] = useState(false);
  const [breakStart, setBreakStart]   = useState<Date | null>(null);
  const [breakElapsed, setBreakElapsed] = useState(0); // seconds
  const [result, setResult]   = useState<{ type: "IN" | "OUT"; workHours?: number; breakDeducted?: number } | null>(null);

  // Remember name+phone
  useEffect(() => {
    const saved = localStorage.getItem("crs_emp");
    if (saved) { const d = JSON.parse(saved); setName(d.name); setPhone(d.phone); }
  }, []);

  // Live elapsed timer
  useEffect(() => {
    if (!punchInTime || step !== "punched_in") return;
    const t = setInterval(() => {
      const diff = Math.floor((Date.now() - punchInTime.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      setElapsed(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`);
    }, 1000);
    return () => clearInterval(t);
  }, [punchInTime, step]);

  // Break countdown
  useEffect(() => {
    if (!breakActive || !breakStart) return;
    const t = setInterval(() => {
      const diff = Math.floor((Date.now() - breakStart.getTime()) / 1000);
      setBreakElapsed(diff);
      if (diff >= BREAK_MIN * 60) {
        setBreakActive(false);
        setBreakUsed(true);
      }
    }, 1000);
    return () => clearInterval(t);
  }, [breakActive, breakStart]);

  async function handlePunchIn(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || phone.trim().length < 10) {
      setError("Please enter valid name and 10-digit phone number");
      return;
    }
    if (!locationId) { setError("Invalid location. Contact admin."); return; }
    setLoading(true); setError("");
    try {
      localStorage.setItem("crs_emp", JSON.stringify({ name: name.trim(), phone: phone.trim() }));
      const res  = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), locationId }),
      });
      const data = await res.json();
      if (res.ok) {
        setPunchInTime(new Date());
        setStep("punched_in");
        setResult({ type: "IN" });
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Network error. Try again."); }
    setLoading(false);
  }

  async function handlePunchOut() {
    setLoading(true); setError("");
    try {
      const res  = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: phone.trim(), locationId, action: "OUT" }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ type: "OUT", workHours: data.record?.workHours, breakDeducted: data.breakDeducted });
        setStep("done");
      } else {
        setError(data.error || "Something went wrong");
      }
    } catch { setError("Network error. Try again."); }
    setLoading(false);
  }

  function startBreak() {
    setBreakActive(true);
    setBreakStart(new Date());
    setBreakElapsed(0);
  }

  const breakRemaining = Math.max(0, BREAK_MIN * 60 - breakElapsed);
  const breakMins      = Math.floor(breakRemaining / 60);
  const breakSecs      = breakRemaining % 60;

  // ── DONE screen ──
  if (step === "done" && result) {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
        <div className="w-20 h-20 rounded-full bg-blue-500/20 flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10 text-blue-400" />
        </div>
        <div>
          <h2 className="text-3xl font-bold text-blue-400">Punched Out ✓</h2>
          <p className="text-white text-lg font-medium mt-1">{name}</p>
          <p className="text-muted-foreground text-sm">{locName}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Punch In</span>
            <span className="text-white font-medium">{punchInTime?.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Punch Out</span>
            <span className="text-white font-medium">{new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span>
          </div>
          <div className="flex justify-between border-t border-white/10 pt-3">
            <span className="text-muted-foreground">Break Deducted</span>
            <span className="text-orange-400 font-medium">- {result.breakDeducted ?? BREAK_MIN} min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Net Work Hours</span>
            <span className="text-emerald-400 font-bold text-base">{result.workHours?.toFixed(2)}h</span>
          </div>
        </div>
        <button onClick={() => { setStep("form"); setResult(null); setBreakUsed(false); setBreakActive(false); }}
          className="w-full py-3 rounded-xl bg-white/10 text-white font-medium hover:bg-white/20 transition-all">
          Done
        </button>
      </motion.div>
    );
  }

  // ── PUNCHED IN screen ──
  if (step === "punched_in") {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
        <div className="text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-8 h-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-emerald-400">Punched In ✓</h2>
          <p className="text-white font-medium mt-1">{name}</p>
          <p className="text-muted-foreground text-sm">{locName}</p>
        </div>

        {/* Live timer */}
        <div className="bg-white/5 rounded-xl p-4 text-center">
          <div className="text-xs text-muted-foreground mb-1">Time in Office</div>
          <div className="text-3xl font-bold text-white tabular-nums">{elapsed}</div>
        </div>

        {/* Break section */}
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Coffee className="w-4 h-4 text-orange-400" />
            <span className="text-sm font-medium text-orange-400">Break Time (45 min)</span>
            {breakUsed && <span className="ml-auto text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">Used ✓</span>}
          </div>

          {!breakActive && !breakUsed && (
            <button onClick={startBreak}
              className="w-full py-2.5 rounded-lg bg-orange-500/20 text-orange-300 text-sm font-medium hover:bg-orange-500/30 transition-all flex items-center justify-center gap-2">
              <Coffee className="w-4 h-4" /> Start Break
            </button>
          )}

          {breakActive && (
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-400 tabular-nums">
                {String(breakMins).padStart(2,"0")}:{String(breakSecs).padStart(2,"0")}
              </div>
              <div className="text-xs text-muted-foreground mt-1">remaining</div>
              <button onClick={() => { setBreakActive(false); setBreakUsed(true); }}
                className="mt-2 text-xs text-muted-foreground hover:text-white underline">
                End break early
              </button>
            </div>
          )}

          {breakUsed && !breakActive && (
            <p className="text-xs text-muted-foreground text-center">45 min will be deducted from work hours</p>
          )}
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}

        <button onClick={handlePunchOut} disabled={loading || breakActive}
          className="w-full py-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <XCircle className="w-5 h-5" />}
          {loading ? "Processing..." : "Punch Out"}
        </button>
        {breakActive && <p className="text-xs text-center text-orange-400">End break before punching out</p>}
      </motion.div>
    );
  }

  // ── FORM screen ──
  return (
    <form onSubmit={handlePunchIn} className="space-y-4">
      <div className="flex items-center gap-2 p-3 rounded-xl bg-estate-500/10 border border-estate-500/20">
        <MapPin className="w-4 h-4 text-estate-400 flex-shrink-0" />
        <span className="text-sm text-estate-300 font-medium">{locName}</span>
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <User className="w-3.5 h-3.5" /> Your Name
        </label>
        <input type="text" value={name} onChange={e => setName(e.target.value)}
          placeholder="Enter your full name"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-400 text-base"
          required />
      </div>

      <div>
        <label className="text-sm text-muted-foreground mb-1.5 flex items-center gap-1.5">
          <Phone className="w-3.5 h-3.5" /> Mobile Number
        </label>
        <input type="tel" value={phone}
          onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
          placeholder="10-digit mobile number"
          className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-400 text-base"
          required />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <XCircle className="w-4 h-4 flex-shrink-0" /> {error}
        </div>
      )}

      <button type="submit" disabled={loading}
        className="w-full py-4 rounded-xl bg-estate-500 hover:bg-estate-600 text-white font-semibold text-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2">
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
        {loading ? "Marking Attendance..." : "Punch In"}
      </button>

      <p className="text-xs text-center text-muted-foreground">
        45 min break will be auto-deducted from work hours
      </p>
    </form>
  );
}

export default function PunchPage() {
  const now      = new Date();
  const isSunday = now.getDay() === 0;
  const schedule = isSunday ? `${fmt(16,0)} – ${fmt(18,0)}` : `${fmt(10,0)} – ${fmt(19,0)}`;

  return (
    <div className="min-h-screen bg-[#04080f] flex flex-col items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="relative w-14 h-14 rounded-2xl overflow-hidden bg-white border-2 border-estate-500/30">
              <Image src="/logo.jpeg" alt="CRS" fill className="object-contain p-1" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">City Real Space</h1>
          <p className="text-sm text-muted-foreground">Attendance System</p>
        </div>

        {/* Live Clock */}
        <div className="mb-6 p-5 rounded-2xl bg-white/5 border border-white/10">
          <LiveClock />
          <div className="text-center mt-3 text-xs text-estate-300">
            <Clock className="w-3 h-3 inline mr-1" />
            Office Hours: {schedule} · Break: 45 min
          </div>
        </div>

        {/* Form card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl">
          <Suspense fallback={<div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto text-estate-400" /></div>}>
            <PunchForm />
          </Suspense>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          City Real Space · Ahmedabad
        </p>
      </div>
    </div>
  );
}
