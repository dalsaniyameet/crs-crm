"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, CheckCheck, X, BellRing } from "lucide-react";

const TYPE_ICONS: Record<string, string> = {
  LEAD_ASSIGNED:       "👤",
  FOLLOW_UP_DUE:       "⏰",
  SITE_VISIT_REMINDER: "🏠",
  DEAL_UPDATE:         "💼",
  PROPERTY_MATCH:      "🏡",
  WHATSAPP:            "💬",
  EMAIL:               "📧",
  LEAVE_REQUEST:       "📅",
  SYSTEM:              "📢",
};

const TYPE_COLOR: Record<string, string> = {
  LEAD_ASSIGNED:       "bg-blue-500/20 border-blue-500/30",
  FOLLOW_UP_DUE:       "bg-orange-500/20 border-orange-500/30",
  SITE_VISIT_REMINDER: "bg-purple-500/20 border-purple-500/30",
  DEAL_UPDATE:         "bg-emerald-500/20 border-emerald-500/30",
  PROPERTY_MATCH:      "bg-yellow-500/20 border-yellow-500/30",
  WHATSAPP:            "bg-green-500/20 border-green-500/30",
  EMAIL:               "bg-blue-500/20 border-blue-500/30",
  LEAVE_REQUEST:       "bg-pink-500/20 border-pink-500/30",
  SYSTEM:              "bg-white/10 border-white/20",
};

function timeAgo(date: string) {
  const m = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Toast popup for new notification
function NewNotifToast({ notif, onClose }: { notif: any; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 5000);
    return () => clearTimeout(t);
  }, [onClose]);

  return createPortal(
    <motion.div
      initial={{ opacity: 0, y: -20, x: 20 }}
      animate={{ opacity: 1, y: 0,   x: 0  }}
      exit={{   opacity: 0, y: -20, x: 20  }}
      className="fixed top-4 right-4 z-[9999] w-80 rounded-2xl overflow-hidden shadow-2xl cursor-pointer"
      style={{ background: "#0a0a0a", border: "2px solid rgba(239,68,68,0.7)", boxShadow: "0 0 30px rgba(239,68,68,0.35), 0 0 60px rgba(239,68,68,0.15)" }}
      onClick={onClose}
    >
      {/* Red alarm top bar */}
      <motion.div
        style={{ background: "linear-gradient(90deg,#ef4444,#f97316)", transformOrigin: "left", height: 4 }}
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 5, ease: "linear" }}
      />
      {/* Alarm header */}
      <div className="flex items-center gap-2 px-4 pt-2.5 pb-1">
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ duration: 0.6, repeat: Infinity }}
          className="text-base"
        >🚨</motion.span>
        <span className="text-xs font-black uppercase tracking-widest text-red-400">⚠ NEW ALERT</span>
        <button onClick={onClose} className="ml-auto text-red-400 hover:text-white flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex items-start gap-3 px-4 pb-1">
        <span className="text-xl flex-shrink-0 mt-0.5">{TYPE_ICONS[notif.type] || "🔔"}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-red-300 leading-snug uppercase tracking-wide">{notif.title}</p>
          <p className="text-xs text-orange-200 mt-0.5 line-clamp-2">{notif.message}</p>
        </div>
      </div>
      {/* Status line */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-1 border-t border-red-500/20 mt-1">
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 0.7, repeat: Infinity }}
          className="text-[11px] font-bold text-red-400 flex items-center gap-1"
        >
          🔔 Alarm is ringing
        </motion.span>
        <span className="text-[11px] text-orange-300 font-semibold">• 📧 Email sent</span>
      </div>
    </motion.div>,
    document.body
  );
}

