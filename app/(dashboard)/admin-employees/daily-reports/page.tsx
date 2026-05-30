"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, Building2, TrendingUp, ChevronDown, ChevronUp, CheckCircle2, ClipboardList, Calendar, Users, X } from "lucide-react";
import toast from "react-hot-toast";

function toDateKey(d: Date) { return d.toISOString().split("T")[0]; }

export default function AdminDailyReportsPage() {
  const [reports, setReports]       = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [noteInput, setNoteInput]   = useState<Record<string, string>>({});
  const [savingNote, setSavingNote] = useState<string | null>(null);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [filterEmp, setFilterEmp]   = useState("ALL");

  useEffect(() => {
    fetch("/api/admin/employees").then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  useEffect(() => { loadReports(); }, [selectedDate, filterEmp]);

  async function loadReports() {
    setLoading(true);
    try {
      let url = `/api/daily-reports?date=${selectedDate}&limit=50`;
      if (filterEmp !== "ALL") url += `&employeeId=${filterEmp}`;
      const res  = await fetch(url);
      const data = await res.json();
      setReports(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }

  async function saveNote(reportId: string) {
    setSavingNote(reportId);
    try {
      const res = await fetch("/api/daily-reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: reportId, adminNote: noteInput[reportId] || "", status: "REVIEWED" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, ...data } : r));
      toast.success("Note saved & marked reviewed ✅");
    } catch { toast.error("Failed"); }
    setSavingNote(null);
  }

  // Summary totals for the day
  const totals = reports.reduce((acc, r) => ({
    calls: acc.calls + r.totalCalls,
    connected: acc.connected + r.connectedCalls,
    leads: acc.leads + r.newLeads,
    visits: acc.visits + r.siteVisits,
    closed: acc.closed + r.dealsClosed,
    value: acc.value + r.dealValue,
    followDone: acc.followDone + r.followUpsDone,
  }), { calls: 0, connected: 0, leads: 0, visits: 0, closed: 0, value: 0, followDone: 0 });

  const today = toDateKey(new Date());

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-estate-400" /> Daily Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Team ka daily performance — real time</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Employee filter */}
          <select value={filterEmp} onChange={e => setFilterEmp(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none">
            <option value="ALL" className="bg-[#0f1f35]">All Employees</option>
            {employees.map(e => <option key={e.id} value={e.id} className="bg-[#0f1f35]">{e.name}</option>)}
          </select>
          {/* Date */}
          <input type="date" value={selectedDate} max={today}
            onChange={e => setSelectedDate(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]" />
        </div>
      </div>

      {/* Day Summary Stats */}
      {reports.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Calls",    value: totals.calls,     sub: `${totals.connected} connected`, color: "text-blue-400",    bg: "from-blue-600/20 to-blue-400/10" },
            { label: "New Leads",      value: totals.leads,     sub: `${reports.length} reports`,     color: "text-gold-400",    bg: "from-yellow-600/20 to-yellow-400/10" },
            { label: "Site Visits",    value: totals.visits,    sub: `${totals.followDone} follow-ups`, color: "text-orange-400", bg: "from-orange-600/20 to-orange-400/10" },
            { label: "Deals Closed",   value: totals.closed,    sub: totals.value > 0 ? `₹${(totals.value/100000).toFixed(1)}L` : "—", color: "text-emerald-400", bg: "from-emerald-600/20 to-emerald-400/10" },
          ].map(s => (
            <div key={s.label} className={`glass-card p-4 bg-gradient-to-br ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white font-medium mt-0.5">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No reports submitted for this date</p>
          <p className="text-xs mt-1 opacity-60">No reports submitted by employees yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(r => (
            <motion.div key={r.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
              className={`glass-card overflow-hidden border ${
                r.status === "REVIEWED" ? "border-emerald-500/20" : "border-yellow-500/15"
              }`}>

              {/* Card Header */}
              <div className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-estate-600/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                  {r.employee?.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{r.employee?.name}</span>
                    <span className="text-xs text-muted-foreground">{r.employee?.position}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      r.status === "REVIEWED" ? "bg-emerald-500/15 text-emerald-400" : "bg-yellow-500/15 text-yellow-400"
                    }`}>{r.status === "REVIEWED" ? "✓ Reviewed" : "⏳ Pending Review"}</span>
                  </div>
                  {/* Quick stats row */}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    <span className="text-xs text-blue-400">📞 {r.totalCalls} calls ({r.connectedCalls} connected)</span>
                    <span className="text-xs text-orange-400">🏠 {r.siteVisits} visits</span>
                    <span className="text-xs text-gold-400">⭐ {r.newLeads} leads</span>
                    {r.dealsClosed > 0 && <span className="text-xs text-emerald-400 font-semibold">✅ {r.dealsClosed} closed{r.dealValue > 0 ? ` · ₹${(r.dealValue/100000).toFixed(1)}L` : ""}</span>}
                    <span className="text-xs text-purple-400">🔄 {r.followUpsDone} F/U done</span>
                  </div>
                </div>
                <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                  {expanded === r.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
              </div>

              {/* Expanded Detail */}
              <AnimatePresence>
                {expanded === r.id && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10 overflow-hidden">
                    <div className="p-4 space-y-4">

                      {/* Full stats grid */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                        {[
                          { label: "Total Calls",      val: r.totalCalls,        color: "text-blue-400" },
                          { label: "Connected",        val: r.connectedCalls,    color: "text-emerald-400" },
                          { label: "New Leads",        val: r.newLeads,          color: "text-gold-400" },
                          { label: "Site Visits",      val: r.siteVisits,        color: "text-orange-400" },
                          { label: "Props Visited",    val: r.propertiesVisited, color: "text-white" },
                          { label: "Props Listed",     val: r.propertiesListed,  color: "text-purple-400" },
                          { label: "Deals Active",     val: r.dealsInProgress,   color: "text-yellow-400" },
                          { label: "Deals Closed",     val: r.dealsClosed,       color: "text-emerald-400" },
                          { label: "Follow-ups Done",  val: r.followUpsDone,     color: "text-blue-400" },
                          { label: "Follow-ups Pending", val: r.followUpsPending, color: "text-red-400" },
                          { label: "Deal Value",       val: r.dealValue > 0 ? `₹${(r.dealValue/100000).toFixed(1)}L` : "—", color: "text-emerald-400" },
                        ].map(s => (
                          <div key={s.label} className="p-2 rounded-lg bg-white/5 text-center">
                            <div className={`text-sm font-bold ${s.color}`}>{s.val}</div>
                            <div className="text-xs text-muted-foreground">{s.label}</div>
                          </div>
                        ))}
                      </div>

                      {/* Call Entries Detail */}
                      {Array.isArray(r.callEntries) && r.callEntries.length > 0 && (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15 space-y-2">
                          <p className="text-xs font-semibold text-blue-400 mb-2">📞 Call Details ({r.callEntries.length})</p>
                          {r.callEntries.map((c: any, i: number) => (
                            <div key={i} className="flex items-start gap-3 p-2 rounded-lg bg-white/5 flex-wrap">
                              <span className="text-xs text-muted-foreground w-5 flex-shrink-0">#{i+1}</span>
                              <div className="flex-1 min-w-0 space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  {c.name && <span className="text-xs font-semibold text-white">{c.name}</span>}
                                  {c.phone && <a href={`tel:${c.phone}`} className="text-xs text-emerald-400 hover:text-emerald-300">{c.phone}</a>}
                                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                                    c.outcome === "CONNECTED" ? "bg-emerald-500/20 text-emerald-400" :
                                    c.outcome === "NO_ANSWER" ? "bg-red-500/20 text-red-400" :
                                    c.outcome === "BUSY"      ? "bg-orange-500/20 text-orange-400" :
                                                                "bg-yellow-500/20 text-yellow-400"
                                  }`}>
                                    {c.outcome === "CONNECTED" ? "✅ Connected" : c.outcome === "NO_ANSWER" ? "📵 No Answer" : c.outcome === "BUSY" ? "🔴 Busy" : "🔁 Callback"}
                                  </span>
                                </div>
                                {c.location && (
                                  <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.location + ", Ahmedabad")}`}
                                    target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">🗺️ {c.location}</a>
                                )}
                                {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Text fields */}
                      {r.visitsFeedback && (
                        <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/15">
                          <p className="text-xs font-semibold text-orange-400 mb-1">🏠 Visit Feedback</p>
                          <p className="text-xs text-white">{r.visitsFeedback}</p>
                        </div>
                      )}
                      {r.highlights && (
                        <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
                          <p className="text-xs font-semibold text-emerald-400 mb-1">🌟 Highlights</p>
                          <p className="text-xs text-white">{r.highlights}</p>
                        </div>
                      )}
                      {r.challenges && (
                        <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/15">
                          <p className="text-xs font-semibold text-red-400 mb-1">⚠️ Challenges</p>
                          <p className="text-xs text-white">{r.challenges}</p>
                        </div>
                      )}
                      {r.tomorrowPlan && (
                        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
                          <p className="text-xs font-semibold text-blue-400 mb-1">📅 Kal ka Plan</p>
                          <p className="text-xs text-white">{r.tomorrowPlan}</p>
                        </div>
                      )}

                      {/* Admin Note */}
                      <div className="space-y-2">
                        <label className="text-xs text-muted-foreground">Admin Note / Feedback</label>
                        <div className="flex gap-2">
                          <input value={noteInput[r.id] ?? (r.adminNote || "")}
                            onChange={e => setNoteInput(p => ({ ...p, [r.id]: e.target.value }))}
                            placeholder="Feedback ya instructions..."
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50" />
                          <button onClick={() => saveNote(r.id)} disabled={savingNote === r.id}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-estate-500/20 border border-estate-500/30 text-estate-300 text-xs font-medium hover:bg-estate-500/30 transition-all disabled:opacity-50">
                            {savingNote === r.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                            {r.status === "REVIEWED" ? "Update" : "Mark Reviewed"}
                          </button>
                        </div>
                        {r.adminNote && noteInput[r.id] === undefined && (
                          <p className="text-xs text-yellow-400">Current note: {r.adminNote}</p>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
