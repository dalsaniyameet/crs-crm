"use client";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, CalendarDays,
  MapPin, User, Calendar, ExternalLink, RefreshCw,
} from "lucide-react";

// Indian festivals & holidays (MM-DD format, year-independent)
const INDIAN_FESTIVALS: Record<string, { name: string; emoji: string; type: "national" | "festival" }> = {
  "01-01": { name: "New Year",           emoji: "🎆", type: "festival" },
  "01-14": { name: "Makar Sankranti",    emoji: "🪁", type: "festival" },
  "01-26": { name: "Republic Day",       emoji: "🇮🇳", type: "national" },
  "02-14": { name: "Valentine's Day",    emoji: "❤️", type: "festival" },
  "03-25": { name: "Holi",               emoji: "🎨", type: "festival" },
  "03-31": { name: "Eid ul-Fitr",        emoji: "🌙", type: "festival" },
  "04-06": { name: "Ram Navami",         emoji: "🙏", type: "festival" },
  "04-14": { name: "Ambedkar Jayanti",   emoji: "📚", type: "national" },
  "04-18": { name: "Good Friday",        emoji: "✝️", type: "festival" },
  "05-01": { name: "Labour Day",         emoji: "⚒️", type: "national" },
  "06-07": { name: "Eid ul-Adha",        emoji: "🌙", type: "festival" },
  "08-09": { name: "Muharram",           emoji: "🌙", type: "festival" },
  "08-15": { name: "Independence Day",   emoji: "🇮🇳", type: "national" },
  "08-16": { name: "Janmashtami",        emoji: "🦚", type: "festival" },
  "08-27": { name: "Ganesh Chaturthi",   emoji: "🐘", type: "festival" },
  "09-05": { name: "Teacher's Day",      emoji: "📖", type: "festival" },
  "10-02": { name: "Gandhi Jayanti",     emoji: "🕊️", type: "national" },
  "10-20": { name: "Dussehra",           emoji: "🏹", type: "festival" },
  "10-31": { name: "Halloween / Sardar Patel Jayanti", emoji: "🎃", type: "festival" },
  "11-01": { name: "Diwali",             emoji: "🪔", type: "festival" },
  "11-05": { name: "Bhai Dooj",          emoji: "🎁", type: "festival" },
  "11-15": { name: "Guru Nanak Jayanti", emoji: "🙏", type: "festival" },
  "12-25": { name: "Christmas",          emoji: "🎄", type: "festival" },
  "12-31": { name: "New Year Eve",       emoji: "🎉", type: "festival" },
};

function getFestival(dateKey: string) {
  const mmdd = dateKey.slice(5); // "YYYY-MM-DD" → "MM-DD"
  return INDIAN_FESTIVALS[mmdd] ?? null;
}

