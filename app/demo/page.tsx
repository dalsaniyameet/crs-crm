"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import {
  LayoutDashboard, Users, Building2, TrendingUp, Calendar, DollarSign,
  Bell, Search, ArrowUpRight, ArrowDownRight, Star, MapPin,
  MessageSquare, Plus, Filter, MoreHorizontal, Zap, Bot, BarChart3,
  X, Settings, Menu, ChevronRight,
} from "lucide-react";

const STATS = [
  { label: "Active Leads",       value: "47",      change: "+12%", up: true,  icon: Users,      color: "#6366f1" },
  { label: "Properties Listed",  value: "23",      change: "+3",   up: true,  icon: Building2,  color: "#10b981" },
  { label: "Revenue This Month", value: "₹8.4 Cr", change: "+18%", up: true,  icon: DollarSign, color: "#f59e0b" },
  { label: "Deals Closed",       value: "6",       change: "-1",   up: false, icon: TrendingUp, color: "#ec4899" },
];

const LEADS = [
  { id: 1, name: "Rajesh Patel",   phone: "+91 98765 43210", budget: "₹85L",   type: "2BHK Flat",   area: "Bopal",         score: 92, status: "Hot"  },
  { id: 2, name: "Priya Shah",     phone: "+91 87654 32109", budget: "₹1.2Cr", type: "3BHK Flat",   area: "Prahlad Nagar", score: 78, status: "Warm" },
  { id: 3, name: "Amit Desai",     phone: "+91 76543 21098", budget: "₹2.5Cr", type: "Commercial",  area: "SG Highway",    score: 85, status: "Hot"  },
  { id: 4, name: "Neha Mehta",     phone: "+91 65432 10987", budget: "₹60L",   type: "1BHK Flat",   area: "Satellite",     score: 45, status: "Cold" },
  { id: 5, name: "Vikram Joshi",   phone: "+91 54321 09876", budget: "₹3.8Cr", type: "Bungalow",    area: "Shilaj",        score: 88, status: "Hot"  },
  { id: 6, name: "Sunita Agarwal", phone: "+91 43210 98765", budget: "₹95L",   type: "2BHK Flat",   area: "Thaltej",       score: 62, status: "Warm" },
];

const PROPERTIES = [
  { id: 1, title: "Luxe 3BHK — Prahlad Nagar",  price: "₹1.45 Cr", area: "1,850 sqft", status: "Available", img: "🏢" },
  { id: 2, title: "Commercial Shop — SG Highway", price: "₹2.8 Cr",  area: "950 sqft",  status: "Available", img: "🏬" },
  { id: 3, title: "2BHK — Bopal Township",        price: "₹78 L",    area: "1,100 sqft", status: "Booked",   img: "🏠" },
  { id: 4, title: "Penthouse — Satellite",         price: "₹3.2 Cr",  area: "3,200 sqft", status: "Available",img: "🏙️" },
];

const PIPELINE = [
  { stage: "New Enquiry", count: 24, color: "#6366f1", amount: "₹18.4 Cr" },
  { stage: "Site Visit",  count: 12, color: "#10b981", amount: "₹9.2 Cr"  },
  { stage: "Negotiation", count: 7,  color: "#f59e0b", amount: "₹5.6 Cr"  },
  { stage: "Deal Closed", count: 4,  color: "#22c55e", amount: "₹3.1 Cr"  },
];

const ACTIVITY = [
  { icon: "🔥", text: "Rajesh Patel — AI score jumped to 92",              time: "2 min ago"  },
  { icon: "🏠", text: "New property added: Penthouse Satellite",            time: "18 min ago" },
  { icon: "💬", text: "WhatsApp sent to 14 leads (Bopal campaign)",         time: "1 hr ago"   },
  { icon: "✅", text: "Deal closed — Amit Desai ₹2.5 Cr",                  time: "3 hr ago"   },
  { icon: "📅", text: "Site visit scheduled — Priya Shah, Prahlad Nagar",  time: "5 hr ago"   },
];

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",    active: true  },
  { icon: Users,           label: "Leads",        active: false },
  { icon: Building2,       label: "Properties",   active: false },
  { icon: TrendingUp,      label: "Deals",        active: false },
  { icon: Calendar,        label: "Visits",       active: false },
  { icon: DollarSign,      label: "Commissions",  active: false },
  { icon: BarChart3,       label: "Reports",      active: false },
  { icon: Bot,             label: "AI Assistant", active: false },
  { icon: Settings,        label: "Settings",     active: false },
];

