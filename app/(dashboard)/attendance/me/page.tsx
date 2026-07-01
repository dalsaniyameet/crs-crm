"use client";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Coffee, Clock, Calendar, ChevronDown, ChevronUp, Loader2, AlertTriangle, X, CheckCircle, ScanFace } from "lucide-react";
import toast from "react-hot-toast";
import dynamic from "next/dynamic";

const FacePunch = dynamic(() => import("@/components/attendance/FacePunch"), { ssr: false });

const MAX_BREAKS = 4;
const EXPECTED_HOURS = { weekday: 9, sunday: 2 };

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
  return { diff: workedSecs - expectedSecs, workedSecs };
}

export default function MyAttendancePage() {
  const { user, isLoaded } = useUser();
  const [emp, setEmp]               = useState<any>(null);
  const [locations, setLocations]   = useState<any[]>([]);
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [history, setHistory]       = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [punching, setPunching]     = useState(false);
  const [loading, setLoading]       = useState(true);

  // Fix punch request modal
  const [fixModal, setFixModal]     = useState<{ record: any } | null>(null);
  const [fixTime, setFixTime]       = useState("");
  const [fixing, setFixing]         = useState(false);

  const [breakState, setBreakState] = useState<{ breaks: { start: number; end?: number }[]; onBreak: boolean }>({ breaks: [], onBreak: false });
  const [showFacePunch, setShowFacePunch] = useState<"IN" | "OUT" | null>(null);

  const breakSecs = breakState.breaks.reduce((acc, b) => {
    const end = b.end ?? (breakState.onBreak ? Date.now() : Date.now());
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

  useEffect(() => {
    if (!isLoaded || !user) return;
    const email = user.primaryEmailAddress?.emailAddress || "";
    const name  = user.fullName || user.firstName || email.split("@")[0];
    setEmp({ name, email });
    fetchData(email).finally(() => setLoading(false));
  }, [isLoaded, user, fetchData]);

  const handlePunch = async (type: "IN" | "OUT", faceImage?: string) => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    if (type === "OUT" && breakState.onBreak) { toast.error("End your break before punching out"); return; }
    setPunching(true);
    try {
      const res = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: emp.name, phone: emp.email,
          locationId: locations[0].id,
          bypass: true,
          faceImage,
          action: type === "OUT" ? "OUT" : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); }
      else if (data.type === "PENDING_OT") {
        toast("⏳ Overtime request sent to admin. Waiting for approval...", { icon: "⏰", duration: 5000 });
        await fetchData(emp.email);
      } else {
        if (type === "IN") {
          toast.success("Punched In ✅");
          setBreakState({ breaks: [], onBreak: false });
        } else {
          const wh = data.record?.workHours ?? 0;
          toast.success(`Punched Out 👋 · ${wh.toFixed(1)}h${data.record?.isHalfDay ? " (Half Day)" : ""}`);
        }
        await fetchData(emp.email);
      }
    } catch { toast.error("Network error"); }
    setPunching(false);
  };

  const toggleBreak = () => {
    if (!todayRecord || todayRecord.punchOut) return;
    if (!breakState.onBreak) {
      if (breakState.breaks.length >= MAX_BREAKS) { toast.error(`Max ${MAX_BREAKS} breaks allowed`); return; }
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

  // Employee submits fix request — admin will see it as pending
  const handleFixRequest = async () => {
    if (!fixModal || !fixTime) return;
    setFixing(true);
    const record  = fixModal.record;
    const dateStr = new Date(record.punchIn).toISOString().split("T")[0];
    const res = await fetch("/api/attendance/guest", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: record.id,
        fixPunchOut: `${dateStr}T${fixTime}:00`,
        selfFix: true, // marks as pending approval instead of auto-approve
      }),
    });
    if (res.ok) {
      toast.success("Fix request sent to admin ✅");
      setFixModal(null);
      setFixTime("");
      await fetchData(emp.email);
    } else toast.error("Failed to send request");
    setFixing(false);
  };

  const isPunchedIn   = todayRecord && !todayRecord.punchOut;
  const breaksUsed    = breakState.breaks.length;
  // Records with missing punchOut (excluding today's active record)
  const missingPunchouts = history.filter(h =>
    !h.punchOut &&
    new Date(h.punchIn).toDateString() !== new Date().toDateString()
  );

  if (!isLoaded || loading) return (
    <div className="p-6 flex items-center justify-center min-h-64">
      <Loader2 className="w-8 h-8 animate-spin text-estate-400" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-lg mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">My Attendance</h1>
        <p className="text-sm text-muted-foreground">Welcome, {emp?.name?.split(" ")[0]} 👋</p>
      </div>

      {/* ── Missing punchout alert ── */}
      {missingPunchouts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/8 space-y-2">
          <div className="flex items-center gap-2 text-orange-400 font-semibold text-sm">
            <AlertTriangle className="w-4 h-4" />
            {missingPunchouts.length} record{missingPunchouts.length > 1 ? "s" : ""} missing punch out
          </div>
          <div className="space-y-1.5">
            {missingPunchouts.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-xs">
                <span className="text-white">
                  {new Date(r.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  {" · In: "}
                  {new Date(r.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
                <button
                  onClick={() => {
                    setFixModal({ record: r });
                    setFixTime("18:00");
                  }}
                  className="px-2.5 py-1 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors flex-shrink-0">
                  🔧 Fix Punch Out
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

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
        ) : todayRecord?.otStatus === "PENDING" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3 text-center">
            <div className="text-4xl animate-pulse">⏳</div>
            <div className="text-yellow-400 font-semibold">Overtime Request Pending</div>
            <div className="text-xs text-muted-foreground">
              Punch out request sent to admin at{" "}
              {todayRecord.otPunchOutAt
                ? new Date(todayRecord.otPunchOutAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
                : "—"}
            </div>
            <div className="text-xs text-yellow-400/70">Admin approval ka wait karo. Approve hone ke baad punch out ho jayega.</div>
          </motion.div>
        ) : todayRecord?.otStatus === "DENIED" ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 text-center">
            <div className="text-3xl">❌</div>
            <div className="text-red-400 font-semibold">Overtime Denied</div>
            <div className="text-xs text-muted-foreground">Admin ne overtime approve nahi kiya. Please contact your manager.</div>
          </motion.div>
        ) : todayRecord?.punchOut ? (
          <>
            <div className="text-emerald-400 text-lg font-semibold">Day Complete ✅</div>
            <div className="flex justify-center gap-6 text-xs text-muted-foreground">
              <span>In: <span className="text-white">{new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
              <span>Out: <span className="text-white">{new Date(todayRecord.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</span></span>
            </div>
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

        <div className="flex gap-3 justify-center pt-2">
          {!isPunchedIn && !todayRecord?.punchOut && !todayRecord?.otStatus && (
            <button onClick={() => window.location.href = "/punch"}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors font-medium">
              <ScanFace className="w-4 h-4" /> Face Punch In
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
              <button onClick={() => window.location.href = "/punch"} disabled={breakState.onBreak}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors font-medium disabled:opacity-50">
                <ScanFace className="w-4 h-4" /> Face Punch Out
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
          <div className="border-t border-white/5 divide-y divide-white/5 max-h-80 overflow-y-auto">
            {history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No records</div>
            ) : history.map((h: any) => {
              const isSun   = new Date(h.punchIn).getDay() === 0;
              const expH    = isSun ? EXPECTED_HOURS.sunday : EXPECTED_HOURS.weekday;
              const worked  = h.workHours ?? 0;
              const diff    = worked - expH;
              const status  = getPunchStatus(h.punchIn);
              const isMissingOut = !h.punchOut && new Date(h.punchIn).toDateString() !== new Date().toDateString();
              const isRejected   = h.approvedBy?.startsWith("REJECTED");
              const isPending    = !h.approved && !isRejected && h.punchOut;
              return (
                <div key={h.id} className={`flex items-center gap-3 px-4 py-2.5 text-xs ${isMissingOut ? "bg-orange-500/5" : ""}`}>
                  <span className="text-muted-foreground w-14 flex-shrink-0">
                    {new Date(h.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-white flex-1 min-w-0 truncate">
                    {new Date(h.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    {h.punchOut
                      ? <> → {new Date(h.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>
                      : <span className="text-orange-400"> → Missing ⚠️</span>
                    }
                  </span>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {h.punchOut && (
                      <span className={diff >= 0 ? "text-emerald-400" : "text-red-400"}>
                        {diff >= 0 ? `+${diff.toFixed(1)}h` : `${diff.toFixed(1)}h`}
                      </span>
                    )}
                    {h.isHalfDay && <span className="text-yellow-400 text-[10px] px-1 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/20">½ Day</span>}
                    {h.otStatus === "APPROVED" && <span className="text-purple-400 text-[10px]">OT ✓</span>}
                    {h.approved && <CheckCircle className="w-3 h-3 text-emerald-400" />}
                    {isRejected && <span className="text-red-400">✗</span>}
                    {isPending && <span className="text-yellow-400 text-[10px]">Pending</span>}
                    {isMissingOut && (
                      <button
                        onClick={() => { setFixModal({ record: h }); setFixTime("18:00"); }}
                        className="px-2 py-0.5 rounded bg-orange-500/20 border border-orange-500/30 text-orange-400 hover:bg-orange-500/30 transition-colors">
                        🔧 Fix
                      </button>
                    )}
                    {!h.punchOut && !isMissingOut && <span className="text-emerald-400">In Office</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Face Punch Modal */}
      <AnimatePresence>
        {showFacePunch && emp && (
          <FacePunch
            employeeName={emp.name}
            action={showFacePunch}
            onSuccess={async (faceImage) => {
              const type = showFacePunch;
              setShowFacePunch(null);
              await handlePunch(type, faceImage);
            }}
            onClose={() => setShowFacePunch(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Fix Punch Out Modal ── */}
      <AnimatePresence>
        {fixModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}
            onClick={() => setFixModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="w-full max-w-sm rounded-2xl p-5 space-y-4"
              style={{ background: "#0d0d14", border: "1px solid rgba(249,115,22,0.35)" }}
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">🔧 Fix Missed Punch Out</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {new Date(fixModal.record.punchIn).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
                    {" · Punched in: "}
                    {new Date(fixModal.record.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                  </div>
                </div>
                <button onClick={() => setFixModal(null)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Punch Out Time *</label>
                <div className="flex gap-2 items-center">
                  <select
                    value={fixTime ? (parseInt(fixTime.split(":")[0]) % 12 || 12).toString() : "7"}
                    onChange={e => {
                      const [, min] = fixTime ? fixTime.split(":") : ["0","00"];
                      const ampm = fixTime ? (parseInt(fixTime.split(":")[0]) >= 12 ? "pm" : "am") : "pm";
                      let h = parseInt(e.target.value);
                      if (ampm === "pm" && h !== 12) h += 12;
                      if (ampm === "am" && h === 12) h = 0;
                      setFixTime(`${String(h).padStart(2,"0")}:${min || "00"}`);
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [color-scheme:dark]">
                    {Array.from({length:12},(_,i)=>i+1).map(h=><option key={h} value={h}>{h}</option>)}
                  </select>
                  <span className="text-white">:</span>
                  <select
                    value={fixTime ? fixTime.split(":")[1] : "00"}
                    onChange={e => {
                      const h = fixTime ? fixTime.split(":")[0] : "19";
                      setFixTime(`${h}:${e.target.value}`);
                    }}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [color-scheme:dark]">
                    {["00","05","10","15","20","25","30","35","40","45","50","55"].map(m=><option key={m} value={m}>{m}</option>)}
                  </select>
                  <select
                    value={fixTime ? (parseInt(fixTime.split(":")[0]) >= 12 ? "pm" : "am") : "pm"}
                    onChange={e => {
                      const [hStr, min] = fixTime ? fixTime.split(":") : ["7","00"];
                      let h = parseInt(hStr) % 12;
                      if (h === 0) h = 12;
                      let h24 = h;
                      if (e.target.value === "pm" && h !== 12) h24 = h + 12;
                      if (e.target.value === "am" && h === 12) h24 = 0;
                      setFixTime(`${String(h24).padStart(2,"0")}:${min || "00"}`);
                    }}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-orange-500/50 [color-scheme:dark]">
                    <option value="am">AM</option>
                    <option value="pm">PM</option>
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-orange-500/8 border border-orange-500/20 text-xs text-orange-400">
                ⚠️ Your correction request will be sent to admin for approval. Record will be updated once approved. Approve hone ke baad record update hoga.
              </div>

              <div className="flex gap-2">
                <button onClick={handleFixRequest} disabled={fixing || !fixTime}
                  className="flex-1 py-2.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 hover:bg-orange-500/30 text-sm font-medium transition-colors disabled:opacity-50">
                  {fixing ? "Sending..." : "Send Fix Request to Admin"}
                </button>
                <button onClick={() => setFixModal(null)}
                  className="px-4 py-2.5 rounded-xl bg-white/5 text-muted-foreground border border-white/10 hover:text-white text-sm transition-colors">
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
