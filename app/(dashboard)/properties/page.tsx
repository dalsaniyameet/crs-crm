"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, MapPin, Eye, Edit, Share2, Star,
  Zap, Camera, CheckCircle, Loader2, RefreshCw, ScanLine, Phone, X, Download, MessageSquare,
  ChevronLeft, ChevronRight, Building2, Layers, IndianRupee, Maximize2, BedDouble, Bath, CalendarClock,
} from "lucide-react";
import toast from "react-hot-toast";

import { useUser } from "@clerk/nextjs";

type PropStatus = "AVAILABLE" | "UNDER_NEGOTIATION" | "SOLD" | "RENTED" | "LEASED" | "OFF_MARKET";

interface Property {
  id: string;
  title: string;
  type: string;
  category: string;
  transactionType: string;
  status: PropStatus;
  price: number;
  area: number;
  carpetArea?: number;
  locality: string;
  city: string;
  photos: string[];
  amenities: string[];
  isVerified: boolean;
  isFeatured: boolean;
  commissionRate?: number;
  viewCount: number;
  ownerName?: string;
  ownerPhone?: string;
  listedBy?: { name: string };
}

const statusConfig: Record<PropStatus, { label: string; color: string }> = {
  AVAILABLE:         { label: "Available",    color: "text-emerald-400 bg-emerald-500/20 border-emerald-500/30" },
  UNDER_NEGOTIATION: { label: "Negotiation",  color: "text-orange-400 bg-orange-500/20 border-orange-500/30" },
  SOLD:              { label: "Sold",         color: "text-red-400 bg-red-500/20 border-red-500/30" },
  RENTED:            { label: "Rented",       color: "text-blue-400 bg-blue-500/20 border-blue-500/30" },
  LEASED:            { label: "Leased",       color: "text-purple-400 bg-purple-500/20 border-purple-500/30" },
  OFF_MARKET:        { label: "Off Market",   color: "text-gray-400 bg-gray-500/20 border-gray-500/30" },
};

const fmtPrice = (price: number, txType: string) => {
  const val = price >= 10000000 ? `₹${(price/10000000).toFixed(1)}Cr`
    : price >= 100000 ? `₹${(price/100000).toFixed(1)}L`
    : `₹${(price/1000).toFixed(0)}K`;
  return txType === "RENT" || txType === "LEASE" ? `${val}/mo` : val;
};

