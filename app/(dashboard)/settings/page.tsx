"use client";
import { motion } from "framer-motion";
import { Settings, User, Bell, Shield, Zap, ChevronRight, Loader2, CheckCircle2, XCircle, ExternalLink, Calendar, Save } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import toast from "react-hot-toast";

const sections = [
  {
    title: "Profile",
    icon: User,
    color: "text-estate-400",
    fields: [
      { label: "Full Name",    type: "text",  value: "Admin User" },
      { label: "Email",        type: "email", value: "admin@cityreals.com" },
      { label: "Phone",        type: "tel",   value: "+91 98765 43210" },
      { label: "Role",         type: "text",  value: "Admin", disabled: true },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    color: "text-yellow-400",
    toggles: [
      { label: "New lead assigned",         defaultOn: true },
      { label: "Follow-up reminders",       defaultOn: true },
      { label: "Site visit reminders",      defaultOn: true },
      { label: "Deal stage updates",        defaultOn: true },
      { label: "WhatsApp notifications",    defaultOn: false },
      { label: "Daily summary email",       defaultOn: true },
    ],
  },
];

export default function SettingsPage() {
  const searchParams = useSearchParams();

  // Profile state
  const [profile, setProfile]         = useState({ name: "", email: "", phone: "", role: "" });
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving]   = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(r => r.json())
      .then(d => {
        if (d?.name) setProfile({ name: d.name, email: d.email ?? "", phone: d.phone ?? "", role: d.role ?? "" });
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const saveProfile = async () => {
    setProfileSaving(true);
    try {
      const res = await fetch("/api/auth/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: profile.name, phone: profile.phone }),
      });
      if (!res.ok) throw new Error();
      toast.success("Profile saved!");
    } catch {
      toast.error("Failed to save profile");
    } finally {
      setProfileSaving(false);
    }
  };

  // Google Calendar state
  const [gcal, setGcal]           = useState<{ connected: boolean; email?: string; events?: any[] }>({ connected: false });
  const [gcalLoading, setGcalLoading] = useState(true);
  const [gcalConnecting, setGcalConnecting] = useState(false);
  const [gcalDisconnecting, setGcalDisconnecting] = useState(false);
  const [showEvents, setShowEvents] = useState(false);

  const fetchGcalStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/google/calendar");
      const data = await res.json();
      setGcal(data);
    } catch { setGcal({ connected: false }); }
    setGcalLoading(false);
  }, []);

  useEffect(() => { fetchGcalStatus(); }, [fetchGcalStatus]);

  // Handle redirect back from Google OAuth
  useEffect(() => {
    const status = searchParams.get("google");
    const email  = searchParams.get("email");
    if (status === "success") {
      toast.success(`Google Calendar connected! ${email ? `(${email})` : ""} 🗓️`);
      fetchGcalStatus();
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    } else if (status === "error") {
      toast.error("Google Calendar connection failed. Try again.");
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams, fetchGcalStatus]);

  const connectGoogleCalendar = async () => {
    setGcalConnecting(true);
    const appUrl   = window.location.origin;
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      toast.error("Google Client ID not configured.");
      setGcalConnecting(false);
      return;
    }
    // Get current user's clerkId to pass as state
    const meRes = await fetch("/api/auth/me").then(r => r.json()).catch(() => null);
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  `${appUrl}/api/google/callback`,
      response_type: "code",
      scope:         "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email",
      access_type:   "offline",
      prompt:        "consent",
      state:         meRes?.clerkId || meRes?.id || "",
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const disconnectGoogleCalendar = async () => {
    if (!confirm("Disconnect Google Calendar?")) return;
    setGcalDisconnecting(true);
    const res = await fetch("/api/google/calendar", { method: "DELETE" });
    if (res.ok) { setGcal({ connected: false }); toast.success("Google Calendar disconnected"); }
    else toast.error("Failed to disconnect");
    setGcalDisconnecting(false);
  };

  const integrations = [
    { name: "WhatsApp Business API", status: "Connected",     color: "text-emerald-400", icon: "💬", action: null },
    { name: "OpenAI GPT-4o",         status: "Connected",     color: "text-emerald-400", icon: "🤖", action: null },
    { name: "Google Maps API",        status: "Connected",     color: "text-emerald-400", icon: "🗺️", action: null },
    { name: "Cloudinary Storage",     status: "Connected",     color: "text-emerald-400", icon: "☁️", action: null },
    { name: "Gmail API",              status: "Not Connected", color: "text-red-400",     icon: "📧", action: null },
    { name: "99acres Feed",           status: "Connected",     color: "text-emerald-400", icon: "🏠", action: null },
    { name: "Facebook Lead Ads",      status: "Connected",     color: "text-emerald-400", icon: "📘", action: null },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your CRM configuration</p>
      </div>

      {/* Profile */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-estate-400" />
          <h2 className="font-semibold text-white">Profile</h2>
        </div>
        {profileLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading profile...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Full Name</label>
              <input type="text" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Email</label>
              <input type="email" value={profile.email} disabled
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Phone</label>
              <input type="tel" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1.5 block">Role</label>
              <input type="text" value={profile.role} disabled
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm opacity-50 cursor-not-allowed" />
            </div>
            <div className="md:col-span-2">
              <button onClick={saveProfile} disabled={profileSaving}
                className="btn-primary text-sm px-6 flex items-center gap-2 disabled:opacity-60">
                {profileSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {profileSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* Notifications */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Bell className="w-5 h-5 text-yellow-400" />
          <h2 className="font-semibold text-white">Notifications</h2>
        </div>
        <div className="space-y-3">
          {sections[1].toggles!.map(t => (
            <div key={t.label} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
              <span className="text-sm text-foreground">{t.label}</span>
              <button className={`relative w-11 h-6 rounded-full transition-colors ${t.defaultOn ? "bg-estate-600" : "bg-white/10"}`}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${t.defaultOn ? "translate-x-6" : "translate-x-1"}`} />
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Integrations */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Zap className="w-5 h-5 text-yellow-400" />
          <h2 className="font-semibold text-white">Integrations</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

          {/* ── Google Calendar — real connect ── */}
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="p-4 rounded-xl bg-white/3 border border-white/8 hover:bg-white/5 transition-colors">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">📅</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-white">Google Calendar</div>
                {gcalLoading ? (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Loader2 className="w-3 h-3 animate-spin" /> Checking...
                  </div>
                ) : gcal.connected ? (
                  <div className="flex items-center gap-1 text-xs text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> Connected · {gcal.email}
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-xs text-red-400">
                    <XCircle className="w-3 h-3" /> Not Connected
                  </div>
                )}
              </div>
            </div>

            {!gcalLoading && (
              gcal.connected ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <button onClick={() => setShowEvents(v => !v)}
                      className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                      <Calendar className="w-3 h-3" /> {showEvents ? "Hide" : "View"} Events
                    </button>
                    <button onClick={disconnectGoogleCalendar} disabled={gcalDisconnecting}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors disabled:opacity-50">
                      {gcalDisconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      Disconnect
                    </button>
                  </div>
                  {showEvents && gcal.events && gcal.events.length > 0 && (
                    <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto">
                      {gcal.events.map((ev: any) => (
                        <div key={ev.id} className="flex items-center gap-2 p-2 rounded-lg bg-white/5 text-xs">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="text-white truncate">{ev.summary || "No title"}</div>
                            <div className="text-muted-foreground">
                              {ev.start?.dateTime
                                ? new Date(ev.start.dateTime).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })
                                : ev.start?.date}
                            </div>
                          </div>
                          {ev.htmlLink && (
                            <a href={ev.htmlLink} target="_blank" rel="noreferrer"
                              className="text-muted-foreground hover:text-estate-400 flex-shrink-0">
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {showEvents && gcal.events?.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-2">No upcoming events</div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <button onClick={connectGoogleCalendar} disabled={gcalConnecting}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/15 text-blue-400 border border-blue-500/25 hover:bg-blue-500/25 transition-colors text-sm font-medium disabled:opacity-50">
                    {gcalConnecting
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Connecting...</>
                      : <><span className="text-base">🔗</span> Connect Google Calendar</>}
                  </button>
                  <p className="text-xs text-muted-foreground text-center">
                    Site visits will auto-sync to your Google Calendar
                  </p>
                </div>
              )
            )}
          </motion.div>

          {/* Other integrations */}
          {integrations.map((intg, i) => (
            <motion.div key={intg.name} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + i * 0.04 }}
              className="flex items-center justify-between p-3 rounded-xl bg-white/3 border border-white/5 hover:bg-white/6 transition-colors cursor-pointer group">
              <div className="flex items-center gap-3">
                <span className="text-xl">{intg.icon}</span>
                <div>
                  <div className="text-sm font-medium text-white">{intg.name}</div>
                  <div className={`text-xs ${intg.color}`}>{intg.status}</div>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-white transition-colors" />
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Roles */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }} className="glass-card p-5">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold text-white">Role Permissions</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5 text-muted-foreground">
                <th className="text-left pb-3 font-medium">Permission</th>
                <th className="text-center pb-3 font-medium">Admin</th>
                <th className="text-center pb-3 font-medium">Sales Manager</th>
                <th className="text-center pb-3 font-medium">Broker</th>
                <th className="text-center pb-3 font-medium">Marketing</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["View All Leads",        true,  true,  false, false],
                ["Edit Leads",            true,  true,  true,  false],
                ["Delete Leads",          true,  false, false, false],
                ["Manage Properties",     true,  true,  true,  false],
                ["View Reports",          true,  true,  false, false],
                ["Manage Commissions",    true,  true,  false, false],
                ["Send Campaigns",        true,  true,  false, true ],
                ["Manage Users",          true,  false, false, false],
                ["Approve Attendance",    true,  false, false, false],
                ["Approve Leaves",        true,  false, false, false],
                ["View Salary",           true,  false, false, false],
              ].map(([perm, ...roles]) => (
                <tr key={String(perm)} className="border-b border-white/3">
                  <td className="py-2.5 text-muted-foreground">{perm}</td>
                  {roles.map((allowed, ri) => (
                    <td key={ri} className="py-2.5 text-center">
                      {allowed ? <span className="text-emerald-400">✓</span> : <span className="text-red-400/40">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
