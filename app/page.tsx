"use client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Zap, Globe, Shield, Bot, BarChart3,
  Building2, TrendingUp, Users, Star, Check, Phone, Mail, MapPin, PlayCircle,
} from "lucide-react";

function Counter({ to, suffix = "+" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => {
      let step = 0;
      const id = setInterval(() => {
        step++;
        setCount(Math.floor((1 - Math.pow(1 - step / 80, 4)) * to));
        if (step >= 80) { setCount(to); clearInterval(id); }
      }, 2000 / 80);
      return () => clearInterval(id);
    }, 600);
    return () => clearTimeout(t);
  }, [to]);
  return <>{count.toLocaleString()}{suffix}</>;
}

const STATS = [
  { label: "Properties Listed", value: 100, suffix: "+", icon: Building2,  color: "#eab308" },
  { label: "Deals Closed",      value: 250, suffix: "+", icon: TrendingUp, color: "#10b981" },
  { label: "Happy Clients",     value: 500, suffix: "+", icon: Users,      color: "#6366f1" },
  { label: "Years Experience",  value: 25,  suffix: "+", icon: Star,       color: "#f59e0b" },
];

const FEATURES = [
  { icon: "🤖", title: "AI Lead Scoring",     desc: "Auto-score leads by budget, urgency & intent",        border: "#eab308" },
  { icon: "🏠", title: "Auto Property Match", desc: "Instantly match buyers to perfect properties using AI", border: "#6366f1" },
  { icon: "💬", title: "WhatsApp Automation", desc: "Auto follow-ups, reminders & bulk campaigns",          border: "#10b981" },
  { icon: "📊", title: "Deal Pipeline",       desc: "Visual kanban from first enquiry to deal close",       border: "#f59e0b" },
  { icon: "💰", title: "Commission Tracker",  desc: "Auto-calculate & generate commission invoices",         border: "#ec4899" },
  { icon: "📈", title: "Smart Reports",       desc: "Real-time broker performance & revenue analytics",     border: "#14b8a6" },
];



const STEPS = [
  { step: "01", title: "Add Your Leads", desc: "Import from Excel, web forms, or add manually. AI auto-scores each lead instantly.", color: "#eab308" },
  { step: "02", title: "Match & Follow Up", desc: "AI matches leads to properties. WhatsApp reminders sent automatically.", color: "#6366f1" },
  { step: "03", title: "Close & Track", desc: "Move deals through pipeline, generate commission invoices, track revenue.", color: "#10b981" },
];

const PLANS = [
  {
    name: "Starter", price: "₹4,999", period: "/month", desc: "Solo brokers",
    features: ["100 leads", "5 properties", "WhatsApp automation", "Basic reports", "Email support"],
    popular: false,
  },
  {
    name: "Professional", price: "₹12,999", period: "/month", desc: "Growing brokerages",
    features: ["Unlimited leads", "Unlimited properties", "AI lead scoring", "Deal pipeline", "Commission tracker", "Advanced analytics", "Priority support"],
    popular: true,
  },
  {
    name: "Enterprise", price: "Custom", period: "", desc: "Large teams & agencies",
    features: ["Everything in Pro", "Multi-branch support", "Custom integrations", "Dedicated manager", "SLA guarantee"],
    popular: false,
  },
];

