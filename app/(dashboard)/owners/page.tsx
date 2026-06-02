"use client";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ScanLine, Plus, Phone, MessageSquare, Edit, Trash2,
  Camera, Loader2, X, Building2, User, Search, Download,
  MessageCircle, ArrowRight, Sparkles, CheckSquare, Square, Send, Users,
  FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, Link2,
  Mail, UserPlus, RefreshCw,
} from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

interface Owner {
  id: string;
  name: string;
  phone: string;
  phone2?: string;
  email?: string;
  company?: string;
  address?: string;
  locality?: string;
  cardImageUrl?: string;
  notes?: string;
  createdAt: string;
  assignedToId?: string;
  assignedTo?: { id: string; name: string };
  properties: Array<{ id: string; title: string; status: string; price: number; type: string; transactionType: string }>;
}

interface OwnerMessage {
  id: string;
  direction: "IN" | "OUT";
  message: string;
  mediaUrl?: string;
  createdAt: string;
}

const WA_COMPANY_MSG = (ownerName: string) =>
  `Hello ${ownerName}! 👋\n\nI'm from *City Real Space*, Ahmedabad's trusted real estate brokerage.\n\n🏢 We specialize in Commercial & Residential properties across Ahmedabad.\n\nWe'd love to help you with your property. Please find our company details below.\n\n📞 Contact: +91 XXXXXXXXXX\n🌐 cityrealspace.com\n📍 A-708, Prahlad Nagar Trade Centre, Satellite, Ahmedabad\n\nLooking forward to connecting! 🙏`;

const fmtPrice = (p: number, tx: string) => {
  const v = p >= 10000000 ? `₹${(p / 10000000).toFixed(1)}Cr` : p >= 100000 ? `₹${(p / 100000).toFixed(1)}L` : `₹${(p / 1000).toFixed(0)}K`;
  return tx === "RENT" || tx === "LEASE" ? `${v}/mo` : v;
};

function fixMojibake(str: string): string {
  try {
    const bytes = new Uint8Array(str.split("").map(c => c.charCodeAt(0)));
    return new TextDecoder("utf-8").decode(bytes);
  } catch { return str; }
}

function fixNotesEmoji(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k in obj) {
    const v = obj[k];
    out[k] = typeof v === "string" && /[\xC0-\xFF]/.test(v) ? fixMojibake(v) : v;
  }
  return out;
}

function parseOwnerNotes(notes?: string) {
  if (!notes) return null;
  try {
    const parsed = JSON.parse(notes);
    return fixNotesEmoji(parsed);
  } catch { return null; }
}

const TYPE_ICON: Record<string, string> = {
  OFFICE: "🏢", SHOP: "🛍️", SHOWROOM: "🎨", WAREHOUSE: "📦",
  APARTMENT: "🏠", VILLA: "🏡", PLOT: "📍", PENTHOUSE: "🏗️",
  STUDIO: "🏢", COMMERCIAL_LAND: "🌾", INDUSTRIAL: "⚙️",
};

const TX_COLOR: Record<string, string> = {
  RENT: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  LEASE: "text-purple-400 bg-purple-500/10 border-purple-500/20",
  SELL: "text-green-400 bg-green-500/10 border-green-500/20",
};

