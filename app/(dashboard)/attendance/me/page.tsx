"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import { LogIn, LogOut, Coffee, Clock, Calendar, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

const MAX_BREAKS = 4;
const EXPECTED_HOURS = { weekday: 9, sunday: 2 }; // Mon-Sat 10-19, Sun 16-18

function LiveTimer({ since, breakSecs = 0 }: { since: string; breakSecs?: number }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000) - breakSecs));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since, breakSecs]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return <span className="font-mono text-emerald-400 text-2xl">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

function getPunchStatus(punchInTime: string) {
  const d = new Date(punchInTime);
  const cur = d.getHours() * 60 + d.getMinutes();
  const isSun = d.getDay() === 0;
  const exp = isSun ? 16 * 60 : 10 * 60;
  if (cur <= exp + 10) return { label: "On Time ✅", color: "text-emerald-400" };
  if (cur <= exp + 30) return { label: "Slightly Late ⚠️", color: "text-yellow-400" };
  return { label: "Late 🔴", color: "text-red-400" };
}

function getWorkDiff(punchIn: string, punchOut: string | null, breakSecs: number) {
  const isSun = new Date(punchIn).getDay() === 0;
  const expectedSecs = (isSun ? EXPECTED_HOURS.sunday : EXPECTED_HOURS.weekday) * 3600;
  const outTime = punchOut ? new Date(punchOut).getTime() : Date.now();
  const workedSecs = Math.max(0, Math.floor((outTime - new Date(punchIn).getTime()) / 1000) - breakSecs);
  const diff = workedSecs - expectedSecs;
  return { diff, workedSecs };
}

