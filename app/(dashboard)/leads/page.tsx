"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Phone, MessageSquare, Mail,
  Star, Zap, Eye, Download, Bot, RefreshCw, Loader2,
  X, Calendar, MapPin, TrendingUp, ChevronDown,
  PhoneCall, PhoneOff, PhoneMissed, PhoneIncoming,
  Clock, CheckCircle2, AlertCircle, StickyNote, Mic, MicOff,
} from "lucide-react";
import toast from "react-hot-toast";

import { useUser } from "@clerk/nextjs";

type LeadStatus = "NEW" | "CONTACTED" | "SITE_VISIT_SCHEDULED" | "NEGOTIATION" | "DEAL_CLOSED" | "LOST";

interface Lead {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: LeadStatus;
  score: number;
  budget?: number;
  requirements?: string;
  assignedTo?: { id: string; name: string };
  nextFollowUpAt?: string;
  lastContactedAt?: string;
  createdAt: string;
  callLogs?: Array<{ outcome: string; createdAt: string; notes?: string; duration?: number }>;
  tasks?: Array<{ title: string; dueAt: string; priority: string }>;
}

const statusConfig: Record<LeadStatus, { label: string; color: string; bg: string }> = {
  NEW:                   { label: "New Lead",        color: "text-blue-400",    bg: "bg-blue-500/20 border-blue-500/30" },
  CONTACTED:             { label: "Contacted",       color: "text-yellow-400",  bg: "bg-yellow-500/20 border-yellow-500/30" },
  SITE_VISIT_SCHEDULED:  { label: "Visit Scheduled", color: "text-purple-400",  bg: "bg-purple-500/20 border-purple-500/30" },
  NEGOTIATION:           { label: "Negotiation",     color: "text-orange-400",  bg: "bg-orange-500/20 border-orange-500/30" },
  DEAL_CLOSED:           { label: "Deal Closed",     color: "text-emerald-400", bg: "bg-emerald-500/20 border-emerald-500/30" },
  LOST:                  { label: "Lost",            color: "text-red-400",     bg: "bg-red-500/20 border-red-500/30" },
};

const scoreColor = (s: number) => s >= 80 ? "text-red-400" : s >= 60 ? "text-orange-400" : "text-blue-400";
const scoreBg    = (s: number) => s >= 80 ? "bg-red-500/20 border-red-500/30" : s >= 60 ? "bg-orange-500/20 border-orange-500/30" : "bg-blue-500/20 border-blue-500/30";
const scoreLabel = (s: number) => s >= 80 ? "🔥 HOT" : s >= 60 ? "🌡️ WARM" : "❄️ COLD";

const fmtBudget = (b?: number) => {
  if (!b || b <= 0) return "—";
  // If stored as lakhs (e.g. 23.5 = 23.5L), values < 1000 are in lakhs
  const val = b < 1000 ? b * 100000 : b;
  return val >= 10000000 ? `₹${(val/10000000).toFixed(1)}Cr`
    : val >= 100000 ? `₹${(val/100000).toFixed(1)}L`
    : `₹${(val/1000).toFixed(0)}K`;
};
const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

const fmtDuration = (s?: number) => {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

const OUTCOME_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  ANSWERED:             { label: "Answered",           color: "text-emerald-400", icon: PhoneCall },
  NO_ANSWER:            { label: "No Answer",          color: "text-red-400",     icon: PhoneMissed },
  BUSY:                 { label: "Busy",               color: "text-orange-400",  icon: PhoneOff },
  CALLBACK_REQUESTED:   { label: "Callback Requested", color: "text-yellow-400",  icon: PhoneIncoming },
  INTERESTED:           { label: "Interested ✓",       color: "text-green-400",   icon: CheckCircle2 },
  NOT_INTERESTED:       { label: "Not Interested",     color: "text-red-400",     icon: AlertCircle },
};