function PropCardImage({ photos, status, price, txType, isFeatured, isVerified }: {
  photos: string[]; status: PropStatus; price: number; txType: string;
  isFeatured: boolean; isVerified: boolean;
}) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (photos.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % photos.length), 3000);
    return () => clearInterval(t);
  }, [photos.length]);

  return (
    <div className="relative h-44 overflow-hidden bg-white/5 flex-shrink-0">
      {photos.length > 0 ? (
        <AnimatePresence mode="wait">
          <motion.img key={idx} src={photos[idx]} alt=""
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 w-full h-full object-cover" />
        </AnimatePresence>
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <Camera className="w-10 h-10 opacity-20" />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
      {photos.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 z-10">
          {photos.slice(0, 8).map((_, i) => (
            <div key={i} className={`rounded-full transition-all duration-300 ${
              i === idx ? "w-4 h-1.5 bg-white" : "w-1.5 h-1.5 bg-white/50"
            }`} />
          ))}
        </div>
      )}
      <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
        {isFeatured && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-500/90 text-black text-xs font-bold"><Star className="w-3 h-3" /> Featured</span>}
        {isVerified && <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/90 text-white text-xs font-bold"><CheckCircle className="w-3 h-3" /> Verified</span>}
      </div>
      <div className="absolute top-2.5 right-2.5 z-10">
        <span className={`text-xs px-2 py-0.5 rounded-full border ${statusConfig[status].color}`}>{statusConfig[status].label}</span>
      </div>
      <div className="absolute bottom-2.5 left-2.5 z-10">
        <div className="text-white font-bold text-base drop-shadow">{fmtPrice(price, txType)}</div>
      </div>
      {photos.length > 1 && (
        <div className="absolute bottom-2.5 right-2.5 z-10">
          <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-black/60 text-white text-xs">
            <Camera className="w-3 h-3" /> {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}

export default function PropertiesPage() {
  const { user } = useUser();
  const isAdmin = ["ADMIN","SALES_MANAGER"].includes(((user?.publicMetadata?.role as string) || "BROKER").toUpperCase());

  const [properties, setProperties] = useState<Property[]>([]);
  const [total, setTotal]           = useState(0);
  const [loading, setLoading]       = useState(true);
  const [search, setSearch]         = useState("");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [viewMode, setViewMode]     = useState<"grid" | "list">("grid");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showScanModal, setShowScanModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scannedData, setScannedData] = useState<Record<string, string> | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Batch scan state
  type ScanItem = { file: File; preview: string; status: "pending" | "scanning" | "done" | "error"; result?: Record<string, string> };
  const [batchFiles, setBatchFiles]   = useState<ScanItem[]>([]);
  const [batchScanning, setBatchScanning] = useState(false);
  const [batchDone, setBatchDone]     = useState(false);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: "", type: "OFFICE", category: "COMMERCIAL", transactionType: "RENT",
    price: "", area: "", carpetArea: "", locality: "", floor: "",
    ownerName: "", ownerPhone: "", commissionRate: "2",
    amenities: "", description: "",
  });

  const [viewProp, setViewProp]     = useState<Property | null>(null);
  const [viewPropFull, setViewPropFull] = useState<any>(null);
  const [photoIdx, setPhotoIdx]     = useState(0);
  const [editProp, setEditProp]     = useState<Property | null>(null);
  const [importing, setImporting]   = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const photoUploadRef = useRef<HTMLInputElement>(null);

  // ── Workflow modals ──
  const [showLeadMatch, setShowLeadMatch]   = useState(false);
  const [matchedLeads, setMatchedLeads]     = useState<any[]>([]);
  const [matchLoading, setMatchLoading]     = useState(false);
  const [showVisitModal, setShowVisitModal] = useState(false);
  const [showDealModal, setShowDealModal]   = useState(false);
  const [visitLeadId, setVisitLeadId]       = useState("");
  const [visitDate, setVisitDate]           = useState("");
  const [visitTime, setVisitTime]           = useState("");
  const [dealLeadId, setDealLeadId]         = useState("");
  const [dealValue, setDealValue]           = useState("");
  const [dealStage, setDealStage]           = useState("ENQUIRY");
  const [savingVisit, setSavingVisit]       = useState(false);
  const [savingDeal, setSavingDeal]         = useState(false);
  const [allLeads, setAllLeads]             = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/leads?limit=200").then(r => r.json())
      .then(d => setAllLeads(Array.isArray(d.leads) ? d.leads : []))
      .catch(() => {});
  }, []);

  async function findMatchingLeads(prop: Property) {
    setShowLeadMatch(true);
    setMatchLoading(true);
    setMatchedLeads([]);
    try {
      // Filter leads by property type + transaction type
      const txn = prop.transactionType; // RENT or SELL
      const matched = allLeads.filter(l => {
        const typeMatch = !l.propertyType || l.propertyType === prop.type ||
          (prop.category === "COMMERCIAL" && ["OFFICE","SHOP","SHOWROOM","WAREHOUSE"].includes(l.propertyType)) ||
          (prop.category === "RESIDENTIAL" && ["APARTMENT","VILLA","PLOT","PENTHOUSE"].includes(l.propertyType));
        const txnMatch = !l.transactionType ||
          (txn === "RENT"  && (l.transactionType === "RENT"  || l.transactionType === "LEASE")) ||
          (txn === "SELL"  && (l.transactionType === "BUY"   || l.transactionType === "SELL")) ||
          (txn === "LEASE" && (l.transactionType === "LEASE" || l.transactionType === "RENT"));
        const budgetMatch = !l.budget || l.budget >= prop.price * 0.7;
        return typeMatch && txnMatch && budgetMatch && l.status !== "DEAL_CLOSED" && l.status !== "LOST";
      });
      setMatchedLeads(matched.sort((a: any, b: any) => b.score - a.score).slice(0, 20));
    } catch {}
    setMatchLoading(false);
  }

  async function scheduleVisit() {
    if (!viewProp || !visitLeadId || !visitDate || !visitTime) { toast.error("Please fill all fields"); return; }
    setSavingVisit(true);
    try {
      const scheduledAt = new Date(`${visitDate}T${visitTime}`);
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leadId: visitLeadId, propertyId: viewProp.id, scheduledAt }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("✅ Site visit scheduled!");
      setShowVisitModal(false);
      setVisitLeadId(""); setVisitDate(""); setVisitTime("");
    } catch (err: any) { toast.error(err.message || "Failed"); }
    setSavingVisit(false);
  }

  async function createDeal() {
    if (!viewProp || !dealLeadId) { toast.error("Please select a lead"); return; }
    setSavingDeal(true);
    try {
      const lead  = allLeads.find(l => l.id === dealLeadId);
      const value = parseFloat(dealValue) || viewProp.price;
      const commission = viewProp.transactionType === "SELL"
        ? value * 0.01
        : viewProp.price; // 1 month brokerage
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title:      `${lead?.name || "Client"} — ${viewProp.title}`,
          leadId:     dealLeadId,
          propertyId: viewProp.id,
          stage:      dealStage,
          value,
          commission,
          commissionRate: viewProp.transactionType === "SELL" ? 1 : null,
          notes: viewProp.transactionType === "RENT"
            ? `Rent: ₹${viewProp.price.toLocaleString("en-IN")}/mo | Brokerage: ₹${viewProp.price.toLocaleString("en-IN")} | Security: ₹${(viewProp.price*2).toLocaleString("en-IN")} | Advance: ₹${viewProp.price.toLocaleString("en-IN")}`
            : `Sell: ₹${value.toLocaleString("en-IN")} | Commission 1%: ₹${commission.toLocaleString("en-IN")}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("✅ Deal created! Check Deal Pipeline.");
      setShowDealModal(false);
      setDealLeadId(""); setDealValue(""); setDealStage("ENQUIRY");
    } catch (err: any) { toast.error(err.message || "Failed"); }
    setSavingDeal(false);
  }

  async function openDetail(prop: Property) {
    setViewProp(prop);
    setPhotoIdx(0);
    setViewPropFull(null);
    try {
      const res  = await fetch(`/api/properties/${prop.id}`);
      const data = await res.json();
      if (data?.id) setViewPropFull(data);
    } catch {}
  }

  async function uploadPhotos(files: FileList, propId: string) {
    setUploadingPhotos(true);
    try {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("file", f));
      fd.append("folder", `properties/${propId}`);
      const res  = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const newUrls: string[] = (data.urls || [data]).map((u: any) => u.url).filter(Boolean);
      // Save to property
      const existing = viewProp?.photos || [];
      const merged   = [...existing, ...newUrls];
      const patchRes = await fetch(`/api/properties/${propId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photos: merged }),
      });
      const updated = await patchRes.json();
      if (!patchRes.ok) throw new Error(updated.error);
      // Update local state
      setViewProp(prev => prev ? { ...prev, photos: merged } : prev);
      setProperties(prev => prev.map(p => p.id === propId ? { ...p, photos: merged } : p));
      toast.success(`✅ ${newUrls.length} photo${newUrls.length > 1 ? "s" : ""} added!`);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    }
    setUploadingPhotos(false);
  }

  async function deletePhoto(propId: string, photoUrl: string) {
    const newPhotos = (viewProp?.photos || []).filter(p => p !== photoUrl);
    const res = await fetch(`/api/properties/${propId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: newPhotos }),
    });
    if (res.ok) {
      setViewProp(prev => prev ? { ...prev, photos: newPhotos } : prev);
      setProperties(prev => prev.map(p => p.id === propId ? { ...p, photos: newPhotos } : p));
      if (photoIdx >= newPhotos.length) setPhotoIdx(Math.max(0, newPhotos.length - 1));
      toast.success("Photo removed");
    }
  }

  // Auto-highlight from URL param
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id");
    if (id) {
      fetch(`/api/properties/${id}`).then(r => r.json()).then(d => { if (d?.id) setViewProp(d); }).catch(() => {});
    }
  }, []);

  const fetchProperties = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (categoryFilter !== "ALL") params.set("category", categoryFilter);
      const res  = await fetch(`/api/properties?${params}`);
      const data = await res.json();
      setProperties(data.properties ?? []);
      setTotal(data.total ?? 0);
    } catch {
      toast.error("Failed to load properties");
    } finally {
      setLoading(false);
    }
  }, [categoryFilter]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  const filtered = properties.filter(p =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.locality.toLowerCase().includes(search.toLowerCase())
  );

  async function handleScanCard(file: File) {
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res  = await fetch("/api/ai/scan-card", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return data;
    } catch {
      return null;
    }
  }

  function addBatchFiles(files: FileList) {
    const items: ScanItem[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
    }));
    setBatchFiles(prev => [...prev, ...items]);
    setBatchDone(false);
  }

  async function runBatchScan() {
    setBatchScanning(true);
    setBatchDone(false);
    const updated = [...batchFiles];
    for (let i = 0; i < updated.length; i++) {
      if (updated[i].status === "done") continue;
      updated[i] = { ...updated[i], status: "scanning" };
      setBatchFiles([...updated]);
      const result = await handleScanCard(updated[i].file);
      updated[i] = { ...updated[i], status: result ? "done" : "error", result: result ?? undefined };
      setBatchFiles([...updated]);
    }
    setBatchScanning(false);
    setBatchDone(true);
    const doneCount = updated.filter(u => u.status === "done").length;
    toast.success(`${doneCount} card${doneCount !== 1 ? "s" : ""} scanned successfully!`);
  }

  async function saveAllScanned() {
    const toSave = batchFiles.filter(b => b.status === "done" && b.result);
    let saved = 0;
    for (const item of toSave) {
      const d = item.result!;
      const body: Record<string, unknown> = {
        title:           d.propertyTitle || `Property – ${d.locality || "Unknown"}`,
        type:            d.propertyType  || "OFFICE",
        category:        "COMMERCIAL",
        transactionType: d.transactionType || "RENT",
        price:           parseFloat(d.price) || 0,
        area:            parseFloat(d.area)  || 0,
        locality:        d.locality    || "",
        city:            "Ahmedabad",
        state:           "Gujarat",
        ownerName:       d.ownerName   || undefined,
        ownerPhone:      d.ownerPhone  || undefined,
        commissionRate:  2,
        amenities:       [],
        photos:          [],
        commercial:      { deposit: 0 },
      };
      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) saved++;
    }
    toast.success(`${saved} properties saved!`);
    setBatchFiles([]);
    setBatchDone(false);
    setShowScanModal(false);
    fetchProperties();
  }

  function openSingleScan(data: Record<string, string>) {
    setScannedData(data);
    setForm(f => ({
      ...f,
      title:           data.propertyTitle || f.title,
      locality:        data.locality      || f.locality,
      ownerName:       data.ownerName     || f.ownerName,
      ownerPhone:      data.ownerPhone    || f.ownerPhone,
      type:            data.propertyType  || f.type,
      transactionType: data.transactionType || f.transactionType,
      price:           data.price         || f.price,
      area:            data.area          || f.area,
      description:     data.notes         || f.description,
    }));
    setShowScanModal(false);
    setShowAddModal(true);
  }

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        title:           form.title,
        type:            form.type,
        category:        form.category,
        transactionType: form.transactionType,
        price:           parseFloat(form.price),
        area:            parseFloat(form.area),
        carpetArea:      form.carpetArea ? parseFloat(form.carpetArea) : undefined,
        locality:        form.locality,
        city:            "Ahmedabad",
        state:           "Gujarat",
        floor:           form.floor ? parseInt(form.floor) : undefined,
        ownerName:       form.ownerName || undefined,
        ownerPhone:      form.ownerPhone || undefined,
        commissionRate:  parseFloat(form.commissionRate),
        amenities:       form.amenities.split(",").map(a => a.trim()).filter(Boolean),
        description:     form.description || undefined,
        photos:          [],
      };

      if (form.category === "COMMERCIAL") {
        body.commercial = { deposit: parseFloat(form.price) * 3 };
      } else {
        body.residential = { furnishing: "UNFURNISHED" };
      }

      const res = await fetch("/api/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 409) {
        toast.error("Possible duplicate property detected!");
      } else if (res.ok) {
        toast.success("Property added successfully!");
        setShowAddModal(false);
        setForm({ title: "", type: "OFFICE", category: "COMMERCIAL", transactionType: "RENT", price: "", area: "", carpetArea: "", locality: "", floor: "", ownerName: "", ownerPhone: "", commissionRate: "2", amenities: "", description: "" });
        fetchProperties();
      } else {
        toast.error(data.error || "Failed to add property");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  async function importFromWebsite() {
    setImporting(true);
    const tid = toast.loading("Importing from cityrealspace.com...");
    try {
      const res  = await fetch("/api/webhooks/import-website", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(`✅ ${data.imported} imported, ${data.updated} updated, ${data.errors} errors`, { id: tid, duration: 5000 });
      fetchProperties();
    } catch (err: any) {
      toast.error(err.message || "Import failed", { id: tid });
    }
    setImporting(false);
  }

  const available = properties.filter(p => p.status === "AVAILABLE").length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Property Management</h1>
          <p className="text-xs md:text-sm text-muted-foreground mt-1">
            {total} listings · <span className="text-emerald-400">{available} available</span>
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button onClick={importFromWebsite} disabled={importing}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 text-xs font-medium transition-all disabled:opacity-50">
              {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{importing ? "Importing..." : "Sync Website"}</span>
            </button>
          )}
          {isAdmin && (
            <a href="/api/properties/export" download
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all">
              <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
            </a>
          )}
          {isAdmin && (
            <button onClick={() => setShowScanModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30 text-xs font-medium transition-all">
              <ScanLine className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Scan Card</span>
            </button>
          )}
          {isAdmin && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
              <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Property</span><span className="sm:hidden">Add</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search properties..."
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-estate-500/50 transition-all" />
          </div>
          <div className="flex items-center gap-1">
            {(["grid", "list"] as const).map(mode => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`p-2 rounded-lg transition-all ${viewMode === mode ? "bg-estate-600/30 text-estate-400" : "bg-white/5 text-muted-foreground hover:text-white"}`}>
                {mode === "grid"
                  ? <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v3A1.5 1.5 0 0 1 5.5 7h-3A1.5 1.5 0 0 1 1 5.5v-3zm8 0A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v3A1.5 1.5 0 0 1 13.5 7h-3A1.5 1.5 0 0 1 9 5.5v-3zm-8 8A1.5 1.5 0 0 1 2.5 9h3A1.5 1.5 0 0 1 7 10.5v3A1.5 1.5 0 0 1 5.5 15h-3A1.5 1.5 0 0 1 1 13.5v-3zm8 0A1.5 1.5 0 0 1 10.5 9h3a1.5 1.5 0 0 1 1.5 1.5v3a1.5 1.5 0 0 1-1.5 1.5h-3A1.5 1.5 0 0 1 9 13.5v-3z" /></svg>
                  : <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path fillRule="evenodd" d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" /></svg>
                }
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {["ALL", "COMMERCIAL", "RESIDENTIAL"].map(c => (
            <button key={c} onClick={() => setCategoryFilter(c)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                categoryFilter === c
                  ? "bg-estate-600/30 border border-estate-500/50 text-estate-400"
                  : "bg-white/5 border border-white/10 text-muted-foreground hover:text-white"
              }`}>
              {c === "ALL" ? "All" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Property Grid/List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-estate-400 animate-spin" />
        </div>
      ) : (
        <div className={viewMode === "grid" ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" : "space-y-3"}>
          <AnimatePresence>
            {filtered.map((prop, i) => (
              <motion.div key={prop.id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                transition={{ duration: 0.15 }}
                onClick={() => openDetail(prop)}
                className="glass-card-hover overflow-hidden group cursor-pointer">
                <PropCardImage
                  photos={prop.photos}
                  status={prop.status}
                  price={prop.price}
                  txType={prop.transactionType}
                  isFeatured={prop.isFeatured}
                  isVerified={prop.isVerified}
                />

                {/* Content */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-white text-sm leading-tight line-clamp-2">{prop.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground flex-shrink-0">
                      {prop.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                    <MapPin className="w-3 h-3" /> {prop.locality}, {prop.city}
                  </div>
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="text-center p-2 rounded-lg bg-white/3">
                      <div className="text-xs font-medium text-white">{prop.area.toLocaleString()}</div>
                      <div className="text-xs text-muted-foreground">Sq.ft</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/3">
                      <div className="text-xs font-medium text-white">{prop.carpetArea?.toLocaleString() ?? "—"}</div>
                      <div className="text-xs text-muted-foreground">Carpet</div>
                    </div>
                    <div className="text-center p-2 rounded-lg bg-white/3">
                      <div className="text-xs font-medium text-gold-400">{prop.commissionRate ?? "—"}%</div>
                      <div className="text-xs text-muted-foreground">Commission</div>
                    </div>
                  </div>
                  {(prop.amenities ?? []).length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap mb-3">
                      {(prop.amenities ?? []).slice(0, 3).map(a => (
                        <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground">{a}</span>
                      ))}
                      {(prop.amenities ?? []).length > 3 && (
                        <span className="text-xs text-muted-foreground">+{(prop.amenities ?? []).length - 3}</span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-3 border-t border-white/5">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="w-3 h-3" /> {prop.viewCount} views
                    </div>
                    <div className="flex items-center gap-1">
                      {prop.ownerPhone && (
                        <a href={`tel:${prop.ownerPhone}`}
                          className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-400 transition-colors" title={`Call ${prop.ownerName || 'Owner'}`}>
                          <Phone className="w-3.5 h-3.5" />
                        </a>
                      )}
                      <button onClick={() => openDetail(prop)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      {isAdmin && <button onClick={() => setEditProp(prop)} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Edit className="w-3.5 h-3.5" /></button>}
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-estate-400 transition-colors"><Share2 className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-gold-400 transition-colors" title="AI Match"><Zap className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {prop.ownerName && (
                    <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">👤 {prop.ownerName}</span>
                      {prop.ownerPhone && (
                        <span className="text-xs text-emerald-400">{prop.ownerPhone}</span>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {filtered.length === 0 && !loading && (
            <div className="col-span-3 text-center py-16 text-muted-foreground">
              <Camera className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No properties found. Add your first listing!</p>
            </div>
          )}
        </div>
      )}

      {/* Scan Card Modal — Batch */}
      <AnimatePresence>
        {showScanModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && !batchScanning && setShowScanModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-2xl p-6 max-h-[90vh] flex flex-col">

              {/* Header */}
              <div className="flex items-center justify-between mb-4 flex-shrink-0">
                <div>
                  <h2 className="text-lg font-bold text-white">📇 Scan Owner Cards</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select 1–20 cards at once · AI will scan all automatically
                  </p>
                </div>
                <button onClick={() => { if (!batchScanning) { setShowScanModal(false); setBatchFiles([]); setBatchDone(false); } }}
                  className="text-muted-foreground hover:text-white disabled:opacity-40" disabled={batchScanning}>
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Drop zone */}
              {batchFiles.length === 0 ? (
                <div
                  onClick={() => batchInputRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files.length) addBatchFiles(e.dataTransfer.files); }}
                  className="border-2 border-dashed border-gold-500/30 rounded-xl p-10 text-center cursor-pointer hover:border-gold-500/60 hover:bg-gold-500/5 transition-all flex-shrink-0">
                  <Camera className="w-12 h-12 text-gold-400 mx-auto mb-3" />
                  <p className="text-white font-semibold">Click or drag & drop photos here</p>
                  <p className="text-xs text-muted-foreground mt-1">Select up to 20 visiting cards / stickers at once</p>
                  <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => { if (e.target.files?.length) addBatchFiles(e.target.files); }} />
                </div>
              ) : (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  {/* Progress bar */}
                  <div className="flex items-center justify-between text-xs flex-shrink-0">
                    <span className="text-muted-foreground">{batchFiles.length} card{batchFiles.length !== 1 ? "s" : ""} selected</span>
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-400">{batchFiles.filter(b => b.status === "done").length} done</span>
                      {batchFiles.some(b => b.status === "error") && (
                        <span className="text-red-400">{batchFiles.filter(b => b.status === "error").length} failed</span>
                      )}
                    </div>
                  </div>

                  {/* Cards grid */}
                  <div className="overflow-y-auto flex-1 grid grid-cols-3 sm:grid-cols-4 gap-2 pr-1">
                    {batchFiles.map((item, i) => (
                      <div key={i} className="relative rounded-xl overflow-hidden border border-white/10 aspect-[3/2] bg-white/5">
                        <img src={item.preview} alt="" className="w-full h-full object-cover" />
                        {/* Status overlay */}
                        <div className={`absolute inset-0 flex items-center justify-center ${
                          item.status === "scanning" ? "bg-black/60" :
                          item.status === "done"     ? "bg-emerald-500/20" :
                          item.status === "error"    ? "bg-red-500/20" : ""
                        }`}>
                          {item.status === "scanning" && <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />}
                          {item.status === "done"     && <CheckCircle className="w-6 h-6 text-emerald-400" />}
                          {item.status === "error"    && <X className="w-6 h-6 text-red-400" />}
                        </div>
                        {/* Result preview */}
                        {item.status === "done" && item.result && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-1.5 py-1">
                            <p className="text-xs text-white truncate">{item.result.ownerName || "—"}</p>
                            <p className="text-xs text-emerald-400 truncate">{item.result.ownerPhone || "—"}</p>
                          </div>
                        )}
                        {/* Remove button (only when not scanning) */}
                        {!batchScanning && item.status !== "scanning" && (
                          <button onClick={() => setBatchFiles(prev => prev.filter((_, j) => j !== i))}
                            className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors">
                            <X className="w-3 h-3" />
                          </button>
                        )}
                        {/* Edit single scanned card */}
                        {item.status === "done" && item.result && !batchScanning && (
                          <button onClick={() => openSingleScan(item.result!)}
                            className="absolute top-1 left-1 w-5 h-5 rounded-full bg-black/60 flex items-center justify-center text-gold-400 hover:bg-gold-500/40 transition-colors" title="Edit">
                            <ScanLine className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                    {/* Add more */}
                    {!batchScanning && (
                      <div onClick={() => batchInputRef.current?.click()}
                        className="rounded-xl border-2 border-dashed border-white/10 aspect-[3/2] flex items-center justify-center cursor-pointer hover:border-gold-500/40 hover:bg-gold-500/5 transition-all">
                        <Plus className="w-6 h-6 text-muted-foreground" />
                        <input ref={batchInputRef} type="file" accept="image/*" multiple className="hidden"
                          onChange={e => { if (e.target.files?.length) addBatchFiles(e.target.files); }} />
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 flex-shrink-0 pt-2 border-t border-white/5">
                    {!batchDone ? (
                      <>
                        <button onClick={() => { setBatchFiles([]); setBatchDone(false); }}
                          disabled={batchScanning}
                          className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all disabled:opacity-40">
                          Clear All
                        </button>
                        <button onClick={runBatchScan} disabled={batchScanning || batchFiles.length === 0}
                          className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                          {batchScanning
                            ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning {batchFiles.filter(b => b.status === "done" || b.status === "error").length}/{batchFiles.length}...</>
                            : <><ScanLine className="w-4 h-4" /> Scan All {batchFiles.length} Cards</>}
                        </button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => { setBatchFiles([]); setBatchDone(false); }}
                          className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                          Scan More
                        </button>
                        <button onClick={saveAllScanned}
                          disabled={!batchFiles.some(b => b.status === "done")}
                          className="flex-1 btn-primary text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                          <CheckCircle className="w-4 h-4" /> Save {batchFiles.filter(b => b.status === "done").length} Properties
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Info */}
              {batchFiles.length === 0 && (
                <div className="mt-4 p-3 rounded-xl bg-gold-500/5 border border-gold-500/20 flex-shrink-0">
                  <p className="text-xs font-semibold text-gold-400 mb-1">✨ AI will auto-extract from each card:</p>
                  <div className="grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                    <span>• Owner name & phone</span>
                    <span>• Property type</span>
                    <span>• Locality & address</span>
                    <span>• Price & area</span>
                    <span>• Company name</span>
                    <span>• Transaction type</span>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Property Detail Modal ── */}
      <AnimatePresence>
        {viewProp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-end md:items-center justify-center md:p-2 md:p-4"
            onClick={e => e.target === e.currentTarget && setViewProp(null)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-2xl max-h-[92dvh] md:max-h-[95vh] overflow-y-auto flex flex-col rounded-t-2xl md:rounded-xl">

              {/* Photo Gallery */}
              <div className="relative h-56 md:h-72 bg-white/5 flex-shrink-0">
                {viewProp.photos.length > 0 ? (
                  <>
                    <img src={viewProp.photos[photoIdx]} alt={viewProp.title}
                      className="w-full h-full object-cover" />
                    {/* Prev/Next */}
                    {viewProp.photos.length > 1 && (
                      <>
                        <button onClick={() => setPhotoIdx(i => (i - 1 + viewProp.photos.length) % viewProp.photos.length)}
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => setPhotoIdx(i => (i + 1) % viewProp.photos.length)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                        {/* Dots */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1">
                          {viewProp.photos.map((_, i) => (
                            <button key={i} onClick={() => setPhotoIdx(i)}
                              className={`w-1.5 h-1.5 rounded-full transition-all ${
                                i === photoIdx ? "bg-white w-4" : "bg-white/40"
                              }`} />
                          ))}
                        </div>
                        {/* Counter */}
                        <div className="absolute top-3 right-3 px-2 py-1 rounded-full bg-black/60 text-white text-xs">
                          {photoIdx + 1}/{viewProp.photos.length}
                        </div>
                      </>
                    )}
                    {/* Thumbnail strip */}
                    {viewProp.photos.length > 1 && (
                      <div className="absolute bottom-0 left-0 right-0 flex gap-1 p-2 bg-gradient-to-t from-black/70 to-transparent overflow-x-auto">
                        {viewProp.photos.map((ph, i) => (
                          <button key={i} onClick={() => setPhotoIdx(i)}
                            className={`flex-shrink-0 w-12 h-9 rounded overflow-hidden border-2 transition-all ${
                              i === photoIdx ? "border-white" : "border-transparent opacity-60 hover:opacity-100"
                            }`}>
                            <img src={ph} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Camera className="w-16 h-16 opacity-20" />
                  </div>
                )}
                {/* Badges */}
                <div className="absolute top-3 left-3 flex gap-2">
                  {viewProp.isFeatured && <span className="px-2 py-1 rounded-full bg-yellow-500/90 text-black text-xs font-bold">⭐ Featured</span>}
                  {viewProp.isVerified && <span className="px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold">✓ Verified</span>}
                </div>
                <button onClick={() => setViewProp(null)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Content */}
              <div className="p-4 md:p-5 space-y-4 overflow-y-auto">

                {/* Title + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-base md:text-lg font-bold text-white leading-tight">{viewProp.title}</h2>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {viewProp.locality}, {viewProp.city}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full border flex-shrink-0 ${statusConfig[viewProp.status].color}`}>
                    {statusConfig[viewProp.status].label}
                  </span>
                </div>

                {/* Price + Key Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center col-span-2 md:col-span-1">
                    <div className="text-xl font-bold text-yellow-400">{fmtPrice(viewProp.price, viewProp.transactionType)}</div>
                    <div className="text-xs text-muted-foreground">{viewProp.transactionType}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <div className="text-base font-bold text-white">{viewProp.area > 0 ? viewProp.area.toLocaleString() : "—"}</div>
                    <div className="text-xs text-muted-foreground">Sq.ft (SBA)</div>
                  </div>
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                    <div className="text-base font-bold text-white">{viewProp.carpetArea ? viewProp.carpetArea.toLocaleString() : "—"}</div>
                    <div className="text-xs text-muted-foreground">Carpet</div>
                  </div>
                  <div className="p-3 rounded-xl bg-estate-500/10 border border-estate-500/20 text-center">
                    <div className="text-base font-bold text-estate-400">
                      {viewProp.transactionType === "SELL" ? "1%" : "1 mo"}
                    </div>
                    <div className="text-xs text-muted-foreground">Brokerage</div>
                  </div>
                </div>

                {/* Brokerage Breakdown */}
                <div className={`p-3 rounded-xl border ${
                  viewProp.transactionType === "SELL"
                    ? "bg-emerald-500/8 border-emerald-500/20"
                    : "bg-blue-500/8 border-blue-500/20"
                }`}>
                  <p className={`text-xs font-semibold mb-2 ${
                    viewProp.transactionType === "SELL" ? "text-emerald-400" : "text-blue-400"
                  }`}>
                    {viewProp.transactionType === "SELL" ? "💰 Sell Brokerage" : "🔑 Rent Brokerage"}
                  </p>
                  {viewProp.transactionType === "SELL" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-sm font-bold text-emerald-400">1%</div>
                        <div className="text-xs text-muted-foreground">Commission</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-sm font-bold text-emerald-400">
                          ₹{Math.round(viewProp.price * 0.01).toLocaleString("en-IN")}
                        </div>
                        <div className="text-xs text-muted-foreground">Amount</div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-sm font-bold text-blue-400">₹{viewProp.price.toLocaleString("en-IN")}</div>
                        <div className="text-xs text-muted-foreground">1 mo Brokerage</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-sm font-bold text-purple-400">₹{(viewProp.price * 2).toLocaleString("en-IN")}</div>
                        <div className="text-xs text-muted-foreground">2 mo Security</div>
                      </div>
                      <div className="p-2 rounded-lg bg-white/5 text-center">
                        <div className="text-sm font-bold text-orange-400">₹{viewProp.price.toLocaleString("en-IN")}</div>
                        <div className="text-xs text-muted-foreground">1 mo Advance</div>
                      </div>
                    </div>
                  )}
                  <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Total client pays upfront:</span>
                    <span className="text-sm font-bold text-yellow-400">
                      {viewProp.transactionType === "SELL"
                        ? `₹${Math.round(viewProp.price * 0.01).toLocaleString("en-IN")}`
                        : `₹${(viewProp.price * 4).toLocaleString("en-IN")}`
                      }
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/20 text-blue-400">{viewProp.type}</span>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{viewProp.category}</span>
                  {viewPropFull?.floor && <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">Floor {viewPropFull.floor}{viewPropFull.totalFloors ? `/${viewPropFull.totalFloors}` : ""}</span>}
                  {viewPropFull?.residential?.furnishing && <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400">{viewPropFull.residential.furnishing.replace(/_/g, " ")}</span>}
                  {viewPropFull?.residential?.bhk && <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400">{viewPropFull.residential.bhk} BHK</span>}
                  {viewPropFull?.residential?.society && <span className="text-xs px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-muted-foreground">🏢 {viewPropFull.residential.society}</span>}
                </div>

                {/* Photos Management */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-white">🖼️ Photos ({viewProp.photos.length})</p>
                    <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
                      uploadingPhotos
                        ? "bg-white/5 text-muted-foreground opacity-50 pointer-events-none"
                        : "bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30"
                    }`}>
                      {uploadingPhotos
                        ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                        : <><Camera className="w-3.5 h-3.5" /> Add Photos</>}
                      <input ref={photoUploadRef} type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files, viewProp.id); e.target.value = ""; }} />
                    </label>
                  </div>
                  {viewProp.photos.length > 0 ? (
                    <div className="grid grid-cols-4 gap-1.5">
                      {viewProp.photos.map((ph, i) => (
                        <div key={i} onClick={() => setPhotoIdx(i)}
                          className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                            i === photoIdx ? "border-white" : "border-transparent hover:border-white/40"
                          }`}>
                          <img src={ph} alt="" className="w-full h-full object-cover" />
                          <button onClick={e => { e.stopPropagation(); deletePhoto(viewProp.id, ph); }}
                            className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors opacity-0 group-hover:opacity-100 hover:opacity-100">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      {/* Add more tile */}
                      <label className="aspect-square rounded-lg border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-gold-500/40 hover:bg-gold-500/5 transition-all">
                        <Plus className="w-5 h-5 text-muted-foreground" />
                        <input type="file" accept="image/*" multiple className="hidden"
                          onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files, viewProp.id); e.target.value = ""; }} />
                      </label>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:border-gold-500/40 hover:bg-gold-500/5 transition-all">
                      <Camera className="w-8 h-8 text-muted-foreground opacity-40" />
                      <p className="text-xs text-muted-foreground">Click to add photos</p>
                      <input type="file" accept="image/*" multiple className="hidden"
                        onChange={e => { if (e.target.files?.length) uploadPhotos(e.target.files, viewProp.id); e.target.value = ""; }} />
                    </label>
                  )}
                </div>

                {/* Description */}
                {viewPropFull?.description && (
                  <div className="p-3 rounded-xl bg-white/3 border border-white/8">
                    <p className="text-xs text-muted-foreground leading-relaxed">{viewPropFull.description}</p>
                  </div>
                )}

                {/* Amenities — ALL */}
                {viewProp.amenities?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-white mb-2">✨ Amenities ({viewProp.amenities.length})</p>
                    <div className="flex flex-wrap gap-1.5">
                      {viewProp.amenities.map(a => (
                        <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-muted-foreground">{a}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Owner Contact */}
                {viewProp.ownerName && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                    <p className="text-xs text-muted-foreground mb-2">👤 Owner / Agent</p>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{viewProp.ownerName}</div>
                        {viewProp.ownerPhone && <div className="text-xs text-emerald-400 mt-0.5">{viewProp.ownerPhone}</div>}
                      </div>
                      {viewProp.ownerPhone && (
                        <div className="flex gap-2">
                          <a href={`tel:${viewProp.ownerPhone}`}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium hover:bg-emerald-500/30 transition-all">
                            <Phone className="w-3.5 h-3.5" /> Call
                          </a>
                          <a href={`https://wa.me/91${viewProp.ownerPhone.replace(/\D/g,"").slice(-10)}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-all">
                            <MessageSquare className="w-3.5 h-3.5" /> WhatsApp
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={() => { setShowLeadMatch(true); findMatchingLeads(viewProp); }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-400 text-sm font-medium hover:bg-purple-500/30 transition-all">
                    <Zap className="w-4 h-4" /> Match Leads
                  </button>
                  <button onClick={() => setShowVisitModal(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/30 transition-all">
                    <Eye className="w-4 h-4" /> Site Visit
                  </button>
                  <button onClick={() => setShowDealModal(true)}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 transition-all">
                    <CheckCircle className="w-4 h-4" /> Create Deal
                  </button>
                  <button onClick={() => {
                    const txt = `🏢 *${viewProp.title}*\n📍 ${viewProp.locality}, ${viewProp.city}\n💰 ${fmtPrice(viewProp.price, viewProp.transactionType)}\n📐 ${viewProp.area} sqft${viewProp.carpetArea ? ` (Carpet: ${viewProp.carpetArea})` : ""}\n📞 ${viewProp.ownerPhone || ""}\n\n${viewProp.photos[0] || ""}`;
                    navigator.clipboard.writeText(txt);
                    toast.success("Property details copied! 📋");
                  }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-500/20 border border-blue-500/30 text-blue-400 text-sm font-medium hover:bg-blue-500/30 transition-all">
                    <Share2 className="w-4 h-4" /> Copy & Share
                  </button>
                  <a href={`https://wa.me/91${(viewProp.ownerPhone||"").replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(`Hi, I have a client interested in your property: ${viewProp.title} — ${viewProp.locality}. Price: ${fmtPrice(viewProp.price, viewProp.transactionType)}. Can we discuss?`)}`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-green-500/20 border border-green-500/30 text-green-400 text-sm font-medium hover:bg-green-500/30 transition-all">
                    <MessageSquare className="w-4 h-4" /> WA Owner
                  </a>
                  <button onClick={() => { setViewProp(null); setEditProp(viewProp); }}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-estate-500/20 border border-estate-500/30 text-estate-300 text-sm font-medium hover:bg-estate-500/30 transition-all">
                    <Edit className="w-4 h-4" /> Edit Status
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick Edit Status Modal */}
      <AnimatePresence>
        {editProp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setEditProp(null)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="glass-card w-full max-w-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-bold text-white">Edit Status</h2>
                <button onClick={() => setEditProp(null)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-white mb-1 truncate">{editProp.title}</p>
                  <p className="text-xs text-muted-foreground">{editProp.locality}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
                  <select
                    defaultValue={editProp.status}
                    onChange={async e => {
                      const newStatus = e.target.value;
                      const res = await fetch(`/api/properties/${editProp.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: newStatus }),
                      });
                      if (res.ok) {
                        setProperties(prev => prev.map(p => p.id === editProp.id ? { ...p, status: newStatus as PropStatus } : p));
                        toast.success("Status updated!");
                        setEditProp(null);
                      } else toast.error("Failed to update");
                    }}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-estate-500/50">
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <option key={k} value={k} className="bg-[#0f1f35]">{v.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add Property Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[80] flex items-end md:items-center justify-center md:p-4"
            onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div
              initial={{ y: "100%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "100%", opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="glass-card w-full md:max-w-2xl p-5 md:p-6 max-h-[92dvh] overflow-y-auto rounded-t-2xl md:rounded-xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-white">Add New Property</h2>
                <button onClick={() => setShowAddModal(false)} className="text-muted-foreground hover:text-white">✕</button>
              </div>
              <form onSubmit={handleAddProperty} className="space-y-4">
                {scannedData && (
                  <div className="p-3 rounded-xl bg-gold-500/5 border border-gold-500/20 flex items-center gap-3">
                    <ScanLine className="w-4 h-4 text-gold-400 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-gold-400">AI Scanned from Card</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {scannedData.ownerName} · {scannedData.ownerPhone}
                        {scannedData.ownerPhone && (
                          <a href={`tel:${scannedData.ownerPhone}`}
                            className="ml-2 text-emerald-400 hover:text-emerald-300">
                            <Phone className="w-3 h-3 inline" /> Call
                          </a>
                        )}
                      </p>
                    </div>
                    {scannedData.imageUrl && (
                      <img src={scannedData.imageUrl} alt="card" className="w-12 h-8 object-cover rounded border border-white/10" />
                    )}
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Property Title *</label>
                  <input required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                    placeholder="Premium Office Space – Prahlad Nagar" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Category *</label>
                    <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                      <option value="COMMERCIAL">Commercial</option>
                      <option value="RESIDENTIAL">Residential</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Type *</label>
                    <select value={form.type} onChange={e => setForm(f => ({...f, type: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                      <option value="OFFICE">Office</option>
                      <option value="SHOP">Shop</option>
                      <option value="SHOWROOM">Showroom</option>
                      <option value="WAREHOUSE">Warehouse</option>
                      <option value="APARTMENT">Apartment</option>
                      <option value="VILLA">Villa</option>
                      <option value="PLOT">Plot</option>
                      <option value="PENTHOUSE">Penthouse</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Transaction *</label>
                    <select value={form.transactionType} onChange={e => setForm(f => ({...f, transactionType: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 text-foreground">
                      <option value="RENT">Rent</option>
                      <option value="SELL">Sell</option>
                      <option value="LEASE">Lease</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Price (₹) *</label>
                    <input required type="number" value={form.price} onChange={e => setForm(f => ({...f, price: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="75000" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Locality *</label>
                    <input required value={form.locality} onChange={e => setForm(f => ({...f, locality: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="Prahlad Nagar" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Area (sqft) *</label>
                    <input required type="number" value={form.area} onChange={e => setForm(f => ({...f, area: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="2200" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Carpet Area (sqft)</label>
                    <input type="number" value={form.carpetArea} onChange={e => setForm(f => ({...f, carpetArea: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="1800" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Floor</label>
                    <input type="number" value={form.floor} onChange={e => setForm(f => ({...f, floor: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="5" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Owner Name</label>
                    <input value={form.ownerName} onChange={e => setForm(f => ({...f, ownerName: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="Suresh Patel" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Owner Phone</label>
                    <input value={form.ownerPhone} onChange={e => setForm(f => ({...f, ownerPhone: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="9876543210" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Commission %</label>
                    <input type="number" step="0.5" value={form.commissionRate} onChange={e => setForm(f => ({...f, commissionRate: e.target.value}))}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                      placeholder="2" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Amenities (comma separated)</label>
                  <input value={form.amenities} onChange={e => setForm(f => ({...f, amenities: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50"
                    placeholder="Parking, AC, Power Backup, Lift, Security" />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Description</label>
                  <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-estate-500/50 resize-none"
                    placeholder="Premium office space with modern amenities..." />
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowAddModal(false)}
                    className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white transition-all">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="flex-1 btn-primary text-sm flex items-center justify-center gap-2">
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Add Property</>}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Lead Match Modal ── */}
      <AnimatePresence>
        {showLeadMatch && viewProp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowLeadMatch(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-lg max-h-[85vh] flex flex-col">
              <div className="p-4 border-b border-white/10 flex items-center justify-between flex-shrink-0">
                <div>
                  <h2 className="text-base font-bold text-white">⚡ Matching Leads</h2>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{viewProp.title}</p>
                </div>
                <button onClick={() => setShowLeadMatch(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {matchLoading ? (
                  <div className="flex items-center justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-purple-400" /></div>
                ) : matchedLeads.length === 0 ? (
                  <div className="text-center py-10 text-muted-foreground">
                    <p className="text-sm">No matching leads found</p>
                    <p className="text-xs mt-1 opacity-60">Property type or budget did not match</p>
                  </div>
                ) : matchedLeads.map(lead => (
                  <div key={lead.id} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                      lead.score >= 80 ? "bg-red-500/20 text-red-400" : lead.score >= 60 ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                    }`}>{lead.name[0]?.toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{lead.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                          lead.score >= 80 ? "bg-red-500/15 text-red-400" : lead.score >= 60 ? "bg-orange-500/15 text-orange-400" : "bg-blue-500/15 text-blue-400"
                        }`}>{lead.score >= 80 ? "🔥" : lead.score >= 60 ? "🌡️" : "❄️"} {lead.score}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{lead.phone} · {lead.status?.replace(/_/g," ")}</div>
                      {lead.budget && <div className="text-xs text-gold-400">₹{(lead.budget/100000).toFixed(1)}L budget</div>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <a href={`tel:${lead.phone}`} className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"><Phone className="w-3.5 h-3.5" /></a>
                      <a href={`https://wa.me/91${lead.phone.replace(/\D/g,"").slice(-10)}?text=${encodeURIComponent(`Hi ${lead.name}, I have a property matching your requirement: ${viewProp.title} — ${viewProp.locality} at ${fmtPrice(viewProp.price, viewProp.transactionType)}. Interested?`)}`}
                        target="_blank" rel="noreferrer" className="p-1.5 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"><MessageSquare className="w-3.5 h-3.5" /></a>
                      <button onClick={() => { setVisitLeadId(lead.id); setShowLeadMatch(false); setShowVisitModal(true); }}
                        className="p-1.5 rounded-lg bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 transition-colors" title="Schedule Visit"><Eye className="w-3.5 h-3.5" /></button>
                      <button onClick={() => { setDealLeadId(lead.id); setDealValue(String(viewProp.price)); setShowLeadMatch(false); setShowDealModal(true); }}
                        className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors" title="Create Deal"><CheckCircle className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t border-white/10 flex-shrink-0">
                <p className="text-xs text-muted-foreground text-center">{matchedLeads.length} leads matched · 📞 WA 💬 Visit 👁️ Deal ✅</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Site Visit Modal ── */}
      <AnimatePresence>
        {showVisitModal && viewProp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowVisitModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">📅 Schedule Site Visit</h2>
                <button onClick={() => setShowVisitModal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-4">
                <p className="text-xs text-muted-foreground">Property</p>
                <p className="text-sm font-semibold text-white truncate">{viewProp.title}</p>
                <p className="text-xs text-muted-foreground">{viewProp.locality} · {fmtPrice(viewProp.price, viewProp.transactionType)}</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Client / Lead *</label>
                  <select value={visitLeadId} onChange={e => setVisitLeadId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50">
                    <option value="">Select lead...</option>
                    {allLeads.filter(l => l.status !== "DEAL_CLOSED" && l.status !== "LOST").map(l => (
                      <option key={l.id} value={l.id} className="bg-[#0f1f35]">{l.name} — {l.phone}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Date *</label>
                    <input type="date" value={visitDate} min={new Date().toISOString().split("T")[0]}
                      onChange={e => setVisitDate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Time *</label>
                    <input type="time" value={visitTime} onChange={e => setVisitTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500/50 [color-scheme:dark]" />
                  </div>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowVisitModal(false)}
                    className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white">Cancel</button>
                  <button onClick={scheduleVisit} disabled={savingVisit}
                    className="flex-1 py-2 rounded-lg bg-orange-500/20 border border-orange-500/30 text-orange-400 text-sm font-medium hover:bg-orange-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingVisit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
                    {savingVisit ? "Saving..." : "Schedule Visit"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Create Deal Modal ── */}
      <AnimatePresence>
        {showDealModal && viewProp && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowDealModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="glass-card w-full max-w-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-white">🤝 Create Deal</h2>
                <button onClick={() => setShowDealModal(false)} className="text-muted-foreground hover:text-white"><X className="w-5 h-5" /></button>
              </div>
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 mb-3">
                <p className="text-xs text-muted-foreground">Property</p>
                <p className="text-sm font-semibold text-white truncate">{viewProp.title}</p>
                <p className="text-xs text-muted-foreground">{viewProp.locality} · {fmtPrice(viewProp.price, viewProp.transactionType)}</p>
              </div>
              <div className={`p-3 rounded-xl mb-4 ${
                viewProp.transactionType === "SELL" ? "bg-emerald-500/10 border border-emerald-500/20" : "bg-blue-500/10 border border-blue-500/20"
              }`}>
                <p className="text-xs font-semibold text-white mb-1">Brokerage Earned:</p>
                {viewProp.transactionType === "SELL"
                  ? <p className="text-sm font-bold text-emerald-400">₹{Math.round((parseFloat(dealValue)||viewProp.price)*0.01).toLocaleString("en-IN")} (1%)</p>
                  : <p className="text-sm font-bold text-blue-400">₹{viewProp.price.toLocaleString("en-IN")} (1 month)</p>
                }
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Client / Lead *</label>
                  <select value={dealLeadId} onChange={e => setDealLeadId(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    <option value="">Select lead...</option>
                    {allLeads.filter(l => l.status !== "DEAL_CLOSED" && l.status !== "LOST").map(l => (
                      <option key={l.id} value={l.id} className="bg-[#0f1f35]">{l.name} — {l.phone}</option>
                    ))}
                  </select>
                </div>
                {viewProp.transactionType === "SELL" && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Deal Value (₹)</label>
                    <input type="number" value={dealValue} onChange={e => setDealValue(e.target.value)}
                      placeholder={String(viewProp.price)}
                      className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50" />
                  </div>
                )}
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Stage</label>
                  <select value={dealStage} onChange={e => setDealStage(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500/50">
                    {["ENQUIRY","SITE_VISIT","NEGOTIATION","TOKEN","AGREEMENT","REGISTRATION"].map(s => (
                      <option key={s} value={s} className="bg-[#0f1f35]">{s.replace(/_/g," ")}</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setShowDealModal(false)}
                    className="flex-1 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-muted-foreground hover:text-white">Cancel</button>
                  <button onClick={createDeal} disabled={savingDeal}
                    className="flex-1 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/30 disabled:opacity-50 flex items-center justify-center gap-2">
                    {savingDeal ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    {savingDeal ? "Creating..." : "Create Deal"}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
