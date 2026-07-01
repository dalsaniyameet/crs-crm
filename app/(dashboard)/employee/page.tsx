"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import Image from "next/image";
import toast from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, CalendarDays, CheckCircle2, XCircle, AlertCircle,
  Plus, Loader2, TrendingUp, Users, X, Coffee,
  Camera, Mail, Briefcase, Shield, User, LogOut as SignOutIcon,
  FileText, Upload, Trash2, ExternalLink, MessageCircle, Send,
  StickyNote, Pin, PinOff, MapPin, ScanFace,
} from "lucide-react";
import dynamic from "next/dynamic";
const FacePunch = dynamic(() => import("@/components/attendance/FacePunch"), { ssr: false });

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

// Employee can only upload these types — SALARY_SLIP, OFFER_LETTER, CONTRACT are sent by admin
const DOC_TYPES = [
  "CV", "PAN_CARD", "AADHAR_CARD", "BANK_PASSBOOK", "EXPERIENCE_LETTER", "OTHER",
];

// Admin-only document types (employee cannot upload these)
const ADMIN_ONLY_TYPES = ["SALARY_SLIP", "OFFER_LETTER", "CONTRACT"];

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
  { id: "notes",      label: "Notes",      icon: StickyNote },
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
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [form, setForm]               = useState({ type: "CASUAL", fromDate: "", toDate: "", reason: "" });
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [punching, setPunching]       = useState(false);
  const [showFacePunch, setShowFacePunch] = useState(false);
  const [facePunchAction, setFacePunchAction] = useState<"IN"|"OUT">("IN");
  const [punchErr, setPunchErr]       = useState("");
  const [documents, setDocuments]     = useState<any[]>([]);
  const [docUploading, setDocUploading] = useState(false);
  const [docForm, setDocForm]         = useState({ name: "", type: "SALARY_SLIP", notes: "" });
  const [showDocForm, setShowDocForm] = useState(false);
  const docFileRef                    = useRef<HTMLInputElement>(null);
  const docCamRef                     = useRef<HTMLInputElement>(null);

  // ── Sticky Notes ──
  const [stickyNotes, setStickyNotes] = useState<any[]>([]);
  const [noteText, setNoteText]       = useState("");
  const [noteColor, setNoteColor]     = useState("yellow");
  const [editingId, setEditingId]     = useState<string | null>(null);
  const [editText, setEditText]       = useState("");
  const [notesSaving, setNotesSaving] = useState(false);

  // ── Call Reference Cards ──
  const [callCards, setCallCards]     = useState<any[]>([]);
  const [showCallForm, setShowCallForm] = useState(false);
  const [callSaving, setCallSaving]   = useState(false);
  const [callForm, setCallForm]       = useState({
    clientName: "", phone: "", altPhone: "",
    propertyTitle: "", budget: "", locality: "",
    category: "", notes: "",
  });

  const loadCallCards = async () => {
    const data = await fetch("/api/employee/sticky-notes?type=call").then(r => r.json()).catch(() => []);
    setCallCards(Array.isArray(data) ? data.filter((n: any) => n.color === "call") : []);
  };

  const saveCallCard = async () => {
    if (!callForm.clientName.trim() || !callForm.phone.trim()) return;
    setCallSaving(true);
    const content = JSON.stringify(callForm);
    const res = await fetch("/api/employee/sticky-notes", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, color: "call", isPinned: true }),
    });
    const data = await res.json();
    if (res.ok) {
      setCallCards(prev => [data, ...prev]);
      setCallForm({ clientName: "", phone: "", altPhone: "", propertyTitle: "", budget: "", locality: "", category: "", notes: "" });
      setShowCallForm(false);
    }
    setCallSaving(false);
  };

  const deleteCallCard = async (id: string) => {
    await fetch("/api/employee/sticky-notes", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setCallCards(prev => prev.filter(c => c.id !== id));
  };

  useEffect(() => { if (tab === "notes") { loadNotes(); loadCallCards(); } }, [tab]);

  const loadNotes = async () => {
    const data = await fetch("/api/employee/sticky-notes").then(r => r.json()).catch(() => []);
    setStickyNotes(Array.isArray(data) ? data : []);
  };



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

  const [logoutCountdown, setLogoutCountdown] = useState<number | null>(null);

  // ── Face Punch with GPS check ──
  const handlePunch = async (type: "IN" | "OUT", faceImage?: string) => {
    if (!locations[0]) { toast.error("No office location configured"); return; }
    setPunching(true); setPunchErr("");
    try {
      // GPS check
      let lat: number, lng: number;
      try {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 8000 })
        );
        lat = pos.coords.latitude; lng = pos.coords.longitude;
      } catch {
        toast.error("Location access denied. Please allow location to punch.");
        setPunching(false); return;
      }
      const loc = locations[0];
      const R = 6371e3;
      const p1 = (lat * Math.PI) / 180, p2 = (loc.latitude * Math.PI) / 180;
      const dp = ((loc.latitude - lat) * Math.PI) / 180, dl = ((loc.longitude - lng) * Math.PI) / 180;
      const a = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
      const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      if (dist > loc.radius) {
        toast.error(`You are ${Math.round(dist)}m from office. Must be within ${loc.radius}m.`);
        setPunching(false); return;
      }
      const res = await fetch("/api/attendance/guest", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userName, phone: email, locationId: loc.id, bypass: true, faceImage,
          ...(type === "OUT" ? { action: "OUT" } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || "Failed"); }
      else {
        toast.success(type === "IN" ? "Punched In ✅" : `Punched Out 👋 · ${data.record?.workHours?.toFixed(1)}h`);
        fetchData();
      }
    } catch { toast.error("Network error"); }
    setPunching(false);
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

  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editForm, setEditForm]               = useState({ name: "", dob: "" });
  const [editSaving, setEditSaving]           = useState(false);

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.name.trim() && !editForm.dob) { toast.error("Please update at least one field"); return; }
    setEditSaving(true);
    try {
      const res = await fetch("/api/employee/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(editForm.name.trim() ? { name: editForm.name.trim() } : {}),
          ...(editForm.dob ? { dob: editForm.dob } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setEmpProfile((p: any) => ({ ...p, name: data.name, dob: data.dob }));
        toast.success("Profile updated! ✅");
        setShowEditProfile(false);
        setEditForm({ name: "", dob: "" });
      } else {
        toast.error(data.error || "Update failed");
      }
    } catch { toast.error("Network error"); }
    setEditSaving(false);
  };

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/sign-in");
  };

  const saveNote = async () => {
    if (!noteText.trim()) return;
    setNotesSaving(true);
    try {
      const res  = await fetch("/api/employee/sticky-notes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: noteText.trim(), color: noteColor }),
      });
      const data = await res.json();
      if (res.ok) { setStickyNotes(prev => [data, ...prev]); setNoteText(""); }
    } catch {}
    setNotesSaving(false);
  };

  const saveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      const res  = await fetch("/api/employee/sticky-notes", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, content: editText.trim() }),
      });
      const data = await res.json();
      if (res.ok) { setStickyNotes(prev => prev.map(n => n.id === id ? data : n)); setEditingId(null); }
    } catch {}
  };

  const deleteNote = async (id: string) => {
    await fetch("/api/employee/sticky-notes", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setStickyNotes(prev => prev.filter(n => n.id !== id));
  };

  const togglePin = async (note: any) => {
    const res  = await fetch("/api/employee/sticky-notes", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: note.id, isPinned: !note.isPinned }),
    });
    const data = await res.json();
    if (res.ok) {
      setStickyNotes(prev =>
        [...prev.map(n => n.id === note.id ? data : n)]
          .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
      );
    }
  };

  const totalDays      = attendance.length;
  const totalHours     = attendance.reduce((s: number, a: any) => s + (a.workHours || 0), 0);
  const pendingLeaves  = leaves.filter(l => l.status === "PENDING").length;
  const approvedLeaves = leaves.filter(l => l.status === "APPROVED").length;

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
            onSuccess={(img) => { setShowFacePunch(false); handlePunch(facePunchAction, img); }}
          />
        )}
      </AnimatePresence>

      {/* Face Punch Modal */}
      <AnimatePresence>
        {showFacePunch && (
          <FacePunch
            employeeName={userName}
            action={facePunchAction}
            onClose={() => setShowFacePunch(false)}
            onSuccess={(img) => { setShowFacePunch(false); handlePunch(facePunchAction, img); }}
          />
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
              {empProfile?.dob && (
                <span className="text-xs text-muted-foreground">
                  DOB: {new Date(empProfile.dob).toLocaleDateString("en-IN")}
                </span>
              )}
            </div>
          </div>
          {/* Edit + Sign Out */}
          <div className="flex flex-col gap-2 flex-shrink-0">
            <button onClick={() => { setShowEditProfile(v => !v); setEditForm({ name: empProfile?.name || userName, dob: empProfile?.dob ? new Date(empProfile.dob).toISOString().split("T")[0] : "" }); }}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
              <User className="w-3.5 h-3.5" /> Edit
            </button>
            <button onClick={handleSignOut}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors">
              <SignOutIcon className="w-3.5 h-3.5" /> Sign Out
            </button>
          </div>
        </div>

        {/* Edit Profile Form */}
        <AnimatePresence>
          {showEditProfile && (
            <motion.form
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              onSubmit={handleEditProfile}
              className="mt-4 pt-4 border-t border-white/10 space-y-3 overflow-hidden"
            >
              <div className="text-xs font-semibold text-white mb-1">✏️ Edit Profile</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Full Name</label>
                  <input
                    value={editForm.name}
                    onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                    placeholder={empProfile?.name || userName}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Date of Birth</label>
                  <input
                    type="date"
                    value={editForm.dob}
                    onChange={e => setEditForm(f => ({ ...f, dob: e.target.value }))}
                    className={`${inputCls} [color-scheme:dark]`}
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={editSaving}
                  className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 disabled:opacity-60">
                  {editSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : null} Save Changes
                </button>
                <button type="button" onClick={() => { setShowEditProfile(false); setEditForm({ name: "", dob: "" }); }}
                  className="px-4 py-2 text-xs text-muted-foreground hover:text-white border border-white/10 rounded-lg">Cancel</button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
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
          {/* Today status — read only */}
          <div className="glass-card p-4 flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full flex-shrink-0 ${todayRecord && !todayRecord.punchOut ? "bg-emerald-400 animate-pulse" : todayRecord?.punchOut ? "bg-blue-400" : "bg-white/20"}`} />
            <div className="flex-1">
              <div className="text-sm font-medium text-white">Today's Attendance</div>
              <div className="text-xs text-muted-foreground">
                {todayRecord
                  ? todayRecord.punchOut
                    ? `${new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} → ${new Date(todayRecord.punchOut).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })} · ${todayRecord.workHours?.toFixed(1)}h`
                    : `In office since ${new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                  : "Not punched in — Login page → Employee tab → Punch In"}
              </div>
            </div>
            {todayRecord?.faceImageIn && (
              <a href={todayRecord.faceImageIn} target="_blank" rel="noreferrer">
                <img src={todayRecord.faceImageIn} alt="in" className="w-9 h-9 rounded-full object-cover border-2 border-emerald-500/50" />
              </a>
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
                  <button onClick={() => window.location.href = "/punch"}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30 transition-all">
                    <ScanFace className="w-4 h-4" /> Face Punch Out
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 space-y-3">
                <div className="text-muted-foreground text-sm">Not punched in today</div>
                <button onClick={() => window.location.href = "/punch"}
                  className="flex items-center justify-center gap-2 mx-auto px-8 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-sm font-medium transition-all">
                  <ScanFace className="w-5 h-5" /> Face Punch In
                </button>
                <div className="text-xs text-muted-foreground">Mon–Sat 10:00 AM – 7:00 PM · Sunday 11:00 AM – 4:00 PM</div>
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
                  const expectedH = isSun ? 5 : 9;
                  const diff = a.workHours ? a.workHours - expectedH : null;
                  return (
                    <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                      <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.punchOut ? (a.approved ? (a.lateMinutes > 0 ? "bg-red-400" : "bg-emerald-400") : (a.approvedBy?.startsWith("REJECTED") ? "bg-red-400" : "bg-yellow-400")) : "bg-yellow-400 animate-pulse"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-white">
                            {new Date(a.punchIn).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          </span>
                          {!a.approved && a.punchOut && !a.approvedBy?.startsWith("REJECTED") && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400">Pending Approval</span>
                          )}
                          {a.approvedBy?.startsWith("REJECTED") && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">✕ Rejected</span>
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

          {/* Admin-only docs info banner */}
          <div className="mb-4 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20 flex items-start gap-2">
            <span className="text-blue-400 text-sm flex-shrink-0">ℹ️</span>
            <p className="text-xs text-blue-300">
              <span className="font-semibold">Salary Slip, Offer Letter, Contract</span> — these documents will be sent by admin. You can only upload CV, PAN, Aadhar, Bank Passbook, Experience Letter.
            </p>
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
                      {ADMIN_ONLY_TYPES.includes(d.type) && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-estate-500/15 border border-estate-500/25 text-estate-300">📨 Admin sent</span>
                      )}
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
                  <a
                    href={(() => {
                      const u = d.url || "";
                      if (!u || u.startsWith("data:")) return u;
                      if (u.includes("/raw/upload/")) return `/api/pdf-proxy?url=${encodeURIComponent(u)}`;
                      if (u.includes(".pdf") || u.includes(".doc")) return `/api/pdf-proxy?url=${encodeURIComponent(u)}`;
                      return u;
                    })()}
                    target="_blank" rel="noreferrer"
                    className="p-1.5 rounded-lg hover:bg-estate-500/10 text-muted-foreground hover:text-estate-400 transition-colors">
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
      {/* ── NOTES TAB ── */}
      {tab === "notes" && (
        <div className="space-y-4">

          {/* ── CALL REFERENCE CARDS ── */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📞</span>
                <span className="text-sm font-semibold text-white">Call Reference Cards</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">{callCards.length} cards</span>
              </div>
              <button onClick={() => setShowCallForm(v => !v)}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all">
                <Plus className="w-3.5 h-3.5" /> New Card
              </button>
            </div>

            <AnimatePresence>
              {showCallForm && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden">
                  <div className="pt-1 space-y-3 border-t border-white/10">
                    <p className="text-xs text-muted-foreground pt-2">Fill client/owner details for quick reference during calls</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Client / Owner Name *</label>
                        <input value={callForm.clientName} onChange={e => setCallForm(f => ({...f, clientName: e.target.value}))}
                          placeholder="e.g. Ramesh Patel" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                        <input value={callForm.phone} onChange={e => setCallForm(f => ({...f, phone: e.target.value}))}
                          placeholder="+91 98765 43210" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Alt Phone</label>
                        <input value={callForm.altPhone} onChange={e => setCallForm(f => ({...f, altPhone: e.target.value}))}
                          placeholder="Optional" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Property / Project</label>
                        <input value={callForm.propertyTitle} onChange={e => setCallForm(f => ({...f, propertyTitle: e.target.value}))}
                          placeholder="e.g. 3BHK Apartment, SG Highway" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Budget</label>
                        <input value={callForm.budget} onChange={e => setCallForm(f => ({...f, budget: e.target.value}))}
                          placeholder="e.g. ₹50L–₹80L" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Locality / Area</label>
                        <input value={callForm.locality} onChange={e => setCallForm(f => ({...f, locality: e.target.value}))}
                          placeholder="e.g. Bopal, Satellite" className={inputCls} />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                        <select value={callForm.category} onChange={e => setCallForm(f => ({...f, category: e.target.value}))} className={inputCls}>
                          <option value="">— Select —</option>
                          {["Buyer","Seller","Tenant","Owner","Investor"].map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Quick Notes</label>
                        <input value={callForm.notes} onChange={e => setCallForm(f => ({...f, notes: e.target.value}))}
                          placeholder="e.g. Interested in corner flat" className={inputCls} />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveCallCard} disabled={!callForm.clientName.trim() || !callForm.phone.trim() || callSaving}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 disabled:opacity-40 transition-all">
                        {callSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Save Card
                      </button>
                      <button onClick={() => setShowCallForm(false)} className="px-4 py-2 text-xs text-muted-foreground hover:text-white border border-white/10 rounded-xl">Cancel</button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {callCards.length === 0 ? (
              <div className="text-center py-5 text-muted-foreground text-sm">No call cards yet — add one before your next call!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {callCards.map(card => {
                  let d: any = {};
                  try { d = JSON.parse(card.content); } catch {}
                  return (
                    <div key={card.id}
                      className="rounded-2xl p-4 space-y-3"
                      style={{ background: "linear-gradient(135deg,rgba(16,185,129,0.08),rgba(16,185,129,0.03))", border: "1.5px solid rgba(16,185,129,0.25)" }}>
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base">👤</span>
                            <span className="text-sm font-bold text-white">{d.clientName}</span>
                            {d.category && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-300 border border-blue-500/20">{d.category}</span>
                            )}
                          </div>
                        </div>
                        <button onClick={() => deleteCallCard(card.id)} className="p-1 rounded-lg hover:bg-red-500/15 text-muted-foreground hover:text-red-400 transition-all flex-shrink-0">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {/* Phone numbers */}
                      <div className="flex flex-wrap gap-2">
                        <a href={`tel:${d.phone}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 hover:bg-emerald-500/25 transition-all">
                          📞 {d.phone}
                        </a>
                        {d.altPhone && (
                          <a href={`tel:${d.altPhone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/8 text-muted-foreground border border-white/10 hover:text-white transition-all">
                            📞 {d.altPhone}
                          </a>
                        )}
                        <a href={`https://wa.me/${d.phone?.replace(/\D/g,"")}`} target="_blank" rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-green-600/15 text-green-400 border border-green-500/25 hover:bg-green-600/25 transition-all">
                          💬 WhatsApp
                        </a>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {d.propertyTitle && (
                          <div className="col-span-2 flex items-start gap-1.5">
                            <span className="text-muted-foreground flex-shrink-0">🏠</span>
                            <span className="text-white font-medium">{d.propertyTitle}</span>
                          </div>
                        )}
                        {d.budget && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">💰</span>
                            <span className="text-gold-300 font-semibold">{d.budget}</span>
                          </div>
                        )}
                        {d.locality && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-muted-foreground">📍</span>
                            <span className="text-white">{d.locality}</span>
                          </div>
                        )}
                        {d.notes && (
                          <div className="col-span-2 flex items-start gap-1.5 p-2 rounded-lg bg-white/5">
                            <span className="text-muted-foreground flex-shrink-0">📝</span>
                            <span className="text-muted-foreground">{d.notes}</span>
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground opacity-50">
                        Added {new Date(card.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── divider ── */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-xs text-muted-foreground">Personal Sticky Notes</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Add new note */}
          <div className="glass-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <StickyNote className="w-4 h-4 text-yellow-400" />
              <span className="text-sm font-semibold text-white">Sticky Notes</span>
              <span className="text-xs text-muted-foreground ml-auto">{stickyNotes.length} notes</span>
            </div>

            {/* Color picker */}
            <div className="flex gap-2">
              {[
                { val: "yellow", bg: "#fef08a", border: "#eab308" },
                { val: "blue",   bg: "#bfdbfe", border: "#3b82f6" },
                { val: "green",  bg: "#bbf7d0", border: "#22c55e" },
                { val: "pink",   bg: "#fbcfe8", border: "#ec4899" },
                { val: "purple", bg: "#e9d5ff", border: "#a855f7" },
              ].map(c => (
                <button key={c.val} type="button"
                  onClick={() => setNoteColor(c.val)}
                  className="w-7 h-7 rounded-full transition-all"
                  style={{
                    background: c.bg,
                    border: noteColor === c.val ? `3px solid ${c.border}` : "2px solid transparent",
                    transform: noteColor === c.val ? "scale(1.2)" : "scale(1)",
                  }} />
              ))}
            </div>

            <textarea
              rows={3}
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && e.ctrlKey) {
                  e.preventDefault();
                  if (noteText.trim()) saveNote();
                }
              }}
              placeholder="Write your note here... (Ctrl+Enter to save)"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50 resize-none"
            />
            <button
              onClick={saveNote}
              disabled={!noteText.trim() || notesSaving}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#1e3a5f,#eab308)", color: "#fff" }}>
              {notesSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add Note
            </button>
          </div>

          {/* Notes grid */}
          {stickyNotes.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <StickyNote className="w-12 h-12 mx-auto mb-3 opacity-20" />
              <p className="text-muted-foreground text-sm">No notes yet. Add your first sticky note!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {stickyNotes.map(note => {
                const colors: Record<string, { bg: string; border: string; text: string }> = {
                  yellow: { bg: "#fef9c3", border: "#eab308", text: "#713f12" },
                  blue:   { bg: "#dbeafe", border: "#3b82f6", text: "#1e3a8a" },
                  green:  { bg: "#dcfce7", border: "#22c55e", text: "#14532d" },
                  pink:   { bg: "#fce7f3", border: "#ec4899", text: "#831843" },
                  purple: { bg: "#f3e8ff", border: "#a855f7", text: "#581c87" },
                };
                const c = colors[note.color] || colors.yellow;
                const isEditing = editingId === note.id;

                return (
                  <div key={note.id}
                    className="rounded-2xl p-4 flex flex-col gap-2 shadow-lg transition-transform hover:scale-[1.01]"
                    style={{ background: c.bg, border: `2px solid ${c.border}` }}>

                    {/* Pin badge */}
                    {note.isPinned && (
                      <div className="flex items-center gap-1 text-xs font-bold" style={{ color: c.border }}>
                        <Pin className="w-3 h-3" /> Pinned
                      </div>
                    )}

                    {isEditing ? (
                      <textarea
                        rows={4}
                        value={editText}
                        onChange={e => setEditText(e.target.value)}
                        autoFocus
                        className="w-full bg-white/60 rounded-lg px-2 py-1.5 text-sm resize-none focus:outline-none"
                        style={{ color: c.text }}
                      />
                    ) : (
                      <p className="text-sm whitespace-pre-wrap flex-1" style={{ color: c.text }}>
                        {note.content}
                      </p>
                    )}

                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs opacity-50" style={{ color: c.text }}>
                        {new Date(note.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                      </span>
                      <div className="flex gap-1.5">
                        {isEditing ? (
                          <>
                            <button onClick={() => saveEdit(note.id)}
                              className="text-xs px-2 py-1 rounded-lg bg-white/60 font-semibold" style={{ color: c.border }}>
                              Save
                            </button>
                            <button onClick={() => setEditingId(null)}
                              className="text-xs px-2 py-1 rounded-lg bg-white/40" style={{ color: c.text }}>
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button onClick={() => togglePin(note)}
                              title={note.isPinned ? "Unpin" : "Pin"}
                              className="p-1.5 rounded-lg bg-white/40 hover:bg-white/60 transition-all">
                              {note.isPinned
                                ? <PinOff className="w-3.5 h-3.5" style={{ color: c.border }} />
                                : <Pin    className="w-3.5 h-3.5" style={{ color: c.border }} />}
                            </button>
                            <button onClick={() => { setEditingId(note.id); setEditText(note.content); }}
                              className="p-1.5 rounded-lg bg-white/40 hover:bg-white/60 transition-all">
                              <span className="text-xs" style={{ color: c.text }}>✏️</span>
                            </button>
                            <button onClick={() => deleteNote(note.id)}
                              className="p-1.5 rounded-lg bg-white/40 hover:bg-red-100 transition-all">
                              <Trash2 className="w-3.5 h-3.5 text-red-500" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
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
