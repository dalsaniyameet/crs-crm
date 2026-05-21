"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
import { TrendingUp, Users, Zap, ArrowRight, Star, MapPin, Phone, Building2, Mail, Globe } from "lucide-react";

const stats = [
  { label: "Properties Listed", value: "2,400+", icon: Building2 },
  { label: "Deals Closed",      value: "850+",   icon: TrendingUp },
  { label: "Happy Clients",     value: "1,200+", icon: Users },
  { label: "AI Matches/Day",    value: "500+",   icon: Zap },
];

const features = [
  { title: "AI Lead Scoring",     desc: "Auto-score leads by budget, urgency & intent",  icon: "🤖" },
  { title: "Auto Property Match", desc: "Instantly match buyers to perfect properties",  icon: "🏠" },
  { title: "WhatsApp Automation", desc: "Auto follow-ups, reminders & campaigns",        icon: "💬" },
  { title: "Deal Pipeline",       desc: "Visual kanban pipeline from enquiry to close",  icon: "📊" },
  { title: "Commission Tracker",  desc: "Auto-calculate and track all commissions",      icon: "💰" },
  { title: "Smart Reports",       desc: "Real-time broker & revenue analytics",          icon: "📈" },
];

function Logo({ size = 40 }: { size?: number }) {
  return (
    <div className="relative rounded-xl overflow-hidden flex-shrink-0 bg-white" style={{ width: size, height: size }}>
      <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-0.5" />
    </div>
  );
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Floating orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="floating-orb w-96 h-96 bg-estate-600 top-[-10%] left-[-5%]"  style={{ animationDelay: "0s" }} />
        <div className="floating-orb w-64 h-64 bg-gold-500 top-[30%] right-[-5%]"   style={{ animationDelay: "1.5s" }} />
        <div className="floating-orb w-80 h-80 bg-estate-800 bottom-[-10%] left-[30%]" style={{ animationDelay: "3s" }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-white/5 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 min-w-0">
          <Logo size={38} />
          <div className="min-w-0">
            <div className="font-bold text-white text-base leading-none truncate">City Real Space</div>
            <div className="text-xs text-muted-foreground hidden sm:block">AI-Powered CRM</div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
            className="hidden md:flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
            <Globe className="w-3 h-3" /> cityrealspace.com
          </a>
          <Link href="/sign-in" className="btn-primary text-sm">
            Sign In
          </Link>
        </motion.div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 text-center px-6 pt-20 pb-16">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>

          {/* Logo big */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex justify-center mb-6"
          >
            <div className="relative w-24 h-24 rounded-3xl overflow-hidden bg-white shadow-neon border-2 border-estate-500/30">
              <Image src="/logo.jpeg" alt="City Real Space Logo" fill className="object-contain p-1" />
            </div>
          </motion.div>

          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-estate-600/20 border border-estate-500/30 text-estate-400 text-sm mb-6">
            <Zap className="w-4 h-4" />
            AI-Powered Real Estate CRM for Ahmedabad
          </div>

          <h1 className="text-5xl md:text-7xl font-bold mb-4 leading-tight">
            <span className="text-white">City Real Space</span>
            <br />
            <span className="gradient-text">CRM Platform</span>
          </h1>

          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
            The most automation-driven CRM built specifically for{" "}
            <span className="text-gold-400 font-semibold">Ahmedabad real estate brokers</span>.
            AI matching, WhatsApp automation, and smart deal tracking.
          </p>

          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link href="/sign-in" className="btn-primary flex items-center gap-2 text-base px-6 py-3">
              Open CRM Dashboard <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
              className="glass-card px-6 py-3 text-sm font-medium hover:bg-white/10 transition-all flex items-center gap-2">
              <Globe className="w-4 h-4" /> Visit Website
            </a>
          </div>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.6 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto mt-16"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 + i * 0.1 }}
              className="stat-card text-center"
            >
              <s.icon className="w-6 h-6 text-estate-400 mx-auto mb-2" />
              <div className="text-2xl font-bold gradient-text">{s.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Features */}
      <section className="relative z-10 px-6 py-16 max-w-6xl mx-auto">
        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-3">Everything You Need to Dominate</h2>
          <p className="text-muted-foreground">Built for commercial & residential brokers in Ahmedabad</p>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-6"
            >
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 px-6 py-16 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }}
          className="glass-card max-w-2xl mx-auto p-12 neon-border"
        >
          <div className="flex justify-center mb-6">
            <div className="relative w-16 h-16 rounded-2xl overflow-hidden bg-white shadow-neon">
              <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-1" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">City Real Space</h2>
          <p className="text-muted-foreground mb-6">Ahmedabad&apos;s most trusted real estate brokerage</p>

          <div className="flex items-center justify-center gap-6 flex-wrap mb-8">
            <a href="https://cityrealspace.com" target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-sm text-estate-400 hover:text-estate-300 transition-colors">
              <Globe className="w-4 h-4" /> cityrealspace.com
            </a>
            <a href="mailto:info@cityrealspace.com"
              className="flex items-center gap-1.5 text-sm text-gold-400 hover:text-gold-300 transition-colors">
              <Mail className="w-4 h-4" /> info@cityrealspace.com
            </a>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="w-4 h-4 text-estate-400" /> Ahmedabad, Gujarat
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

          <Link href="/sign-in" className="btn-gold inline-flex items-center gap-2 text-base px-8 py-3">
            Open CRM Dashboard <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-white">
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain p-0.5" />
          </div>
          <span className="text-white font-semibold">City Real Space</span>
        </div>
        <div className="flex items-center justify-center gap-4 flex-wrap text-xs text-muted-foreground">
          <a href="https://cityrealspace.com" target="_blank" rel="noreferrer" className="hover:text-white transition-colors">cityrealspace.com</a>
          <span>·</span>
          <a href="mailto:info@cityrealspace.com" className="hover:text-white transition-colors">info@cityrealspace.com</a>
          <span>·</span>
          <span>Ahmedabad, Gujarat, India</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">© 2024 City Real Space. All rights reserved.</p>
      </footer>
    </div>
  );
}
