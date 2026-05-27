"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  Megaphone, Send, Users, Mail, MessageSquare, Plus, Eye,
  Loader2, X, CreditCard, Building2, Phone, CheckSquare, Square,
  ImageIcon, Trash2, RefreshCw, UserCheck,
} from "lucide-react";
import toast from "react-hot-toast";

const DEFAULT_MSG = `Hello Sir 👋

Good Day!

This is Meet Here From City Real Space
( Property Broker )

Your Property Available For Rent / Sale?

Please share photos and details.

Thank you! 🏢
City Real Space, Ahmedabad`;

export default function MarketingPage() {
  const { user } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"blast" | "emp" | "campaigns">("blast");

  // ── Owner Blast ──
  const [owners, setOwners]           = useState<any[]>([]);
  const [ownersLoading, setOwnersLoading] = useState(false);
  const [sentOwners, setSentOwners]   = useState<Set<string>>(new Set());
  const [ownerMsg, setOwnerMsg]       = useState(DEFAULT_MSG);
  const [cardImageUrl, setCardImageUrl] = useState("");
  const [uploadingCard, setUploadingCard] = useState(false);
  const [search, setSearch]           = useState("");

  // ── Employee Blast ──
  const [employees, setEmployees]         = useState<any[]>([]);
  const [empLoading, setEmpLoading]       = useState(false);
  const [selectedEmps, setSelectedEmps]   = useState<Set<string>>(new Set());
  const [empMsg, setEmpMsg]               = useState(DEFAULT_MSG);
  const [sentEmps, setSentEmps]           = useState<Set<string>>(new Set());

  // ── Campaigns ──
  const [campaigns, setCampaigns]     = useState<any[]>([]);
  const [campsLoading, setCampsLoading] = useState(true);

  // ── Fetch owners ──
  const fetchOwners = useCallback(async () => {
    setOwnersLoading(true);
    try {
      const res  = await fetch("/api/owners?limit=500");
      const data = await res.json();
      setOwners(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load owners"); }
    finally { setOwnersLoading(false); }
  }, []);

  // ── Fetch campaigns ──
  const fetchCampaigns = useCallback(async () => {
    setCampsLoading(true);
    try {
      const res  = await fetch("/api/marketing");
      const data = await res.json();
      setCampaigns(Array.isArray(data) ? data : []);
    } catch { /* silent */ }
    finally { setCampsLoading(false); }
  }, []);

  // ── Fetch employees ──
  const fetchEmployees = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res  = await fetch("/api/admin/employees");
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data.filter((e: any) => e.isActive !== false) : []);
    } catch { toast.error("Failed to load employees"); }
    finally { setEmpLoading(false); }
  }, []);

  useEffect(() => { fetchOwners(); fetchCampaigns(); fetchEmployees(); }, [fetchOwners, fetchCampaigns, fetchEmployees]);

  // ── Upload card image ──
  const uploadCard = async (file: File) => {
    setUploadingCard(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("folder", "business-cards");
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) { setCardImageUrl(data.url); toast.success("Card uploaded ✅"); }
      else toast.error(data.error || "Upload failed");
    } catch { toast.error("Upload failed"); }
    setUploadingCard(false);
  };

  // ── Send to one owner ──
  // Flow: if card image → open image in new tab first → then open WA with message
  const sendToOwner = (owner: any) => {
    if (!ownerMsg.trim()) { toast.error("Message is required"); return; }
    const phone = owner.phone.replace(/\D/g, "");
    const wa    = phone.startsWith("91") ? phone : `91${phone}`;
    const text  = encodeURIComponent(ownerMsg);
    const waUrl = `https://wa.me/${wa}?text=${text}`;

    if (cardImageUrl) {
      // Step 1: open card image in new tab (user saves/copies it)
      window.open(cardImageUrl, "_blank");
      // Step 2: after 1.5s open WhatsApp with message
      setTimeout(() => window.open(waUrl, "_blank"), 1500);
      toast("📎 Card image opened → WhatsApp opening in 1.5s\nAttach the image manually in WhatsApp", { duration: 4000 });
    } else {
      window.open(waUrl, "_blank");
    }

    setSentOwners(prev => new Set([...prev, owner.id]));

    // Save to campaigns log
    fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:    `WA – ${owner.name} – ${new Date().toLocaleDateString("en-IN")}`,
        type:    "WHATSAPP",
        content: ownerMsg,
        mediaUrl: cardImageUrl || undefined,
        status:  "SENT",
      }),
    }).catch(() => {});
  };

  // ── Send to selected employees ──
  const sendToSelectedEmps = () => {
    if (!empMsg.trim()) { toast.error("Message is required"); return; }
    if (selectedEmps.size === 0) { toast.error("No employee selected"); return; }
    const targets = employees.filter(e => selectedEmps.has(e.id));
    targets.forEach((emp, i) => {
      const phone = emp.phone?.replace(/\D/g, "");
      if (!phone) return;
      const wa  = phone.startsWith("91") ? phone : `91${phone}`;
      const url = `https://wa.me/${wa}?text=${encodeURIComponent(empMsg)}`;
      setTimeout(() => window.open(url, "_blank"), i * 800);
    });
    setSentEmps(prev => new Set([...prev, ...selectedEmps]));
    toast.success(`${targets.length} employee(s) ko WhatsApp bheja!`);
    fetch("/api/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name:    `EMP Blast – ${targets.map(e => e.name).join(", ")} – ${new Date().toLocaleDateString("en-IN")}`,
        type:    "WHATSAPP",
        content: empMsg,
        status:  "SENT",
      }),
    }).catch(() => {});
  };

  const filteredOwners = owners.filter(o =>
    !search || o.name?.toLowerCase().includes(search.toLowerCase()) ||
    o.phone?.includes(search) || o.locality?.toLowerCase().includes(search.toLowerCase())
  );

  const inputCls = "w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-green-500/50";

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketing</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Bulk WhatsApp · Owner Blast · Campaigns</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-full sm:w-fit overflow-x-auto">
        {([
          { id: "blast",     label: "📱 Owner Blast" },
          { id: "emp",       label: "👥 Employee" },
          { id: "campaigns", label: "📊 Campaigns" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === t.id ? "bg-estate-500 text-white" : "text-muted-foreground hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OWNER BLAST TAB ── */}
      {activeTab === "blast" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Message + Card Setup */}
          <div className="glass-card p-5 space-y-4">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-green-400" /> Setup Message
            </h3>

            {/* Message */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">WhatsApp Message</label>
                <span className="text-xs text-muted-foreground">{ownerMsg.length} chars</span>
              </div>
              <textarea rows={7} value={ownerMsg} onChange={e => setOwnerMsg(e.target.value)}
                className={`${inputCls} resize-none`} />
            </div>

            {/* Card Image */}
            <div>
              <label className="text-xs text-muted-foreground mb-2 block">
                📎 Visiting Card Image (JPG/PNG)
                <span className="ml-2 text-yellow-400/70">— image will open in a tab, attach manually in WhatsApp</span>
              </label>
              {cardImageUrl ? (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={cardImageUrl} alt="card" className="h-20 rounded-lg object-cover border border-white/10" />
                  <div className="flex-1">
                    <p className="text-xs text-green-400 font-medium">✅ Card ready</p>
                    <p className="text-xs text-muted-foreground mt-1">Click owner → card image opens in tab → attach in WhatsApp → Send</p>
                  </div>
                  <button onClick={() => setCardImageUrl("")}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <label className={`flex items-center gap-3 cursor-pointer px-4 py-3 rounded-xl border border-dashed border-white/20 hover:border-green-500/40 transition-colors text-sm text-muted-foreground hover:text-white ${uploadingCard ? "opacity-50 pointer-events-none" : ""}`}>
                  {uploadingCard
                    ? <><Loader2 className="w-4 h-4 animate-spin text-green-400" /> Uploading...</>
                    : <><ImageIcon className="w-4 h-4 text-green-400" /> Upload visiting card JPG / PNG</>}
                  <input ref={fileRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) uploadCard(f); }} />
                </label>
              )}
            </div>
          </div>

          {/* Owners List */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white">Property Owners</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">{owners.length}</span>
                {sentOwners.size > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">
                    ✓ {sentOwners.size} sent
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search owner..." 
                  className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-xs focus:outline-none focus:border-green-500/40 w-36" />
                <button onClick={fetchOwners} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {ownersLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-estate-400 animate-spin" />
              </div>
            ) : filteredOwners.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                {owners.length === 0 ? "No owners found. Add owners in Property Owners section." : "No results for search."}
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {filteredOwners.map(o => {
                  const sent = sentOwners.has(o.id);
                  return (
                    <div key={o.id}
                      onClick={() => sendToOwner(o)}
                      className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-all ${
                        sent ? "bg-green-500/5 hover:bg-green-500/8" : "hover:bg-white/3"
                      }`}>
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        sent ? "bg-green-500/20 text-green-400" : "bg-estate-500/20 text-estate-300"
                      }`}>
                        {sent ? "✓" : (o.name?.[0] ?? "?")}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{o.name || "Unknown"}</span>
                          {sent && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Sent</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{o.company || o.locality || ""}</div>
                      </div>

                      {/* Phone + WA icon */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" /> {o.phone}
                        </span>
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                          sent ? "bg-green-500/30 text-green-300" : "bg-green-500/15 text-green-400"
                        }`}>
                          WA
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer hint */}
            {filteredOwners.length > 0 && (
              <div className="px-5 py-3 border-t border-white/5 text-xs text-muted-foreground flex items-center gap-2">
                <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                Click owner → WhatsApp will open with message ready
                {cardImageUrl && " → Card image will also open in a tab"}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── EMPLOYEE BLAST TAB ── */}
      {activeTab === "emp" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

          {/* Message */}
          <div className="glass-card p-5 space-y-3">
            <h3 className="font-semibold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-400" /> Employee WhatsApp Blast
            </h3>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted-foreground">Message</label>
                <span className="text-xs text-muted-foreground">{empMsg.length} chars</span>
              </div>
              <textarea rows={6} value={empMsg} onChange={e => setEmpMsg(e.target.value)}
                className={`${inputCls} resize-none`} />
            </div>
          </div>

          {/* Employee List */}
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-white">Employees</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-white/10 text-muted-foreground">{employees.length}</span>
                {selectedEmps.size > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/20">
                    {selectedEmps.size} selected
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {/* Select All / Deselect All */}
                <button
                  onClick={() => {
                    if (selectedEmps.size === employees.length) setSelectedEmps(new Set());
                    else setSelectedEmps(new Set(employees.map(e => e.id)));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white transition-colors">
                  {selectedEmps.size === employees.length && employees.length > 0
                    ? <><CheckSquare className="w-3.5 h-3.5 text-blue-400" /> Deselect All</>
                    : <><Square className="w-3.5 h-3.5" /> Select All</>}
                </button>
                <button onClick={fetchEmployees} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {empLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-estate-400 animate-spin" />
              </div>
            ) : employees.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No employees found.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {employees.map(emp => {
                  const selected = selectedEmps.has(emp.id);
                  const sent     = sentEmps.has(emp.id);
                  return (
                    <div key={emp.id}
                      onClick={() => setSelectedEmps(prev => {
                        const next = new Set(prev);
                        selected ? next.delete(emp.id) : next.add(emp.id);
                        return next;
                      })}
                      className={`flex items-center gap-4 px-5 py-3 cursor-pointer transition-all ${
                        selected ? "bg-blue-500/8 hover:bg-blue-500/12" : "hover:bg-white/3"
                      }`}>
                      {/* Checkbox */}
                      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 border ${
                        selected ? "bg-blue-500 border-blue-500" : "border-white/20 bg-white/5"
                      }`}>
                        {selected && <CheckSquare className="w-3.5 h-3.5 text-white" />}
                      </div>
                      {/* Avatar */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        sent ? "bg-green-500/20 text-green-400" : "bg-blue-500/20 text-blue-300"
                      }`}>
                        {sent ? "✓" : (emp.name?.[0] ?? "?")}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{emp.name}</span>
                          {sent && <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20">Sent</span>}
                        </div>
                        <div className="text-xs text-muted-foreground">{emp.position || emp.role || ""}</div>
                      </div>
                      {/* Phone */}
                      {emp.phone && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                          <Phone className="w-3 h-3" /> {emp.phone}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Send Button */}
            {selectedEmps.size > 0 && (
              <div className="px-5 py-4 border-t border-white/5">
                <button onClick={sendToSelectedEmps}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-300 text-sm font-medium hover:bg-blue-500/30 transition-all">
                  <Send className="w-4 h-4" />
                  Send to {selectedEmps.size} Employee{selectedEmps.size > 1 ? "s" : ""} via WhatsApp
                </button>
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* ── CAMPAIGNS TAB ── */}
      {activeTab === "campaigns" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
              <h3 className="font-semibold text-white">Sent History</h3>
              <button onClick={fetchCampaigns} className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>
            {campsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-7 h-7 text-estate-400 animate-spin" />
              </div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-sm">
                <Megaphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
                No campaigns yet
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {campaigns.map(c => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="w-3.5 h-3.5 text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{c.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{c.content?.slice(0, 60)}...</div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 border border-green-500/20 mb-1">✓ Sent</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(c.createdAt).toLocaleDateString("en-IN")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