export default function HomePage() {
  return (
    <div style={{ background: "#050508", color: "#e2e8f0", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 90% 60% at 50% -5%, rgba(234,179,8,0.13) 0%, transparent 55%)" }} />
        <div style={{ position: "absolute", top: "30%", left: "-10%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(99,102,241,0.06) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", top: "60%", right: "-10%", width: "50%", height: "50%", background: "radial-gradient(ellipse, rgba(16,185,129,0.05) 0%, transparent 70%)", filter: "blur(40px)" }} />
        <div style={{ position: "absolute", inset: 0, opacity: 0.018, backgroundImage: "linear-gradient(rgba(234,179,8,0.8) 1px, transparent 1px), linear-gradient(90deg, rgba(234,179,8,0.8) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* ── Navbar ── */}
      <nav style={{ position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 24px", borderBottom: "1px solid rgba(234,179,8,0.08)", background: "rgba(5,5,8,0.85)", backdropFilter: "blur(20px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.5)", boxShadow: "0 0 14px rgba(234,179,8,0.2)", position: "relative", flexShrink: 0 }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 2 }} />
          </div>
          <div>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 14, lineHeight: 1 }}>City Real Space</div>
            <div style={{ fontSize: 11, color: "#eab308", marginTop: 2 }}>AI-Powered CRM</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <a href="tel:+919825031247"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", textDecoration: "none" }}
            className="hidden md:flex">
            <Phone className="w-3.5 h-3.5" /> +91 98250 31247
          </a>
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#eab308", textDecoration: "none" }}
            className="hidden md:flex">
            <Globe className="w-3.5 h-3.5" /> cityrealspace.com
          </a>
          <Link href="/sign-in"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none" }}>
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "80px 24px 60px" }}>

        {/* Logo */}
        <motion.div initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, type: "spring", bounce: 0.3 }}
          style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
          <div style={{ position: "relative" }}>
            <motion.div animate={{ scale: [1, 1.6, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2.5, repeat: Infinity }}
              style={{ position: "absolute", inset: -10, borderRadius: 24, border: "1px solid rgba(234,179,8,0.4)" }} />
            <div style={{ position: "absolute", inset: 0, borderRadius: 24, background: "rgba(234,179,8,0.15)", filter: "blur(24px)", transform: "scale(1.4)" }} />
            <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              style={{ position: "relative", width: 110, height: 110, borderRadius: 24, overflow: "hidden", background: "#fff", border: "2px solid rgba(234,179,8,0.6)", boxShadow: "0 0 40px rgba(234,179,8,0.25)" }}>
              <Image src="/logo.jpeg" alt="City Real Space" fill sizes="110px" className="object-contain" style={{ padding: 10 }} priority />
            </motion.div>
          </div>
        </motion.div>

        {/* Badge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 16px", borderRadius: 999, fontSize: 13, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308", marginBottom: 20 }}>
          <Zap className="w-4 h-4" /> AI-Powered Real Estate CRM · Ahmedabad
        </motion.div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45, duration: 0.7 }}
          style={{ fontSize: "clamp(36px, 7vw, 72px)", fontWeight: 800, lineHeight: 1.1, marginBottom: 16, letterSpacing: "-0.02em" }}>
          <span style={{ color: "#ffffff" }}>City Real Space</span>
          <br />
          <span style={{ background: "linear-gradient(135deg,#ca8a04,#eab308,#fde047)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
            CRM Platform
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          style={{ fontSize: "clamp(15px, 2vw, 18px)", color: "#94a3b8", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.7 }}>
          The most automation-driven CRM built for{" "}
          <span style={{ color: "#eab308", fontWeight: 600 }}>Ahmedabad real estate brokers</span>.
          AI matching, WhatsApp automation & smart deal tracking.
        </motion.p>

        {/* CTAs */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.75 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", marginBottom: 64 }}>
          <Link href="/sign-in"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 16, fontSize: 15, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308,#fde047)", color: "#050508", textDecoration: "none", boxShadow: "0 0 28px rgba(234,179,8,0.35)" }}>
            Open CRM Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
          <Link href="/demo"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 16, fontSize: 15, fontWeight: 600, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308", textDecoration: "none" }}>
            <PlayCircle className="w-5 h-5" /> Watch Demo
          </Link>
          <Link href="/free-trial"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", borderRadius: 16, fontSize: 15, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none" }}>
            Start Free Trial
          </Link>
        </motion.div>

        {/* Stats */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, maxWidth: 700, margin: "0 auto" }}>
          {STATS.map((s, i) => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 + i * 0.1 }}
              style={{ padding: "20px 16px", borderRadius: 16, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.1)", textAlign: "center" }}>
              <s.icon style={{ width: 18, height: 18, color: s.color, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 28, fontWeight: 800, color: s.color, lineHeight: 1 }}>
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Ticker Strip ── */}
      <style>{`
        @keyframes ticker-ltr {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes ticker-rtl {
          0%   { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }
        .ticker-ltr { animation: ticker-ltr 80s linear infinite; }
        .ticker-rtl { animation: ticker-rtl 70s linear infinite; }
        .ticker-ltr:hover, .ticker-rtl:hover { animation-play-state: paused; }
      `}</style>
      <section style={{ position: "relative", zIndex: 10, overflow: "hidden", padding: "20px 0", borderTop: "1px solid rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.08)", background: "rgba(234,179,8,0.02)" }}>
        {/* Row 1 — Left to Right */}
        <div style={{ overflow: "hidden", marginBottom: 10 }}>
          <div className="ticker-ltr" style={{ display: "flex", width: "max-content", gap: 0 }}>
            {[
              "🤖 AI Lead Scoring","💬 WhatsApp Automation","🏠 Property Matching","📊 Deal Pipeline",
              "💰 Commission Tracker","📈 Smart Reports","📍 Ahmedabad Real Estate","🔑 Buyer & Seller Mgmt",
              "🏗️ Commercial Properties","🤝 Broker Dashboard","⚡ GPT-4o Powered","🔒 Bank-grade Security",
              "🏢 Residential Listings","📞 Auto Follow-ups","🗺️ Location Insights","📅 Meeting Scheduler",
              "🧠 Smart Matching AI","📋 Site Visit Tracker","💼 Lead Management","🔔 Instant Alerts",
              "📱 Mobile Ready","🌐 Online Presence","🏷️ Price Negotiation","🎯 Target Marketing",
              // duplicate for seamless loop
              "🤖 AI Lead Scoring","💬 WhatsApp Automation","🏠 Property Matching","📊 Deal Pipeline",
              "💰 Commission Tracker","📈 Smart Reports","📍 Ahmedabad Real Estate","🔑 Buyer & Seller Mgmt",
              "🏗️ Commercial Properties","🤝 Broker Dashboard","⚡ GPT-4o Powered","🔒 Bank-grade Security",
              "🏢 Residential Listings","📞 Auto Follow-ups","🗺️ Location Insights","📅 Meeting Scheduler",
              "🧠 Smart Matching AI","📋 Site Visit Tracker","💼 Lead Management","🔔 Instant Alerts",
              "📱 Mobile Ready","🌐 Online Presence","🏷️ Price Negotiation","🎯 Target Marketing",
            ].map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 18px", fontSize: 13, fontWeight: 500, color: "#eab308", whiteSpace: "nowrap" }}>
                {item}
                <span style={{ color: "rgba(234,179,8,0.35)", marginLeft: 6, fontSize: 10 }}>✦</span>
              </span>
            ))}
          </div>
        </div>
        {/* Row 2 — Right to Left */}
        <div style={{ overflow: "hidden" }}>
          <div className="ticker-rtl" style={{ display: "flex", width: "max-content", gap: 0 }}>
            {[
              "🏢 Residential Listings","📞 Auto Follow-ups","🗺️ Location Insights","📅 Meeting Scheduler",
              "🧠 Smart Matching AI","📋 Site Visit Tracker","💼 Lead Management","🔔 Instant Alerts",
              "📱 Mobile Ready","🌐 Online Presence","🏷️ Price Negotiation","🎯 Target Marketing",
              "🤖 AI Lead Scoring","💬 WhatsApp Automation","🏠 Property Matching","📊 Deal Pipeline",
              "💰 Commission Tracker","📈 Smart Reports","📍 Ahmedabad Real Estate","🔑 Buyer & Seller Mgmt",
              "🏗️ Commercial Properties","🤝 Broker Dashboard","⚡ GPT-4o Powered","🔒 Bank-grade Security",
              // duplicate
              "🏢 Residential Listings","📞 Auto Follow-ups","🗺️ Location Insights","📅 Meeting Scheduler",
              "🧠 Smart Matching AI","📋 Site Visit Tracker","💼 Lead Management","🔔 Instant Alerts",
              "📱 Mobile Ready","🌐 Online Presence","🏷️ Price Negotiation","🎯 Target Marketing",
              "🤖 AI Lead Scoring","💬 WhatsApp Automation","🏠 Property Matching","📊 Deal Pipeline",
              "💰 Commission Tracker","📈 Smart Reports","📍 Ahmedabad Real Estate","🔑 Buyer & Seller Mgmt",
              "🏗️ Commercial Properties","🤝 Broker Dashboard","⚡ GPT-4o Powered","🔒 Bank-grade Security",
            ].map((item, i) => (
              <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 18px", fontSize: 13, fontWeight: 500, color: "#94a3b8", whiteSpace: "nowrap" }}>
                {item}
                <span style={{ color: "rgba(148,163,184,0.3)", marginLeft: 6, fontSize: 10 }}>✦</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Trust badges ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "0 24px 40px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: Shield, label: "Bank-grade Security" },
            { icon: Bot,    label: "GPT-4o Powered" },
            { icon: BarChart3, label: "Real-time Analytics" },
          ].map((t) => (
            <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", fontSize: 13, color: "#cbd5e1" }}>
              <t.icon style={{ width: 14, height: 14, color: "#eab308" }} /> {t.label}
            </div>
          ))}
        </div>
      </section>

      {/* ── How It Works ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "60px 24px", maxWidth: 900, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", color: "#818cf8", marginBottom: 14 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#ffffff", marginBottom: 10 }}>Close More Deals in 3 Steps</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {STEPS.map((s, i) => (
            <motion.div key={s.step} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ padding: "28px 24px", borderRadius: 20, background: "rgba(255,255,255,0.02)", border: `1px solid ${s.color}22`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 16, right: 20, fontSize: 48, fontWeight: 900, color: `${s.color}08`, lineHeight: 1 }}>{s.step}</div>
              <div style={{ fontSize: 36, fontWeight: 900, color: s.color, marginBottom: 12, lineHeight: 1 }}>{s.step}</div>
              <h3 style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 16, marginBottom: 8 }}>{s.title}</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "60px 24px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#eab308", marginBottom: 14 }}>
            FEATURES
          </div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#ffffff", marginBottom: 10 }}>Everything to Dominate</h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>Built for commercial & residential brokers in Ahmedabad</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {FEATURES.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}
              whileHover={{ y: -4, borderColor: `${f.border}55` }}
              style={{ padding: "24px", borderRadius: 20, background: "rgba(255,255,255,0.02)", border: `1px solid ${f.border}22`, cursor: "default", transition: "border-color 0.2s" }}>
              <div style={{ width: 52, height: 52, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, background: `${f.border}12`, border: `1px solid ${f.border}30`, marginBottom: 16 }}>
                {f.icon}
              </div>
              <h3 style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "60px 24px", maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#eab308", marginBottom: 14 }}>
            PRICING
          </div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 36px)", fontWeight: 800, color: "#ffffff", marginBottom: 10 }}>Simple, Transparent Pricing</h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>No hidden fees. Cancel anytime.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20 }}>
          {PLANS.map((plan, i) => (
            <motion.div key={plan.name} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              style={{ position: "relative", padding: "28px 24px", borderRadius: 24, display: "flex", flexDirection: "column", background: plan.popular ? "rgba(234,179,8,0.04)" : "rgba(255,255,255,0.02)", border: plan.popular ? "1px solid rgba(234,179,8,0.35)" : "1px solid rgba(255,255,255,0.07)", boxShadow: plan.popular ? "0 0 40px rgba(234,179,8,0.08)" : "none" }}>
              {plan.popular && (
                <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", padding: "4px 16px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", whiteSpace: "nowrap" }}>
                  Most Popular
                </div>
              )}
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>{plan.name}</h3>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 16 }}>{plan.desc}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 36, fontWeight: 800, color: plan.popular ? "#eab308" : "#fff", lineHeight: 1 }}>{plan.price}</span>
                  <span style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{plan.period}</span>
                </div>
              </div>
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#94a3b8" }}>
                    <Check style={{ width: 15, height: 15, flexShrink: 0, color: plan.popular ? "#eab308" : "#475569" }} /> {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === "Enterprise" ? "/free-trial" : "/free-trial"}
                style={{ display: "block", textAlign: "center", padding: "12px", borderRadius: 14, fontSize: 14, fontWeight: 600, textDecoration: "none", ...(plan.popular ? { background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", boxShadow: "0 0 20px rgba(234,179,8,0.25)" } : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }) }}>
                {plan.name === "Enterprise" ? "Contact Us" : "Start Free Trial"}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "60px 24px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          style={{ maxWidth: 600, margin: "0 auto", padding: "48px 32px", borderRadius: 28, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.15)", boxShadow: "0 0 60px rgba(234,179,8,0.05)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(234,179,8,0.07) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ width: 60, height: 60, borderRadius: 16, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.4)", margin: "0 auto 20px", position: "relative", boxShadow: "0 0 20px rgba(234,179,8,0.2)" }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 4 }} />
          </div>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: "#fff", marginBottom: 8 }}>City Real Space</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 28 }}>Ahmedabad&apos;s most trusted real estate brokerage</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap", marginBottom: 28, fontSize: 13 }}>
            <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "#eab308", textDecoration: "none" }}><Globe className="w-4 h-4" /> cityrealspace.com</a>
            <a href="mailto:info@cityrealspace.com" style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none" }}><Mail className="w-4 h-4" /> info@cityrealspace.com</a>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b" }}><MapPin className="w-4 h-4" /> Ahmedabad, Gujarat</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
            <Link href="/sign-in"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 14, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none", boxShadow: "0 0 24px rgba(234,179,8,0.3)" }}>
              Open CRM <ArrowRight className="w-4 h-4" />
            </Link>
            <Link href="/free-trial"
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "13px 26px", borderRadius: 14, fontSize: 14, fontWeight: 600, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none" }}>
              <Phone className="w-4 h-4" /> Contact Us
            </Link>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 10, padding: "24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 }}>
          <div style={{ width: 26, height: 26, borderRadius: 8, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.3)", position: "relative", flexShrink: 0 }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 2 }} />
          </div>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 13 }}>City Real Space</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" style={{ color: "#475569", textDecoration: "none" }}>cityrealspace.com</a>
          <span>·</span>
          <a href="mailto:info@cityrealspace.com" style={{ color: "#475569", textDecoration: "none" }}>info@cityrealspace.com</a>
          <span>·</span>
          <span>Ahmedabad, Gujarat, India</span>
        </div>
        {/* SEO keyword footer — visible to Google, subtle to users */}
        <p style={{ fontSize: 11, color: "#1e293b", marginTop: 16, maxWidth: 700, margin: "16px auto 0", lineHeight: 1.8 }}>
          Real Estate CRM Ahmedabad · Property Broker Software Gujarat · AI Lead Management ·
          WhatsApp Automation Real Estate · Deal Pipeline Software · Commission Tracker Broker ·
          Best CRM for Real Estate Agents India · Commercial Property Software Ahmedabad ·
          Residential Property CRM · City Real Space CRM Platform
        </p>
        <p style={{ fontSize: 11, color: "#334155", marginTop: 10 }}>© 2026 City Real Space. All rights reserved.</p>
      </footer>
    </div>
  );
}
