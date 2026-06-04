"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import toast from "react-hot-toast";
import { MessageCircle, Send, Loader2, ArrowLeft, Megaphone, Users, CheckCircle, Paperclip, File, Download, X, Trash2, Check } from "lucide-react";

interface Room { id: string; name: string; avatar?: string; role?: string; otherId?: string; lastMsg?: string; lastTime?: string; lastMsgSenderId?: string; unread: number; }
interface Msg  { id: string; senderId: string; text?: string; fileUrl?: string; fileName?: string; fileType?: string; createdAt: string; isRead: boolean; sender: { id: string; name: string; avatar?: string }; }
interface UpFile { url: string; name: string; type: string; }

const ROLE_COLOR: Record<string, string> = {
  ADMIN: "text-red-400", BROKER: "text-yellow-400",
  SALES_MANAGER: "text-purple-400", MARKETING: "text-green-400",
};

function timeAgo(d: string) {
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Avatar({ name, src, size = 36 }: { name: string; src?: string; size?: number }) {
  if (src) return (
    <div className="rounded-full overflow-hidden flex-shrink-0 border border-white/10" style={{ width: size, height: size }}>
      <Image src={src} alt={name} width={size} height={size} className="object-cover w-full h-full" unoptimized />
    </div>
  );
  return (
    <div className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: "linear-gradient(135deg,#1e3a5f,#eab308)" }}>
      {name?.[0]?.toUpperCase()}
    </div>
  );
}

// WhatsApp-style tick
function MsgTick({ isMe, isRead }: { isMe: boolean; isRead: boolean }) {
  if (!isMe) return null;
  return (
    <span className={`inline-flex items-center ml-1 ${isRead ? "text-blue-400" : "text-muted-foreground"}`}>
      <Check className="w-3 h-3 -mr-1.5" />
      <Check className="w-3 h-3" />
    </span>
  );
}

type Tab = "chats" | "broadcast";

