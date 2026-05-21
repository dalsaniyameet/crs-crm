"use client";
import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, CheckCircle, Clock, Download, Plus, FileText, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";

interface Commission {
  id: string;
  amount: number;
  rate?: number;
  isPaid: boolean;
  paidAt?: string;
  notes?: string;
  deal: { id: string; title: string; value: number };
  broker: { id: string; name: string };
}

const fmt = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(1)}Cr`
  : n >= 100000  ? `₹${(n / 100000).toFixed(1)}L`
  : `₹${(n / 1000).toFixed(0)}K`;

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading]         = useState(true);
  const [filter, setFilter]           = useState<"ALL" | "PAID" | "PENDING">("ALL");
  const [showModal, setShowModal]     = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [deals, setDeals]             = useState<any[]>([]);
  const [brokers, setBrokers]         = useState<any[]>([]);

  const [form, setForm] = useState({ dealId: "", brokerId: "", amount: "", rate: "2", notes: "" });

  const fetchCommissions = useCallback(async () => {
    try {
      const res  = await fetch("/api/commissions");
      const data = await res.json();
      setCommissions(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load commissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCommissions();
    fetch("/api/deals").then(r => r.json()).then(d => setDeals(Array.isArray(d) ? d : []));
    fetch("/api/brokers").then(r => r.json()).then(d => setBrokers(Array.isArray(d) ? d : []));
  }, [fetchCommissions]);

  const markPaid = async (id: string) => {
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, isPaid: true, paidAt: new Date().toISOString() } : c));
    try {
      const res = await fetch(`/api/commissions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPaid: true, paidAt: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error();
      toast.success("Commission marked as paid!");
    } catch {
      fetchCommissions();
      toast.error("Failed to update");
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/commissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dealId:   form.dealId,
          brokerId: form.brokerId,
          amount:   parseFloat(form.amount),
          rate:     parseFloat(form.rate),
          notes:    form.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Commission added!");
      setShowModal(false);
      setForm({ dealId: "", brokerId: "", amount: "", rate: "2", notes: "" });
      fetchCommissions();
    } catch {
      toast.error("Failed to add commission");
    } finally {
      setSubmitting(false);
    }
  };

  const generateInvoice = (c: Commission) => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html><head><title>Invoice - ${c.deal?.title}</title>
      <style>body{font-family:Arial,sans-serif;padding:40px;color:#111}h1{color:#1e3a5f}table{width:100%;border-collapse:collapse;margin-top:20px}td,th{padding:10px;border:1px solid #ddd;text-align:left}.total{font-size:1.2em;font-weight:bold;color:#1e3a5f}.footer{margin-top:40px;font-size:12px;color:#666}</style>
      </head><body>
      <h1>City Real Space</h1><p>Commission Invoice</p><hr/>
      <table><tr><th>Deal</th><td>${c.deal?.title ?? "—"}</td></tr>
      <tr><th>Broker</th><td>${c.broker?.name ?? "—"}</td></tr>
      <tr><th>Deal Value</th><td>₹${c.deal?.value?.toLocaleString("en-IN") ?? "—"}</td></tr>
      <tr><th>Commission Rate</th><td>${c.rate ?? "—"}%</td></tr>
      <tr><th>Commission Amount</th><td class="total">₹${c.amount.toLocaleString("en-IN")}</td></tr>
      <tr><th>Status</th><td>${c.isPaid ? "✅ Paid on " + (c.paidAt ? new Date(c.paidAt).toLocaleDateString("en-IN") : "") : "⏳ Pending"}</td></tr>
      ${c.notes ? `<tr><th>Notes</th><td>${c.notes}</td></tr>` : ""}
      </table>
      <div class="footer">Generated on ${new Date().toLocaleDateString("en-IN")} · City Real Space CRM</div>
      </body></html>`);
    w.document.close();
    w.print();
  };

  const filtered     = commissions.filter(c => filter === "ALL" ? true : filter === "PAID" ? c.isPaid : !c.isPaid);
  const totalEarned  = commissions.filter(c => c.isPaid).reduce((s, c) => s + c.amount, 0);
  const totalPending = commissions.filter(c => !c.isPaid).reduce((s, c) => s + c.amount, 0);
  const totalAll     = commissions.reduce((s, c) => s + c.amount, 0);

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
          <h1 className="text-xl md:text-2xl font-bold text-white">Commission Tracking</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">{commissions.length} commissions tracked</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/api/commissions/export" download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all">
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
          </a>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Commission</span><span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Total Commission",  value: fmt(totalAll),     icon: DollarSign,  color: "from-estate-600 to-estate-400",  sub: `${commissions.length} deals` },
          { label: "Received",          value: fmt(totalEarned),  icon: CheckCircle, color: "from-emerald-600 to-emerald-400", sub: `${commissions.filter(c => c.isPaid).length} paid` },
          { label: "Pending",           value: fmt(totalPending), icon: Clock,       color: "from-orange-600 to-orange-400",   sub: `${commissions.filter(c => !c.isPaid).length} pending` },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="stat-card">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
              <s.icon className="w-5 h-5 text-white" />
            </div>
            <div className="text-2xl font-bold text-white">{s.value}</div>
            <div className="text-sm text-muted-foreground mt-0.5">{s.label}</div>
            <div className="text-xs text-muted-foreground mt-1">{s.sub}</div>
          </motion.div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        {(["ALL", "PAID", "PENDING"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filter === f
                ? "bg-estate-600/30 border border-estate-500/50 text-estate-400"
                : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white"
            }`}>
            {f === "ALL" ? "All" : f === "PAID" ? "✅ Received" : "⏳ Pending"}
          </button>
        ))}
      </div>

      {/* Table — desktop / Cards — mobile */}
      <div className="glass-card overflow-hidden">
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <DollarSign className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>No commissions found. Add your first commission!</p>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5 text-xs text-muted-foreground">
                    <th className="text-left px-4 py-3 font-medium">Deal</th>
                    <th className="text-left px-4 py-3 font-medium">Broker</th>
                    <th className="text-right px-4 py-3 font-medium">Deal Value</th>
                    <th className="text-right px-4 py-3 font-medium">Rate</th>
                    <th className="text-right px-4 py-3 font-medium">Commission</th>
                    <th className="text-left px-4 py-3 font-medium">Status</th>
                    <th className="text-left px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c, i) => (
                    <motion.tr key={c.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-white/3 hover:bg-white/3 transition-colors group">
                      <td className="px-4 py-3"><div className="text-sm font-medium text-white">{c.deal?.title}</div></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-estate-600/30 flex items-center justify-center text-xs text-estate-400 font-bold">{c.broker?.name[0]}</div>
                          <span className="text-xs text-muted-foreground">{c.broker?.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium text-xs">{c.deal?.value ? fmt(c.deal.value) : "—"}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground text-xs">{c.rate ?? "—"}%</td>
                      <td className="px-4 py-3 text-right font-bold text-gold-400">{fmt(c.amount)}</td>
                      <td className="px-4 py-3">
                        {c.isPaid ? (
                          <div>
                            <span className="text-xs px-2 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">✅ Received</span>
                            {c.paidAt && <div className="text-xs text-muted-foreground mt-1">{new Date(c.paidAt).toLocaleDateString("en-IN")}</div>}
                          </div>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400">⏳ Pending</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => generateInvoice(c)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors" title="Invoice">
                            <FileText className="w-3.5 h-3.5" />
                          </button>
                          {!c.isPaid && (
                            <button onClick={() => markPaid(c.id)}
                              className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-emerald-400 transition-colors" title="Mark Paid">
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* Mobile cards */}
            <div className="md:hidden divide-y divide-white/5">
              {filtered.map((c, i) => (
                <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold text-white">{c.deal?.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{c.broker?.name}</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-sm font-bold text-gold-400">{fmt(c.amount)}</div>
                      <div className="text-xs text-muted-foreground">{c.rate ?? "—"}% rate</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    {c.isPaid
                      ? <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400">✅ Received</span>
                      : <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400">⏳ Pending</span>}
                    <div className="flex items-center gap-2">
                      <button onClick={() => generateInvoice(c)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
                        <FileText className="w-3 h-3" /> Invoice
                      </button>
                      {!c.isPaid && (
                        <button onClick={() => markPaid(c.id)} className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 transition-colors">
                          <CheckCircle className="w-3 h-3" /> Mark Paid
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Add Commission Modal */}
      {showModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass-card w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-white">Add Commission</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Select Deal *</label>
                <select required value={form.dealId} onChange={e => setForm(f => ({ ...f, dealId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                  <option value="">Choose deal</option>
                  {deals.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Select Broker *</label>
                <select required value={form.brokerId} onChange={e => setForm(f => ({ ...f, brokerId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                  <option value="">Choose broker</option>
                  {brokers.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Amount (₹) *</label>
                  <input required type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                    placeholder="50000" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Rate (%)</label>
                  <input type="number" step="0.5" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Commission"}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
