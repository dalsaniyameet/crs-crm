"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Loader2, CheckCircle2, Phone, Building2, TrendingUp, Users, Calendar, ClipboardList, ChevronLeft, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

const EMPTY = {
  totalCalls: "", connectedCalls: "", newLeads: "",
  siteVisits: "", visitsFeedback: "",
  dealsInProgress: "", dealsClosed: "", dealValue: "",
  propertiesListed: "", propertiesVisited: "",
  followUpsDone: "", followUpsPending: "",
  highlights: "", challenges: "", tomorrowPlan: "",
};

interface CallEntry {
  id: string;
  name: string;
  phone: string;
  outcome: "CONNECTED" | "NO_ANSWER" | "BUSY" | "CALLBACK";
  notes: string;
  location: string;
}

const OUTCOME_LABELS: Record<string, { label: string; color: string }> = {
  CONNECTED:  { label: "✅ Connected",   color: "text-emerald-400" },
  NO_ANSWER:  { label: "📵 No Answer",   color: "text-red-400" },
  BUSY:       { label: "🔴 Busy",        color: "text-orange-400" },
  CALLBACK:   { label: "🔁 Callback",    color: "text-yellow-400" },
};

function newCall(): CallEntry {
  return { id: Date.now().toString(), name: "", phone: "", outcome: "CONNECTED", notes: "", location: "" };
}

function toDateKey(d: Date) {
  return d.toISOString().split("T")[0];
}

