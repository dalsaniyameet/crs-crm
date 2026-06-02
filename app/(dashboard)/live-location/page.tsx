"use client";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Loader2, MapPin, RefreshCw, Navigation } from "lucide-react";

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
};

export default function LiveLocationPage() {
  const [users, setUsers]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

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
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Navigation className="w-6 h-6 text-emerald-400" /> Live Location
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Employees real-time location — active in last 10 min</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            {lastRefresh.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button onClick={() => { setLoading(true); load(); }}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-muted-foreground hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </button>
        </div>
      </div>

      {/* Online count */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/20 w-fit">
        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-xs text-emerald-400 font-medium">
          {users.length} employee{users.length !== 1 ? "s" : ""} active
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-estate-400" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Navigation className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No employees active right now</p>
          <p className="text-xs mt-1 opacity-60">Employees will appear here when they open the CRM and allow location</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {users.map((u, i) => {
            const mapsUrl  = `https://www.google.com/maps?q=${u.liveLatitude},${u.liveLongitude}`;
            const secsAgo  = Math.floor((Date.now() - new Date(u.liveUpdatedAt).getTime()) / 1000);
            const isRecent = secsAgo < 90;
            return (
              <motion.div key={u.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }} className="glass-card overflow-hidden">

                {/* User info row */}
                <div className="p-4 flex items-center gap-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-estate-600/30 flex items-center justify-center text-sm font-bold text-white">
                      {u.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background ${isRecent ? "bg-emerald-400 animate-pulse" : "bg-yellow-400"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-white text-sm">{u.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${ROLE_COLOR[u.role] || "bg-white/10 text-white border-white/20"}`}>
                        {u.role}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={`text-xs ${isRecent ? "text-emerald-400" : "text-yellow-400"}`}>
                        ● {timeAgo(u.liveUpdatedAt)}
                      </span>
                      {u.currentPage && (
                        <span className="text-xs text-muted-foreground">· {u.currentPage}</span>
                      )}
                    </div>
                  </div>
                  <a href={mapsUrl} target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-400 hover:bg-blue-500/30 transition-colors flex-shrink-0">
                    <MapPin className="w-3.5 h-3.5" /> Maps
                  </a>
                </div>

                {/* Address */}
                {u.liveAddress && (
                  <div className="px-4 pb-2">
                    <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                      <MapPin className="w-3 h-3 mt-0.5 flex-shrink-0 text-estate-400" />
                      {u.liveAddress}
                    </p>
                  </div>
                )}

                {/* Coordinates */}
                <div className="px-4 py-2 border-t border-white/10">
                  <span className="text-xs text-muted-foreground">
                    📍 {u.liveLatitude?.toFixed(5)}, {u.liveLongitude?.toFixed(5)}
                  </span>
                </div>

                {/* OpenStreetMap embed — click opens Google Maps */}
                <div className="relative cursor-pointer" onClick={() => window.open(mapsUrl, "_blank")}>
                  <div className="w-full h-44 relative overflow-hidden">
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${u.liveLongitude - 0.004},${u.liveLatitude - 0.004},${u.liveLongitude + 0.004},${u.liveLatitude + 0.004}&layer=mapnik&marker=${u.liveLatitude},${u.liveLongitude}`}
                      className="w-full h-full border-0 pointer-events-none"
                      title={`${u.name} location`}
                    />
                    <div className="absolute inset-0 bg-transparent" />
                    <div className="absolute bottom-2 right-2">
                      <span className="text-xs bg-black/70 text-white px-2 py-1 rounded-lg">
                        🗺️ Open in Google Maps
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground text-center">
        Auto-refresh: 30 sec · Employee location updates every 30 sec when CRM is open
      </p>
    </div>
  );
}