export default function MyAttendancePage() {
  const { user, isLoaded } = useUser();
  const [emp, setEmp] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [punching, setPunching] = useState(false);
  const [loading, setLoading] = useState(true);

  // Break state
  const [breakState, setBreakState] = useState<{ breaks: { start: number; end?: number }[]; onBreak: boolean }>({ breaks: [], onBreak: false });

  const breakSecs = breakState.breaks.reduce((acc, b) => {
    const end = b.end ?? (breakState.onBreak ? Date.now() : b.end ?? Date.now());
    return acc + Math.floor((end - b.start) / 1000);
  }, 0);

  const fetchData = useCallback(async (empEmail: string) => {
    const [locRes, recRes, histRes] = await Promise.all([
      fetch("/api/attendance/locations"),
      fetch(`/api/attendance/guest?date=${new Date().toISOString().split("T")[0]}`),
      fetch(`/api/attendance/guest?phone=${encodeURIComponent(empEmail)}`),
    ]);
    const [locs, recs, hist] = await Promise.all([locRes.json(), recRes.json(), histRes.json()]);
    setLocations(Array.isArray(locs) ? locs : []);
    const myRecs = (Array.isArray(recs) ? recs : []).filter((r: any) => r.phone === empEmail);
    const active = myRecs.find((r: any) => !r.punchOut);
    setTodayRecord(active || myRecs[0] || null);
    setHistory(Array.isArray(hist) ? hist.slice(0, 30) : []);
  }, []);

  // Auto-login from Clerk session
  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || "";
    const name = user.fullName || user.firstName || email.split("@")[0];
    setEmp({ name, email });
    fetchData(email).finally(() => setLoading(false));
  }, [isLoaded, user, fetchData]);

  const handlePunch = async (type: "IN" | "OUT") => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    if (type === "OUT" && breakState.onBreak) { toast.error("End your break before punching out"); return; }
    setPunching(true);
    try {
      const res = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emp.name,
          phone: emp.email,
          locationId: locations[0].id,
          bypass: true,
          action: type === "OUT" ? "OUT" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); }
      else {
        if (type === "IN") {
          toast.success("Punched In ✅");
          setBreakState({ breaks: [], onBreak: false });
        } else {
          const { diff } = getWorkDiff(data.record?.punchIn ?? todayRecord?.punchIn, data.record?.punchOut, breakSecs);
          const diffH = Math.abs(diff / 3600).toFixed(1);
          if (diff >= 0) toast.success(`Punched Out 👋 · Extra: +${diffH}h ⬆️`);
          else toast(`Punched Out 👋 · Short: -${diffH}h ⬇️`, { icon: "⚠️" });
        }
        await fetchData(emp.email);
      }
    } catch { toast.error("Network error"); }
    setPunching(false);
  };

  const toggleBreak = () => {
    if (!todayRecord || todayRecord.punchOut) return;
    if (!breakState.onBreak) {
      if (breakState.breaks.length >= MAX_BREAKS) { toast.error(`Max ${MAX_BREAKS} breaks allowed per day`); return; }
      setBreakState(prev => ({ breaks: [...prev.breaks, { start: Date.now() }], onBreak: true }));
      toast("Break started ☕", { icon: "⏸️" });
    } else {
      setBreakState(prev => ({
        breaks: prev.breaks.map((b, i) => i === prev.breaks.length - 1 ? { ...b, end: Date.now() } : b),
        onBreak: false,
      }));
      const last = breakState.breaks[breakState.breaks.length - 1];
      const elapsed = Math.floor((Date.now() - last.start) / 1000);
      toast.success(`Break ended — ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
    }
  };

  const isPunchedIn = todayRecord && !todayRecord.punchOut;
  const breaksUsed = breakState.breaks.length;

  if (!isLoaded || loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-8 h-8 animate-spin text-estate-400" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">My Attendance</h1>
          <p className="text-sm text-muted-foreground">Welcome, {emp?.name?.split(" ")[0]} 👋</p>
        </div>
      </div>

      {/* Today Status Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6 text-center space-y-4">
        <div className="text-sm text-muted-foreground">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>

        {isPunchedIn ? (
          <>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Time in office</div>
              <LiveTimer since={todayRecord.punchIn} breakSecs={breakSecs} />
            </div>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span>In: <span className="text-white">{new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
              <span className={getPunchStatus(todayRecord.punchIn).color}>{getPunchStatus(todayRecord.punchIn).label}</span>
            </div>
            {/* Break info */}
            <div className="flex justify-center gap-2 text-xs">
              {Array.from({ length: MAX_BREAKS }).map((_, i) => (
                <div key={i} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs border ${
                  i < breaksUsed ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-400" : "bg-white/5 border-white/10 text-muted-foreground"
                }`}>☕</div>
              ))}
              <span className="text-muted-foreground ml-1">{breaksUsed}/{MAX_BREAKS} breaks</span>
            </div>
            {breakState.onBreak && <div className="text-yellow-400 text-sm animate-pulse">☕ On Break...</div>}
          </>
        ) : todayRecord?.punchOut ? (
          <>
            <div className="text-emerald-400 text-lg font-semibold">Day Complete ✅</div>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span>In: <span className="text-white">{new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
              <span>Out: <span className="text-white">{new Date(todayRecord.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
            </div>
            {/* Work hours diff */}
            {(() => {
              const { diff, workedSecs } = getWorkDiff(todayRecord.punchIn, todayRecord.punchOut, 0);
              const wH = Math.floor(workedSecs / 3600), wM = Math.floor((workedSecs % 3600) / 60);
              const diffH = Math.abs(diff / 3600).toFixed(1);
              return (
                <div className="text-sm">
                  <span className="text-white">{wH}h {wM}m worked</span>
                  {" · "}
                  {diff >= 0
                    ? <span className="text-emerald-400">+{diffH}h extra ⬆️</span>
                    : <span className="text-red-400">-{diffH}h short ⬇️</span>}
                </div>
              );
            })()}
          </>
        ) : (
          <div className="text-muted-foreground text-sm py-4">Not punched in yet today</div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center pt-2">
          {!isPunchedIn && !todayRecord?.punchOut && (
            <button onClick={() => handlePunch("IN")} disabled={punching}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-medium disabled:opacity-50">
              <LogIn className="w-4 h-4" /> Punch In
            </button>
          )}
          {isPunchedIn && (
            <>
              <button onClick={toggleBreak} disabled={breaksUsed >= MAX_BREAKS && !breakState.onBreak}
                className={`flex items-center gap-2 px-4 py-3 rounded-xl border transition-colors font-medium disabled:opacity-40 ${
                  breakState.onBreak
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400"
                }`}>
                <Coffee className="w-4 h-4" />
                {breakState.onBreak ? "End Break" : `Break (${MAX_BREAKS - breaksUsed} left)`}
              </button>
              <button onClick={() => handlePunch("OUT")} disabled={punching || breakState.onBreak}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50">
                <LogOut className="w-4 h-4" /> Punch Out
              </button>
            </>
          )}
        </div>
      </motion.div>

      {/* History */}
      <div className="glass-card overflow-hidden">
        <button onClick={() => setShowHistory(v => !v)}
          className="w-full flex items-center gap-2 p-4 hover:bg-white/5 transition-colors">
          <Calendar className="w-4 h-4 text-estate-400" />
          <span className="text-sm font-medium text-white">Attendance History</span>
          <span className="ml-auto text-xs text-muted-foreground mr-2">{history.length} records</span>
          {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        {showHistory && (
          <div className="border-t border-white/5 divide-y divide-white/5 max-h-72 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No records</div>
            ) : history.map((h: any) => {
              const isSun = new Date(h.punchIn).getDay() === 0;
              const expH = isSun ? EXPECTED_HOURS.sunday : EXPECTED_HOURS.weekday;
              const worked = h.workHours ?? 0;
              const diff = worked - expH;
              const status = getPunchStatus(h.punchIn);
              return (
                <div key={h.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                  <span className="text-muted-foreground w-16 flex-shrink-0">
                    {new Date(h.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-white flex-1">
                    {new Date(h.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    {h.punchOut && <> → {new Date(h.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>}
                  </span>
                  <span className={status.color}>{status.label.split(" ")[0]}</span>
                  {h.punchOut && (
                    <span className={diff >= 0 ? "text-emerald-400" : "text-red-400"}>
                      {diff >= 0 ? `+${diff.toFixed(1)}h` : `${diff.toFixed(1)}h`}
                    </span>
                  )}
                  {!h.punchOut && <span className="text-emerald-400">In Office</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
