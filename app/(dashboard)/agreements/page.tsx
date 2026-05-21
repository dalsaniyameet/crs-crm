"use client";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Eye, Download, CheckCircle, Clock,
  AlertCircle, XCircle, Building2, User, DollarSign,
  Calendar, Pen, Shield, Search, Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

type AgreementType   = "TOKEN" | "MOU" | "SALE_DEED" | "LEASE" | "RENT" | "COMMISSION";
type AgreementStatus = "DRAFT" | "SENT" | "SIGNED" | "REGISTERED" | "EXPIRED" | "CANCELLED";

interface Agreement {
  id: string;
  title: string;
  type: AgreementType;
  status: AgreementStatus;
  client: string;
  clientPhone: string;
  property: string;
  dealValue: number;
  tokenAmount?: number;
  broker: string;
  createdAt: string;
  signedAt?: string;
  expiryDate?: string;
  stampDuty?: number;
  registrationFee?: number;
  notes?: string;
}

const typeConfig: Record<AgreementType, { label: string; color: string; icon: string }> = {
  TOKEN:       { label: "Token Agreement",    color: "text-yellow-400",  icon: "🪙" },
  MOU:         { label: "MOU",                color: "text-blue-400",    icon: "🤝" },
  SALE_DEED:   { label: "Sale Deed",          color: "text-emerald-400", icon: "🏠" },
  LEASE:       { label: "Lease Agreement",    color: "text-purple-400",  icon: "📋" },
  RENT:        { label: "Rent Agreement",     color: "text-orange-400",  icon: "🔑" },
  COMMISSION:  { label: "Commission Letter",  color: "text-yellow-400",  icon: "💰" },
};

const statusConfig: Record<AgreementStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  DRAFT:       { label: "Draft",       color: "text-muted-foreground", bg: "bg-white/5 border-white/10",              icon: Pen },
  SENT:        { label: "Sent",        color: "text-blue-400",         bg: "bg-blue-500/15 border-blue-500/25",       icon: Clock },
  SIGNED:      { label: "Signed",      color: "text-emerald-400",      bg: "bg-emerald-500/15 border-emerald-500/25", icon: CheckCircle },
  REGISTERED:  { label: "Registered",  color: "text-yellow-400",       bg: "bg-yellow-500/15 border-yellow-500/25",   icon: Shield },
  EXPIRED:     { label: "Expired",     color: "text-orange-400",       bg: "bg-orange-500/15 border-orange-500/25",   icon: AlertCircle },
  CANCELLED:   { label: "Cancelled",   color: "text-red-400",          bg: "bg-red-500/15 border-red-500/25",         icon: XCircle },
};

