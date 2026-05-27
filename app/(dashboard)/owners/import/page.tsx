"use client";
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileSpreadsheet, Upload, Phone, MessageSquare, Mail,
  Loader2, X, CheckCircle2, AlertTriangle, Link2,
  Search, Download, ArrowLeft, User, Building2,
} from "lucide-react";
import toast from "react-hot-toast";
import { useRouter } from "next/navigation";

interface ImportedClient {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  email?: string;
  company?: string;
  locality?: string;
  address?: string;
  propertyType?: string;
  transactionType?: string;
  price?: number;
  area?: string;
  notes?: string;
  isLeadMatch?: boolean;
  matchedLeadName?: string;
  matchType?: string;
  savedAsOwner?: boolean;
  ownerId?: string;
}

function normalizePhone(p: string) {
  return String(p || "").replace(/\D/g, "").slice(-10);
}

function getVal(row: Record<string, any>, ...keys: string[]) {
  for (const k of keys) {
    const found = Object.keys(row).find(rk =>
      rk.toLowerCase().replace(/[\s_\-]/g, "").includes(k.toLowerCase().replace(/[\s_\-]/g, ""))
    );
    if (found && row[found] !== "" && row[found] !== undefined) return String(row[found]).trim();
  }
  return "";
}

export default function ClientImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [clients, setClients]     = useState<ImportedClient[]>([]);
  const [importing, setImporting] = useState(false);
  const [search, setSearch]       = useState("");
  const [stats, setStats]         = useState<{ imported: number; duplicates: number; leadMatch: number; errors: number } | null>(null);
  const [saving, setSaving]       = useState<string | null>(null);

  async function handleFile(file: File) {
    setImporting(true);
    setClients([]);
    setStats(null);
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "buffer" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

      if (!rows.length) { toast.error("Excel file is empty"); setImporting(false); return; }

      // Fetch existing owners + leads for matching
      const [ownersRes, leadsRes] = await Promise.all([
        fetch("/api/owners?limit=1000").then(r => r.json()),
        fetch("/api/leads?limit=1000").then(r => r.json()),
      ]);
      const existingOwners: any[] = Array.isArray(ownersRes) ? ownersRes : [];
      const existingLeads: any[]  = Array.isArray(leadsRes.leads) ? leadsRes.leads : [];
      const existingPhones = new Set(existingOwners.map((o: any) => normalizePhone(o.phone)));

      const result = { imported: 0, duplicates: 0, leadMatch: 0, errors: 0 };
      const parsed: ImportedClient[] = [];

      for (const row of rows) {
        try {
          const name  = getVal(row, "name", "ownername", "clientname", "customer", "contact", "person");
          const phone = normalizePhone(getVal(row, "phone", "mobile", "contact", "number", "cell"));
          if (!phone || phone.length < 10) { result.errors++; continue; }

          const isDup = existingPhones.has(phone);
          if (isDup) { result.duplicates++; }
          existingPhones.add(phone);

          const phone2   = normalizePhone(getVal(row, "phone2", "altphone", "alternatephone", "mobile2"));
          const email    = getVal(row, "email", "mail");
          const company  = getVal(row, "company", "builder", "firm", "organization");
          const locality = getVal(row, "locality", "area", "location", "zone", "place");
          const address  = getVal(row, "address", "fulladdress");
          const propType = getVal(row, "propertytype", "type", "property");
          const txnType  = getVal(row, "transactiontype", "transaction", "buysell", "rentbuy");
          const priceRaw = getVal(row, "price", "amount", "rent", "value", "budget");
          const area     = getVal(row, "area", "sqft", "size");
          const notes    = getVal(row, "notes", "remarks", "comment", "description", "requirement");
          const price    = priceRaw ? parseFloat(priceRaw.replace(/[^0-9.]/g, "")) || undefined : undefined;

          // Lead match check
          const matchedLead = existingLeads.find((l: any) => {
            const lp = normalizePhone(l.phone);
            if (lp === phone) return true;
            if (name && l.name) {
              const wa = name.toLowerCase().split(/\s+/);
              const wb2 = l.name.toLowerCase().split(/\s+/);
              return wa.some((w: string) => w.length > 2 && wb2.includes(w));
            }
            return false;
          });

          if (matchedLead) result.leadMatch++;
          if (!isDup) result.imported++;

          parsed.push({
            id: `${phone}-${Date.now()}-${Math.random()}`,
            name: name || "Unknown",
            phone,
            phone2: phone2 || undefined,
            email: email || undefined,
            company: company || undefined,
            locality: locality || undefined,
            address: address || undefined,
            propertyType: propType || undefined,
            transactionType: txnType || undefined,
            price,
            area: area || undefined,
            notes: notes || undefined,
            isLeadMatch: !!matchedLead,
            matchedLeadName: matchedLead?.name,
            matchType: matchedLead ? (normalizePhone(matchedLead.phone) === phone ? "phone" : "name") : undefined,
            savedAsOwner: isDup,
          });
        } catch { result.errors++; }
      }

      setClients(parsed);
      setStats(result);
      toast.success(`${result.imported} clients loaded from Excel!`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    }
    setImporting(false);
  }

  async function saveAsOwner(client: ImportedClient) {
    if (client.savedAsOwner) return;
    setSaving(client.id);
    try {
      const notesJson = (client.propertyType || client.price || client.area) ? JSON.stringify({
        propertyType: client.propertyType || null,
        transactionType: client.transactionType || null,
        price: client.price || null,
        area: client.area || null,
        rawNotes: client.notes || null,
      }) : (client.notes || null);

      const res  = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: client.name, phone: client.phone,
          phone2: client.phone2 || null, email: client.email || null,
          company: client.company || null, locality: client.locality || null,
          address: client.address || null, notes: notesJson,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClients(prev => prev.map(c => c.id === client.id ? { ...c, savedAsOwner: true, ownerId: data.id } : c));
      toast.success(`${client.name} saved as owner!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
    setSaving(null);
  }

  async function saveAll() {
    const unsaved = clients.filter(c => !c.savedAsOwner);
    if (!unsaved.length) { toast("All already saved!"); return; }
    setSaving("all");
    let saved = 0;
    for (const client of unsaved) {
      try {
        const notesJson = (client.propertyType || client.price || client.area) ? JSON.stringify({
          propertyType: client.propertyType || null,
          transactionType: client.transactionType || null,
          price: client.price || null,
          area: client.area || null,
          rawNotes: client.notes || null,
        }) : (client.notes || null);

        const res = await fetch("/api/owners", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: client.name, phone: client.phone,
            phone2: client.phone2 || null, email: client.email || null,
            company: client.company || null, locality: client.locality || null,
            address: client.address || null, notes: notesJson,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setClients(prev => prev.map(c => c.id === client.id ? { ...c, savedAsOwner: true, ownerId: data.id } : c));
          saved++;
        }
      } catch {}
    }
    setSaving(null);
    toast.success(`${saved} owners saved!`);
  }

  const filtered = clients.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search) ||
    (c.locality || "").toLowerCase().includes(search.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(search.toLowerCase())
  );

  const fmtPrice = (p?: number) => {
    if (!p) return null;
    return p >= 10000000 ? `₹${(p / 10000000).toFixed(1)}Cr` : p >= 100000 ? `₹${(p / 100000).toFixed(1)}L` : `₹${(p / 1000).toFixed(0)}K`;
  };

  return (
    <div className="p-4 md:p-6 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => router.push("/owners")}
          className="p-2 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-green-400" /> Client Import
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Import clients from Excel — call, WhatsApp, email directly from CRM
          </p>
        </div>
        {clients.length > 0 && (
          <button
            onClick={saveAll}
            disabled={saving === "all" || clients.every(c => c.savedAsOwner)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-estate-500/20 border border-estate-500/30 text-estate-400 text-sm font-medium hover:bg-estate-500/30 transition-all disabled:opacity-50">
            {saving === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Save All as Owners
          </button>
        )}
      </div>

      {/* Upload Zone */}
      <label className={`flex flex-col items-center justify-center gap-3 p-10 rounded-2xl border-2 border-dashed cursor-pointer transition-all ${
        importing
          ? "border-green-500/40 bg-green-500/5 pointer-events-none"
          : "border-white/20 hover:border-green-500/50 hover:bg-green-500/5"
      }`}>
        {importing ? (
          <>
            <Loader2 className="w-10 h-10 animate-spin text-green-400" />
            <span className="text-sm text-white font-medium">Reading Excel & matching data...</span>
          </>
        ) : (
          <>
            <Upload className="w-10 h-10 text-green-400" />
            <span className="text-base text-white font-semibold">Click to upload Excel file</span>
            <span className="text-xs text-muted-foreground">.xlsx / .xls / .csv — any column names work</span>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {["Name", "Phone", "Company", "Locality", "Property Type", "Price", "Notes"].map(col => (
                <span key={col} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{col}</span>
              ))}
            </div>
          </>
        )}
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }} />
      </label>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Loaded",       value: stats.imported,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "Duplicates",   value: stats.duplicates, color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",   icon: <AlertTriangle className="w-4 h-4" /> },
            { label: "Lead Matches", value: stats.leadMatch,  color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20",       icon: <Link2 className="w-4 h-4" /> },
            { label: "Errors",       value: stats.errors,     color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",         icon: <X className="w-4 h-4" /> },
          ].map(s => (
            <div key={s.label} className={`p-4 rounded-xl border ${s.bg} flex items-center gap-3`}>
              <span className={s.color}>{s.icon}</span>
              <div>
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      {clients.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, phone, locality..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
          </div>
          <span className="text-sm text-muted-foreground">{filtered.length} clients</span>
        </div>
      )}

      {/* Client List */}
      {filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map(client => (
            <motion.div key={client.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className={`glass-card p-4 flex flex-col md:flex-row md:items-center gap-4 ${
                client.isLeadMatch ? "border-blue-500/30 bg-blue-500/5" : ""
              }`}>

              {/* Avatar + Info */}
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`w-11 h-11 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${
                  client.isLeadMatch ? "bg-blue-500/20 text-blue-300" : "bg-estate-500/20 text-estate-300"
                }`}>
                  {client.name[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-white text-sm">{client.name}</span>
                    {client.savedAsOwner && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/20 text-emerald-400">✓ Saved</span>
                    )}
                    {client.isLeadMatch && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                        client.matchType === "phone"
                          ? "bg-red-500/15 border-red-500/20 text-red-400"
                          : "bg-yellow-500/15 border-yellow-500/20 text-yellow-400"
                      }`}>
                        🔗 Lead: {client.matchedLeadName}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">{client.phone}</span>
                    {client.company && <span className="text-xs text-gold-400">{client.company}</span>}
                    {client.locality && <span className="text-xs text-muted-foreground">📍 {client.locality}</span>}
                  </div>
                  {/* Property details */}
                  {(client.propertyType || client.price || client.area) && (
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {client.propertyType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">{client.propertyType}</span>
                      )}
                      {client.transactionType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{client.transactionType}</span>
                      )}
                      {client.price && (
                        <span className="text-xs font-semibold text-green-400">{fmtPrice(client.price)}</span>
                      )}
                      {client.area && (
                        <span className="text-xs text-muted-foreground">{client.area} sqft</span>
                      )}
                    </div>
                  )}
                  {client.notes && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{client.notes}</p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                {/* Call */}
                <a href={`tel:${client.phone}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all">
                  <Phone className="w-3.5 h-3.5" /> Call
                </a>

                {/* WhatsApp */}
                <a href={`https://wa.me/91${client.phone}`} target="_blank" rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-all">
                  <MessageSquare className="w-3.5 h-3.5" /> WA
                </a>

                {/* Phone 2 */}
                {client.phone2 && (
                  <a href={`tel:${client.phone2}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground text-xs hover:text-white transition-all">
                    <Phone className="w-3.5 h-3.5" /> {client.phone2}
                  </a>
                )}

                {/* Email */}
                {client.email && (
                  <a href={`mailto:${client.email}`}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-all">
                    <Mail className="w-3.5 h-3.5" /> Email
                  </a>
                )}

                {/* Save as Owner */}
                {!client.savedAsOwner && (
                  <button onClick={() => saveAsOwner(client)} disabled={saving === client.id}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-estate-500/15 border border-estate-500/20 text-estate-400 text-xs font-medium hover:bg-estate-500/25 transition-all disabled:opacity-50">
                    {saving === client.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
                    Save Owner
                  </button>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!importing && clients.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileSpreadsheet className="w-14 h-14 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Upload an Excel file to see all clients here</p>
          <p className="text-xs mt-1 opacity-60">Call, WhatsApp & Email directly from this page</p>
        </div>
      )}
    </div>
  );
}
