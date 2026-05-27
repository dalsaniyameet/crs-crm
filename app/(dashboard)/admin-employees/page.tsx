"use client";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import {
  Plus, Trash2, Loader2, Upload, X, Eye,
  CheckCircle2, XCircle, AlertCircle, CalendarDays,
  Clock, FileText, Bell, ChevronDown, ChevronUp,
  Users, TrendingUp, Shield, Mail, ClipboardList, Phone, Building2,
} from "lucide-react";

type Employee = {
  id: string; name: string; email: string; dob: string;
  position: string; role: string; avatarUrl: string | null; isActive: boolean;
};

type Activity = {
  type: "leave" | "document" | "attendance";
  label: string;
  time: string;
  status?: string;
};

const ROLES = ["BROKER", "SALES_MANAGER", "MARKETING", "ADMIN"];
const ROLE_COLORS: Record<string, string> = {
  ADMIN:         "bg-red-500/20 text-red-400 border-red-500/30",
  BROKER:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SALES_MANAGER: "bg-green-500/20 text-green-400 border-green-500/30",
  MARKETING:     "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

const EMPTY = { name: "", email: "", dob: "", position: "", role: "BROKER", avatarUrl: "", password: "" };

function generatePassword(name: string) {
  const clean = name.trim().split(" ")[0].toLowerCase().replace(/[^a-z]/g, "") || "emp";
  const upper = clean[0].toUpperCase() + clean.slice(1);
  const specials = ["@", "#", "$", "!"];
  const sp = specials[Math.floor(Math.random() * specials.length)];
  return `${upper}${Math.floor(100 + Math.random() * 900)}${sp}${Math.floor(10 + Math.random() * 90)}`;
}

function EmployeeCard({
  emp, onView, onDelete, deleting,
  leaves, documents, attendance,
}: {
  emp: Employee;
  onView: () => void;
  onDelete: () => void;
  deleting: boolean;
  leaves: any[];
  documents: any[];
  attendance: any[];
}) {
  const [expanded, setExpanded] = useState(false);

  const empLeaves = leaves.filter(l => l.employeeId === emp.id);
  const empDocs   = documents.filter(d => d.employeeId === emp.id);
  const empAtt    = attendance.filter(a => a.phone === emp.email);
  const uniqueDays = new Set(empAtt.map(a => new Date(a.punchIn).toDateString())).size;

  const pendingLeaves = empLeaves.filter(l => l.status === "PENDING").length;
  const pendingDocs   = empDocs.filter(d => d.status === "PENDING" && d.uploadedBy === "EMPLOYEE").length;
  const totalAlerts   = pendingLeaves + pendingDocs;

  // For activity: show only the latest punch per day
  const latestPerDay = Object.values(
    empAtt.reduce((acc: Record<string, any>, a) => {
      const day = new Date(a.punchIn).toDateString();
      if (!acc[day] || new Date(a.punchIn) > new Date(acc[day].punchIn)) acc[day] = a;
      return acc;
    }, {})
  );

  const activities: Activity[] = [
    ...empLeaves.slice(0, 3).map(l => ({
      type: "leave" as const,
      label: `Applied ${l.type.replace(/_/g, " ")} leave (${l.days}d)`,
      time: l.createdAt, status: l.status,
    })),
    ...empDocs.slice(0, 3).map(d => ({
      type: "document" as const,
      label: `Uploaded ${d.name}`,
      time: d.createdAt, status: d.status,
    })),
    ...latestPerDay.slice(0, 2).map(a => ({
      type: "attendance" as const,
      label: `Punched in${a.punchOut ? ` · ${(a.workHours || 0).toFixed(1)}h worked` : " (in office)"}`,
      time: a.punchIn, status: a.approved ? "APPROVED" : "PENDING",
    })),
  ].sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 5);

  const statusDot: Record<string, string> = {
    PENDING: "bg-yellow-400", APPROVED: "bg-emerald-400", REJECTED: "bg-red-400",
  };

  return (
    <div className={`glass-card overflow-hidden transition-all ${totalAlerts > 0 ? "border-yellow-500/20" : "border-white/10"}`}>
      <div className="p-4 flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <div className="relative w-12 h-12 rounded-full overflow-hidden bg-white/10 border-2 border-white/10">
            {emp.avatarUrl ? (
              <Image src={emp.avatarUrl} alt={emp.name} fill className="object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-white bg-gradient-to-br from-estate-600 to-estate-400">
                {emp.name[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${emp.isActive ? "bg-emerald-400" : "bg-gray-500"}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{emp.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLORS[emp.role] ?? "bg-white/10 text-white border-white/20"}`}>
              {emp.role}
            </span>
            {totalAlerts > 0 && (
              <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">
                <Bell className="w-3 h-3" /> {totalAlerts} pending
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{emp.position} · {emp.email}</div>
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={onView}
            className="p-1.5 rounded-lg hover:bg-estate-500/10 text-muted-foreground hover:text-estate-400 transition-colors" title="Full Details">
            <Eye className="w-4 h-4" />
          </button>
          <button onClick={() => setExpanded(v => !v)}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button onClick={onDelete} disabled={deleting}
            className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-50">
            {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="px-4 pb-3 grid grid-cols-4 gap-2">
        {[
          { icon: <Clock className="w-3.5 h-3.5" />,       label: "Days",    value: uniqueDays,       color: "text-blue-400" },
          { icon: <CalendarDays className="w-3.5 h-3.5" />, label: "Leaves",  value: empLeaves.length, color: "text-purple-400" },
          { icon: <FileText className="w-3.5 h-3.5" />,     label: "Docs",    value: empDocs.length,   color: "text-estate-400" },
          { icon: <Bell className="w-3.5 h-3.5" />,         label: "Pending", value: totalAlerts,      color: totalAlerts > 0 ? "text-yellow-400" : "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5">
            <div className={`flex-shrink-0 ${s.color}`}>{s.icon}</div>
            <div className="min-w-0">
              <div className={`text-sm font-bold leading-none ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5 truncate">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {expanded && (
        <div className="border-t border-white/10 px-4 py-3 space-y-3">
          {pendingLeaves > 0 && (
            <div className="p-2.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <span className="text-xs text-yellow-400">{pendingLeaves} leave request{pendingLeaves > 1 ? "s" : ""} waiting for approval</span>
              <button onClick={onView} className="ml-auto text-xs text-yellow-400 underline">Review →</button>
            </div>
          )}
          {pendingDocs > 0 && (
            <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <span className="text-xs text-blue-400">{pendingDocs} document{pendingDocs > 1 ? "s" : ""} waiting for approval</span>
              <button onClick={onView} className="ml-auto text-xs text-blue-400 underline">Review →</button>
            </div>
          )}
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">Recent Activity</p>
            {activities.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-3">No activity yet</p>
            ) : (
              <div className="space-y-2">
                {activities.map((a, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${statusDot[a.status || ""] || "bg-white/30"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white">{a.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(a.time).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {a.status && (
                      <span className={`text-xs px-1.5 py-0.5 rounded flex-shrink-0 ${
                        a.status === "APPROVED" ? "text-emerald-400 bg-emerald-500/10" :
                        a.status === "REJECTED" ? "text-red-400 bg-red-500/10" :
                        "text-yellow-400 bg-yellow-500/10"
                      }`}>{a.status}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <button onClick={onView}
            className="w-full py-2 rounded-lg bg-estate-500/10 border border-estate-500/20 text-estate-400 text-xs font-medium hover:bg-estate-500/20 transition-all">
            View Full Profile & Manage →
          </button>
        </div>
      )}
    </div>
  );
}

export default function AdminEmployeesPage() {
  const { user, isLoaded } = useUser();
  const router  = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [employees, setEmployees]   = useState<Employee[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState(EMPTY);
  const [saving, setSaving]         = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [leaves, setLeaves]         = useState<any[]>([]);
  const [documents, setDocuments]   = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);
  const [todayReports, setTodayReports] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(true);

  const myRole = (user?.publicMetadata?.role as string | undefined)?.toUpperCase();
  useEffect(() => {
    if (isLoaded && user && myRole !== "ADMIN") router.replace("/dashboard");
  }, [isLoaded, user, myRole, router]);

  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    Promise.all([
      fetch("/api/admin/employees").then(r => r.json()),
      fetch("/api/leaves").then(r => r.json()),
      fetch("/api/employee/documents?all=true").then(r => r.json()),
      fetch(`/api/attendance/guest?date=all`).then(r => r.json()),
      fetch(`/api/daily-reports?date=${today}&limit=50`).then(r => r.json()),
    ]).then(([emps, leavs, docs, att, reports]) => {
      setEmployees(Array.isArray(emps) ? emps : []);
      setLeaves(Array.isArray(leavs) ? leavs : []);
      setDocuments(Array.isArray(docs) ? docs : []);
      setAttendance(Array.isArray(att) ? att : []);
      setTodayReports(Array.isArray(reports) ? reports : []);
      setLoading(false);
      setReportsLoading(false);
    }).catch(() => { setLoading(false); setReportsLoading(false); });
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      Promise.all([
        fetch("/api/leaves").then(r => r.json()),
        fetch("/api/employee/documents?all=true").then(r => r.json()),
      ]).then(([leavs, docs]) => {
        setLeaves(Array.isArray(leavs) ? leavs : []);
        setDocuments(Array.isArray(docs) ? docs : []);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.position.trim()) { toast.error("Name, email and position required"); return; }
    if (!form.password.trim() || form.password.trim().length < 8) { toast.error("Password min 8 characters"); return; }
    if (form.dob && isNaN(new Date(form.dob).getTime())) { toast.error("Invalid date of birth"); return; }
    setSaving(true);
    const res  = await fetch("/api/admin/employees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, dob: form.dob || "2000-01-01" }),
    });
    const data = await res.json().catch(() => ({ error: "Server error" }));
    if (res.ok) {
      setEmployees(prev => [data, ...prev]);
      setForm(EMPTY); setShowForm(false);
      toast.success(`${data.name} added! ✅`);
    } else toast.error(data.error || "Failed");
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name}? They will lose CRM access.`)) return;
    setDeleting(id);
    const res = await fetch("/api/admin/employees", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) { setEmployees(prev => prev.filter(e => e.id !== id)); toast.success(`${name} removed`); }
    else toast.error("Failed to remove");
    setDeleting(null);
  }

  async function handleLeaveAction(leaveId: string, status: "APPROVED" | "REJECTED") {
    setProcessing(leaveId);
    const res  = await fetch(`/api/leaves/${leaveId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const data = await res.json();
    if (res.ok) {
      setLeaves(prev => prev.map(l => l.id === leaveId ? { ...l, status } : l));
      toast.success(status === "APPROVED" ? "Leave approved ✅" : "Leave rejected ❌");
    } else toast.error(data.error || "Failed");
    setProcessing(null);
  }

  const pendingLeaves = leaves.filter(l => l.status === "PENDING");
  const pendingDocs   = documents.filter(d => d.status === "PENDING" && d.uploadedBy === "EMPLOYEE");
  const totalPending  = pendingLeaves.length + pendingDocs.length;

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-64">
      <Loader2 className="w-8 h-8 animate-spin text-estate-400" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {employees.filter(e => e.isActive).length} active employees
            {totalPending > 0 && <span className="ml-2 text-yellow-400">· {totalPending} pending actions</span>}
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="btn-primary flex items-center gap-2 text-sm px-4 py-2">
          <Plus className="w-4 h-4" /> Add Employee
        </button>
      </div>

      {/* Pending Alerts */}
      {totalPending > 0 && (
        <div className="glass-card p-4 border border-yellow-500/20 space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-semibold text-white">Pending Actions</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 border border-yellow-500/30 text-yellow-400">{totalPending}</span>
          </div>
          {pendingLeaves.map(l => (
            <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-yellow-500/10">
              <CalendarDays className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-white">{l.employee?.name}</span>
                  <span className="text-xs text-muted-foreground">{l.type.replace(/_/g, " ")} · {l.days}d</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(l.fromDate).toLocaleDateString("en-IN")} → {new Date(l.toDate).toLocaleDateString("en-IN")} · {l.reason}
                </p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={() => handleLeaveAction(l.id, "APPROVED")} disabled={processing === l.id}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-50">
                  {processing === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />} Approve
                </button>
                <button onClick={() => handleLeaveAction(l.id, "REJECTED")} disabled={processing === l.id}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 disabled:opacity-50">
                  {processing === l.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Reject
                </button>
              </div>
            </div>
          ))}
          {pendingDocs.map(d => (
            <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-blue-500/10">
              <FileText className="w-4 h-4 text-blue-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-white">{d.name}</span>
                <p className="text-xs text-muted-foreground">{d.type.replace(/_/g, " ")} · uploaded by employee</p>
              </div>
              <button onClick={() => router.push(`/admin-employees/${d.employeeId}`)}
                className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30 flex-shrink-0">
                Review →
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add Employee Form */}
      {showForm && (
        <div className="glass-card p-6 border border-estate-500/20">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-white">New Employee</h2>
            <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleAdd} className="space-y-4" autoComplete="off" noValidate>
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white/10 border border-white/10 flex-shrink-0">
                {form.avatarUrl ? (
                  <Image src={form.avatarUrl} alt="avatar" fill className="object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                  </div>
                )}
              </div>
              <div>
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="text-xs text-estate-400 border border-estate-500/30 rounded-lg px-3 py-1.5 hover:bg-estate-500/10 transition-colors">
                  {uploading ? "Uploading..." : "Upload Photo"}
                </button>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={async e => {
                  const file = e.target.files?.[0]; if (!file) return;
                  setUploading(true);
                  try {
                    const fd = new FormData();
                    fd.append("file", file);
                    fd.append("folder", "employees");
                    const res  = await fetch("/api/upload", { method: "POST", body: fd });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || "Upload failed");
                    if (data.url) {
                      setForm(f => ({ ...f, avatarUrl: data.url }));
                      toast.success("Photo uploaded! ✅");
                    } else throw new Error("No URL returned");
                  } catch (err: any) {
                    toast.error(err.message || "Upload failed");
                  } finally {
                    setUploading(false);
                  }
                }} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: "Full Name *",  key: "name",     ph: "Rahul Sharma",            type: "text"  },
                { label: "Work Email *", key: "email",    ph: "rahul@cityrealspace.com", type: "email" },
                { label: "Position *",   key: "position", ph: "Senior Broker",           type: "text"  },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs text-muted-foreground mb-1.5 block">{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.ph} autoComplete="off"
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50" />
                </div>
              ))}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">DOB</label>
                <input type="date" value={form.dob} max={new Date().toISOString().split("T")[0]}
                  onChange={e => setForm(p => ({ ...p, dob: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50 [color-scheme:dark]" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Password *</label>
                <div className="flex gap-2">
                  <input value={form.password} placeholder="Type or Generate →" autoComplete="new-password"
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono text-white focus:outline-none focus:border-estate-500/50" />
                  <button type="button" onClick={() => {
                    const pwd = generatePassword(form.name);
                    setForm(f => ({ ...f, password: pwd }));
                    navigator.clipboard.writeText(pwd).catch(() => {});
                    toast.success("Copied! 📋");
                  }} className="px-3 py-2 rounded-lg bg-estate-500/20 text-estate-300 border border-estate-500/30 hover:bg-estate-500/30 text-xs whitespace-nowrap">
                    ⚡ Generate
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Role *</label>
                <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50">
                  {ROLES.map(r => <option key={r} value={r} className="bg-[#0f1f35]">{r}</option>)}
                </select>
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={saving || uploading}
                className="btn-primary flex items-center gap-2 text-sm px-6 py-2 disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {saving ? "Adding..." : "Add Employee"}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-6 py-2 text-sm text-muted-foreground hover:text-white border border-white/10 rounded-lg">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Today's Daily Reports */}
      <div className="glass-card p-4 border border-white/10">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-estate-400" />
            <span className="text-sm font-semibold text-white">Today's Daily Reports</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-estate-500/15 border border-estate-500/30 text-estate-300">
              {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          </div>
          <button onClick={() => router.push("/admin-employees/daily-reports")}
            className="text-xs text-estate-400 hover:text-estate-300 underline">
            View All →
          </button>
        </div>

        {reportsLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-estate-400" />
          </div>
        ) : todayReports.length === 0 ? (
          <div className="text-center py-6">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-xs text-muted-foreground">No reports submitted yet</p>
            {employees.filter(e => e.isActive).length > 0 && (
              <p className="text-xs text-yellow-400 mt-1">
                ⚠️ {employees.filter(e => e.isActive).length} of {employees.filter(e => e.isActive).length} employees have not submitted
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Summary row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {[
                { label: "Calls",   value: todayReports.reduce((s, r) => s + r.totalCalls, 0),   color: "text-blue-400" },
                { label: "Leads",   value: todayReports.reduce((s, r) => s + r.newLeads, 0),     color: "text-yellow-400" },
                { label: "Visits",  value: todayReports.reduce((s, r) => s + r.siteVisits, 0),   color: "text-orange-400" },
                { label: "Closed",  value: todayReports.reduce((s, r) => s + r.dealsClosed, 0),  color: "text-emerald-400" },
              ].map(s => (
                <div key={s.label} className="p-2.5 rounded-lg bg-white/5 text-center">
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Per-employee rows */}
            <div className="space-y-2">
              {todayReports.map(r => (
                <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border ${
                  r.status === "REVIEWED" ? "bg-emerald-500/5 border-emerald-500/15" : "bg-white/3 border-white/8"
                }`}>
                  <div className="w-8 h-8 rounded-full bg-estate-600/30 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                    {r.employee?.name?.[0]?.toUpperCase() || "?"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{r.employee?.name}</span>
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                        r.status === "REVIEWED" ? "bg-emerald-500/15 text-emerald-400" : "bg-blue-500/15 text-blue-400"
                      }`}>{r.status === "REVIEWED" ? "✓ Reviewed" : "Submitted"}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-blue-400 flex items-center gap-1"><Phone className="w-3 h-3" />{r.totalCalls}</span>
                      <span className="text-xs text-orange-400 flex items-center gap-1"><Building2 className="w-3 h-3" />{r.siteVisits}</span>
                      <span className="text-xs text-yellow-400">⭐ {r.newLeads} leads</span>
                      {r.dealsClosed > 0 && <span className="text-xs text-emerald-400 font-semibold">✅ {r.dealsClosed} closed</span>}
                    </div>
                  </div>
                  <button onClick={() => router.push("/admin-employees/daily-reports")}
                    className="text-xs text-muted-foreground hover:text-white flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Who hasn't submitted */}
            {(() => {
              const submittedIds = new Set(todayReports.map(r => r.employeeId));
              const missing = employees.filter(e => e.isActive && !submittedIds.has(e.id));
              return missing.length > 0 ? (
                <div className="mt-3 p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/15">
                  <p className="text-xs text-yellow-400 font-medium mb-1.5">⏳ Not yet submitted ({missing.length})</p>
                  <div className="flex flex-wrap gap-1.5">
                    {missing.map(e => (
                      <span key={e.id} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                        {e.name}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}
          </>
        )}
      </div>

      {/* Employee Cards */}
      {employees.filter(e => e.isActive).length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No employees yet. Add your first team member!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.filter(e => e.isActive).map(emp => (
            <EmployeeCard
              key={emp.id}
              emp={emp}
              onView={() => router.push(`/admin-employees/${emp.id}`)}
              onDelete={() => handleDelete(emp.id, emp.name)}
              deleting={deleting === emp.id}
              leaves={leaves}
              documents={documents}
              attendance={attendance}
            />
          ))}
        </div>
      )}
    </div>
  );
}
