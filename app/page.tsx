"use client";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Users, Zap, ArrowRight, Star, MapPin, Phone, Building2, Mail, Globe, Shield, Bot, BarChart3, Check } from "lucide-react";

// ── Animated counter ──
function Counter({ to, suffix = "+" }: { to: number; suffix?: string }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // Small delay so element is visible on page load
    const startTimer = setTimeout(() => {
      const duration = 2000;
      const steps = 80;
      const interval = duration / steps;
      let current = 0;
      const timer = setInterval(() => {
        current += 1;
        const progress = current / steps;
        // easeOutQuart
        const eased = 1 - Math.pow(1 - progress, 4);
        setCount(Math.floor(eased * to));
        if (current >= steps) { setCount(to); clearInterval(timer); }
      }, interval);
      return () => clearInterval(timer);
    }, 600);
    return () => clearTimeout(startTimer);
  }, [to]);

  return <span ref={ref}>{count.toLocaleString()}{suffix}</span>;
}

// ── Floating logo background ──
function FloatingLogo({ size, delay, initialX, initialY }: { size: number; delay: number; initialX: string; initialY: string }) {
  return (
    <motion.div
      className="absolute rounded-2xl overflow-hidden"
      style={{ width: size, height: size, left: initialX, top: initialY, background: "#ffffff", border: "1px solid rgba(234,179,8,0.4)", boxShadow: "0 4px 20px rgba(0,0,0,0.3)" }}
      animate={{
        x: [0, 20, -15, 10, 0],
        y: [0, -20, 15, -10, 0],
        rotate: [0, 3, -2, 2, 0],
        opacity: [0.7, 0.9, 0.8, 0.9, 0.7],
      }}
      transition={{ duration: 14, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      <Image src="/logo.jpeg" alt="" fill sizes={`${size}px`} className="object-contain p-1" style={{ opacity: 1 }} />
    </motion.div>
  );
}

// ── Floating Emoji ──
function FloatingEmoji({ emoji, size, delay, initialX, initialY }: { emoji: string; size: number; delay: number; initialX: string; initialY: string }) {
  return (
    <motion.div
      className="absolute flex items-center justify-center rounded-2xl"
      style={{ width: size, height: size, left: initialX, top: initialY, background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)", backdropFilter: "blur(8px)", fontSize: size * 0.45 }}
      animate={{
        x: [0, -18, 12, -8, 0],
        y: [0, 15, -20, 10, 0],
        rotate: [0, -4, 3, -2, 0],
        opacity: [0.5, 0.8, 0.6, 0.8, 0.5],
      }}
      transition={{ duration: 16, delay, repeat: Infinity, ease: "easeInOut" }}
    >
      {emoji}
    </motion.div>
  );
}

const stats = [
  { label: "Properties Listed", value: 100,  suffix: "+", icon: Building2,  color: "text-gold-400" },
  { label: "Deals Closed",      value: 250,  suffix: "+", icon: TrendingUp, color: "text-emerald-400" },
  { label: "Happy Clients",     value: 500,  suffix: "+", icon: Users,      color: "text-blue-400" },
  { label: "Years Experience",  value: 25,   suffix: "+", icon: Star,       color: "text-purple-400" },
];

const features = [
  { title: "AI Lead Scoring",     desc: "Auto-score leads by budget, urgency & intent — never miss a hot lead",  icon: "🤖", color: "rgba(234,179,8,0.08)",   border: "rgba(234,179,8,0.2)" },
  { title: "Auto Property Match", desc: "Instantly match buyers to perfect properties using AI",                  icon: "🏠", color: "rgba(59,130,246,0.08)",  border: "rgba(59,130,246,0.2)" },
  { title: "WhatsApp Automation", desc: "Auto follow-ups, reminders & bulk campaigns on WhatsApp",               icon: "💬", color: "rgba(34,197,94,0.08)",   border: "rgba(34,197,94,0.2)" },
  { title: "Deal Pipeline",       desc: "Visual kanban pipeline from first enquiry to deal close",               icon: "📊", color: "rgba(168,85,247,0.08)",  border: "rgba(168,85,247,0.2)" },
  { title: "Commission Tracker",  desc: "Auto-calculate, track and generate commission invoices",                 icon: "💰", color: "rgba(249,115,22,0.08)",  border: "rgba(249,115,22,0.2)" },
  { title: "Smart Reports",       desc: "Real-time broker performance & revenue analytics",                      icon: "📈", color: "rgba(20,184,166,0.08)",  border: "rgba(20,184,166,0.2)" },
];

const trusts = [
  { icon: Shield,   label: "Secure & Private",    desc: "Bank-grade security" },
  { icon: Bot,      label: "AI Powered",           desc: "GPT-4o intelligence" },
  { icon: BarChart3,label: "Real-time Analytics",  desc: "Live dashboards" },
];

export default function HomePage() {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setMouseX((e.clientX / window.innerWidth - 0.5) * 20);
      setMouseY((e.clientY / window.innerHeight - 0.5) * 20);
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden" style={{ background: "#050508" }}>

      {/* ── Background ── */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(234,179,8,0.12) 0%, transparent 60%)",
        }} />
        <div className="absolute inset-0" style={{
          background: "radial-gradient(ellipse 60% 40% at 80% 80%, rgba(234,179,8,0.05) 0%, transparent 50%)",
        }} />
        {/* Grid */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: "linear-gradient(rgba(234,179,8,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(234,179,8,0.5) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }} />
      </div>

      {/* ── Floating logos + emojis ── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <FloatingLogo size={80}  delay={0}   initialX="5%"  initialY="15%" />
        <FloatingLogo size={50}  delay={2}   initialX="88%" initialY="20%" />
        <FloatingLogo size={65}  delay={4}   initialX="75%" initialY="65%" />
        <FloatingLogo size={45}  delay={1.5} initialX="10%" initialY="70%" />
        <FloatingLogo size={35}  delay={3}   initialX="50%" initialY="85%" />
        <FloatingEmoji emoji="🏢" size={56} delay={0.5}  initialX="20%" initialY="8%"  />
        <FloatingEmoji emoji="🏠" size={48} delay={2.5}  initialX="65%" initialY="12%" />
        <FloatingEmoji emoji="🔑" size={44} delay={1}    initialX="92%" initialY="45%" />
        <FloatingEmoji emoji="💰" size={50} delay={3.5}  initialX="3%"  initialY="45%" />
        <FloatingEmoji emoji="📊" size={46} delay={5}    initialX="30%" initialY="78%" />
        <FloatingEmoji emoji="🏗️" size={52} delay={1.8}  initialX="78%" initialY="80%" />
        <FloatingEmoji emoji="📍" size={40} delay={4.2}  initialX="55%" initialY="5%"  />
        <FloatingEmoji emoji="🤝" size={48} delay={2.8}  initialX="42%" initialY="92%" />
      </div>

      {/* ── Navbar ── */}
      <nav className="relative z-20 flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: "rgba(234,179,8,0.08)", background: "rgba(5,5,8,0.8)", backdropFilter: "blur(20px)" }}>
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 3 }}
            className="relative w-9 h-9 rounded-xl overflow-hidden bg-white"
            style={{ border: "1px solid rgba(234,179,8,0.4)", boxShadow: "0 0 16px rgba(234,179,8,0.2)" }}>
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-0.5" />
          </motion.div>
          <div>
            <div className="font-bold text-white text-sm leading-none">City Real Space</div>
            <div className="text-xs" style={{ color: "#eab308" }}>AI-Powered CRM</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1.5 text-xs transition-colors relative"
            style={{ color: "#eab308" }}>
            <Globe className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="relative overflow-hidden">
              cityrealspace.com
              <motion.span
                className="absolute bottom-0 left-0 h-px w-full"
                style={{ background: "linear-gradient(90deg, transparent, #eab308, transparent)" }}
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              />
            </span>
          </a>
          <Link href="/sign-in"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
            style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", boxShadow: "0 0 20px rgba(234,179,8,0.3)" }}>
            Sign In <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </motion.div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative z-10 text-center px-6 pt-24 pb-20">

        {/* Center Logo */}
        <motion.div className="flex justify-center mb-10">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, type: "spring", bounce: 0.35 }}
            className="relative"
            style={{ x: mouseX * 0.2, y: mouseY * 0.2 }}
          >
            {/* Pulse ring 1 */}
            <motion.div
              animate={{ scale: [1, 1.6, 1], opacity: [0.25, 0, 0.25] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
              className="absolute rounded-3xl"
              style={{ inset: -8, background: "transparent", border: "1px solid rgba(234,179,8,0.4)" }}
            />
            {/* Pulse ring 2 */}
            <motion.div
              animate={{ scale: [1, 1.9, 1], opacity: [0.15, 0, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut", delay: 0.6 }}
              className="absolute rounded-3xl"
              style={{ inset: -8, background: "transparent", border: "1px solid rgba(234,179,8,0.25)" }}
            />
            {/* Gold glow behind */}
            <div className="absolute inset-0 rounded-3xl" style={{ background: "rgba(234,179,8,0.15)", filter: "blur(24px)", transform: "scale(1.3)" }} />

            {/* Logo box */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              whileHover={{ scale: 1.06 }}
              className="relative rounded-3xl overflow-hidden"
              style={{
                width: 120, height: 120,
                background: "#ffffff",
                border: "2px solid rgba(234,179,8,0.6)",
                boxShadow: "0 0 0 1px rgba(234,179,8,0.15), 0 8px 40px rgba(234,179,8,0.25), 0 2px 8px rgba(0,0,0,0.4)"
              }}>
              <Image
                src="/logo.jpeg"
                alt="City Real Space"
                fill
                sizes="120px"
                className="object-contain"
                style={{ padding: "10px" }}
                priority
              />
            </motion.div>

            {/* 4 corner dots */}
            {[[-14,-14],["auto",-14],[-14,"auto"],["auto","auto"]].map(([t,l], i) => (
              <motion.div key={i}
                animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 }}
                className="absolute w-2 h-2 rounded-full"
                style={{
                  background: "#eab308",
                  top: i < 2 ? -6 : "auto", bottom: i >= 2 ? -6 : "auto",
                  left: i % 2 === 0 ? -6 : "auto", right: i % 2 === 1 ? -6 : "auto",
                  boxShadow: "0 0 6px rgba(234,179,8,0.8)"
                }}
              />
            ))}
          </motion.div>
        </motion.div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.6, ease: "easeOut" }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6"
          style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.2)", color: "#eab308" }}>
          <motion.span animate={{ rotate: [0, 15, -10, 0] }} transition={{ delay: 1.2, duration: 0.6 }}>
            <Zap className="w-4 h-4" />
          </motion.span>
          AI-Powered Real Estate CRM for Ahmedabad
        </motion.div>

        {/* Headline */}
        <div className="mb-6">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-5xl md:text-7xl font-bold leading-tight tracking-tight text-white block">City Real Space</span>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.62, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="text-5xl md:text-7xl font-bold leading-tight tracking-tight block" style={{
              background: "linear-gradient(135deg, #ca8a04 0%, #eab308 40%, #fde047 70%, #eab308 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
              backgroundSize: "200% auto",
            }}>
              CRM Platform
            </span>
          </motion.div>
        </div>

        {/* Description — word by word */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.82, duration: 0.7, ease: "easeOut" }}
          className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
          The most automation-driven CRM built specifically for{" "}
          <motion.span
            initial={{ opacity: 0, color: "#94a3b8" }}
            animate={{ opacity: 1, color: "#eab308" }}
            transition={{ delay: 1.3, duration: 0.8 }}
            className="font-semibold"
          >Ahmedabad real estate brokers</motion.span>.
          {" "}AI matching, WhatsApp automation, and smart deal tracking.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0, duration: 0.6, ease: "easeOut" }}
          className="flex items-center justify-center gap-4 flex-wrap mb-20">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.05, duration: 0.5 }}>
            <Link href="/sign-in"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-105"
              style={{
                background: "linear-gradient(135deg,#ca8a04,#eab308,#fde047)",
                color: "#050508",
                boxShadow: "0 0 30px rgba(234,179,8,0.4), 0 4px 20px rgba(0,0,0,0.3)"
              }}>
              Open CRM Dashboard <ArrowRight className="w-5 h-5" />
            </Link>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.15, duration: 0.5 }}>
            <Link href="/demo"
              className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition-all hover:scale-105"
              style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.25)", color: "#eab308" }}>
              <Zap className="w-5 h-5" /> Free Demo
            </Link>
          </motion.div>
          <motion.a
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.25, duration: 0.5 }}
            href="https://cityrealspace.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-medium transition-all hover:scale-105"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
            <Globe className="w-5 h-5" /> Visit Website
          </motion.a>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.2, duration: 0.7, ease: "easeOut" }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
          {stats.map((s, i) => (
            <motion.div key={s.label}
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 1.3 + i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              whileHover={{ y: -4, scale: 1.02 }}
              className="text-center p-5 rounded-2xl"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid rgba(234,179,8,0.1)",
                backdropFilter: "blur(10px)",
              }}>
              <s.icon className={`w-5 h-5 ${s.color} mx-auto mb-3`} />
              <div className={`text-3xl font-bold mb-1 ${s.color}`}>
                <Counter to={s.value} suffix={s.suffix} />
              </div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ── Trust badges ── */}
      <section className="relative z-10 px-6 py-8">
        <div className="max-w-3xl mx-auto flex items-center justify-center gap-6 flex-wrap">
          {trusts.map((t, i) => (
            <motion.div key={t.label}
              initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="flex items-center gap-2 px-4 py-2 rounded-full"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <t.icon className="w-4 h-4 text-gold-400" />
              <span className="text-xs text-white font-medium">{t.label}</span>
              <span className="text-xs text-muted-foreground">· {t.desc}</span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Features ── */}
      <section className="relative z-10 px-6 py-20 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-4"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)", color: "#eab308" }}>
            FEATURES
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Everything to Dominate</h2>
          <p className="text-muted-foreground">Built for commercial & residential brokers in Ahmedabad</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}
              whileHover={{ y: -4 }}
              className="p-6 rounded-2xl transition-all cursor-default"
              style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${f.border}` }}>
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: f.color, border: `1px solid ${f.border}` }}>{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── Pricing ── */}
      <section className="relative z-10 px-6 py-20 max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs mb-4"
            style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.15)", color: "#eab308" }}>
            PRICING
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-3">Simple, Transparent Pricing</h2>
          <p className="text-muted-foreground">No hidden fees. Cancel anytime.</p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              name: "Starter", price: "₹4,999", period: "/month",
              desc: "Perfect for solo brokers",
              color: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", accent: "#94a3b8",
              features: ["Up to 100 leads", "5 properties", "WhatsApp automation", "Basic reports", "Email support"],
              cta: "Get Started", popular: false,
            },
            {
              name: "Professional", price: "₹12,999", period: "/month",
              desc: "For growing brokerages",
              color: "rgba(234,179,8,0.04)", border: "rgba(234,179,8,0.3)", accent: "#eab308",
              features: ["Unlimited leads", "Unlimited properties", "AI lead scoring", "Deal pipeline", "Commission tracker", "Advanced analytics", "Priority support"],
              cta: "Start Free Trial", popular: true,
            },
            {
              name: "Enterprise", price: "Custom", period: "",
              desc: "For large teams & agencies",
              color: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.08)", accent: "#94a3b8",
              features: ["Everything in Pro", "Multi-branch support", "Custom integrations", "Dedicated manager", "SLA guarantee", "On-premise option"],
              cta: "Contact Us", popular: false,
            },
          ].map((plan, i) => (
            <motion.div key={plan.name}
              initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="relative p-7 rounded-3xl flex flex-col"
              style={{ background: plan.color, border: `1px solid ${plan.border}`, boxShadow: plan.popular ? "0 0 40px rgba(234,179,8,0.1)" : "none" }}>
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
                  style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508" }}>
                  Most Popular
                </div>
              )}
              <div className="mb-6">
                <h3 className="text-lg font-bold text-white mb-1">{plan.name}</h3>
                <p className="text-xs mb-4" style={{ color: "#64748b" }}>{plan.desc}</p>
                <div className="flex items-end gap-1">
                  <span className="text-4xl font-bold" style={{ color: plan.popular ? "#eab308" : "#fff" }}>{plan.price}</span>
                  <span className="text-sm mb-1" style={{ color: "#64748b" }}>{plan.period}</span>
                </div>
              </div>
              <ul className="space-y-2.5 flex-1 mb-7">
                {plan.features.map(f => (
                  <li key={f} className="flex items-center gap-2.5 text-sm" style={{ color: "#94a3b8" }}>
                    <Check className="w-4 h-4 shrink-0" style={{ color: plan.popular ? "#eab308" : "#64748b" }} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link href={plan.name === "Enterprise" ? "mailto:info@cityrealspace.com" : "/sign-in"}
                className="w-full text-center py-3 rounded-2xl text-sm font-semibold transition-all hover:scale-105"
                style={plan.popular
                  ? { background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", boxShadow: "0 0 20px rgba(234,179,8,0.3)" }
                  : { background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="relative z-10 px-6 py-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="max-w-2xl mx-auto p-12 rounded-3xl relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(234,179,8,0.15)",
            boxShadow: "0 0 60px rgba(234,179,8,0.06)"
          }}>
          {/* Glow */}
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(ellipse at 50% 0%, rgba(234,179,8,0.08) 0%, transparent 60%)" }} />

          <motion.div
            whileHover={{ scale: 1.05, rotate: 3 }}
            className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white mx-auto mb-6"
            style={{ border: "1px solid rgba(234,179,8,0.4)", boxShadow: "0 0 24px rgba(234,179,8,0.25)" }}>
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-1" />
          </motion.div>

          <h2 className="text-3xl font-bold text-white mb-2">City Real Space</h2>
          <p className="text-muted-foreground mb-8">Ahmedabad&apos;s most trusted real estate brokerage</p>

          <div className="flex items-center justify-center gap-6 flex-wrap mb-8">
            <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm hover:text-white transition-colors" style={{ color: "#eab308" }}>
              <Globe className="w-4 h-4" /> cityrealspace.com
            </a>
            <a href="mailto:info@cityrealspace.com"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white transition-colors">
              <Mail className="w-4 h-4" /> info@cityrealspace.com
            </a>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4" /> Ahmedabad, Gujarat
            </div>
          </div>

          <div className="flex items-center justify-center gap-4 flex-wrap mb-8">
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="w-4 h-4 text-gold-400" /> 4.9/5 Rating
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Phone className="w-4 h-4 text-emerald-400" /> 24/7 Support
            </div>
          </div>

          <Link href="/sign-in"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-base font-bold transition-all hover:scale-105"
            style={{
              background: "linear-gradient(135deg,#ca8a04,#eab308,#fde047)",
              color: "#050508",
              boxShadow: "0 0 30px rgba(234,179,8,0.35)"
            }}>
            Open CRM Dashboard <ArrowRight className="w-5 h-5" />
          </Link>
        </motion.div>
      </section>

      {/* ── Footer ── */}
      <footer className="relative z-10 px-6 py-8 text-center" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-white"
            style={{ border: "1px solid rgba(234,179,8,0.3)" }}>
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-0.5" />
          </div>
          <span className="text-white font-semibold text-sm">City Real Space</span>
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground">
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">cityrealspace.com</a>
          <span>·</span>
          <a href="mailto:info@cityrealspace.com" className="hover:text-white transition-colors">info@cityrealspace.com</a>
          <span>·</span>
          <span>Ahmedabad, Gujarat, India</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">© 2026 City Real Space. All rights reserved.</p>
      </footer>
    </div>
  );
}
