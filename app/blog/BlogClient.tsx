"use client";
import Link from "next/link";
import Image from "next/image";

const POSTS = [
  {
    slug: "best-real-estate-crm-ahmedabad",
    title: "Best Real Estate CRM Software in Ahmedabad 2025",
    desc: "Complete guide to choosing the right CRM for your Ahmedabad property brokerage. Features, pricing and comparison.",
    date: "January 2025",
    readTime: "5 min read",
    tag: "CRM Guide",
    color: "#eab308",
  },
  {
    slug: "whatsapp-automation-real-estate",
    title: "How WhatsApp Automation Helps Real Estate Brokers Close More Deals",
    desc: "Learn how Ahmedabad brokers use WhatsApp automation for follow-ups, reminders and bulk campaigns to 3x their conversions.",
    date: "January 2025",
    readTime: "4 min read",
    tag: "WhatsApp",
    color: "#10b981",
  },
  {
    slug: "ai-lead-scoring-property-brokers",
    title: "AI Lead Scoring for Property Brokers — How It Works",
    desc: "Understand how AI scores your real estate leads by budget, urgency and intent so you always call the hottest leads first.",
    date: "January 2025",
    readTime: "4 min read",
    tag: "AI & Automation",
    color: "#6366f1",
  },
];

export default function BlogClient() {
  return (
    <div style={{ minHeight: "100vh", background: "#030307", color: "#e2e8f0" }}>
      <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse 60% 40% at 50% 0%, rgba(234,179,8,0.08) 0%, transparent 60%)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 860, margin: "0 auto", padding: "48px 20px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 48 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none" }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, overflow: "hidden", background: "#fff", border: "1.5px solid rgba(234,179,8,0.5)", position: "relative" }}>
              <Image src="/logo.jpeg" alt="CRS" fill className="object-contain" style={{ padding: 3 }} />
            </div>
            <span style={{ fontWeight: 700, color: "#fff", fontSize: 14 }}>City Real Space CRM</span>
          </Link>
          <span style={{ color: "#334155" }}>·</span>
          <span style={{ fontSize: 13, color: "#64748b" }}>Blog</span>
        </div>

        <h1 style={{ fontSize: "clamp(28px, 5vw, 48px)", fontWeight: 900, color: "#fff", marginBottom: 12, letterSpacing: "-0.02em" }}>
          Real Estate CRM Blog
        </h1>
        <p style={{ fontSize: 15, color: "#64748b", marginBottom: 48, lineHeight: 1.7 }}>
          Guides and tips for <strong style={{ color: "#94a3b8" }}>Ahmedabad real estate brokers</strong> — CRM, automation, lead management and more.
        </p>

        {/* Posts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {POSTS.map(post => (
            <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
              <article style={{ padding: "28px", borderRadius: 20, background: "rgba(255,255,255,0.02)", border: `1px solid ${post.color}18`, transition: "border-color 0.2s", cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: `${post.color}15`, border: `1px solid ${post.color}30`, color: post.color }}>
                    {post.tag}
                  </span>
                  <span style={{ fontSize: 12, color: "#475569" }}>{post.date}</span>
                  <span style={{ fontSize: 12, color: "#475569" }}>· {post.readTime}</span>
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: "#f1f5f9", marginBottom: 8, letterSpacing: "-0.01em" }}>{post.title}</h2>
                <p style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{post.desc}</p>
                <div style={{ marginTop: 16, fontSize: 13, color: post.color, fontWeight: 600 }}>Read article →</div>
              </article>
            </Link>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginTop: 56, padding: "32px", borderRadius: 20, background: "rgba(234,179,8,0.04)", border: "1px solid rgba(234,179,8,0.15)", textAlign: "center" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Ready to try India&apos;s best real estate CRM?</p>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>14-day free trial · No credit card · Ahmedabad&apos;s #1 broker CRM</p>
          <Link href="/free-trial" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none" }}>
            Start Free Trial →
          </Link>
        </div>
      </div>
    </div>
  );
}
