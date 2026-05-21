"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreVertical, Building2, User, DollarSign, TrendingUp, Zap, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

type DealStage = "ENQUIRY" | "SITE_VISIT" | "NEGOTIATION" | "TOKEN" | "AGREEMENT" | "REGISTRATION" | "CLOSED" | "CANCELLED";

interface Deal {
  id: string;
  title: string;
  stage: DealStage;
  value: number;
  commission?: number;
  commissionRate?: number;
  notes?: string;
  lead: { id: string; name: string; phone: string };
  property?: { id: string; title: string; locality: string };
  broker?: { id: string; name: string };
  updatedAt?: string;
}

const stageConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  ENQUIRY:      { label: "Enquiry",      color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30" },
  SITE_VISIT:   { label: "Site Visit",   color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30" },
  NEGOTIATION:  { label: "Negotiation",  color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30" },
  TOKEN:        { label: "Token Paid",   color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30" },
  AGREEMENT:    { label: "Agreement",    color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
  REGISTRATION: { label: "Registration", color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30" },
  CLOSED:       { label: "Deal Closed",  color: "text-gold-400",    bg: "bg-gold-500/10",    border: "border-gold-500/30" },
};

const stages = ["ENQUIRY", "SITE_VISIT", "NEGOTIATION", "TOKEN", "AGREEMENT", "REGISTRATION", "CLOSED"] as const;

const stageProbabilities: Record<DealStage, number> = {
  ENQUIRY:      0.15,
  SITE_VISIT:   0.40,
  NEGOTIATION:  0.60,
  TOKEN:        0.75,
  AGREEMENT:    0.85,
  REGISTRATION: 0.95,
  CLOSED:       1,
  CANCELLED:    0,
};

const fmt = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` : `₹${(n / 100000).toFixed(1)}L`;

export default function DealsPage() {
  const searchParams = useSearchParams();
  const [deals, setDeals]       = useState<Deal[]>([]);
  const [loading, setLoading]   = useState(true);
  const [dragging, setDragging] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [leads, setLeads]       = useState<any[]>([]);
  const [brokers, setBrokers]   = useState<any[]>([]);
  const [properties, setProperties] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const dragDeal = useRef<Deal | null>(null);

  const [form, setForm] = useState({
    title: "", leadId: "", propertyId: "", value: "", commissionRate: "2", brokerId: "", notes: "",
  });

  const fetchDeals = useCallback(async () => {
    try {
      const res = await fetch("/api/deals");
      const data = await res.json();
      setDeals(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load deals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDeals();
    fetch("/api/leads?limit=100").then(r => r.json()).then(d => setLeads(d.leads ?? []));
    fetch("/api/brokers").then(r => r.json()).then(d => setBrokers(Array.isArray(d) ? d : []));
    fetch("/api/properties?limit=100").then(r => r.json()).then(d => setProperties(d.properties ?? []));
  }, [fetchDeals]);

  useEffect(() => {
    const leadId = searchParams.get("leadId");
    const propertyId = searchParams.get("propertyId");
    if (leadId) {
      setForm(f => ({ ...f, leadId, propertyId: propertyId || f.propertyId }));
      setShowModal(true);
    }
  }, [searchParams]);

  const onDragStart = (deal: Deal) => {
    dragDeal.current = deal;
    setDragging(deal.id);
  };

  const onDragOver = (e: React.DragEvent, stage: string) => {
    e.preventDefault();
    setOverStage(stage);
  };

  const onDrop = async (stage: string) => {
    const deal = dragDeal.current;
    if (!deal || deal.stage === stage) {
      setDragging(null); setOverStage(null); dragDeal.current = null;
      return;
    }
    // Optimistic update
    setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: stage as DealStage } : d));
    setDragging(null); setOverStage(null); dragDeal.current = null;

    try {
      const res = await fetch(`/api/deals/${deal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      if (!res.ok) throw new Error();
      toast.success(`Moved to ${stageConfig[stage]?.label}`);
    } catch {
      // Revert
      setDeals(prev => prev.map(d => d.id === deal.id ? { ...d, stage: deal.stage } : d));
      toast.error("Failed to update stage");
    }
  };

  const handleAddDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          leadId: form.leadId,
          propertyId: form.propertyId || undefined,
          value: parseFloat(form.value),
          commissionRate: parseFloat(form.commissionRate),
          commission: parseFloat(form.value) * parseFloat(form.commissionRate) / 100,
          brokerId: form.brokerId || undefined,
          notes: form.notes || undefined,
          stage: "ENQUIRY",
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Deal created!");
      setShowModal(false);
      setForm({ title: "", leadId: "", propertyId: "", value: "", commissionRate: "2", brokerId: "", notes: "" });
      fetchDeals();
    } catch {
      toast.error("Failed to create deal");
    } finally {
      setSubmitting(false);
    }
  };

  const totalValue      = deals.reduce((s, d) => s + d.value, 0);
  const totalCommission = deals.reduce((s, d) => s + (d.commission ?? 0), 0);
  const pipelineForecast = deals.reduce((s, d) => s + d.value * stageProbabilities[d.stage], 0);
  const closedDeals     = deals.filter(d => d.stage === "CLOSED").length;
  const stuckDeals      = deals.filter(d => {
    if (!d.updatedAt) return false;
    const updatedAt = new Date(d.updatedAt).getTime();
    return d.stage !== "CLOSED" && d.stage !== "CANCELLED" && Date.now() - updatedAt > 7 * 24 * 60 * 60 * 1000;
  }).length;

  if (loading) return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-white">Deal Pipeline</h1></div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="stat-card h-20 animate-pulse bg-white/5" />)}
      </div>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {[1,2,3,4,5].map(i => <div key={i} className="kanban-column flex-shrink-0 animate-pulse bg-white/5" />)}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Deal Pipeline</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">{deals.length} active deals · Drag to update stage</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Deal</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pipeline Value",   value: deals.length ? fmt(totalValue) : "₹0",                icon: TrendingUp, color: "text-estate-400" },
          { label: "Forecast Value",  value: deals.length ? fmt(pipelineForecast) : "₹0",           icon: Zap,        color: "text-blue-400" },
          { label: "Deals Closed",     value: String(closedDeals),                                 icon: DollarSign, color: "text-emerald-400" },
          { label: "Stuck Deals",      value: String(stuckDeals),                                  icon: Building2, color: "text-orange-400" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {stages.map(stage => {
          const cfg        = stageConfig[stage];
          const stageDeals = deals.filter(d => d.stage === stage);
          const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
          const isOver     = overStage === stage;

          return (
            <div
              key={stage}
              onDragOver={e => onDragOver(e, stage)}
              onDrop={() => onDrop(stage)}
              onDragLeave={() => setOverStage(null)}
              className={`kanban-column flex-shrink-0 transition-all duration-200 ${isOver ? "border-estate-500/60 bg-estate-500/5" : ""}`}
            >
              <div className={`flex items-center justify-between mb-3 p-2 rounded-lg ${cfg.bg} border ${cfg.border}`}>
                <div>
                  <span className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</span>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {stageDeals.length} deals{stageDeals.length > 0 ? ` · ${fmt(stageValue)}` : ""}
                  </div>
                </div>
                <span className={`w-6 h-6 rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center text-xs font-bold ${cfg.color}`}>
                  {stageDeals.length}
                </span>
              </div>

              <div className="space-y-3 min-h-32">
                {stageDeals.map(deal => (
                  <div
                    key={deal.id}
                    draggable
                    onDragStart={() => onDragStart(deal)}
                    onDragEnd={() => { setDragging(null); setOverStage(null); dragDeal.current = null; }}
                    className={`pipeline-card select-none transition-all duration-200 ${dragging === deal.id ? "opacity-40 scale-95 rotate-1" : "opacity-100"}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-white leading-tight line-clamp-2 flex-1">{deal.title}</h4>
                      {deal.updatedAt && Date.now() - new Date(deal.updatedAt).getTime() > 7 * 24 * 60 * 60 * 1000 && deal.stage !== "CLOSED" && deal.stage !== "CANCELLED" && (
                        <span className="text-[10px] uppercase tracking-[0.18em] text-orange-300 bg-orange-500/10 border border-orange-500/20 rounded-full px-2 py-1">Stuck</span>
                      )}
                    </div>
                    <div className="space-y-1.5 mb-3">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {deal.lead?.name}
                      </div>
                      {deal.property && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="w-3 h-3" /> {deal.property.title}
                        </div>
                      )}
                      <div className="flex items-center gap-2 text-[11px] text-slate-300">
                        <span className="rounded-full bg-white/5 px-2 py-1">{Math.round((stageProbabilities[deal.stage] ?? 0) * 100)}% chance</span>
                        <span className="rounded-full bg-white/5 px-2 py-1">{stageConfig[deal.stage]?.label}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-white">{fmt(deal.value)}</div>
                        {deal.commission && (
                          <div className="text-xs text-gold-400">Comm: ₹{(deal.commission / 1000).toFixed(0)}K</div>
                        )}
                      </div>
                      {deal.broker && (
                        <div className="w-6 h-6 rounded-full bg-estate-600/40 flex items-center justify-center text-xs text-estate-300 font-bold">
                          {deal.broker.name[0]}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {stageDeals.length === 0 && (
                  <div className={`text-center py-8 text-xs border-2 border-dashed rounded-lg transition-colors ${isOver ? "border-estate-500/50 text-estate-400" : "border-white/5 text-muted-foreground"}`}>
                    {isOver ? "Drop here" : "No deals"}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Deal Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">New Deal</h2>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleAddDeal} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Deal Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                    placeholder="Office Space – Prahlad Nagar" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Select Lead *</label>
                  <select required value={form.leadId} onChange={e => setForm(f => ({ ...f, leadId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                    <option value="">Choose lead</option>
                    {leads.map(l => <option key={l.id} value={l.id}>{l.name} – {l.phone}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Select Property</label>
                  <select value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                    <option value="">No property</option>
                    {properties.map(p => <option key={p.id} value={p.id}>{p.title} – {p.locality}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Deal Value (₹) *</label>
                    <input required type="number" value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="5000000" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Commission Rate (%)</label>
                    <input type="number" step="0.5" value={form.commissionRate} onChange={e => setForm(f => ({ ...f, commissionRate: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
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
                    placeholder="Any notes..." />
                </div>
                {form.value && form.commissionRate && (
                  <div className="p-3 rounded-lg bg-gold-500/10 border border-gold-500/20 text-xs text-gold-400">
                    Commission: ₹{((parseFloat(form.value) * parseFloat(form.commissionRate)) / 100).toLocaleString("en-IN")}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create Deal"}
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