const fmt = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr` :
  n >= 100000   ? `₹${(n / 100000).toFixed(1)}L`    :
                  `₹${(n / 1000).toFixed(0)}K`;

const emptyForm = {
  title: "", type: "TOKEN" as AgreementType, client: "", clientPhone: "",
  property: "", dealValue: "", tokenAmount: "", broker: "",
  stampDuty: "", registrationFee: "", expiryDate: "", notes: "",
};

export default function AgreementsPage() {
  const [agreements, setAgreements] = useState<Agreement[]>([]);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter]     = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showModal, setShowModal]       = useState(false);
  const [selected, setSelected]         = useState<Agreement | null>(null);
  const [form, setForm]                 = useState(emptyForm);
  const [submitting, setSubmitting]     = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const fetchAgreements = useCallback(async () => {
    try {
      const res  = await fetch("/api/agreements");
      const data = await res.json();
      setAgreements(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load agreements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAgreements(); }, [fetchAgreements]);

  const filtered = agreements.filter(a => {
    const matchSearch = a.title.toLowerCase().includes(search.toLowerCase()) ||
      a.client.toLowerCase().includes(search.toLowerCase()) ||
      a.property.toLowerCase().includes(search.toLowerCase());
    const matchType   = typeFilter   === "ALL" || a.type   === typeFilter;
    const matchStatus = statusFilter === "ALL" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const signed     = agreements.filter(a => a.status === "SIGNED" || a.status === "REGISTERED").length;
  const pending    = agreements.filter(a => a.status === "SENT" || a.status === "DRAFT").length;
  const totalValue = agreements.reduce((s, a) => s + a.dealValue, 0);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          dealValue:       parseFloat(form.dealValue) || 0,
          tokenAmount:     form.tokenAmount     ? parseFloat(form.tokenAmount)     : undefined,
          stampDuty:       form.stampDuty       ? parseFloat(form.stampDuty)       : undefined,
          registrationFee: form.registrationFee ? parseFloat(form.registrationFee) : undefined,
          expiryDate:      form.expiryDate      || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Agreement created!");
      setShowModal(false);
      setForm(emptyForm);
      fetchAgreements();
    } catch {
      toast.error("Failed to create agreement");
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, status: AgreementStatus) => {
    setUpdatingStatus(true);
    try {
      const patch: Record<string, unknown> = { status };
      if (status === "SIGNED") patch.signedAt = new Date().toISOString();
      const res = await fetch(`/api/agreements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setAgreements(prev => prev.map(a => a.id === id ? updated : a));
      setSelected(updated);
      toast.success(`Status updated to ${statusConfig[status].label}`);
    } catch {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const inputCls = "w-full py-2.5 px-3 text-sm rounded-xl focus:outline-none text-white placeholder:text-muted-foreground";
  const inputStyle = { background: "rgba(15,31,53,0.6)", border: "1px solid rgba(234,179,8,0.12)" };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold gradient-text">Agreement Tracker</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">Token · MOU · Sale Deed · Lease · Rent</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
          <Plus className="w-4 h-4" /> <span className="hidden sm:inline">New Agreement</span><span className="sm:hidden">New</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Agreements",    value: agreements.length,  icon: FileText,    color: "from-yellow-600 to-yellow-400" },
          { label: "Signed / Registered", value: signed,             icon: CheckCircle, color: "from-emerald-600 to-emerald-400" },
          { label: "Pending Signature",   value: pending,            icon: Clock,       color: "from-orange-600 to-orange-400" },
          { label: "Total Deal Value",    value: totalValue ? fmt(totalValue) : "₹0", icon: DollarSign, color: "from-purple-600 to-purple-400" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-xl font-bold text-white">{s.value}</div>
            <div className="text-xs text-muted-foreground">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search agreements..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none transition-all"
            style={{ background: "rgba(15,31,53,0.6)", border: "1px solid rgba(234,179,8,0.12)", color: "#f1f5f9" }} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", ...Object.keys(typeConfig)].map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${typeFilter === t ? "btn-primary" : "btn-ghost"}`}>
              {t === "ALL" ? "All" : typeConfig[t as AgreementType]?.label ?? t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", ...Object.keys(statusConfig)].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? "btn-primary" : "btn-ghost"}`}>
              {s === "ALL" ? "All Status" : statusConfig[s as AgreementStatus]?.label ?? s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-yellow-400 animate-spin" />
        </div>
      ) : (
        /* Agreement Cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence>
            {filtered.map((agr, i) => {
              const typeCfg   = typeConfig[agr.type];
              const statusCfg = statusConfig[agr.status];
              const StatusIcon = statusCfg.icon;
              return (
                <motion.div
                  key={agr.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card p-5 hover:border-yellow-500/20 transition-all cursor-pointer group"
                  onClick={() => setSelected(agr)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{typeCfg.icon}</span>
                      <div>
                        <div className={`text-xs font-semibold ${typeCfg.color}`}>{typeCfg.label}</div>
                        <div className="text-sm font-semibold text-white leading-tight mt-0.5 line-clamp-1">{agr.title}</div>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border flex-shrink-0 ${statusCfg.bg} ${statusCfg.color}`}>
                      <StatusIcon className="w-3 h-3" /> {statusCfg.label}
                    </span>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <User className="w-3 h-3 flex-shrink-0" />
                      <span className="text-white font-medium">{agr.client}</span>
                      <span>· {agr.clientPhone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">{agr.property}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      <span>Created: {new Date(agr.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
                      {agr.signedAt && <span className="text-emerald-400">· Signed: {new Date(agr.signedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t" style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                    <div>
                      <div className="text-xs text-muted-foreground">Deal Value</div>
                      <div className="text-sm font-bold text-yellow-400">{fmt(agr.dealValue)}</div>
                    </div>
                    {agr.tokenAmount && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground">Token</div>
                        <div className="text-sm font-bold text-emerald-400">{fmt(agr.tokenAmount)}</div>
                      </div>
                    )}
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">Broker</div>
                      <div className="text-xs font-medium text-white">{agr.broker}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium transition-all btn-ghost"
                      onClick={e => { e.stopPropagation(); setSelected(agr); }}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                    {agr.status === "DRAFT" && (
                      <button className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-medium btn-primary"
                        onClick={e => { e.stopPropagation(); updateStatus(agr.id, "SENT"); }}>
                        <Pen className="w-3.5 h-3.5" /> Mark Sent
                      </button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          {filtered.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No agreements found. Create your first agreement!</p>
            </div>
          )}
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selected && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setSelected(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{typeConfig[selected.type].icon}</span>
                  <div>
                    <div className={`text-xs font-semibold ${typeConfig[selected.type].color}`}>{typeConfig[selected.type].label}</div>
                    <h2 className="text-base font-bold text-white">{selected.title}</h2>
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-white text-xl">✕</button>
              </div>

              <div className="space-y-4">
                {/* Status + Change */}
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => { const cfg = statusConfig[selected.status]; const Icon = cfg.icon;
                    return <span className={`inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-full border font-medium ${cfg.bg} ${cfg.color}`}>
                      <Icon className="w-4 h-4" /> {cfg.label}
                    </span>; })()}
                  <select
                    value={selected.status}
                    disabled={updatingStatus}
                    onChange={e => updateStatus(selected.id, e.target.value as AgreementStatus)}
                    className="text-xs px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-white focus:outline-none cursor-pointer">
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.label}</option>
                    ))}
                  </select>
                  {updatingStatus && <Loader2 className="w-4 h-4 animate-spin text-yellow-400" />}
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Client",        value: selected.client },
                    { label: "Phone",         value: selected.clientPhone },
                    { label: "Property",      value: selected.property },
                    { label: "Broker",        value: selected.broker },
                    { label: "Deal Value",    value: fmt(selected.dealValue) },
                    { label: "Token Amount",  value: selected.tokenAmount ? fmt(selected.tokenAmount) : "—" },
                    { label: "Created",       value: new Date(selected.createdAt).toLocaleDateString("en-IN") },
                    { label: "Signed",        value: selected.signedAt ? new Date(selected.signedAt).toLocaleDateString("en-IN") : "—" },
                    { label: "Expiry",        value: selected.expiryDate ? new Date(selected.expiryDate).toLocaleDateString("en-IN") : "—" },
                    { label: "Stamp Duty",    value: selected.stampDuty ? fmt(selected.stampDuty) : "—" },
                    { label: "Reg. Fee",      value: selected.registrationFee ? fmt(selected.registrationFee) : "—" },
                  ].map(item => (
                    <div key={item.label} className="p-3 rounded-xl" style={{ background: "rgba(15,31,53,0.5)", border: "1px solid rgba(234,179,8,0.08)" }}>
                      <div className="text-xs text-muted-foreground">{item.label}</div>
                      <div className="text-sm font-medium text-white mt-0.5">{item.value}</div>
                    </div>
                  ))}
                </div>

                {selected.notes && (
                  <div className="p-3 rounded-xl" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.15)" }}>
                    <div className="text-xs text-yellow-400 font-medium mb-1">Notes</div>
                    <div className="text-sm text-muted-foreground">{selected.notes}</div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Agreement Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">New Agreement</h2>
                <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white">✕</button>
              </div>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Agreement Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="Token Agreement – Prahlad Nagar Office"
                    className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Agreement Type *</label>
                  <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as AgreementType }))}
                    className={inputCls} style={inputStyle}>
                    {Object.entries(typeConfig).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Client Name *</label>
                    <input required value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                      placeholder="Rajesh Patel" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Client Phone *</label>
                    <input required value={form.clientPhone} onChange={e => setForm(f => ({ ...f, clientPhone: e.target.value }))}
                      placeholder="9876543210" className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Property *</label>
                  <input required value={form.property} onChange={e => setForm(f => ({ ...f, property: e.target.value }))}
                    placeholder="2200 sqft Office, Prahlad Nagar" className={inputCls} style={inputStyle} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Deal Value (₹) *</label>
                    <input required type="number" value={form.dealValue} onChange={e => setForm(f => ({ ...f, dealValue: e.target.value }))}
                      placeholder="5000000" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Token Amount (₹)</label>
                    <input type="number" value={form.tokenAmount} onChange={e => setForm(f => ({ ...f, tokenAmount: e.target.value }))}
                      placeholder="100000" className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Stamp Duty (₹)</label>
                    <input type="number" value={form.stampDuty} onChange={e => setForm(f => ({ ...f, stampDuty: e.target.value }))}
                      placeholder="500" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Registration Fee (₹)</label>
                    <input type="number" value={form.registrationFee} onChange={e => setForm(f => ({ ...f, registrationFee: e.target.value }))}
                      placeholder="30000" className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Broker Name *</label>
                    <input required value={form.broker} onChange={e => setForm(f => ({ ...f, broker: e.target.value }))}
                      placeholder="Kiran Shah" className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Expiry Date</label>
                    <input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))}
                      className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Additional notes..." className={`${inputCls} resize-none`} style={inputStyle} />
                </div>
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn-ghost py-2.5 text-sm">Cancel</button>
                  <button type="submit" disabled={submitting}
                    className="flex-1 btn-primary py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                    {submitting ? "Creating..." : "Create Agreement"}
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
