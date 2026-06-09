"use client";
import useSWR from "swr";
import { useState, useEffect, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import toast from "react-hot-toast";
import WelcomeSplash from "@/components/ui/welcome-splash";
import {
  Users, Building2, GitBranch, DollarSign,
  Calendar, AlertCircle, Zap, ArrowUpRight,
  Clock, LogIn, LogOut, Loader2,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`API error ${r.status}`);
  return r.json();
});

const SOURCE_COLORS: Record<string, string> = {
  WHATSAPP:        "#25d366",
  ACRES99:         "#eab308",
  MAGICBRICKS:     "#f97316",
  WEBSITE:         "#0ea5e9",
  REFERRAL:        "#ec4899",
  FACEBOOK:        "#6366f1",
  WALK_IN:         "#a855f7",
  COLD_CALL:       "#64748b",
  HOUSING:         "#06b6d4",
  GOOGLE_BUSINESS: "#ef4444",
  OTHER:           "#94a3b8",
};

const SOURCE_LABEL: Record<string, string> = {
  WHATSAPP:        "WhatsApp 💬",
  ACRES99:         "99acres 🏠",
  MAGICBRICKS:     "MagicBricks 🧱",
  WEBSITE:         "CityRealSpace 🌐",
  REFERRAL:        "Referral 🤝",
  FACEBOOK:        "Facebook 📘",
  WALK_IN:         "Walk In 🚶",
  COLD_CALL:       "Cold Call 📞",
  HOUSING:         "Housing.com 🏡",
  GOOGLE_BUSINESS: "Google 🔍",
  OTHER:           "Other 📋",
};

