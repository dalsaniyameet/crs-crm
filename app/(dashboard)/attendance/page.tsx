"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  QrCode, MapPin, Clock, Users, Printer, RefreshCw,
  Coffee, LogIn, LogOut, Calendar, ChevronDown, ChevronUp, Gift, ScanFace,
} from "lucide-react";
import toast from "react-hot-toast";
import FacePunch from "@/components/attendance/FacePunch";

// ── Birthday confetti ──────────────────────────────────────────────────────
function BirthdayBanner({ employees }: { employees: any[] }) {
  const today = new Date();
  const bday = employees.filter(e => {
    const d = new Date(e.dob);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth();
  });
  if (!bday.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl p-5 mb-2"
      style={{ background: "linear-gradient(135deg,#7c3aed,#db2777,#f59e0b)", boxShadow: "0 0 40px rgba(219,39,119,0.4)" }}>
      <Confetti />
      <div className="relative z-10 flex items-center gap-4 flex-wrap">
        <div className="text-4xl animate-bounce">🎂</div>
        <div>
          <div className="text-white font-bold text-lg">
            🎉 Happy Birthday, {bday.map(e => e.name.split(" ")[0]).join(" & ")}!
          </div>
          <div className="text-white/80 text-sm mt-0.5">
            Wishing you a wonderful day! 🎊 The whole team celebrates with you! 🥳
          </div>
        </div>
        <div className="ml-auto text-3xl">🎁</div>
      </div>
    </motion.div>
  );
}

function Confetti() {
  const colors = ["#f59e0b","#ec4899","#8b5cf6","#10b981","#3b82f6","#ef4444"];
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 30 }).map((_, i) => (
        <motion.div key={i}
          className="absolute w-2 h-2 rounded-sm"
          style={{ background: colors[i % colors.length], left: `${Math.random() * 100}%`, top: "-10px" }}
          animate={{ y: ["0%", "110%"], rotate: [0, 360 * (Math.random() > 0.5 ? 1 : -1)], opacity: [1, 0] }}
          transition={{ duration: 2 + Math.random() * 2, delay: Math.random() * 2, repeat: Infinity, ease: "linear" }}
        />
      ))}
    </div>
  );
}

