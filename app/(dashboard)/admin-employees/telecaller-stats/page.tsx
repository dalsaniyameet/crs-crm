"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Phone, ChevronDown, ChevronUp } from "lucide-react";

function toDateKey(d: Date) { return d.toISOString().split("T")[0]; }

function fmtDur(s: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

const OUTCOME: Record<string, { label: string; color: string; bg: string }> = {
  ANSWERED:           { label: "✅ Connected",      color: "text-emerald-400", bg: "bg-emerald-500/20" },
  INTERESTED:         { label: "🟢 Interested",     color: "text-green-400",   bg: "bg-green-500/20"   },
  NO_ANSWER:          { label: "📵 No Answer",      color: "text-red-400",     bg: "bg-red-500/20"     },
  BUSY:               { label: "🔴 Busy",           color: "text-orange-400",  bg: "bg-orange-500/20"  },
  CALLBACK_REQUESTED: { label: "🔁 Callback",       color: "text-yellow-400",  bg: "bg-yellow-500/20"  },
  NOT_INTERESTED:     { label: "❌ Not Interested",  color: "text-red-400",     bg: "bg-red-500/20"     },
};

export default function TelecallerStatsPage() {
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [data, setData]       = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const today = toDateKey(new Date());

  useEffect(() => { load(); }, [selectedDate]);

  async function load() {
    setLoading(true);
    try {
      const res  = await fetch(`/api/admin/telecaller-stats?date=${selectedDate}`);
      const json = await res.json();
      setData(json);
    } catch {}
    setLoading(false);
  }

  const stats: any[]  = data?.stats    || [];
  const totals: any   = data?.teamTotals || {};

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Phone className="w-6 h-6 text-blue-400" /> Telecaller Stats
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Kisne kitne calls kiye — real CRM data</p>
        </div>
        <input type="date" value={selectedDate} max={today}
          onChange={e => setSelectedDate(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none [color-scheme:dark]" />
      </div>

      {/* Team totals */}
      {!loading && data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Total Calls",  value: totals.totalCalls ?? 0,
              sub: `${totals.activeCallers ?? 0} callers`, color: "text-blue-400", bg: "from-blue-600/20 to-blue-400/10" },
            { label: "Connected",    value: totals.connected  ?? 0,
              sub: `${totals.totalCalls ? Math.round((totals.connected / totals.totalCalls) * 100) : 0}% rate`,
              color: "text-emerald-400", bg: "from-emerald-600/20 to-emerald-400/10" },
            { label: "Interested",   value: totals.interested ?? 0,
              sub: "hot prospects", color: "text-green-400", bg: "from-green-600/20 to-green-400/10" },
            { label: "Talk Time",    value: fmtDur(totals.totalDuration ?? 0),
              sub: `${totals.reportsSubmitted ?? 0} reports submitted`, color: "text-purple-400", bg: "from-purple-600/20 to-purple-400/10" },
          ].map(s => (
            <div key={s.label} className={`glass-card p-4 bg-gradient-to-br ${s.bg}`}>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-white font-medium mt-0.5">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Per-user cards */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Aaj koi calls logged nahi hain</p>
          <p className="text-xs mt-1 opacity-60">Jab broker/telecaller CRM se call log karega tab yahan dikhega</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stats.map((s: any) => {
            const connectPct = s.totalCalls > 0 ? Math.round((s.connected / s.totalCalls) * 100) : 0;
            const isExp = expanded === s.userId;
            return (
              <motion.div key={s.userId} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden">

                {/* Card header */}
                <div className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600/30 flex items-center justify-center text-sm font-bold text-white flex-shrink-0">
                    {s.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{s.name}</span>
                      <span className="text-xs text-muted-foreground">{s.role}</span>
                      {s.dailyReport && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          s.dailyReport.status === "REVIEWED"
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-yellow-500/15 text-yellow-400"
                        }`}>
                          {s.dailyReport.status === "REVIEWED" ? "✓ Reviewed" : "📋 Report Submitted"}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs text-blue-400">📞 {s.totalCalls} calls</span>
                      <span className="text-xs text-emerald-400">✅ {s.connected} connected ({connectPct}%)</span>
                      {s.interested  > 0 && <span className="text-xs text-green-400">🟢 {s.interested} interested</span>}
                      {s.noAnswer    > 0 && <span className="text-xs text-red-400">📵 {s.noAnswer} no answer</span>}
                      {s.busy        > 0 && <span className="text-xs text-orange-400">🔴 {s.busy} busy</span>}
                      {s.callback    > 0 && <span className="text-xs text-yellow-400">🔁 {s.callback} callback</span>}
                      <span className="text-xs text-purple-400">⏱ {fmtDur(s.totalDuration)}</span>
                      {s.hotLeadsContacted > 0 && <span className="text-xs text-yellow-400 font-semibold">🔥 {s.hotLeadsContacted} hot leads</span>}
                    </div>
                  </div>
                  <button onClick={() => setExpanded(isExp ? null : s.userId)}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                </div>

                {/* Expanded detail */}
                <AnimatePresence>
                  {isExp && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="border-t border-white/10 overflow-hidden">
                      <div className="p-4 space-y-4">

                        {/* Stats grid */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                          {[
                            { label: "Total",      val: s.totalCalls,    color: "text-blue-400" },
                            { label: "Connected",  val: s.connected,     color: "text-emerald-400" },
                            { label: "Interested", val: s.interested,    color: "text-green-400" },
                            { label: "No Answer",  val: s.noAnswer,      color: "text-red-400" },
                            { label: "Busy",       val: s.busy,          color: "text-orange-400" },
                            { label: "Callback",   val: s.callback,      color: "text-yellow-400" },
                          ].map(st => (
                            <div key={st.label} className="p-2 rounded-lg bg-white/5 text-center">
                              <div className={`text-lg font-bold ${st.color}`}>{st.val}</div>
                              <div className="text-xs text-muted-foreground">{st.label}</div>
                            </div>
                          ))}
                        </div>

                        {/* Connect rate bar */}
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Connect Rate</span>
                            <span className={connectPct >= 50 ? "text-emerald-400" : connectPct >= 30 ? "text-yellow-400" : "text-red-400"}>
                              {connectPct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/10">
                            <div className={`h-1.5 rounded-full transition-all ${
                              connectPct >= 50 ? "bg-emerald-400" : connectPct >= 30 ? "bg-yellow-400" : "bg-red-400"
                            }`} style={{ width: `${connectPct}%` }} />
                          </div>
                        </div>

                        {/* Daily report summary */}
                        {s.dailyReport && (
                          <div className="p-3 rounded-lg bg-white/5 border border-white/10 space-y-2">
                            <p className="text-xs font-semibold text-estate-400">📋 Daily Report (Self-Reported)</p>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                              {[
                                { label: "Calls",      val: s.dailyReport.reportedCalls,     color: "text-blue-400" },
                                { label: "Connected",  val: s.dailyReport.reportedConnected,  color: "text-emerald-400" },
                                { label: "New Leads",  val: s.dailyReport.newLeads,           color: "text-yellow-400" },
                                { label: "Visits",     val: s.dailyReport.siteVisits,         color: "text-orange-400" },
                                { label: "Deals",      val: s.dailyReport.dealsClosed,        color: "text-emerald-400" },
                                { label: "Follow-ups", val: s.dailyReport.followUpsDone,      color: "text-purple-400" },
                              ].map(st => (
                                <div key={st.label} className="p-2 rounded-lg bg-white/5 text-center">
                                  <div className={`text-sm font-bold ${st.color}`}>{st.val}</div>
                                  <div className="text-xs text-muted-foreground">{st.label}</div>
                                </div>
                              ))}
                            </div>
                            {s.dailyReport.highlights   && <p className="text-xs text-emerald-400">🌟 {s.dailyReport.highlights}</p>}
                            {s.dailyReport.challenges   && <p className="text-xs text-red-400">⚠️ {s.dailyReport.challenges}</p>}
                            {s.dailyReport.tomorrowPlan && <p className="text-xs text-blue-400">📅 {s.dailyReport.tomorrowPlan}</p>}
                          </div>
                        )}

                        {/* Call log list */}
                        {s.calls.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-blue-400">📞 Call Log ({s.calls.length})</p>
                            {s.calls.map((c: any, i: number) => {
                              const oc = OUTCOME[c.outcome] || { label: c.outcome || "—", color: "text-muted-foreground", bg: "bg-white/5" };
                              return (
                                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-white/5 border border-white/[0.08]">
                                  <span className="text-xs text-muted-foreground w-5 flex-shrink-0 mt-0.5">#{i + 1}</span>
                                  <div className="flex-1 min-w-0 space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="text-xs font-semibold text-white">{c.leadName}</span>
                                      <a href={`tel:${c.leadPhone}`} className="text-xs text-estate-400 hover:text-estate-300">{c.leadPhone}</a>
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${oc.bg} ${oc.color}`}>{oc.label}</span>
                                      {c.duration > 0 && <span className="text-xs text-muted-foreground">⏱ {fmtDur(c.duration)}</span>}
                                      {c.leadScore >= 80 && <span className="text-xs text-red-400 font-semibold">🔥 HOT</span>}
                                      {c.leadScore >= 60 && c.leadScore < 80 && <span className="text-xs text-orange-400">🌡️ WARM</span>}
                                    </div>
                                    {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                                    <p className="text-xs text-muted-foreground/60">
                                      {new Date(c.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                      {" · "}{c.leadStatus?.replace(/_/g, " ")}
                                    </p>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
