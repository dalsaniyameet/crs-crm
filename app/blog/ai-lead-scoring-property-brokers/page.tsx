import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "AI Lead Scoring for Property Brokers — How It Works | City Real Space CRM",
  description: "Learn how AI lead scoring helps Ahmedabad real estate brokers identify hot leads instantly. City Real Space CRM scores leads 0-100 using GPT-4o based on budget, urgency and intent.",
  alternates: { canonical: "https://cityrealspacecrm.com/blog/ai-lead-scoring-property-brokers" },
  openGraph: {
    title: "AI Lead Scoring for Property Brokers — How It Works",
    description: "How City Real Space CRM uses GPT-4o to score leads 0-100 so Ahmedabad brokers always call the hottest leads first.",
    url: "https://cityrealspacecrm.com/blog/ai-lead-scoring-property-brokers",
    images: [{ url: "https://cityrealspacecrm.com/logo.jpeg", width: 1200, height: 630, alt: "AI Lead Scoring Real Estate" }],
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "AI Lead Scoring for Property Brokers — How It Works",
  "description": "How AI scores real estate leads for Ahmedabad property brokers using GPT-4o.",
  "url": "https://cityrealspacecrm.com/blog/ai-lead-scoring-property-brokers",
  "datePublished": "2025-01-10",
  "dateModified": new Date().toISOString().split("T")[0],
  "author": { "@type": "Organization", "name": "City Real Space", "url": "https://cityrealspace.com" },
  "publisher": {
    "@type": "Organization",
    "name": "City Real Space",
    "logo": { "@type": "ImageObject", "url": "https://cityrealspacecrm.com/logo.jpeg" }
  },
};