export default function EmployeeDailyReportPage() {
  const { user, isLoaded } = useUser();
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [empName, setEmpName]       = useState("");
  const [notFound, setNotFound]     = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [existing, setExisting]     = useState<any>(null);
  const [loading, setLoading]       = useState(true);
  const [pastReports, setPastReports] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState(toDateKey(new Date()));
  const [todayVisits, setTodayVisits]   = useState<any[]>([]);
  const [callEntries, setCallEntries]   = useState<CallEntry[]>([newCall()]);

  // Fetch employee profile from API using Clerk session
  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { setLoading(false); return; }

    fetch("/api/employee/profile")
      .then(r => r.json())
      .then(emp => {
        if (emp?.id) {
          setEmployeeId(emp.id);
          setEmpName(emp.name || "");
        } else {
          // Try creating employee profile from user data
          const email = user.primaryEmailAddress?.emailAddress || "";
          const name  = user.fullName || user.firstName || email.split("@")[0] || "Employee";
          fetch("/api/employee/profile", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email }),
          })
            .then(r => r.json())
            .then(created => {
              if (created?.id) { setEmployeeId(created.id); setEmpName(created.name || ""); }
              else setNotFound(true);
            })
            .catch(() => setNotFound(true));
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [isLoaded, user]);

  useEffect(() => {
    if (!employeeId) { setLoading(false); return; }
    loadReport(selectedDate);
    loadPastReports();
    // Auto-pull today's visits for daily report
    if (selectedDate === toDateKey(new Date())) {
      fetch("/api/visits")
        .then(r => r.json())
        .then((data: any[]) => {
          if (!Array.isArray(data)) return;
          const today = toDateKey(new Date());
          const todayDone = data.filter(v =>
            toDateKey(new Date(v.scheduledAt)) === today &&
            (v.status === "COMPLETED" || v.status === "CONFIRMED" || v.status === "SCHEDULED")
          );
          setTodayVisits(todayDone);
          // Auto-fill siteVisits count & feedback if not already submitted
          setForm(prev => ({
            ...prev,
            siteVisits: prev.siteVisits || String(todayDone.filter(v => v.status === "COMPLETED").length),
            visitsFeedback: prev.visitsFeedback || todayDone
              .filter(v => v.feedback)
              .map(v => `${v.lead?.name} @ ${v.property?.title || "property"}: ${v.feedback}`)
              .join("\n") || prev.visitsFeedback,
          }));
        })
        .catch(() => {});
    }
  }, [employeeId, selectedDate]);

  // Auto-sync call counts from callEntries
  useEffect(() => {
    const total     = callEntries.filter(c => c.name || c.phone).length;
    const connected = callEntries.filter(c => c.outcome === "CONNECTED" && (c.name || c.phone)).length;
    setForm(p => ({ ...p, totalCalls: total ? String(total) : p.totalCalls, connectedCalls: connected ? String(connected) : p.connectedCalls }));
  }, [callEntries]);

  async function loadReport(date: string) {
    setLoading(true);
    setSubmitted(false);
    setExisting(null);
    try {
      const res  = await fetch(`/api/daily-reports?employeeId=${employeeId}&date=${date}`);
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const r = data[0];
        setExisting(r);
        setForm({
          totalCalls: String(r.totalCalls || ""), connectedCalls: String(r.connectedCalls || ""),
          newLeads: String(r.newLeads || ""), siteVisits: String(r.siteVisits || ""),
          visitsFeedback: r.visitsFeedback || "", dealsInProgress: String(r.dealsInProgress || ""),
          dealsClosed: String(r.dealsClosed || ""), dealValue: String(r.dealValue || ""),
          propertiesListed: String(r.propertiesListed || ""), propertiesVisited: String(r.propertiesVisited || ""),
          followUpsDone: String(r.followUpsDone || ""), followUpsPending: String(r.followUpsPending || ""),
          highlights: r.highlights || "", challenges: r.challenges || "", tomorrowPlan: r.tomorrowPlan || "",
        });
        if (Array.isArray(r.callEntries) && r.callEntries.length > 0)
          setCallEntries(r.callEntries.map((c: any) => ({ ...c, id: c.id || Date.now().toString() + Math.random() })));
        else
          setCallEntries([newCall()]);
        setSubmitted(true);
      } else {
        setForm(EMPTY);
      }
    } catch {}
    setLoading(false);
  }

  async function loadPastReports() {
    try {
      const res  = await fetch(`/api/daily-reports?employeeId=${employeeId}&limit=7`);
      const data = await res.json();
      setPastReports(Array.isArray(data) ? data : []);
    } catch {}
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!employeeId) { toast.error("Login required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/daily-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId, date: selectedDate,
          totalCalls: parseInt(form.totalCalls) || 0,
          connectedCalls: parseInt(form.connectedCalls) || 0,
          newLeads: parseInt(form.newLeads) || 0,
          siteVisits: parseInt(form.siteVisits) || 0,
          visitsFeedback: form.visitsFeedback || null,
          dealsInProgress: parseInt(form.dealsInProgress) || 0,
          dealsClosed: parseInt(form.dealsClosed) || 0,
          dealValue: parseFloat(form.dealValue) || 0,
          propertiesListed: parseInt(form.propertiesListed) || 0,
          propertiesVisited: parseInt(form.propertiesVisited) || 0,
          followUpsDone: parseInt(form.followUpsDone) || 0,
          followUpsPending: parseInt(form.followUpsPending) || 0,
          highlights: form.highlights || null,
          challenges: form.challenges || null,
          tomorrowPlan: form.tomorrowPlan || null,
          callEntries: callEntries.filter(c => c.name || c.phone),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setExisting(data);
      setSubmitted(true);
      toast.success("✅ Daily report submitted!");
      loadPastReports();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    }
    setSaving(false);
  }

  const inp    = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-estate-500/50";
  const numInp = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-center font-bold placeholder:text-white/30 focus:outline-none focus:border-estate-500/50";
  const today  = toDateKey(new Date());
  const isToday = selectedDate === today;

  if (!isLoaded || loading) return (
    <div className="p-6 flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
    </div>
  );

  if (!user) return (
    <div className="p-6 text-center text-muted-foreground">
      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>Please sign in to submit daily report</p>
    </div>
  );

  if (notFound || !employeeId) return (
    <div className="p-6 text-center text-muted-foreground">
      <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p className="font-semibold text-white mb-1">Employee profile not found</p>
      <p className="text-sm">Contact admin to add you as an employee.</p>
      <p className="text-xs mt-2 text-muted-foreground">{user.primaryEmailAddress?.emailAddress}</p>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-estate-400" /> Daily Report
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Submit today's work summary</p>
        </div>
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2">
          <button onClick={() => {
            const d = new Date(selectedDate); d.setDate(d.getDate() - 1);
            setSelectedDate(toDateKey(d));
          }} className="text-muted-foreground hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm text-white font-medium min-w-[110px] text-center">
            {isToday ? "Today" : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <button onClick={() => {
            const d = new Date(selectedDate); d.setDate(d.getDate() + 1);
            if (toDateKey(d) <= today) setSelectedDate(toDateKey(d));
          }} disabled={isToday} className="text-muted-foreground hover:text-white transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Submitted banner */}
      {submitted && existing && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-400">Report submitted ✅</p>
            <p className="text-xs text-muted-foreground">
              {new Date(existing.updatedAt || existing.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })} · Update kar sakte ho
            </p>
          </div>
          {existing.adminNote && (
            <div className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-2 py-1 max-w-[160px] truncate">
              💬 {existing.adminNote}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Calls */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-400" />
                <h2 className="text-sm font-semibold text-white">📞 Calls</h2>
              </div>
              <button type="button" onClick={() => setCallEntries(p => [...p, newCall()])}
                className="text-xs px-2 py-1 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-all">
                + Add Call
              </button>
            </div>

            {/* Call count summary — auto-synced */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Total Calls",  key: "totalCalls",     color: "text-white" },
                { label: "Connected",    key: "connectedCalls", color: "text-emerald-400" },
                { label: "New Leads",    key: "newLeads",       color: "text-gold-400" },
              ].map(f => (
                <div key={f.key} className="text-center">
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input type="number" min="0" value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="0" className={`${numInp} ${f.color}`} />
                </div>
              ))}
            </div>

            {/* Call detail entries */}
            <div className="space-y-2">
              {callEntries.map((entry, i) => (
                <div key={entry.id} className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Call #{i + 1}</span>
                    {callEntries.length > 1 && (
                      <button type="button" onClick={() => setCallEntries(p => p.filter(c => c.id !== entry.id))}
                        className="text-xs text-red-400 hover:text-red-300">✕ Remove</button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Client Name</label>
                      <input value={entry.name} onChange={e => setCallEntries(p => p.map(c => c.id === entry.id ? { ...c, name: e.target.value } : c))}
                        placeholder="Rajesh Patel" className={inp} />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Phone</label>
                      <input value={entry.phone} onChange={e => setCallEntries(p => p.map(c => c.id === entry.id ? { ...c, phone: e.target.value } : c))}
                        placeholder="9876543210" className={inp} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Outcome</label>
                      <select value={entry.outcome} onChange={e => setCallEntries(p => p.map(c => c.id === entry.id ? { ...c, outcome: e.target.value as any } : c))}
                        className={`${inp} ${OUTCOME_LABELS[entry.outcome]?.color}`}>
                        {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                          <option key={k} value={k} className="bg-[#0f1f35] text-white">{v.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Location / Area</label>
                      <div className="relative">
                        <input value={entry.location} onChange={e => setCallEntries(p => p.map(c => c.id === entry.id ? { ...c, location: e.target.value } : c))}
                          placeholder="Prahlad Nagar, Ahmedabad" className={inp} />
                        {entry.location && (
                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entry.location + ", Ahmedabad")}`}
                            target="_blank" rel="noreferrer"
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300" title="Open in Google Maps">
                            🗺️
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                    <input value={entry.notes} onChange={e => setCallEntries(p => p.map(c => c.id === entry.id ? { ...c, notes: e.target.value } : c))}
                      placeholder="Interested in office space, budget 50K/mo..." className={inp} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Site Visits */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-400" />
              <h2 className="text-sm font-semibold text-white">🏠 Site Visits & Properties</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Visits Done",   key: "siteVisits",        color: "text-orange-400" },
                { label: "Props Visited", key: "propertiesVisited", color: "text-white" },
                { label: "Props Listed",  key: "propertiesListed",  color: "text-purple-400" },
              ].map(f => (
                <div key={f.key} className="text-center">
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input type="number" min="0" value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="0" className={`${numInp} ${f.color}`} />
                </div>
              ))}
            </div>

            {/* Auto-pulled visits from system */}
            {todayVisits.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-orange-400 font-semibold">⚡ Auto-pulled from today’s scheduled visits:</p>
                {todayVisits.map(v => {
                  const mapsQ = [v.property?.address, v.property?.locality, v.property?.city, "Ahmedabad"].filter(Boolean).join(", ");
                  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQ)}`;
                  const price = v.property?.price;
                  const fmtP = price ? (price >= 100000 ? `₹${(price/100000).toFixed(1)}L` : `₹${price}`) + (v.property?.transactionType === "RENT" || v.property?.transactionType === "LEASE" ? "/mo" : "") : null;
                  return (
                    <div key={v.id} className="p-3 rounded-xl bg-orange-500/5 border border-orange-500/20 space-y-1.5">
                      {/* Client row */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-white">👤 {v.lead?.name}</span>
                        {v.lead?.phone && (
                          <a href={`tel:${v.lead.phone}`} className="text-xs text-emerald-400 hover:text-emerald-300">📞 {v.lead.phone}</a>
                        )}
                        {v.lead?.budget && (
                          <span className="text-xs text-yellow-400">💰 ₹{v.lead.budget >= 100000 ? `${(v.lead.budget/100000).toFixed(1)}L` : v.lead.budget}</span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                          v.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" :
                          v.status === "CONFIRMED" ? "bg-blue-500/20 text-blue-400" : "bg-yellow-500/20 text-yellow-400"
                        }`}>{v.status}</span>
                      </div>
                      {/* Property + Location row */}
                      {v.property && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={mapsUrl} target="_blank" rel="noreferrer"
                            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                            🗺️ {v.property.title} — {v.property.locality}
                          </a>
                          {fmtP && <span className="text-xs text-gold-400 font-semibold">{fmtP}</span>}
                        </div>
                      )}
                      {/* Owner row */}
                      {v.property?.ownerName && (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">🏢 Owner: <span className="text-white">{v.property.ownerName}</span></span>
                          {v.property.ownerPhone && (
                            <a href={`tel:${v.property.ownerPhone}`} className="text-xs text-emerald-400">📞 {v.property.ownerPhone}</a>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Visit Feedback / Notes</label>
              <textarea rows={2} value={form.visitsFeedback}
                onChange={e => setForm(p => ({ ...p, visitsFeedback: e.target.value }))}
                placeholder="Client reaction, property feedback, next steps..."
                className={`${inp} resize-none`} />
            </div>
          </div>

          {/* Deals & Follow-ups */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-white">💰 Deals & Follow-ups</h2>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "Deals Active",    key: "dealsInProgress", color: "text-yellow-400" },
                { label: "Deals Closed",    key: "dealsClosed",     color: "text-emerald-400" },
                { label: "Follow-ups Done", key: "followUpsDone",   color: "text-blue-400" },
                { label: "Pending F/U",     key: "followUpsPending",color: "text-red-400" },
              ].map(f => (
                <div key={f.key} className="text-center">
                  <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                  <input type="number" min="0" value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    placeholder="0" className={`${numInp} ${f.color}`} />
                </div>
              ))}
            </div>

            {/* Deal closed details */}
            {parseInt(form.dealsClosed) > 0 && (
              <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                <p className="text-xs font-semibold text-emerald-400">✅ Deal Closed Details</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Client Name</label>
                    <input value={form.highlights.includes("Client:") ? "" : ""}
                      onChange={e => setForm(p => ({ ...p, highlights: `Client: ${e.target.value}\n` + p.highlights.replace(/^Client:.*\n?/, "") }))}
                      placeholder="Rajesh Patel" className={inp} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Client Phone</label>
                    <input placeholder="9876543210" className={inp} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Deal Amount (₹)</label>
                    <input type="number" min="0" value={form.dealValue}
                      onChange={e => setForm(p => ({ ...p, dealValue: e.target.value }))}
                      placeholder="0" className={`${inp} text-emerald-400 font-bold`} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Property Location</label>
                    <div className="relative">
                      <input id="dealLocation" placeholder="Prahlad Nagar, Ahmedabad" className={inp}
                        onChange={e => {
                          const loc = e.target.value;
                          (e.target as any)._loc = loc;
                        }} />
                      <button type="button" onClick={() => {
                        const el = document.getElementById("dealLocation") as HTMLInputElement;
                        if (el?.value) window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(el.value + ", Ahmedabad")}`, "_blank");
                      }} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 hover:text-blue-300" title="Open Maps">
                        🗺️
                      </button>
                    </div>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Owner Name & Phone</label>
                  <input placeholder="Owner: Suresh Patel · 9876543210" className={inp} />
                </div>
              </div>
            )}

            <div>
              <label className="text-xs text-muted-foreground block mb-1">Deal Value Closed Today (₹)</label>
              <input type="number" min="0" value={form.dealValue}
                onChange={e => setForm(p => ({ ...p, dealValue: e.target.value }))}
                placeholder="0" className={`${inp} text-emerald-400 font-bold`} />
            </div>
          </div>

          {/* Summary */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-400" />
              <h2 className="text-sm font-semibold text-white">📝 Day Summary</h2>
            </div>
            {[
              { label: "🌟 Highlights (what went well today)", key: "highlights", ph: "e.g. 2 hot leads found, office deal in Satellite almost closed..." },
              { label: "⚠️ Challenges (any problems faced)", key: "challenges", ph: "e.g. Client negotiated price, property photos not available..." },
              { label: "📅 Tomorrow's Plan", key: "tomorrowPlan", ph: "e.g. 3 site visits, follow-up call with Rajesh Patel, add new listing..." },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs text-muted-foreground block mb-1">{f.label}</label>
                <textarea rows={2} value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.ph} className={`${inp} resize-none`} />
              </div>
            ))}
          </div>

          <button type="submit" disabled={saving}
            className="w-full btn-primary py-3 text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {saving ? "Submitting..." : submitted ? "Update Report" : "Submit Daily Report"}
          </button>
        </form>
      )}

      {/* Past reports */}
      {pastReports.length > 0 && (
        <div className="glass-card p-4">
          <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" /> Recent Reports
          </h3>
          <div className="space-y-2">
            {pastReports.map(r => (
              <button key={r.id} onClick={() => setSelectedDate(toDateKey(new Date(r.date)))}
                className={`w-full flex items-center gap-3 p-2.5 rounded-lg text-left transition-all hover:bg-white/5 border ${
                  toDateKey(new Date(r.date)) === selectedDate ? "border-estate-500/40 bg-estate-500/5" : "border-white/5"
                }`}>
                <div className="text-center flex-shrink-0 w-10">
                  <div className="text-xs font-bold text-white">{new Date(r.date).getDate()}</div>
                  <div className="text-xs text-muted-foreground">{new Date(r.date).toLocaleString("en-IN", { month: "short" })}</div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs text-blue-400">📞 {r.totalCalls}</span>
                    <span className="text-xs text-orange-400">🏠 {r.siteVisits}</span>
                    <span className="text-xs text-emerald-400">✅ {r.dealsClosed} closed</span>
                    {r.newLeads > 0 && <span className="text-xs text-gold-400">⭐ {r.newLeads} leads</span>}
                  </div>
                  {r.highlights && <p className="text-xs text-muted-foreground truncate mt-0.5">{r.highlights}</p>}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${
                  r.status === "REVIEWED" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
                }`}>{r.status === "REVIEWED" ? "✓ Reviewed" : "Submitted"}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
