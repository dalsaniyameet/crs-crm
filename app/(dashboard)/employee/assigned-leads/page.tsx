"use client";
import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Phone, MapPin, Building2, User, ChevronDown, ChevronUp,
  Camera, X, CheckCircle2, AlertCircle, ClipboardList, Star,
  ArrowRight, MessageSquare, Upload,
} from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

const INTEREST_OPTS = [
  { val: "HOT",  label: "🔥 HOT — Ready to close",        color: "text-red-400",    bg: "bg-red-500/10 border-red-500/30" },
  { val: "WARM", label: "🌡️ WARM — Interested, needs time", color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/30" },
  { val: "COLD", label: "❄️ COLD — Not interested yet",     color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/30" },
];

const NEXT_STEPS = [
  { val: "FOLLOW_UP",      label: "📞 Follow Up Call" },
  { val: "ANOTHER_VISIT",  label: "🏠 Another Site Visit" },
  { val: "NEGOTIATION",    label: "💰 Start Negotiation" },
  { val: "DEAL_CLOSED",    label: "✅ Deal Closed!" },
  { val: "NOT_INTERESTED", label: "❌ Not Interested" },
];

function fmtBudget(n?: number | null) {
  if (!n) return "—";
  return n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
    : n >= 100000 ? `₹${(n / 100000).toFixed(1)}L`
    : `₹${n.toLocaleString("en-IN")}`;
}

function EmptyProp() {
  return { propertyName: "", locality: "", ownerName: "", ownerPhone: "", price: "", locationConfirmed: false };
}

export default function AssignedLeadsPage() {
  const { user, isLoaded } = useUser();
  const [leads, setLeads]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  // Per-lead form state
  const [forms, setForms] = useState<Record<string, any>>({});
  // Past reports per lead
  const [reports, setReports] = useState<Record<string, any[]>>({});

  useEffect(() => {
    if (!isLoaded) return;
    fetch("/api/leads?limit=100")
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : d.leads || [];
        setLeads(arr);
        // Init form state for each lead
        const init: Record<string, any> = {};
        arr.forEach((l: any) => {
          init[l.id] = {
            propertiesShown:      [EmptyProp()],
            clientInterest:       "WARM",
            clientFeedback:       "",
            budgetConfirmed:      l.budget || "",
            requirementConfirmed: l.requirements || "",
            locationConfirmed:    false,
            locationNotes:        "",
            nextStep:             "FOLLOW_UP",
            nextFollowUpDate:     "",
            notes:                "",
            visitPhotoUrl:        "",
            visitDate:            new Date().toISOString().split("T")[0],
          };
        });
        setForms(init);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isLoaded]);

  function loadReports(leadId: string) {
    fetch(`/api/leads/${leadId}/visit-report`)
      .then(r => r.json())
      .then(d => setReports(p => ({ ...p, [leadId]: Array.isArray(d) ? d : [] })))
      .catch(() => {});
  }

  function setField(leadId: string, key: string, val: any) {
    setForms(p => ({ ...p, [leadId]: { ...p[leadId], [key]: val } }));
  }

  function setPropField(leadId: string, idx: number, key: string, val: any) {
    setForms(p => {
      const props = [...(p[leadId]?.propertiesShown || [])];
      props[idx] = { ...props[idx], [key]: val };
      return { ...p, [leadId]: { ...p[leadId], propertiesShown: props } };
    });
  }

  async function uploadPhoto(leadId: string, file: File) {
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "visit-proofs");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.url) throw new Error("Upload failed");
      setField(leadId, "visitPhotoUrl", data.url);
      toast.success("Photo uploaded ✅");
    } catch { toast.error("Photo upload failed"); }
    setUploadingPhoto(false);
  }

  async function submitReport(leadId: string) {
    const form = forms[leadId];
    if (!form) return;

    // Mandatory validation
    const firstProp = form.propertiesShown?.[0];
    if (!firstProp?.propertyName && !firstProp?.locality) {
      toast.error("Kam se kam 1 property ka naam ya locality dalo"); return;
    }
    if (!firstProp?.ownerName) {
      toast.error("Owner ka naam mandatory hai"); return;
    }
    if (!firstProp?.ownerPhone) {
      toast.error("Owner ka phone number mandatory hai"); return;
    }
    if (firstProp?.locationConfirmed === false && !form.locationNotes) {
      toast.error("Location confirm nahi toh reason batao (location notes mein)"); return;
    }
    if (!form.clientFeedback?.trim()) {
      toast.error("Client ka feedback mandatory hai"); return;
    }
    if (!form.nextFollowUpDate && form.nextStep !== "DEAL_CLOSED" && form.nextStep !== "NOT_INTERESTED") {
      toast.error("Next follow-up date dalna mandatory hai"); return;
    }

    setSubmitting(leadId);
    try {
      const res = await fetch(`/api/leads/${leadId}/visit-report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          propertiesShown: form.propertiesShown.filter((p: any) => p.propertyName || p.locality),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      const data = await res.json();
      toast.success("Visit report submitted! Admin ko notify kar diya ✅");
      // Auto-update this lead in list with new status/followup
      if (data.lead) {
        setLeads(prev => prev.map(l => l.id === leadId ? { ...l, ...data.lead } : l));
      }
      loadReports(leadId);
      // Reset form for this lead
      setForms(p => ({
        ...p,
        [leadId]: {
          ...p[leadId],
          clientFeedback: "",
          locationNotes: "",
          notes: "",
          visitPhotoUrl: "",
          visitDate: new Date().toISOString().split("T")[0],
          nextFollowUpDate: "",
        },
      }));
    } catch (e: any) {
      toast.error(e.message || "Submit failed");
    }
    setSubmitting(null);
  }

  const inp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-yellow-500/40";

  if (!isLoaded || loading) return (
    <div className="p-6 flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 animate-spin text-yellow-400" />
    </div>
  );

  if (leads.length === 0) return (
    <div className="p-6 text-center py-20 text-muted-foreground">
      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="text-sm font-medium text-white">Koi lead assign nahi hui abhi</p>
      <p className="text-xs mt-1">Admin se lead assignment ka wait karo</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-yellow-400" /> Meri Assigned Leads
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Har lead ke liye visit report fill karo — admin ko pata chale kya hua
        </p>
      </div>

      {leads.map(lead => {
        const form      = forms[lead.id] || {};
        const isOpen    = expanded === lead.id;
        const leadReports = reports[lead.id];

        return (
          <motion.div key={lead.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden">

            {/* Lead Header */}
            <button className="w-full p-4 flex items-center gap-3 text-left"
              onClick={() => {
                const next = isOpen ? null : lead.id;
                setExpanded(next);
                if (next && !reports[next]) loadReports(next);
              }}>
              <div className="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center text-sm font-bold text-yellow-400 flex-shrink-0">
                {lead.name?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-white text-sm">{lead.name}</span>
                  <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()}
                    className="text-xs text-emerald-400">📞 {lead.phone}</a>
                  {lead.score >= 80
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/15 text-red-400">🔥 HOT {lead.score}</span>
                    : lead.score >= 60
                    ? <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/15 text-orange-400">🌡️ WARM {lead.score}</span>
                    : <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400">❄️ COLD {lead.score}</span>
                  }
                </div>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  {lead.budget && <span className="text-xs text-yellow-400">💰 {fmtBudget(lead.budget)}</span>}
                  {lead.propertyType && <span className="text-xs text-muted-foreground">{lead.propertyType}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                    lead.status === "DEAL_CLOSED" ? "bg-emerald-500/20 text-emerald-400" :
                    lead.status === "NEGOTIATION" ? "bg-orange-500/20 text-orange-400" :
                    lead.status === "SITE_VISIT_SCHEDULED" ? "bg-purple-500/20 text-purple-400" :
                    lead.status === "CONTACTED" ? "bg-yellow-500/20 text-yellow-400" :
                    lead.status === "LOST" ? "bg-red-500/20 text-red-400" :
                    "bg-blue-500/20 text-blue-400"
                  }`}>
                    {lead.status?.replace(/_/g, " ")}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {leadReports?.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                    ✅ {leadReports.length} report{leadReports.length > 1 ? "s" : ""}
                  </span>
                )}
                {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
              </div>
            </button>

            <AnimatePresence>
              {isOpen && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="border-t border-white/8 overflow-hidden">
                  <div className="p-4 space-y-5">

                    {/* Past Reports */}
                    {leadReports && leadReports.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-yellow-400">📋 Previous Reports ({leadReports.length})</p>
                        {leadReports.slice(0, 2).map((r: any, i: number) => {
                          const m = r.metadata || {};
                          return (
                            <div key={i} className="p-3 rounded-xl bg-white/3 border border-white/8 space-y-1.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString("en-IN")}</span>
                                <span className={`text-xs font-semibold ${m.clientInterest === "HOT" ? "text-red-400" : m.clientInterest === "WARM" ? "text-orange-400" : "text-blue-400"}`}>
                                  {m.clientInterest === "HOT" ? "🔥 HOT" : m.clientInterest === "WARM" ? "🌡️ WARM" : "❄️ COLD"}
                                </span>
                                <span className="text-xs text-muted-foreground">→ {m.nextStep?.replace("_", " ")}</span>
                                {m.visitPhotoUrl && <span className="text-xs text-yellow-400">📸 Photo</span>}
                              </div>
                              {m.propertiesShown?.length > 0 && (
                                <p className="text-xs text-white">🏠 {m.propertiesShown.map((p: any) => p.propertyName || p.locality).filter(Boolean).join(", ")}</p>
                              )}
                              {m.clientFeedback && <p className="text-xs text-muted-foreground">{m.clientFeedback}</p>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* ── NEW VISIT REPORT FORM ── */}
                    <div className="space-y-4">
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <ClipboardList className="w-3.5 h-3.5 text-yellow-400" /> Naya Visit Report Submit Karo
                      </p>

                      {/* Visit Date */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">📅 Visit Date</label>
                        <input type="date" value={form.visitDate || ""}
                          max={new Date().toISOString().split("T")[0]}
                          onChange={e => setField(lead.id, "visitDate", e.target.value)}
                          className={`${inp} [color-scheme:dark]`} />
                      </div>

                      {/* ── Properties Shown ── */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-blue-400" /> Konsi Properties Dikhayein? *
                          </label>
                          <button type="button"
                            onClick={() => setForms(p => ({ ...p, [lead.id]: { ...p[lead.id], propertiesShown: [...(p[lead.id]?.propertiesShown || []), EmptyProp()] } }))}
                            className="text-xs px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25">
                            + Add Property
                          </button>
                        </div>

                        {(form.propertiesShown || [EmptyProp()]).map((prop: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-blue-500/5 border border-blue-500/15 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-blue-400">Property #{idx + 1}</span>
                              {(form.propertiesShown?.length || 0) > 1 && (
                                <button type="button" onClick={() => {
                                  const props = form.propertiesShown.filter((_: any, i: number) => i !== idx);
                                  setField(lead.id, "propertiesShown", props);
                                }} className="text-xs text-red-400">✕</button>
                              )}
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Property Name / Title</label>
                                <input value={prop.propertyName || ""} onChange={e => setPropField(lead.id, idx, "propertyName", e.target.value)}
                                  placeholder="Office 800sqft Satellite" className={inp} />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Locality / Area</label>
                                <div className="relative">
                                  <input value={prop.locality || ""} onChange={e => setPropField(lead.id, idx, "locality", e.target.value)}
                                    placeholder="Prahlad Nagar" className={inp} />
                                  {prop.locality && (
                                    <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(prop.locality + ", Ahmedabad")}`}
                                      target="_blank" rel="noreferrer"
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 text-xs">🗺️</a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">🏢 Owner Name <span className="text-red-400">*</span></label>
                                <input value={prop.ownerName || ""} onChange={e => setPropField(lead.id, idx, "ownerName", e.target.value)}
                                  placeholder="Suresh Patel" className={`${inp} ${!prop.ownerName && idx === 0 ? "border-red-500/40" : ""}`} />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Owner Phone <span className="text-red-400">*</span></label>
                                <div className="relative">
                                  <input value={prop.ownerPhone || ""} onChange={e => setPropField(lead.id, idx, "ownerPhone", e.target.value)}
                                    placeholder="9876543210" className={`${inp} ${!prop.ownerPhone && idx === 0 ? "border-red-500/40" : ""}`} />
                                  {prop.ownerPhone && (
                                    <a href={`tel:${prop.ownerPhone}`}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-emerald-400 text-xs">📞</a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 items-center">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 block">Price Quoted</label>
                                <input value={prop.price || ""} onChange={e => setPropField(lead.id, idx, "price", e.target.value)}
                                  placeholder="₹50,000/month" className={inp} />
                              </div>
                              <div>
                                <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
                                  <MapPin className="w-3 h-3 text-green-400" /> Location Client ko pasand aayi?
                                </label>
                                <div className="flex gap-2">
                                  {[true, false].map(v => (
                                    <button key={String(v)} type="button"
                                      onClick={() => setPropField(lead.id, idx, "locationConfirmed", v)}
                                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                                        prop.locationConfirmed === v
                                          ? v ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                                              : "bg-red-500/20 border-red-500/40 text-red-400"
                                          : "bg-white/5 border-white/10 text-muted-foreground"
                                      }`}>
                                      {v ? "✅ Haan" : "❌ Nahi"}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* ── Client Feedback ── */}
                      <div className="space-y-3">
                        <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-purple-400" /> Client Interest Level *
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {INTEREST_OPTS.map(opt => (
                            <button key={opt.val} type="button"
                              onClick={() => setField(lead.id, "clientInterest", opt.val)}
                              className={`py-2.5 px-2 rounded-xl text-xs font-semibold border transition-all text-center ${
                                form.clientInterest === opt.val ? opt.bg + " " + opt.color : "bg-white/5 border-white/10 text-muted-foreground"
                              }`}>
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Budget Confirmed (₹)</label>
                          <input type="number" value={form.budgetConfirmed || ""} onChange={e => setField(lead.id, "budgetConfirmed", e.target.value)}
                            placeholder={lead.budget || "0"} className={inp} />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Requirement Confirmed</label>
                          <input value={form.requirementConfirmed || ""} onChange={e => setField(lead.id, "requirementConfirmed", e.target.value)}
                            placeholder={lead.requirements || "Size, floor, type..."} className={inp} />
                        </div>
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">📍 Location Notes (kaunsa area pasand)</label>
                        <input value={form.locationNotes || ""} onChange={e => setField(lead.id, "locationNotes", e.target.value)}
                          placeholder="SG Highway prefer karta hai, Satellite nahi chahiye..." className={inp} />
                      </div>

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">💬 Client ka Feedback <span className="text-red-400">*</span></label>
                        <textarea rows={2} value={form.clientFeedback || ""} onChange={e => setField(lead.id, "clientFeedback", e.target.value)}
                          placeholder="Client ne kya bola visit ke baad..." className={`${inp} resize-none ${!form.clientFeedback?.trim() ? "border-red-500/30" : ""}`} />
                      </div>

                      {/* ── Next Step ── */}
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-white flex items-center gap-1.5">
                          <ArrowRight className="w-3.5 h-3.5 text-yellow-400" /> Next Step *
                        </label>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {NEXT_STEPS.map(s => (
                            <button key={s.val} type="button"
                              onClick={() => setField(lead.id, "nextStep", s.val)}
                              className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all text-left ${
                                form.nextStep === s.val
                                  ? "bg-yellow-500/15 border-yellow-500/35 text-yellow-300"
                                  : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                              }`}>
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {form.nextStep !== "DEAL_CLOSED" && form.nextStep !== "NOT_INTERESTED" && (
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">📅 Next Follow-up Date <span className="text-red-400">*</span></label>
                          <input type="date" value={form.nextFollowUpDate || ""}
                            min={new Date().toISOString().split("T")[0]}
                            onChange={e => setField(lead.id, "nextFollowUpDate", e.target.value)}
                            className={`${inp} [color-scheme:dark] ${!form.nextFollowUpDate ? "border-red-500/30" : "border-emerald-500/30"}`} />
                        </div>
                      )}

                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">📝 Internal Notes (admin ke liye)</label>
                        <textarea rows={2} value={form.notes || ""} onChange={e => setField(lead.id, "notes", e.target.value)}
                          placeholder="Koi bhi important info jo admin ko batani ho..." className={`${inp} resize-none`} />
                      </div>

                      {/* Visit Photo Proof */}
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1.5">
                          <Camera className="w-3.5 h-3.5 text-yellow-400" />
                          📸 Visit Photo Proof <span className="text-yellow-400">(property / client / location)</span>
                        </label>
                        {form.visitPhotoUrl ? (
                          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-emerald-500/8 border border-emerald-500/25">
                            <Image src={form.visitPhotoUrl} alt="visit" width={56} height={56}
                              className="rounded-lg object-cover border border-white/10 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-emerald-400 font-medium">✅ Photo uploaded</p>
                              <a href={form.visitPhotoUrl} target="_blank" rel="noreferrer"
                                className="text-xs text-blue-400">🔗 View full</a>
                            </div>
                            <button type="button" onClick={() => setField(lead.id, "visitPhotoUrl", "")}
                              className="text-red-400 hover:text-red-300">
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => photoRef.current?.click()} disabled={uploadingPhoto}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 border border-dashed border-white/20 text-xs text-muted-foreground hover:text-white hover:border-yellow-500/40 hover:bg-yellow-500/5 transition-all disabled:opacity-50">
                            {uploadingPhoto
                              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                              : <><Upload className="w-3.5 h-3.5" /> Upload visit photo (optional but recommended)</>}
                          </button>
                        )}
                        <input ref={photoRef} type="file" accept="image/*" className="hidden"
                          onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(lead.id, f); e.target.value = ""; }} />
                      </div>

                      {/* Submit */}
                      <button onClick={() => submitReport(lead.id)}
                        disabled={submitting === lead.id}
                        className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
                        {submitting === lead.id
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
                          : <><CheckCircle2 className="w-4 h-4" /> Submit Visit Report</>}
                      </button>

                      <div className="p-2.5 rounded-lg bg-yellow-500/8 border border-yellow-500/20">
                        <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span><span className="text-red-400">*</span> Mandatory: Owner naam, phone, client feedback, next follow-up date</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </div>
  );
}
