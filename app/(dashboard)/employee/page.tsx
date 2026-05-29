"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CalendarDays, CheckCircle2, XCircle, AlertCircle,
  Plus, Loader2, TrendingUp, Users, X, LogIn, LogOut, Coffee,
  Camera, Mail, Briefcase, Shield, User, LogOut as SignOutIcon,
  FileText, Upload, Trash2, ExternalLink, ScanLine, MessageCircle, Send, ScanFace,
} from "lucide-react";
import FacePunch from "@/components/attendance/FacePunch";

function LiveTimer({ since, breakSecs = 0, small = false }: { since: string; breakSecs: number; small?: boolean }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 1000) - breakSecs));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [since, breakSecs]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  return <span className={`font-mono font-bold text-emerald-400 ${small ? "text-xs" : "text-2xl"}`}>{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}</span>;
}

function BreakTimer({ since }: { since: number }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const tick = () => setSecs(Math.floor((Date.now() - since) / 1000));
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id);
  }, [since]);
  return <span className="font-mono text-yellow-400">{String(Math.floor(secs/60)).padStart(2,"0")}:{String(secs%60).padStart(2,"0")}</span>;
}

const LEAVE_TYPES = ["CASUAL","SICK","HALF_DAY","WORK_FROM_HOME","OTHER"];
const STATUS_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Pending",  color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",   icon: <AlertCircle className="w-3 h-3" /> },
  APPROVED: { label: "Approved", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-3 h-3" /> },
  REJECTED: { label: "Rejected", color: "text-red-400 bg-red-500/10 border-red-500/20",             icon: <XCircle className="w-3 h-3" /> },
};
const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50";

const DOC_TYPES = [
  "CV", "PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "EXPERIENCE_LETTER",
  "SALARY_SLIP", "OFFER_LETTER", "CONTRACT", "OTHER",
];

const DOC_LABELS: Record<string, { label: string; icon: string }> = {
  CV:                 { label: "CV / Resume",        icon: "📋" },
  PAN_CARD:           { label: "PAN Card",            icon: "🪪" },
  AADHAR_CARD:        { label: "Aadhar Card",         icon: "🆔" },
  BANK_PASSBOOK:      { label: "Bank Passbook",       icon: "🏦" },
  EXPERIENCE_LETTER:  { label: "Experience Letter",   icon: "📜" },
  SALARY_SLIP:        { label: "Salary Slip",         icon: "💰" },
  OFFER_LETTER:       { label: "Offer Letter",        icon: "📩" },
  CONTRACT:           { label: "Contract",            icon: "📝" },
  OTHER:              { label: "Other",               icon: "📄" },
};

const TABS = [
  { id: "profile",    label: "Profile",    icon: User },
  { id: "attendance", label: "Attendance", icon: Clock },
  { id: "leaves",     label: "Leaves",     icon: CalendarDays },
  { id: "documents",  label: "Documents",  icon: FileText },
  { id: "chat",       label: "Chat",       icon: MessageCircle },
];

