"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, MapPin, Eye, Edit, Share2, Star,
  Zap, Camera, CheckCircle, Loader2, RefreshCw, ScanLine, Phone, X, Download,
} from "lucide-react";
import toast from "react-hot-toast";

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

export default function PropertiesPage() {
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
          <button onClick={fetchProperties} className="p-2 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-all">
            <RefreshCw className="w-4 h-4" />
          </button>
          <a href="/api/properties/export" download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30 text-xs font-medium transition-all">
            <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Export</span>
          </a>
          <button onClick={() => setShowScanModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold-500/20 border border-gold-500/30 text-gold-400 hover:bg-gold-500/30 text-xs font-medium transition-all">
            <ScanLine className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Scan Card</span>
          </button>
          <button onClick={() => setShowAddModal(true)} className="btn-primary flex items-center gap-1.5 text-sm">
            <Plus className="w-4 h-4" /> <span className="hidden sm:inline">Add Property</span><span className="sm:hidden">Add</span>
          </button>
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
                className="glass-card-hover overflow-hidden group">
                {/* Image */}
                <div className="relative h-48 overflow-hidden bg-white/5">
                  {prop.photos[0] ? (
                    <img src={prop.photos[0]} alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                      <Camera className="w-12 h-12 opacity-20" />
                    </div>
                  )}
                  <div className="property-img-overlay absolute inset-0" />
                  <div className="absolute top-3 left-3 flex items-center gap-2">
                    {prop.isFeatured && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-gold-500/90 text-black text-xs font-bold">
                        <Star className="w-3 h-3" /> Featured
                      </span>
                    )}
                    {prop.isVerified && (
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-xs font-bold">
                        <CheckCircle className="w-3 h-3" /> Verified
                      </span>
                    )}
                  </div>
                  <div className="absolute top-3 right-3">
                    <span className={`text-xs px-2 py-1 rounded-full border ${statusConfig[prop.status].color}`}>
                      {statusConfig[prop.status].label}
                    </span>
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <div className="text-white font-bold text-lg">
                      {fmtPrice(prop.price, prop.transactionType)}
                    </div>
                  </div>
                  {prop.photos.length > 0 && (
                    <div className="absolute bottom-3 right-3">
                      <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-black/60 text-white text-xs">
                        <Camera className="w-3 h-3" /> {prop.photos.length}
                      </span>
                    </div>
                  )}
                </div>

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
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Eye className="w-3.5 h-3.5" /></button>
                      <button className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors"><Edit className="w-3.5 h-3.5" /></button>
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

      {/* Add Property Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={e => e.target === e.currentTarget && setShowAddModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
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
    </div>
  );
}
