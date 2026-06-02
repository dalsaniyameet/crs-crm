"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import {
  Users, Shield, Building2, DollarSign, BarChart2,
  Settings, UserCheck, Clock, FileText, Megaphone,
  ChevronRight, Loader2, CheckCircle, XCircle,
  TrendingUp, AlertTriangle, RefreshCw, GitBranch,
} from "lucide-react";

const ROLE_COLORS: Record<string, string> = {
  ADMIN:         "bg-red-500/20 text-red-400 border-red-500/30",
  BROKER:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SALES_MANAGER: "bg-green-500/20 text-green-400 border-green-500/30",
  MARKETING:     "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const ROLES = ["ADMIN", "BROKER", "SALES_MANAGER", "MARKETING"];

const fmtMoney = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
  : `₹${(n / 1000).toFixed(0)}K`;

export default function AdminPanelPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const myRole = ((user?.publicMetadata?.role as string) || "").toUpperCase();

  useEffect(() => {
    if (isLoaded && myRole !== "ADMIN") router.replace("/dashboard");
  }, [isLoaded, myRole, router]);

  const [users, setUsers]       = useState<any[]>([]);
  const [stats, setStats]       = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "live" | "system">("overview");
  const [liveUsers, setLiveUsers]   = useState<any[]>([]);
  const [todayUsers, setTodayUsers]  = useState<any[]>([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [sourceData, setSourceData] = useState<any[]>([]);

  async function fetchLive() {
    setLiveLoading(true);
    try {
      const res  = await fetch("/api/admin/active-users");
      const data = await res.json();
      setLiveUsers(Array.isArray(data.live)  ? data.live  : []);
      setTodayUsers(Array.isArray(data.today) ? data.today : []);
    } catch {}
    setLiveLoading(false);
  }

  useEffect(() => {
    if (activeTab === "live") {
      fetchLive();
      const interval = setInterval(fetchLive, 30_000); // refresh every 30s
      return () => clearInterval(interval);
    }
  }, [activeTab]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/users").then(r => r.json()).catch(() => []),
      fetch("/api/reports").then(r => r.json()).catch(() => ({})),
      fetch("/api/dashboard").then(r => r.json()).catch(() => ({})),
    ]).then(([u, r, dash]) => {
      setUsers(Array.isArray(u) ? u : []);
      setStats(r);
      const SOURCE_COLORS: Record<string, string> = {
        WHATSAPP: "#25d366", ACRES99: "#eab308", MAGICBRICKS: "#f97316",
        WEBSITE: "#0ea5e9", REFERRAL: "#ec4899", FACEBOOK: "#6366f1",
        WALK_IN: "#a855f7", COLD_CALL: "#64748b", HOUSING: "#06b6d4",
        GOOGLE_BUSINESS: "#ef4444", OTHER: "#94a3b8",
      };
      const SOURCE_LABEL: Record<string, string> = {
        WHATSAPP: "WhatsApp", ACRES99: "99acres", MAGICBRICKS: "MagicBricks",
        WEBSITE: "Website", REFERRAL: "Referral", FACEBOOK: "Facebook",
        WALK_IN: "Walk In", COLD_CALL: "Cold Call", HOUSING: "Housing.com",
        GOOGLE_BUSINESS: "Google", OTHER: "Other",
      };
      setSourceData((dash?.leadsBySource ?? []).map((s: any) => ({
        name: SOURCE_LABEL[s.source] ?? s.source.replace(/_/g, " "),
        value: s._count.id,
        color: SOURCE_COLORS[s.source] ?? "#94a3b8",
      })));
      setLoading(false);
    });
  }, []);

  async function changeRole(clerkId: string, role: string) {
    setUpdating(clerkId);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerkId, role }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.clerkId === clerkId ? { ...u, role } : u));
      toast.success("Role updated!");
    } else {
      toast.error("Failed to update role");
    }
    setUpdating(null);
  }

  async function toggleUser(clerkId: string, isActive: boolean) {
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerkId, isActive: !isActive }),
    });
    if (res.ok) {
      setUsers(prev => prev.map(u => u.clerkId === clerkId ? { ...u, isActive: !isActive } : u));
      toast.success(isActive ? "User deactivated" : "User activated");
    }
  }

  const overview = stats?.overview ?? {};
  const brokers  = stats?.brokerPerformance ?? [];

  const quickLinks = [
    { label: "Leads",       href: "/leads",       icon: Users,      color: "from-blue-600 to-blue-400",    count: overview.totalLeads ?? "—" },
    { label: "Properties",  href: "/properties",  icon: Building2,  color: "from-yellow-600 to-yellow-400", count: overview.activeProperties ?? "—" },
    { label: "Deals",       href: "/deals",       icon: GitBranch,  color: "from-emerald-600 to-emerald-400", count: overview.dealsClosedCount ?? "—" },
    { label: "Revenue",     href: "/commissions", icon: DollarSign, color: "from-purple-600 to-purple-400", count: overview.totalRevenue ? fmtMoney(overview.totalRevenue) : "₹0" },
    { label: "Reports",     href: "/reports",     icon: BarChart2,  color: "from-orange-600 to-orange-400", count: "View" },
    { label: "Employees",   href: "/admin-employees", icon: UserCheck, color: "from-pink-600 to-pink-400", count: users.length },
    { label: "Attendance",  href: "/attendance",  icon: Clock,      color: "from-teal-600 to-teal-400",    count: "Track" },
    { label: "Marketing",   href: "/marketing",   icon: Megaphone,  color: "from-red-600 to-red-400",      count: "Campaigns" },
    { label: "Agreements",  href: "/agreements",  icon: FileText,   color: "from-indigo-600 to-indigo-400", count: "Docs" },
    { label: "Settings",    href: "/settings",    icon: Settings,   color: "from-slate-600 to-slate-400",  count: "Config" },
  ];

  const roleCount = ROLES.reduce((acc, r) => {
    acc[r] = users.filter(u => u.role === r).length;
    return acc;
  }, {} as Record<string, number>);

  if (!isLoaded || (isLoaded && myRole !== "ADMIN")) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin text-estate-400" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="w-6 h-6 text-red-400" /> Admin Panel
          </h1>
          <p className="text-sm text-muted-foreground mt-1">City Real Space · Full Control</p>
        </div>
        <button onClick={() => { setLoading(true); Promise.all([fetch("/api/admin/users").then(r=>r.json()), fetch("/api/reports").then(r=>r.json()), fetch("/api/dashboard").then(r=>r.json())]).then(([u,r,dash])=>{ setUsers(Array.isArray(u)?u:[]); setStats(r); const SC: Record<string,string>={WHATSAPP:"#25d366",ACRES99:"#eab308",MAGICBRICKS:"#f97316",WEBSITE:"#0ea5e9",REFERRAL:"#ec4899",FACEBOOK:"#6366f1",WALK_IN:"#a855f7",COLD_CALL:"#64748b",HOUSING:"#06b6d4",GOOGLE_BUSINESS:"#ef4444",OTHER:"#94a3b8"}; const SL: Record<string,string>={WHATSAPP:"WhatsApp",ACRES99:"99acres",MAGICBRICKS:"MagicBricks",WEBSITE:"Website",REFERRAL:"Referral",FACEBOOK:"Facebook",WALK_IN:"Walk In",COLD_CALL:"Cold Call",HOUSING:"Housing.com",GOOGLE_BUSINESS:"Google",OTHER:"Other"}; setSourceData((dash?.leadsBySource??[]).map((s:any)=>({name:SL[s.source]??s.source.replace(/_/g," "),value:s._count.id,color:SC[s.source]??"#94a3b8"}))); setLoading(false); }); }}
          className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        {(["overview", "users", "live", "system"] as const).map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${
              activeTab === t ? "bg-red-500/20 border border-red-500/30 text-red-300" : "text-muted-foreground hover:text-white"
            }`}>
            {t === "live" ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Live
                {liveUsers.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">{liveUsers.length}</span>
                )}
              </span>
            ) : t}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Total Users",    value: users.length,                                    color: "from-blue-600 to-blue-400",    icon: Users },
              { label: "Total Leads",    value: overview.totalLeads ?? "—",                      color: "from-yellow-600 to-yellow-400", icon: TrendingUp },
              { label: "Deals Closed",   value: overview.dealsClosedCount ?? "—",                color: "from-emerald-600 to-emerald-400", icon: CheckCircle },
              { label: "Revenue",        value: overview.totalRevenue ? fmtMoney(overview.totalRevenue) : "₹0", color: "from-purple-600 to-purple-400", icon: DollarSign },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="stat-card">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                  <s.icon className="w-4 h-4 text-white" />
                </div>
                <div className="text-2xl font-bold text-white">{loading ? "—" : s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Role breakdown */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-white mb-4">Team by Role</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ROLES.map(r => (
                <div key={r} className={`p-3 rounded-xl border ${ROLE_COLORS[r]}`}>
                  <div className="text-2xl font-bold">{loading ? "—" : roleCount[r] ?? 0}</div>
                  <div className="text-xs mt-0.5 opacity-80">{r.replace("_", " ")}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="glass-card p-5">
            <h3 className="font-semibold text-white mb-4">Quick Access</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {quickLinks.map((l, i) => (
                <motion.a key={l.label} href={l.href}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex flex-col items-center gap-2 p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all group">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${l.color} flex items-center justify-center`}>
                    <l.icon className="w-5 h-5 text-white" />
                  </div>
                  <span className="text-xs font-medium text-white">{l.label}</span>
                  <span className="text-xs text-muted-foreground">{l.count}</span>
                </motion.a>
              ))}
            </div>
          </div>

          {/* Lead Sources Donut */}
          {sourceData.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="font-semibold text-white mb-5">Lead Sources</h3>
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="relative flex-shrink-0" style={{ width: 160, height: 160 }}>
                  <svg viewBox="0 0 220 220" width="160" height="160">
                    {(() => {
                      const total = sourceData.reduce((a: number, d: any) => a + d.value, 0);
                      const cx = 110, cy = 110, r = 80, ir = 55;
                      let angle = -90;
                      return sourceData.map((s: any, i: number) => {
                        const sweep = (s.value / total) * 360;
                        const a1 = (angle * Math.PI) / 180;
                        const a2 = ((angle + sweep) * Math.PI) / 180;
                        const x1o = cx + r * Math.cos(a1), y1o = cy + r * Math.sin(a1);
                        const x2o = cx + r * Math.cos(a2), y2o = cy + r * Math.sin(a2);
                        const x1i = cx + ir * Math.cos(a2), y1i = cy + ir * Math.sin(a2);
                        const x2i = cx + ir * Math.cos(a1), y2i = cy + ir * Math.sin(a1);
                        const large = sweep > 180 ? 1 : 0;
                        const d = `M${x1o},${y1o} A${r},${r} 0 ${large},1 ${x2o},${y2o} L${x1i},${y1i} A${ir},${ir} 0 ${large},0 ${x2i},${y2i} Z`;
                        angle += sweep;
                        return <path key={i} d={d} fill={s.color} opacity="0.92" />;
                      });
                    })()}
                    <text x="110" y="104" textAnchor="middle" fill="white" fontSize="30" fontWeight="bold">
                      {sourceData.reduce((s: number, d: any) => s + d.value, 0)}
                    </text>
                    <text x="110" y="122" textAnchor="middle" fill="#64748b" fontSize="11">Total Leads</text>
                  </svg>
                </div>
                <div className="flex-1 space-y-2 min-w-0">
                  {sourceData.map((s: any) => {
                    const total = sourceData.reduce((a: number, d: any) => a + d.value, 0);
                    const pct = total > 0 ? Math.round((s.value / total) * 100) : 0;
                    return (
                      <div key={s.name}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: s.color }} />
                          <span className="text-xs text-white truncate flex-1">{s.name}</span>
                          <span className="text-xs font-bold text-white">{s.value}</span>
                          <span className="text-xs text-muted-foreground w-8 text-right">{pct}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/10 ml-4">
                          <div className="h-1 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Broker Performance */}
          {brokers.length > 0 && (
            <div className="glass-card p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">Broker Performance</h3>
                <a href="/reports" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
                  Full Report <ChevronRight className="w-3 h-3" />
                </a>
              </div>
              <div className="space-y-3">
                {brokers.map((b: any) => (
                  <div key={b.id} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-yellow-600 to-yellow-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                      {b.name[0]}
                    </div>
                    <div className="w-24 flex-shrink-0">
                      <div className="text-sm font-medium text-white truncate">{b.name.split(" ")[0]}</div>
                      <div className="text-xs text-muted-foreground">{b.deals} deals · {b.leads} leads</div>
                    </div>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <motion.div initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, b.leads > 0 ? (b.deals / b.leads) * 100 * 5 : 0)}%` }}
                        transition={{ duration: 0.8 }}
                        className="h-full rounded-full bg-gradient-to-r from-yellow-600 to-yellow-400" />
                    </div>
                    <div className="text-sm font-bold text-yellow-400 flex-shrink-0">{fmtMoney(b.commission)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-semibold text-white">All Users ({users.length})</h3>
            <a href="/admin-users" className="text-xs text-yellow-400 hover:text-yellow-300 flex items-center gap-1">
              Full User Management <ChevronRight className="w-3 h-3" />
            </a>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/5">
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Name</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Email</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Role</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Status</th>
                    <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Change Role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(u => (
                    <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {u.name?.[0] ?? "?"}
                          </div>
                          <span className="text-white font-medium">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{u.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${ROLE_COLORS[u.role] ?? "bg-white/10 text-white border-white/10"}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => toggleUser(u.clerkId, u.isActive)}
                          className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border transition-all ${
                            u.isActive
                              ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25 hover:bg-red-500/15 hover:text-red-400 hover:border-red-500/25"
                              : "bg-red-500/15 text-red-400 border-red-500/25 hover:bg-emerald-500/15 hover:text-emerald-400 hover:border-emerald-500/25"
                          }`}>
                          {u.isActive ? <><CheckCircle className="w-3 h-3" /> Active</> : <><XCircle className="w-3 h-3" /> Inactive</>}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <select value={u.role} disabled={updating === u.clerkId}
                          onChange={e => changeRole(u.clerkId, e.target.value)}
                          className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-white text-xs focus:outline-none focus:border-estate-500/50 disabled:opacity-50">
                          {ROLES.map(r => (
                            <option key={r} value={r} className="bg-[#0f1f35]">{r.replace("_", " ")}</option>
                          ))}
                        </select>
                        {updating === u.clerkId && <Loader2 className="w-3 h-3 animate-spin inline ml-2 text-yellow-400" />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── LIVE TAB ── */}
      {activeTab === "live" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-white flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                Live Activity
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Last 30 min · Auto-refresh every 30s</p>
            </div>
            <button onClick={fetchLive} disabled={liveLoading}
              className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all">
              <RefreshCw className={`w-4 h-4 ${liveLoading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Summary bar */}
          <div className="glass-card p-4 grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-emerald-400">{liveUsers.filter(u => u.isOnline).length}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex items-center justify-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Online now
              </div>
            </div>
            <div className="text-center border-x border-white/10">
              <div className="text-2xl font-bold text-yellow-400">{liveUsers.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Active (30 min)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{todayUsers.length}</div>
              <div className="text-xs text-muted-foreground mt-0.5">Logged in today</div>
            </div>
          </div>

          {/* Live cards — last 30 min */}
          {liveLoading && liveUsers.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          ) : liveUsers.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-white font-medium">No one active in last 30 minutes</p>
              <p className="text-xs text-muted-foreground mt-1">Users appear here when they open the CRM</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {liveUsers.map((u: any) => (
                <motion.div key={u.clerkId}
                  initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                  className={`glass-card p-4 border ${
                    u.isOnline ? "border-emerald-500/30 bg-emerald-500/5" : "border-yellow-500/20 bg-yellow-500/5"
                  }`}>
                  <div className="flex items-start gap-3">
                    <div className="relative flex-shrink-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-11 h-11 rounded-full object-cover border-2 border-white/10" />
                      ) : (
                        <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)" }}>
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#04080f] ${
                        u.isOnline ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">{u.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ROLE_COLORS[u.role] ?? "bg-white/10 text-white border-white/10"}`}>
                          {u.role?.replace("_"," ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      <p className={`text-xs font-semibold mt-1 ${
                        u.isOnline ? "text-emerald-400" : "text-yellow-400"
                      }`}>
                        {u.isOnline ? "🟢 Online now" : `🟡 ${u.minsAgo}m ago`}
                      </p>
                      {/* Open tabs */}
                      {u.tabs?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {u.tabs.map((tab: string, i: number) => {
                            const label = tab.replace(/^\//, "").replace(/-/g, " ").replace(/\//g, " › ") || "dashboard";
                            const isActive = tab === u.currentPage;
                            return (
                              <span key={i} className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                                isActive
                                  ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300"
                                  : "bg-white/5 border-white/10 text-muted-foreground"
                              }`}>
                                {isActive ? "🟢" : "⚪"} {label}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* All day activity */}
          {todayUsers.length > 0 && (
            <div className="glass-card overflow-hidden">
              <div className="px-4 py-3 border-b border-white/10 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-semibold text-white">Today's Full Activity</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">{todayUsers.length} users</span>
              </div>
              <div className="divide-y divide-white/5">
                {todayUsers.map((u: any) => (
                  <div key={u.clerkId} className="flex items-center gap-3 px-4 py-3">
                    <div className="relative flex-shrink-0">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
                          style={{ background: "linear-gradient(135deg,#1e3a5f,#0f1f35)" }}>
                          {u.name?.[0]?.toUpperCase()}
                        </div>
                      )}
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#04080f] ${
                        u.isOnline ? "bg-emerald-400" : "bg-gray-500"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{u.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${ROLE_COLORS[u.role] ?? "bg-white/10 text-white border-white/10"}`}>
                          {u.role?.replace("_"," ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className={`text-xs font-semibold ${
                        u.isOnline ? "text-emerald-400" : "text-muted-foreground"
                      }`}>
                        {u.isOnline ? "Online" : `${u.minsAgo}m ago`}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {u.currentPage?.replace(/^\//, "") || "dashboard"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SYSTEM TAB ── */}
      {activeTab === "system" && (
        <div className="space-y-4">
          <div className="glass-card p-5">
            <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" /> System Status
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { name: "Database (PostgreSQL)",  status: true,  note: "Connected" },
                { name: "Clerk Auth",             status: true,  note: "Active" },
                { name: "OpenAI GPT-4o",          status: true,  note: "API Key set" },
                { name: "Cloudinary Storage",     status: true,  note: "Connected" },
                { name: "Twilio WhatsApp",        status: true,  note: "Configured" },
                { name: "Google Calendar OAuth",  status: false, note: "Connect in Settings" },
                { name: "Gmail API",              status: false, note: "Not configured" },
              ].map(s => (
                <div key={s.name} className={`flex items-center justify-between p-3 rounded-xl border ${
                  s.status ? "bg-emerald-500/5 border-emerald-500/20" : "bg-red-500/5 border-red-500/20"
                }`}>
                  <div className="flex items-center gap-2">
                    {s.status
                      ? <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      : <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />}
                    <span className="text-sm text-white">{s.name}</span>
                  </div>
                  <span className={`text-xs ${s.status ? "text-emerald-400" : "text-red-400"}`}>{s.note}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <h3 className="font-semibold text-white mb-4">Quick Actions</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { label: "User Management",  href: "/admin-users",      icon: Users,    color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
                { label: "Employees",        href: "/admin-employees",  icon: UserCheck, color: "bg-green-500/20 text-green-400 border-green-500/30" },
                { label: "Reports",          href: "/reports",          icon: BarChart2, color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
                { label: "Commissions",      href: "/commissions",      icon: DollarSign, color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
                { label: "Attendance",       href: "/attendance",       icon: Clock,    color: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
                { label: "Settings",         href: "/settings",         icon: Settings, color: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
              ].map(a => (
                <a key={a.label} href={a.href}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all hover:scale-[1.02] ${a.color}`}>
                  <a.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm font-medium">{a.label}</span>
                  <ChevronRight className="w-3.5 h-3.5 ml-auto opacity-60" />
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