// ── Live timer ─────────────────────────────────────────────────────────────
function LiveTimer({ since, breakSecs = 0 }: { since: string; breakSecs?: number }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.floor((Date.now() - new Date(since).getTime()) / 1000) - breakSecs);
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [since, breakSecs]);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  return <span className="font-mono text-emerald-400">{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

function getPunchStatus(punchInTime: string) {
  const d = new Date(punchInTime);
  const cur = d.getHours() * 60 + d.getMinutes();
  const isSun = d.getDay() === 0;
  const exp = isSun ? 16 * 60 : 10 * 60;
  if (cur <= exp + 10) return { label: "On Time",       color: "text-emerald-400" };
  if (cur <= exp + 30) return { label: "Slightly Late", color: "text-yellow-400" };
  return                      { label: "Late",          color: "text-red-400" };
}

export default function AttendancePage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const [locations, setLocations]       = useState<any[]>([]);
  const [records, setRecords]           = useState<any[]>([]);
  const [employees, setEmployees]       = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
  const [expandedEmp, setExpandedEmp]   = useState<string | null>(null);
  const [empHistory, setEmpHistory]     = useState<Record<string, any[]>>({});

  // Admin manual punch state
  const [punchingEmp, setPunchingEmp]   = useState<string | null>(null);
  const [breakTimers, setBreakTimers]   = useState<Record<string, { start: number; total: number }>>({}); 
  const [facePunch, setFacePunch]       = useState<{ emp: any; action: "IN" | "OUT" } | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [locRes, recRes, empRes] = await Promise.all([
        fetch("/api/attendance/locations"),
        fetch(`/api/attendance/guest?date=${selectedDate}`),
        fetch("/api/attendance/employees"),
      ]);
      const [locs, recs, emps] = await Promise.all([locRes.json(), recRes.json(), empRes.json()]);
      setLocations(Array.isArray(locs) ? locs : []);
      setRecords(Array.isArray(recs) ? recs : []);
      setEmployees(Array.isArray(emps) ? emps : []);
    } catch { /* silent */ }
    setLoading(false);
  }, [selectedDate]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Non-admin redirect
  useEffect(() => {
    if (isLoaded && user) {
      const role = ((user.publicMetadata?.role as string) || "").toUpperCase();
      if (role !== "ADMIN") router.replace("/employee");
    }
  }, [isLoaded, user, router]);

  // Load employee attendance history
  const loadEmpHistory = async (empId: string) => {
    if (expandedEmp === empId) { setExpandedEmp(null); return; }
    if (empHistory[empId]) { setExpandedEmp(empId); return; }
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    try {
      const res = await fetch(`/api/attendance/guest?phone=${encodeURIComponent(emp.email)}`);
      const data = await res.json();
      setEmpHistory(prev => ({ ...prev, [empId]: Array.isArray(data) ? data : [] }));
    } catch { setEmpHistory(prev => ({ ...prev, [empId]: [] })); }
    setExpandedEmp(empId);
  };

  // Admin punch in/out for employee
  const handleAdminPunch = async (emp: any, type: "IN" | "OUT") => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    setPunchingEmp(emp.id);
    try {
      const res = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name:       emp.name,
          phone:      emp.email,   // for guest: email field stores phone
          locationId: locations[0].id,
          action:     type === "OUT" ? "OUT" : undefined,
          bypass:     true,
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); }
      else {
        toast.success(`${emp.name} punched ${type === "IN" ? "in ✅" : "out 👋"}`);
        fetchAll();
        setEmpHistory(prev => { const n = { ...prev }; delete n[emp.id]; return n; });
        if (expandedEmp === emp.id) setTimeout(() => loadEmpHistory(emp.id), 500);
      }
    } catch { toast.error("Network error"); }
    setPunchingEmp(null);
  };

  // Break timer toggle
  const toggleBreak = (empId: string) => {
    setBreakTimers(prev => {
      if (prev[empId]?.start) {
        const elapsed = Math.floor((Date.now() - prev[empId].start) / 1000);
        toast.success(`Break ended — ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
        return { ...prev, [empId]: { start: 0, total: (prev[empId].total || 0) + elapsed } };
      }
      toast("Break started ☕", { icon: "⏸️" });
      return { ...prev, [empId]: { start: Date.now(), total: prev[empId]?.total || 0 } };
    });
  };

  if (loading) return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">Attendance</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1,2].map(i => <div key={i} className="glass-card p-5 h-48 animate-pulse bg-white/5" />)}
      </div>
    </div>
  );

  const isSunday = new Date().getDay() === 0;
  const present  = records.filter(r => r.punchIn);
  // Dedupe stillIn by phone — keep only latest active record per person
  const stillInRaw = records.filter(r => r.punchIn && !r.punchOut);
  const stillInMap = new Map<string, any>();
  for (const r of stillInRaw) {
    const key = r.phone || r.name;
    if (!stillInMap.has(key) || new Date(r.punchIn) > new Date(stillInMap.get(key).punchIn))
      stillInMap.set(key, r);
  }
  const stillIn = Array.from(stillInMap.values());

  // Which employees are currently punched in today (match by phone OR name)
  const punchedInKeys = new Set([...stillIn.map(r => r.phone), ...stillIn.map(r => r.name)]);

  // Helper: get today's record for an employee
  const getTodayRecord = (emp: any) =>
    stillIn.find(r => r.phone === emp.email || r.phone === emp.phone || r.name === emp.name);

  // Helper: work diff vs expected
  const getWorkDiff = (punchIn: string, punchOut: string | null, breakSecs: number) => {
    const isSun = new Date(punchIn).getDay() === 0;
    const expectedSecs = (isSun ? 2 : 9) * 3600;
    const outTime = punchOut ? new Date(punchOut).getTime() : Date.now();
    const workedSecs = Math.max(0, Math.floor((outTime - new Date(punchIn).getTime()) / 1000) - breakSecs);
    return workedSecs - expectedSecs;
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Attendance</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage employee punch in/out · Break timer · History</p>
      </div>

      {/* Birthday Banner */}
      <BirthdayBanner employees={employees} />

      {/* Office Hours */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-xl bg-estate-500/10 border border-estate-500/20">
        <Clock className="w-5 h-5 text-estate-400 flex-shrink-0" />
        <div className="flex flex-wrap gap-6 text-sm">
          <div><span className="text-muted-foreground">Mon–Sat: </span><span className="text-white font-medium">10:00 AM – 7:00 PM</span></div>
          <div><span className="text-muted-foreground">Sunday: </span><span className="text-white font-medium">4:00 PM – 6:00 PM</span></div>
        </div>
        <div className="ml-auto text-xs px-3 py-1 rounded-full bg-estate-500/20 text-estate-300 font-medium">
          Today: {isSunday ? "Sunday · 4:00–6:00 PM" : "Mon–Sat · 10:00 AM–7:00 PM"}
        </div>
      </div>

      {/* ── Employee Punch Panel ── */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-estate-400" />
          <h3 className="font-semibold text-white">Employee Punch In / Out</h3>
          <span className="ml-auto text-xs text-muted-foreground">{employees.filter(e => e.isActive).length} employees</span>
        </div>

        {employees.filter(e => e.isActive).length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No employees added yet</div>
        ) : (
          <div className="space-y-2">
            {employees.filter(e => e.isActive).map(emp => {
              const isPunchedIn  = punchedInKeys.has(emp.email) || punchedInKeys.has(emp.phone) || punchedInKeys.has(emp.name);
              const todayRecord  = getTodayRecord(emp);
              const bt           = breakTimers[emp.id];
              const onBreak      = bt?.start > 0;
              const breakSecs    = (bt?.total || 0) + (onBreak ? Math.floor((Date.now() - bt.start) / 1000) : 0);
              const isExpanded   = expandedEmp === emp.id;
              const history      = empHistory[emp.id] || [];
              const today = new Date();
              const isBday = new Date(emp.dob).getDate() === today.getDate() && new Date(emp.dob).getMonth() === today.getMonth();

              return (
                <div key={emp.id} className="rounded-xl border border-white/8 overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-white/3 hover:bg-white/5 transition-colors">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {emp.name[0]}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{emp.name}</span>
                        {isBday && <span className="text-base">🎂</span>}
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${isPunchedIn ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-muted-foreground"}`}>
                          {isPunchedIn ? "● In Office" : "○ Absent"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{emp.position}</div>
                      {isPunchedIn && todayRecord && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          In: {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          {" · "}<LiveTimer since={todayRecord.punchIn} breakSecs={breakSecs} />
                          {" · "}<span className={getPunchStatus(todayRecord.punchIn).color}>{getPunchStatus(todayRecord.punchIn).label}</span>
                          {onBreak && <span className="ml-2 text-yellow-400 animate-pulse">☕ On Break</span>}
                        </div>
                      )}
                    {!isPunchedIn && (() => {
                        // Show last punch out record for today
                        const doneRec = records.find(r => (r.phone === emp.email || r.phone === emp.phone || r.name === emp.name) && r.punchOut);
                        if (!doneRec) return null;
                        const diff = getWorkDiff(doneRec.punchIn, doneRec.punchOut, 0);
                        const diffH = Math.abs(diff / 3600).toFixed(1);
                        return (
                          <div className="text-xs mt-0.5">
                            <span className="text-muted-foreground">
                              {new Date(doneRec.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                              {" → "}
                              {new Date(doneRec.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                            </span>
                            {" · "}
                            {diff >= 0
                              ? <span className="text-emerald-400">+{diffH}h extra ⬆️</span>
                              : <span className="text-red-400">-{diffH}h short ⬇️</span>}
                            {" · "}<span className={getPunchStatus(doneRec.punchIn).color}>{getPunchStatus(doneRec.punchIn).label}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1 flex-shrink-0 flex-wrap justify-end">
                      {!isPunchedIn ? (
                        <>
                          <button onClick={() => setFacePunch({ emp, action: "IN" })}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors">
                            <ScanFace className="w-3 h-3" /> Face
                          </button>
                          <button onClick={() => handleAdminPunch(emp, "IN")} disabled={punchingEmp === emp.id}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                            <LogIn className="w-3 h-3" /> Punch In
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => toggleBreak(emp.id)}
                            className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                              onBreak
                                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400"
                            }`}>
                            <Coffee className="w-3 h-3" />
                            {onBreak ? "End Break" : "Break"}
                          </button>
                          <button onClick={() => setFacePunch({ emp, action: "OUT" })}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 hover:bg-yellow-500/30 transition-colors">
                            <ScanFace className="w-3 h-3" /> Face
                          </button>
                          <button onClick={() => handleAdminPunch(emp, "OUT")} disabled={punchingEmp === emp.id}
                            className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                            <LogOut className="w-3 h-3" /> Punch Out
                          </button>
                        </>
                      )}
                      <button onClick={() => loadEmpHistory(emp.id)}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  {/* Attendance History */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden border-t border-white/5">
                        <div className="p-3 space-y-1.5 max-h-48 overflow-y-auto">
                          <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Attendance History (last 30 days)
                          </div>
                          {history.length === 0 ? (
                            <div className="text-xs text-muted-foreground text-center py-3">No records found</div>
                          ) : history.map((h: any) => (
                            <div key={h.id} className="flex items-center gap-3 text-xs py-1.5 border-b border-white/3 last:border-0">
                              <span className="text-muted-foreground w-20 flex-shrink-0">
                                {new Date(h.punchIn).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                              </span>
                              <span className="text-white">
                                {new Date(h.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                {h.punchOut && <> → {new Date(h.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>}
                              </span>
                              <span className={`ml-auto font-medium ${h.workHours ? "text-estate-400" : "text-emerald-400"}`}>
                                {h.workHours ? `${h.workHours.toFixed(1)}h` : "In Office"}
                              </span>
                              {h.workHours && (() => {
                                const diff = getWorkDiff(h.punchIn, h.punchOut, 0);
                                const diffH = Math.abs(diff / 3600).toFixed(1);
                                return <span className={diff >= 0 ? "text-emerald-400 text-xs" : "text-red-400 text-xs"}>{diff >= 0 ? `+${diffH}h` : `-${diffH}h`}</span>;
                              })()}
                              <span className={`text-xs ${getPunchStatus(h.punchIn).color}`}>{getPunchStatus(h.punchIn).label}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── QR Code ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-1">
          <QrCode className="w-5 h-5 text-estate-400" />
          <h3 className="font-semibold text-white">Office QR Code</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-5">Mobile: Scan QR · Desktop: Open link on office PC</p>
        {locations.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">No office location configured.</div>
        ) : (() => {
          const loc      = locations[0];
          const appUrl   = typeof window !== "undefined" ? window.location.origin : "";
          const punchUrl = `${appUrl}/punch?loc=${loc.id}&name=${encodeURIComponent(loc.name)}`;
          const qrImg    = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(punchUrl)}&margin=10&bgcolor=ffffff`;
          return (
            <div className="flex flex-col items-center gap-5">
              <div className="text-center">
                <div className="font-semibold text-white">{loc.name}</div>
                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-1">
                  <MapPin className="w-3 h-3" /> {loc.address}
                </div>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrImg} alt="Office QR" width={200} height={200} />
              </div>
              <div className="w-full p-4 rounded-xl bg-estate-500/10 border border-estate-500/20">
                <p className="text-xs font-semibold text-estate-300 mb-2">🖥️ Desktop Link</p>
                <p className="text-xs text-white break-all font-mono bg-black/30 rounded-lg px-3 py-2 select-all">{punchUrl}</p>
                <button onClick={() => { navigator.clipboard.writeText(punchUrl); toast.success("Copied!"); }}
                  className="mt-2 text-xs text-estate-400 hover:text-estate-300 underline">📋 Copy Link</button>
              </div>
              <a href={qrImg} download={`QR-${loc.name}.png`} target="_blank" rel="noreferrer"
                className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-estate-500/20 text-estate-300 text-sm hover:bg-estate-500/30 transition-all">
                <Printer className="w-4 h-4" /> Download & Print QR
              </a>
            </div>
          );
        })()}
      </motion.div>

      {/* ── Daily Records ── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-estate-400" />
            <h3 className="font-semibold text-white">Daily Records</h3>
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-estate-400 [color-scheme:dark]" />
            <button onClick={fetchAll} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[
            { label: "Present",     value: present.length,                  color: "text-white" },
            { label: "In Office",   value: stillIn.length,                  color: "text-emerald-400" },
            { label: "Punched Out", value: present.length - stillIn.length, color: "text-blue-400" },
          ].map(s => (
            <div key={s.label} className="p-3 rounded-lg bg-white/5 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
        {records.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground text-sm">No records for this date.</div>
        ) : (
        <div className="space-y-2">
            {(() => {
            // Dedupe daily records by phone — show latest per person
            const seen = new Map<string, any>();
            for (const r of records) {
              const key = r.phone || r.name;
              if (!seen.has(key) || new Date(r.punchIn) > new Date(seen.get(key).punchIn))
                seen.set(key, r);
            }
            const deduped = Array.from(seen.values());
            return deduped.map(r => {
              const status = getPunchStatus(r.punchIn);
              return (
                <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${r.punchOut ? "bg-blue-400" : "bg-emerald-400"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-white truncate">{r.name}</span>
                      <span className={`text-xs ${status.color}`}>{status.label}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">{r.location?.name}</div>
                  </div>
                  <div className="text-right text-xs flex-shrink-0 space-y-1">
                    <div className="text-white">
                      {new Date(r.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      {r.punchOut && <> → {new Date(r.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>}
                    </div>
                    <div className={r.workHours ? "text-estate-400" : "text-emerald-400"}>
                      {r.workHours ? `${r.workHours.toFixed(1)}h` : "In Office"}
                    </div>
                    {r.punchOut && !r.approved && (
                      <button
                        onClick={async () => {
                          await fetch("/api/attendance/guest", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ id: r.id, approved: true }),
                          });
                          toast.success(`${r.name} approved ✓`);
                          fetchAll();
                        }}
                        className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors">
                        ✓ Approve
                      </button>
                    )}
                    {r.approved && (
                      <span className="text-xs text-emerald-400">✓ Approved</span>
                    )}
                  </div>
                </div>
              );
            });
            })()}
          </div>
        )}
      </motion.div>

      {/* Face Punch Modal */}
      <AnimatePresence>
        {facePunch && (
          <FacePunch
            employeeName={facePunch.emp.name}
            action={facePunch.action}
            onSuccess={() => {
              handleAdminPunch(facePunch.emp, facePunch.action);
              setFacePunch(null);
            }}
            onClose={() => setFacePunch(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