export default function TeamChatPage() {
  const { user, isLoaded } = useUser();
  const role    = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase();
  const isAdmin = role === "ADMIN" || role === "SALES_MANAGER";

  const [tab, setTab]               = useState<Tab>("chats");
  const [view, setView]             = useState<"list" | "chat">("list");
  const [rooms, setRooms]           = useState<Room[]>([]);
  const [users, setUsers]           = useState<any[]>([]);
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [messages, setMessages]     = useState<Msg[]>([]);
  const [text, setText]             = useState("");
  const [sending, setSending]       = useState(false);
  const [loading, setLoading]       = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [files, setFiles]           = useState<UpFile[]>([]);
  const [uploading, setUploading]   = useState(false);
  const [bcText, setBcText]         = useState("");
  const [bcFiles, setBcFiles]       = useState<UpFile[]>([]);
  const [bcUploading, setBcUploading] = useState(false);
  const [bcSending, setBcSending]   = useState(false);
  const [bcDone, setBcDone]         = useState<{ employees: number } | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const bcFileRef = useRef<HTMLInputElement>(null);
  const pollRef   = useRef<NodeJS.Timeout>();
  const myId      = useRef("");

  useEffect(() => {
    if (!isLoaded || !user) return;
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.id) myId.current = d.id; }).catch(() => {});
  }, [isLoaded, user]);

  const loadRooms = useCallback(async () => {
    setRoomsLoading(true);
    try {
      const [r, u] = await Promise.all([
        fetch("/api/chat/rooms").then(r => r.json()),
        fetch("/api/brokers").then(r => r.json()),
      ]);
      setRooms(Array.isArray(r) ? r : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch {}
    setRoomsLoading(false);
  }, []);

  useEffect(() => { loadRooms(); }, [loadRooms]);

  const lastMsgId = useRef<string>("");

  const loadMessages = useCallback(async (roomId: string, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetch(`/api/chat/rooms/${roomId}/messages`).then(r => r.json());
      if (Array.isArray(data)) {
        const lastId = data[data.length - 1]?.id ?? "";
        if (!silent || lastId !== lastMsgId.current) {
          lastMsgId.current = lastId;
          setMessages(data);
          // refresh rooms to update unread counts
          if (silent) loadRooms();
        }
      }
    } catch {}
    if (!silent) setLoading(false);
  }, [loadRooms]);

  useEffect(() => {
    if (view === "chat" && activeRoom) {
      lastMsgId.current = "";
      loadMessages(activeRoom.id);
      pollRef.current = setInterval(() => loadMessages(activeRoom.id, true), 3000);
    }
    return () => clearInterval(pollRef.current);
  }, [view, activeRoom, loadMessages]);

  useEffect(() => {
    if (messages.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Poll rooms list for unread badges
  useEffect(() => {
    if (view !== "list") return;
    const id = setInterval(loadRooms, 5000);
    return () => clearInterval(id);
  }, [view, loadRooms]);

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

  const openChat = async (u: any) => {
    const res  = await fetch("/api/chat/rooms", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetUserId: u.id }),
    });
    const room = await res.json();
    const roomWithMeta: Room = { id: room.id, name: u.name, avatar: u.avatar, role: u.role, otherId: u.id, unread: 0 };
    setActiveRoom(roomWithMeta);
    setView("chat");
  };

  const openExistingChat = (r: Room) => {
    setActiveRoom(r);
    setView("chat");
    // clear unread locally immediately
    setRooms(prev => prev.map(x => x.id === r.id ? { ...x, unread: 0 } : x));
  };

  const sendMessage = async () => {
    if (!activeRoom || (!text.trim() && files.length === 0)) return;
    setSending(true);
    try {
      if (text.trim()) {
        const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        });
        const msg = await res.json();
        if (res.ok) setMessages(prev => [...prev, msg]);
      }
      for (const f of files) {
        const res = await fetch(`/api/chat/rooms/${activeRoom.id}/messages`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl: f.url, fileName: f.name, fileType: f.type }),
        });
        const msg = await res.json();
        if (res.ok) setMessages(prev => [...prev, msg]);
      }
      setText(""); setFiles([]);
    } catch { toast.error("Failed to send"); }
    setSending(false);
  };

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
        setBcText(""); setBcFiles([]);
        toast.success(`Sent to ${data.employees} employees!`);
      } else toast.error(data.error || "Failed");
    } catch { toast.error("Network error"); }
    setBcSending(false);
  };

  const totalUnread = rooms.reduce((s, r) => s + (r.unread || 0), 0);
  const allUsers    = users.filter(u => u.id !== myId.current);
  const roomIds     = new Set(rooms.map(r => r.otherId));
  const newUsers    = allUsers.filter(u => !roomIds.has(u.id));
  const adminUsers  = newUsers.filter(u => u.role === "ADMIN" || u.role === "SALES_MANAGER");
  const otherUsers  = newUsers.filter(u => u.role !== "ADMIN" && u.role !== "SALES_MANAGER");

  if (!isLoaded) return (
    <div className="flex items-center justify-center h-full min-h-64">
      <Loader2 className="w-7 h-7 animate-spin text-estate-400" />
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]" style={{ background: "#04080f" }}>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: "rgba(234,179,8,0.1)", background: "rgba(6,12,24,0.95)" }}>
        {view === "chat" && (
          <button onClick={() => { setView("list"); setActiveRoom(null); setMessages([]); setFiles([]); loadRooms(); }}
            className="p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        {view === "chat" && activeRoom ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar name={activeRoom.name} src={activeRoom.avatar} size={38} />
            <div className="min-w-0">
              <div className="font-semibold text-white text-sm">{activeRoom.name}</div>
              {activeRoom.role && (
                <div className={`text-xs ${ROLE_COLOR[activeRoom.role] || "text-muted-foreground"}`}>
                  {activeRoom.role.replace("_", " ")}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1">
            <MessageCircle className="w-5 h-5 text-yellow-400" />
            <span className="font-bold text-white text-lg">Team Chat</span>
            {totalUnread > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-red-500 text-white font-bold">{totalUnread}</span>
            )}
          </div>
        )}
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Tabs */}
        {view === "list" && isAdmin && (
          <div className="flex border-b flex-shrink-0" style={{ borderColor: "rgba(255,255,255,0.07)" }}>
            {(["chats", "broadcast"] as Tab[]).map(t => (
              <button key={t} onClick={() => { setTab(t); setBcDone(null); }}
                className={`flex-1 py-3 text-sm font-medium flex items-center justify-center gap-2 transition-colors ${
                  tab === t ? "text-yellow-400 border-b-2 border-yellow-400" : "text-muted-foreground hover:text-white"
                }`}>
                {t === "chats"
                  ? <><Users className="w-4 h-4" /> Chats {totalUnread > 0 && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-500 text-white">{totalUnread}</span>}</>
                  : <><Megaphone className="w-4 h-4" /> Broadcast</>}
              </button>
            ))}
          </div>
        )}

        {/* ── BROADCAST ── */}
        {view === "list" && tab === "broadcast" && isAdmin && (
          <div className="flex-1 overflow-y-auto p-6">
            {bcDone ? (
              <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
                <CheckCircle className="w-16 h-16 text-emerald-400" />
                <div className="text-xl font-bold text-white">Broadcast Sent!</div>
                <div className="text-sm text-muted-foreground">Delivered to {bcDone.employees} employees</div>
                <button onClick={() => setBcDone(null)} className="mt-2 px-6 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-white hover:bg-white/10 transition-colors">
                  Send Another
                </button>
              </div>
            ) : (
              <div className="max-w-xl space-y-4">
                <label className="text-sm text-muted-foreground mb-2 block">Message to all employees</label>
                <textarea rows={5} value={bcText} onChange={e => setBcText(e.target.value)}
                  placeholder="Type announcement, update, or info..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/50 resize-none" />
                {bcFiles.length > 0 && (
                  <div className="space-y-2">
                    {bcFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                        <File className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                        <span className="text-sm text-white truncate flex-1">{f.name}</span>
                        <button onClick={() => setBcFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex gap-3">
                  <input type="file" ref={bcFileRef} multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                    onChange={e => e.target.files && uploadFiles(e.target.files, setBcFiles, setBcUploading)} />
                  <button onClick={() => bcFileRef.current?.click()} disabled={bcUploading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-yellow-400 hover:border-yellow-500/30 transition-all disabled:opacity-50">
                    {bcUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                    {bcUploading ? "Uploading..." : "Attach"}
                  </button>
                  <button onClick={sendBroadcast} disabled={bcSending || bcUploading || (!bcText.trim() && bcFiles.length === 0)}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#1e3a5f,#eab308)" }}>
                    {bcSending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <><Megaphone className="w-4 h-4 text-white" /><span className="text-white">Send to All</span></>}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CHAT LIST ── */}
        {view === "list" && (tab === "chats" || !isAdmin) && (
          <div className="flex-1 overflow-y-auto">
            {roomsLoading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="w-7 h-7 animate-spin text-estate-400" /></div>
            ) : (
              <>
                {rooms.length > 0 && (
                  <>
                    <div className="px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                      Recent Chats
                    </div>
                    {rooms.map(r => (
                      <button key={r.id} onClick={() => openExistingChat(r)}
                        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b"
                        style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                        <div className="relative flex-shrink-0">
                          <Avatar name={r.name} src={r.avatar} size={44} />
                          {r.unread > 0 && (
                            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                              {r.unread > 9 ? "9+" : r.unread}
                            </span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className={`text-sm font-semibold ${r.unread > 0 ? "text-white" : "text-white/80"}`}>{r.name}</span>
                            {r.lastTime && <span className={`text-xs flex-shrink-0 ml-2 ${r.unread > 0 ? "text-emerald-400" : "text-muted-foreground"}`}>{timeAgo(r.lastTime)}</span>}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            {r.lastMsgSenderId === myId.current && (
                              <span className="text-muted-foreground flex-shrink-0">
                                <Check className="w-3 h-3 inline -mr-1.5" />
                                <Check className="w-3 h-3 inline" />
                              </span>
                            )}
                            <span className={`text-xs truncate ${r.unread > 0 ? "text-white font-medium" : "text-muted-foreground"}`}>
                              {r.lastMsg || "Start a conversation"}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}

                {newUsers.length > 0 && (
                  <>
                    {adminUsers.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b flex items-center gap-2" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                          <span className="w-2 h-2 rounded-full bg-red-400" /> Admin & Managers
                        </div>
                        {adminUsers.map(u => (
                          <button key={u.id} onClick={() => openChat(u)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b"
                            style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                            <Avatar name={u.name} src={u.avatar} size={44} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white">{u.name}</div>
                              <div className={`text-xs mt-0.5 ${ROLE_COLOR[u.role] || "text-muted-foreground"}`}>{u.role?.replace("_", " ")}</div>
                            </div>
                            <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                    {otherUsers.length > 0 && (
                      <>
                        <div className="px-4 py-2 text-xs text-muted-foreground font-medium uppercase tracking-wide border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
                          Team Members
                        </div>
                        {otherUsers.map(u => (
                          <button key={u.id} onClick={() => openChat(u)}
                            className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-white/5 transition-colors text-left border-b"
                            style={{ borderColor: "rgba(255,255,255,0.04)" }}>
                            <Avatar name={u.name} src={u.avatar} size={44} />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-semibold text-white">{u.name}</div>
                              <div className={`text-xs mt-0.5 ${ROLE_COLOR[u.role] || "text-muted-foreground"}`}>{u.role?.replace("_", " ")}</div>
                            </div>
                            <MessageCircle className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          </button>
                        ))}
                      </>
                    )}
                  </>
                )}

                {allUsers.length === 0 && rooms.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 text-muted-foreground text-sm gap-2">
                    <Users className="w-10 h-10 opacity-20" /> No team members yet
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── MESSAGES ── */}
        {view === "chat" && (
          <>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1 min-h-0">
              {loading
                ? <div className="flex items-center justify-center h-full"><Loader2 className="w-7 h-7 text-yellow-400 animate-spin" /></div>
                : messages.length === 0
                  ? <div className="flex flex-col items-center justify-center h-full text-muted-foreground text-sm gap-2">
                      <MessageCircle className="w-10 h-10 opacity-20" /> Say hello! 👋
                    </div>
                  : messages.map((m, idx) => {
                      const isMe   = m.senderId === myId.current;
                      const prevMsg = messages[idx - 1];
                      const showName = !isMe && (!prevMsg || prevMsg.senderId !== m.senderId);
                      const showTime = !messages[idx + 1] || messages[idx + 1].senderId !== m.senderId ||
                        new Date(messages[idx + 1].createdAt).getTime() - new Date(m.createdAt).getTime() > 5 * 60000;

                      return (
                        <div key={m.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : ""} ${showTime ? "mb-2" : "mb-0.5"}`}>
                          {!isMe && showTime && <Avatar name={m.sender.name} src={m.sender.avatar} size={26} />}
                          {!isMe && !showTime && <div style={{ width: 26 }} />}
                          <div className={`max-w-[72%] flex flex-col gap-0.5 ${isMe ? "items-end" : "items-start"}`}>
                            {showName && <span className="text-xs text-muted-foreground px-1">{m.sender.name}</span>}
                            {m.fileUrl ? (
                              <a href={m.fileUrl} target="_blank" rel="noreferrer"
                                className="flex items-center gap-2 px-3 py-2 rounded-2xl text-sm"
                                style={{ background: isMe ? "rgba(234,179,8,0.18)" : "rgba(30,58,95,0.7)", border: "1px solid rgba(255,255,255,0.07)" }}>
                                <File className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                <span className="text-white truncate max-w-[140px]">{m.fileName}</span>
                                <Download className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                              </a>
                            ) : (
                              <div className="px-3 py-2 rounded-2xl text-sm text-white leading-relaxed"
                                style={{ background: isMe ? "linear-gradient(135deg,rgba(30,58,95,0.9),rgba(234,179,8,0.25))" : "rgba(30,58,95,0.7)", border: `1px solid ${isMe ? "rgba(234,179,8,0.2)" : "rgba(255,255,255,0.06)"}`, borderBottomRightRadius: isMe ? 4 : undefined, borderBottomLeftRadius: !isMe ? 4 : undefined }}>
                                {m.text}
                              </div>
                            )}
                            {showTime && (
                              <div className={`flex items-center gap-1 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
                                <span className="text-[10px] text-muted-foreground">{timeAgo(m.createdAt)}</span>
                                <MsgTick isMe={isMe} isRead={m.isRead} />
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
              }
              <div ref={bottomRef} />
            </div>

            {files.length > 0 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs">
                    <File className="w-3.5 h-3.5 text-yellow-400" />
                    <span className="text-white max-w-[100px] truncate">{f.name}</span>
                    <button onClick={() => setFiles(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="px-3 py-2.5 border-t flex items-center gap-2 flex-shrink-0"
              style={{ borderColor: "rgba(255,255,255,0.07)", background: "rgba(6,12,24,0.95)" }}>
              <input type="file" ref={fileRef} multiple className="hidden" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                onChange={e => e.target.files && uploadFiles(e.target.files, setFiles, setUploading)} />
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="text-muted-foreground hover:text-yellow-400 transition-colors flex-shrink-0 disabled:opacity-50 p-1.5">
                {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
              </button>
              <input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendMessage())}
                placeholder="Message..."
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder:text-muted-foreground focus:outline-none focus:border-yellow-500/40" />
              <button onClick={sendMessage} disabled={sending || uploading || (!text.trim() && files.length === 0)}
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all disabled:opacity-40 flex-shrink-0"
                style={{ background: (text.trim() || files.length > 0) ? "linear-gradient(135deg,#1e3a5f,#eab308)" : "rgba(255,255,255,0.05)" }}>
                {sending ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : <Send className="w-4 h-4 text-white" />}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
