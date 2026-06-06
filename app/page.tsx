"use client";
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight, Zap, Globe, Shield, Bot, BarChart3,
  Building2, TrendingUp, Users, Star, Check, Phone, Mail, MapPin,
  Sparkles, ChevronDown, Play,
} from "lucide-react";

/* ─── Animated Counter ─── */
function Counter({ to, suffix = "+" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      obs.disconnect();
      let step = 0;
      const id = setInterval(() => {
        step++;
        setCount(Math.floor((1 - Math.pow(1 - step / 60, 3)) * to));
        if (step >= 60) { setCount(to); clearInterval(id); }
      }, 1200 / 60);
    }, { threshold: 0.5 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [to]);
  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

/* ─── Floating Particle ─── */
function Particle({ x, y, size, delay, color }: { x: number; y: number; size: number; delay: number; color: string }) {
  return (
    <motion.div
      style={{ position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size, borderRadius: "50%", background: color, pointerEvents: "none" }}
      animate={{ y: [0, -30, 0], opacity: [0.2, 0.6, 0.2], scale: [1, 1.3, 1] }}
      transition={{ duration: 4 + Math.random() * 3, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

/* ─── Data ─── */
const STATS = [
  { label: "Properties Listed", value: 100, suffix: "+", icon: Building2,  color: "#eab308", bg: "rgba(234,179,8,0.1)" },
  { label: "Deals Closed",      value: 250, suffix: "+", icon: TrendingUp, color: "#10b981", bg: "rgba(16,185,129,0.1)" },
  { label: "Happy Clients",     value: 500, suffix: "+", icon: Users,      color: "#6366f1", bg: "rgba(99,102,241,0.1)" },
  { label: "Years Experience",  value: 25,  suffix: "+", icon: Star,       color: "#f59e0b", bg: "rgba(245,158,11,0.1)" },
];

const FEATURES = [
  { icon: "🤖", title: "AI Lead Scoring",     desc: "Auto-score leads by budget, urgency & intent using GPT-4o",    color: "#eab308" },
  { icon: "🏠", title: "Auto Property Match", desc: "Instantly match buyers to perfect properties using AI",        color: "#6366f1" },
  { icon: "💬", title: "WhatsApp Automation", desc: "Auto follow-ups, reminders & bulk campaigns",                  color: "#10b981" },
  { icon: "📊", title: "Deal Pipeline",       desc: "Visual kanban from first enquiry to deal close",               color: "#f59e0b" },
  { icon: "💰", title: "Commission Tracker",  desc: "Auto-calculate & generate commission invoices",                 color: "#ec4899" },
  { icon: "📈", title: "Smart Reports",       desc: "Real-time broker performance & revenue analytics",             color: "#14b8a6" },
];

const STEPS = [
  { step: "01", title: "Add Your Leads",    desc: "Import from Excel, web forms, or add manually. AI auto-scores each lead instantly.", color: "#eab308", icon: "📋" },
  { step: "02", title: "Match & Follow Up", desc: "AI matches leads to properties. WhatsApp reminders sent automatically.",            color: "#6366f1", icon: "🎯" },
  { step: "03", title: "Close & Track",     desc: "Move deals through pipeline, generate commission invoices, track revenue.",         color: "#10b981", icon: "🏆" },
];

const PLANS = [
  {
    name: "Starter", price: "₹4,999", period: "/month", desc: "Solo brokers",
    features: ["100 leads", "5 properties", "WhatsApp automation", "Basic reports", "Email support"],
    popular: false, color: "#6366f1",
  },
  {
    name: "Professional", price: "₹12,999", period: "/month", desc: "Growing brokerages",
    features: ["Unlimited leads", "Unlimited properties", "AI lead scoring", "Deal pipeline", "Commission tracker", "Advanced analytics", "Priority support"],
    popular: true, color: "#eab308",
  },
  {
    name: "Enterprise", price: "Custom", period: "", desc: "Large teams & agencies",
    features: ["Everything in Pro", "Multi-branch support", "Custom integrations", "Dedicated manager", "SLA guarantee"],
    popular: false, color: "#10b981",
  },
];

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  x: Math.random() * 100, y: Math.random() * 100,
  size: 2 + Math.random() * 4,
  delay: i * 0.3,
  color: i % 3 === 0 ? "rgba(234,179,8,0.5)" : i % 3 === 1 ? "rgba(99,102,241,0.4)" : "rgba(16,185,129,0.4)",
}));

const TICKER = ["🤖 AI Lead Scoring","💬 WhatsApp Automation","🏠 Property Matching","📊 Deal Pipeline","💰 Commission Tracker","📈 Smart Reports","📍 Ahmedabad Real Estate","🔑 Buyer & Seller Mgmt","🏗️ Commercial Properties","🤝 Broker Dashboard","⚡ GPT-4o Powered","🔒 Bank-grade Security","📅 Meeting Scheduler","🧠 Smart Matching AI","📋 Site Visit Tracker","🔔 Instant Alerts"];

/* ─── Main Component ─── */
export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const heroY    = useTransform(scrollY, [0, 500], [0, -100]);
  const heroOpacity = useTransform(scrollY, [0, 300], [1, 0.3]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div ref={containerRef} style={{ background: "#030307", color: "#e2e8f0", minHeight: "100vh", overflowX: "hidden" }}>

      {/* ── CSS ── */}
      <style>{`
        @keyframes ticker-l { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        @keyframes ticker-r { 0% { transform: translateX(-50%); } 100% { transform: translateX(0); } }
        .tk-l { animation: ticker-l 60s linear infinite; }
        .tk-r { animation: ticker-r 70s linear infinite; }
        .tk-l:hover, .tk-r:hover { animation-play-state: paused; }
        @keyframes glow-pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.9; } }
        .glow-btn { animation: glow-pulse 2.5s ease-in-out infinite; }
        @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-12px); } }
        .float-logo { animation: float 4s ease-in-out infinite; }
        @keyframes spin-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .spin-ring { animation: spin-slow 12s linear infinite; }
        * { box-sizing: border-box; }
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 200%; } }

        /* ── Landing Mobile ── */
        @media (max-width: 640px) {
          .land-nav-links { display: none !important; }
          .land-hero { padding: 100px 16px 48px !important; }
          .land-logo-wrap { width: 88px !important; height: 88px !important; border-radius: 20px !important; margin-bottom: 28px !important; }
          .land-ctas { flex-direction: column !important; align-items: stretch !important; gap: 10px !important; }
          .land-ctas a, .land-ctas div { width: 100% !important; justify-content: center !important; }
          .land-stats { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
          .land-section { padding: 40px 16px !important; }
          .land-grid-3 { grid-template-columns: 1fr !important; }
          .land-grid-2 { grid-template-columns: 1fr !important; }
          .land-plan-popular { transform: scale(1) !important; }
          .land-cta-box { padding: 32px 20px !important; border-radius: 24px !important; }
          .land-cta-btns { flex-direction: column !important; align-items: stretch !important; }
          .land-cta-btns a, .land-cta-btns div { width: 100% !important; justify-content: center !important; }
          .land-contact-row { flex-direction: column !important; gap: 8px !important; align-items: center !important; }
          .land-trust { gap: 8px !important; }
          .land-trust > div { font-size: 11px !important; padding: 6px 12px !important; }
          .land-step-number { font-size: 60px !important; }
          .land-navbar { padding: 10px 16px !important; }
          .land-ticker span { padding: 5px 12px !important; font-size: 11px !important; }
        }
        @media (max-width: 768px) {
          .land-grid-features { grid-template-columns: 1fr !important; }
          .land-grid-pricing  { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Fixed Ambient Background ── */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {/* Main radial glows */}
        <div style={{ position: "absolute", top: "-20%", left: "50%", transform: "translateX(-50%)", width: "80vw", height: "60vh", background: "radial-gradient(ellipse, rgba(234,179,8,0.12) 0%, transparent 60%)", filter: "blur(60px)" }} />
        <div style={{ position: "absolute", top: "40%", left: "-15%", width: "50vw", height: "50vh", background: "radial-gradient(ellipse, rgba(99,102,241,0.08) 0%, transparent 70%)", filter: "blur(80px)" }} />
        <div style={{ position: "absolute", top: "60%", right: "-15%", width: "50vw", height: "50vh", background: "radial-gradient(ellipse, rgba(16,185,129,0.06) 0%, transparent 70%)", filter: "blur(80px)" }} />
        {/* Grid */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.025, backgroundImage: "linear-gradient(rgba(234,179,8,1) 1px, transparent 1px), linear-gradient(90deg, rgba(234,179,8,1) 1px, transparent 1px)", backgroundSize: "70px 70px" }} />
        {/* Vignette */}
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at center, transparent 40%, rgba(3,3,7,0.8) 100%)" }} />
        {/* Particles */}
        {mounted && PARTICLES.map((p, i) => <Particle key={i} {...p} />)}
      </div>

      {/* ── Navbar ── */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.6, ease: "easeOut" }}
        className="land-navbar"
        style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 28px", background: "rgba(3,3,7,0.8)", backdropFilter: "blur(24px)", borderBottom: "1px solid rgba(234,179,8,0.1)" }}>
        {/* Left — logo + name */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
          <motion.div whileHover={{ scale: 1.05 }} style={{ position: "relative", width: 38, height: 38, borderRadius: 10, overflow: "hidden", background: "#fff", border: "1.5px solid rgba(234,179,8,0.6)", boxShadow: "0 0 16px rgba(234,179,8,0.3)", flexShrink: 0 }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 3 }} />
          </motion.div>
          <div>
            <div style={{ fontWeight: 800, color: "#fff", fontSize: 14, lineHeight: 1.1 }}>City Real Space</div>
            <div style={{ fontSize: 10, color: "#eab308", letterSpacing: "0.05em" }}>AI-POWERED CRM</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <a href="tel:+919825031247" className="land-nav-links" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b", textDecoration: "none", padding: "6px 12px", borderRadius: 8 }}>
            <Phone className="w-3 h-3" /> +91 98250 31247
          </a>
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" className="land-nav-links" style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#eab308", textDecoration: "none", padding: "6px 12px", borderRadius: 8, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}>
            <Globe className="w-3 h-3" /> cityrealspace.com
          </a>
          <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
            <Link href="/sign-in" style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none", boxShadow: "0 0 20px rgba(234,179,8,0.3)" }}>
              Sign In <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </motion.div>
        </div>
      </motion.nav>

      {/* ── Hero ── */}
      <motion.section className="land-hero" style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "140px 24px 80px", y: heroY, opacity: heroOpacity }}>

        {/* Badge — upar */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "7px 18px", borderRadius: 999, fontSize: 12, fontWeight: 600, background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)", color: "#eab308", marginBottom: 24, letterSpacing: "0.03em" }}>
          <Sparkles className="w-3.5 h-3.5" /> AI-Powered Real Estate CRM · Ahmedabad, Gujarat
        </motion.div>

        {/* Spinning ring behind logo */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 40 }}>
          <div className="spin-ring" style={{ position: "absolute", inset: -24, borderRadius: "50%", border: "1px dashed rgba(234,179,8,0.2)" }} />
          <div className="spin-ring" style={{ position: "absolute", inset: -12, borderRadius: "50%", border: "1px solid rgba(234,179,8,0.1)", animationDirection: "reverse", animationDuration: "18s" }} />
          {/* Glow */}
          <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "rgba(234,179,8,0.2)", filter: "blur(30px)", transform: "scale(1.6)" }} />
          {/* Logo */}
          <motion.div className="land-logo-wrap float-logo"
            initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, type: "spring", bounce: 0.35, delay: 0.2 }}
            style={{ position: "relative", width: 120, height: 120, borderRadius: 28, overflow: "hidden", background: "#fff", border: "2.5px solid rgba(234,179,8,0.7)", boxShadow: "0 0 50px rgba(234,179,8,0.3), 0 20px 60px rgba(0,0,0,0.5)" }}>
            <Image src="/logo.jpeg" alt="City Real Space" fill sizes="120px" className="object-contain" style={{ padding: 10 }} priority />
          </motion.div>
          {/* Pulse rings */}
          {[1.5, 2, 2.5].map((s, i) => (
            <motion.div key={i}
              style={{ position: "absolute", inset: 0, borderRadius: 28, border: "1px solid rgba(234,179,8,0.3)" }}
              animate={{ scale: [1, s], opacity: [0.5, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.7, ease: "easeOut" }}
            />
          ))}
        </div>

        {/* Headline */}
        <motion.h1 initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.65, duration: 0.8 }}
          style={{ fontSize: "clamp(38px, 7vw, 78px)", fontWeight: 900, lineHeight: 1.05, marginBottom: 20, letterSpacing: "-0.03em" }}>
          <motion.span style={{ display: "block", color: "#ffffff" }}
            initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.7 }}>
            City Real Space
          </motion.span>
          <motion.span
            style={{ display: "block", background: "linear-gradient(135deg,#ca8a04 0%,#eab308 40%,#fde047 70%,#f59e0b 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.85 }}>
            CRM Platform
          </motion.span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1 }}
          style={{ fontSize: "clamp(15px, 2vw, 19px)", color: "#94a3b8", maxWidth: 580, margin: "0 auto 44px", lineHeight: 1.75 }}>
          The most automation-driven CRM built for{" "}
          <span style={{ color: "#eab308", fontWeight: 700 }}>Ahmedabad real estate brokers</span>.
          AI matching, WhatsApp automation & smart deal tracking — all in one place.
        </motion.p>

        {/* CTAs */}
        <motion.div className="land-ctas" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1 }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap", marginBottom: 72 }}>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 32px", borderRadius: 18, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#ca8a04,#eab308,#fde047)", color: "#050508", textDecoration: "none", boxShadow: "0 0 40px rgba(234,179,8,0.4), 0 8px 32px rgba(234,179,8,0.2)", position: "relative", overflow: "hidden" }}>
              <span style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)", transform: "skewX(-20deg)", animation: "shimmer 2.5s infinite" }} />
              Open CRM Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
          <motion.div whileHover={{ scale: 1.04, y: -2 }} whileTap={{ scale: 0.97 }}>
            <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", gap: 9, padding: "15px 32px", borderRadius: 18, fontSize: 15, fontWeight: 600, background: "rgba(234,179,8,0.07)", border: "1.5px solid rgba(234,179,8,0.35)", color: "#eab308", textDecoration: "none", backdropFilter: "blur(10px)" }}>
              <Play className="w-4 h-4" /> Watch Demo
            </Link>
          </motion.div>
        </motion.div>

        {/* Stats */}
        <motion.div className="land-stats" initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.25 }}
          style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 14, maxWidth: 720, margin: "0 auto" }}>
          {STATS.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 1.35 + i * 0.08, type: "spring", bounce: 0.4 }}
              whileHover={{ y: -4, scale: 1.03 }}
              style={{ padding: "22px 16px", borderRadius: 20, background: s.bg, border: `1px solid ${s.color}25`, textAlign: "center", backdropFilter: "blur(10px)", cursor: "default" }}>
              <s.icon style={{ width: 20, height: 20, color: s.color, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 30, fontWeight: 900, color: s.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div style={{ fontSize: 11, color: "#64748b", marginTop: 6, fontWeight: 500 }}>{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Scroll indicator */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }}
          style={{ marginTop: 56, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, color: "#334155", fontSize: 11, letterSpacing: "0.1em" }}>
          <span>SCROLL</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ── Ticker ── */}
      <style>{`
        @keyframes shimmer { 0% { left: -100%; } 100% { left: 200%; } }
      `}</style>
      <section style={{ position: "relative", zIndex: 10, overflow: "hidden", padding: "18px 0", borderTop: "1px solid rgba(234,179,8,0.08)", borderBottom: "1px solid rgba(234,179,8,0.08)", background: "rgba(234,179,8,0.015)" }}>
        {[{ cls: "tk-l", color: "#eab308" }, { cls: "tk-r", color: "#94a3b8" }].map((row, ri) => (
          <div key={ri} style={{ overflow: "hidden", marginBottom: ri === 0 ? 8 : 0 }}>
            <div className={row.cls} style={{ display: "flex", width: "max-content" }}>
              {[...TICKER, ...TICKER].map((item, i) => (
                <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 20px", fontSize: 12, fontWeight: 500, color: row.color, whiteSpace: "nowrap" }}>
                  {ri === 1 ? TICKER[(TICKER.length - 1 - (i % TICKER.length))] : item}
                  <span style={{ color: `${row.color}40`, fontSize: 9 }}>✦</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ── Trust Badges ── */}
      <section style={{ position: "relative", zIndex: 10, padding: "32px 24px" }}>
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}
          className="land-trust"
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: Shield,   label: "Bank-grade Security", color: "#10b981" },
            { icon: Bot,      label: "GPT-4o Powered",      color: "#eab308" },
            { icon: BarChart3,label: "Real-time Analytics", color: "#6366f1" },
            { icon: Zap,      label: "Lightning Fast",      color: "#f59e0b" },
          ].map((t, i) => (
            <motion.div key={t.label} initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -2, scale: 1.05 }}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 18px", borderRadius: 999, background: `${t.color}08`, border: `1px solid ${t.color}20`, fontSize: 13, color: "#cbd5e1", cursor: "default" }}>
              <t.icon style={{ width: 14, height: 14, color: t.color }} /> {t.label}
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── How It Works ── */}
      <section className="land-section" style={{ position: "relative", zIndex: 10, padding: "72px 24px", maxWidth: 960, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.25)", color: "#818cf8", marginBottom: 16 }}>
            HOW IT WORKS
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#ffffff", marginBottom: 8, letterSpacing: "-0.02em" }}>Close More Deals in 3 Steps</h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>Simple workflow, powerful results</p>
        </motion.div>

        {/* Connector line */}
        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", top: 48, left: "16%", right: "16%", height: 1, background: "linear-gradient(90deg, transparent, rgba(234,179,8,0.2), rgba(99,102,241,0.2), rgba(16,185,129,0.2), transparent)", display: "none" }} className="hidden md:block" />
          <div className="land-grid-3" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 24 }}>
            {STEPS.map((s, i) => (
              <motion.div key={s.step}
                initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.15, type: "spring", bounce: 0.3 }}
                whileHover={{ y: -6, scale: 1.02 }}
                style={{ padding: "32px 28px", borderRadius: 24, background: "rgba(255,255,255,0.025)", border: `1px solid ${s.color}20`, position: "relative", overflow: "hidden", cursor: "default" }}>
                {/* BG step number */}
                <div style={{ position: "absolute", bottom: -10, right: 12, fontSize: 80, fontWeight: 900, color: `${s.color}06`, lineHeight: 1, userSelect: "none" }}>{s.step}</div>
                {/* Icon circle */}
                <div style={{ width: 56, height: 56, borderRadius: 16, background: `${s.color}12`, border: `1px solid ${s.color}25`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, marginBottom: 20 }}>
                  {s.icon}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: s.color, letterSpacing: "0.08em", marginBottom: 8 }}>STEP {s.step}</div>
                <h3 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 18, marginBottom: 10 }}>{s.title}</h3>
                <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="land-section" style={{ position: "relative", zIndex: 10, padding: "72px 24px", maxWidth: 1140, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308", marginBottom: 16 }}>
            FEATURES
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#ffffff", marginBottom: 8, letterSpacing: "-0.02em" }}>Everything to Dominate</h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>Built for commercial & residential brokers in Ahmedabad</p>
        </motion.div>

        <div className="land-grid-features" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18 }}>
          {FEATURES.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.02 }}
              style={{ padding: "28px", borderRadius: 22, background: "rgba(255,255,255,0.02)", border: `1px solid ${f.color}18`, position: "relative", overflow: "hidden", cursor: "default" }}>
              {/* Corner glow */}
              <div style={{ position: "absolute", top: 0, right: 0, width: 80, height: 80, background: `radial-gradient(circle at top right, ${f.color}12, transparent)` }} />
              <div style={{ width: 54, height: 54, borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, background: `${f.color}10`, border: `1px solid ${f.color}25`, marginBottom: 18 }}>
                {f.icon}
              </div>
              <h3 style={{ fontWeight: 800, color: "#f1f5f9", fontSize: 16, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: "#64748b", lineHeight: 1.7 }}>{f.desc}</p>
              <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: f.color, fontWeight: 600 }}>
                Learn more <ArrowRight className="w-3 h-3" />
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="land-section" style={{ position: "relative", zIndex: 10, padding: "72px 24px", maxWidth: 1040, margin: "0 auto" }}>
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          style={{ textAlign: "center", marginBottom: 56 }}>
          <div style={{ display: "inline-block", padding: "4px 14px", borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308", marginBottom: 16 }}>
            PRICING
          </div>
          <h2 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#ffffff", marginBottom: 8, letterSpacing: "-0.02em" }}>Simple, Transparent Pricing</h2>
          <p style={{ color: "#64748b", fontSize: 15 }}>No hidden fees. Cancel anytime.</p>
        </motion.div>

        <div className="land-grid-pricing" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 22, alignItems: "center" }}>
          {PLANS.map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 32, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: plan.popular ? 1.04 : 1 }} viewport={{ once: true }} transition={{ delay: i * 0.1, type: "spring", bounce: 0.3 }}
              whileHover={{ y: -6 }}
              style={{ position: "relative", padding: plan.popular ? "36px 28px" : "28px 24px", borderRadius: 26, display: "flex", flexDirection: "column", background: plan.popular ? "rgba(234,179,8,0.05)" : "rgba(255,255,255,0.02)", border: plan.popular ? "1.5px solid rgba(234,179,8,0.4)" : `1px solid ${plan.color}18`, boxShadow: plan.popular ? "0 0 60px rgba(234,179,8,0.1), inset 0 0 40px rgba(234,179,8,0.03)" : "none" }}>
              {plan.popular && (
                <motion.div
                  animate={{ boxShadow: ["0 0 10px rgba(234,179,8,0.4)", "0 0 20px rgba(234,179,8,0.6)", "0 0 10px rgba(234,179,8,0.4)"] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  style={{ position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)", padding: "4px 18px", borderRadius: 999, fontSize: 11, fontWeight: 800, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", whiteSpace: "nowrap", letterSpacing: "0.05em" }}>
                  ⭐ MOST POPULAR
                </motion.div>
              )}

              <div style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: plan.color }} />
                  <h3 style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{plan.name}</h3>
                </div>
                <p style={{ fontSize: 12, color: "#64748b", marginBottom: 18 }}>{plan.desc}</p>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 38, fontWeight: 900, color: plan.popular ? "#eab308" : "#fff", lineHeight: 1 }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>{plan.period}</span>}
                </div>
              </div>

              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 26px", flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                {plan.features.map(f => (
                  <li key={f} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#94a3b8" }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: `${plan.color}15`, border: `1px solid ${plan.color}30`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Check style={{ width: 10, height: 10, color: plan.color }} />
                    </div>
                    {f}
                  </li>
                ))}
              </ul>

              <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                <Link href="/sign-in"
                  style={{ display: "block", textAlign: "center", padding: "13px", borderRadius: 16, fontSize: 14, fontWeight: 700, textDecoration: "none", ...(plan.popular ? { background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", boxShadow: "0 0 24px rgba(234,179,8,0.3)" } : { background: `${plan.color}10`, border: `1px solid ${plan.color}25`, color: plan.color }) }}>
                  {plan.name === "Enterprise" ? "Contact Us" : "Start Free Trial"} →
                </Link>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="land-section" style={{ position: "relative", zIndex: 10, padding: "72px 24px", textAlign: "center" }}>
        <motion.div initial={{ opacity: 0, scale: 0.93 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", bounce: 0.25 }}
          className="land-cta-box"
          style={{ maxWidth: 640, margin: "0 auto", padding: "56px 40px", borderRadius: 32, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.2)", boxShadow: "0 0 80px rgba(234,179,8,0.06)", position: "relative", overflow: "hidden" }}>
          {/* BG glow */}
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% -20%, rgba(234,179,8,0.1) 0%, transparent 60%)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 120%, rgba(99,102,241,0.06) 0%, transparent 60%)", pointerEvents: "none" }} />

          <motion.div className="float-logo" style={{ width: 72, height: 72, borderRadius: 20, overflow: "hidden", background: "#fff", border: "2px solid rgba(234,179,8,0.5)", margin: "0 auto 24px", position: "relative", boxShadow: "0 0 30px rgba(234,179,8,0.25)" }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 6 }} />
          </motion.div>

          <h2 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 8, letterSpacing: "-0.02em" }}>City Real Space</h2>
          <p style={{ color: "#64748b", fontSize: 14, marginBottom: 32 }}>Ahmedabad&apos;s most trusted real estate brokerage</p>

          <div className="land-contact-row" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 20, flexWrap: "wrap", marginBottom: 32, fontSize: 13 }}>
            <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: "#eab308", textDecoration: "none" }}><Globe className="w-4 h-4" /> cityrealspace.com</a>
            <a href="mailto:info@cityrealspace.com" style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b", textDecoration: "none" }}><Mail className="w-4 h-4" /> info@cityrealspace.com</a>
            <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#64748b" }}><MapPin className="w-4 h-4" /> Ahmedabad, Gujarat</span>
          </div>

          <div className="land-cta-btns" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14, flexWrap: "wrap" }}>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
              <Link href="/sign-in" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 30px", borderRadius: 16, fontSize: 15, fontWeight: 800, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none", boxShadow: "0 0 30px rgba(234,179,8,0.35)" }}>
                Open CRM <ArrowRight className="w-4 h-4" />
              </Link>
            </motion.div>
            <motion.div whileHover={{ scale: 1.05, y: -2 }} whileTap={{ scale: 0.97 }}>
              <a href="tel:+919825031247" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 30px", borderRadius: 16, fontSize: 15, fontWeight: 600, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8", textDecoration: "none" }}>
                <Phone className="w-4 h-4" /> Call Us
              </a>
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ position: "relative", zIndex: 10, padding: "28px 24px", textAlign: "center", borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 12 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.3)", position: "relative" }}>
            <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 2 }} />
          </div>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>City Real Space</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, flexWrap: "wrap", fontSize: 12, color: "#475569" }}>
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" style={{ color: "#475569", textDecoration: "none" }}>cityrealspace.com</a>
          <span>·</span>
          <a href="mailto:info@cityrealspace.com" style={{ color: "#475569", textDecoration: "none" }}>info@cityrealspace.com</a>
          <span>·</span>
          <span>Ahmedabad, Gujarat, India</span>
        </div>
        <p style={{ fontSize: 11, color: "#1e293b", marginTop: 16, maxWidth: 700, margin: "16px auto 0", lineHeight: 1.8 }}>
          Real Estate CRM Ahmedabad · Property Broker Software Gujarat · AI Lead Management ·
          WhatsApp Automation Real Estate · Deal Pipeline Software · Commission Tracker Broker ·
          Best CRM for Real Estate Agents India · Commercial Property Software Ahmedabad
        </p>
        <p style={{ fontSize: 11, color: "#334155", marginTop: 10 }}>© 2026 City Real Space. All rights reserved.</p>
      </footer>
    </div>
  );
}