export default function NotificationBell() {
  const [open, setOpen]                     = useState(false);
  const [notifications, setNotifications]   = useState<any[]>([]);
  const [toasts, setToasts]                 = useState<any[]>([]);
  const [bellAnim, setBellAnim]             = useState(false);
  const [mounted, setMounted]               = useState(false);
  const prevIdsRef                          = useRef<Set<string>>(new Set());
  const btnRef                              = useRef<HTMLButtonElement>(null);
  const panelRef                            = useRef<HTMLDivElement>(null);
  const [panelPos, setPanelPos]             = useState({ top: 0, right: 0 });

  useEffect(() => { setMounted(true); }, []);

  // Position panel relative to button
  const updatePos = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setPanelPos({
      top:   rect.bottom + 8,
      right: window.innerWidth - rect.right,
    });
  }, []);

  useEffect(() => {
    if (open) updatePos();
  }, [open, updatePos]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const loadNotifications = useCallback(() => {
    fetch("/api/notifications")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !Array.isArray(data.notifications)) return;
        const incoming: any[] = data.notifications;

        // Detect genuinely new unread ones (not seen before)
        const newOnes = incoming.filter(n => !prevIdsRef.current.has(n.id) && !n.isRead);
        if (newOnes.length > 0 && prevIdsRef.current.size > 0) {
          setBellAnim(true);
          setTimeout(() => setBellAnim(false), 1000);
          // Show only 1 toast at a time
          setToasts(prev => {
            const alreadyShowing = new Set(prev.map((t: any) => t.id));
            const fresh = newOnes.filter(n => !alreadyShowing.has(n.id));
            if (fresh.length === 0) return prev;
            // Play alarm sound
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const playBeep = (freq: number, start: number, dur: number) => {
                const osc  = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain); gain.connect(ctx.destination);
                osc.type = "square";
                osc.frequency.setValueAtTime(freq, ctx.currentTime + start);
                gain.gain.setValueAtTime(0.25, ctx.currentTime + start);
                gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur);
                osc.start(ctx.currentTime + start);
                osc.stop(ctx.currentTime + start + dur);
              };
              playBeep(1046, 0.0,  0.12);
              playBeep(1318, 0.13, 0.12);
              playBeep(1046, 0.26, 0.12);
              playBeep(1318, 0.39, 0.20);
            } catch {}
            return [...prev, ...fresh.slice(0, 1)];
          });
        }

        incoming.forEach(n => prevIdsRef.current.add(n.id));

        // Preserve local isRead=true
        setNotifications(prev => {
          const localReadIds = new Set(prev.filter(n => n.isRead).map(n => n.id));
          return incoming.map(n => ({
            ...n,
            isRead: localReadIds.has(n.id) ? true : n.isRead,
          }));
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 15000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  const markAllRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) }).catch(() => {});
    // Update prevIds so poll doesn't re-trigger toasts
    notifications.forEach(n => prevIdsRef.current.add(n.id));
  };

  const markOneRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }).catch(() => {});
  };

  const removeToast = (id: string) => setToasts(prev => prev.filter(t => t.id !== id));

  const unread = notifications.filter(n => !n.isRead).length;

  return (
    <>
      {/* Toast popups */}
      {mounted && (
        <AnimatePresence>
          {toasts.map(t => (
            <NewNotifToast key={t.id} notif={t} onClose={() => removeToast(t.id)} />
          ))}
        </AnimatePresence>
      )}

      {/* Bell button */}
      <motion.button
        ref={btnRef}
        onClick={() => { setOpen(o => !o); updatePos(); }}
        animate={bellAnim ? { rotate: [0, -15, 15, -10, 10, -5, 5, 0] } : {}}
        transition={{ duration: 0.6 }}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-white transition-colors"
        style={{ background: open ? "rgba(234,179,8,0.08)" : "transparent" }}
      >
        {bellAnim
          ? <BellRing className="w-4 h-4 text-yellow-400" />
          : <Bell className="w-4 h-4" />
        }

        {/* Unread badge */}
        <AnimatePresence>
          {unread > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center px-0.5 font-bold"
            >
              {unread > 9 ? "9+" : unread}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulse ring when unread */}
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 opacity-40 animate-ping" />
        )}
      </motion.button>

      {/* Dropdown panel — rendered in portal to avoid z-index issues */}
      {mounted && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{   opacity: 0, y: -8, scale: 0.96  }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="fixed w-80 rounded-2xl overflow-hidden shadow-2xl"
              style={{
                top:       panelPos.top,
                right:     panelPos.right,
                zIndex:    9998,
                background: "#060c18",
                border:    "1px solid rgba(234,179,8,0.2)",
                boxShadow: "0 20px 60px rgba(0,0,0,0.8), 0 0 40px rgba(234,179,8,0.08)",
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b"
                style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-semibold text-white">Notifications</span>
                  {unread > 0 && (
                    <motion.span
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="text-xs px-1.5 py-0.5 rounded-full font-bold text-white bg-red-500"
                    >
                      {unread}
                    </motion.span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {unread > 0 && (
                    <button onClick={markAllRead}
                      className="text-xs flex items-center gap-1 text-yellow-400 hover:text-yellow-300 transition-colors">
                      <CheckCheck className="w-3 h-3" /> Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-white transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="max-h-[420px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="py-12 text-center"
                  >
                    <Bell className="w-10 h-10 mx-auto mb-3 text-muted-foreground opacity-20" />
                    <p className="text-sm text-muted-foreground">All caught up! 🎉</p>
                    <p className="text-xs text-muted-foreground mt-1">No new notifications</p>
                  </motion.div>
                ) : (
                  <AnimatePresence initial={false}>
                    {notifications.map((n, i) => (
                      <motion.div
                        key={n.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0  }}
                        exit={{   opacity: 0, x: -20 }}
                        transition={{ delay: i * 0.03 }}
                        onClick={() => !n.isRead && markOneRead(n.id)}
                        className="flex gap-3 px-4 py-3 border-b cursor-pointer group transition-colors hover:bg-white/5"
                        style={{
                          borderColor: "rgba(255,255,255,0.04)",
                          background:  !n.isRead ? "rgba(234,179,8,0.03)" : "transparent",
                        }}
                      >
                        {/* Icon with colored bg */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 border ${!n.isRead ? "bg-red-500/20 border-red-500/40" : (TYPE_COLOR[n.type] || "bg-white/10 border-white/20")}`}>
                          {!n.isRead
                            ? <motion.span animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>{TYPE_ICONS[n.type] || "🔔"}</motion.span>
                            : (TYPE_ICONS[n.type] || "🔔")
                          }
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-1">
                            {!n.isRead ? (
                              <motion.p
                                animate={{ color: ["#fca5a5", "#f97316", "#fca5a5"] }}
                                transition={{ duration: 1.5, repeat: Infinity }}
                                className="text-xs font-black leading-snug uppercase tracking-wide"
                              >
                                🚨 {n.title}
                              </motion.p>
                            ) : (
                              <p className="text-xs font-semibold leading-snug text-slate-400">{n.title}</p>
                            )}
                            {!n.isRead && (
                              <motion.span
                                animate={{ opacity: [1, 0, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                                className="w-2 h-2 rounded-full flex-shrink-0 mt-1 bg-red-400"
                              />
                            )}
                          </div>
                          <p className={`text-xs mt-0.5 line-clamp-2 leading-relaxed ${!n.isRead ? "text-orange-200" : "text-muted-foreground"}`}>
                            {n.message}
                          </p>
                          <p className="text-[10px] mt-1.5 text-slate-600">{timeAgo(n.createdAt)}</p>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-2.5 border-t flex items-center justify-between"
                style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                <span className="text-xs text-muted-foreground">{notifications.length} total</span>
                <button onClick={loadNotifications}
                  className="text-xs text-yellow-400 hover:text-yellow-300 transition-colors">
                  Refresh
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