export default function EmployeePanelPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tab, setTab]                 = useState("profile");
  const [empProfile, setEmpProfile]   = useState<any>(null);
  const [leaves, setLeaves]           = useState<any[]>([]);
  const [attendance, setAttendance]   = useState<any[]>([]);
  const [locations, setLocations]     = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showForm, setShowForm]       = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [punching, setPunching]       = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm]               = useState({ type: "CASUAL", fromDate: "", toDate: "", reason: "" });
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [breakState, setBreakState]   = useState<{ start: number; total: number }>({ start: 0, total: 0 });
  const [showFacePunch, setShowFacePunch] = useState(false);
  const [facePunchAction, setFacePunchAction] = useState<"IN" | "OUT">("IN");
  const [documents, setDocuments]     = useState<any[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docForm, setDocForm]         = useState({ name: "", type: "SALARY_SLIP", notes: "" });
  const [showDocForm, setShowDocForm] = useState(false);
  const docFileRef                    = useRef<HTMLInputElement>(null);
  const docCamRef                     = useRef<HTMLInputElement>(null);

  // ── Chat ──
  const [chatRooms, setChatRooms]       = useState<any[]>([]);
  const [chatRoomsLoading, setChatRoomsLoading] = useState(false);
  const [activeRoom, setActiveRoom]     = useState<any>(null);
  const [chatMsgs, setChatMsgs]         = useState<any[]>([]);
  const [chatMsgsLoading, setChatMsgsLoading] = useState(false);
  const [chatText, setChatText]         = useState("");
  const [chatSending, setChatSending]   = useState(false);
  const chatEndRef                      = useRef<HTMLDivElement>(null);

  const email    = user?.primaryEmailAddress?.emailAddress || "";
  const userName = empProfile?.name || user?.fullName || user?.firstName || email.split("@")[0] || "Employee";
  const role     = ((empProfile?.role || user?.publicMetadata?.role as string) || "BROKER").toUpperCase();
  const isAdmin  = role === "ADMIN";

  // Admin redirect — wait for isLoaded
  useEffect(() => {
    if (isLoaded && isAdmin) router.replace("/attendance");
  }, [isLoaded, isAdmin, router]);

  const fetchData = useCallback(async () => {
    try {
      const [lRes, leavRes, attRes, empRes, docRes] = await Promise.all([
        fetch("/api/attendance/locations"),
        fetch(`/api/leaves${email ? `?email=${encodeURIComponent(email)}` : ""}`),
        fetch(`/api/attendance/guest${email ? `?phone=${encodeURIComponent(email)}` : ""}`),
        fetch("/api/employee/profile"),
        fetch("/api/employee/documents"),
      ]);
      const [locs, leavs, atts, emp, docs] = await Promise.all([lRes.json(), leavRes.json(), attRes.json(), empRes.json(), docRes.json()]);
      setLocations(Array.isArray(locs) ? locs : []);
      setLeaves(Array.isArray(leavs) ? leavs : []);
      const attArr = Array.isArray(atts) ? atts : [];
      setAttendance(attArr);
      if (emp && emp.id) setEmpProfile(emp);
      setDocuments(Array.isArray(docs) ? docs : []);
      const today = new Date(); today.setHours(0,0,0,0);
      const active = attArr.find((a: any) => !a.punchOut && new Date(a.punchIn) >= today);
      setTodayRecord(active || null);
    } catch { /* silent */ }
    setLoading(false);
  }, [email]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!email) { setLoading(false); return; }
    fetchData();
  }, [fetchData, email, isLoaded]);

  // Refresh leaves every 60 sec to catch admin approve/reject
  useEffect(() => {
    const id = setInterval(() => fetchData(), 60000);
    return () => clearInterval(id);
  }, [fetchData]);

  const fetchChatRooms = useCallback(async () => {
    setChatRoomsLoading(true);
    try {
      const res  = await fetch("/api/chat/rooms");
      const data = await res.json();
      setChatRooms(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setChatRoomsLoading(false);
  }, []);

  const openRoom = async (room: any) => {
    setActiveRoom(room);
    setChatMsgsLoading(true);
    setChatMsgs([]);
    try {
      const res  = await fetch(`/api/chat/rooms/${room.id}/messages`);
      const data = await res.json();
      setChatMsgs(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    setChatMsgsLoading(false);
  };

  const sendMsg = async () => {
    if (!chatText.trim() || !activeRoom) return;
    setChatSending(true);
    const text = chatText.trim();
    setChatText("");
    try {
      const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const msg = await res.json();
      if (res.ok) setChatMsgs(prev => [...prev, msg]);
      else toast.error(msg.error || "Failed");
    } catch { toast.error("Send failed"); }
    setChatSending(false);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs]);

  useEffect(() => { if (tab === "chat") fetchChatRooms(); }, [tab, fetchChatRooms]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("folder", "employees");
      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const { url, error: upErr } = await upRes.json();
      if (!url) { toast.error(upErr || "Upload failed"); return; }

      const saveRes = await fetch("/api/employee/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: url }),
      });
      if (saveRes.ok) {
        setEmpProfile((p: any) => ({ ...(p || {}), avatarUrl: url }));
        toast.success("Profile photo updated! 📸");
      } else {
        // fallback: update User table avatar directly
        await fetch("/api/auth/me", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ avatar: url }),
        }).catch(() => {});
        setEmpProfile((p: any) => ({ ...(p || {}), avatarUrl: url }));
        toast.success("Profile photo updated! 📸");
      }
    } catch { toast.error("Network error"); }
    setUploadingPhoto(false);
  };

  const handlePunch = async (type: "IN" | "OUT") => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    setPunching(true);
    const res = await fetch("/api/attendance/guest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: userName, phone: email || userName, locationId: locations[0].id, bypass: true, ...(type === "OUT" ? { action: "OUT" } : {}) }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Failed");
    else if (type === "IN") { toast.success("Punched in! 🎯"); setTodayRecord(data.record); fetchData(); }
    else { toast.success(`Punched out! ${data.record?.workHours?.toFixed(1) || 0}h worked 💪`); setTodayRecord(null); setBreakState({ start: 0, total: 0 }); fetchData(); }
    setPunching(false);
  };

  const toggleBreak = () => {
    setBreakState(prev => {
      if (prev.start > 0) {
        const elapsed = Math.floor((Date.now() - prev.start) / 1000);
        toast.success(`Break ended — ${Math.floor(elapsed/60)}m ${elapsed%60}s ☕`);
        return { start: 0, total: prev.total + elapsed };
      }
      toast("Break started ☕", { icon: "⏸️" });
      return { ...prev, start: Date.now() };
    });
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, employeeEmail: email }),
      });
      const data = await res.json();
      if (res.ok) { toast.success("Leave submitted!"); setLeaves(prev => [data, ...prev]); setShowForm(false); setForm({ type: "CASUAL", fromDate: "", toDate: "", reason: "" }); }
      else toast.error(data.error || "Failed");
    } catch { toast.error("Server error. Please try again."); }
    setSubmitting(false);
  };

  const cancelLeave = async (id: string) => {
    const res = await fetch(`/api/leaves/${id}`, { method: "DELETE" });
    if (res.ok) { setLeaves(prev => prev.filter(l => l.id !== id)); toast.success("Leave cancelled"); }
    else toast.error("Cannot cancel");
  };

  const handleDocUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!docForm.name.trim()) { toast.error("Enter document name first"); e.target.value = ""; return; }
    setDocUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "employee-docs");

      const upRes = await fetch("/api/upload", { method: "POST", body: fd });
      const text  = await upRes.text(); // read as text first — never fails
      let upData: { url?: string; error?: string } = {};
      try { upData = JSON.parse(text); } catch { /* empty response */ }

      if (!upData.url) {
        toast.error(upData.error || "Upload failed — try again");
        setDocUploading(false); e.target.value = ""; return;
      }

      const res  = await fetch("/api/employee/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: docForm.name, type: docForm.type, url: upData.url, notes: docForm.notes }),
      });
      const data = await res.json();
      if (res.ok) {
        setDocuments(prev => [data, ...prev]);
        setDocForm({ name: "", type: "CV", notes: "" });
        setShowDocForm(false);
        toast.success("Document uploaded! Admin will review it. 📄");
      } else {
        toast.error(data.error || "Failed to save document");
      }
    } catch (err: unknown) {
      toast.error("Upload failed: " + ((err as Error).message || "Unknown error"));
    }
    setDocUploading(false);
    e.target.value = "";
  };

  const deleteDoc = async (id: string) => {
    if (!confirm("Delete this document?")) return;
    const res = await fetch("/api/employee/documents", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) { setDocuments(prev => prev.filter(d => d.id !== id)); toast.success("Deleted"); }
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/sign-in");
  };

  const totalDays      = attendance.filter((a: any) => a.approved).length; // only admin-approved
  const totalHours     = attendance.filter((a: any) => a.approved).reduce((s: number, a: any) => s + (a.workHours || 0), 0);
  const pendingLeaves  = leaves.filter(l => l.status === "PENDING").length;
  const approvedLeaves = leaves.filter(l => l.status === "APPROVED").length;
  const onBreak        = breakState.start > 0;
  const breakSecs      = breakState.total + (onBreak ? Math.floor((Date.now() - breakState.start) / 1000) : 0);

  if (!isLoaded) return <div className="p-6 flex items-center justify-center min-h-64"><Loader2 className="w-8 h-8 animate-spin text-estate-400" /></div>;
  if (isAdmin) return null;
  if (loading) return <div className="p-6 flex items-center justify-center min-h-64"><Loader2 className="w-8 h-8 animate-spin text-estate-400" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-3xl mx-auto">

      {/* Face Punch Modal */}
      <AnimatePresence>
        {showFacePunch && (
          <FacePunch
            employeeName={userName}
            action={facePunchAction}
            onClose={() => setShowFacePunch(false)}
            onSuccess={() => {
              setShowFacePunch(false);
              handlePunch(facePunchAction);
            }}
          />
        )}
      </AnimatePresence>

      {/* ── Sticky Punch Status Banner ── */}
      <AnimatePresence>
        {todayRecord && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            className="sticky top-0 z-30 rounded-2xl overflow-hidden"
            style={{ background: onBreak ? "rgba(234,179,8,0.12)" : "rgba(16,185,129,0.1)", border: `1px solid ${onBreak ? "rgba(234,179,8,0.3)" : "rgba(16,185,129,0.3)"}`, backdropFilter: "blur(12px)" }}
          >
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Status dot */}
              <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${onBreak ? "bg-yellow-400" : "bg-emerald-400"} animate-pulse`} />

              {/* Punch in time */}
              <div className="flex-shrink-0">
                <div className="text-xs text-muted-foreground">Punched In</div>
                <div className="text-xs font-semibold text-white">
                  {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </div>
              </div>

              <div className="text-muted-foreground text-xs">·</div>

              {/* Live work timer */}
              <div className="flex-shrink-0">
                <div className="text-xs text-muted-foreground">Work Time</div>
                <LiveTimer since={todayRecord.punchIn} breakSecs={breakSecs} small />
              </div>

              {/* Break time */}
              {(onBreak || breakState.total > 0) && (
                <>
                  <div className="text-muted-foreground text-xs">·</div>
                  <div className="flex-shrink-0">
                    <div className="text-xs text-muted-foreground">Break</div>
                    <div className="font-mono text-xs font-bold text-yellow-400">
                      {onBreak
                        ? <BreakTimer since={breakState.start} />
                        : <span>{String(Math.floor(breakState.total/60)).padStart(2,"0")}:{String(breakState.total%60).padStart(2,"0")}</span>
                      }
                    </div>
                  </div>
                </>
              )}

              {/* Break button */}
              <button onClick={toggleBreak}
                className={`ml-auto flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-all flex-shrink-0 ${
                  onBreak
                    ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                    : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400 hover:border-yellow-500/30"
                }`}>
                <Coffee className="w-3 h-3" />
                {onBreak ? "End Break" : "Break"}
              </button>

              {/* Punch out */}
              <button onClick={() => handlePunch("OUT")} disabled={punching}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50 flex-shrink-0">
                {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
                Out
              </button>
            </div>

            {/* Break progress bar */}
            {(onBreak || breakState.total > 0) && (
              <div className="h-0.5 bg-white/5">
                <motion.div
                  className="h-full bg-yellow-400"
                  animate={{ width: `${Math.min(100, ((breakState.total + (onBreak ? Math.floor((Date.now() - breakState.start)/1000) : 0)) / 3600) * 100)}%` }}
                  transition={{ duration: 1 }}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile Header — always visible */}
      <div className="glass-card p-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="relative w-20 h-20 rounded-full overflow-hidden bg-white/10 border-2 border-estate-500/40">
              {empProfile?.avatarUrl ? (
                <Image src={empProfile.avatarUrl} alt={userName} fill className="object-cover" />
              ) : user?.imageUrl ? (
                <Image src={user.imageUrl} alt={userName} fill className="object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white">{userName[0]}</div>
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
              className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-estate-600 border-2 border-background flex items-center justify-center hover:bg-estate-500 transition-colors">
              {uploadingPhoto ? <Loader2 className="w-3 h-3 animate-spin text-white" /> : <Camera className="w-3 h-3 text-white" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-white">{userName}</h1>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Briefcase className="w-3 h-3" /> {empProfile?.position || "Employee"}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Shield className="w-3 h-3" /> {role.replace("_"," ")}</span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" /> {email}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className={`px-2 py-0.5 rounded-full text-xs border ${empProfile?.isActive !== false ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"}`}>
                {empProfile?.isActive !== false ? "✓ Active" : "✕ Inactive"}
              </span>
              {todayRecord && <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse">● In Office</span>}
            </div>
          </div>
          {/* Sign Out */}
          <button onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex-shrink-0">
            <SignOutIcon className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${tab === t.id ? "bg-estate-600 text-white" : "text-muted-foreground hover:text-white"}`}>
            <t.icon className="w-3.5 h-3.5" /> {t.label}
            {t.id === "leaves" && pendingLeaves > 0 && <span className="bg-yellow-500 text-black text-xs rounded-full w-4 h-4 flex items-center justify-center font-bold">{pendingLeaves}</span>}
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ── */}
      {tab === "profile" && (
        <div className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Days Present",    value: totalDays,                   icon: <Users className="w-4 h-4" />,       color: "from-blue-600 to-blue-400" },
              { label: "Hours Worked",    value: `${totalHours.toFixed(1)}h`, icon: <Clock className="w-4 h-4" />,       color: "from-emerald-600 to-emerald-400" },
              { label: "Leaves Pending",  value: pendingLeaves,               icon: <AlertCircle className="w-4 h-4" />, color: "from-yellow-600 to-yellow-400" },
              { label: "Leaves Approved", value: approvedLeaves,              icon: <TrendingUp className="w-4 h-4" />,  color: "from-purple-600 to-purple-400" },
            ].map(s => (
              <div key={s.label} className="glass-card p-4">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${s.color} flex items-center justify-center text-white mb-3`}>{s.icon}</div>
                <div className="text-xl font-bold text-white">{s.value}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
          {/* Quick punch from profile */}
          <div className="glass-card p-4 flex items-center gap-4">
            <Clock className="w-5 h-5 text-estate-400 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Today's Attendance</div>
              <div className="text-xs text-muted-foreground">
                {todayRecord ? `In office since ${new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}` : "Not punched in yet"}
              </div>
            </div>
            {todayRecord ? (
              <button onClick={() => { setFacePunchAction("OUT"); setShowFacePunch(true); }} disabled={punching}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50">
                {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanFace className="w-3 h-3" />} Face Punch Out
              </button>
            ) : (
              <button onClick={() => { setFacePunchAction("IN"); setShowFacePunch(true); }} disabled={punching}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-50">
                {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ScanFace className="w-3 h-3" />} Face Punch In
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ATTENDANCE TAB ── */}
      {tab === "attendance" && (
        <div className="space-y-4">
          {/* Today card */}
          <div className="glass-card p-5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Today</div>
            {todayRecord ? (
              <div className="space-y-4">
                <div className="text-center py-5 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                  <div className="text-xs text-muted-foreground mb-1">Work Time</div>
                  <LiveTimer since={todayRecord.punchIn} breakSecs={breakSecs} />
                  {onBreak && <div className="mt-2 text-sm text-yellow-400 flex items-center justify-center gap-2"><Coffee className="w-4 h-4" /> On Break — <BreakTimer since={breakState.start} /></div>}
                  <div className="text-xs text-muted-foreground mt-2">
                    Punched in at {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                    {todayRecord.lateMinutes > 0 && <span className="ml-2 text-red-400">· {todayRecord.lateMinutes}m late</span>}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={toggleBreak} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-all ${onBreak ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400"}`}>
                    <Coffee className="w-4 h-4" /> {onBreak ? "End Break" : "Start Break"}
                  </button>
                  <button onClick={() => { setFacePunchAction("OUT"); setShowFacePunch(true); }} disabled={punching} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all disabled:opacity-50">
                    <ScanFace className="w-4 h-4" /> Face Punch Out
                  </button>
                </div>
                {/* Manual punch out fallback */}
                <button onClick={() => handlePunch("OUT")} disabled={punching} className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs text-muted-foreground border border-white/10 hover:text-red-400 hover:border-red-500/30 transition-all">
                  {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} Manual Punch Out (no camera)
                </button>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="text-muted-foreground text-sm">Not punched in today</div>
                {/* Face Punch In */}
                <button onClick={() => { setFacePunchAction("IN"); setShowFacePunch(true); }} disabled={punching}
                  className="flex items-center justify-center gap-2 mx-auto px-8 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium transition-all disabled:opacity-50">
                  <ScanFace className="w-5 h-5" /> Face Punch In
                </button>
                {/* Manual fallback */}
                <button onClick={() => handlePunch("IN")} disabled={punching} className="flex items-center justify-center gap-2 mx-auto px-6 py-2 rounded-xl text-xs text-muted-foreground border border-white/10 hover:text-emerald-400 hover:border-emerald-500/30 transition-all">
                  {punching ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />} Manual Punch In (no camera)
                </button>
                <div className="text-xs text-muted-foreground">Mon–Sat 10:00 AM – 7:00 PM · Sunday 4:00–6:00 PM</div>
              </div>
            )}
          </div>

          {/* Monthly summary */}
          <div className="glass-card p-5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">This Month Summary</div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: "Present", value: totalDays, color: "text-emerald-400" },
                { label: "Hours",   value: `${totalHours.toFixed(1)}h`, color: "text-blue-400" },
                { label: "Late Days", value: attendance.filter((a:any) => a.lateMinutes > 0).length, color: "text-red-400" },
              ].map(s => (
                <div key={s.label} className="text-center p-3 rounded-xl bg-white/5">
                  <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* History list */}
            <div className="text-xs font-medium text-muted-foreground mb-2">Attendance History</div>
            {attendance.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">No records yet</div>
            ) : (
              <div className="space-y-2">
                {attendance.slice(0, 30).map((a: any) => {
                  const isSun = new Date(a.punchIn).getDay() === 0;
                  const expectedH = isSun ? 2 : 9;
                  const diff = a.workHours ? a.workHours - expectedH : null;
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.punchOut ? (a.approved ? (a.lateMinutes > 0 ? "bg-red-400" : "bg-emerald-400") : "bg-yellow-400") : "bg-yellow-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {new Date(a.punchIn).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          {!a.approved && a.punchOut && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">Pending Approval</span>
                          )}
                          {a.approved && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">✓ Approved</span>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {new Date(a.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                          {a.punchOut && <> → {new Date(a.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}</>}
                          {!a.punchOut && <span className="ml-1 text-yellow-400">● In Office</span>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-bold text-white">{a.workHours ? `${a.workHours.toFixed(1)}h` : "—"}</div>
                        {diff !== null && (
                          <div className={`text-xs font-medium ${diff >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {diff >= 0 ? `+${diff.toFixed(1)}h` : `${diff.toFixed(1)}h`}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── DOCUMENTS TAB ── */}
      {tab === "documents" && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">My Documents</h2>
            <button onClick={() => setShowDocForm(v => !v)} className="btn-primary flex items-center gap-2 text-xs px-3 py-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload
            </button>
          </div>
          {showDocForm && (
            <div className="mb-5 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Document Name *</label>
                  <input value={docForm.name} onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Salary Slip June 2025" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Type</label>
                  <select value={docForm.type} onChange={e => setDocForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                    {DOC_TYPES.map(t => (
                      <option key={t} value={t} className="bg-[#0f1f35]">
                        {DOC_LABELS[t]?.icon} {DOC_LABELS[t]?.label || t.replace(/_/g, " ")}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Notes (optional)</label>
                <input value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Any notes..." className={inputCls} />
              </div>
              {/* Upload options */}
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Upload Method</label>
                <div className="flex gap-2">
                  {/* Camera scan */}
                  <button type="button" onClick={() => docCamRef.current?.click()} disabled={docUploading || !docForm.name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-50
                      bg-blue-500/10 text-blue-400 border-blue-500/25 hover:bg-blue-500/20">
                    {docUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    📷 Scan / Camera
                  </button>
                  {/* File upload */}
                  <button type="button" onClick={() => docFileRef.current?.click()} disabled={docUploading || !docForm.name.trim()}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all disabled:opacity-50
                      bg-estate-500/10 text-estate-300 border-estate-500/25 hover:bg-estate-500/20">
                    {docUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    📁 Choose File
                  </button>
                </div>
                {!docForm.name.trim() && <p className="text-xs text-yellow-400/70 mt-1.5">⚠️ Enter document name above to enable upload</p>}
              </div>
              <button onClick={() => setShowDocForm(false)} className="text-xs text-muted-foreground hover:text-white">Cancel</button>
              {/* Camera input — opens device camera */}
              <input ref={docCamRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleDocUpload} />
              {/* File input — opens file picker (PDF, images, docs) */}
              <input ref={docFileRef} type="file" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden" onChange={handleDocUpload} />
            </div>
          )}
          {documents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No documents uploaded yet</div>
          ) : (
            <div className="space-y-2">
              {documents.map(d => (
                <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                  <span className="text-xl flex-shrink-0">{DOC_LABELS[d.type]?.icon || "📄"}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white truncate">{d.name}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {DOC_LABELS[d.type]?.label || d.type.replace(/_/g, " ")} · {new Date(d.createdAt).toLocaleDateString("en-IN")}
                      </span>
                      {d.status === "PENDING" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20 text-yellow-400">⏳ Pending Approval</span>
                      )}
                      {d.status === "APPROVED" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">✅ Approved</span>
                      )}
                      {d.status === "REJECTED" && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400">❌ Rejected</span>
                      )}
                    </div>
                    {d.adminNote && d.status === "REJECTED" && (
                      <p className="text-xs text-red-400 mt-0.5">Reason: {d.adminNote}</p>
                    )}
                    {d.notes && <div className="text-xs text-muted-foreground">{d.notes}</div>}
                  </div>
                  <a href={d.url} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg hover:bg-estate-500/10 text-muted-foreground hover:text-estate-400 transition-colors">
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button onClick={() => deleteDoc(d.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── LEAVES TAB ── */}
      {tab === "leaves" && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-white">My Leave Requests</h2>
            <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2 text-xs px-3 py-1.5">
              <Plus className="w-3.5 h-3.5" /> Apply Leave
            </button>
          </div>
          <AnimatePresence>
            {showForm && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                onSubmit={handleApply} className="mb-5 p-4 rounded-xl bg-white/5 border border-white/10 space-y-3 overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">New Leave Request</span>
                  <button type="button" onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-white"><X className="w-4 h-4" /></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Leave Type</label>
                    <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                      {LEAVE_TYPES.map(t => <option key={t} value={t} className="bg-[#0f1f35]">{t.replace("_"," ")}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">From Date</label>
                    <input required type="date" value={form.fromDate} onChange={e => setForm(f => ({ ...f, fromDate: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">To Date</label>
                    <input required type="date" value={form.toDate} onChange={e => setForm(f => ({ ...f, toDate: e.target.value }))} className={`${inputCls} [color-scheme:dark]`} />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Reason *</label>
                  <textarea required rows={2} value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for leave..." className={`${inputCls} resize-none`} />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={submitting} className="btn-primary text-sm px-4 py-2 flex items-center gap-2 disabled:opacity-60">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Submit
                  </button>
                  <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-white border border-white/10 rounded-lg">Cancel</button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
          {leaves.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No leave requests yet</div>
          ) : (
            <div className="space-y-2">
              {leaves.map(l => {
                const cfg = STATUS_CFG[l.status];
                return (
                  <div key={l.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{l.type.replace("_"," ")}</span>
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.icon} {cfg.label}</span>
                        <span className="text-xs text-muted-foreground">{l.days} day{l.days !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {new Date(l.fromDate).toLocaleDateString("en-IN")} → {new Date(l.toDate).toLocaleDateString("en-IN")}
                      </div>
                      {l.adminNote && <div className="text-xs text-yellow-400 mt-0.5">Admin: {l.adminNote}</div>}
                    </div>
                    {l.status === "PENDING" && (
                      <button onClick={() => cancelLeave(l.id)} className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 rounded-lg px-2 py-1 flex-shrink-0">Cancel</button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      {/* ── CHAT TAB ── */}
      {tab === "chat" && (
        <div className="glass-card overflow-hidden" style={{ height: "65vh", display: "flex", flexDirection: "column" }}>
          {!activeRoom ? (
            // Room list
            <>
              <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-semibold text-white flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-blue-400" /> Team Chat
                </h2>
                <button onClick={fetchChatRooms} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white">
                  {chatRoomsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <span className="text-xs">↻</span>}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {chatRoomsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
                  </div>
                ) : chatRooms.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                    <MessageCircle className="w-10 h-10 opacity-30" />
                    No chats yet
                  </div>
                ) : (
                  <div className="divide-y divide-white/5">
                    {chatRooms.map(room => (
                      <button key={room.id} onClick={() => openRoom(room)}
                        className="w-full flex items-center gap-3 px-5 py-3 hover:bg-white/5 transition-colors text-left">
                        <div className="w-10 h-10 rounded-full bg-estate-500/20 flex items-center justify-center text-sm font-bold text-estate-300 flex-shrink-0">
                          {room.name?.[0]?.toUpperCase() ?? "?"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white">{room.name}</div>
                          {room.lastMsg && (
                            <div className="text-xs text-muted-foreground truncate">{room.lastMsg}</div>
                          )}
                        </div>
                        {room.lastTime && (
                          <div className="text-xs text-muted-foreground flex-shrink-0">
                            {new Date(room.lastTime).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            // Active chat
            <>
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10 flex-shrink-0">
                <button onClick={() => { setActiveRoom(null); setChatMsgs([]); }}
                  className="text-muted-foreground hover:text-white text-lg leading-none">←</button>
                <div className="w-8 h-8 rounded-full bg-estate-500/20 flex items-center justify-center text-sm font-bold text-estate-300">
                  {activeRoom.name?.[0]?.toUpperCase()}
                </div>
                <div className="text-sm font-semibold text-white">{activeRoom.name}</div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {chatMsgsLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
                  </div>
                ) : chatMsgs.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground text-sm">No messages yet</div>
                ) : (
                  chatMsgs.map(msg => {
                    const isMe = msg.sender?.name !== activeRoom.name;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                          isMe ? "bg-estate-600 text-white" : "bg-white/10 text-white"
                        }`}>
                          <p className="break-words">{msg.text}</p>
                          <p className="text-xs mt-1 opacity-60">
                            {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={chatEndRef} />
              </div>
              <div className="p-3 border-t border-white/10 flex gap-2 flex-shrink-0">
                <input
                  value={chatText}
                  onChange={e => setChatText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); } }}
                  placeholder="Type a message..."
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-estate-500/50"
                />
                <button onClick={sendMsg} disabled={chatSending || !chatText.trim()}
                  className="p-2.5 rounded-xl bg-estate-600 hover:bg-estate-500 text-white disabled:opacity-50 transition-colors">
                  {chatSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
