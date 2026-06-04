"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, RefreshCw, Navigation, Users } from "lucide-react";

function timeAgo(d: string) {
  const secs = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

const ROLE_COLOR: Record<string, string> = {
  BROKER:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SALES_MANAGER: "bg-green-500/20 text-green-400 border-green-500/30",
  MARKETING:     "bg-purple-500/20 text-purple-400 border-purple-500/30",
  ADMIN:         "bg-red-500/20 text-red-400 border-red-500/30",
};

const MARKER_COLOR: Record<string, string> = {
  BROKER:        "%232563eb",
  SALES_MANAGER: "%2316a34a",
  MARKETING:     "%239333ea",
  ADMIN:         "%23dc2626",
};

// Build OSM embed URL showing ALL employees on one map
function buildMapUrl(users: any[]) {
  if (users.length === 0) return null;

  const lats = users.map(u => u.liveLatitude);
  const lngs = users.map(u => u.liveLongitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add padding
  const pad = 0.008;
  const bbox = `${minLng - pad},${minLat - pad},${maxLng + pad},${maxLat + pad}`;

  // For single user, use marker param
  if (users.length === 1) {
    const u = users[0];
    return `https://www.openstreetmap.org/export/embed.html?bbox=${u.liveLongitude - 0.006},${u.liveLatitude - 0.006},${u.liveLongitude + 0.006},${u.liveLatitude + 0.006}&layer=mapnik&marker=${u.liveLatitude},${u.liveLongitude}`;
  }

  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik`;
}

export default function LiveLocationPage() {
  const [users, setUsers]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selected, setSelected]   = useState<string | null>(null);
  const mapRef = useRef<HTMLIFrameElement>(null);

  async function load() {
    try {
      const res  = await fetch("/api/location");
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
    } catch {}
    setLoading(false);
    setLastRefresh(new Date());
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  const displayUsers = selected ? users.filter(u => u.id === selected) : users;
  const mapUrl = buildMapUrl(displayUsers);

  const activeCount = users.filter(u => {
    const secs = (Date.now() - new Date(u.liveUpdatedAt).getTime()) / 1000;
    return secs < 90;
  }).length;

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-7xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-emerald-400" /> Live Location
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Employees real-time location · last 5 min
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </span>
          <button onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs text-emerald-400 font-medium">
            {activeCount} online now
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
          <Users className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-white font-medium">
            {users.length} active (last 5 min)
          </span>
        </div>
        {selected && (
          <button onClick={() => setSelected(null)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 transition-colors">
            ✕ Show all employees
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-estate-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Navigation className="w-14 h-14 mx-auto mb-4 opacity-20" />
          <p className="text-base font-medium text-white">No employees active right now</p>
          <p className="text-xs mt-1 opacity-60">Employees appear here when they open the CRM and allow location</p>
          <p className="text-xs mt-4 opacity-40">Auto-refresh: 1 min · Location updates every 30 sec when CRM is open</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* ── LEFT: Employee list ── */}
          <div className="lg:col-span-1 space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {users.map((u, i) => {
              const secs     = (Date.now() - new Date(u.liveUpdatedAt).getTime()) / 1000;
              const isOnline = secs < 90;
              const isSelected = selected === u.id;
              const mapsUrl  = `https://www.google.com/maps?q=${u.liveLatitude},${u.liveLongitude}`;
              return (
                <motion.div key={u.id}
                  initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  onClick={() => setSelected(isSelected ? null : u.id)}
                  className={`glass-card p-3 cursor-pointer transition-all border ${ 
                    isSelected
                      ? "border-yellow-500/40 bg-yellow-500/5"
                      : isOnline
                      ? "border-emerald-500/20 hover:border-emerald-500/30"
                      : "border-white/10 hover:border-white/20"
                  }`}>
                  <div className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-estate-600 to-estate-400 flex items-center justify-center text-sm font-bold text-white">
                        {u.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#04080f] ${
                        isOnline ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"
                      }`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-white text-sm truncate">{u.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border flex-shrink-0 ${ROLE_COLOR[u.role] || "bg-white/10 text-white border-white/20"}`}>
                          {u.role?.replace("_", " ")}
                        </span>
                      </div>
                      <p className={`text-xs mt-0.5 ${isOnline ? "text-emerald-400" : "text-yellow-400"}`}>
                        {isOnline ? "🟢" : "🟡"} {timeAgo(u.liveUpdatedAt)}
                      </p>
                      {u.liveAddress && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          📍 {u.liveAddress.split(",").slice(0, 2).join(",")}
                        </p>
                      )}
                    </div>
                  </div>
                  {/* Mini action row */}
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {u.liveLatitude?.toFixed(5)}, {u.liveLongitude?.toFixed(5)}
                    </span>
                    <a href={mapsUrl} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="text-xs px-2 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 transition-colors flex-shrink-0">
                      Maps ↗
                    </a>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── RIGHT: Map ── */}
          <div className="lg:col-span-2">
            <div className="glass-card overflow-hidden rounded-2xl" style={{ height: 600 }}>
              {/* Map header */}
              <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-estate-400" />
                  <span className="text-sm font-medium text-white">
                    {selected
                      ? `${users.find(u => u.id === selected)?.name} — Location`
                      : `All Employees (${users.length})`
                    }
                  </span>
                </div>
                {selected && (
                  <a
                    href={`https://www.google.com/maps?q=${users.find(u => u.id === selected)?.liveLatitude},${users.find(u => u.id === selected)?.liveLongitude}`}
                    target="_blank" rel="noreferrer"
                    className="text-xs px-3 py-1 rounded-lg bg-blue-500/15 border border-blue-500/25 text-blue-400 hover:bg-blue-500/25 transition-colors">
                    Open Google Maps ↗
                  </a>
                )}
              </div>

              {/* Legend */}
              <div className="px-4 py-2 border-b border-white/5 flex flex-wrap gap-3">
                {users.map(u => {
                  const secs = (Date.now() - new Date(u.liveUpdatedAt).getTime()) / 1000;
                  const isOnline = secs < 90;
                  return (
                    <button key={u.id} onClick={() => setSelected(selected === u.id ? null : u.id)}
                      className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border transition-all ${
                        selected === u.id
                          ? "bg-yellow-500/20 border-yellow-500/40 text-yellow-300"
                          : "bg-white/5 border-white/10 text-muted-foreground hover:text-white"
                      }`}>
                      <span className={`w-2 h-2 rounded-full ${isOnline ? "bg-emerald-400" : "bg-yellow-400"}`} />
                      {u.name?.split(" ")[0]}
                    </button>
                  );
                })}
              </div>

              {/* OSM iframe */}
              {mapUrl ? (
                <div className="relative" style={{ height: "calc(600px - 88px)" }}>
                  <iframe
                    ref={mapRef}
                    key={mapUrl}
                    src={mapUrl}
                    className="w-full h-full border-0"
                    title="Employee Live Locations"
                  />
                  {/* Overlay pins for multi-user (OSM doesn't support multiple markers natively) */}
                  {!selected && users.length > 1 && (
                    <div className="absolute inset-0 pointer-events-none">
                      {/* Info overlay bottom-left */}
                      <div className="absolute bottom-3 left-3 flex flex-col gap-1">
                        {users.map(u => {
                          const secs = (Date.now() - new Date(u.liveUpdatedAt).getTime()) / 1000;
                          const isOnline = secs < 90;
                          return (
                            <div key={u.id} className="flex items-center gap-1.5 bg-black/80 text-white text-xs px-2 py-1 rounded-lg backdrop-blur-sm">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isOnline ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
                              <span className="font-medium">{u.name?.split(" ")[0]}</span>
                              <span className="text-white/50">·</span>
                              <span className="text-white/70">{timeAgo(u.liveUpdatedAt)}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {/* Click to open Google Maps */}
                  <div className="absolute bottom-3 right-3 pointer-events-auto">
                    <a
                      href={selected
                        ? `https://www.google.com/maps?q=${users.find(u=>u.id===selected)?.liveLatitude},${users.find(u=>u.id===selected)?.liveLongitude}`
                        : `https://www.google.com/maps/search/${users.map(u=>`${u.liveLatitude},${u.liveLongitude}`).join("/")}`
                      }
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-1.5 text-xs bg-black/80 text-white px-3 py-1.5 rounded-lg backdrop-blur-sm hover:bg-black/90 transition-colors">
                      🗺️ Open in Google Maps
                    </a>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">No location data</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Auto-refresh: 1 min · Employee location updates every 30 sec when CRM is open
      </p>
    </div>
  );
}
