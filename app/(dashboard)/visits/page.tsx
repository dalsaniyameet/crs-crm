"use client";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Calendar, Clock, MapPin, User, CheckCircle, XCircle, Phone, MessageSquare, Loader2, X, CalendarPlus, Building2 } from "lucide-react";
import toast from "react-hot-toast";

type VisitStatus = "SCHEDULED" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";

interface Visit {
  id: string;
  scheduledAt: string;
  status: VisitStatus;
  feedback?: string;
  notes?: string;
  customPropertyName?: string;
  customPropertyLocality?: string;
  customPropertyOwnerName?: string;
  customPropertyOwnerPhone?: string;
  customPropertyPrice?: number;
  lead: { id: string; name: string; phone: string; budget?: number; requirements?: string };
  property?: { id: string; title: string; locality: string; city?: string; ownerName?: string; ownerPhone?: string; price?: number; transactionType?: string; address?: string };
  broker?: { id: string; name: string };
}

const fmtPrice = (p?: number, tx?: string) => {
  if (!p) return null;
  const v = p >= 10000000 ? `₹${(p/10000000).toFixed(1)}Cr` : p >= 100000 ? `₹${(p/100000).toFixed(1)}L` : `₹${(p/1000).toFixed(0)}K`;
  return tx === "RENT" || tx === "LEASE" ? `${v}/mo` : v;
};
const fmtBudget = (b?: number) => {
  if (!b) return null;
  const val = b < 1000 ? b * 100000 : b;
  return val >= 10000000 ? `₹${(val/10000000).toFixed(1)}Cr` : val >= 100000 ? `₹${(val/100000).toFixed(1)}L` : `₹${(val/1000).toFixed(0)}K`;
};
const getGoogleMapsUrl = (property?: Visit["property"]) => {
  if (!property) return null;
  const q = [property.address, property.locality, property.city, "Ahmedabad"].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

const statusConfig: Record<VisitStatus, { label: string; color: string; bg: string }> = {
  SCHEDULED:  { label: "Scheduled",  color: "text-blue-400",    bg: "bg-blue-500/20 border-blue-500/30" },
  CONFIRMED:  { label: "Confirmed",  color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  COMPLETED:  { label: "Completed",  color: "text-gold-400",    bg: "bg-gold-500/20 border-gold-500/30" },
  CANCELLED:  { label: "Cancelled",  color: "text-red-400",     bg: "bg-red-500/20 border-red-500/30" },
  NO_SHOW:    { label: "No Show",    color: "text-orange-400",  bg: "bg-orange-500/20 border-orange-500/30" },
};

export default function VisitsPage() {
  const searchParams = useSearchParams();
  const [visits, setVisits]     = useState<Visit[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState("ALL");
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leads, setLeads]       = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [brokers, setBrokers]   = useState<any[]>([]);
  const [gcalConnected, setGcalConnected] = useState<boolean | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);

  const [form, setForm] = useState({
    leadId: "", propertyId: "", brokerId: "", scheduledAt: "", notes: "", addToCalendar: true,
    useManualProperty: false,
    customPropertyName: "", customPropertyLocality: "",
    customPropertyOwnerName: "", customPropertyOwnerPhone: "", customPropertyPrice: "",
  });

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) setHighlightId(id);
  }, []);

  const fetchVisits = useCallback(async () => {
    try {
      const res  = await fetch("/api/visits");
      const data = await res.json();
      setVisits(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load visits");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVisits();
    fetch("/api/leads?limit=100").then(r => r.json()).then(d => setLeads(d.leads ?? []));
    fetch("/api/properties?limit=100").then(r => r.json()).then(d => setProperties(d.properties ?? []));
    fetch("/api/brokers").then(r => r.json()).then(d => setBrokers(Array.isArray(d) ? d : []));
  }, [fetchVisits]);

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    const propertyId = searchParams.get("propertyId");
    if (leadId) {
      setForm(f => ({ ...f, leadId, propertyId: propertyId || f.propertyId }));
      setShowModal(true);
    }
  }, [searchParams]);

  const createNoShowFollowup = async (visit: Visit) => {
    try {
      await fetch("/api/leads/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: visit.lead.id,
          title: `Re-engage after no-show for visit on ${new Date(visit.scheduledAt).toLocaleDateString("en-IN")}`,
          description: `Lead did not attend the site visit for ${visit.property?.title || "property"}. Follow up for reschedule and feedback.`,
          dueAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          priority: "HIGH",
        }),
      });
      toast.success("No-show follow-up task created");
    } catch {
      toast.error("Failed to create follow-up task");
    }
  };

  const updateStatus = async (id: string, status: VisitStatus) => {
    const visit = visits.find(v => v.id === id);
    setVisits(prev => prev.map(v => v.id === id ? { ...v, status } : v));
    try {
      const res = await fetch(`/api/visits/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...(status === "COMPLETED" ? { completedAt: new Date() } : {}) }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Marked as ${statusConfig[status].label}`);
      if (status === "NO_SHOW" && visit) {
        await createNoShowFollowup(visit);
      }
    } catch {
      fetchVisits();
      toast.error("Failed to update");
    }
  };

  const handleSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.useManualProperty && !form.propertyId) {
      // Allow no property — just warn
    }
    setSubmitting(true);
    try {
      const body: any = {
        leadId:      form.leadId,
        propertyId:  (!form.useManualProperty && form.propertyId) ? form.propertyId : undefined,
        brokerId:    form.brokerId || undefined,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        notes:       form.notes || undefined,
        status:      "SCHEDULED",
      };
      if (form.useManualProperty) {
        body.customPropertyName       = form.customPropertyName || undefined;
        body.customPropertyLocality   = form.customPropertyLocality || undefined;
        body.customPropertyOwnerName  = form.customPropertyOwnerName || undefined;
        body.customPropertyOwnerPhone = form.customPropertyOwnerPhone || undefined;
        body.customPropertyPrice      = form.customPropertyPrice ? Number(form.customPropertyPrice) : undefined;
      }
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();

      // If manual property — also save to properties DB
      if (form.useManualProperty && form.customPropertyName) {
        fetch("/api/properties", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:           form.customPropertyName,
            type:            "OFFICE",
            category:        "COMMERCIAL",
            transactionType: "RENT",
            status:          "AVAILABLE",
            price:           form.customPropertyPrice ? Number(form.customPropertyPrice) : 0,
            area:            0,
            locality:        form.customPropertyLocality || "Ahmedabad",
            city:            "Ahmedabad",
            ownerName:       form.customPropertyOwnerName || undefined,
            ownerPhone:      form.customPropertyOwnerPhone || undefined,
          }),
        }).then(r => r.json()).then(p => {
          if (p.id) {
            // Update visit with property ID
            fetch(`/api/visits`, { method: "GET" }).catch(() => {});
            toast("Property saved to listings too ✅");
          }
        }).catch(() => {});
      }

      toast.success("Visit scheduled!");

      // Auto-add to Google Calendar
      if (form.addToCalendar) {
        const lead     = leads.find(l => l.id === form.leadId);
        const property = form.useManualProperty
          ? { title: form.customPropertyName, locality: form.customPropertyLocality }
          : properties.find(p => p.id === form.propertyId);
        const start = new Date(form.scheduledAt);
        const end   = new Date(start.getTime() + 60 * 60 * 1000);
        fetch("/api/google/calendar", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title:       `Site Visit – ${lead?.name || "Client"}${property?.title ? ` @ ${property.title}` : ""}`,
            description: `Lead: ${lead?.name} (${lead?.phone})\nProperty: ${property?.title || "TBD"}\n${form.customPropertyOwnerName ? `Owner: ${form.customPropertyOwnerName} (${form.customPropertyOwnerPhone})` : ""}\nNotes: ${form.notes || "-"}`,
            startTime:   start.toISOString(),
            endTime:     end.toISOString(),
            attendeeEmail: lead?.email || undefined,
          }),
        }).then(r => r.json()).then(d => {
          if (d.success) toast.success("Added to Google Calendar! 📅");
        }).catch(() => {});
      }

      setShowModal(false);
      setForm({ leadId: "", propertyId: "", brokerId: "", scheduledAt: "", notes: "", addToCalendar: true, useManualProperty: false, customPropertyName: "", customPropertyLocality: "", customPropertyOwnerName: "", customPropertyOwnerPhone: "", customPropertyPrice: "" });
      fetchVisits();
    } catch {
      toast.error("Failed to schedule visit");
    } finally {
      setSubmitting(false);
    }
  };

  const filtered = visits.filter(v => filter === "ALL" || v.status === filter);

  const today = new Date();
  const isToday = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  const counts = {
    today:     visits.filter(v => isToday(v.scheduledAt)).length,
    upcoming:  visits.filter(v => v.status === "SCHEDULED" || v.status === "CONFIRMED").length,
    completed: visits.filter(v => v.status === "COMPLETED").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-full py-32">
      <Loader2 className="w-8 h-8 text-estate-400 animate-spin" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Site Visits</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            <span className="text-red-400">{counts.today} today</span> · {counts.upcoming} upcoming · {counts.completed} completed
          </p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Schedule Visit</span><span className="sm:hidden">Schedule</span>
        </button>
      </div>



      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Today's Visits",  value: counts.today,     icon: Calendar,     color: "text-red-400" },
          { label: "Upcoming",        value: counts.upcoming,  icon: Clock,        color: "text-blue-400" },
          { label: "Completed (MTD)", value: counts.completed, icon: CheckCircle,  color: "text-emerald-400" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {["ALL", "SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"].map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === s
                ? "bg-estate-600/30 border border-estate-500/50 text-estate-400"
                : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white"
            }`}>
            {s === "ALL" ? "All Visits" : statusConfig[s as VisitStatus]?.label ?? s}
          </button>
        ))}
      </div>

      {/* Visit Cards */}
      <div className="space-y-3">
        <AnimatePresence>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No visits found. Schedule your first visit!</p>
            </div>
          ) : filtered.map((visit, i) => {
            const cfg     = statusConfig[visit.status];
            const todayV  = isToday(visit.scheduledAt);
            const dateObj = new Date(visit.scheduledAt);
            return (
              <motion.div key={visit.id}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`glass-card p-3 md:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3 hover:bg-white/5 transition-colors ${
                  todayV ? "border-l-2 border-l-red-500" : ""
                } ${
                  highlightId === visit.id ? "ring-2 ring-estate-500/60 bg-estate-900/20" : ""
                }`}>
                {/* Time */}
                <div className="flex sm:flex-col items-center sm:items-center gap-2 sm:gap-0 sm:w-24 flex-shrink-0">
                  <div className={`text-sm font-bold ${todayV ? "text-red-400" : "text-white"}`}>
                    {todayV ? "Today" : dateObj.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {dateObj.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>

                <div className="hidden sm:block w-px h-12 bg-white/10 flex-shrink-0" />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-white">{visit.lead?.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>
                    {todayV && <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 animate-pulse">⚡ Today</span>}
                  </div>
                  {/* Client */}
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <a href={`tel:${visit.lead?.phone}`} className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300">
                      <Phone className="w-3 h-3" /> {visit.lead?.phone}
                    </a>
                    {fmtBudget(visit.lead?.budget) && (
                      <span className="text-xs text-yellow-400 font-semibold">💰 {fmtBudget(visit.lead?.budget)}</span>
                    )}
                    {visit.lead?.requirements && (
                      <span className="text-xs text-muted-foreground truncate max-w-[160px]">📋 {visit.lead.requirements}</span>
                    )}
                  </div>
                  {/* Property + Google Maps */}
                  {(visit.property || visit.customPropertyName) && (
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {visit.property ? (
                        <a href={getGoogleMapsUrl(visit.property) ?? "#"} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                          <MapPin className="w-3 h-3" /> {visit.property.title} — {visit.property.locality}
                        </a>
                      ) : (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((visit.customPropertyName||"")+" "+(visit.customPropertyLocality||"")+" Ahmedabad")}`}
                          target="_blank" rel="noreferrer"
                          className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300">
                          <MapPin className="w-3 h-3" /> {visit.customPropertyName}{visit.customPropertyLocality ? ` — ${visit.customPropertyLocality}` : ""}
                          <span className="ml-1 text-xs text-yellow-500">(Manual)</span>
                        </a>
                      )}
                      {(visit.property?.price || visit.customPropertyPrice) && (
                        <span className="text-xs text-gold-400 font-semibold">
                          {fmtPrice(visit.property?.price || visit.customPropertyPrice, visit.property?.transactionType)}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Owner */}
                  {(visit.property?.ownerName || visit.customPropertyOwnerName) && (
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-xs text-muted-foreground">👤 <span className="text-white">{visit.property?.ownerName || visit.customPropertyOwnerName}</span></span>
                      {(visit.property?.ownerPhone || visit.customPropertyOwnerPhone) && (
                        <a href={`tel:${visit.property?.ownerPhone || visit.customPropertyOwnerPhone}`} className="text-xs text-emerald-400 hover:text-emerald-300">
                          <Phone className="w-3 h-3 inline mr-0.5" />{visit.property?.ownerPhone || visit.customPropertyOwnerPhone}
                        </a>
                      )}
                    </div>
                  )}
                  {visit.broker && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" /> {visit.broker.name}
                    </div>
                  )}
                  {visit.feedback && (
                    <div className="mt-2 text-xs text-gold-400 bg-gold-500/10 border border-gold-500/20 rounded-lg px-3 py-1.5">
                      💬 {visit.feedback}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <a href={`tel:${visit.lead?.phone}`}
                    className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-emerald-400 transition-colors">
                    <Phone className="w-4 h-4" />
                  </a>
                  <a href={`https://wa.me/91${visit.lead?.phone}`} target="_blank" rel="noreferrer"
                    className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-green-400 transition-colors">
                    <MessageSquare className="w-4 h-4" />
                  </a>
                  {(visit.status === "SCHEDULED" || visit.status === "CONFIRMED") && (
                    <button onClick={() => updateStatus(visit.id, "COMPLETED")}
                      className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-emerald-400 transition-colors" title="Mark Complete">
                      <CheckCircle className="w-4 h-4" />
                    </button>
                  )}
                  {visit.status === "COMPLETED" && (
                    <button onClick={() => window.location.href = `/deals?leadId=${visit.lead.id}${visit.property?.id ? `&propertyId=${visit.property.id}` : ``}`}
                      className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-blue-400 transition-colors" title="Convert to Deal">
                      <Building2 className="w-4 h-4" />
                    </button>
                  )}
                  {visit.status === "SCHEDULED" && (
                    <button onClick={() => updateStatus(visit.id, "CANCELLED")}
                      className="p-2 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-red-400 transition-colors" title="Cancel">
                      <XCircle className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-md p-5 md:p-6 rounded-t-2xl md:rounded-xl max-h-[92dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Schedule Site Visit</h2>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleSchedule} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Select Lead *</label>
                  <select required value={form.leadId} onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                    <option value="">Choose lead</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name} – {l.phone}</option>)}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs text-muted-foreground">Select Property</label>
                    <button type="button"
                      onClick={() => setForm(f => ({ ...f, useManualProperty: !f.useManualProperty, propertyId: "" }))}
                      className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                        form.useManualProperty
                          ? "bg-yellow-500/20 border-yellow-500/30 text-yellow-400"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                      }`}>
                      {form.useManualProperty ? "✅ Manual Entry" : "+ Manual Property"}
                    </button>
                  </div>

                  {!form.useManualProperty ? (
                    <select value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                      <option value="">Choose property (optional)</option>
                      {properties.map(p => <option key={p.id} value={p.id}>{p.title} – {p.locality}</option>)}
                    </select>
                  ) : (
                    <div className="space-y-2 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/20">
                      <p className="text-xs text-yellow-400 font-medium">🏢 Manual Property Details</p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Property Name *</label>
                          <input value={form.customPropertyName}
                            onChange={e => setForm(f => ({ ...f, customPropertyName: e.target.value }))}
                            placeholder="Office 800sqft Satellite"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/40" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Locality</label>
                          <input value={form.customPropertyLocality}
                            onChange={e => setForm(f => ({ ...f, customPropertyLocality: e.target.value }))}
                            placeholder="Prahlad Nagar"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/40" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">👤 Owner Name</label>
                          <input value={form.customPropertyOwnerName}
                            onChange={e => setForm(f => ({ ...f, customPropertyOwnerName: e.target.value }))}
                            placeholder="Suresh Patel"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/40" />
                        </div>
                        <div>
                          <label className="text-xs text-muted-foreground mb-1 block">Owner Phone</label>
                          <input value={form.customPropertyOwnerPhone}
                            onChange={e => setForm(f => ({ ...f, customPropertyOwnerPhone: e.target.value }))}
                            placeholder="9876543210"
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/40" />
                        </div>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Price (optional)</label>
                        <input type="number" value={form.customPropertyPrice}
                          onChange={e => setForm(f => ({ ...f, customPropertyPrice: e.target.value }))}
                          placeholder="50000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-yellow-500/40" />
                      </div>
                      <p className="text-xs text-yellow-400/70">✨ Yeh property automatically Properties section mein bhi save ho jayegi</p>
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Date & Time *</label>
                  <input required type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  {form.scheduledAt && (
                    <p className="text-xs mt-2 text-green-300">
                      Reminder will be sent 2 hours before visit: {new Date(new Date(form.scheduledAt).getTime() - 2 * 60 * 60 * 1000).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Assign Broker</label>
                  <select value={form.brokerId} onChange={e => setForm(f => ({ ...f, brokerId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                    <option value="">Unassigned</option>
                    {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 resize-none"
                    placeholder="Any special instructions..." />
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <MessageSquare className="w-4 h-4 text-green-400 flex-shrink-0" />
                  <span className="text-xs text-green-400">WhatsApp reminder will be sent to client before visit</span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2">
                    <CalendarPlus className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-xs text-blue-400">Add to Google Calendar</span>
                  </div>
                  <button type="button" onClick={() => setForm(f => ({ ...f, addToCalendar: !f.addToCalendar }))}
                    className={`relative w-10 h-5 rounded-full transition-colors ${
                      form.addToCalendar ? "bg-blue-500" : "bg-white/10"
                    }`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                      form.addToCalendar ? "translate-x-5" : "translate-x-0.5"
                    }`} />
                  </button>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule Visit"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
