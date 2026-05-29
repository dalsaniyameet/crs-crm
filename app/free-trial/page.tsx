"use client";
import { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Check, Phone, Mail, Building2, User, MessageSquare, Zap, Send, CheckCircle2 } from "lucide-react";

const PLANS = ["Starter – ₹4,999/mo", "Professional – ₹12,999/mo", "Enterprise – Custom"];

const PERKS = [
  "14-day free trial, no credit card",
  "Full access to all features",
  "Onboarding call included",
  "Cancel anytime",
];

export default function FreeTrialPage() {
  const [form, setForm] = useState({ name: "", company: "", phone: "", email: "", plan: PLANS[1], message: "" });
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/free-trial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("Failed");
      setDone(true);
    } catch {
      setError("Something went wrong. Please call us directly.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#050508", color: "#e2e8f0" }}>

      {/* Background */}
      <div className="fixed inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 70% 50% at 50% -5%, rgba(234,179,8,0.09) 0%, transparent 60%)" }} />
      </div>

      <div style={{ position: "relative", zIndex: 10, maxWidth: 1000, margin: "0 auto", padding: "32px 20px" }}>

        {/* Back */}
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "#64748b", textDecoration: "none", marginBottom: 32 }}>
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </Link>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 32, alignItems: "start" }}>

          {/* Left — Info */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.4)", position: "relative", flexShrink: 0 }}>
                <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 3 }} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: "#fff", fontSize: 15 }}>City Real Space CRM</div>
                <div style={{ fontSize: 12, color: "#eab308" }}>Start your free trial today</div>
              </div>
            </div>

            <h1 style={{ fontSize: "clamp(26px, 4vw, 38px)", fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 12 }}>
              14-Day Free Trial
              <br />
              <span style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>
                No Credit Card
              </span>
            </h1>
            <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
              Get full access to City Real Space CRM. Our team will set up your account and give you a personal onboarding call.
            </p>

            <ul style={{ listStyle: "none", padding: 0, margin: "0 0 32px", display: "flex", flexDirection: "column", gap: 12 }}>
              {PERKS.map(p => (
                <li key={p} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: "#cbd5e1" }}>
                  <CheckCircle2 style={{ width: 18, height: 18, color: "#eab308", flexShrink: 0 }} /> {p}
                </li>
              ))}
            </ul>

            {/* Contact direct */}
            <div style={{ padding: "20px", borderRadius: 16, background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.15)" }}>
              <p style={{ fontSize: 12, color: "#64748b", marginBottom: 12, fontWeight: 600, letterSpacing: "0.05em" }}>OR REACH US DIRECTLY</p>
              <a href="tel:+919876543210" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#eab308", textDecoration: "none", marginBottom: 8 }}>
                <Phone className="w-4 h-4" /> +91 98765 43210
              </a>
              <a href="mailto:info@cityrealspace.com" style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, color: "#94a3b8", textDecoration: "none" }}>
                <Mail className="w-4 h-4" /> info@cityrealspace.com
              </a>
            </div>
          </div>

          {/* Right — Form */}
          <div style={{ padding: "32px 28px", borderRadius: 24, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(234,179,8,0.12)" }}>
            {done ? (
              <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Check style={{ width: 28, height: 28, color: "#eab308" }} />
                </div>
                <h3 style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Request Received!</h3>
                <p style={{ fontSize: 14, color: "#64748b", marginBottom: 24, lineHeight: 1.6 }}>
                  Our team will contact you within <strong style={{ color: "#eab308" }}>2 hours</strong> to set up your free trial.
                </p>
                <Link href="/"
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 22px", borderRadius: 12, fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none" }}>
                  Back to Home
                </Link>
              </motion.div>
            ) : (
              <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Get Started Free</h2>
                <p style={{ fontSize: 13, color: "#64748b", marginBottom: 8 }}>Fill in your details — we&apos;ll set everything up for you.</p>

                {[
                  { key: "name",    label: "Your Name",    icon: User,      type: "text",  placeholder: "Rajesh Patel" },
                  { key: "company", label: "Company Name", icon: Building2, type: "text",  placeholder: "City Real Space" },
                  { key: "phone",   label: "Phone Number", icon: Phone,     type: "tel",   placeholder: "+91 98765 43210" },
                  { key: "email",   label: "Email Address",icon: Mail,      type: "email", placeholder: "you@company.com" },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>{f.label}</label>
                    <div style={{ position: "relative" }}>
                      <f.icon style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#475569" }} />
                      <input
                        required type={f.type} placeholder={f.placeholder}
                        value={(form as Record<string, string>)[f.key]}
                        onChange={e => set(f.key, e.target.value)}
                        style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f1f5f9", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                ))}

                {/* Plan select */}
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>Interested Plan</label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {PLANS.map(p => (
                      <label key={p} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, cursor: "pointer", background: form.plan === p ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.02)", border: form.plan === p ? "1px solid rgba(234,179,8,0.35)" : "1px solid rgba(255,255,255,0.06)", fontSize: 13, color: form.plan === p ? "#eab308" : "#64748b", transition: "all 0.15s" }}>
                        <input type="radio" name="plan" value={p} checked={form.plan === p} onChange={() => set("plan", p)} style={{ accentColor: "#eab308" }} />
                        {p}
                      </label>
                    ))}
                  </div>
                </div>

                {/* Message */}
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "#94a3b8", marginBottom: 6, fontWeight: 500 }}>Message (optional)</label>
                  <div style={{ position: "relative" }}>
                    <MessageSquare style={{ position: "absolute", left: 12, top: 12, width: 15, height: 15, color: "#475569" }} />
                    <textarea
                      rows={3} placeholder="Tell us about your team size, requirements..."
                      value={form.message} onChange={e => set("message", e.target.value)}
                      style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#f1f5f9", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
                    />
                  </div>
                </div>

                {error && <p style={{ fontSize: 13, color: "#f87171" }}>{error}</p>}

                <button type="submit" disabled={loading}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "13px", borderRadius: 12, fontSize: 14, fontWeight: 700, background: loading ? "rgba(234,179,8,0.4)" : "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", border: "none", cursor: loading ? "not-allowed" : "pointer", boxShadow: "0 0 20px rgba(234,179,8,0.25)" }}>
                  {loading ? <><Zap className="w-4 h-4 animate-spin" /> Sending...</> : <><Send className="w-4 h-4" /> Start My Free Trial</>}
                </button>

                <p style={{ fontSize: 11, color: "#334155", textAlign: "center" }}>
                  By submitting, you agree to be contacted by City Real Space team.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