export default function DemoPage() {
  const [banner, setBanner] = useState(true);

  return (
    <div className="min-h-screen flex" style={{ background: "#0a0a0f", color: "#e2e8f0", fontFamily: "Inter,sans-serif" }}>

      {/* Demo Banner */}
      <AnimatePresence>
        {banner && (
          <motion.div
            initial={{ y: -50 }} animate={{ y: 0 }} exit={{ y: -50 }}
            className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-2 text-sm font-medium"
            style={{ background: "linear-gradient(90deg,#6366f1,#10b981)", color: "#fff" }}>
            <div className="flex items-center gap-2 flex-wrap">
              <Zap className="w-4 h-4 shrink-0" />
              <span>🎯 DEMO MODE — Fake data only. Real CRM needs login.</span>
              <Link href="/sign-in" className="underline font-bold">Get Access →</Link>
            </div>
            <button onClick={() => setBanner(false)} className="shrink-0 ml-2"><X className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r"
        style={{ background: "#0d0d14", borderColor: "rgba(99,102,241,0.12)", paddingTop: banner ? 40 : 0, transition: "padding .3s" }}>
        <div className="flex items-center gap-3 px-5 py-5 border-b" style={{ borderColor: "rgba(99,102,241,0.1)" }}>
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-white shrink-0" style={{ border: "1px solid rgba(16,185,129,0.4)" }}>
            <Image src="/logo.jpeg" alt="CRS" width={36} height={36} className="object-contain p-0.5" />
          </div>
          <div>
            <div className="text-white font-bold text-sm leading-none">City Real Space</div>
            <div className="text-xs mt-0.5" style={{ color: "#10b981" }}>CRM Platform</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV.map((n) => (
            <button key={n.label} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
              style={n.active
                ? { background: "rgba(99,102,241,0.15)", color: "#a5b4fc", borderLeft: "2px solid #6366f1" }
                : { color: "#64748b" }}>
              <n.icon className="w-4 h-4 shrink-0" />{n.label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t" style={{ borderColor: "rgba(99,102,241,0.1)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
              style={{ background: "linear-gradient(135deg,#6366f1,#10b981)" }}>M</div>
            <div className="min-w-0">
              <div className="text-white text-xs font-semibold truncate">Meet Dalsaniya</div>
              <div className="text-xs" style={{ color: "#10b981" }}>Admin · Demo</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0" style={{ paddingTop: banner ? 40 : 0, transition: "padding .3s" }}>

        {/* Topbar */}
        <header className="flex items-center justify-between px-4 md:px-6 py-3 border-b sticky top-0 z-30"
          style={{ background: "rgba(13,13,20,0.95)", backdropFilter: "blur(20px)", borderColor: "rgba(99,102,241,0.1)" }}>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 text-xs hidden sm:block">Search leads, properties…</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Bell className="w-5 h-5 text-slate-400" />
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold"
                style={{ background: "#ef4444", color: "#fff" }}>3</span>
            </div>
            <Link href="/sign-in"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
              style={{ background: "linear-gradient(135deg,#6366f1,#10b981)", color: "#fff" }}>
              Get Real Access <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-4 md:px-6 py-6 space-y-6">

          <div>
            <h1 className="text-xl font-bold text-white">Dashboard</h1>
            <p className="text-xs mt-0.5" style={{ color: "#64748b" }}>Wednesday, 15 Jan 2025 · Ahmedabad</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {STATS.map((s, i) => (
              <motion.div key={s.label}
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="p-4 rounded-2xl"
                style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${s.color}20` }}>
                    <s.icon className="w-4 h-4" style={{ color: s.color }} />
                  </div>
                  <span className={`text-xs flex items-center gap-0.5 ${s.up ? "text-emerald-400" : "text-red-400"}`}>
                    {s.up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                    {s.change}
                  </span>
                </div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "#64748b" }}>{s.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Pipeline + Activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-5 rounded-2xl"
              style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white text-sm">Deal Pipeline</h2>
                <span className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(99,102,241,0.1)", color: "#a5b4fc" }}>This Month</span>
              </div>
              <div className="space-y-3">
                {PIPELINE.map((p) => (
                  <div key={p.stage}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span style={{ color: "#94a3b8" }}>{p.stage}</span>
                      <div className="flex items-center gap-3">
                        <span style={{ color: "#64748b" }}>{p.amount}</span>
                        <span className="font-semibold text-white">{p.count} leads</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${(p.count / 24) * 100}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className="h-full rounded-full" style={{ background: p.color }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-2xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(16,185,129,0.1)" }}>
              <h2 className="font-semibold text-white text-sm mb-4">Live Activity</h2>
              <div className="space-y-3">
                {ACTIVITY.map((a, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                    className="flex items-start gap-2.5">
                    <span className="text-base mt-0.5">{a.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-snug">{a.text}</p>
                      <p className="text-xs mt-0.5" style={{ color: "#475569" }}>{a.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Leads Table */}
          <div className="rounded-2xl overflow-hidden" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
              <h2 className="font-semibold text-white text-sm">Recent Leads</h2>
              <div className="flex items-center gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.04)", color: "#94a3b8" }}>
                  <Filter className="w-3 h-3" /> Filter
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold" style={{ background: "rgba(99,102,241,0.15)", color: "#a5b4fc" }}>
                  <Plus className="w-3 h-3" /> Add Lead
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {["Name", "Budget", "Requirement", "Area", "AI Score", "Status", ""].map(h => (
                      <th key={h} className="text-left px-5 py-3 font-medium" style={{ color: "#475569" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {LEADS.map((l, i) => (
                    <motion.tr key={l.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                      className="border-b transition-colors cursor-pointer"
                      style={{ borderColor: "rgba(255,255,255,0.03)" }}>
                      <td className="px-5 py-3">
                        <div className="font-medium text-white">{l.name}</div>
                        <div style={{ color: "#475569" }}>{l.phone}</div>
                      </td>
                      <td className="px-5 py-3 font-semibold" style={{ color: "#10b981" }}>{l.budget}</td>
                      <td className="px-5 py-3" style={{ color: "#94a3b8" }}>{l.type}</td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1" style={{ color: "#94a3b8" }}>
                          <MapPin className="w-3 h-3" />{l.area}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                            <div className="h-full rounded-full" style={{
                              width: `${l.score}%`,
                              background: l.score >= 80 ? "#10b981" : l.score >= 60 ? "#f59e0b" : "#ef4444"
                            }} />
                          </div>
                          <span className="font-semibold" style={{ color: l.score >= 80 ? "#10b981" : l.score >= 60 ? "#f59e0b" : "#ef4444" }}>{l.score}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                          background: l.status === "Hot" ? "rgba(239,68,68,0.15)" : l.status === "Warm" ? "rgba(245,158,11,0.15)" : "rgba(100,116,139,0.15)",
                          color: l.status === "Hot" ? "#f87171" : l.status === "Warm" ? "#fbbf24" : "#94a3b8"
                        }}>{l.status}</span>
                      </td>
                      <td className="px-5 py-3"><MoreHorizontal className="w-4 h-4" style={{ color: "#475569" }} /></td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Properties */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-white text-sm">Featured Properties</h2>
              <button className="text-xs flex items-center gap-1" style={{ color: "#6366f1" }}>View all <ChevronRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {PROPERTIES.map((p, i) => (
                <motion.div key={p.id}
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                  className="p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform"
                  style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="w-full h-24 rounded-xl flex items-center justify-center text-4xl mb-3"
                    style={{ background: "rgba(99,102,241,0.08)" }}>{p.img}</div>
                  <div className="text-xs font-semibold text-white leading-snug mb-1">{p.title}</div>
                  <div className="text-sm font-bold mb-2" style={{ color: "#10b981" }}>{p.price}</div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs" style={{ color: "#475569" }}>{p.area}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: p.status === "Available" ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
                      color: p.status === "Available" ? "#10b981" : "#f59e0b"
                    }}>{p.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Bottom CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
            className="p-6 rounded-2xl text-center relative overflow-hidden"
            style={{ background: "linear-gradient(135deg,rgba(99,102,241,0.15),rgba(16,185,129,0.1))", border: "1px solid rgba(99,102,241,0.2)" }}>
            <div className="absolute inset-0 pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 0%,rgba(99,102,241,0.1) 0%,transparent 60%)" }} />
            <h3 className="text-lg font-bold text-white mb-1">Ready to use the real CRM?</h3>
            <p className="text-sm mb-4" style={{ color: "#94a3b8" }}>This was just a demo. Get full access with your real data.</p>
            <Link href="/sign-in"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-sm"
              style={{ background: "linear-gradient(135deg,#6366f1,#10b981)", color: "#fff", boxShadow: "0 0 24px rgba(99,102,241,0.3)" }}>
              Get Full Access <ArrowUpRight className="w-4 h-4" />
            </Link>
          </motion.div>

        </main>
      </div>
    </div>
  );
}