export default function BlogPost3() {
  return (
    <div style={{ minHeight: "100vh", background: "#030307", color: "#e2e8f0" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <div style={{ position: "relative", zIndex: 10, maxWidth: 760, margin: "0 auto", padding: "48px 20px" }}>

        <nav style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#475569", marginBottom: 36 }}>
          <Link href="/" style={{ color: "#64748b", textDecoration: "none" }}>Home</Link>
          <span>›</span>
          <Link href="/blog" style={{ color: "#64748b", textDecoration: "none" }}>Blog</Link>
          <span>›</span>
          <span style={{ color: "#94a3b8" }}>AI Lead Scoring for Brokers</span>
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999, background: "rgba(99,102,241,0.12)", border: "1px solid rgba(99,102,241,0.3)", color: "#818cf8" }}>AI & Automation</span>
          <span style={{ fontSize: 12, color: "#475569" }}>January 2025 · 4 min read</span>
        </div>

        <h1 style={{ fontSize: "clamp(26px, 4vw, 42px)", fontWeight: 900, color: "#fff", lineHeight: 1.2, marginBottom: 20, letterSpacing: "-0.02em" }}>
          AI Lead Scoring for Property Brokers — How It Works
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 36, paddingBottom: 36, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", background: "#fff", border: "1px solid rgba(234,179,8,0.3)", position: "relative" }}>
            <Image src="/logo.jpeg" alt="City Real Space" fill className="object-contain" style={{ padding: 2 }} />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#cbd5e1" }}>City Real Space</div>
            <div style={{ fontSize: 12, color: "#475569" }}>
              <Link href="https://cityrealspace.com" target="_blank" rel="noopener noreferrer" style={{ color: "#eab308", textDecoration: "none" }}>cityrealspace.com</Link>
              {" · Ahmedabad"}
            </div>
          </div>
        </div>

        <div style={{ fontSize: 15, lineHeight: 1.85, color: "#94a3b8" }}>

          <p style={{ marginBottom: 24 }}>
            Every day, Ahmedabad real estate brokers receive dozens of enquiries — but not all leads are equal. Some are ready to buy this week, others are &quot;just browsing&quot;. Calling the wrong leads first wastes hours. <strong style={{ color: "#e2e8f0" }}>AI lead scoring</strong> solves this by automatically ranking every lead so you always know who to call first.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12, marginTop: 40 }}>What is AI Lead Scoring?</h2>
          <p style={{ marginBottom: 24 }}>
            AI lead scoring is a system that analyzes each lead&apos;s data — budget, property type, urgency, communication history, source — and assigns a <strong style={{ color: "#e2e8f0" }}>score from 0 to 100</strong>. A score of 80+ means the lead is hot and likely to convert. Below 40 means the lead needs nurturing first.
          </p>

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12, marginTop: 40 }}>How City Real Space CRM Scores Your Leads</h2>
          <p style={{ marginBottom: 16 }}>Our CRM uses <strong style={{ color: "#e2e8f0" }}>GPT-4o</strong> to analyze multiple signals for each lead:</p>

          {[
            { factor: "💰 Budget Match", desc: "How well does the lead's stated budget match available properties? A lead with ₹80L budget for 3BHK in Bopal scores higher than one with unrealistic expectations." },
            { factor: "⏰ Urgency Signals", desc: "Keywords like 'immediate', 'this month', 'urgent possession' push scores up. 'Just exploring' or 'next year' push scores down." },
            { factor: "📱 Response Rate", desc: "A lead who replies within 30 minutes scores higher than one who takes 3 days. Engagement pattern matters." },
            { factor: "🏠 Property Type Clarity", desc: "Leads who clearly specify 2BHK vs 3BHK, commercial vs residential, specific locations score higher — they know what they want." },
            { factor: "📊 Lead Source Quality", desc: "Leads from direct referrals score higher than cold web enquiries. CRM tracks source quality over time." },
          ].map((f, i) => (
            <div key={i} style={{ padding: "18px 22px", borderRadius: 14, background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", marginBottom: 12 }}>
              <div style={{ fontWeight: 700, color: "#f1f5f9", fontSize: 15, marginBottom: 5 }}>{f.factor}</div>
              <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{f.desc}</div>
            </div>
          ))}

          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 12, marginTop: 40 }}>The 3 Lead Categories</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
            {[
              { label: "🔥 HOT Lead (80–100)", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)", desc: "Call immediately. High budget, clear requirements, urgent timeline. These leads close within days." },
              { label: "🌡️ WARM Lead (60–79)", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)", desc: "Follow up today. Interested but needs more information or has minor budget constraints." },
              { label: "❄️ COLD Lead (0–59)", color: "#3b82f6", bg: "rgba(59,130,246,0.08)", border: "rgba(59,130,246,0.25)", desc: "Add to nurture sequence. Not ready now but could convert in 3–6 months with automated follow-ups." },
            ].map(l => (
              <div key={l.label} style={{ padding: "18px 22px", borderRadius: 14, background: l.bg, border: `1px solid ${l.border}` }}>
                <div style={{ fontWeight: 700, color: l.color, fontSize: 15, marginBottom: 5 }}>{l.label}</div>
                <div style={{ fontSize: 14, color: "#64748b", lineHeight: 1.7 }}>{l.desc}</div>
              </div>
            ))}
          </div>

          <p style={{ marginBottom: 24 }}>
            <strong style={{ color: "#e2e8f0" }}>City Real Space</strong> — Ahmedabad&apos;s leading property brokerage at{" "}
            <Link href="https://cityrealspace.com" target="_blank" rel="noopener noreferrer" style={{ color: "#eab308" }}>cityrealspace.com</Link>
            {" "}— uses this exact AI scoring system internally for all leads. Now it&apos;s available to every broker through our CRM platform.
          </p>
        </div>

        <div style={{ marginTop: 48, padding: "32px", borderRadius: 20, background: "rgba(99,102,241,0.04)", border: "1px solid rgba(99,102,241,0.2)", textAlign: "center" }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", marginBottom: 8 }}>Get AI Lead Scoring for Your Brokerage</p>
          <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>14-day free trial · GPT-4o powered · No credit card</p>
          <Link href="/free-trial" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "12px 28px", borderRadius: 14, fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg,#ca8a04,#eab308)", color: "#050508", textDecoration: "none" }}>
            Start Free Trial →
          </Link>
        </div>

        <div style={{ marginTop: 32, paddingTop: 24, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <Link href="/blog" style={{ fontSize: 13, color: "#475569", textDecoration: "none" }}>← Back to Blog</Link>
        </div>
      </div>
    </div>
  );
}