function LogReply({ ownerId, onSaved }: { ownerId: string; onSaved: (msg: OwnerMessage) => void }) {
  const [open, setOpen]   = useState(false);
  const [text, setText]   = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res  = await fetch(`/api/owners/${ownerId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text.trim(), direction: "IN" }),
      });
      const msg = await res.json();
      if (!res.ok) throw new Error(msg.error);
      onSaved(msg);
      setText("");
      setOpen(false);
      toast.success("Reply logged!");
    } catch { toast.error("Failed to log reply"); }
    setSaving(false);
  }

  if (!open) return (
    <button onClick={() => setOpen(true)}
      className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white hover:border-white/20 transition-all">
      <ArrowRight className="w-3.5 h-3.5 rotate-180" /> Log Owner Reply
    </button>
  );

  return (
    <div className="space-y-2 p-3 rounded-lg bg-white/5 border border-white/10">
      <p className="text-xs text-muted-foreground">Paste owner's reply from WhatsApp:</p>
      <textarea rows={3} value={text} onChange={e => setText(e.target.value)}
        placeholder="Paste owner's reply from WhatsApp here..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-estate-500/50 resize-none" />
      <div className="flex gap-2">
        <button onClick={() => setOpen(false)}
          className="flex-1 py-1.5 rounded-lg bg-white/5 text-xs text-muted-foreground hover:text-white transition-all">Cancel</button>
        <button onClick={save} disabled={saving || !text.trim()}
          className="flex-1 py-1.5 rounded-lg bg-estate-500/20 border border-estate-500/30 text-estate-400 text-xs font-medium hover:bg-estate-500/30 transition-all disabled:opacity-50">
          {saving ? "Saving..." : "Save Reply"}
        </button>
      </div>
    </div>
  );
}

interface Client {
  id: string;
  name: string;
  phone: string;
  email?: string;
  source: string;
  status: string;
  score: number;
  budget?: number;
  requirements?: string;
  propertyType?: string;
  transactionType?: string;
  createdAt: string;
}

export default function OwnersPage() {
  const { user } = useUser();
  const isAdmin = ["ADMIN","SALES_MANAGER"].includes(((user?.publicMetadata?.role as string) || "BROKER").toUpperCase());
  const [activeTab, setActiveTab]   = useState<"owners" | "clients" | "store">("owners");
  const [owners, setOwners]         = useState<Owner[]>([]);
  const router = useRouter();

  // ── Assign to employee modal ──
  const [showAssign, setShowAssign]       = useState(false);
  const [assignOwnerId, setAssignOwnerId] = useState("");
  const [employees, setEmployees]         = useState<any[]>([]);
  const [assigningTo, setAssigningTo]     = useState("");
  const [assigning, setAssigning]         = useState(false);

  useEffect(() => {
    fetch("/api/brokers").then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  async function handleAssign() {
    if (!assignOwnerId) return;
    setAssigning(true);
    try {
      const res = await fetch("/api/owners", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _action: "assign", ownerId: assignOwnerId, employeeId: assigningTo || null }),
      });
      if (!res.ok) throw new Error();
      setOwners(prev => prev.map(o => o.id === assignOwnerId ? { ...o, assignedToId: assigningTo || null } : o));
      toast.success(assigningTo ? "Owner assigned to employee!" : "Assignment removed");
      setShowAssign(false);
    } catch { toast.error("Failed to assign"); }
    setAssigning(false);
  }

  // ── Store state ──
  interface StoreItem {
    id: string; ownerId: string; title: string; propertyType?: string;
    transactionType?: string; price?: number; area?: number; floor?: string;
    locality?: string; address?: string; furnishing?: string; status: string;
    imageUrl?: string; notes?: string; listedAt: string;
    owner: { id: string; name: string; phone: string; locality?: string };
  }
  const [storeItems, setStoreItems]       = useState<StoreItem[]>([]);
  const [storeLoading, setStoreLoading]   = useState(false);
  const [showAddStore, setShowAddStore]   = useState(false);
  const [savingStore, setSavingStore]     = useState(false);
  const [storeSearch, setStoreSearch]     = useState("");
  const [storeFilterType, setStoreFilterType]   = useState("ALL");
  const [storeFilterTxn, setStoreFilterTxn]     = useState("ALL");
  const [storeFilterStatus, setStoreFilterStatus] = useState("ALL");
  const storeImgRef = useRef<HTMLInputElement>(null);
  const [uploadingStoreImg, setUploadingStoreImg] = useState(false);
  const STORE_EMPTY = { ownerId: "", title: "", propertyType: "", transactionType: "",
    price: "", area: "", floor: "", locality: "", address: "", furnishing: "",
    status: "AVAILABLE", imageUrl: "", notes: "", listedAt: new Date().toISOString().split("T")[0] };
  const [storeForm, setStoreForm] = useState(STORE_EMPTY);

  async function fetchStore() {
    setStoreLoading(true);
    try {
      const res  = await fetch("/api/owners/store");
      const data = await res.json();
      setStoreItems(Array.isArray(data) ? data : []);
    } catch { toast.error("Failed to load store"); }
    setStoreLoading(false);
  }

  useEffect(() => { if (activeTab === "store") fetchStore(); }, [activeTab]);

  async function uploadStoreImage(file: File) {
    setUploadingStoreImg(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("folder", "store");
    const res  = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) { setStoreForm(f => ({ ...f, imageUrl: data.url })); toast.success("Image uploaded!"); }
    else toast.error("Upload failed");
    setUploadingStoreImg(false);
  }

  async function handleSaveStore(e: React.FormEvent) {
    e.preventDefault();
    if (!storeForm.ownerId || !storeForm.title) { toast.error("Owner aur Title required hai"); return; }
    setSavingStore(true);
    try {
      const res  = await fetch("/api/owners/store", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...storeForm, price: storeForm.price ? Number(storeForm.price) : null, area: storeForm.area ? Number(storeForm.area) : null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setStoreItems(prev => [data, ...prev]);
      setShowAddStore(false);
      setStoreForm(STORE_EMPTY);
      toast.success("Property added to store! ✅");
    } catch (err: unknown) { toast.error((err as Error).message || "Failed"); }
    setSavingStore(false);
  }

  async function deleteStoreItem(id: string) {
    if (!confirm("Remove this property?")) return;
    await fetch(`/api/owners/store?id=${id}`, { method: "DELETE" });
    setStoreItems(prev => prev.filter(s => s.id !== id));
    toast.success("Removed");
  }

  const filteredStore = storeItems.filter(s => {
    const q = storeSearch.toLowerCase();
    const textMatch = !q || s.title.toLowerCase().includes(q) ||
      (s.locality || "").toLowerCase().includes(q) ||
      s.owner.name.toLowerCase().includes(q) ||
      s.owner.phone.includes(q);
    if (!textMatch) return false;
    if (storeFilterType !== "ALL" && s.propertyType !== storeFilterType) return false;
    if (storeFilterTxn  !== "ALL" && s.transactionType !== storeFilterTxn) return false;
    if (storeFilterStatus !== "ALL" && s.status !== storeFilterStatus) return false;
    return true;
  });
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterBudget, setFilterBudget] = useState("ALL");
  const [filterTransaction, setFilterTransaction] = useState("ALL");
  const [filterLocality, setFilterLocality] = useState("ALL");
  const [filterScanned, setFilterScanned] = useState("ALL"); // ALL | SCANNED | NO_CARD
  const [scanning, setScanning]   = useState(false);
  const [showScan, setShowScan]   = useState(false);
  // Batch scan state
  const [batchFiles, setBatchFiles]       = useState<File[]>([]);
  const [batchResults, setBatchResults]   = useState<Array<{ file: File; status: "pending"|"scanning"|"done"|"error"; name?: string; phone?: string; error?: string }>>([]);
  const [batchRunning, setBatchRunning]   = useState(false);
  const [batchMode, setBatchMode]         = useState(false);
  const [showAdd, setShowAdd]     = useState(false);
  const [showMessages, setShowMessages] = useState(false);
  const [editOwner, setEditOwner] = useState<Owner | null>(null);
  const [scanned, setScanned]     = useState<Record<string, string | number> | null>(null);
  const [saving, setSaving]       = useState(false);
  const [selectedOwner, setSelectedOwner] = useState<Owner | null>(null);
  const [messages, setMessages]   = useState<OwnerMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [autoScanMode, setAutoScanMode] = useState(false); // auto-save & open WA after scan
  const [showConvertLead, setShowConvertLead] = useState(false);
  const [convertingLead, setConvertingLead] = useState(false);
  const [leadForm, setLeadForm] = useState({ source: "WALK_IN", budget: "", requirements: "" });
  const [saveAsProperty, setSaveAsProperty] = useState(false);
  const [selectedMatchClient, setSelectedMatchClient] = useState<Client | null>(null);
  const [selectedMatchOwner, setSelectedMatchOwner]   = useState<Owner | null>(null);
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode]         = useState(false);
  const [showBlast, setShowBlast]           = useState(false);

  // ── Excel Import ──
  const [showImport, setShowImport]         = useState(false);
  const [importing, setImporting]           = useState(false);
  const [importResult, setImportResult]     = useState<any>(null);
  const importFileRef                       = useRef<HTMLInputElement>(null);
  const [blastMsg, setBlastMsg] = useState(`*👋🏻 Hello Sir/Mam*

*👐🏻 Welcome to City Real Space*

*🙋🏻 This is Nikhil Here From City Real Space*
*( We are Real Estate Agent )*
*( Property Broker )*

*🏘️ Your Property Available For Rent?*

*( If Yes please Them 👇🏻)*

*📸 Please share me photos and details*

*🤝 We will Help you Close the deal Fast!*

*🌐 www.cityrealspace.com*

*📧 info@cityrealspace.com*

*📲 +91 9825031247*

*🙏🏻Thank you for Contacting City Real Space*`);
  const [blasting, setBlasting]     = useState(false);
  const [blastIndex, setBlastIndex] = useState(0);
  const [blastDone, setBlastDone]   = useState<Set<string>>(new Set());

  async function handleExcelImport(file: File) {
    setImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "buffer" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];

      if (!rows.length) { toast.error("Excel file is empty"); setImporting(false); return; }

      function getVal(row: Record<string, any>, ...keys: string[]) {
        for (const k of keys) {
          const found = Object.keys(row).find(rk =>
            rk.toLowerCase().replace(/[\s_\-]/g, "").includes(k.toLowerCase().replace(/[\s_\-]/g, ""))
          );
          if (found && row[found] !== "" && row[found] !== undefined) return String(row[found]).trim();
        }
        return "";
      }

      function normalizePhone(p: string) { return p.replace(/\D/g, "").slice(-10); }
      function normalizeName(n: string)  { return n.toLowerCase().trim(); }
      function nameMatch(a: string, b: string) {
        const wa = normalizeName(a).split(/\s+/);
        const wb2 = normalizeName(b).split(/\s+/);
        const common = wa.filter(w => w.length > 2 && wb2.includes(w));
        return common.length >= 1 || normalizeName(a).includes(normalizeName(b)) || normalizeName(b).includes(normalizeName(a));
      }

      const existingPhones = new Set(owners.map(o => normalizePhone(o.phone)));
      const result = { imported: 0, duplicates: 0, leadMatch: 0, errors: 0, matchedLeads: [] as any[] };

      // Fetch existing leads for matching
      let existingLeads: any[] = [];
      try {
        const lr = await fetch("/api/leads?limit=500");
        const ld = await lr.json();
        existingLeads = Array.isArray(ld.leads) ? ld.leads : [];
      } catch {}

      const newOwners: Owner[] = [];

      for (const row of rows) {
        try {
          const name  = getVal(row, "name", "ownername", "clientname", "customer", "contact");
          const phone = normalizePhone(getVal(row, "phone", "mobile", "contact", "number", "cell"));
          if (!phone || phone.length < 10) { result.errors++; continue; }
          if (existingPhones.has(phone)) { result.duplicates++; continue; }
          existingPhones.add(phone);

          const phone2     = normalizePhone(getVal(row, "phone2", "altphone", "alternatephone", "mobile2"));
          const email      = getVal(row, "email", "mail");
          const company    = getVal(row, "company", "builder", "firm", "organization");
          const locality   = getVal(row, "locality", "location", "zone", "place", "area");
          const address    = getVal(row, "address", "fulladdress");
          const propType   = getVal(row, "propertytype", "type", "property", "proptype");
          const txnType    = getVal(row, "transactiontype", "transaction", "buysell", "rentbuy", "txn");
          const price      = getVal(row, "price", "amount", "rent", "value", "askingprice");
          const sqft       = getVal(row, "sqft", "area", "size", "carpetarea", "builtup");
          const floor      = getVal(row, "floor", "floorno");
          const furnishing = getVal(row, "furnishing", "furnished", "furnishingstatus");
          const brokerage  = getVal(row, "brokerage", "commission", "brokerageamt");
          const status     = getVal(row, "status", "propertystatus", "availability");
          const amenities  = getVal(row, "amenities", "facilities", "features");
          const notes      = getVal(row, "notes", "remarks", "comment", "description");

          const hasProps = propType || price || sqft || floor || furnishing || brokerage || status;
          const notesJson = hasProps ? JSON.stringify({
            propertyType: propType || null,
            transactionType: txnType || null,
            price: price ? parseFloat(price.replace(/[^0-9.]/g, "")) || null : null,
            area: sqft ? parseFloat(sqft) || null : null,
            floor: floor || null,
            furnishing: furnishing || null,
            brokerage: brokerage || null,
            status: status || null,
            amenities: amenities || null,
            rawNotes: notes || null,
          }) : (notes || null);

          const res  = await fetch("/api/owners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name || "Unknown", phone, phone2: phone2 || null, email: email || null, company: company || null, locality: locality || null, address: address || null, notes: notesJson }),
          });
          const saved = await res.json();
          if (!res.ok) { result.errors++; continue; }

          result.imported++;
          newOwners.push({ ...saved, properties: [] });

          // Match against existing leads
          const matchedLead = existingLeads.find(l => {
            const lp = normalizePhone(l.phone);
            return lp === phone || (name && nameMatch(l.name, name));
          });
          if (matchedLead) {
            result.leadMatch++;
            result.matchedLeads.push({
              ownerName: name || "Unknown", ownerPhone: phone,
              leadName: matchedLead.name, leadPhone: matchedLead.phone,
              matchType: normalizePhone(matchedLead.phone) === phone ? "phone" : "name",
            });
          }
        } catch { result.errors++; }
      }

      setOwners(prev => [...newOwners, ...prev]);
      setImportResult(result);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    }
    setImporting(false);
  }

  function openNextWA(targets: Owner[], index: number) {
    if (index >= targets.length) {
      setBlasting(false);
      toast.success(`✅ All ${targets.length} messages opened!`);
      return;
    }
    const owner = targets[index];
    const clean = owner.phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
    const msg   = blastMsg.replace(/\{name\}/g, owner.name);
    // Save to thread
    fetch(`/api/owners/${owner.id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: msg, direction: "OUT" }),
    }).catch(() => {});
    // Open WA
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, "_blank");
    setBlastIndex(index + 1);
    setBlastDone(prev => { const n = new Set(prev); n.add(owner.id); return n; });
  }

  function nextBlast() {
    const targets = filtered.filter(o => selectedIds.has(o.id));
    openNextWA(targets, blastIndex);
  }

  function finishBlast() {
    setBlasting(false);
    setShowBlast(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setBlastImage(null);
    setBlastDone(new Set());
    setBlastIndex(0);
  }
  const [blastImage, setBlastImage]         = useState<string | null>(null);
  const [uploadingBlastImg, setUploadingBlastImg] = useState(false);
  const blastImgRef = useRef<HTMLInputElement>(null);
  const scanRef = useRef<HTMLInputElement>(null);

  // ── Clients Tab ──
  const [clients, setClients]               = useState<Client[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientSearch, setClientSearch]     = useState("");
  const [clientImporting, setClientImporting] = useState(false);
  const [showAddClient, setShowAddClient]   = useState(false);
  const [clientForm, setClientForm]         = useState({ name: "", phone: "", email: "", source: "WALK_IN", budget: "", requirements: "", propertyType: "", transactionType: "BUY" });
  const [savingClient, setSavingClient]     = useState(false);
  const clientImportRef                     = useRef<HTMLInputElement>(null);
  const [clientScanning, setClientScanning] = useState(false);
  const clientScanRef                       = useRef<HTMLInputElement>(null);

  const EMPTY = { name: "", phone: "", phone2: "", email: "", company: "", address: "", locality: "", notes: "",
    propertyType: "", transactionType: "", price: "", area: "", floor: "", furnishing: "", amenities: "" };
  const [form, setForm] = useState(EMPTY);

  useEffect(() => {
    Promise.all([
      fetch("/api/owners").then(r => r.json()),
      fetch("/api/leads?limit=500").then(r => r.json()),
    ]).then(([ownersData, leadsData]) => {
      setOwners(Array.isArray(ownersData) ? ownersData : []);
      setClients(Array.isArray(leadsData.leads) ? leadsData.leads : []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function handleScan(file: File) {
    setScanning(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("saveOwner", "false");
      const res = await fetch("/api/ai/scan-card", { method: "POST", body: fd });
      const text = await res.text();
      let data: Record<string, string>;
      try {
        data = JSON.parse(text);
      } catch {
        console.error("Non-JSON response:", text.slice(0, 300));
        throw new Error("Server error — check console for details");
      }
      if (!res.ok) throw new Error(data.error || "Scan failed");
      setScanned(data);
      
      // If auto-save mode, directly save owner and open WhatsApp
      if (autoScanMode) {
        setSaving(true);
        const ownerData = {
          name:     data.ownerName    || "",
          phone:    data.ownerPhone   || "",
          phone2:   data.ownerPhone2  || "",
          email:    data.ownerEmail   || "",
          company:  data.companyName  || "",
          address:  data.address      || "",
          locality: data.locality     || "",
          notes:    data.notes        || "",
          cardImageUrl: data.imageUrl || null,
        };
        
        if (!ownerData.phone) {
          toast.error("Phone number required");
          setSaving(false);
          return;
        }
        
        try {
          const saveRes = await fetch("/api/owners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ownerData),
          });
          const savedOwner = await saveRes.json();
          if (!saveRes.ok) throw new Error(savedOwner.error);
          
          // Add to list
          setOwners(prev => [{ ...savedOwner, properties: [] }, ...prev]);
          toast.success(`✅ ${ownerData.name} saved! Opening WhatsApp...`);

          // Auto-create store entry if property data exists
          if (data.propertyType || data.price || data.area) {
            fetch("/api/owners/store", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ownerId:         savedOwner.id,
                title:           data.propertyTitle || `${data.propertyType || "Property"} - ${data.locality || ownerData.locality || ownerData.name}`,
                propertyType:    data.propertyType    || null,
                transactionType: data.transactionType || null,
                price:           data.price           ? Number(data.price) : null,
                area:            data.area            ? Number(data.area)  : null,
                floor:           data.floor           || null,
                locality:        data.locality        || ownerData.locality || null,
                address:         data.address         || ownerData.address  || null,
                furnishing:      data.furnishing      || null,
                status:          "AVAILABLE",
                imageUrl:        data.imageUrl        || null,
                notes:           data.amenities       || data.description   || null,
              }),
            }).catch(() => {});
          }
          
          // Auto-open WhatsApp
          const clean = ownerData.phone.replace(/\D/g, "").slice(-10);
          const msg = WA_COMPANY_MSG(ownerData.name);
          window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, "_blank");
          
          // Reset states
          setShowScan(false);
          setAutoScanMode(false);
          setScanned(null);
        } catch (err: unknown) {
          toast.error((err as Error).message || "Failed to save owner");
        } finally {
          setSaving(false);
        }
      } else {
        // Normal mode: show review modal
        setForm({
          name:     data.ownerName    || "",
          phone:    data.ownerPhone   || "",
          phone2:   data.ownerPhone2  || "",
          email:    data.ownerEmail   || "",
          company:  data.companyName  || "",
          address:  data.address      || "",
          locality: data.locality     || "",
          notes:    data.notes        || "",
          propertyType: "", transactionType: "", price: "", area: "", floor: "", furnishing: "", amenities: "",
        });
        setShowScan(false);
        setShowAdd(true);
        toast.success("Card scanned! Review & save.");
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      toast.error(msg.length > 5 ? msg : "Could not read card. Try a clearer photo.");
      console.error("Scan error:", msg);
    }
    setScanning(false);
  }

  async function handleBatchScan() {
    if (!batchFiles.length) return;
    setBatchRunning(true);
    setBatchResults(batchFiles.map(f => ({ file: f, status: "pending" })));

    const CONCURRENCY = 3; // 3 cards at a time
    const queue = [...batchFiles.map((f, i) => ({ f, i }))];

    async function processOne({ f, i }: { f: File; i: number }) {
      setBatchResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: "scanning" } : r));
      try {
        const compressed = await compressImage(f);
        const fd = new FormData();
        fd.append("file", compressed);
        fd.append("saveOwner", "false");
        const res  = await fetch("/api/ai/scan-card", { method: "POST", body: fd });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Scan failed");
        const ownerData = {
          name: data.ownerName || "Unknown", phone: data.ownerPhone || "",
          phone2: data.ownerPhone2 || "", email: data.ownerEmail || "",
          company: data.companyName || "", address: data.address || "",
          locality: data.locality || "",
          cardImageUrl: data.imageUrl || null,
          notes: (data.propertyType || data.price || data.area) ? JSON.stringify({
            propertyTitle: data.propertyTitle || null,
            propertyType: data.propertyType || null,
            transactionType: data.transactionType || null,
            price: data.price || null,
            area: data.area || null,
            floor: data.floor || null,
            totalFloors: data.totalFloors || null,
            furnishing: data.furnishing || null,
            condition: data.condition || null,
            brokerage: data.brokerage || null,
            status: data.status || null,
            amenities: data.amenities || null,
            description: data.description || null,
            rawNotes: data.notes || null,
          }) : (data.notes || ""),
        };
        if (ownerData.phone) {
          const saveRes = await fetch("/api/owners", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ownerData),
          });
          const saved = await saveRes.json();
          if (saveRes.ok) {
            setOwners(prev => [{ ...saved, properties: [] }, ...prev]);
            // Auto-create store entry
            if (data.propertyType || data.price || data.area) {
              fetch("/api/owners/store", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ownerId:         saved.id,
                  title:           data.propertyTitle || `${data.propertyType || "Property"} - ${data.locality || data.ownerName}`,
                  propertyType:    data.propertyType    || null,
                  transactionType: data.transactionType || null,
                  price:           data.price           ? Number(data.price) : null,
                  area:            data.area            ? Number(data.area)  : null,
                  floor:           data.floor           || null,
                  locality:        data.locality        || null,
                  address:         data.address         || null,
                  furnishing:      data.furnishing      || null,
                  status:          "AVAILABLE",
                  imageUrl:        data.imageUrl        || null,
                  notes:           data.amenities       || data.description  || null,
                }),
              }).catch(() => {});
            }
          }
        }
        setBatchResults(prev => prev.map((r, idx) => idx === i
          ? { ...r, status: "done", name: data.ownerName || "Unknown", phone: data.ownerPhone || "No phone" } : r));
      } catch (err: unknown) {
        setBatchResults(prev => prev.map((r, idx) => idx === i
          ? { ...r, status: "error", error: (err as Error).message || "Failed" } : r));
      }
    }

    // Process in batches of CONCURRENCY
    for (let i = 0; i < queue.length; i += CONCURRENCY) {
      await Promise.all(queue.slice(i, i + CONCURRENCY).map(processOne));
    }

    setBatchRunning(false);
    toast.success(`Batch scan complete! ${batchFiles.length} cards processed.`);
  }

  function compressImage(file: File): Promise<File> {
    return new Promise(resolve => {
      const img = new window.Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX = 1200; // keep text readable for AI
        const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
        canvas.width  = img.width  * ratio;
        canvas.height = img.height * ratio;
        canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file);
        }, "image/jpeg", 0.85);
      };
      img.src = url;
    });
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.phone) { toast.error("Phone number required"); return; }
    setSaving(true);
    try {
      // Pack all scanned property details into notes as JSON
      const hasScannedProps = scanned && (scanned.propertyType || scanned.price || scanned.area);
      const hasManualProps  = form.propertyType || form.price || form.area;
      const notesJson = hasScannedProps
        ? JSON.stringify({
            propertyTitle: scanned!.propertyTitle || null, propertyType: scanned!.propertyType || null,
            transactionType: scanned!.transactionType || null, price: scanned!.price || null,
            area: scanned!.area || null, floor: scanned!.floor || null, totalFloors: scanned!.totalFloors || null,
            furnishing: scanned!.furnishing || null, condition: scanned!.condition || null,
            brokerage: scanned!.brokerage || null, status: scanned!.status || null,
            amenities: scanned!.amenities || null, description: scanned!.description || null,
            rawNotes: scanned!.notes || null,
          })
        : hasManualProps
        ? JSON.stringify({
            propertyType: form.propertyType || null, transactionType: form.transactionType || null,
            price: form.price ? Number(form.price) : null, area: form.area ? Number(form.area) : null,
            floor: form.floor || null, furnishing: form.furnishing || null,
            amenities: form.amenities || null, rawNotes: form.notes || null,
          })
        : (form.notes || null);

      const body = { ...form, notes: notesJson, cardImageUrl: scanned?.imageUrl || null };
      const url    = editOwner ? `/api/owners/${editOwner.id}` : "/api/owners";
      const method = editOwner ? "PATCH" : "POST";
      const res  = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      if (editOwner) {
        setOwners(prev => prev.map(o => o.id === editOwner.id ? { ...o, ...data } : o));
        toast.success("Owner updated!");
      } else {
        setOwners(prev => [{ ...data, properties: [] }, ...prev]);
        toast.success("Owner saved!");

        // Auto-create store entry from scanned card data
        const sc = scanned;
        if (sc && (sc.propertyType || sc.price || sc.area)) {
          fetch("/api/owners/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerId:         data.id,
              title:           sc.propertyTitle || `${sc.propertyType || "Property"} - ${sc.locality || form.locality || form.name}`,
              propertyType:    sc.propertyType    || null,
              transactionType: sc.transactionType || null,
              price:           sc.price           ? Number(sc.price) : null,
              area:            sc.area            ? Number(sc.area)  : null,
              floor:           sc.floor           || null,
              locality:        sc.locality        || form.locality   || null,
              address:         sc.address         || form.address    || null,
              furnishing:      sc.furnishing      || null,
              status:          "AVAILABLE",
              imageUrl:        sc.imageUrl        || null,
              notes:           sc.amenities       || sc.description  || null,
            }),
          }).catch(() => {});
        } else if (!sc && (form.propertyType || form.price || form.area)) {
          // Manual entry with property details
          fetch("/api/owners/store", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ownerId:         data.id,
              title:           `${form.propertyType || "Property"} - ${form.locality || form.name}`,
              propertyType:    form.propertyType    || null,
              transactionType: form.transactionType || null,
              price:           form.price           ? Number(form.price) : null,
              area:            form.area            ? Number(form.area)  : null,
              floor:           form.floor           || null,
              locality:        form.locality        || null,
              address:         form.address         || null,
              furnishing:      form.furnishing      || null,
              status:          "AVAILABLE",
              imageUrl:        null,
              notes:           form.notes           || null,
            }),
          }).catch(() => {});
        }
      }

      // If scanned property card and user wants to save as property
      if (!editOwner && saveAsProperty && scanned && (scanned.propertyType || scanned.price)) {
        try {
          const p = scanned.price ? Number(scanned.price) : 0;
          const a = scanned.area  ? Number(scanned.area)  : 0;
          const propertyData = {
            title: scanned.propertyTitle || `${scanned.propertyType} in ${scanned.locality}`,
            type: scanned.propertyType || "OFFICE",
            category: ["APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO"].includes(String(scanned.propertyType)) ? "RESIDENTIAL" : "COMMERCIAL",
            locality: scanned.locality || "",
            address: scanned.address || form.address || "",
            price: p,
            area: a,
            description: [scanned.description, scanned.amenities, scanned.condition].filter(Boolean).join("\n\n") || "",
            transactionType: scanned.transactionType || "RENT",
            status: "AVAILABLE",
            furnishing: scanned.furnishing || "UNFURNISHED",
            floor: scanned.floor ? parseInt(String(scanned.floor)) : null,
            totalFloors: scanned.totalFloors ? parseInt(String(scanned.totalFloors)) : null,
            ownerId: data.id,
            photos: scanned.imageUrl ? [String(scanned.imageUrl)] : [],
          };

          const propRes = await fetch("/api/properties", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(propertyData),
          });

          if (propRes.ok) {
            toast.success("Property listing created too! ✨");
          }
        } catch (err: unknown) {
          console.error("Property creation error:", err);
          // Don't fail the whole flow if property creation fails
        }
      }

      setShowAdd(false); setEditOwner(null); setForm(EMPTY); setScanned(null); setSaveAsProperty(false);
    } catch (err: unknown) { toast.error((err as Error).message || "Failed to save"); }
    setSaving(false);
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Remove ${name}?`)) return;
    await fetch(`/api/owners/${id}`, { method: "DELETE" });
    setOwners(prev => prev.filter(o => o.id !== id));
    toast.success("Owner removed");
  }

  function openEdit(owner: Owner) {
    setEditOwner(owner);
    const pd = parseOwnerNotes(owner.notes);
    setForm({
      name: owner.name, phone: owner.phone, phone2: owner.phone2 || "",
      email: owner.email || "", company: owner.company || "",
      address: owner.address || "", locality: owner.locality || "",
      notes: typeof owner.notes === "string" && !owner.notes.startsWith("{") ? owner.notes : "",
      propertyType: pd?.propertyType || "", transactionType: pd?.transactionType || "",
      price: pd?.price ? String(pd.price) : "", area: pd?.area ? String(pd.area) : "",
      floor: pd?.floor ? String(pd.floor) : "", furnishing: pd?.furnishing || "",
      amenities: pd?.amenities || "",
    });
    setScanned(owner.cardImageUrl ? { imageUrl: owner.cardImageUrl } : null);
    setShowAdd(true);
  }

  function addPropertyFromOwner(owner: Owner) {
    const params = new URLSearchParams({
      ownerName:  owner.name,
      ownerPhone: owner.phone,
      ownerId:    owner.id,
      locality:   owner.locality || "",
    });
    window.location.href = `/properties?${params}`;
  }

  function sendWhatsApp(owner: Owner) {
    const clean = owner.phone.replace(/\D/g, "").slice(-10);
    const msg = WA_COMPANY_MSG(owner.name);
    window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  async function viewMessages(owner: Owner) {
    setSelectedOwner(owner);
    setMessagesLoading(true);
    setShowMessages(true);
    try {
      const res = await fetch(`/api/owners/${owner.id}/messages`);
      const data = await res.json();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err: unknown) {
      toast.error("Failed to load messages");
      console.error(err);
    }
    setMessagesLoading(false);
  }

  function addOwnerAsLead(owner: Owner) {
    setSelectedOwner(owner);
    setShowConvertLead(true);
    setLeadForm({ source: "WALK_IN", budget: "", requirements: "" });
  }

  async function handleConvertToLead(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOwner) return;
    
    setConvertingLead(true);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: selectedOwner.name,
          phone: selectedOwner.phone,
          email: selectedOwner.email || undefined,
          source: leadForm.source,
          budget: leadForm.budget ? parseInt(leadForm.budget) : undefined,
          requirements: leadForm.requirements || undefined,
          status: "CONTACTED",
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      toast.success(`✅ ${selectedOwner.name} added as Lead`);
      setShowConvertLead(false);
      setSelectedOwner(null);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create lead");
    }
    setConvertingLead(false);
  }

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(o => o.id)));
    }
  }

  async function uploadBlastImage(file: File) {
    setUploadingBlastImg(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("folder", "blast");
    const res = await fetch("/api/upload", { method: "POST", body: fd });
    const data = await res.json();
    if (data.url) { setBlastImage(data.url); toast.success("Image uploaded!"); }
    else toast.error("Upload failed");
    setUploadingBlastImg(false);
  }

  async function startBlast() {
    const targets = filtered.filter(o => selectedIds.has(o.id));
    if (!targets.length) return;
    setBlasting(true);
    setBlastIndex(0);

    for (let i = 0; i < targets.length; i++) {
      const owner = targets[i];
      setBlastIndex(i + 1);
      const clean = owner.phone.replace(/\D/g, "").replace(/^91/, "").slice(-10);
      const msg = blastMsg.replace(/\{name\}/g, owner.name) + (blastImage ? `\n\n📎 ${blastImage}` : "");

      // Save to message thread
      await fetch(`/api/owners/${owner.id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, direction: "OUT" }),
      }).catch(() => {});

      // Open WA (browser will open each tab)
      window.open(`https://wa.me/91${clean}?text=${encodeURIComponent(msg)}`, "_blank");

      // 2s delay between each to avoid browser blocking
      if (i < targets.length - 1) await new Promise(r => setTimeout(r, 2000));
    }

    setBlasting(false);
    setShowBlast(false);
    setSelectMode(false);
    setSelectedIds(new Set());
    setBlastImage(null);
    toast.success(`✅ Blast sent to ${targets.length} owners!`);
  }

  async function exportExcel() {
    const XLSX = await import("xlsx");
    const rows = owners.map((o, i) => {
      const pd = parseOwnerNotes(o.notes);
      return {
        "Sr.": i + 1,
        "Name": o.name,
        "Phone": o.phone,
        "Phone 2": o.phone2 || "",
        "Email": o.email || "",
        "Company": o.company || "",
        "Locality": o.locality || "",
        "Address": o.address || "",
        "Property Type": pd?.propertyType || "",
        "Transaction": pd?.transactionType || "",
        "Price (₹)": pd?.price ? Number(pd.price).toLocaleString("en-IN") : "",
        "Area (sqft)": pd?.area || "",
        "Floor": pd?.floor || "",
        "Furnishing": pd?.furnishing || "",
        "Amenities": pd?.amenities || "",
        "Status": pd?.status || "",
        "Brokerage": pd?.brokerage || "",
        "Properties": o.properties.length,
        "Notes": pd?.rawNotes || (!o.notes?.startsWith("{") ? o.notes : "") || "",
        "Added On": new Date(o.createdAt).toLocaleDateString("en-IN"),
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);

    ws["!cols"] = [
      { wch: 5 }, { wch: 22 }, { wch: 14 }, { wch: 14 }, { wch: 25 },
      { wch: 20 }, { wch: 18 }, { wch: 30 }, { wch: 15 }, { wch: 12 },
      { wch: 15 }, { wch: 12 }, { wch: 8 }, { wch: 15 }, { wch: 35 },
      { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 25 }, { wch: 12 },
    ];
    ws["!autofilter"] = { ref: "A1:T1" };

    XLSX.utils.book_append_sheet(wb, ws, "Property Owners");
    XLSX.writeFile(wb, `CRS-Owners-${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exported! 📊");
  }

  // ── Clients functions ──
  async function fetchClients() {
    setClientsLoading(true);
    try {
      const res  = await fetch("/api/leads?limit=500");
      const data = await res.json();
      setClients(Array.isArray(data.leads) ? data.leads : []);
    } catch { toast.error("Failed to load clients"); }
    setClientsLoading(false);
  }

  useEffect(() => { if (activeTab === "clients" && clients.length === 0) fetchClients(); }, [activeTab]);

  async function handleAddClient(e: React.FormEvent) {
    e.preventDefault();
    setSavingClient(true);
    try {
      const res  = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...clientForm,
          budget: clientForm.budget ? parseFloat(clientForm.budget) : undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 409) { toast.error("Duplicate! Phone already exists."); }
      else if (res.ok) {
        toast.success(`${clientForm.name} added!`);
        setClients(prev => [data.lead, ...prev]);
        setShowAddClient(false);
        setClientForm({ name: "", phone: "", email: "", source: "WALK_IN", budget: "", requirements: "", propertyType: "", transactionType: "BUY" });
      } else { toast.error(data.error || "Failed"); }
    } catch { toast.error("Network error"); }
    setSavingClient(false);
  }

  async function handleClientExcelImport(file: File) {
    setClientImporting(true);
    try {
      const XLSX = await import("xlsx");
      const buf  = await file.arrayBuffer();
      const wb   = XLSX.read(buf, { type: "buffer" });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "" }) as Record<string, any>[];
      if (!rows.length) { toast.error("File is empty"); setClientImporting(false); return; }

      function getV(row: Record<string, any>, ...keys: string[]) {
        for (const k of keys) {
          const found = Object.keys(row).find(rk =>
            rk.toLowerCase().replace(/[\s_\-]/g, "").includes(k.toLowerCase().replace(/[\s_\-]/g, ""))
          );
          if (found && row[found] !== "" && row[found] !== undefined) return String(row[found]).trim();
        }
        return "";
      }

      let imported = 0, dupes = 0, errors = 0;
      const newClients: Client[] = [];

      for (const row of rows) {
        try {
          const name  = getV(row, "name", "clientname", "customer", "contact", "person");
          const phone = getV(row, "phone", "mobile", "contact", "number", "cell").replace(/\D/g, "").slice(-10);
          if (!phone || phone.length < 10) { errors++; continue; }

          const email    = getV(row, "email", "mail");
          const budget   = getV(row, "budget", "price", "amount");
          const propType = getV(row, "propertytype", "type", "property");
          const txnType  = getV(row, "transactiontype", "transaction", "buysell");
          const req      = getV(row, "requirements", "notes", "remarks", "requirement");
          const source   = getV(row, "source", "leadsource") || "WALK_IN";

          const res  = await fetch("/api/leads", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: name || "Unknown", phone, email: email || undefined,
              source: source.toUpperCase().replace(/\s/g, "_"),
              budget: budget ? parseFloat(budget.replace(/[^0-9.]/g, "")) || undefined : undefined,
              propertyType: propType.toUpperCase() || undefined,
              transactionType: txnType.toUpperCase() || undefined,
              requirements: req || undefined,
            }),
          });
          const data = await res.json();
          if (res.status === 409) { dupes++; }
          else if (res.ok) { imported++; newClients.push(data.lead); }
          else { errors++; }
        } catch { errors++; }
      }

      setClients(prev => [...newClients, ...prev]);
      toast.success(`✅ ${imported} clients imported! ${dupes} duplicates, ${errors} errors.`);
    } catch (err: any) { toast.error(err.message || "Import failed"); }
    setClientImporting(false);
  }

  async function handleClientScan(file: File) {
    setClientScanning(true);
    try {
      const compressed = await compressImage(file);
      const fd = new FormData();
      fd.append("file", compressed);
      fd.append("saveOwner", "false");
      const res  = await fetch("/api/ai/scan-card", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Scan failed");

      const phone = (data.ownerPhone || "").replace(/\D/g, "").slice(-10);
      if (!phone) { toast.error("Phone number not found on card"); setClientScanning(false); return; }

      // Save as lead/client
      const leadRes = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.ownerName || "Unknown",
          phone,
          email: data.ownerEmail || undefined,
          source: "WALK_IN",
          requirements: [data.propertyType, data.locality, data.transactionType].filter(Boolean).join(" · ") || undefined,
          budget: data.price ? Number(data.price) : undefined,
          propertyType: data.propertyType || undefined,
          transactionType: data.transactionType === "SELL" ? "BUY" : data.transactionType || undefined,
        }),
      });
      const leadData = await leadRes.json();
      if (leadRes.status === 409) {
        toast.error(`Duplicate! ${data.ownerName} already exists as client`);
      } else if (leadRes.ok) {
        setClients(prev => [leadData.lead, ...prev]);
        toast.success(`✅ ${data.ownerName} added as Client!`);
      } else {
        toast.error(leadData.error || "Failed to save client");
      }
    } catch (err: unknown) {
      toast.error((err as Error).message || "Scan failed");
    }
    setClientScanning(false);
  }

  const fmtBudget = (b?: number) => {
    if (!b) return null;
    return b >= 10000000 ? `₹${(b/10000000).toFixed(1)}Cr` : b >= 100000 ? `₹${(b/100000).toFixed(1)}L` : `₹${(b/1000).toFixed(0)}K`;
  };

  // ── Smart Owner-Client Property Match (Real Estate Logic) ──
  function matchScore(owner: Owner, client: Client): number {
    const pd         = parseOwnerNotes(owner.notes);
    const ownerProps = owner.properties;

    const ownerType     = (pd?.propertyType     || ownerProps[0]?.type            || "").toUpperCase();
    const ownerTxn      = (pd?.transactionType  || ownerProps[0]?.transactionType || "").toUpperCase();
    const ownerPrice    = Number(pd?.price       || ownerProps[0]?.price           || 0);
    const ownerLocality = (owner.locality        || pd?.locality                   || "").toLowerCase();
    const ownerAddress  = (owner.address         || "").toLowerCase();

    const clientType   = (client.propertyType    || "").toUpperCase();
    const clientTxn    = (client.transactionType || "").toUpperCase();
    const clientBudget = client.budget            || 0;
    const clientReq    = (client.requirements    || "").toLowerCase();

    // No owner property data at all = skip
    if (!ownerType && ownerProps.length === 0 && !ownerPrice) return 0;

    let score = 0;
    let reasons: string[] = [];

    // ── 1. Property Type match (35 pts) ──
    if (clientType && ownerType) {
      if (clientType === ownerType) {
        score += 35;
      } else {
        // Commercial group: OFFICE, SHOP, SHOWROOM, WAREHOUSE, COMMERCIAL_LAND, INDUSTRIAL
        // Residential group: APARTMENT, VILLA, PLOT, PENTHOUSE, STUDIO
        const commercial = ["OFFICE","SHOP","SHOWROOM","WAREHOUSE","COMMERCIAL_LAND","INDUSTRIAL"];
        const residential = ["APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO"];
        const sameGroup =
          (commercial.includes(clientType) && commercial.includes(ownerType)) ||
          (residential.includes(clientType) && residential.includes(ownerType));
        if (sameGroup) score += 12; // same category, different type — partial
        else return 0; // completely different category — no match
      }
    } else if (!clientType && ownerType) {
      score += 12; // client didn't specify type
    } else if (clientType && !ownerType) {
      score += 8;  // owner has no type info
    }

    // ── 2. Transaction Type match (30 pts) ──
    // Real estate: owner SELL → client BUY, owner RENT → client RENT/LEASE
    const txnMatch =
      (ownerTxn === "SELL"  && (clientTxn === "BUY"  || clientTxn === "SELL")) ||
      (ownerTxn === "BUY"   && (clientTxn === "SELL" || clientTxn === "BUY"))  ||
      (ownerTxn === "RENT"  && (clientTxn === "RENT" || clientTxn === "LEASE" || clientTxn === "BUY")) ||
      (ownerTxn === "LEASE" && (clientTxn === "LEASE"|| clientTxn === "RENT"  || clientTxn === "BUY"));

    if (clientTxn && ownerTxn) {
      if (txnMatch) score += 30;
      else return 0; // hard mismatch — e.g. client wants RENT but owner wants to SELL
    } else {
      score += 10; // one side missing — partial credit
    }

    // ── 3. Budget vs Price — negotiable ±25% (25 pts) ──
    if (clientBudget > 0 && ownerPrice > 0) {
      const ratio = ownerPrice / clientBudget;
      if (ratio <= 1.0)                    score += 25; // owner price within budget ✅
      else if (ratio <= 1.10)              score += 20; // up to 10% over — negotiable
      else if (ratio <= 1.20)              score += 14; // up to 20% over — possible
      else if (ratio <= 1.30)              score += 6;  // up to 30% over — stretch
      else                                 return 0;    // >30% over budget — skip
    } else if (clientBudget > 0 || ownerPrice > 0) {
      score += 10; // partial info
    } else {
      score += 8;  // no price info at all
    }

    // ── 4. Locality / Area match (10 pts) ──
    // Check owner locality against client requirements text
    const localityWords = ownerLocality.split(/[\s,]+/).filter(w => w.length > 2);
    const addressWords  = ownerAddress.split(/[\s,]+/).filter(w => w.length > 3);
    const allLocWords   = [...new Set([...localityWords, ...addressWords])];

    if (allLocWords.length > 0 && clientReq) {
      const matchCount = allLocWords.filter(w => clientReq.includes(w)).length;
      if (matchCount >= 2)      score += 10;
      else if (matchCount === 1) score += 6;
    } else if (ownerLocality && clientReq.includes(ownerLocality.slice(0, 4))) {
      score += 5; // partial locality match
    }

    // Minimum threshold — only meaningful matches
    return score >= 45 ? Math.min(score, 100) : 0;
  }

  // For each owner, find best matching clients
  function getBestClientMatches(owner: Owner): Array<{ client: Client; score: number }> {
    if (!clients.length) return [];
    return clients
      .map(c => ({ client: c, score: matchScore(owner, c) }))
      .filter(m => m.score >= 45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  function getBestOwnerMatches(client: Client): Array<{ owner: Owner; score: number }> {
    if (!owners.length) return [];
    return owners
      .map(o => ({ owner: o, score: matchScore(o, client) }))
      .filter(m => m.score >= 45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }

  // Owner-Client phone match set (exact same person)
  const ownerPhoneSet = new Set(owners.map(o => o.phone.replace(/\D/g, "").slice(-10)));

  const filteredClients = clients.filter(c =>
    !clientSearch ||
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.phone.includes(clientSearch) ||
    (c.requirements || "").toLowerCase().includes(clientSearch.toLowerCase())
  );

  const filtered = owners.filter(o => {
    // Text search — also search inside scanned notes
    const pd = parseOwnerNotes(o.notes);
    const textMatch = search.length === 0 ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.phone.includes(search) ||
      (o.phone2 || "").includes(search) ||
      (o.locality || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.company  || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.address  || "").toLowerCase().includes(search.toLowerCase()) ||
      (pd?.propertyType  || "").toLowerCase().includes(search.toLowerCase()) ||
      (pd?.locality      || "").toLowerCase().includes(search.toLowerCase()) ||
      (pd?.amenities     || "").toLowerCase().includes(search.toLowerCase()) ||
      (pd?.rawNotes      || "").toLowerCase().includes(search.toLowerCase());

    if (!textMatch) return false;

    // Property type filter — check scanned notes first, then linked DB properties
    if (filterType !== "ALL") {
      const scannedType = (pd?.propertyType || "").toUpperCase();
      const dbHasType   = o.properties.some(p => p.type === filterType);
      if (scannedType !== filterType && !dbHasType) return false;
    }

    // Budget filter — check scanned price first, then linked DB properties
    if (filterBudget !== "ALL") {
      const budgetRanges: Record<string, [number, number]> = {
        "LOW":    [0,        5_000_000],
        "MID":    [5_000_000, 15_000_000],
        "HIGH":   [15_000_000, 50_000_000],
        "LUXURY": [50_000_000, Infinity],
      };
      const [min, max] = budgetRanges[filterBudget] || [0, Infinity];
      const scannedPrice = pd?.price ? Number(pd.price) : null;
      const scannedInRange = scannedPrice !== null && scannedPrice >= min && scannedPrice <= max;
      const dbInRange = o.properties.some(p => p.price >= min && p.price <= max);
      if (!scannedInRange && !dbInRange) return false;
    }

    // Transaction type filter — check scanned notes first, then linked DB properties
    if (filterTransaction !== "ALL") {
      const scannedTxn = (pd?.transactionType || "").toUpperCase();
      const txnMatch = (t: string) =>
        filterTransaction === "RENT" ? (t === "RENT" || t === "LEASE") :
        filterTransaction === "SELL" ? (t === "SELL" || t === "BUY")  :
        t === filterTransaction;
      const dbHasTxn = o.properties.some(p => txnMatch(p.transactionType));
      if (!txnMatch(scannedTxn) && !dbHasTxn) return false;
    }

    // Locality filter — owner.locality OR scanned pd.locality
    if (filterLocality !== "ALL") {
      const ownerLoc   = (o.locality || "").toLowerCase().trim();
      const scannedLoc = (pd?.locality || "").toLowerCase().trim();
      const filterLoc  = filterLocality.toLowerCase();
      if (!ownerLoc.includes(filterLoc) && !scannedLoc.includes(filterLoc)) return false;
    }

    // Scanned card filter
    if (filterScanned === "SCANNED" && !o.cardImageUrl) return false;
    if (filterScanned === "NO_CARD" && o.cardImageUrl) return false;

    return true;
  });

  // Dynamic locality list from all owners (owner.locality + scanned pd.locality)
  const localityOptions = Array.from(new Set(
    owners.flatMap(o => {
      const pd = parseOwnerNotes(o.notes);
      return [
        (o.locality || "").trim(),
        (pd?.locality || "").trim(),
      ].filter(Boolean);
    })
  )).sort();

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/10 w-fit">
        <button onClick={() => setActiveTab("owners")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "owners"
              ? "bg-estate-600/40 border border-estate-500/50 text-estate-300"
              : "text-muted-foreground hover:text-white"
          }`}>
          <Building2 className="w-4 h-4" /> Property Owners
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">{owners.length}</span>
        </button>
        <button onClick={() => setActiveTab("clients")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "clients"
              ? "bg-blue-600/40 border border-blue-500/50 text-blue-300"
              : "text-muted-foreground hover:text-white"
          }`}>
          <Users className="w-4 h-4" /> Clients
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">{clients.length}</span>
        </button>
        <button onClick={() => setActiveTab("store")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "store"
              ? "bg-emerald-600/40 border border-emerald-500/50 text-emerald-300"
              : "text-muted-foreground hover:text-white"
          }`}>
          <Building2 className="w-4 h-4" /> Property Store
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-white/10">{storeItems.length}</span>
        </button>
      </div>

      {/* ════ CLIENTS TAB ════ */}
      {activeTab === "clients" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Clients</h1>
              <p className="text-sm text-muted-foreground mt-1">{filteredClients.length}/{clients.length} clients · Call, WA, Email directly from here</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => clientImportRef.current?.click()} disabled={clientImporting}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 text-sm font-medium transition-all disabled:opacity-50">
                {clientImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4" />}
                {clientImporting ? "Importing..." : "Import Excel"}
              </button>
              <input ref={clientImportRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleClientExcelImport(f); e.target.value = ""; }} />
              <button onClick={fetchClients} className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => clientScanRef.current?.click()} disabled={clientScanning}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30 text-sm font-medium transition-all disabled:opacity-50">
                {clientScanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
                {clientScanning ? "Scanning..." : "Scan Card"}
              </button>
              <input ref={clientScanRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleClientScan(f); e.target.value = ""; }} />
              <button onClick={() => setShowAddClient(true)}
                className="btn-primary flex items-center gap-2 text-sm">
                <UserPlus className="w-4 h-4" /> Add Client
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={clientSearch} onChange={e => setClientSearch(e.target.value)}
              placeholder="Search by name, phone, requirements..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-blue-500/50" />
          </div>

          {/* Client List */}
          {clientsLoading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => <div key={i} className="glass-card p-4 h-20 animate-pulse bg-white/5" />)}
            </div>
          ) : filteredClients.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No clients yet.</p>
              <p className="text-xs mt-1 opacity-60">Import from Excel or add manually</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredClients.map(client => {
                const clientPhone = client.phone.replace(/\D/g, "").slice(-10);
                const isOwnerMatch = ownerPhoneSet.has(clientPhone);
                const matchedOwner = isOwnerMatch ? owners.find(o => o.phone.replace(/\D/g,"").slice(-10) === clientPhone) : null;
                const dealMatches  = getBestOwnerMatches(client);
                const topDeal      = dealMatches[0];
                return (
                <motion.div key={client.id}
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className={`glass-card p-4 flex flex-col md:flex-row md:items-start gap-3 ${
                    isOwnerMatch ? "border-orange-500/40 bg-orange-500/5" :
                    topDeal?.score >= 80 ? "border-emerald-500/25 bg-emerald-500/3" :
                    topDeal?.score >= 60 ? "border-gold-500/20" : ""
                  }`}>

                  {/* Avatar + Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      isOwnerMatch ? "bg-orange-500/20 text-orange-300" : "bg-blue-500/20 text-blue-300"
                    }`}>
                      {client.name[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-white text-sm">{client.name}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                          client.score >= 80 ? "bg-red-500/15 border-red-500/20 text-red-400" :
                          client.score >= 60 ? "bg-orange-500/15 border-orange-500/20 text-orange-400" :
                          "bg-blue-500/15 border-blue-500/20 text-blue-400"
                        }`}>
                          {client.score >= 80 ? "🔥 HOT" : client.score >= 60 ? "🌡️ WARM" : "❄️ COLD"} {client.score}
                        </span>
                        {isOwnerMatch && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-medium">
                            🏠 Owner: {matchedOwner?.company || matchedOwner?.locality || "Matched"}
                          </span>
                        )}
                        {client.propertyType && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">{client.propertyType}</span>
                        )}
                        {client.transactionType && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{client.transactionType}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{client.phone}</span>
                        {client.email && <span className="text-xs text-muted-foreground">{client.email}</span>}
                        {client.budget && <span className="text-xs font-semibold text-gold-400">{fmtBudget(client.budget)}</span>}
                        <span className="text-xs px-1.5 py-0.5 rounded bg-white/5 text-muted-foreground">{client.source.replace(/_/g, " ")}</span>
                      </div>
                      {client.requirements && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">📋 {client.requirements}</p>
                      )}
                      {isOwnerMatch && matchedOwner && (
                        <div className="mt-1 flex items-center gap-1.5 text-xs text-orange-400/80">
                          <Building2 className="w-3 h-3" />
                          <span>Same person: {matchedOwner.locality || ""} {parseOwnerNotes(matchedOwner.notes)?.propertyType ? "· " + parseOwnerNotes(matchedOwner.notes)?.propertyType : ""}</span>
                        </div>
                      )}
                      {/* Property Deal Matches — clickable */}
                      {(() => {
                        const matches = getBestOwnerMatches(client);
                        if (!matches.length) return null;
                        return (
                          <div className="mt-1.5 space-y-1">
                            {matches.map(({ owner: mo, score: ms }) => {
                              const mpd    = parseOwnerNotes(mo.notes);
                              const mPrice = mpd?.price || mo.properties[0]?.price;
                              const mType  = mpd?.propertyType || mo.properties[0]?.type;
                              const mTxn   = mpd?.transactionType || mo.properties[0]?.transactionType;
                              return (
                                <button key={mo.id} type="button"
                                  onClick={() => setSelectedMatchOwner(mo)}
                                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left cursor-pointer transition-all hover:scale-[1.01] ${
                                    ms >= 80 ? "bg-emerald-500/15 border border-emerald-500/20" :
                                    ms >= 60 ? "bg-gold-500/10 border border-gold-500/20" :
                                    "bg-white/5 border border-white/10"
                                  }`}>
                                  <span className={`font-bold flex-shrink-0 ${
                                    ms >= 80 ? "text-emerald-400" : ms >= 60 ? "text-gold-400" : "text-muted-foreground"
                                  }`}>{ms}%</span>
                                  <span className="text-white font-medium truncate flex-1">{mo.name}</span>
                                  {mType && <span className="text-muted-foreground flex-shrink-0">{TYPE_ICON[mType] || ""}{mType}</span>}
                                  {mTxn && <span className="text-muted-foreground flex-shrink-0">· {mTxn}</span>}
                                  {mPrice ? <span className="text-gold-400 font-semibold flex-shrink-0 ml-auto">{fmtPrice(Number(mPrice), String(mTxn || ""))}</span> : null}
                                  {mo.locality && <span className="text-muted-foreground flex-shrink-0">· {mo.locality}</span>}
                                  <span className="text-muted-foreground flex-shrink-0">→</span>
                                </button>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Action Buttons — Call, WA, Email, SMS */}
                  <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                    <a href={`tel:${client.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/25 transition-all">
                      <Phone className="w-3.5 h-3.5" /> Call
                    </a>
                    <a href={`https://wa.me/91${client.phone.replace(/\D/g,"").slice(-10)}`} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-all">
                      <MessageSquare className="w-3.5 h-3.5" /> WA
                    </a>
                    {client.email && (
                      <a href={`mailto:${client.email}`}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/25 transition-all">
                        <Mail className="w-3.5 h-3.5" /> Email
                      </a>
                    )}
                    <a href={`sms:${client.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/25 transition-all">
                      <MessageCircle className="w-3.5 h-3.5" /> SMS
                    </a>
                  </div>
                </motion.div>
                );
              })}
            </div>
          )}

          {/* Add Client Modal */}
          <AnimatePresence>
            {showAddClient && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={e => e.target === e.currentTarget && setShowAddClient(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="glass-card w-full max-w-md p-6">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white">Add Client</h2>
                    <button onClick={() => setShowAddClient(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleAddClient} className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
                        <input required value={clientForm.name} onChange={e => setClientForm(f => ({ ...f, name: e.target.value }))}
                          placeholder="Rajesh Patel"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                        <input required value={clientForm.phone} onChange={e => setClientForm(f => ({ ...f, phone: e.target.value }))}
                          placeholder="9876543210"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                      <input type="email" value={clientForm.email} onChange={e => setClientForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="client@email.com"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Source</label>
                        <select value={clientForm.source} onChange={e => setClientForm(f => ({ ...f, source: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                          {["WALK_IN","WHATSAPP","REFERRAL","WEBSITE","FACEBOOK","GOOGLE_BUSINESS","COLD_CALL","OTHER"].map(s => (
                            <option key={s} value={s} className="bg-[#0f1f35]">{s.replace(/_/g, " ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Budget (₹)</label>
                        <input type="number" value={clientForm.budget} onChange={e => setClientForm(f => ({ ...f, budget: e.target.value }))}
                          placeholder="5000000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Property Type</label>
                        <select value={clientForm.propertyType} onChange={e => setClientForm(f => ({ ...f, propertyType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                          <option value="">Select</option>
                          {["OFFICE","SHOP","SHOWROOM","WAREHOUSE","APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO"].map(t => (
                            <option key={t} value={t} className="bg-[#0f1f35]">{t}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Transaction</label>
                        <select value={clientForm.transactionType} onChange={e => setClientForm(f => ({ ...f, transactionType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500/50">
                          {["BUY","RENT","LEASE","SELL"].map(t => (
                            <option key={t} value={t} className="bg-[#0f1f35]">{t}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Requirements</label>
                      <textarea rows={2} value={clientForm.requirements} onChange={e => setClientForm(f => ({ ...f, requirements: e.target.value }))}
                        placeholder="2 BHK in Satellite, near metro..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500/50 resize-none" />
                    </div>
                    <div className="flex gap-3 pt-1">
                      <button type="button" onClick={() => setShowAddClient(false)}
                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">Cancel</button>
                      <button type="submit" disabled={savingClient}
                        className="flex-1 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                        {savingClient ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        {savingClient ? "Saving..." : "Add Client"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ════ STORE TAB ════ */}
      {activeTab === "store" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">Property Store 🏢</h1>
              <p className="text-sm text-muted-foreground mt-1">{filteredStore.length}/{storeItems.length} properties · Date wise sorted</p>
            </div>
            <button onClick={() => { setStoreForm(STORE_EMPTY); setShowAddStore(true); }}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Property
            </button>
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={storeSearch} onChange={e => setStoreSearch(e.target.value)}
                placeholder="Search property, owner, locality..."
                className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-emerald-500/50 w-56" />
            </div>
            <select value={storeFilterTxn} onChange={e => setStoreFilterTxn(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground focus:outline-none">
              <option value="ALL">All Types</option>
              <option value="RENT">🔑 Rent</option>
              <option value="SELL">💰 Sell</option>
              <option value="LEASE">📜 Lease</option>
            </select>
            <select value={storeFilterType} onChange={e => setStoreFilterType(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground focus:outline-none">
              <option value="ALL">All Property Types</option>
              {["OFFICE","SHOP","SHOWROOM","WAREHOUSE","APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO","COMMERCIAL_LAND","INDUSTRIAL"].map(t => (
                <option key={t} value={t}>{TYPE_ICON[t]} {t.replace(/_/g," ")}</option>
              ))}
            </select>
            <select value={storeFilterStatus} onChange={e => setStoreFilterStatus(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground focus:outline-none">
              <option value="ALL">All Status</option>
              <option value="AVAILABLE">✅ Available</option>
              <option value="RENTED">🔑 Rented</option>
              <option value="SOLD">🏠 Sold</option>
            </select>
            {(storeSearch || storeFilterType !== "ALL" || storeFilterTxn !== "ALL" || storeFilterStatus !== "ALL") && (
              <button onClick={() => { setStoreSearch(""); setStoreFilterType("ALL"); setStoreFilterTxn("ALL"); setStoreFilterStatus("ALL"); }}
                className="px-2 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-xs text-red-400">✕ Clear</button>
            )}
          </div>

          {/* Store Grid */}
          {storeLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1,2,3].map(i => <div key={i} className="glass-card h-48 animate-pulse bg-white/5" />)}
            </div>
          ) : filteredStore.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No properties in store yet.</p>
              <p className="text-xs mt-1 opacity-60">Add owner's property here</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredStore.map(item => (
                <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="glass-card overflow-hidden">
                  {/* Property Image */}
                  <div className="relative h-36 bg-white/5">
                    {item.imageUrl ? (
                      <Image src={item.imageUrl} alt={item.title} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">
                        {TYPE_ICON[item.propertyType || ""] || "🏢"}
                      </div>
                    )}
                    {/* Status badge */}
                    <div className={`absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-medium ${
                      item.status === "AVAILABLE" ? "bg-emerald-500/80 text-white" :
                      item.status === "RENTED"    ? "bg-blue-500/80 text-white" :
                      "bg-red-500/80 text-white"
                    }`}>{item.status}</div>
                    {/* Date badge */}
                    <div className="absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full bg-black/60 text-white">
                      📅 {new Date(item.listedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </div>
                  </div>

                  <div className="p-3 space-y-2">
                    {/* Title + Type */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-white text-sm truncate">{item.title}</p>
                        {item.locality && <p className="text-xs text-muted-foreground">📍 {item.locality}</p>}
                      </div>
                      <button onClick={() => deleteStoreItem(item.id)}
                        className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-1">
                      {item.propertyType && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400">
                          {TYPE_ICON[item.propertyType]} {item.propertyType}
                        </span>
                      )}
                      {item.transactionType && (
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TX_COLOR[item.transactionType] || "bg-white/5 border-white/10 text-muted-foreground"}`}>
                          {item.transactionType}
                        </span>
                      )}
                    </div>

                    {/* Price + Area */}
                    {(item.price || item.area) && (
                      <div className="flex gap-3">
                        {item.price && (
                          <div className="text-center p-1.5 rounded-lg bg-white/5 flex-1">
                            <div className="text-xs font-bold text-gold-400">{fmtPrice(item.price, item.transactionType || "")}</div>
                            <div className="text-xs text-muted-foreground">Price</div>
                          </div>
                        )}
                        {item.area && (
                          <div className="text-center p-1.5 rounded-lg bg-white/5 flex-1">
                            <div className="text-xs font-bold text-white">{item.area}</div>
                            <div className="text-xs text-muted-foreground">Sq.ft</div>
                          </div>
                        )}
                        {item.floor && (
                          <div className="text-center p-1.5 rounded-lg bg-white/5 flex-1">
                            <div className="text-xs font-bold text-white">{item.floor}</div>
                            <div className="text-xs text-muted-foreground">Floor</div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Owner */}
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-estate-500/20 flex items-center justify-center text-xs font-bold text-estate-400">
                          {item.owner.name[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-white">{item.owner.name}</p>
                          <p className="text-xs text-muted-foreground">{item.owner.phone}</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <a href={`tel:${item.owner.phone}`}
                          className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all">
                          <Phone className="w-3 h-3" />
                        </a>
                        <a href={`https://wa.me/91${item.owner.phone.replace(/\D/g,"").slice(-10)}`} target="_blank" rel="noreferrer"
                          className="p-1.5 rounded-lg bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-all">
                          <MessageSquare className="w-3 h-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Add Property Modal */}
          <AnimatePresence>
            {showAddStore && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                onClick={e => e.target === e.currentTarget && setShowAddStore(false)}>
                <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                  className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-white">🏢 Add to Property Store</h2>
                    <button onClick={() => setShowAddStore(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                  </div>
                  <form onSubmit={handleSaveStore} className="space-y-3">
                    {/* Owner select */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Owner *</label>
                      <select required value={storeForm.ownerId} onChange={e => {
                        const o = owners.find(x => x.id === e.target.value);
                        setStoreForm(f => ({ ...f, ownerId: e.target.value, locality: o?.locality || f.locality }));
                      }} className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                        <option value="">Select owner...</option>
                        {owners.map(o => (
                          <option key={o.id} value={o.id} className="bg-[#0f1f35]">{o.name} · {o.phone}</option>
                        ))}
                      </select>
                    </div>
                    {/* Title */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Property Title *</label>
                      <input required value={storeForm.title} onChange={e => setStoreForm(f => ({ ...f, title: e.target.value }))}
                        placeholder="e.g. 2BHK Flat in Satellite"
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50" />
                    </div>
                    {/* Type + Transaction */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Property Type</label>
                        <select value={storeForm.propertyType} onChange={e => setStoreForm(f => ({ ...f, propertyType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                          <option value="">Select</option>
                          {["OFFICE","SHOP","SHOWROOM","WAREHOUSE","APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO","COMMERCIAL_LAND","INDUSTRIAL"].map(t => (
                            <option key={t} value={t} className="bg-[#0f1f35]">{t.replace(/_/g," ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Transaction</label>
                        <select value={storeForm.transactionType} onChange={e => setStoreForm(f => ({ ...f, transactionType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                          <option value="">Select</option>
                          <option value="RENT">RENT</option>
                          <option value="SELL">SELL</option>
                          <option value="LEASE">LEASE</option>
                        </select>
                      </div>
                    </div>
                    {/* Price + Area + Floor */}
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
                        <input type="number" value={storeForm.price} onChange={e => setStoreForm(f => ({ ...f, price: e.target.value }))}
                          placeholder="5000000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Area (sqft)</label>
                        <input type="number" value={storeForm.area} onChange={e => setStoreForm(f => ({ ...f, area: e.target.value }))}
                          placeholder="1200"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Floor</label>
                        <input value={storeForm.floor} onChange={e => setStoreForm(f => ({ ...f, floor: e.target.value }))}
                          placeholder="3"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                    {/* Locality + Date */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Locality</label>
                        <input value={storeForm.locality} onChange={e => setStoreForm(f => ({ ...f, locality: e.target.value }))}
                          placeholder="Satellite, Prahlad Nagar..."
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Listed Date</label>
                        <input type="date" value={storeForm.listedAt} onChange={e => setStoreForm(f => ({ ...f, listedAt: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                      </div>
                    </div>
                    {/* Status + Furnishing */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                        <select value={storeForm.status} onChange={e => setStoreForm(f => ({ ...f, status: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                          <option value="AVAILABLE">Available</option>
                          <option value="RENTED">Rented</option>
                          <option value="SOLD">Sold</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Furnishing</label>
                        <select value={storeForm.furnishing} onChange={e => setStoreForm(f => ({ ...f, furnishing: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                          <option value="">Select</option>
                          <option value="FURNISHED">Furnished</option>
                          <option value="SEMI_FURNISHED">Semi Furnished</option>
                          <option value="UNFURNISHED">Unfurnished</option>
                        </select>
                      </div>
                    </div>
                    {/* Image Upload */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">📸 Property Photo</label>
                      {storeForm.imageUrl ? (
                        <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                          <Image src={storeForm.imageUrl} alt="prop" width={60} height={60} className="rounded-lg object-cover flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs text-emerald-400">✅ Photo uploaded</p>
                          </div>
                          <button type="button" onClick={() => setStoreForm(f => ({ ...f, imageUrl: "" }))} className="text-red-400">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => storeImgRef.current?.click()} disabled={uploadingStoreImg}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-white/5 border border-dashed border-white/20 text-xs text-muted-foreground hover:text-white hover:border-white/40 transition-all disabled:opacity-50">
                          {uploadingStoreImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          {uploadingStoreImg ? "Uploading..." : "Upload property photo"}
                        </button>
                      )}
                      <input ref={storeImgRef} type="file" accept="image/*" className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadStoreImage(f); e.target.value = ""; }} />
                    </div>
                    {/* Notes */}
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                      <textarea rows={2} value={storeForm.notes} onChange={e => setStoreForm(f => ({ ...f, notes: e.target.value }))}
                        placeholder="Extra details..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500/50 resize-none" />
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button type="button" onClick={() => setShowAddStore(false)}
                        className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white">Cancel</button>
                      <button type="submit" disabled={savingStore}
                        className="flex-1 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-60 flex items-center justify-center gap-2">
                        {savingStore ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {savingStore ? "Saving..." : "Save Property"}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ════ OWNERS TAB ════ */}
      {activeTab === "owners" && (<>
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Property Owners</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {filtered.length}/{owners.length} owners
            {filterType !== "ALL" || filterBudget !== "ALL" || filterTransaction !== "ALL" ? " (filtered)" : " · Scan visiting cards to add"}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={() => router.push("/owners/import")}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 hover:bg-green-500/30 text-sm font-medium transition-all">
              <FileSpreadsheet className="w-4 h-4" /> Import Excel
            </button>
          )}
          {isAdmin && (
            <button onClick={exportExcel}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-sm font-medium transition-all">
              <Download className="w-4 h-4" /> Export Excel
            </button>
          )}
          {isAdmin && (
            <button onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                selectMode
                  ? "bg-purple-500/30 border-purple-500/50 text-purple-300"
                  : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"
              }`}>
              <Users className="w-4 h-4" /> {selectMode ? "Cancel Select" : "Bulk WA"}
            </button>
          )}
          {isAdmin && (
            <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1">
              <button onClick={() => { setAutoScanMode(false); setShowScan(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all"
                title="Scan & review before saving">
                <ScanLine className="w-3.5 h-3.5" /> Scan
              </button>
              <button onClick={() => { setAutoScanMode(true); setShowScan(true); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-medium transition-all bg-gold-500/20 text-gold-400 border border-gold-500/30 hover:bg-gold-500/30"
                title="Scan & auto-save, then open WhatsApp">
                <Sparkles className="w-3.5 h-3.5" /> Quick WA
              </button>
            </div>
          )}
          {isAdmin && (
            <button onClick={() => { setEditOwner(null); setForm(EMPTY); setScanned(null); setShowAdd(true); }}
              className="btn-primary flex items-center gap-2 text-sm">
              <Plus className="w-4 h-4" /> Add Owner
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="space-y-2">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, phone, locality..."
            className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          <select value={filterTransaction} onChange={e => setFilterTransaction(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white focus:outline-none focus:border-estate-500/50 cursor-pointer transition-all">
            <option value="ALL">All Types</option>
            <option value="RENT">🔑 Rent/Lease</option>
            <option value="SELL">💰 Buy/Sell</option>
          </select>

          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white focus:outline-none focus:border-estate-500/50 cursor-pointer transition-all">
            <option value="ALL">All Property Types</option>
            <optgroup label="Commercial">
              <option value="OFFICE">🏢 Office</option>
              <option value="SHOP">🛍️ Shop</option>
              <option value="SHOWROOM">🎨 Showroom</option>
              <option value="WAREHOUSE">📦 Warehouse</option>
              <option value="COMMERCIAL_LAND">🌾 Commercial Land</option>
              <option value="INDUSTRIAL">⚙️ Industrial</option>
            </optgroup>
            <optgroup label="Residential">
              <option value="APARTMENT">🏠 Apartment</option>
              <option value="VILLA">🏡 Villa</option>
              <option value="PLOT">📍 Plot</option>
              <option value="PENTHOUSE">🏗️ Penthouse</option>
              <option value="STUDIO">🏢 Studio</option>
            </optgroup>
          </select>

          <select value={filterBudget} onChange={e => setFilterBudget(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white focus:outline-none focus:border-estate-500/50 cursor-pointer transition-all">
            <option value="ALL">All Budgets</option>
            <option value="LOW">💵 Up to ₹50L</option>
            <option value="MID">💴 ₹50L–₹1.5Cr</option>
            <option value="HIGH">💶 ₹1.5Cr–₹5Cr</option>
            <option value="LUXURY">💎 ₹5Cr+</option>
          </select>

          {/* Dynamic Locality dropdown from actual data */}
          {localityOptions.length > 0 && (
            <select value={filterLocality} onChange={e => setFilterLocality(e.target.value)}
              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white focus:outline-none focus:border-estate-500/50 cursor-pointer transition-all">
              <option value="ALL">📍 All Localities</option>
              {localityOptions.map(loc => (
                <option key={loc} value={loc} className="bg-[#0f1f35]">{loc}</option>
              ))}
            </select>
          )}

          {/* Scanned card filter */}
          <select value={filterScanned} onChange={e => setFilterScanned(e.target.value)}
            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white focus:outline-none focus:border-estate-500/50 cursor-pointer transition-all">
            <option value="ALL">All Cards</option>
            <option value="SCANNED">📇 Scanned Only</option>
            <option value="NO_CARD">✏️ Manual Only</option>
          </select>

          {(filterTransaction !== "ALL" || filterType !== "ALL" || filterBudget !== "ALL" || filterLocality !== "ALL" || filterScanned !== "ALL") && (
            <button onClick={() => { setFilterTransaction("ALL"); setFilterType("ALL"); setFilterBudget("ALL"); setFilterLocality("ALL"); setFilterScanned("ALL"); }}
              className="px-2 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30 text-xs text-red-400 hover:bg-red-500/30 transition-all font-medium">
              ✕ Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Bulk Select Bar */}
      {selectMode && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-purple-500/10 border border-purple-500/30">
          <div className="flex items-center gap-3">
            <button onClick={toggleSelectAll} className="flex items-center gap-2 text-sm text-purple-300 hover:text-white transition-colors">
              {selectedIds.size === filtered.length && filtered.length > 0
                ? <CheckSquare className="w-4 h-4" />
                : <Square className="w-4 h-4" />}
              {selectedIds.size === filtered.length && filtered.length > 0 ? "Deselect All" : "Select All"}
            </button>
            <span className="text-xs text-purple-400">{selectedIds.size} selected</span>
          </div>
          {selectedIds.size > 0 && (
            <button onClick={() => setShowBlast(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all">
              <Send className="w-4 h-4" /> Send WA to {selectedIds.size}
            </button>
          )}
        </div>
      )}

      {/* Owners Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="glass-card p-5 h-48 animate-pulse bg-white/5" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No owners yet. Scan a visiting card to add!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(owner => {
            const pd = parseOwnerNotes(owner.notes);
            const ownerPhone10 = owner.phone.replace(/\D/g, "").slice(-10);
            const matchedClient = clients.find(c => c.phone.replace(/\D/g,"").slice(-10) === ownerPhone10);
            const dealMatches   = getBestClientMatches(owner);
            const hasDealMatch  = dealMatches.length > 0;
            return (
            <div key={owner.id}
              className={`glass-card p-4 space-y-3 transition-all select-none ${
                selectMode && selectedIds.has(owner.id) ? "ring-2 ring-purple-500/60 bg-purple-500/10" :
                matchedClient ? "border-orange-500/30 bg-orange-500/3" :
                hasDealMatch && dealMatches[0].score >= 80 ? "border-emerald-500/20" :
                hasDealMatch ? "border-blue-500/15" : ""
              }`}>

              {/* Top row */}
              <div className="flex items-start gap-3">
                {selectMode && (
                  <button onClick={() => toggleSelect(owner.id)} className="flex-shrink-0 mt-1">
                    {selectedIds.has(owner.id)
                      ? <CheckSquare className="w-5 h-5 text-purple-400" />
                      : <Square className="w-5 h-5 text-muted-foreground" />}
                  </button>
                )}
                <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-white/10 flex-shrink-0 border border-white/10">
                  {owner.cardImageUrl ? (
                    <Image src={owner.cardImageUrl} alt={owner.name} fill className="object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-xl font-bold text-white bg-gradient-to-br from-estate-600 to-estate-400">
                      {owner.name[0]?.toUpperCase()}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-white truncate">{owner.name}</div>
                  {owner.company && <div className="text-xs text-gold-400 truncate">{owner.company}</div>}
                  {!owner.company && pd?.propertyTitle && <div className="text-xs text-estate-400 truncate">🏢 {pd.propertyTitle}</div>}
                  {owner.locality && <div className="text-xs text-muted-foreground">📍 {owner.locality}</div>}
                  {matchedClient && (
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-orange-500/20 border border-orange-500/30 text-orange-400 font-medium">
                        👤 Client: {matchedClient.score >= 80 ? "🔥" : matchedClient.score >= 60 ? "🌡️" : "❄️"} {matchedClient.name}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {owner.assignedTo && (
                    <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/25 text-blue-400 mr-0.5">
                      👤 {owner.assignedTo.name.split(" ")[0]}
                    </span>
                  )}
                  <button onClick={() => { setAssignOwnerId(owner.id); setAssigningTo(owner.assignedToId || ""); setShowAssign(true); }}
                    className="p-1.5 rounded-lg hover:bg-blue-500/10 text-muted-foreground hover:text-blue-400 transition-colors" title="Assign to Employee">
                    <UserPlus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => openEdit(owner)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(owner.id, owner.name)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Phone + Quick Contact */}
              <div className="flex items-center gap-2 flex-wrap">
                <a href={`tel:${owner.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all">
                  <Phone className="w-3 h-3" /> {owner.phone}
                </a>
                {owner.phone2 && (
                  <a href={`tel:${owner.phone2}`} className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-muted-foreground hover:text-white transition-all">
                    <Phone className="w-3 h-3" /> {owner.phone2}
                  </a>
                )}
                {owner.email && (
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">{owner.email}</span>
                )}
              </div>

              {/* Employee Quick Contact Bar */}
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${owner.phone}`}
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-semibold hover:bg-emerald-500/30 transition-all">
                  <Phone className="w-3.5 h-3.5" /> Call Now
                </a>
                <a href={`https://wa.me/91${owner.phone.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(WA_COMPANY_MSG(owner.name))}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-semibold hover:bg-green-500/30 transition-all">
                  <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>

              {/* Scanned Property Details */}
              {pd && (
                <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2">
                  {/* Type + Transaction + Status */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {pd.propertyType && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/10 border border-gold-500/20 text-gold-400 font-medium">
                        {TYPE_ICON[pd.propertyType] || "🏢"} {pd.propertyType}
                      </span>
                    )}
                    {pd.transactionType && (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${TX_COLOR[pd.transactionType] || "text-muted-foreground bg-white/5 border-white/10"}`}>
                        {pd.transactionType}
                      </span>
                    )}
                    {pd.status && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        {pd.status}
                      </span>
                    )}
                  </div>

                  {/* Price + Area + Floor grid */}
                  {(pd.price || pd.area || pd.floor) && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {pd.price ? (
                        <div className="text-center p-1.5 rounded-lg bg-white/5">
                          <div className="text-xs font-bold text-gold-400">{fmtPrice(Number(pd.price), String(pd.transactionType || ""))}</div>
                          <div className="text-xs text-muted-foreground">Price</div>
                        </div>
                      ) : <div />}
                      {pd.area ? (
                        <div className="text-center p-1.5 rounded-lg bg-white/5">
                          <div className="text-xs font-bold text-white">{pd.area}</div>
                          <div className="text-xs text-muted-foreground">Sq.ft</div>
                        </div>
                      ) : <div />}
                      {pd.floor ? (
                        <div className="text-center p-1.5 rounded-lg bg-white/5">
                          <div className="text-xs font-bold text-white">{pd.floor}{pd.totalFloors ? `/${pd.totalFloors}` : ""}</div>
                          <div className="text-xs text-muted-foreground">Floor</div>
                        </div>
                      ) : <div />}
                    </div>
                  )}

                  {/* Furnishing + Condition + Brokerage */}
                  {(pd.furnishing || pd.condition || pd.brokerage) && (
                    <div className="flex flex-wrap gap-1">
                      {pd.furnishing && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                          🛋️ {String(pd.furnishing).replace(/_/g, " ")}
                        </span>
                      )}
                      {pd.condition && pd.condition !== pd.furnishing && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">
                          {pd.condition}
                        </span>
                      )}
                      {pd.brokerage && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">
                          💰 {pd.brokerage}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Amenities */}
                  {pd.amenities && (
                    <p className="text-xs text-muted-foreground line-clamp-2">✨ {pd.amenities}</p>
                  )}

                  {/* Description */}
                  {pd.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pd.description}</p>
                  )}

                  {/* Raw notes fallback */}
                  {pd.rawNotes && !pd.propertyType && !pd.price && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{pd.rawNotes}</p>
                  )}
                </div>
              )}

              {/* Linked Properties from DB */}
              {owner.properties.length > 0 && (
                <div className="space-y-1">
                  {owner.properties.slice(0, 2).map(p => (
                    <div key={p.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-white/5">
                      <span className="text-muted-foreground truncate flex-1">{p.title}</span>
                      <span className="text-gold-400 font-medium ml-2 flex-shrink-0">{fmtPrice(p.price, p.transactionType)}</span>
                    </div>
                  ))}
                  {owner.properties.length > 2 && (
                    <p className="text-xs text-muted-foreground text-center">+{owner.properties.length - 2} more</p>
                  )}
                </div>
              )}

              {/* Client Deal Matches */}
              {(() => {
                const matches = getBestClientMatches(owner);
                if (!matches.length) return null;
                return (
                  <div className="rounded-xl bg-white/5 border border-white/10 p-2.5 space-y-1.5">
                    <p className="text-xs font-semibold text-blue-400 flex items-center gap-1">
                      <Users className="w-3 h-3" /> Matching Clients
                    </p>
                    {matches.map(({ client: mc, score: ms }) => (
                      <div key={mc.id} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer transition-all hover:scale-[1.01] ${
                        ms >= 80 ? "bg-emerald-500/15 border border-emerald-500/20" :
                        ms >= 60 ? "bg-gold-500/10 border border-gold-500/20" :
                        "bg-blue-500/10 border border-blue-500/20"
                      }`}
                        onClick={() => setSelectedMatchClient(mc)}>
                        <span className={`font-bold flex-shrink-0 w-8 text-right ${
                          ms >= 80 ? "text-emerald-400" : ms >= 60 ? "text-gold-400" : "text-blue-400"
                        }`}>{ms}%</span>
                        <span className="text-white font-medium truncate flex-1">{mc.name}</span>
                        {mc.propertyType && <span className="text-muted-foreground flex-shrink-0">{mc.propertyType}</span>}
                        {mc.budget ? <span className="text-gold-400 font-semibold flex-shrink-0">{fmtBudget(mc.budget)}</span> : null}
                        <span className="flex-shrink-0 text-muted-foreground">→</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button onClick={() => viewMessages(owner)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-all">
                  <MessageCircle className="w-3.5 h-3.5" /> History
                </button>
                <button onClick={() => addOwnerAsLead(owner)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg bg-purple-500/20 border border-purple-500/30 text-purple-400 text-xs font-medium hover:bg-purple-500/30 transition-all">
                  <ArrowRight className="w-3.5 h-3.5" /> Lead
                </button>
                <button onClick={() => addPropertyFromOwner(owner)}
                  className="flex items-center justify-center gap-1 py-2 rounded-lg bg-estate-500/20 border border-estate-500/30 text-estate-400 text-xs font-medium hover:bg-estate-500/30 transition-all">
                  <Building2 className="w-3.5 h-3.5" /> List
                </button>
              </div>
            </div>
            );
          })}
        </div>
      )}

      {/* ── Excel Import Modal ── */}
      <AnimatePresence>
        {showImport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && !importing && setShowImport(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-lg p-6 space-y-5">

              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-green-400" /> Import Owners from Excel
                </h2>
                {!importing && <button onClick={() => setShowImport(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>}
              </div>

              {!importResult ? (
                <>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/10 space-y-2">
                    <p className="text-sm font-medium text-white">📋 Supported Excel Columns</p>
                    <div className="grid grid-cols-2 gap-1.5 mt-2">
                      {[
                        ["Name / Owner Name", "required"],
                        ["Phone / Mobile", "required"],
                        ["Phone 2 / Alt Phone", "optional"],
                        ["Email", "optional"],
                        ["Company / Builder", "optional"],
                        ["Locality / Location", "optional"],
                        ["Address", "optional"],
                        ["Property Type", "optional"],
                        ["Transaction / Rent/Sell", "optional"],
                        ["Price / Amount", "optional"],
                        ["Sqft / Area / Size", "optional"],
                        ["Floor", "optional"],
                        ["Furnishing", "optional"],
                        ["Brokerage / Commission", "optional"],
                        ["Status / Availability", "optional"],
                        ["Amenities / Facilities", "optional"],
                        ["Notes / Remarks", "optional"],
                      ].map(([col, req]) => (
                        <div key={col} className="flex items-center gap-1.5 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${req === "required" ? "bg-red-400" : "bg-green-400"}`} />
                          <span className="text-muted-foreground">{col}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2">
                    <Link2 className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-300">
                      <span className="font-semibold">AI Lead Match:</span> Agar koi owner ka phone ya naam existing lead se match kare, toh automatically flag ho jayega.
                    </p>
                  </div>

                  <label className={`flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                    importing ? "border-white/10 opacity-50 pointer-events-none" : "border-white/20 hover:border-green-500/50 hover:bg-green-500/5"
                  }`}>
                    {importing
                      ? <><Loader2 className="w-8 h-8 animate-spin text-green-400" /><span className="text-sm text-muted-foreground">Importing & matching leads...</span></>
                      : <><Upload className="w-8 h-8 text-green-400" /><span className="text-sm text-white font-medium">Click to upload Excel file</span><span className="text-xs text-muted-foreground">.xlsx / .xls / .csv</span></>}
                    <input ref={importFileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleExcelImport(f); e.target.value = ""; }} />
                  </label>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Imported",    value: importResult.imported,   color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: <CheckCircle2 className="w-4 h-4" /> },
                      { label: "Duplicates",  value: importResult.duplicates, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20",   icon: <AlertTriangle className="w-4 h-4" /> },
                      { label: "Lead Matches",value: importResult.leadMatch,  color: "text-blue-400",   bg: "bg-blue-500/10 border-blue-500/20",       icon: <Link2 className="w-4 h-4" /> },
                      { label: "Errors",      value: importResult.errors,     color: "text-red-400",    bg: "bg-red-500/10 border-red-500/20",         icon: <X className="w-4 h-4" /> },
                    ].map(s => (
                      <div key={s.label} className={`p-4 rounded-xl border ${s.bg} flex items-center gap-3`}>
                        <span className={s.color}>{s.icon}</span>
                        <div>
                          <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                          <div className="text-xs text-muted-foreground">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {importResult.matchedLeads?.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-semibold text-blue-400 flex items-center gap-2">
                        <Link2 className="w-4 h-4" /> Owner–Lead Matches
                      </p>
                      <div className="max-h-40 overflow-y-auto space-y-2">
                        {importResult.matchedLeads.map((m: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs">
                            <div className="flex-1 min-w-0">
                              <span className="text-white font-medium">{m.ownerName}</span>
                              <span className="text-muted-foreground"> ({m.ownerPhone})</span>
                            </div>
                            <span className="text-blue-400">↔</span>
                            <div className="flex-1 min-w-0 text-right">
                              <span className="text-white font-medium">{m.leadName}</span>
                              <span className="text-muted-foreground"> ({m.leadPhone})</span>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded font-medium ${
                              m.matchType === "phone" ? "bg-red-500/20 text-red-400" : "bg-yellow-500/20 text-yellow-400"
                            }`}>{m.matchType}</span>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">⚠️ These owners are already in leads — follow up carefully.</p>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setImportResult(null)}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white">
                      Import More
                    </button>
                    <button onClick={() => setShowImport(false)}
                      className="flex-1 py-2.5 rounded-xl btn-primary text-sm">Done</button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Scan Modal */}
      <AnimatePresence>
        {showScan && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && !batchRunning && setShowScan(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">📇 Scan Owner Cards</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">JPG · PNG · WEBP · PDF — scan 1 to 500 cards</p>
                </div>
                {!batchRunning && (
                  <button onClick={() => { setShowScan(false); setBatchFiles([]); setBatchResults([]); }}
                    className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
                )}
              </div>

              {/* File picker — shown when not running and no results yet */}
              {!batchRunning && batchResults.length === 0 && (
                <div className="space-y-4">
                  <label className="block border-2 border-dashed border-gold-500/30 rounded-xl p-10 text-center cursor-pointer hover:border-gold-500/60 hover:bg-gold-500/5 transition-all">
                    <ScanLine className="w-14 h-14 text-gold-400 mx-auto mb-3" />
                    <p className="text-white font-semibold text-base">Click to select card images</p>
                    <p className="text-xs text-muted-foreground mt-1">JPG · PNG · WEBP · PDF — 1 to 500 files</p>
                    <p className="text-xs text-gold-400 mt-2">Ctrl+Click or Shift+Click to select multiple</p>
                    <input type="file" accept="image/*,.pdf,.png,.jpg,.jpeg,.webp" multiple className="hidden"
                      onChange={e => {
                        const files = Array.from(e.target.files || []);
                        if (files.length === 0) return;
                        if (files.length === 1) {
                          setShowScan(false);
                          handleScan(files[0]);
                        } else {
                          setBatchFiles(files.slice(0, 500)); // max 500
                        }
                      }} />
                  </label>

                  {batchFiles.length > 0 && (
                    <>
                      <div className="p-3 rounded-xl bg-gold-500/10 border border-gold-500/20">
                        <p className="text-xs text-gold-400 font-medium mb-2">{batchFiles.length} images selected:</p>
                        <div className="space-y-1 max-h-32 overflow-y-auto">
                          {batchFiles.map((f, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 text-xs font-bold">{i+1}</span>
                              <span className="truncate">{f.name}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <button onClick={handleBatchScan}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gold-500/20 border border-gold-500/30 text-gold-400 font-semibold hover:bg-gold-500/30 transition-all">
                        <ScanLine className="w-5 h-5" /> ⚡ Scan All {batchFiles.length} Cards
                      </button>
                    </>
                  )}

                  <div className="p-3 rounded-xl bg-gold-500/5 border border-gold-500/20 text-xs text-gold-400">
                    ✨ AI extracts: Name, Phone, Company, Locality, Property type, Price, Area — auto saved
                  </div>
                </div>
              )}

              {/* Scanning in progress */}
              {batchRunning && (
                <div className="space-y-3">
                  <div className="text-center py-2">
                    <p className="text-sm font-semibold text-white">
                      Scanning {batchResults.filter(r => r.status === "done" || r.status === "error").length} / {batchFiles.length}
                    </p>
                    <div className="w-full bg-white/10 rounded-full h-2 mt-2">
                      <div className="bg-gold-400 h-2 rounded-full transition-all"
                        style={{ width: `${(batchResults.filter(r => r.status === "done" || r.status === "error").length / batchFiles.length) * 100}%` }} />
                    </div>
                  </div>
                  <div className="space-y-1.5 max-h-72 overflow-y-auto">
                    {batchResults.map((r, i) => (
                      <div key={i} className={`flex items-center gap-3 p-2.5 rounded-lg border text-xs ${
                        r.status === "done"     ? "bg-emerald-500/10 border-emerald-500/20" :
                        r.status === "error"    ? "bg-red-500/10 border-red-500/20" :
                        r.status === "scanning" ? "bg-gold-500/10 border-gold-500/20 animate-pulse" :
                        "bg-white/5 border-white/10"
                      }`}>
                        <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0 font-bold">{i+1}</span>
                        <div className="flex-1 min-w-0">
                          {r.status === "done"     && <p className="text-emerald-400">✅ {r.name} · {r.phone}</p>}
                          {r.status === "error"    && <p className="text-red-400">❌ {r.file.name} — {r.error}</p>}
                          {r.status === "scanning" && <p className="text-gold-400">🔍 Scanning {r.file.name}...</p>}
                          {r.status === "pending"  && <p className="text-muted-foreground truncate">⏳ {r.file.name}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Done */}
              {!batchRunning && batchResults.length > 0 && (
                <div className="space-y-3">
                  <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                    <p className="text-lg font-bold text-emerald-400">✅ {batchResults.filter(r => r.status === "done").length} cards saved!</p>
                    {batchResults.filter(r => r.status === "error").length > 0 && (
                      <p className="text-xs text-red-400 mt-1">{batchResults.filter(r => r.status === "error").length} failed</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setBatchFiles([]); setBatchResults([]); }}
                      className="flex-1 py-2.5 rounded-xl bg-white/5 border border-white/10 text-muted-foreground text-sm hover:text-white transition-all">
                      Scan More
                    </button>
                    <button onClick={() => { setBatchFiles([]); setBatchResults([]); setShowScan(false); }}
                      className="flex-1 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-semibold hover:bg-emerald-500/30 transition-all">
                      Done
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Owner Modal */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-white">{editOwner ? "Edit Owner" : "Add Owner"}{scanned?.propertyType ? " & Property" : ""}</h2>
                  {scanned?.propertyTitle && (
                    <p className="text-xs text-gold-400 mt-0.5">🏢 {scanned.propertyTitle}</p>
                  )}
                </div>
                <button onClick={() => { setShowAdd(false); setEditOwner(null); setScanned(null); }}
                  className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>

              {/* Scanned card preview with ALL DETAILS */}
              {scanned && (
                <div className="mb-4 p-4 rounded-xl bg-gradient-to-br from-gold-500/10 to-estate-500/10 border border-gold-500/30 space-y-3">
                  {/* Card Image + Owner Info */}
                  <div className="flex gap-3">
                    {scanned.imageUrl && (
                      <Image src={String(scanned.imageUrl)} alt="card" width={80} height={60} className="rounded-lg object-cover border border-white/10 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gold-400 mb-1">✅ AI Scanned Card</p>
                      <p className="text-sm font-bold text-white truncate">{scanned.ownerName}</p>
                      {scanned.propertyTitle && (
                        <p className="text-xs text-estate-400 truncate">🏢 {scanned.propertyTitle}</p>
                      )}
                      <p className="text-xs text-green-400">{scanned.ownerPhone}</p>
                    </div>
                  </div>

                  {/* Property Details Grid */}
                  {(scanned.propertyType || scanned.price || scanned.area) && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      {scanned.propertyType && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Type:</span>
                          <p className="text-white font-semibold">{scanned.propertyType}</p>
                        </div>
                      )}
                      {scanned.transactionType && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Transaction:</span>
                          <p className="text-white font-semibold">{scanned.transactionType}</p>
                        </div>
                      )}
                      {scanned.price ? (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Price:</span>
                          <p className="text-white font-semibold">₹{Number(scanned.price).toLocaleString("en-IN")}{scanned.transactionType === "RENT" || scanned.transactionType === "LEASE" ? "/mo" : ""}</p>
                        </div>
                      ) : null}
                      {scanned.area ? (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Area:</span>
                          <p className="text-white font-semibold">{scanned.area} {scanned.areaUnit}</p>
                        </div>
                      ) : null}
                      {scanned.locality && (
                        <div className="text-xs col-span-2">
                          <span className="text-muted-foreground">📍 Location:</span>
                          <p className="text-white font-semibold">{scanned.locality}</p>
                        </div>
                      )}
                      {scanned.floor && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Floor:</span>
                          <p className="text-white font-semibold">{scanned.floor}</p>
                        </div>
                      )}
                      {scanned.furnishing && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Furnishing:</span>
                          <p className="text-white font-semibold">{scanned.furnishing}</p>
                        </div>
                      )}
                      {scanned.status && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">Status:</span>
                          <p className="text-estate-400 font-semibold">{scanned.status}</p>
                        </div>
                      )}
                      {scanned.amenities && (
                        <div className="text-xs col-span-2">
                          <span className="text-muted-foreground">Amenities:</span>
                          <p className="text-white text-xs">{scanned.amenities}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Owner Name *</label>
                    <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                      placeholder="Suresh Patel"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Phone *</label>
                    <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="9876543210"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Phone 2</label>
                    <input value={form.phone2} onChange={e => setForm(f => ({ ...f, phone2: e.target.value }))}
                      placeholder="Alternate number"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                    <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="owner@email.com"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Company / Builder</label>
                  <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))}
                    placeholder="ABC Builders"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Locality</label>
                    <input value={form.locality} onChange={e => setForm(f => ({ ...f, locality: e.target.value }))}
                      placeholder="Prahlad Nagar"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Address</label>
                    <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
                      placeholder="Full address"
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
                  <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="Any notes about this owner..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 resize-none" />
                </div>

                {/* Manual Property Details */}
                {!scanned && (
                  <div className="pt-3 border-t border-white/10 space-y-3">
                    <p className="text-xs font-semibold text-estate-400 flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> Property Details (optional)</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Property Type</label>
                        <select value={form.propertyType} onChange={e => setForm(f => ({ ...f, propertyType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50">
                          <option value="">Select type</option>
                          {["OFFICE","SHOP","SHOWROOM","WAREHOUSE","APARTMENT","VILLA","PLOT","PENTHOUSE","STUDIO","COMMERCIAL_LAND","INDUSTRIAL"].map(t => (
                            <option key={t} value={t} className="bg-[#0f1f35]">{t.replace(/_/g," ")}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Transaction</label>
                        <select value={form.transactionType} onChange={e => setForm(f => ({ ...f, transactionType: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50">
                          <option value="">Select</option>
                          <option value="RENT" className="bg-[#0f1f35]">RENT</option>
                          <option value="SELL" className="bg-[#0f1f35]">SELL</option>
                          <option value="LEASE" className="bg-[#0f1f35]">LEASE</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Price (₹)</label>
                        <input type="number" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                          placeholder="e.g. 5000000"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Area (sq.ft)</label>
                        <input type="number" value={form.area} onChange={e => setForm(f => ({ ...f, area: e.target.value }))}
                          placeholder="e.g. 1200"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Floor</label>
                        <input value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))}
                          placeholder="e.g. 3"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                      </div>
                      <div>
                        <label className="text-xs text-muted-foreground mb-1 block">Furnishing</label>
                        <select value={form.furnishing} onChange={e => setForm(f => ({ ...f, furnishing: e.target.value }))}
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50">
                          <option value="">Select</option>
                          {["FURNISHED","SEMI_FURNISHED","UNFURNISHED"].map(t => (
                            <option key={t} value={t} className="bg-[#0f1f35]">{t.replace(/_/g," ")}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Amenities</label>
                      <input value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))}
                        placeholder="Parking, Lift, AC, CCTV..."
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                    </div>
                  </div>
                )}

                {/* Property Details Section - show if card has property info */}
                {scanned && (scanned.propertyType || scanned.price || scanned.area) && (
                  <>
                    <div className="pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <Building2 className="w-4 h-4 text-estate-400" />
                        <p className="text-sm font-semibold text-white">📍 Property Details</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3">
                        {scanned.propertyType && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Property Type</label>
                            <input type="text" value={scanned.propertyType} disabled
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                          </div>
                        )}
                        {scanned.transactionType && (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Transaction</label>
                            <input type="text" value={scanned.transactionType} disabled
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                          </div>
                        )}
                        {scanned.price ? (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Price</label>
                            <input type="text" value={`₹${Number(scanned.price).toLocaleString("en-IN")}`} disabled
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-green-400 font-semibold" />
                          </div>
                        ) : null}
                        {scanned.area ? (
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">Area</label>
                            <input type="text" value={`${scanned.area} ${scanned.areaUnit || "sqft"}`} disabled
                              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                          </div>
                        ) : null}
                      </div>

                      {/* More property details */}
                      {(scanned.floor || scanned.furnishing || scanned.status || scanned.amenities) && (
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          {scanned.floor && (
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Floor</label>
                              <input type="text" value={scanned.floor} disabled
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                            </div>
                          )}
                          {scanned.furnishing && (
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Furnishing</label>
                              <input type="text" value={scanned.furnishing} disabled
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                            </div>
                          )}
                          {scanned.status && (
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Status</label>
                              <input type="text" value={scanned.status} disabled
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                            </div>
                          )}
                          {scanned.brokerage && (
                            <div>
                              <label className="text-xs text-muted-foreground mb-1 block">Brokerage</label>
                              <input type="text" value={scanned.brokerage} disabled
                                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      )}

                      {scanned.amenities && (
                        <div className="mt-3">
                          <label className="text-xs text-muted-foreground mb-1 block">Amenities</label>
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                            <p className="text-xs text-white whitespace-pre-wrap">{scanned.amenities}</p>
                          </div>
                        </div>
                      )}

                      {scanned.description && (
                        <div className="mt-3">
                          <label className="text-xs text-muted-foreground mb-1 block">Description</label>
                          <div className="p-2 rounded-lg bg-white/5 border border-white/10 max-h-24 overflow-y-auto">
                            <p className="text-xs text-white whitespace-pre-wrap">{scanned.description}</p>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 p-2 rounded-lg bg-estate-500/10 border border-estate-500/30">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={saveAsProperty} onChange={e => setSaveAsProperty(e.target.checked)}
                            className="w-4 h-4 rounded" />
                          <span className="text-xs text-estate-400 font-medium">Also save as Property Listing</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowAdd(false); setEditOwner(null); setScanned(null); setSaveAsProperty(false); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={saving}
                    className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                    {saving ? "Saving..." : editOwner ? "Update Owner" : "Save Owner"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Message Thread Panel */}
      <AnimatePresence>
        {showMessages && selectedOwner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) { setShowMessages(false); setSelectedOwner(null); } }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-lg p-6 max-h-[90vh] flex flex-col">
              
              {/* Header */}
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="relative w-10 h-10 rounded-full overflow-hidden bg-white/10 border border-white/10 flex-shrink-0">
                    {selectedOwner.cardImageUrl ? (
                      <Image src={selectedOwner.cardImageUrl} alt={selectedOwner.name} fill className="object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center font-bold text-sm">
                        {selectedOwner.name[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-white truncate">{selectedOwner.name}</h3>
                    <p className="text-xs text-muted-foreground">{selectedOwner.phone}</p>
                  </div>
                </div>
                <button onClick={() => { setShowMessages(false); setSelectedOwner(null); }}
                  className="text-muted-foreground hover:text-white flex-shrink-0">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-2">
                {messagesLoading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    <p className="text-xs text-muted-foreground mt-2">Loading messages...</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageCircle className="w-8 h-8 mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-xs text-muted-foreground">No messages yet</p>
                    <button onClick={() => sendWhatsApp(selectedOwner)}
                      className="text-xs text-green-400 hover:text-green-300 mt-2 font-medium">
                      Start conversation →
                    </button>
                  </div>
                ) : (
                  messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === "OUT" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-xs p-3 rounded-lg ${msg.direction === "OUT"
                        ? "bg-blue-500/20 border border-blue-500/30 text-blue-100"
                        : "bg-white/10 border border-white/20 text-white"
                      }`}>
                        {msg.mediaUrl && (
                          <div className="mb-2">
                            <Image src={msg.mediaUrl} alt="msg" width={150} height={150} className="rounded max-w-full" />
                          </div>
                        )}
                        <p className="text-xs break-words">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.direction === "OUT" ? "text-blue-400/70" : "text-muted-foreground"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-4 border-t border-white/10">
                {/* Log incoming reply */}
                <LogReply ownerId={selectedOwner.id} onSaved={(msg) => setMessages(prev => [...prev, msg])} />
                <div className="flex gap-2">
                  <button onClick={() => sendWhatsApp(selectedOwner)}
                    className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-all">
                    <MessageSquare className="w-3.5 h-3.5" /> Open WhatsApp
                  </button>
                  <button onClick={() => { setShowMessages(false); setSelectedOwner(null); }}
                    className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Convert to Lead Modal */}
      <AnimatePresence>
        {showConvertLead && selectedOwner && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => { if (e.target === e.currentTarget) { setShowConvertLead(false); setSelectedOwner(null); } }}>
            <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              className="glass-card w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Convert to Lead</h2>
                <button onClick={() => { setShowConvertLead(false); setSelectedOwner(null); }} className="text-muted-foreground hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleConvertToLead} className="space-y-4">
                <div className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-xs text-muted-foreground mb-1">Creating lead for:</p>
                  <p className="text-sm font-semibold text-white">{selectedOwner.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedOwner.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Lead Source *</label>
                  <select value={leadForm.source} onChange={e => setLeadForm(f => ({ ...f, source: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-white">
                    <option value="WALK_IN">Walk-in / Visiting Card</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="WEBSITE">Website</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="GOOGLE_BUSINESS">Google Business</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="COLD_CALL">Cold Call</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Budget (Optional)</label>
                  <input type="number" value={leadForm.budget} onChange={e => setLeadForm(f => ({ ...f, budget: e.target.value }))}
                    placeholder="1000000"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Requirements (Optional)</label>
                  <textarea rows={2} value={leadForm.requirements} onChange={e => setLeadForm(f => ({ ...f, requirements: e.target.value }))}
                    placeholder="2 BHK in Satellite area, near metro..."
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 resize-none" />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => { setShowConvertLead(false); setSelectedOwner(null); }}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">Cancel</button>
                  <button type="submit" disabled={convertingLead}
                    className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-60">
                    {convertingLead ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    {convertingLead ? "Creating..." : "Create Lead"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bulk WA Blast Modal */}
      {showBlast && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={e => { if (e.target === e.currentTarget && !blasting) setShowBlast(false); }}>
          <div className="glass-card w-full max-w-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">📢 WhatsApp Blast</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedIds.size} owners will receive this message</p>
              </div>
              {!blasting && (
                <button onClick={() => setShowBlast(false)} className="text-muted-foreground hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
              <p className="text-xs text-purple-400 mb-2 font-medium">Use <code className="bg-white/10 px-1 rounded">{`{name}`}</code> for owner name</p>
              <textarea rows={8} value={blastMsg} onChange={e => setBlastMsg(e.target.value)}
                disabled={blasting}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500/50 resize-none" />
            </div>

            {/* Image Attach */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">📷 Your Visiting Card (optional)</p>
              {blastImage ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                    <Image src={blastImage} alt="card" width={60} height={60} className="rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-emerald-400 font-medium">✅ Card uploaded</p>
                      <p className="text-xs text-muted-foreground">After sending message in WA, attach this image manually</p>
                    </div>
                    <button onClick={() => setBlastImage(null)} className="text-red-400 hover:text-red-300 flex-shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <button
                    onClick={() => { navigator.clipboard.writeText(blastImage); toast.success("Image link copied! Open in browser & save, then attach in WA 📸"); }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs hover:bg-blue-500/20 transition-all">
                    📋 Copy Image Link
                  </button>
                  <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-400">
                    💡 In WA send the message → then attach image via "+" from gallery
                  </div>
                </div>
              ) : (
                <button onClick={() => blastImgRef.current?.click()} disabled={uploadingBlastImg}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-white/5 border border-dashed border-white/20 text-xs text-muted-foreground hover:text-white hover:border-white/40 transition-all disabled:opacity-50">
                  {uploadingBlastImg ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                  {uploadingBlastImg ? "Uploading..." : "Upload your visiting card"}
                </button>
              )}
              <input ref={blastImgRef} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) uploadBlastImage(f); }} />
            </div>
            {blasting ? (
              <div className="space-y-4">
                {/* Progress */}
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <p className="text-2xl font-bold text-white">{blastIndex} / {selectedIds.size}</p>
                  <p className="text-xs text-emerald-400 mt-1">Messages opened in WhatsApp</p>
                  <div className="w-full bg-white/10 rounded-full h-2 mt-3">
                    <div className="bg-emerald-500 h-2 rounded-full transition-all"
                      style={{ width: `${(blastIndex / selectedIds.size) * 100}%` }} />
                  </div>
                </div>

                {/* Current owner */}
                {blastIndex < selectedIds.size && (() => {
                  const targets = filtered.filter(o => selectedIds.has(o.id));
                  const next = targets[blastIndex];
                  return next ? (
                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                      <p className="text-xs text-muted-foreground mb-1">Next up:</p>
                      <p className="text-sm font-semibold text-white">{next.name}</p>
                      <p className="text-xs text-muted-foreground">{next.phone}</p>
                    </div>
                  ) : null;
                })()}

                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400">
                  💡 WhatsApp Web opened — press <strong>Send</strong> there, then come back and click <strong>Next</strong>
                </div>
                {blastImage && (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20">
                    <Image src={blastImage} alt="card" width={40} height={40} className="rounded-lg object-cover flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-yellow-400 font-medium">📸 Attach your card in WA too!</p>
                      <p className="text-xs text-muted-foreground">Send message → then attach image via "+" button</p>
                    </div>
                    <button onClick={() => { navigator.clipboard.writeText(blastImage); toast.success("Copied!"); }}
                      className="text-xs text-yellow-400 border border-yellow-500/30 rounded px-2 py-1 flex-shrink-0">
                      Copy
                    </button>
                  </div>
                )}

                <div className="flex gap-3">
                  {blastIndex < selectedIds.size ? (
                    <button onClick={nextBlast}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 font-semibold text-sm hover:bg-green-500/30 transition-all">
                      <Send className="w-4 h-4" /> Next → ({blastIndex + 1}/{selectedIds.size})
                    </button>
                  ) : (
                    <button onClick={finishBlast}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 font-semibold text-sm hover:bg-emerald-500/30 transition-all">
                      ✅ All Done!
                    </button>
                  )}
                  <button onClick={finishBlast}
                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-muted-foreground text-sm hover:text-white transition-all">
                    Stop
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <button onClick={() => setShowBlast(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                  Cancel
                </button>
                <button onClick={startBlast}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all">
                  <Send className="w-4 h-4" /> Start → {selectedIds.size} owners
                </button>
              </div>
            )}
          </div>
        </div>
      )}


    </>) /* end owners tab */}

      {/* Owner Contact Modal */}
      <AnimatePresence>
        {selectedMatchOwner && (() => {
          const pd = parseOwnerNotes(selectedMatchOwner.notes);
          return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
              onClick={e => e.target === e.currentTarget && setSelectedMatchOwner(null)}>
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
                className="glass-card w-full max-w-sm p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold"
                      style={{ background: "rgba(234,179,8,0.15)", color: "#fde047" }}>
                      {pd?.propertyType ? (TYPE_ICON[pd.propertyType] || "🏢") : selectedMatchOwner.name[0]?.toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-white">{selectedMatchOwner.name}</h3>
                      {selectedMatchOwner.company && <p className="text-xs" style={{ color: "#facc15" }}>{selectedMatchOwner.company}</p>}
                      {selectedMatchOwner.locality && <p className="text-xs" style={{ color: "#94a3b8" }}>📍 {selectedMatchOwner.locality}</p>}
                    </div>
                  </div>
                  <button onClick={() => setSelectedMatchOwner(null)} className="text-muted-foreground hover:text-white">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                {pd && (pd.propertyType || pd.price || pd.area) && (
                  <div className="mb-4 p-3 rounded-xl space-y-2" style={{ background: "rgba(234,179,8,0.06)", border: "1px solid rgba(234,179,8,0.2)" }}>
                    <div className="flex flex-wrap gap-1.5">
                      {pd.propertyType && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(234,179,8,0.12)", color: "#fde047" }}>{TYPE_ICON[pd.propertyType] || ""} {pd.propertyType}</span>}
                      {pd.transactionType && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", color: "#94a3b8" }}>{pd.transactionType}</span>}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {pd.price && <div className="text-center p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}><div className="text-xs font-bold" style={{ color: "#facc15" }}>{fmtPrice(Number(pd.price), String(pd.transactionType || ""))}</div><div className="text-xs" style={{ color: "#64748b" }}>Price</div></div>}
                      {pd.area && <div className="text-center p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}><div className="text-xs font-bold text-white">{pd.area}</div><div className="text-xs" style={{ color: "#64748b" }}>Sq.ft</div></div>}
                      {pd.floor && <div className="text-center p-1.5 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}><div className="text-xs font-bold text-white">{pd.floor}</div><div className="text-xs" style={{ color: "#64748b" }}>Floor</div></div>}
                    </div>
                    {pd.amenities && <p className="text-xs" style={{ color: "#94a3b8" }}>✨ {pd.amenities}</p>}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <a href={`tel:${selectedMatchOwner.phone}`} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>
                    <Phone className="w-4 h-4" /> Call
                  </a>
                  <a href={`https://wa.me/91${selectedMatchOwner.phone.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(WA_COMPANY_MSG(selectedMatchOwner.name))}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
                    <MessageSquare className="w-4 h-4" /> WhatsApp
                  </a>
                  {selectedMatchOwner.phone2 && (
                    <a href={`tel:${selectedMatchOwner.phone2}`} className="col-span-2 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>
                      <Phone className="w-3.5 h-3.5" /> Alt: {selectedMatchOwner.phone2}
                    </a>
                  )}
                  <button onClick={() => setSelectedMatchOwner(null)} className="col-span-2 py-2 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }}>Close</button>
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Client Contact Modal */}
      <AnimatePresence>
        {selectedMatchClient && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setSelectedMatchClient(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-sm p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold" style={{ background: "rgba(59,130,246,0.2)", color: "#93c5fd" }}>
                    {selectedMatchClient.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-white">{selectedMatchClient.name}</h3>
                    <p className="text-xs" style={{ color: "#94a3b8" }}>{selectedMatchClient.phone}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedMatchClient(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-2 mb-4">
                <div className="flex flex-wrap gap-2">
                  {selectedMatchClient.propertyType && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.25)", color: "#fde047" }}>{selectedMatchClient.propertyType}</span>}
                  {selectedMatchClient.transactionType && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#94a3b8" }}>{selectedMatchClient.transactionType}</span>}
                  {selectedMatchClient.budget && <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: "rgba(234,179,8,0.12)", color: "#facc15" }}>{fmtBudget(selectedMatchClient.budget)}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${selectedMatchClient.score >= 80 ? "text-red-400" : selectedMatchClient.score >= 60 ? "text-orange-400" : "text-blue-400"}`}>
                    {selectedMatchClient.score >= 80 ? "🔥 HOT" : selectedMatchClient.score >= 60 ? "🌡️ WARM" : "❄️ COLD"} {selectedMatchClient.score}
                  </span>
                </div>
                {selectedMatchClient.requirements && <div className="p-2.5 rounded-lg text-xs" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#cbd5e1" }}>📋 {selectedMatchClient.requirements}</div>}
                {selectedMatchClient.email && <p className="text-xs" style={{ color: "#64748b" }}>{selectedMatchClient.email}</p>}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a href={`tel:${selectedMatchClient.phone}`} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(16,185,129,0.2)", border: "1px solid rgba(16,185,129,0.3)", color: "#6ee7b7" }}>
                  <Phone className="w-4 h-4" /> Call
                </a>
                <a href={`https://wa.me/91${selectedMatchClient.phone.replace(/\D/g,"").slice(-10)}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(34,197,94,0.2)", border: "1px solid rgba(34,197,94,0.3)", color: "#86efac" }}>
                  <MessageSquare className="w-4 h-4" /> WhatsApp
                </a>
                {selectedMatchClient.email && (
                  <a href={`mailto:${selectedMatchClient.email}`} className="col-span-2 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold" style={{ background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.25)", color: "#93c5fd" }}>
                    <Mail className="w-4 h-4" /> Email
                  </a>
                )}
                <button onClick={() => setSelectedMatchClient(null)} className="col-span-2 py-2 rounded-xl text-sm" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#64748b" }}>Close</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