export default function CalendarPage() {
  const today = new Date();
  const [curYear,    setCurYear]    = useState(today.getFullYear());
  const [curMonth,   setCurMonth]   = useState(today.getMonth());
  const [selected,   setSelected]   = useState<string>(toKey(today));
  const [visits,     setVisits]     = useState<any[]>([]);
  const [leaves,     setLeaves]     = useState<any[]>([]);
  const [gcalEvents, setGcalEvents] = useState<any[]>([]);
  const [gcalEmail,  setGcalEmail]  = useState<string | null>(null);
  const [assignedLeads, setAssignedLeads] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  function toKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }

  const load = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true); else setLoading(true);
    const [v, l, g, a] = await Promise.all([
      fetch("/api/visits").then(r => r.json()).catch(() => []),
      fetch("/api/leaves").then(r => r.json()).catch(() => []),
      fetch("/api/google/calendar").then(r => r.json()).catch(() => ({ connected: false, events: [] })),
      fetch("/api/leads?limit=500&assigned=true").then(r => r.json()).catch(() => ({ leads: [] })),
    ]);
    setVisits(Array.isArray(v) ? v : []);
    setLeaves(Array.isArray(l) ? l : []);
    setGcalEvents(g?.events ?? []);
    setGcalEmail(g?.email ?? null);
    setAssignedLeads(Array.isArray(a?.leads) ? a.leads : []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  // Build dot maps
  const visitDays = new Set(visits.map((v: any) => toKey(new Date(v.scheduledAt))));
  const leaveDays = new Set<string>();
  leaves.forEach((l: any) => {
    if (l.status !== "APPROVED") return;
    const from = new Date(l.fromDate), to = new Date(l.toDate);
    for (const d = new Date(from); d <= to; d.setDate(d.getDate() + 1))
      leaveDays.add(toKey(new Date(d)));
  });
  const gcalDays = new Set(
    gcalEvents.map((e: any) => {
      const dt = e.start?.dateTime || e.start?.date;
      return dt ? toKey(new Date(dt)) : "";
    }).filter(Boolean)
  );
  // Follow-up days — leads with nextFollowUpAt on that day
  const followUpDays = new Set(
    assignedLeads
      .filter((l: any) => l.nextFollowUpAt)
      .map((l: any) => toKey(new Date(l.nextFollowUpAt)))
  );

  // Calendar grid
  const firstDay    = new Date(curYear, curMonth, 1).getDay();
  const daysInMonth = new Date(curYear, curMonth + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthName = new Date(curYear, curMonth).toLocaleString("en-IN", { month: "long", year: "numeric" });
  const prevMonth = () => curMonth === 0 ? (setCurMonth(11), setCurYear(y => y - 1)) : setCurMonth(m => m - 1);
  const nextMonth = () => curMonth === 11 ? (setCurMonth(0), setCurYear(y => y + 1)) : setCurMonth(m => m + 1);
  const todayKey  = toKey(today);

  // Selected day events
  const selVisits = visits.filter((v: any) => toKey(new Date(v.scheduledAt)) === selected);
  const selLeaves = leaves.filter((l: any) => {
    if (l.status !== "APPROVED") return false;
    const from = new Date(l.fromDate); from.setHours(0, 0, 0, 0);
    const to   = new Date(l.toDate);   to.setHours(23, 59, 59, 999);
    const sel  = new Date(selected);
    return sel >= from && sel <= to;
  });
  const selGcal = gcalEvents.filter((e: any) => {
    const dt = e.start?.dateTime || e.start?.date;
    return dt && toKey(new Date(dt)) === selected;
  });
  const selFollowUps = assignedLeads.filter((l: any) =>
    l.nextFollowUpAt && toKey(new Date(l.nextFollowUpAt)) === selected
  );

  const totalEvents = selVisits.length + selLeaves.length + selGcal.length + selFollowUps.length;

  const monthFollowUps = assignedLeads.filter((l: any) => {
    if (!l.nextFollowUpAt) return false;
    const d = new Date(l.nextFollowUpAt);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).length;
  const monthVisits = visits.filter((v: any) => {
    const d = new Date(v.scheduledAt);
    return d.getMonth() === curMonth && d.getFullYear() === curYear;
  }).length;
  const monthLeaves = leaves.filter((l: any) => {
    if (l.status !== "APPROVED") return false;
    const from = new Date(l.fromDate), to = new Date(l.toDate);
    return (from.getMonth() === curMonth && from.getFullYear() === curYear) ||
           (to.getMonth()   === curMonth && to.getFullYear()   === curYear);
  }).length;

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Team Calendar</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Site visits · Staff leaves · Google Calendar events
          </p>
        </div>
        <div className="flex items-center gap-2">
          {gcalEmail && (
            <span className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1.5"
              style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
              <CalendarDays className="w-3 h-3" /> {gcalEmail}
            </span>
          )}
          <button onClick={() => load(true)} disabled={refreshing}
            className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all disabled:opacity-50">
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Month summary pills */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
          style={{ background: "rgba(249,115,22,0.1)", border: "1px solid rgba(249,115,22,0.25)", color: "#fb923c" }}>
          <span className="w-2 h-2 rounded-full bg-orange-400" />
          {monthVisits} visits this month
        </span>
        <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", color: "#f87171" }}>
          <span className="w-2 h-2 rounded-full bg-red-400" />
          {monthLeaves} leaves this month
        </span>
        {gcalEmail && (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.25)", color: "#60a5fa" }}>
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            {gcalEvents.length} gcal events
          </span>
        )}
        {monthFollowUps > 0 && (
          <span className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", color: "#c084fc" }}>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            {monthFollowUps} follow-ups this month
          </span>
        )}
        {!gcalEmail && (
          <a href="/settings" className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full transition-colors"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
            <ExternalLink className="w-3 h-3" /> Connect Google Calendar in Settings
          </a>
        )}
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Calendar */}
        <div className="lg:col-span-2 glass-card p-5">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-bold text-white w-36 text-center">{monthName}</span>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Visits</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Leaves</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> GCal</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-400" /> Follow-ups</span>
              <span className="flex items-center gap-1"><span className="text-xs">🎉</span> Festival</span>
              <span className="flex items-center gap-1"><span className="text-xs">🇮🇳</span> Holiday</span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1.5">
              {Array(35).fill(0).map((_, i) => (
                <div key={i} className="h-12 rounded-xl animate-pulse bg-white/5" />
              ))}
            </div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => (
                  <div key={d} className="text-center text-xs text-muted-foreground py-1 font-medium">{d}</div>
                ))}
              </div>
              {/* Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {cells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const key      = `${curYear}-${String(curMonth+1).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
                  const isToday  = key === todayKey;
                  const isSel    = key === selected;
                  const hasVisit   = visitDays.has(key);
                  const hasLeave   = leaveDays.has(key);
                  const hasGcal    = gcalDays.has(key);
                  const hasFollowUp = followUpDays.has(key);
                  const festival   = getFestival(key);
                  const isHoliday  = festival?.type === "national";
                  return (
                    <motion.button key={i} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
                      onClick={() => setSelected(key)}
                      className={`relative h-14 rounded-xl flex flex-col items-center justify-center transition-all text-sm font-medium border ${
                        isSel
                          ? "border-yellow-500/60 text-yellow-300"
                          : isToday
                          ? "border-estate-500/50 text-white"
                          : isHoliday
                          ? "border-orange-500/30 text-orange-300"
                          : festival
                          ? "border-pink-500/20 text-pink-200"
                          : "border-transparent text-muted-foreground hover:text-white hover:border-white/10"
                      }`}
                      style={{
                        background: isSel
                          ? "rgba(234,179,8,0.2)"
                          : isToday
                          ? "rgba(99,102,241,0.2)"
                          : isHoliday
                          ? "rgba(249,115,22,0.08)"
                          : festival
                          ? "rgba(236,72,153,0.06)"
                          : "rgba(255,255,255,0.03)",
                      }}>
                      {festival && <span className="text-xs leading-none mb-0.5">{festival.emoji}</span>}
                      <span className={festival ? "text-xs" : ""}>{day}</span>
                      {(hasVisit || hasLeave || hasGcal || hasFollowUp) && (
                        <div className="flex gap-0.5 mt-0.5">
                          {hasVisit    && <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
                          {hasLeave    && <span className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                          {hasGcal     && <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
                          {hasFollowUp && <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />}
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Day detail panel */}
        <div className="glass-card p-5 flex flex-col lg:sticky lg:top-4 lg:self-start overflow-hidden">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-bold text-white">
                {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { weekday: "long" })}
              </p>
              <p className="text-xs text-muted-foreground">
                {new Date(selected + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
              </p>
            </div>
            {totalEvents > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                style={{ background: "rgba(234,179,8,0.15)", border: "1px solid rgba(234,179,8,0.3)", color: "#facc15" }}>
                {totalEvents} event{totalEvents !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <div className="flex-1 space-y-2 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div key={selected}
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                className="space-y-2">

                {totalEvents === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Calendar className="w-10 h-10 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground">No events</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Nothing scheduled on this day</p>
                  </div>
                )}

                {/* Festival / Holiday */}
                {(() => {
                  const fest = getFestival(selected);
                  if (!fest) return null;
                  return (
                    <div className={`p-3 rounded-xl flex items-center gap-3 ${
                      fest.type === "national"
                        ? "bg-orange-500/10 border border-orange-500/25"
                        : "bg-pink-500/10 border border-pink-500/20"
                    }`}>
                      <span className="text-2xl">{fest.emoji}</span>
                      <div>
                        <p className={`text-sm font-semibold ${
                          fest.type === "national" ? "text-orange-300" : "text-pink-300"
                        }`}>{fest.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fest.type === "national" ? "🇮🇳 National Holiday" : "🎉 Festival"}
                        </p>
                      </div>
                    </div>
                  );
                })()}

                {/* Site Visits */}
                {selVisits.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-orange-400 mb-1.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Site Visits
                    </p>
                    {selVisits.map((v: any) => (
                      <div key={v.id} className="p-3 rounded-xl mb-1.5"
                        style={{ background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.2)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{v.lead?.name}</p>
                          <span className="text-xs text-orange-400 flex-shrink-0 font-medium">
                            {new Date(v.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {v.property?.title && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{v.property.title}</p>
                        )}
                        {v.broker?.name && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5">Broker: {v.broker.name}</p>
                        )}
                        <span className={`text-xs mt-1 inline-block px-1.5 py-0.5 rounded-full ${
                          v.status === "COMPLETED" ? "bg-emerald-500/20 text-emerald-400" :
                          v.status === "CANCELLED" ? "bg-red-500/20 text-red-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>{v.status}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Staff Leaves */}
                {selLeaves.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-400 mb-1.5 flex items-center gap-1">
                      <User className="w-3 h-3" /> Staff on Leave
                    </p>
                    {selLeaves.map((l: any) => (
                      <div key={l.id} className="p-3 rounded-xl mb-1.5"
                        style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)" }}>
                        <p className="text-sm font-semibold text-white">{l.employee?.name || "Staff"}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {(l.type || "CASUAL").replace(/_/g, " ")} Leave · {l.days} day{l.days !== 1 ? "s" : ""}
                        </p>
                        {l.reason && <p className="text-xs text-muted-foreground/70 mt-0.5 truncate">{l.reason}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Google Calendar */}
                {selGcal.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-400 mb-1.5 flex items-center gap-1">
                      <CalendarDays className="w-3 h-3" /> Google Calendar
                    </p>
                    {selGcal.map((e: any) => (
                      <div key={e.id} className="p-3 rounded-xl mb-1.5"
                        style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.2)" }}>
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{e.summary || "Event"}</p>
                          {e.htmlLink && (
                            <a href={e.htmlLink} target="_blank" rel="noreferrer"
                              className="text-blue-400 hover:text-blue-300 flex-shrink-0">
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                        </div>
                        {e.start?.dateTime && (
                          <p className="text-xs text-blue-400 mt-0.5">
                            {new Date(e.start.dateTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                            {e.end?.dateTime && ` – ${new Date(e.end.dateTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`}
                          </p>
                        )}
                        {e.description && (
                          <p className="text-xs text-muted-foreground/70 mt-0.5 line-clamp-2">{e.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Employee → Lead Follow-ups */}
                {selFollowUps.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-purple-400 mb-1.5 flex items-center gap-1">
                      <User className="w-3 h-3" /> Employee Follow-ups
                    </p>
                    {selFollowUps.map((lead: any) => (
                      <div key={lead.id} className="p-3 rounded-xl mb-1.5"
                        style={{ background: "rgba(168,85,247,0.08)", border: "1px solid rgba(168,85,247,0.2)" }}>
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white truncate">{lead.name}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            lead.score >= 80 ? "bg-red-500/20 text-red-400" :
                            lead.score >= 60 ? "bg-orange-500/20 text-orange-400" :
                            "bg-blue-500/20 text-blue-400"
                          }`}>
                            {lead.score >= 80 ? "🔥" : lead.score >= 60 ? "🌡️" : "❄️"} {lead.score}
                          </span>
                        </div>
                        {lead.assignedTo?.name && (
                          <p className="text-xs text-purple-300 mt-0.5 flex items-center gap-1">
                            <User className="w-3 h-3" /> {lead.assignedTo.name}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {lead.phone && (
                            <a href={`tel:${lead.phone}`}
                              className="text-xs text-emerald-400 hover:text-emerald-300">
                              📞 {lead.phone}
                            </a>
                          )}
                          {lead.requirements && (
                            <p className="text-xs text-muted-foreground truncate">{lead.requirements}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