const fmtMoney = (n: number) => {
  if (!n || n <= 0) return null;
  // If stored as lakhs (e.g. 23.5 = 23.5L), values < 1000 are in lakhs
  const val = n < 1000 ? n * 100000 : n;
  return val >= 10000000 ? `₹${(val / 10000000).toFixed(1)}Cr`
    : val >= 100000 ? `₹${(val / 100000).toFixed(1)}L`
    : `₹${(val / 1000).toFixed(0)}K`;
};

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-white/10 rounded-lg ${className}`} />;
}

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array(6).fill(0).map((_, i) => (
        <div key={i} className="stat-card space-y-3">
          <Skeleton className="w-8 h-8 rounded-lg" />
          <Skeleton className="h-6 w-16" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </div>
  );
}

const Tip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ color?: string; fill?: string; name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs border" style={{ borderColor: "rgba(234,179,8,0.2)" }}>
      <p className="text-white font-semibold mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} style={{ color: p.color ?? p.fill }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

export default function DashboardPage() {
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const { user } = useUser();

  // Show splash once per browser session
  const [showSplash, setShowSplash] = useState(false);
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    const key = "crs_splash_shown";
    if (!sessionStorage.getItem(key)) {
      setShowSplash(true);
      sessionStorage.setItem(key, "1");
    } else {
      setSplashDone(true);
    }
  }, []);

  const handleSplashDone = useCallback(() => {
    setShowSplash(false);
    setSplashDone(true);
  }, []);

  const { data, isLoading, error: swrError } = useSWR("/api/dashboard", fetcher, {
    revalidateOnFocus: true,
    dedupingInterval: 0,
    revalidateOnReconnect: true,
    refreshInterval: 60000,
    onError: (err) => console.error("[Dashboard SWR Error]", err),
  });

  // ── Attendance state ──
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [locations, setLocations]     = useState<any[]>([]);
  const [punching, setPunching]       = useState(false);
  const [attLoaded, setAttLoaded]     = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/attendance/locations").then(r => r.json()).catch(() => []),
      fetch("/api/attendance/today").then(r => r.json()).catch(() => null),
    ]).then(([locs, active]) => {
      setLocations(Array.isArray(locs) ? locs : []);
      setTodayRecord(active || null);
      setAttLoaded(true);
    });
  }, []);

  const userName = user?.fullName || user?.firstName || "";
  const userRole = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase();

  const handlePunch = async (type: "IN" | "OUT") => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    setPunching(true);
    try {
      const res = await fetch("/api/attendance/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName || user?.primaryEmailAddress?.emailAddress || "Employee",
          phone: user?.primaryEmailAddress?.emailAddress || userName,
          locationId: locations[0].id,
          bypass: true,
          ...(type === "OUT" ? { action: "OUT" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); }
      else if (type === "IN") { toast.success("Punched in! 🎯"); setTodayRecord(data.record); }
      else { toast.success(`Punched out! ${data.record?.workHours?.toFixed(1) || 0}h worked 💪`); setTodayRecord(null); }
    } catch { toast.error("Network error"); }
    setPunching(false);
  };

  // Only broker view if API explicitly says so AND Clerk confirms BROKER role
  const isBroker = data?.isBroker === true && (data?.userRole === "BROKER" || userRole === "BROKER");
  // If API returned an error object instead of real data, treat as no data
  const hasValidData = data && !data.error && data.overview !== undefined;
  const overview      = hasValidData ? (data?.overview ?? {}) : {};
  const overdueCount  = hasValidData ? (data?.overdueCount ?? 0) : 0;
  const leadSourceStats = hasValidData ? (data?.leadSourceStats ?? []) : [];
  const employeeScores  = hasValidData ? (data?.employeeScores ?? []) : [];
  const sourceData  = (hasValidData ? (data?.leadsBySource ?? []) : []).map((s: { source: string; _count: { id: number } }) => ({
    name:  SOURCE_LABEL[s.source] ?? s.source.replace(/_/g, " "),
    value: s._count.id,
    color: SOURCE_COLORS[s.source] ?? "#94a3b8",
  }));
  const hotLeads      = hasValidData ? (data?.recentLeads ?? []) : [];
  const todayVisits   = hasValidData ? (data?.todayVisits ?? []) : [];
  const todayFollowUps = hasValidData ? (data?.todayFollowUps ?? []) : [];
  const brokerPerf  = (hasValidData ? (data?.brokerPerformance ?? []) : []).map((b: { name: string; leads: number; deals: number; commission: number }) => ({
    ...b,
    revenue: fmtMoney(b.commission || 0),
    pct: Math.min(100, Math.round((b.deals / 12) * 100)),
  }));

  const stats = isBroker ? [
    // Broker sees only their assigned leads & visits
    { label: "My Leads",      value: overview.totalLeads    ?? 0, icon: Users,       grad: "from-blue-600 to-blue-400",      href: "/leads" },
    { label: "Hot Leads",     value: overview.hotLeads      ?? 0, icon: AlertCircle, grad: "from-red-600 to-red-400",        href: "/leads" },
    { label: "Deals Closed",  value: overview.dealsClosedCount ?? 0, icon: GitBranch, grad: "from-emerald-600 to-emerald-400", href: "/deals" },
    { label: "Visits Today",  value: todayVisits.length,          icon: Calendar,    grad: "from-orange-600 to-orange-400",  href: "/visits" },
  ] : [
    { label: "Total Leads",       value: overview.totalLeads       ?? 0,  icon: Users,       grad: "from-blue-600 to-blue-400",    href: "/leads" },
    { label: "Active Properties", value: overview.activeProperties ?? 0, icon: Building2,   grad: "from-yellow-600 to-yellow-400", href: "/properties" },
    { label: "Deals Closed",      value: overview.dealsClosedCount ?? 0,  icon: GitBranch,   grad: "from-emerald-600 to-emerald-400", href: "/deals" },
    { label: "Revenue",           value: overview.totalRevenue ? fmtMoney(overview.totalRevenue) : "₹0", icon: DollarSign, grad: "from-purple-600 to-purple-400", href: "/reports" },
    { label: "Visits Today",      value: todayVisits.length,              icon: Calendar,    grad: "from-orange-600 to-orange-400", href: "/visits" },
    { label: "Hot Leads",         value: overview.hotLeads         ?? 0,  icon: AlertCircle, grad: "from-red-600 to-red-400",       href: "/leads" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 relative">

      {/* Watermark Background Logo */}
      <style>{`
        @keyframes wm-float { 0%,100%{transform:translate(-50%,-50%) scale(1)} 50%{transform:translate(-50%,-52%) scale(1.03)} }
        @keyframes wm-pulse { 0%,100%{opacity:0.07} 50%{opacity:0.13} }
        .wm-logo { animation: wm-float 6s ease-in-out infinite, wm-pulse 6s ease-in-out infinite; }
      `}</style>
      <div className="pointer-events-none select-none fixed overflow-hidden" style={{ inset: 0, zIndex: 0 }}>
        <div className="wm-logo absolute" style={{ left: "50%", top: "50%", width: 260, height: 260, borderRadius: 40, overflow: "hidden", background: "#fff", boxShadow: "0 0 120px rgba(234,179,8,0.08)" }}>
          <img src="/logo.jpeg" alt="" style={{ width: "100%", height: "100%", objectFit: "contain", padding: 20 }} />
        </div>
      </div>

      {/* Welcome Splash */}
      {showSplash && userName && (
        <WelcomeSplash
          name={userName}
          role={userRole}
          avatar={user?.imageUrl || ""}
          onDone={handleSplashDone}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-xl overflow-hidden bg-white border border-yellow-500/20 flex-shrink-0">
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain p-0.5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">{greeting}! 👋</h1>
            <p className="text-xs text-muted-foreground">
              <span className="text-yellow-400 font-semibold">City Real Space</span> &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium"
          style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}>
          <Zap className="w-3 h-3" /> AI Active
        </div>
      </div>

      {/* API Error Banner — debug */}
      {!isLoading && (swrError || (data?.error)) && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" }}>
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400 font-medium">
            Dashboard load error: {swrError?.message || data?.error || "Unknown error"}
          </p>
          <button onClick={() => window.location.reload()}
            className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-300 border border-red-500/30">
            Retry
          </button>
        </div>
      )}

      {/* 🔴 Overdue Follow-up Banner */}
      {overdueCount > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl"
          style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)" }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(239,68,68,0.2)" }}>
            <AlertCircle className="w-4 h-4 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-400">
              ⚠️ {overdueCount} Overdue Follow-up{overdueCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">These tasks are past due — action required immediately</p>
          </div>
          <a href="/leads" className="text-xs px-3 py-1.5 rounded-lg font-semibold transition-all"
            style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.4)", color: "#fca5a5" }}>
            View Leads →
          </a>
        </motion.div>
      )}

      {/* Stats */}
      {isLoading ? <StatsSkeleton /> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map((s, i) => (
            <Link key={s.label} href={s.href}>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }} className="stat-card group cursor-pointer hover:border-yellow-500/30 hover:bg-white/5 transition-all">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.grad} flex items-center justify-center mb-3`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">{s.label} <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" /></div>
              </motion.div>
            </Link>
          ))}
        </div>
      )}

      {/* Employee: Next Follow-up Hero Card */}
      {isBroker && !isLoading && todayFollowUps.length > 0 && (() => {
        const next = todayFollowUps[0] as any;
        const leadName  = next?.lead?.name  || "your lead";
        const leadPhone = next?.lead?.phone || "";
        const dueTime   = new Date(next?.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" });
        const isOverdue = new Date(next?.dueAt) < new Date();
        const hr        = new Date(next?.dueAt).getHours();
        const suggestions = [
          `Start by recapping ${leadName}'s requirement — ask: "Is your requirement still the same?"`,
          `Morning calls have a 40% higher connect rate. Reach ${leadName} before noon.`,
          `If ${leadName} doesn't answer, send a short WhatsApp voice note instead of text.`,
          `Mention a new property match for ${leadName} to re-spark their interest.`,
          `Keep it under 3 minutes — ${leadName} is more likely to stay engaged on a short call.`,
        ];
        const suggestion = suggestions[new Date().getMinutes() % suggestions.length];
        return (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: "linear-gradient(135deg, rgba(234,179,8,0.12) 0%, rgba(14,165,233,0.08) 100%)", border: "1px solid rgba(234,179,8,0.3)" }}>
            <div className="p-5">
              {/* Label */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5"
                  style={{ background: isOverdue ? "rgba(239,68,68,0.2)" : "rgba(234,179,8,0.2)", color: isOverdue ? "#fca5a5" : "#fde047", border: isOverdue ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(234,179,8,0.3)" }}>
                  <Clock className="w-3 h-3" />
                  {isOverdue ? "Overdue Follow-up" : "Your Next Follow-up"}
                </span>
                <span className="text-xs text-muted-foreground">{isOverdue ? "Was due at" : "Due at"} {dueTime}</span>
              </div>

              {/* Main content */}
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-bold text-white flex-shrink-0"
                  style={{ background: "linear-gradient(135deg,#1e3a5f,#0f2744)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  {leadName[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-lg font-bold text-white">{leadName}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">{next?.title}</p>
                  {leadPhone && (
                    <p className="text-xs mt-1" style={{ color: "#94a3b8" }}>{leadPhone}</p>
                  )}
                </div>
                {/* Quick action buttons */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {leadPhone && (
                    <a href={`tel:${leadPhone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.35)", color: "#6ee7b7" }}>
                      <Users className="w-3.5 h-3.5" /> Call Now
                    </a>
                  )}
                  {leadPhone && (
                    <a href={`https://wa.me/91${leadPhone.replace(/\D/g,"").slice(-10)}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-all"
                      style={{ background: "rgba(37,211,102,0.15)", border: "1px solid rgba(37,211,102,0.3)", color: "#86efac" }}>
                      <Calendar className="w-3.5 h-3.5" /> WhatsApp
                    </a>
                  )}
                </div>
              </div>

              {/* AI Suggestion */}
              <div className="mt-4 p-3 rounded-xl flex items-start gap-2.5"
                style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(234,179,8,0.15)" }}>
                <Zap className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed" style={{ color: "#e2e8f0" }}>
                  <span className="text-yellow-400 font-semibold">AI Tip: </span>
                  {suggestion}
                </p>
              </div>

              {/* Remaining follow-ups count */}
              {todayFollowUps.length > 1 && (
                <Link href="/leads" className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors">
                  +{todayFollowUps.length - 1} more follow-up{todayFollowUps.length - 1 > 1 ? "s" : ""} today
                  <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </motion.div>
        );
      })()}

      {/* Attendance Widget */}
      {attLoaded && (
        <div className="glass-card p-4 flex items-center gap-4 flex-wrap">
          <Link href="/attendance" className="flex items-center gap-2 hover:text-estate-300 transition-colors">
            <Clock className="w-5 h-5 text-estate-400" />
            <span className="font-semibold text-white text-sm">Today's Attendance</span>
          </Link>
          {todayRecord ? (
            <>
              <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 animate-pulse">
                ● In Office since {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
              </span>
              <button onClick={() => handlePunch("OUT")} disabled={punching}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50 ml-auto">
                {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} Punch Out
              </button>
            </>
          ) : (
            <>
              <span className="text-xs text-muted-foreground">Not punched in yet</span>
              <button onClick={() => handlePunch("IN")} disabled={punching}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50 ml-auto">
                {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />} Punch In
              </button>
            </>
          )}
        </div>
      )}

      {/* Charts Row — admin only */}
      {!isBroker && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Lead Sources */}
          <div className="glass-card p-5 lg:col-span-2">
          <style>{`
            @keyframes db-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
            @keyframes db-spin-rev { from{transform:rotate(0deg)} to{transform:rotate(-360deg)} }
            .db-outer { animation: db-spin 18s linear infinite; transform-box: fill-box; transform-origin: center; }
            .db-inner { animation: db-spin-rev 25s linear infinite; transform-box: fill-box; transform-origin: center; }
          `}</style>
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Lead Sources</h3>
            {!isLoading && sourceData.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {sourceData.reduce((s: number, d: {value: number}) => s + d.value, 0)} total leads
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-center justify-center h-52">
              <div className="w-40 h-40 rounded-full animate-pulse bg-white/10" />
            </div>
          ) : sourceData.length > 0 ? (
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              {/* SVG Donut */}
              <div className="relative flex-shrink-0 mx-auto" style={{ width: 180, height: 180 }}>
                <svg viewBox="0 0 220 220" width="180" height="180" style={{ position: "absolute", top: 0, left: 0 }}>
                  {/* Outer spinning dashed arc */}
                  <g className="db-outer">
                    <circle cx="110" cy="110" r="107" fill="none" stroke="#0ea5e9" strokeWidth="4"
                      strokeDasharray="60 30" strokeLinecap="round" opacity="0.7" />
                    <circle cx="110" cy="110" r="107" fill="none" stroke="#f59e0b" strokeWidth="4"
                      strokeDasharray="25 65" strokeDashoffset="-100" strokeLinecap="round" opacity="0.5" />
                    <circle cx="110" cy="110" r="107" fill="none" stroke="#ec4899" strokeWidth="4"
                      strokeDasharray="15 75" strokeDashoffset="-160" strokeLinecap="round" opacity="0.4" />
                  </g>
                  {/* Inner counter-spin arc */}
                  <g className="db-inner">
                    <circle cx="110" cy="110" r="50" fill="none" stroke="#6366f1" strokeWidth="2.5"
                      strokeDasharray="35 279" strokeLinecap="round" opacity="0.5" />
                    <circle cx="110" cy="110" r="50" fill="none" stroke="#10b981" strokeWidth="2.5"
                      strokeDasharray="18 296" strokeDashoffset="-100" strokeLinecap="round" opacity="0.4" />
                  </g>
                  {/* Donut segments */}
                  {(() => {
                    const total = sourceData.reduce((a: number, d: any) => a + d.value, 0);
                    const cx = 110, cy = 110, r = 80, ir = 55;
                    let angle = -90;
                    return sourceData.map((s: any, i: number) => {
                      const sweep = (s.value / total) * 360;
                      const a1 = (angle * Math.PI) / 180;
                      const a2 = ((angle + sweep) * Math.PI) / 180;
                      const x1o = cx + r  * Math.cos(a1), y1o = cy + r  * Math.sin(a1);
                      const x2o = cx + r  * Math.cos(a2), y2o = cy + r  * Math.sin(a2);
                      const x1i = cx + ir * Math.cos(a2), y1i = cy + ir * Math.sin(a2);
                      const x2i = cx + ir * Math.cos(a1), y2i = cy + ir * Math.sin(a1);
                      const large = sweep > 180 ? 1 : 0;
                      const d = `M${x1o},${y1o} A${r},${r} 0 ${large},1 ${x2o},${y2o} L${x1i},${y1i} A${ir},${ir} 0 ${large},0 ${x2i},${y2i} Z`;
                      angle += sweep;
                      return <path key={i} d={d} fill={s.color} opacity="0.92" />;
                    });
                  })()}
                  {/* Center text */}
                  <text x="110" y="104" textAnchor="middle" fill="white" fontSize="32" fontWeight="bold">
                    {sourceData.reduce((s: number, d: any) => s + d.value, 0)}
                  </text>
                  <text x="110" y="122" textAnchor="middle" fill="#64748b" fontSize="12">Total Leads</text>
                </svg>
              </div>
              {/* Legend */}
              <div className="flex-1 space-y-2 min-w-0">
                {sourceData.map((s: any) => {
                  const total = sourceData.reduce((a: number, d: any) => a + d.value, 0);
                  const pct   = total > 0 ? Math.round((s.value / total) * 100) : 0;
                  return (
                    <div key={s.name}>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                        <span className="text-xs text-white truncate flex-1 font-medium">{s.name}</span>
                        <span className="text-xs font-bold text-white flex-shrink-0">{s.value}</span>
                        <span className="text-xs text-muted-foreground flex-shrink-0 w-8 text-right">{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-white/10 ml-4">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                          transition={{ duration: 1, delay: 0.2 }}
                          className="h-1 rounded-full" style={{ background: s.color }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No leads yet</div>
          )}
        </div>

        {/* Today's Visits */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">Today&apos;s Visits</h3>
            <span className="text-xs px-2 py-0.5 rounded-full text-orange-400"
              style={{ background: "rgba(249,115,22,0.15)", border: "1px solid rgba(249,115,22,0.25)" }}>
              {todayVisits.length} scheduled
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : todayVisits.length > 0 ? (
            <div className="space-y-2">
              {todayVisits.map((v: { id: string; scheduledAt: string; lead?: { name: string }; property?: { title: string }; broker?: { name: string } }) => (
                <Link key={v.id} href={`/visits?id=${v.id}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                  style={{ background: "rgba(30,58,95,0.3)", border: "1px solid rgba(234,179,8,0.08)" }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1f35)" }}>
                    {v.lead?.name?.[0] ?? "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{v.lead?.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{v.property?.title ?? "Property"}</div>
                  </div>
                  <div className="text-xs font-bold text-yellow-400 flex-shrink-0">
                    {new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No visits today</div>
          )}
        </div>
        </div>
      )}

      {/* Lead Source ROI + Employee Performance Score — admin only */}
      {!isBroker && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Lead Source Conversion Rate */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">📊 Lead Source ROI</h3>
              <span className="text-xs text-muted-foreground">Conversion rate by source</span>
            </div>
            {isLoading ? (
              <div className="space-y-3">{Array(4).fill(0).map((_,i) => <div key={i} className="h-8 animate-pulse bg-white/10 rounded" />)}</div>
            ) : leadSourceStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
            ) : (
              <div className="space-y-3">
                {leadSourceStats.slice(0,8).map((s: any) => (
                  <div key={s.source}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white font-medium">{SOURCE_LABEL[s.source] ?? s.source.replace(/_/g," ")}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{s.closed}/{s.total}</span>
                        <span className={`text-xs font-bold ${
                          s.rate >= 20 ? "text-emerald-400" : s.rate >= 10 ? "text-yellow-400" : "text-red-400"
                        }`}>{s.rate}%</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(s.rate, 2)}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-1.5 rounded-full"
                        style={{ background: s.rate >= 20 ? "#10b981" : s.rate >= 10 ? "#eab308" : "#ef4444" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Employee Performance Score */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white">🏆 Employee Scores</h3>
              <span className="text-xs text-muted-foreground">Last 7 days activity</span>
            </div>
            {isLoading ? (
              <div className="space-y-3">{Array(4).fill(0).map((_,i) => <div key={i} className="h-12 animate-pulse bg-white/10 rounded" />)}</div>
            ) : employeeScores.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No employees yet</p>
            ) : (
              <div className="space-y-3">
                {employeeScores.map((e: any, i: number) => (
                  <a key={e.id} href={`/admin-employees/${e.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-white/5 cursor-pointer"
                    style={{ border: "1px solid rgba(255,255,255,0.06)" }}>
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                      style={{ background: i === 0 ? "linear-gradient(135deg,#ca8a04,#eab308)" : i === 1 ? "linear-gradient(135deg,#475569,#94a3b8)" : "linear-gradient(135deg,#92400e,#d97706)" }}>
                      {i < 3 ? ["🥇","🥈","🥉"][i] : e.name[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white">{e.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.leads} leads · {e.deals} deals · {e.visits} visits · {e.calls} calls
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className={`text-lg font-bold ${
                        e.score >= 80 ? "text-emerald-400" : e.score >= 50 ? "text-yellow-400" : "text-red-400"
                      }`}>{e.score}</div>
                      <div className="text-xs text-muted-foreground">score</div>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hot Leads + Broker Performance + Follow-ups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Hot Leads */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">🔥 Hot Leads</h3>
            <a href="/leads" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
              View all <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : hotLeads.length > 0 ? (
            <div className="space-y-3">
              {hotLeads.map((lead: { id: string; name: string; score: number; budget?: number; source?: string; requirements?: string }) => (
                <Link key={lead.id} href={`/leads?id=${lead.id}`}
                  className="flex items-center gap-3 p-3 rounded-xl cursor-pointer"
                  style={{ background: "rgba(30,58,95,0.25)", border: "1px solid rgba(234,179,8,0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1f35)" }}>
                    {lead.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{lead.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{lead.requirements || "—"}</div>
                    {lead.budget && lead.budget > 0 && fmtMoney(lead.budget) && (
                      <span className="text-xs text-yellow-400 font-semibold">{fmtMoney(lead.budget)}</span>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${lead.score >= 80 ? "text-red-400 bg-red-500/15 border-red-500/25" : "text-orange-400 bg-orange-500/15 border-orange-500/25"}`}>
                    {lead.score >= 80 ? "🔥 HOT" : "🌡️ WARM"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No hot leads yet</div>
          )}
        </div>

        {/* Broker Performance — admin only */}
        {!isBroker && (
          <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Broker Performance</h3>
            <a href="/reports" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
              Full Report <ArrowUpRight className="w-3 h-3" />
            </a>
          </div>
          {isLoading ? (
            <div className="space-y-4">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-10" />)}</div>
          ) : brokerPerf.length > 0 ? (
            <div className="space-y-4">
              {brokerPerf.map((b: { name: string; deals: number; leads: number; revenue: string; pct: number }, i: number) => (
                <Link key={b.name} href="/reports" className="flex items-center gap-3 cursor-pointer">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)" }}>
                    {b.name[0]}
                  </div>
                  <div className="w-20 flex-shrink-0">
                    <div className="text-sm font-medium text-white">{b.name.split(" ")[0]}</div>
                    <div className="text-xs text-muted-foreground">{b.deals} deals</div>
                  </div>
                  <div className="flex-1 score-bar">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${b.pct}%` }}
                      transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                      className="score-fill"
                      style={{ background: b.pct >= 80 ? "#10b981" : b.pct >= 60 ? "#eab308" : "#3b82f6" }} />
                  </div>
                  <div className="text-sm font-bold text-yellow-400 flex-shrink-0">{b.revenue}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No broker data yet</div>
          )}
          </div>
        )}

        {/* Today's Follow-ups — Admin only */}
        {!isBroker && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">📋 All Follow-ups</h3>
            <span className="text-xs px-2 py-0.5 rounded-full text-purple-400"
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
              {todayFollowUps.length} due
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : todayFollowUps.length > 0 ? (
            <div className="space-y-2">
              {todayFollowUps.map((t: { id: string; title: string; dueAt: string; priority: string; assignedTo?: { name: string }; lead?: { id: string; name: string; phone: string } }) => (
                <Link key={t.id} href={t.lead?.id ? `/leads?id=${t.lead.id}` : "/leads"}
                  className="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer"
                  style={{ background: "rgba(30,58,95,0.3)", border: "1px solid rgba(168,85,247,0.1)" }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.priority === "HIGH" || t.priority === "URGENT" ? "bg-red-400" :
                    t.priority === "MEDIUM" ? "bg-yellow-400" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {t.lead?.name}
                      {t.assignedTo && <span className="ml-1 text-blue-400">→ {t.assignedTo.name}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-purple-400 flex-shrink-0 font-medium">
                    {new Date(t.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })}
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No follow-ups due today 🎉</div>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
