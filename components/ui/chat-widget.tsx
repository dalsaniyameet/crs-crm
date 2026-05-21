"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  MessageCircle, X, Send, Paperclip, ArrowLeft,
  Loader2, File, Image as ImageIcon, Download,
  Megaphone, Users, CheckCircle, Trash2,
} from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

interface ChatUser { id: string; name: string; avatar?: string; role: string; }
interface Room     { id: string; name: string; avatar?: string; role?: string; otherId?: string; lastMsg?: string; lastTime?: string; }
interface Msg      { id: string; senderId: string; text?: string; fileUrl?: string; fileName?: string; fileType?: string; createdAt: string; sender: { id: string; name: string; avatar?: string }; }
interface UpFile   { url: string; name: string; type: string; }

function Avatar({ name, src, size = 32 }: { name: string; src?: string; size?: number }) {
  if (src) return (
    <div className="rounded-full overflow-hidden flex-shrink-0" style={{ width: size, height: size }}>
      <Image src={src} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
    </div>
  );
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.35, background: "linear-gradient(135deg,#1e3a5f,#eab308)" }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "text-red-400", BROKER: "text-yellow-400",
  SALES_MANAGER: "text-purple-400", MARKETING: "text-green-400",
};

type Tab = "chats" | "broadcast";

export default function ChatWidget() {
  const { user, isLoaded } = useUser();
  const role = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SALES_MANAGER";

  const [open, setOpen]             = useState(false);
  const [tab, setTab]               = useState<Tab>("chats");
  const [view, setView]             = useState<"list" | "chat">("list");
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [users, setUsers]           = useState<ChatUser[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages]     = useState<Msg[]>([]);
  const [text, setText]             = useState("");
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(false);

  // Multiple files state
  const [files, setFiles]           = useState<UpFile[]>([]);
  const [uploading, setUploading]   = useState(false);

  // Broadcast state
  const [bcText, setBcText]         = useState("");
  const [bcFiles, setBcFiles]       = useState<UpFile[]>([]);
  const [bcUploading, setBcUploading] = useState(false);
  const [bcSending, setBcSending]   = useState(false);
  const [bcDone, setBcDone]         = useState<{ employees: number } | null>(null);

  const bottomRef  = useRef<HTMLDivElement>(null);
  const fileRef    = useRef<HTMLInputElement>(null);
  const bcFileRef  = useRef<HTMLInputElement>(null);
  const pollRef    = useRef<NodeJS.Timeout>();
  const myId       = useRef("");

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) myId.current = d.id; }).catch(() => {});
  }, [isLoaded, user]);

  const loadRooms = useCallback(async () => {
    try {
      const [r, u] = await Promise.all([
        fetch("/api/chat/rooms").then(r => r.json()),
        fetch("/api/brokers").then(r => r.json()),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch {}
  }, []);

  useEffect(() => { if (open) loadRooms(); }, [open, loadRooms]);

  const loadMessages = useCallback(async (roomId: string) => {
    setLoading(true);
    try {
      const data = await fetch(`/api/chat/rooms/${roomId}/messages`).then(r => r.json());
      setMessages(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (view === "chat" && activeRoom) {
      loadMessages(activeRoom.id);
      pollRef.current = setInterval(() => loadMessages(activeRoom.id), 4000);
    }
    return () => clearInterval(pollRef.current);
  }, [view, activeRoom, loadMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Upload multiple files ──
  const uploadFiles = async (rawFiles: FileList, setter: (f: UpFile[]) => void, loadingSetter: (b: boolean) => void) => {
    loadingSetter(true);
    try {
      const fd = new FormData();
      Array.from(rawFiles).forEach(f => fd.append("file", f));
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      const uploaded: UpFile[] = data.urls ?? (data.url ? [{ url: data.url, name: rawFiles[0].name, type: rawFiles[0].type }] : []);
      setter(prev => [...prev, ...uploaded]);
    } catch { toast.error("Upload failed"); }
    loadingSetter(false);
  };

  const openChat = async (u: ChatUser) => {
    const res  = await fetch("/api/chat/rooms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: u.id }),
    });
    const room = await res.json();
    setActiveRoom({ id: room.id, name: u.name, avatar: u.avatar, role: u.role, otherId: u.id });
    setView("chat");
  };

  const sendMessage = async () => {
    if (!activeRoom || (!text.trim() && files.length === 0)) return;
    setSending(true);
    try {
      // Send text
      if (text.trim()) {
        const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
        const msg = await res.json();
        if (res.ok) setMessages(prev => [...prev, msg]);
      }
      // Send each file as separate message
      for (const f of files) {
        const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: f.url, fileName: f.name, fileType: f.type }),
        });
        const msg = await res.json();
        if (res.ok) setMessages(prev => [...prev, msg]);
      }
      setText("");
      setFiles([]);
    } catch { toast.error("Failed to send"); }
    setSending(false);
  };

  // ── Broadcast to all employees ──
  const sendBroadcast = async () => {
    if (!bcText.trim() && bcFiles.length === 0) { toast.error("Write a message or attach files"); return; }
    setBcSending(true);
    try {
      const res  = await fetch("/api/chat/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: bcText.trim() || undefined, files: bcFiles }),
      });
      const data = await res.json();
      if (res.ok) {
        setBcDone({ employees: data.employees });
        setBcText("");
        setBcFiles([]);
        toast.success(`Sent to ${data.employees} employees!`);
      } else {
        toast.error(data.error || "Failed");
      }
    } catch { toast.error("Network error"); }
    setBcSending(false);
  };

  const allUsers   = users.filter(u => u.id !== myId.current);
  const roomIds    = new Set(rooms.map(r => r.otherId));
  const newUsers   = allUsers.filter(u => !roomIds.has(u.id));

  if (!isLoaded || !user) return null;

  return (
    <>
      {/* Floating button */}
      <motion.button
        onClick={() => setOpen(!open)}
        whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-[998] w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: "linear-gradient(135deg,#1e3a5f,#eab308)", boxShadow: "0 0 24px rgba(234,179,8,0.4)" }}
      >
        <AnimatePresence mode="wait">
          {open
            ? <motion.div key="x"   initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}><X className="w-6 h-6 text-white" /></motion.div>
            : <motion.div key="msg" initial={{ rotate: 90, opacity: 0 }}  animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}><MessageCircle className="w-6 h-6 text-white" /></motion.div>
          }
        </AnimatePresence>
      </motion.button>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0,  scale: 1 }}
            exit={{   opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="fixed bottom-24 right-6 z-[997] w-80 rounded-2xl overflow-hidden flex flex-col"
            style={{ height: 500, background: "#060c18", border: "1px solid rgba(234,179,8,0.2)", boxShadow: "0 24px 64px rgba(0,0,0,0.7)" }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b flex-shrink-0"
              style={{ borderColor: "rgba(234,179,8,0.1)", background: "rgba(10,22,40,0.95)" }}>
              {view === "chat"
                ? <button onClick={() => { setView("list"); setActiveRoom(null); setMessages([]); setFiles([]); }}
                    className="text-muted-foreground hover:text-white transition-colors flex-shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                : <MessageCircle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
              }

              {view === "chat" && activeRoom ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Avatar name={activeRoom.name} src={activeRoom.avatar} size={26} />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-white truncate">{activeRoom.name}</div>
                    <div className={`text-[10px] ${ROLE_COLOR[activeRoom.role || ""] || "text-muted-foreground"}`}>
                      {activeRoom.role?.replace("_", " ")}
                    </div>
                  </div>
                </div>
              ) : (
                <span className="text-sm font-semibold text-white flex-1">Team Chat</span>
              )}
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            </div>

            {/* Tabs — only on list view */}
            {view === "list" && isAdmin && (
              <div className="flex border-b flex-shrink-0" style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                {(["chats", "broadcast"] as Tab[]).map(t => (
                  <button key={t} onClick={() => { setTab(t); setBcDone(null); }}
                    className={`flex-1 py-2 text-xs font-medium flex items-center justify-center gap-1.5 transition-colors ${
                      tab === t ? "text-yellow-400 border-b-2 border-yellow-400" : "text-muted-foreground hover:text-white"
                    }`}>
                    {t === "chats" ? <><Users className="w-3 h-3" /> Chats</> : <><Megaphone className="w-3 h-3" /> Broadcast</>}
                  </button>
                ))}
              </div>
            )}

            {/* Body */}
            <div className="flex-1 overflow-hidden flex flex-col">

              {/* ── BROADCAST TAB ── */}
              {view === "list" && tab === "broadcast" && isAdmin && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {bcDone ? (
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="flex flex-col items-center justify-center h-full gap-3 text-center">
                      <CheckCircle className="w-12 h-12 text-emerald-400" />
                      <div className="text-white font-semibold">Broadcast Sent!</div>
                      <div className="text-sm text-muted-foreground">Delivered to {bcDone.employees} employees</div>
                      <button onClick={() => setBcDone(null)}
                        className="mt-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors">
                        Send Another
                      </button>
                    </motion.div>
                  ) : (
                    <>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1.5 block">Message to all employees</label>
                        <textarea
                          rows={4}
                          value={bcText}
                          onChange={e => setBcText(e.target.value)}
                          placeholder="Type announcement, update, or info..."
                          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50 resize-none"
                        />
                      </div>

                      {/* Attached files preview */}
                      {bcFiles.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-xs text-muted-foreground">{bcFiles.length} file{bcFiles.length > 1 ? "s" : ""} attached</div>
                          {bcFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                              {f.type.startsWith("image/")
                                ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                : <File className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                              <span className="text-xs text-white truncate flex-1">{f.name}</span>
                              <button onClick={() => setBcFiles(prev => prev.filter((_, j) => j !== i))}
                                className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Attach + Send */}
                      <div className="flex gap-2">
                        <input type="file" ref={bcFileRef} multiple className="hidden"
                          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
                          onChange={e => e.target.files && uploadFiles(e.target.files, setBcFiles, setBcUploading)} />
                        <button onClick={() => bcFileRef.current?.click()} disabled={bcUploading}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-yellow-400 hover:border-yellow-500/30 transition-all disabled:opacity-50">
                          {bcUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                          {bcUploading ? "Uploading..." : "Attach Files"}
                        </button>
                        <button onClick={sendBroadcast} disabled={bcSending || bcUploading || (!bcText.trim() && bcFiles.length === 0)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all disabled:opacity-40"
                          style={{ background: "linear-gradient(135deg,#1e3a5f,#eab308)" }}>
                          {bcSending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <><Megaphone className="w-3.5 h-3.5 text-white" /><span className="text-white">Send to All</span></>}
                        </button>
                      </div>

                      <p className="text-[10px] text-muted-foreground text-center">
                        Message will be sent to all active employees individually
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* ── CHATS LIST ── */}
              {view === "list" && (tab === "chats" || !isAdmin) && (
                <div className="flex-1 overflow-y-auto">
                  {rooms.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wide sticky top-0"
                        style={{ background: "#060c18" }}>Recent</div>
                      {rooms.map(r => (
                        <button key={r.id} onClick={() => { setActiveRoom(r); setView("chat"); }}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                          <Avatar name={r.name} src={r.avatar} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-white truncate">{r.name}</span>
                              {r.lastTime && <span className="text-[10px] text-muted-foreground ml-1 flex-shrink-0">{timeAgo(r.lastTime)}</span>}
                            </div>
                            <div className="text-xs text-muted-foreground truncate">{r.lastMsg || "Start a conversation"}</div>
                          </div>
                        </button>
                      ))}
                    </>
                  )}

                  {newUsers.length > 0 && (
                    <>
                      <div className="px-4 py-2 text-[10px] text-muted-foreground font-medium uppercase tracking-wide sticky top-0"
                        style={{ background: "#060c18" }}>All Members</div>
                      {newUsers.map(u => (
                        <button key={u.id} onClick={() => openChat(u)}
                          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left">
                          <Avatar name={u.name} src={u.avatar} size={36} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-white truncate">{u.name}</div>
                            <div className={`text-xs ${ROLE_COLOR[u.role] || "text-muted-foreground"}`}>{u.role?.replace("_", " ")}</div>
                          </div>
                          <MessageCircle className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                        </button>
                      ))}
                    </>
                  )}

                  {allUsers.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm">
                      <Users className="w-8 h-8 mb-2 opacity-20" />
                      No team members yet
                    </div>
                  )}
                </div>
              )}

              {/* ── MESSAGES ── */}
              {view === "chat" && (
                <>
                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                    {loading
                      ? <div className="flex items-center justify-center h-full"><Loader2 className="w-6 h-6 text-yellow-400 animate-spin" /></div>
                      : messages.length === 0
                        ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-xs gap-2">
                            <MessageCircle className="w-8 h-8 opacity-20" />Say hello! 👋
                          </div>
                        : messages.map(m => {
                            const isMe = m.senderId === myId.current;
                            return (
                              <div key={m.id} className={`flex items-end gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
                                {!isMe && <Avatar name={m.sender.name} src={m.sender.avatar} size={22} />}
                                <div className={`max-w-[78%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                                  {m.fileUrl ? (
                                    <a href={m.fileUrl} target="_blank" rel="noreferrer"
                                      className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
                                      style={{ background: isMe ? "rgba(234,179,8,0.15)" : "rgba(30,58,95,0.6)", border: "1px solid rgba(255,255,255,0.08)" }}>
                                      {m.fileType?.startsWith("image/")
                                        ? <ImageIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                                        : <File className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
                                      <span className="text-white truncate max-w-[110px]">{m.fileName}</span>
                                      <Download className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    </a>
                                  ) : (
                                    <div className="px-3 py-2 rounded-xl text-xs text-white leading-relaxed"
                                      style={{ background: isMe ? "linear-gradient(135deg,#1e3a5f,rgba(234,179,8,0.2))" : "rgba(30,58,95,0.6)", border: `1px solid ${isMe ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.06)"}` }}>
                                      {m.text}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-muted-foreground px-1">{timeAgo(m.createdAt)}</span>
                                </div>
                              </div>
                            );
                          })
                    }
                    <div ref={bottomRef} />
                  </div>

                  {/* File previews */}
                  {files.length > 0 && (
                    <div className="px-3 pb-1 flex flex-wrap gap-1.5">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-white/5 border border-white/10 text-xs">
                          {f.type.startsWith("image/") ? <ImageIcon className="w-3 h-3 text-blue-400" /> : <File className="w-3 h-3 text-yellow-400" />}
                          <span className="text-white max-w-[80px] truncate">{f.name}</span>
                          <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Input */}
                  <div className="px-3 py-3 border-t flex-shrink-0" style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                    <div className="flex items-center gap-2">
                      <input type="file" ref={fileRef} multiple className="hidden"
                        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                        onChange={e => e.target.files && uploadFiles(e.target.files, setFiles, setUploading)} />
                      <button onClick={() => fileRef.current?.click()} disabled={uploading}
                        className="text-muted-foreground hover:text-yellow-400 transition-colors flex-shrink-0 disabled:opacity-50">
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                      </button>
                      <input value={text} onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50" />
                      <button onClick={sendMessage} disabled={sending || uploading || (!text.trim() && files.length === 0)}
                        className="flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
                        style={{ background: (text.trim() || files.length > 0) ? "linear-gradient(135deg,#1e3a5f,#eab308)" : "rgba(255,255,255,0.05)" }}>
                        {sending ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" /> : <Send className="w-3.5 h-3.5 text-white" />}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
