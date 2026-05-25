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

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SOURCE_COLORS: Record<string, string> = {
  WHATSAPP:        "#10b981",
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
  WHATSAPP:        "WhatsApp",
  ACRES99:         "99acres",
  MAGICBRICKS:     "MagicBricks",
  WEBSITE:         "CityRealSpace",
  REFERRAL:        "Referral",
  FACEBOOK:        "Facebook",
  WALK_IN:         "Walk In",
  COLD_CALL:       "Cold Call",
  HOUSING:         "Housing.com",
  GOOGLE_BUSINESS: "Google",
  OTHER:           "Other",
};

const fmtMoney = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : `₹${(n / 1000).toFixed(0)}K`;

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

  const { data, isLoading } = useSWR("/api/dashboard", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 min cache
    revalidateOnReconnect: false,
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

  const overview    = data?.overview ?? {};
  const sourceData  = (data?.leadsBySource ?? []).map((s: { source: string; _count: { id: number } }) => ({
    name:  SOURCE_LABEL[s.source] ?? s.source.replace(/_/g, " "),
    value: s._count.id,
    color: SOURCE_COLORS[s.source] ?? "#94a3b8",
  }));
  const hotLeads      = data?.recentLeads ?? [];
  const todayVisits   = data?.todayVisits ?? [];
  const todayFollowUps = data?.todayFollowUps ?? [];
  const brokerPerf  = (data?.brokerPerformance ?? []).map((b: { name: string; leads: number; deals: number; commission: number }) => ({
    ...b,
    revenue: fmtMoney(b.commission || 0),
    pct: Math.min(100, Math.round((b.deals / 12) * 100)),
  }));

  const stats = [
    { label: "Total Leads",       value: overview.totalLeads       ?? 0,  icon: Users,       grad: "from-blue-600 to-blue-400",    href: "/leads" },
    { label: "Active Properties", value: overview.activeProperties ?? "—", icon: Building2,   grad: "from-yellow-600 to-yellow-400", href: "/properties" },
    { label: "Deals Closed",      value: overview.dealsClosedCount ?? 0,  icon: GitBranch,   grad: "from-emerald-600 to-emerald-400", href: "/deals" },
    { label: "Revenue",           value: overview.totalRevenue ? fmtMoney(overview.totalRevenue) : "₹0", icon: DollarSign, grad: "from-purple-600 to-purple-400", href: "/reports" },
    { label: "Visits Today",      value: todayVisits.length,              icon: Calendar,    grad: "from-orange-600 to-orange-400", href: "/visits" },
    { label: "Hot Leads",         value: overview.hotLeads         ?? 0,  icon: AlertCircle, grad: "from-red-600 to-red-400",       href: "/leads" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5">

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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Lead Sources */}
        <div className="glass-card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-white">Lead Sources</h3>
            {!isLoading && sourceData.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {sourceData.reduce((s: number, d: {value: number}) => s + d.value, 0)} total leads
              </span>
            )}
          </div>
          {isLoading ? (
            <div className="flex items-end gap-3 h-40">
              {Array(5).fill(0).map((_, i) => (
                <div key={i} className="flex-1 rounded-t-xl animate-pulse bg-white/10" style={{ height: `${30 + i * 15}%` }} />
              ))}
            </div>
          ) : sourceData.length > 0 ? (() => {
            const max    = Math.max(...sourceData.map((d: {value: number}) => d.value));
            const total  = sourceData.reduce((s: number, d: {value: number}) => s + d.value, 0);
            const sorted = [...sourceData].sort((a: {value: number}, b: {value: number}) => b.value - a.value);
            return (
              <div className="space-y-4">
                <div className="flex items-end gap-2 h-40">
                  {sorted.map((s: { name: string; color: string; value: number }, i: number) => {
                    const pct = max > 0 ? (s.value / max) * 100 : 0;
                    return (
                      <div key={s.name} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
                        <span className="text-xs font-bold text-white">{s.value}</span>
                        {/* Bottle container */}
                        <div className="w-full rounded-xl overflow-hidden relative" style={{ height: "85%", background: "rgba(255,255,255,0.04)", border: `1px solid ${s.color}30` }}>
                          {/* Liquid fill */}
                          <motion.div
                            className="absolute bottom-0 left-0 right-0"
                            initial={{ height: "0%" }}
                            animate={{ height: `${pct}%` }}
                            transition={{ delay: 0.2 + i * 0.12, duration: 1.2, ease: [0.34, 1.1, 0.64, 1] }}
                            style={{ background: `linear-gradient(180deg, ${s.color}cc 0%, ${s.color} 100%)` }}
                          >
                            {/* Wave SVG on top of liquid */}
                            <motion.div
                              className="absolute -top-3 left-0 right-0 h-4 overflow-hidden"
                              animate={{ x: ["-25%", "0%", "-25%"] }}
                              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                            >
                              <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="w-[200%] h-full">
                                <path
                                  d="M0,6 C20,0 40,12 60,6 C80,0 100,12 120,6 C140,0 160,12 180,6 C200,0 220,12 240,6 L240,12 L0,12 Z"
                                  fill={s.color}
                                />
                              </svg>
                            </motion.div>
                            {/* Shine */}
                            <div className="absolute inset-0 opacity-20" style={{ background: "linear-gradient(90deg, transparent 0%, white 40%, transparent 60%)" }} />
                          </motion.div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* Labels */}
                <div className="flex gap-2">
                  {sorted.map((s: { name: string; color: string; value: number }) => (
                    <div key={s.name} className="flex-1 text-center">
                      <div className="text-center" style={{ fontSize: "9px", color: "#64748b", lineHeight: 1.3 }}>
                        {s.name}
                      </div>
                      <div className="text-xs font-medium mt-0.5" style={{ color: s.color }}>
                        {total > 0 ? Math.round((s.value / total) * 100) : 0}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })() : (
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
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
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
                  className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                  style={{ background: "rgba(30,58,95,0.25)", border: "1px solid rgba(234,179,8,0.06)" }}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                    style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1f35)" }}>
                    {lead.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{lead.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{lead.requirements || "—"}</div>
                    {lead.budget && <span className="text-xs text-yellow-400 font-semibold">{fmtMoney(lead.budget)}</span>}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full border font-semibold flex-shrink-0 ${lead.score >= 85 ? "text-red-400 bg-red-500/15 border-red-500/25" : "text-orange-400 bg-orange-500/15 border-orange-500/25"}`}>
                    {lead.score >= 85 ? "🔥 HOT" : "🌡️ WARM"}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No hot leads yet</div>
          )}
        </div>

        {/* Broker Performance */}
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
                <div key={b.name} className="flex items-center gap-3">
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
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No broker data yet</div>
          )}
        </div>

        {/* Today's Follow-ups */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">📋 Today&apos;s Follow-ups</h3>
            <span className="text-xs px-2 py-0.5 rounded-full text-purple-400"
              style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.25)" }}>
              {todayFollowUps.length} due
            </span>
          </div>
          {isLoading ? (
            <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : todayFollowUps.length > 0 ? (
            <div className="space-y-2">
              {todayFollowUps.map((t: { id: string; title: string; dueAt: string; priority: string; lead?: { id: string; name: string; phone: string } }) => (
                <a key={t.id} href={`/leads`}
                  className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-white/5"
                  style={{ background: "rgba(30,58,95,0.3)", border: "1px solid rgba(168,85,247,0.1)" }}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    t.priority === "HIGH" || t.priority === "URGENT" ? "bg-red-400" :
                    t.priority === "MEDIUM" ? "bg-yellow-400" : "bg-blue-400"
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{t.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{t.lead?.name}</div>
                  </div>
                  <div className="text-xs text-purple-400 flex-shrink-0 font-medium">
                    {new Date(t.dueAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">No follow-ups due today 🎉</div>
          )}
        </div>
      </div>
    </div>
  );
}