export default function LeadsPage() {
  const { user, isLoaded } = useUser();
  const role = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase();
  const isAdmin = role === "ADMIN";
  const canSeeAll = role === "ADMIN" || role === "SALES_MANAGER" || role === "MARKETING";

  const [leads, setLeads]           = useState<Lead[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending]  = useState(false);
  const [detailLead, setDetailLead]    = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [brokers, setBrokers]          = useState<any[]>([]);
  const [updatingLead, setUpdatingLead] = useState(false);

  const [detailTab, setDetailTab]      = useState<"overview"|"calls"|"followups"|"notes">("overview");
  const [callLogs, setCallLogs]         = useState<any[]>([]);
  const [callLogsLoading, setCallLogsLoading] = useState(false);
  const [tasks, setTasks]                 = useState<any[]>([]);
  const [tasksLoading, setTasksLoading]   = useState(false);
  const [taskForm, setTaskForm]           = useState({ title: "", description: "", dueAt: "", priority: "MEDIUM" });
  const [savingTask, setSavingTask]       = useState(false);
  const [showCallModal, setShowCallModal] = useState(false);
  const [callForm, setCallForm]           = useState({ outcome: "ANSWERED", duration: "", notes: "", followUpAt: "", recordingUrl: "" });
  const [savingCall, setSavingCall]       = useState(false);
  const [noteText, setNoteText]           = useState("");
  const [savingNote, setSavingNote]       = useState(false);
  // Call timer
  const [callActive, setCallActive]       = useState(false);
  const [callSeconds, setCallSeconds]     = useState(0);
  const timerRef                          = useRef<ReturnType<typeof setInterval> | null>(null);
  const [form, setForm] = useState({
    name: "", phone: "", email: "", source: "WEBSITE",
    budget: "", requirements: "", propertyType: "", transactionType: "BUY",
  });

  // Auto-open lead from URL param (e.g. from search results)
  const searchParams = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) openDetail(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      const res  = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load leads");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => {
    fetch("/api/brokers?assign=1").then(r => r.json()).then(d => setBrokers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const openDetail = async (id: string) => {
    setDetailLead({});
    setDetailLoading(true);
    setDetailTab("overview");
    try {
      const res  = await fetch(`/api/leads/${id}`);
      const data = await res.json();
      setDetailLead(data);
    } catch { toast.error("Failed to load lead"); setDetailLead(null); }
    finally { setDetailLoading(false); }
  };

  const updateLead = async (id: string, patch: Record<string, any>) => {
    setUpdatingLead(true);
    try {
      const res  = await fetch(`/api/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const data = await res.json();
      setDetailLead((prev: any) => ({ ...prev, ...data }));
      setLeads(prev => prev.map(l => l.id === id ? { ...l, ...data } : l));
      toast.success("Updated!");
    } catch { toast.error("Update failed"); }
    finally { setUpdatingLead(false); }
  };

  const loadCallLogs = useCallback(async (leadId: string) => {
    setCallLogsLoading(true);
    try {
      const data = await fetch(`/api/leads/call-log?leadId=${leadId}`).then(r => r.json());
      setCallLogs(Array.isArray(data) ? data : []);
    } catch {}
    setCallLogsLoading(false);
  }, []);

  const loadTasks = useCallback(async (leadId: string) => {
    setTasksLoading(true);
    try {
      const data = await fetch(`/api/leads/tasks?leadId=${leadId}`).then(r => r.json());
      setTasks(Array.isArray(data) ? data : []);
    } catch {}
    setTasksLoading(false);
  }, []);

  const handleCallClick = (lead: any) => {
    // Open detail, switch to calls tab, start timer
    openDetail(lead.id);
    setDetailTab("calls");
    setCallActive(true);
    setCallSeconds(0);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
    window.open(`tel:${lead.phone}`);
  };

  const stopCallTimer = () => {
    clearInterval(timerRef.current);
    setCallActive(false);
    setCallForm(f => ({ ...f, duration: String(callSeconds) }));
    setShowCallModal(true);
  };

  const saveCallLog = async () => {
    if (!detailLead?.id) return;
    setSavingCall(true);
    try {
      const res = await fetch("/api/leads/call-log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId:      detailLead.id,
          type:        "OUTGOING",
          duration:    callForm.duration ? parseInt(callForm.duration) : undefined,
          notes:       callForm.notes    || undefined,
          outcome:     callForm.outcome  || undefined,
          recordingUrl: callForm.recordingUrl || undefined,
          followUpAt:  callForm.followUpAt || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Call logged!");
        setShowCallModal(false);
        setCallForm({ outcome: "ANSWERED", duration: "", notes: "", followUpAt: "", recordingUrl: "" });
        setCallSeconds(0);
        loadCallLogs(detailLead.id);
        // Refresh lead
        const updated = await fetch(`/api/leads/${detailLead.id}`).then(r => r.json());
        setDetailLead(updated);
        setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, ...updated } : l));
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to log call");
      }
    } catch { toast.error("Failed to save call"); }
    setSavingCall(false);
  };

  const saveNote = async () => {
    if (!detailLead?.id || !noteText.trim()) return;
    setSavingNote(true);
    try {
      await fetch(`/api/leads/${detailLead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: noteText.trim() }),
      });
      setDetailLead((prev: any) => ({ ...prev, notes: noteText.trim() }));
      toast.success("Note saved!");
    } catch { toast.error("Failed"); }
    setSavingNote(false);
  };

  const saveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailLead?.id || !taskForm.title.trim() || !taskForm.dueAt) return;
    setSavingTask(true);
    try {
      const res = await fetch("/api/leads/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId:      detailLead.id,
          title:       taskForm.title.trim(),
          description: taskForm.description.trim() || undefined,
          dueAt:       taskForm.dueAt,
          priority:    taskForm.priority,
        }),
      });
      if (res.ok) {
        const created = await res.json();
        setTasks(prev => [created, ...prev]);
        setTaskForm({ title: "", description: "", dueAt: "", priority: "MEDIUM" });
        const updated = await fetch(`/api/leads/${detailLead.id}`).then(r => r.json());
        setDetailLead(updated);
        setLeads(prev => prev.map(l => l.id === detailLead.id ? { ...l, ...updated } : l));
        toast.success("Follow-up task created!");
      } else {
        const data = await res.json();
        toast.error(data.error || "Failed to create task");
      }
    } catch {
      toast.error("Failed to save task");
    } finally {
      setSavingTask(false);
    }
  };

  const toggleTaskCompletion = async (task: any) => {
    try {
      const res = await fetch("/api/leads/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, isCompleted: !task.isCompleted }),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks(prev => prev.map(t => t.id === updated.id ? updated : t));
        toast.success(updated.isCompleted ? "Task completed" : "Task reopened");
      }
    } catch {
      toast.error("Failed to update task");
    }
  };

  // Load call logs when detail opens
  useEffect(() => {
    if (detailLead?.id) {
      loadCallLogs(detailLead.id);
      loadTasks(detailLead.id);
      setNoteText(detailLead.notes || "");
    }
  }, [detailLead?.id, loadCallLogs, loadTasks]);

  // Cleanup timer
  useEffect(() => () => clearInterval(timerRef.current), []);

  const filtered = leads.filter(l =>
    l.name.toLowerCase().includes(search.toLowerCase()) ||
    l.phone.includes(search) ||
    (l.requirements ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, budget: form.budget ? parseFloat(form.budget) : undefined }),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.error("Duplicate lead detected! This phone number already exists.");
      } else if (res.ok) {
        toast.success(`Lead added! AI Score: ${data.aiScore?.score ?? "—"}`);
        setShowAddModal(false);
        setForm({ name: "", phone: "", email: "", source: "WEBSITE", budget: "", requirements: "", propertyType: "", transactionType: "BUY" });
        fetchLeads();
      } else {
        toast.error(data.error || "Failed to add lead");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleSelect = (id: string) => setSelected(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  const selectAll  = () => setSelected(new Set(filtered.map(l => l.id)));
  const clearAll   = () => setSelected(new Set());

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} lead(s)? This cannot be undone.`)) return;
    setBulkSending(true);
    try {
      await Promise.all(
        Array.from(selected).map(id =>
          fetch(`/api/leads/${id}`, { method: "DELETE" })
        )
      );
      toast.success(`${selected.size} lead(s) deleted`);
      setSelected(new Set());
      fetchLeads();
    } catch { toast.error("Delete failed"); }
    setBulkSending(false);
  };

  const handleBulkMessage = async (type: "whatsapp" | "email" | "sms") => {
    if (selected.size === 0) return;
    setBulkSending(true);
    try {
      const res = await fetch("/api/leads/bulk-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, leadIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${type === "whatsapp" ? "WhatsApp" : type === "email" ? "Email" : "SMS"} sent to ${selected.size} leads!`);
        setSelected(new Set());
      } else {
        toast.error(data.error || "Failed to send");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setBulkSending(false);
    }
  };

  const [propModal, setPropModal] = useState<any>(null);
  const [propLoading, setPropLoading] = useState(false);

  const openProperty = async (propertyId: string) => {
    setPropModal({});
    setPropLoading(true);
    try {
      const data = await fetch(`/api/properties/${propertyId}`).then(r => r.json());
      setPropModal(data);
    } catch { toast.error("Failed to load property"); setPropModal(null); }
    finally { setPropLoading(false); }
  };

  const getWAMsg = (lead: Lead) => {
    const src = lead.source;
    const req = lead.requirements ? `\n\n📋 *Requirement:* ${lead.requirements}` : "";
    const bud = lead.budget ? `\n💰 *Budget:* ${fmtBudget(lead.budget)}` : "";

    if (src === "MAGICBRICKS" || src === "HOUSING" || src === "ACRES99") {
      const portal = src === "MAGICBRICKS" ? "MagicBricks" : src === "HOUSING" ? "Housing.com" : "99acres";
      return `Hello ${lead.name}! 👋

I'm *Meet* from *City Real Space*, Ahmedabad's trusted real estate brokerage.

I saw your enquiry on *${portal}* and wanted to connect personally.${req}${bud}

We have excellent properties matching your requirement. Can we schedule a quick call or site visit? 🏢

📞 +91 9825031247
🌐 cityrealspace.com
📍 Prahlad Nagar, Ahmedabad`;
    }
    if (src === "FACEBOOK") {
      return `Hello ${lead.name}! 👋

Thank you for showing interest via *Facebook*!

I'm *Meet* from *City Real Space* — we specialize in Commercial & Residential properties in Ahmedabad.${req}${bud}

Let's connect and find the perfect property for you! 🏠

📞 +91 9825031247
🌐 cityrealspace.com`;
    }
    if (src === "WEBSITE") {
      return `Hello ${lead.name}! 👋

Thank you for visiting *CityRealSpace.com*!

I'm *Meet*, your dedicated property consultant. I noticed your enquiry and would love to help you find the right property.${req}${bud}

Shall we schedule a call or site visit? 📅

📞 +91 9825031247
🌐 cityrealspace.com`;
    }
    if (src === "REFERRAL") {
      return `Hello ${lead.name}! 👋

I'm *Meet* from *City Real Space*. A mutual contact referred you to us!

We specialize in premium Commercial & Residential properties across Ahmedabad.${req}${bud}

Looking forward to helping you! 🙏

📞 +91 9825031247`;
    }
    // Default / WHATSAPP / WALK_IN / COLD_CALL
    return `Hello ${lead.name}! 👋

Good Day!

I'm *Meet* from *City Real Space*
( Property Broker — Ahmedabad )${req}${bud}

We have genuine properties matching your requirement. Let's connect! 🤝

📞 +91 9825031247
🌐 cityrealspace.com
📍 Prahlad Nagar Trade Centre, Satellite, Ahmedabad`;
  };
  const hotCount  = leads.filter(l => l.score >= 80).length;
  const followUps = leads.filter(l => l.nextFollowUpAt && new Date(l.nextFollowUpAt) <= new Date()).length;

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50 transition-all";

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Lead Management</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {isAdmin
              ? <>{total} leads · <span className="text-red-400">{hotCount} hot</span> · <span className="text-yellow-400">{followUps} due</span></>
              : <>My Leads: {total} · <span className="text-red-400">{hotCount} hot</span> · <span className="text-yellow-400">{followUps} due</span></>
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={fetchLeads} className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          {isAdmin && (
            <a href="/api/leads/export" download
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all">
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
            </a>
          )}
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Lead</span><span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-estate-500/50 transition-all" />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "NEW", "CONTACTED", "SITE_VISIT_SCHEDULED", "NEGOTIATION", "DEAL_CLOSED", "LOST"].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? "bg-estate-600/30 border border-estate-500/50 text-estate-400"
                  : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white"
              }`}>
              {s === "ALL" ? "All" : statusConfig[s as LeadStatus]?.label || s}
            </button>
          ))}
          {/* Select All / Clear — admin only */}
          {isAdmin && (
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={selectAll}
                className="px-2.5 py-1 rounded-lg text-xs font-medium bg-estate-500/15 border border-estate-500/30 text-estate-400 hover:bg-estate-500/25 transition-all">
                ☑ Select All ({filtered.length})
              </button>
              {selected.size > 0 && (
                <button onClick={clearAll} className="px-2.5 py-1 rounded-lg text-xs text-muted-foreground border border-white/10 bg-white/5 hover:text-white transition-all">
                  ✕ Clear
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Banner */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-estate-900/50 to-gold-900/30 border border-estate-500/20">
        <div className="w-8 h-8 rounded-lg bg-gold-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-gold-400" />
        </div>
        <div className="flex-1">
          <span className="text-sm text-white font-medium">AI Engine: </span>
          <span className="text-sm text-muted-foreground">Auto-scoring leads & matching properties. </span>
          <button
            onClick={() => {
              const lead = leads.find(l => l.score >= 60) || leads[0];
              if (lead) { openDetail(lead.id); setDetailTab("overview"); }
              else toast("No leads yet. Add leads with requirements to auto-match.");
            }}
            className="text-sm text-estate-400 hover:text-estate-300 underline">View matches →</button>
        </div>
        <div className="flex items-center gap-1 text-xs text-gold-400">
          <Zap className="w-3 h-3" /> Active
        </div>
      </motion.div>

      {/* Bulk Action Bar */}
      <AnimatePresence>
        {isAdmin && selected.size > 0 && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-3 rounded-xl bg-estate-900/60 border border-estate-500/30">
            <span className="text-sm text-white font-medium">{selected.size} leads selected</span>
            <div className="flex items-center gap-2 ml-auto flex-wrap">
              <button onClick={() => handleBulkMessage("whatsapp")} disabled={bulkSending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-all disabled:opacity-50">
                <MessageSquare className="w-3.5 h-3.5" /> WhatsApp All
              </button>
              <button onClick={() => handleBulkMessage("email")} disabled={bulkSending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-all disabled:opacity-50">
                <Mail className="w-3.5 h-3.5" /> Email All
              </button>
              <button onClick={() => handleBulkMessage("sms")} disabled={bulkSending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-all disabled:opacity-50">
                <Phone className="w-3.5 h-3.5" /> SMS All
              </button>
              <button onClick={handleBulkDelete} disabled={bulkSending}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-all disabled:opacity-50">
                🗑 Delete ({selected.size})
              </button>
              {bulkSending && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-white ml-1">✕ Clear</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <div key={i} className="glass-card p-5 h-52 animate-pulse bg-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card text-center py-16 text-muted-foreground">
          <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No leads found. Add your first lead!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(lead => (
            <motion.div key={lead.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`glass-card p-4 space-y-3 transition-all ${
                selected.has(lead.id) ? "ring-2 ring-estate-500/60 bg-estate-900/20" : ""
              } ${
                lead.score >= 80 ? "border-red-500/20" :
                lead.score >= 60 ? "border-orange-500/15" : ""
              }`}>

              {/* Top row */}
              <div className="flex items-start gap-3">
                {isAdmin && (
                  <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleSelect(lead.id)}
                    className="w-3.5 h-3.5 rounded accent-estate-500 cursor-pointer mt-1 flex-shrink-0" />
                )}
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-white text-lg font-bold flex-shrink-0">
                  {lead.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <span className="font-semibold text-white text-sm leading-tight truncate">{lead.name}</span>
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border flex-shrink-0 font-medium ${scoreBg(lead.score)} ${scoreColor(lead.score)}`}>
                      {scoreLabel(lead.score)}
                    </div>
                  </div>
                  <a href={`tel:${lead.phone}`} className="text-xs text-estate-400 hover:text-estate-300 mt-0.5 block">{lead.phone}</a>
                  {lead.email && <div className="text-xs text-muted-foreground truncate">{lead.email}</div>}
                </div>
              </div>

              {/* Status bar — always visible */}
              <div className="flex items-center gap-1.5 p-2 rounded-lg" style={{
                background: lead.status === "NEW" ? "rgba(59,130,246,0.12)" :
                  lead.status === "CONTACTED" ? "rgba(234,179,8,0.12)" :
                  lead.status === "SITE_VISIT_SCHEDULED" ? "rgba(168,85,247,0.12)" :
                  lead.status === "NEGOTIATION" ? "rgba(249,115,22,0.12)" :
                  lead.status === "DEAL_CLOSED" ? "rgba(16,185,129,0.12)" :
                  "rgba(239,68,68,0.12)",
                border: `1px solid ${
                  lead.status === "NEW" ? "rgba(59,130,246,0.3)" :
                  lead.status === "CONTACTED" ? "rgba(234,179,8,0.3)" :
                  lead.status === "SITE_VISIT_SCHEDULED" ? "rgba(168,85,247,0.3)" :
                  lead.status === "NEGOTIATION" ? "rgba(249,115,22,0.3)" :
                  lead.status === "DEAL_CLOSED" ? "rgba(16,185,129,0.3)" :
                  "rgba(239,68,68,0.3)"
                }`
              }}>
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{
                  background:
                    lead.status === "NEW" ? "#60a5fa" :
                    lead.status === "CONTACTED" ? "#fde047" :
                    lead.status === "SITE_VISIT_SCHEDULED" ? "#d8b4fe" :
                    lead.status === "NEGOTIATION" ? "#fdba74" :
                    lead.status === "DEAL_CLOSED" ? "#6ee7b7" :
                    "#fca5a5"
                }} />
                <span className="text-xs font-semibold flex-1" style={{
                  color:
                    lead.status === "NEW" ? "#93c5fd" :
                    lead.status === "CONTACTED" ? "#fde047" :
                    lead.status === "SITE_VISIT_SCHEDULED" ? "#d8b4fe" :
                    lead.status === "NEGOTIATION" ? "#fdba74" :
                    lead.status === "DEAL_CLOSED" ? "#6ee7b7" :
                    "#fca5a5"
                }}>
                  {statusConfig[lead.status].label}
                </span>
                <span className="text-xs" style={{ color: "#94a3b8" }}>{lead.source.replace(/_/g, " ")}</span>
                {lead.budget && (
                  <span className="text-xs font-bold" style={{ color: "#facc15" }}>{fmtBudget(lead.budget)}</span>
                )}
              </div>

              {/* Requirements */}
              {lead.requirements && (
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                  <div className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> Requirements
                  </div>
                  <p className="text-xs text-white line-clamp-2">{lead.requirements}</p>
                </div>
              )}

              {/* Last call outcome */}
              {lead.callLogs && lead.callLogs.length > 0 && (() => {
                const last = lead.callLogs[0];
                const outcomeColor =
                  last.outcome === "ANSWERED"           ? "#34d399" :
                  last.outcome === "INTERESTED"         ? "#4ade80" :
                  last.outcome === "NO_ANSWER"          ? "#f87171" :
                  last.outcome === "NOT_INTERESTED"     ? "#f87171" :
                  last.outcome === "BUSY"               ? "#fb923c" :
                  last.outcome === "CALLBACK_REQUESTED" ? "#fbbf24" : "#94a3b8";
                const outcomeLabel =
                  last.outcome === "ANSWERED"           ? "✅ Answered" :
                  last.outcome === "INTERESTED"         ? "🟢 Interested" :
                  last.outcome === "NO_ANSWER"          ? "📵 No Answer" :
                  last.outcome === "NOT_INTERESTED"     ? "❌ Not Interested" :
                  last.outcome === "BUSY"               ? "🔴 Busy" :
                  last.outcome === "CALLBACK_REQUESTED" ? "🔁 Callback" : last.outcome || "📞 Called";
                return (
                  <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <PhoneCall className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color: outcomeColor }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-semibold" style={{ color: outcomeColor }}>{outcomeLabel}</span>
                        <span className="text-xs" style={{ color: "#64748b" }}>{fmtDate(last.createdAt)}</span>
                      </div>
                      {last.notes && <p className="text-xs mt-0.5 line-clamp-1" style={{ color: "#94a3b8" }}>{last.notes}</p>}
                    </div>
                  </div>
                );
              })()}

              {/* Next follow-up task */}
              {lead.tasks && lead.tasks.length > 0 && (() => {
                const task = lead.tasks[0];
                const isOverdue = new Date(task.dueAt) < new Date();
                return (
                  <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg"
                    style={{
                      background: isOverdue ? "rgba(234,179,8,0.08)" : "rgba(255,255,255,0.04)",
                      border: isOverdue ? "1px solid rgba(234,179,8,0.25)" : "1px solid rgba(255,255,255,0.08)"
                    }}>
                    <Calendar className="w-3 h-3 flex-shrink-0" style={{ color: isOverdue ? "#fbbf24" : "#94a3b8" }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs truncate" style={{ color: isOverdue ? "#fde047" : "#e2e8f0" }}>{task.title}</p>
                      <p className="text-xs" style={{ color: isOverdue ? "#fbbf24" : "#64748b" }}>
                        {isOverdue ? "⚠️ Overdue: " : "📅 "}{fmtDate(task.dueAt)}
                      </p>
                    </div>
                    <span className="text-xs px-1.5 py-0.5 rounded flex-shrink-0" style={{
                      background: task.priority === "HIGH" ? "rgba(239,68,68,0.15)" : task.priority === "MEDIUM" ? "rgba(249,115,22,0.15)" : "rgba(255,255,255,0.08)",
                      color: task.priority === "HIGH" ? "#fca5a5" : task.priority === "MEDIUM" ? "#fdba74" : "#94a3b8"
                    }}>{task.priority}</span>
                  </div>
                );
              })()}

              {/* Assign broker — admin only inline */}
              {isAdmin && (
                <div className="relative">
                  <select
                    value={lead.assignedTo?.id || ""}
                    onChange={async e => {
                      const val = e.target.value;
                      await fetch(`/api/leads/${lead.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ assignedToId: val || null }),
                      });
                      setLeads(prev => prev.map(l => l.id === lead.id ? {
                        ...l,
                        assignedTo: val ? brokers.find((b: any) => b.id === val) : undefined,
                      } : l));
                      toast.success(val ? "Lead assigned!" : "Unassigned");
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-estate-500/50 appearance-none cursor-pointer">
                    <option value="">— Assign Employee —</option>
                    {brokers.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.name} ({b.role.replace("_"," ")})</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                </div>
              )}
              {!isAdmin && lead.assignedTo && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-full bg-estate-500/30 flex items-center justify-center text-estate-400 font-bold text-xs flex-shrink-0">
                    {lead.assignedTo.name[0]}
                  </div>
                  {lead.assignedTo.name}
                </div>
              )}

              {/* Call + WA */}
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${lead.phone}`}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                  <Phone className="w-3.5 h-3.5" /> Call Now
                </a>
                <a href={`https://wa.me/91${lead.phone.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(getWAMsg(lead))}`} target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition-all">
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>

              {/* Bottom actions */}
              <div className="grid grid-cols-3 gap-2">
                <button onClick={() => openDetail(lead.id)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                  <Eye className="w-3.5 h-3.5" /> View
                </button>
                <button onClick={() => handleCallClick(lead)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 hover:bg-blue-500/20 transition-all">
                  <PhoneCall className="w-3.5 h-3.5" /> Log Call
                </button>
                {lead.email ? (
                  <a href={`mailto:${lead.email}`}
                    className="flex items-center justify-center gap-1 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-xs text-purple-400 hover:bg-purple-500/20 transition-all">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                ) : (
                  <button onClick={() => { openDetail(lead.id); setDetailTab("followups"); }}
                    className="flex items-center justify-center gap-1 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400 hover:bg-yellow-500/20 transition-all">
                    <Calendar className="w-3.5 h-3.5" /> Follow-up
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}



      {/* Lead Detail Modal */}
      <AnimatePresence>
        {detailLead !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setDetailLead(null)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-2xl max-h-[92dvh] md:max-h-[90vh] overflow-y-auto rounded-t-2xl md:rounded-xl">
              {detailLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-estate-400 animate-spin" />
                </div>
              ) : detailLead?.id ? (
                <>
                  <div className="flex items-start justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-white text-xl font-bold flex-shrink-0">
                        {detailLead.name?.[0]}
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white">{detailLead.name}</h2>
                        <div className="flex items-center gap-3 mt-1 flex-wrap">
                          <a href={`tel:${detailLead.phone}`} className="flex items-center gap-1 text-sm text-estate-400 hover:text-estate-300">
                            <Phone className="w-3.5 h-3.5" /> {detailLead.phone}
                          </a>
                          {detailLead.email && (
                            <a href={`mailto:${detailLead.email}`} className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300">
                              <Mail className="w-3.5 h-3.5" /> {detailLead.email}
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setDetailLead(null)} className="text-muted-foreground hover:text-white p-1 flex-shrink-0">
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6">
                    <div className="flex flex-wrap gap-2 mb-5">
                      {[
                        { id: "overview", label: "Overview" },
                        { id: "calls", label: "Calls" },
                        { id: "followups", label: "Follow-ups" },
                        { id: "notes", label: "Notes" },
                      ].map(tab => (
                        <button key={tab.id} onClick={() => setDetailTab(tab.id as any)}
                          className={`px-3 py-2 rounded-full text-xs font-medium transition-all ${detailTab === tab.id ? "bg-estate-500 text-white" : "bg-white/5 text-muted-foreground hover:bg-white/10"}`}>
                          {tab.label}
                        </button>
                      ))}
                    </div>

                    {detailTab === "overview" && (
                      <div className="space-y-5">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                            <div className="relative">
                              <select value={detailLead.status}
                                onChange={e => updateLead(detailLead.id, { status: e.target.value })}
                                disabled={updatingLead || !isAdmin}
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50 appearance-none cursor-pointer disabled:opacity-60">
                                {Object.entries(statusConfig).map(([k, v]) => (
                                  <option key={k} value={k}>{v.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                            </div>
                          </div>
                          {isAdmin && (
                            <div>
                              <label className="text-xs text-muted-foreground mb-1.5 block">Assign Broker</label>
                              <div className="relative">
                                <select value={detailLead.assignedToId || ""}
                                  onChange={e => updateLead(detailLead.id, { assignedToId: e.target.value || null })}
                                  disabled={updatingLead}
                                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50 appearance-none cursor-pointer">
                                  <option value="">Unassigned</option>
                                  {brokers.map((b: any) => (
                                    <option key={b.id} value={b.id}>{b.name}</option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { label: "AI Score",    value: <span className={`font-bold ${scoreColor(detailLead.score)}`}>{scoreLabel(detailLead.score)} {detailLead.score}</span> },
                            { label: "Budget",      value: fmtBudget(detailLead.budget) },
                            { label: "Source",      value: detailLead.source?.replace(/_/g, " ") },
                            { label: "Property",    value: detailLead.propertyType?.replace(/_/g, " ") || "—" },
                            { label: "Transaction", value: detailLead.transactionType || "—" },
                            { label: "Added",       value: fmtDate(detailLead.createdAt) },
                          ].map(item => (
                            <div key={item.label} className="p-3 rounded-lg bg-white/5">
                              <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                              <div className="text-sm text-white font-medium">{item.value}</div>
                            </div>
                          ))}
                        </div>

                        {detailLead.requirements && (
                          <div className="p-3 rounded-lg bg-white/5">
                            <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" /> Requirements</div>
                            <p className="text-sm text-white">{detailLead.requirements}</p>
                          </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                          <button type="button" onClick={() => updateLead(detailLead.id, { status: "NEGOTIATION" })}
                            className="flex-1 py-2 rounded-lg bg-orange-500/15 border border-orange-500/20 text-sm text-orange-200 hover:bg-orange-500/25 transition-all">
                            Move to Negotiation
                          </button>
                          <button type="button" onClick={() => window.location.href = `/visits?leadId=${detailLead.id}`}
                            className="flex-1 py-2 rounded-lg bg-purple-500/15 border border-purple-500/20 text-sm text-purple-200 hover:bg-purple-500/25 transition-all">
                            Schedule Site Visit
                          </button>
                        </div>

                        <div>
                          <label className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1 block">
                            <Calendar className="w-3 h-3" /> Next Follow-up
                          </label>
                          <input type="datetime-local"
                            defaultValue={detailLead.nextFollowUpAt ? new Date(detailLead.nextFollowUpAt).toISOString().slice(0,16) : ""}
                            onBlur={e => e.target.value && updateLead(detailLead.id, { nextFollowUpAt: new Date(e.target.value).toISOString() })}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50" />
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-xs flex items-center gap-1">
                              <Zap className="w-3 h-3 text-gold-400" />
                              <span className="text-gold-400 font-medium">Matched Properties ({detailLead.matchedProperties?.length ?? 0})</span>
                            </div>
                            <button
                              onClick={async () => {
                                const tid = toast.loading("Matching properties...");
                                try {
                                  await fetch(`/api/leads/${detailLead.id}/rematch`, { method: "POST" });
                                  const updated = await fetch(`/api/leads/${detailLead.id}`).then(r => r.json());
                                  setDetailLead(updated);
                                  toast.success(`${updated.matchedProperties?.length ?? 0} properties matched!`, { id: tid });
                                } catch { toast.error("Match failed", { id: tid }); }
                              }}
                              className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gold-500/15 border border-gold-500/25 text-gold-400 hover:bg-gold-500/25 transition-all">
                              <RefreshCw className="w-3 h-3" /> Re-run
                            </button>
                          </div>
                          {detailLead.matchedProperties?.length > 0 ? (
                            <div className="space-y-2">
                              {detailLead.matchedProperties.map((m: any) => (
                                <button key={m.id} onClick={() => openProperty(m.property?.id)}
                                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all hover:scale-[1.01]"
                                  style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}>
                                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0"
                                    style={{ background: "rgba(234,179,8,0.12)" }}>
                                    {m.property?.type === "OFFICE" ? "🏢" : m.property?.type === "VILLA" ? "🏡" :
                                     m.property?.type === "APARTMENT" ? "🏠" : m.property?.type === "SHOP" ? "🛍️" :
                                     m.property?.type === "SHOWROOM" ? "🎨" : m.property?.type === "WAREHOUSE" ? "📦" : "🏗️"}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="text-sm font-medium text-white truncate">{m.property?.title}</div>
                                    <div className="text-xs" style={{ color: "#94a3b8" }}>
                                      📍 {m.property?.locality} · {fmtBudget(m.property?.price)}
                                    </div>
                                  </div>
                                  <div className="flex-shrink-0 text-xs font-bold px-2 py-1 rounded-full"
                                    style={{
                                      background: m.score >= 80 ? "rgba(16,185,129,0.2)" : m.score >= 60 ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.08)",
                                      color: m.score >= 80 ? "#6ee7b7" : m.score >= 60 ? "#fde047" : "#94a3b8"
                                    }}>
                                    {m.score}% ↗
                                  </div>
                                </button>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground py-2">No matches yet. Click Re-run to find properties.</p>
                          )}
                        </div>

                        {detailLead.activities?.length > 0 && (
                          <div>
                            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                              <TrendingUp className="w-3 h-3" /> Activity
                            </div>
                            <div className="space-y-2 max-h-36 overflow-y-auto">
                              {detailLead.activities.map((a: any) => (
                                <div key={a.id} className="flex items-start gap-2 text-xs">
                                  <div className="w-1.5 h-1.5 rounded-full bg-estate-400 mt-1.5 flex-shrink-0" />
                                  <span className="text-white">{a.description}</span>
                                  <span className="text-muted-foreground ml-auto flex-shrink-0">{fmtDate(a.createdAt)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex gap-2 pt-1">
                          <a href={`https://wa.me/91${detailLead.phone?.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(getWAMsg(detailLead))}`} target="_blank" rel="noreferrer"
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all">
                            <MessageSquare className="w-4 h-4" /> WhatsApp
                          </a>
                          <a href={`tel:${detailLead.phone}`}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all">
                            <Phone className="w-4 h-4" /> Call
                          </a>
                          {detailLead.email && (
                            <a href={`mailto:${detailLead.email}`}
                              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all">
                              <Mail className="w-4 h-4" /> Email
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {detailTab === "calls" && (
                      <div className="space-y-5">
                        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <div className="text-xs text-muted-foreground">Call timer</div>
                                <div className="text-3xl font-semibold text-white mt-2">{fmtDuration(callSeconds)}</div>
                                <div className="text-xs text-muted-foreground mt-1">{callActive ? "Call in progress" : "Ready to log a call"}</div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <button type="button" onClick={() => {
                                  if (!callActive) {
                                    setCallActive(true);
                                    setCallSeconds(0);
                                    clearInterval(timerRef.current);
                                    timerRef.current = setInterval(() => setCallSeconds(s => s + 1), 1000);
                                  }
                                }}
                                  className="px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-xs text-blue-300 hover:bg-blue-500/30 transition-all">
                                  {callActive ? "Running" : "Start call"}
                                </button>
                                <button type="button" disabled={!callActive} onClick={stopCallTimer}
                                  className="px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-xs text-emerald-300 hover:bg-emerald-500/30 transition-all disabled:opacity-50">
                                  Stop & Log
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-2">
                              <button type="button" onClick={() => window.open(`tel:${detailLead.phone}`)}
                                className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10 transition-all">
                                Dial now
                              </button>
                              <button type="button" onClick={() => setShowCallModal(true)}
                                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-muted-foreground hover:text-white hover:bg-white/10 transition-all">
                                Log manual call
                              </button>
                            </div>
                          </div>
                          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                            <div className="text-xs text-muted-foreground mb-3">Lead call summary</div>
                            <div className="space-y-2 text-sm text-white">
                              <div>Last contacted: {detailLead.lastContactedAt ? fmtDate(detailLead.lastContactedAt) : "Never"}</div>
                              <div>Next follow-up: {detailLead.nextFollowUpAt ? fmtDate(detailLead.nextFollowUpAt) : "Not scheduled"}</div>
                              <div>Call logs: {callLogs.length}</div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <p className="text-sm font-medium text-white">Call history</p>
                              <p className="text-xs text-muted-foreground">Logged calls for this lead</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{callLogs.length} records</span>
                          </div>
                          {callLogsLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 text-estate-400 animate-spin" />
                            </div>
                          ) : callLogs.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-10">No calls logged yet. Use the timer or manual log to record your next call.</div>
                          ) : (
                            <div className="space-y-3">
                              {callLogs.map(log => (
                                <div key={log.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                                  <div className="flex items-start gap-3">
                                    <div className="flex-none text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                      {OUTCOME_CONFIG[log.outcome]?.label || log.type || "Call"}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-medium text-white">{log.user?.name || "You"}</span>
                                        <span className="text-xs text-muted-foreground">{fmtDate(log.createdAt)}</span>
                                        <span className="text-xs text-muted-foreground">{fmtDuration(log.duration)}</span>
                                      </div>
                                      {log.notes && <p className="mt-2 text-sm text-muted-foreground">{log.notes}</p>}
                                      {log.recordingUrl && (
                                        <a href={log.recordingUrl} target="_blank" rel="noreferrer" className="text-xs text-blue-400 hover:text-blue-300">
                                          View recording
                                        </a>
                                      )}
                                      {log.followUpAt && <div className="mt-2 text-xs text-yellow-300">Follow-up: {fmtDate(log.followUpAt)}</div>}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {detailTab === "followups" && (
                      <div className="space-y-5">
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm font-medium text-white">Follow-up tasks</p>
                              <p className="text-xs text-muted-foreground">Manage reminders for this lead</p>
                            </div>
                            <span className="text-xs text-muted-foreground">{tasks.length} tasks</span>
                          </div>
                          {tasksLoading ? (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-6 h-6 text-estate-400 animate-spin" />
                            </div>
                          ) : tasks.length === 0 ? (
                            <div className="text-sm text-muted-foreground text-center py-10">No follow-ups yet. Schedule one below.</div>
                          ) : (
                            <div className="space-y-3">
                              {tasks.map(task => (
                                <div key={task.id} className="rounded-xl bg-white/5 border border-white/10 p-3">
                                  <div className="flex items-start gap-3">
                                    <input type="checkbox" checked={task.isCompleted}
                                      onChange={() => toggleTaskCompletion(task)}
                                      className="mt-1 h-4 w-4 rounded border-white/10 accent-estate-500" />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div>
                                          <p className={`text-sm font-semibold ${task.isCompleted ? "text-green-300" : "text-white"}`}>{task.title}</p>
                                          {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
                                        </div>
                                        <span className="text-xs rounded-full border border-white/10 px-2 py-1 text-muted-foreground">{task.priority}</span>
                                      </div>
                                      <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                        <span>Due {fmtDate(task.dueAt)}</span>
                                        <span>{task.assignedTo?.name ? `Assigned to ${task.assignedTo.name}` : "Unassigned"}</span>
                                        {task.isCompleted && <span>Completed</span>}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                          <div className="text-sm font-medium text-white mb-3">Schedule a follow-up task</div>
                          <form onSubmit={saveTask} className="grid gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground mb-1.5 block">Title</label>
                              <input required value={taskForm.title}
                                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                                className={inputCls} placeholder="Call lead to confirm requirement" />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1.5 block">Due date</label>
                              <input required value={taskForm.dueAt}
                                onChange={e => setTaskForm(f => ({ ...f, dueAt: e.target.value }))}
                                type="datetime-local" className={inputCls} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="text-xs text-muted-foreground mb-1.5 block">Priority</label>
                                <select value={taskForm.priority}
                                  onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))}
                                  className={inputCls}>
                                  <option value="HIGH">High</option>
                                  <option value="MEDIUM">Medium</option>
                                  <option value="LOW">Low</option>
                                </select>
                              </div>
                              <div></div>
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground mb-1.5 block">Notes</label>
                              <textarea rows={3} value={taskForm.description}
                                onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                                className={`${inputCls} resize-none`} placeholder="Add details or client context" />
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                              <button type="submit" disabled={savingTask}
                                className="rounded-lg bg-estate-500/20 border border-estate-500/30 px-4 py-2 text-sm text-white hover:bg-estate-500/30 transition-all disabled:opacity-50">
                                {savingTask ? <Loader2 className="w-4 h-4 animate-spin" /> : "Schedule follow-up"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}

                    {detailTab === "notes" && (
                      <div className="space-y-5">
                        <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                          <label className="text-xs text-muted-foreground mb-1.5 block">Lead notes</label>
                          <textarea rows={8} value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            className={`${inputCls} resize-none`} placeholder="Write call notes, client context, or follow-up details" />
                        </div>
                        <div className="flex justify-end gap-3">
                          <button type="button" onClick={() => setNoteText(detailLead.notes || "")}
                            className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm text-muted-foreground hover:text-white transition-all">
                            Reset
                          </button>
                          <button type="button" onClick={saveNote} disabled={savingNote}
                            className="rounded-lg bg-estate-500/20 border border-estate-500/30 px-4 py-2 text-sm text-white hover:bg-estate-500/30 transition-all disabled:opacity-50">
                            {savingNote ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save note"}
                          </button>
                        </div>
                        {detailLead.notes && (
                          <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                            <div className="text-xs text-muted-foreground mb-2">Saved note</div>
                            <p className="text-sm text-white whitespace-pre-wrap">{detailLead.notes}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Log Call Modal */}
      <AnimatePresence>
        {showCallModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setShowCallModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-md p-5 md:p-6 rounded-t-2xl md:rounded-xl max-h-[90dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">Log Call</h2>
                  <p className="text-xs text-muted-foreground">Save call duration, outcome, recording and follow-up date.</p>
                </div>
                <button onClick={() => setShowCallModal(false)} className="text-muted-foreground hover:text-white">✕</button>
              </div>
              <div className="space-y-4">
                <div className="grid gap-3">
                  <label className="text-xs text-muted-foreground">Outcome</label>
                  <select value={callForm.outcome} onChange={e => setCallForm(f => ({ ...f, outcome: e.target.value }))} className={inputCls}>
                    {Object.entries(OUTCOME_CONFIG).map(([key, value]) => (
                      <option key={key} value={key}>{value.label}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-3">
                  <label className="text-xs text-muted-foreground">Duration (seconds)</label>
                  <input type="number" min="0" step="1" value={callForm.duration}
                    onChange={e => setCallForm(f => ({ ...f, duration: e.target.value }))}
                    className={inputCls} placeholder="0" />
                </div>
                <div className="grid gap-3">
                  <label className="text-xs text-muted-foreground">Recording URL</label>
                  <input value={callForm.recordingUrl} onChange={e => setCallForm(f => ({ ...f, recordingUrl: e.target.value }))}
                    className={inputCls} placeholder="Paste recording link" />
                </div>
                <div className="grid gap-3">
                  <label className="text-xs text-muted-foreground">Follow-up date</label>
                  <input type="datetime-local" value={callForm.followUpAt}
                    onChange={e => setCallForm(f => ({ ...f, followUpAt: e.target.value }))}
                    className={inputCls} />
                </div>
                <div className="grid gap-3">
                  <label className="text-xs text-muted-foreground">Notes</label>
                  <textarea rows={4} value={callForm.notes}
                    onChange={e => setCallForm(f => ({ ...f, notes: e.target.value }))}
                    className={`${inputCls} resize-none`} placeholder="Conversation summary, next steps, client preference" />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setShowCallModal(false)} className="rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="button" onClick={saveCallLog} disabled={savingCall}
                    className="rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-2 text-sm text-white hover:bg-emerald-500/30 transition-all disabled:opacity-50">
                    {savingCall ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save call"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Lead Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-lg p-5 md:p-6 rounded-t-2xl md:rounded-xl max-h-[92dvh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Add New Lead</h2>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white">✕</button>
              </div>
              <form onSubmit={handleAddLead} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Full Name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                      className={inputCls} placeholder="Rajesh Patel" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Phone *</label>
                    <input required value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                      className={inputCls} placeholder="9876543210" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    className={inputCls} placeholder="rajesh@email.com" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Source</label>
                    <select value={form.source} onChange={e => setForm(f => ({...f, source: e.target.value}))} className={inputCls}>
                      <option value="WEBSITE">CityRealSpace Website</option>
                      <option value="WHATSAPP">WhatsApp</option>
                      <option value="FACEBOOK">Facebook</option>
                      <option value="GOOGLE_BUSINESS">Google Business</option>
                      <option value="ACRES99">99acres</option>
                      <option value="MAGICBRICKS">Magicbricks</option>
                      <option value="HOUSING">Housing.com</option>
                      <option value="REFERRAL">Referral</option>
                      <option value="WALK_IN">Walk-in</option>
                      <option value="COLD_CALL">Cold Call</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Budget (₹)</label>
                    <input type="number" value={form.budget} onChange={e => setForm(f => ({...f, budget: e.target.value}))}
                      className={inputCls} placeholder="5000000" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Property Type</label>
                    <select value={form.propertyType} onChange={e => setForm(f => ({...f, propertyType: e.target.value}))} className={inputCls}>
                      <option value="">Select type</option>
                      <option value="OFFICE">Office</option>
                      <option value="SHOP">Shop</option>
                      <option value="SHOWROOM">Showroom</option>
                      <option value="WAREHOUSE">Warehouse</option>
                      <option value="APARTMENT">Apartment</option>
                      <option value="VILLA">Villa</option>
                      <option value="PLOT">Plot</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Transaction</label>
                    <select value={form.transactionType} onChange={e => setForm(f => ({...f, transactionType: e.target.value}))} className={inputCls}>
                      <option value="BUY">Buy</option>
                      <option value="RENT">Rent</option>
                      <option value="LEASE">Lease</option>
                      <option value="SELL">Sell</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Requirements</label>
                  <textarea rows={3} value={form.requirements} onChange={e => setForm(f => ({...f, requirements: e.target.value}))}
                    className={`${inputCls} resize-none`}
                    placeholder="Office space 2000sqft in Prahlad Nagar under ₹80K/month..." />
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-gold-500/10 border border-gold-500/20">
                  <Bot className="w-4 h-4 text-gold-400 flex-shrink-0" />
                  <span className="text-xs text-gold-400">AI will auto-score this lead and find matching properties</span>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Bot className="w-4 h-4" /> Add Lead + AI Score</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Property Detail Modal */}
      <AnimatePresence>
        {propModal !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setPropModal(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto">
              {propLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
                </div>
              ) : propModal?.id ? (
                <>
                  {/* Header */}
                  <div className="p-5 border-b border-white/10">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                          style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.2)" }}>
                          {propModal.type === "OFFICE" ? "🏢" : propModal.type === "VILLA" ? "🏡" :
                           propModal.type === "APARTMENT" ? "🏠" : propModal.type === "SHOP" ? "🛍️" :
                           propModal.type === "SHOWROOM" ? "🎨" : propModal.type === "WAREHOUSE" ? "📦" : "🏗️"}
                        </div>
                        <div>
                          <h2 className="text-lg font-bold text-white leading-tight">{propModal.title}</h2>
                          <p className="text-xs mt-0.5" style={{ color: "#94a3b8" }}>
                            📍 {propModal.locality}{propModal.city ? `, ${propModal.city}` : ""}
                          </p>
                        </div>
                      </div>
                      <button onClick={() => setPropModal(null)} className="text-muted-foreground hover:text-white flex-shrink-0">
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Price + Key stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1 p-3 rounded-xl text-center" style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)" }}>
                        <div className="text-lg font-bold" style={{ color: "#fde047" }}>{fmtBudget(propModal.price)}</div>
                        <div className="text-xs" style={{ color: "#94a3b8" }}>
                          {propModal.transactionType === "RENT" || propModal.transactionType === "LEASE" ? "/month" : "Price"}
                        </div>
                      </div>
                      {propModal.area && (
                        <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <div className="text-lg font-bold text-white">{propModal.area}</div>
                          <div className="text-xs" style={{ color: "#94a3b8" }}>sq.ft</div>
                        </div>
                      )}
                      {propModal.floor != null && (
                        <div className="p-3 rounded-xl text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
                          <div className="text-lg font-bold text-white">{propModal.floor}{propModal.totalFloors ? `/${propModal.totalFloors}` : ""}</div>
                          <div className="text-xs" style={{ color: "#94a3b8" }}>Floor</div>
                        </div>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", color: "#d8b4fe" }}>
                        {propModal.type}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", color: "#93c5fd" }}>
                        {propModal.transactionType}
                      </span>
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{
                        background: propModal.status === "AVAILABLE" ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                        border: propModal.status === "AVAILABLE" ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(239,68,68,0.3)",
                        color: propModal.status === "AVAILABLE" ? "#6ee7b7" : "#fca5a5"
                      }}>
                        {propModal.status?.replace(/_/g, " ")}
                      </span>
                      {propModal.residential?.furnishing && (
                        <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                          🛋️ {propModal.residential.furnishing.replace(/_/g, " ")}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    {propModal.description && (
                      <p className="text-sm" style={{ color: "#cbd5e1" }}>{propModal.description}</p>
                    )}

                    {/* Amenities */}
                    {propModal.amenities?.length > 0 && (
                      <div>
                        <div className="text-xs mb-2" style={{ color: "#64748b" }}>Amenities</div>
                        <div className="flex flex-wrap gap-1.5">
                          {propModal.amenities.map((a: string) => (
                            <span key={a} className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                              {a}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Owner contact */}
                    {(propModal.ownerName || propModal.ownerPhone) && (
                      <div className="p-3 rounded-xl space-y-2" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div className="text-xs font-semibold" style={{ color: "#94a3b8" }}>Owner</div>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            {propModal.ownerName && <div className="text-sm font-semibold text-white">{propModal.ownerName}</div>}
                            {propModal.ownerPhone && <div className="text-xs" style={{ color: "#94a3b8" }}>{propModal.ownerPhone}</div>}
                          </div>
                          {propModal.ownerPhone && (
                            <div className="flex gap-2">
                              <a href={`tel:${propModal.ownerPhone}`}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>
                                <Phone className="w-3 h-3" /> Call
                              </a>
                              <a href={`https://wa.me/91${propModal.ownerPhone.replace(/\D/g,"").slice(-10)}`}
                                target="_blank" rel="noreferrer"
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                                style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
                                <MessageSquare className="w-3 h-3" /> WA
                              </a>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Listed by */}
                    {propModal.listedBy && (
                      <div className="text-xs flex items-center gap-1.5" style={{ color: "#64748b" }}>
                        <div className="w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold"
                          style={{ background: "rgba(14,165,233,0.2)", color: "#7dd3fc" }}>
                          {propModal.listedBy.name?.[0]}
                        </div>
                        Listed by {propModal.listedBy.name}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <button onClick={() => { setPropModal(null); }}
                        className="py-2.5 rounded-xl text-sm font-medium transition-all"
                        style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                        Close
                      </button>
                      <button onClick={() => {
                        if (detailLead?.id && propModal?.id) {
                          window.location.href = `/visits?leadId=${detailLead.id}&propertyId=${propModal.id}`;
                        }
                      }}
                        className="py-2.5 rounded-xl text-sm font-semibold transition-all"
                        style={{ background: "rgba(168,85,247,0.2)", border: "1px solid rgba(168,85,247,0.35)", color: "#d8b4fe" }}>
                        📅 Schedule Visit
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
