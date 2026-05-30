"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronRight, Zap, Search, LogOut, LogIn, LogOut as PunchOut, Coffee, Users, Building2, TrendingUp, CalendarDays, UserCircle, FileText, Home } from "lucide-react";
import NotificationBell from "@/components/ui/notification-bell";
import { getNavForRole, UserRole } from "@/lib/roles";
import { useUser, useClerk } from "@clerk/nextjs";
import toast from "react-hot-toast";

function NavProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setOpacity(1);
    setWidth(0);
    const t1 = setTimeout(() => setWidth(30), 10);
    const t2 = setTimeout(() => setWidth(70), 100);
    const t3 = setTimeout(() => setWidth(85), 400);
    const t4 = setTimeout(() => setWidth(100), 600);
    const t5 = setTimeout(() => setOpacity(0), 750);
    const t6 = setTimeout(() => setWidth(0), 900);
    return () => { [t1,t2,t3,t4,t5,t6].forEach(clearTimeout); };
  }, [pathname]);

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[2px] pointer-events-none"
      style={{ opacity, transition: "opacity 150ms" }}>
      <div
        className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
        style={{ width: `${width}%`, transition: width === 0 ? "none" : "width 300ms ease-out" }}
      />
    </div>
  );
}

function getAvatarColor(name: string) {
  const colors = [
    ["#7c3aed","#a855f7"], ["#1d4ed8","#3b82f6"], ["#0f766e","#14b8a6"],
    ["#b45309","#f59e0b"], ["#be123c","#f43f5e"], ["#15803d","#22c55e"],
    ["#c2410c","#f97316"], ["#0e7490","#06b6d4"],
  ];
  const i = name.charCodeAt(0) % colors.length;
  return `linear-gradient(135deg,${colors[i][0]},${colors[i][1]})`;
}

function getInitials(name: string) {
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name[0]?.toUpperCase() || "?";
}

function UserAvatar({ name = "A", imageUrl, size = 32 }: { name?: string; imageUrl?: string; size?: number }) {
  const [imgError, setImgError] = useState(false);
  const showImage = imageUrl && !imgError;
  const px = `${size}px`;
  return (
    <div className="rounded-full overflow-hidden flex-shrink-0 flex items-center justify-center relative"
      style={{ width: px, height: px, border: "2px solid rgba(255,255,255,0.12)", boxShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
      {showImage ? (
        <Image src={imageUrl!} alt={name} width={size} height={size}
          className="object-cover w-full h-full"
          onError={() => setImgError(true)} />
      ) : (
        <div className="w-full h-full flex items-center justify-center font-bold text-white select-none"
          style={{ background: getAvatarColor(name), fontSize: size <= 28 ? "10px" : size <= 36 ? "12px" : "14px", letterSpacing: "0.05em" }}>
          {getInitials(name)}
        </div>
      )}
    </div>
  );
}

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [search, setSearch]           = useState("");
  const [searchResults, setSearchResults] = useState<Record<string, any[]>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();
  const pathname = usePathname();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Search debounce
  useEffect(() => {
    clearTimeout(searchTimer.current);
    if (search.length < 2) { setSearchResults({}); setSearchOpen(false); return; }
    setSearchLoading(true);
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(search)}`);
        const data = await res.json();
        setSearchResults(data.results || {});
        setSearchOpen(true);
      } catch {}
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(searchTimer.current);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSearchSelect = useCallback(() => {
    setSearch(""); setSearchOpen(false); setSearchResults({});
  }, []);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const role = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase() as UserRole;
  const clerkName = user?.fullName || user?.firstName || "";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const [dbAvatar, setDbAvatar] = useState("");

  // ── Heartbeat: ping server with ALL open tabs so admin can see everything ──
  useEffect(() => {
    if (!isLoaded || !user) return;

    // Track all open tabs in localStorage
    const TAB_KEY = "crs_open_tabs";
    const tabId   = `${pathname}_${Date.now()}`;

    // Read existing tabs, add current page
    function getOpenTabs(): string[] {
      try {
        const stored = JSON.parse(localStorage.getItem(TAB_KEY) || "[]");
        const pages  = Array.isArray(stored) ? stored : [];
        // Add current page if not already there
        if (!pages.includes(pathname)) pages.push(pathname);
        return [...new Set(pages)];
      } catch { return [pathname]; }
    }

    function saveOpenTabs(tabs: string[]) {
      try { localStorage.setItem(TAB_KEY, JSON.stringify(tabs)); } catch {}
    }

    const currentTabs = getOpenTabs();
    saveOpenTabs(currentTabs);

    const ping = () => {
      const allTabs = getOpenTabs();
      fetch("/api/admin/active-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page:    pathname,
          allTabs,
          avatar:  user?.imageUrl || "",
        }),
      }).catch(() => {});
    };

    ping();
    const interval = setInterval(ping, 30_000); // every 30s

    // On tab close, remove this page from tabs
    const handleUnload = () => {
      try {
        const tabs = getOpenTabs().filter(t => t !== pathname);
        saveOpenTabs(tabs);
        // Send sync beacon
        navigator.sendBeacon("/api/admin/active-users",
          JSON.stringify({ page: pathname, allTabs: tabs, closedTab: pathname, avatar: user?.imageUrl || "" })
        );
      } catch {}
    };
    window.addEventListener("beforeunload", handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener("beforeunload", handleUnload);
    };
  }, [isLoaded, user, pathname]);

  useEffect(() => {
    if (!userEmail) return;
    fetch("/api/employee/profile")
      .then(r => r.ok ? r.json() : null)
      .then((emp: any) => { if (emp?.avatarUrl) setDbAvatar(emp.avatarUrl); })
      .catch(() => {});
  }, [userEmail]);

  const userName = clerkName || userEmail.split("@")[0] || "User";
  const userImage = dbAvatar || user?.imageUrl || "";
  const navItems = getNavForRole(isLoaded ? role : "BROKER");

  const handleSignOut = async () => {
    try { await signOut(); } catch { /* ignore */ }
    router.push("/sign-in");
  };

  // ── Employee 10-min auto-logout on inactivity ──
  useEffect(() => {
    if (!isLoaded || !user || role === "ADMIN") return;
    const TIMEOUT = 10 * 60 * 1000; // 10 minutes
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        toast("Session expired — logging out for security 🔒", { icon: "⚠️", duration: 3000 });
        await signOut().catch(() => {});
        router.push("/sign-in");
      }, TIMEOUT);
    };
    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [isLoaded, user, role, signOut, router]);

  const [todayRecord, setTodayRecord]   = useState<any>(null);
  const [locations, setLocations]       = useState<any[]>([]);
  const [punching, setPunching]         = useState(false);
  const [onBreak, setOnBreak]           = useState(false);
  const [breakStart, setBreakStart]     = useState(0);
  const [breakUsed, setBreakUsed]       = useState(0);
  const BREAK_LIMIT = 3600;
  const isEmployee = isLoaded && role !== "ADMIN";

  useEffect(() => {
    if (!isEmployee || !userEmail) return;
    Promise.all([
      fetch("/api/attendance/locations").then(r => r.json()).catch(() => []),
      fetch("/api/attendance/today").then(r => r.json()).catch(() => null),
    ]).then(([locs, active]) => {
      setLocations(Array.isArray(locs) ? locs : []);
      setTodayRecord(active || null);
      if (active) {
        const saved = localStorage.getItem(`break_${userEmail}`);
        if (saved) {
          try {
            const { onBreak: ob, breakStart: bs, breakUsed: bu } = JSON.parse(saved);
            setOnBreak(ob || false); setBreakStart(bs || 0); setBreakUsed(bu || 0);
          } catch {}
        }
      } else {
        localStorage.removeItem(`break_${userEmail}`);
        setBreakUsed(0); setOnBreak(false);
      }
    });
  }, [isEmployee, userEmail]);

  useEffect(() => {
    if (!userEmail || !isEmployee) return;
    localStorage.setItem(`break_${userEmail}`, JSON.stringify({ onBreak, breakStart, breakUsed }));
  }, [onBreak, breakStart, breakUsed, userEmail, isEmployee]);

  useEffect(() => {
    if (!isEmployee) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (todayRecord) { e.preventDefault(); e.returnValue = "You are still punched in! Please punch out before closing."; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isEmployee, todayRecord]);

  const handlePunch = async () => {
    if (!locations[0]) { toast.error("No office location set"); return; }
    setPunching(true);
    const isPunchedIn = !!todayRecord;
    const res = await fetch("/api/attendance/guest", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: userName, phone: userEmail, locationId: locations[0].id,
        ...(isPunchedIn ? { action: "OUT", breakSeconds: breakUsed } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error || "Failed");
    else if (!isPunchedIn) {
      toast.success("Punched in! 🎯");
      setTodayRecord(data.record);
      setBreakUsed(0); setOnBreak(false); setBreakStart(0);
      localStorage.setItem(`break_${userEmail}`, JSON.stringify({ onBreak: false, breakStart: 0, breakUsed: 0 }));
    } else {
      toast.success(`Punched out! ${data.record?.workHours?.toFixed(1) || 0}h worked 💪`);
      setTodayRecord(null); setOnBreak(false); setBreakUsed(0); setBreakStart(0);
      localStorage.removeItem(`break_${userEmail}`);
    }
    setPunching(false);
  };

  const handleBreak = () => {
    if (!onBreak) {
      const remaining = BREAK_LIMIT - breakUsed;
      if (remaining <= 0) { toast.error("Break limit reached (1 hour used)"); return; }
      setBreakStart(Date.now());
      setOnBreak(true);
      toast(`Break started ☕ (${Math.floor(remaining/60)}m remaining)`, { icon: "⏸️" });
    } else {
      const elapsed = Math.floor((Date.now() - breakStart) / 1000);
      const newUsed = breakUsed + elapsed;
      setBreakUsed(newUsed);
      setOnBreak(false);
      const remaining = Math.max(0, BREAK_LIMIT - newUsed);
      toast.success(`Break ended — ${Math.floor(elapsed/60)}m used, ${Math.floor(remaining/60)}m remaining`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#04080f" }} suppressHydrationWarning>
      {!mounted ? null : <>
      <NavProgress />

      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: sidebarOpen ? 240 : 68 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="hidden md:flex flex-col flex-shrink-0 overflow-hidden border-r"
        style={{ borderColor: "rgba(234,179,8,0.08)", background: "linear-gradient(180deg,#060c18 0%,#04080f 100%)" }}
      >
        <div className="flex items-center gap-3 px-3 py-4 border-b h-14 flex-shrink-0"
          style={{ borderColor: "rgba(234,179,8,0.08)" }}>
          <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-white flex-shrink-0"
            style={{ border: "1px solid rgba(234,179,8,0.3)" }}>
            <Image src="/logo.jpeg" alt="CRS" fill sizes="32px" className="object-contain p-0.5" />
          </div>
          <AnimatePresence>
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="overflow-hidden flex-1 min-w-0">
                <div className="font-bold text-white text-sm leading-none whitespace-nowrap">City Real Space</div>
                <div className="text-xs whitespace-nowrap mt-0.5" style={{ color: "#eab308" }}>CRM Platform</div>
              </motion.div>
            )}
          </AnimatePresence>
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="ml-auto text-muted-foreground hover:text-white transition-colors flex-shrink-0">
            <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${sidebarOpen ? "rotate-180" : ""}`} />
          </button>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto overflow-x-hidden">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} prefetch={true}>
                <motion.div whileHover={{ x: sidebarOpen ? 2 : 0 }}
                  className={`nav-item ${active ? "active" : ""} ${(item as any).highlight ? "!text-yellow-400" : ""}`}
                  title={!sidebarOpen ? item.label : undefined}>
                  <item.icon className={`w-4 h-4 flex-shrink-0 ${(item as any).highlight ? "text-yellow-400" : ""}`} />
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="whitespace-nowrap text-sm flex-1">
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                  {sidebarOpen && (item as any).badge && (
                    <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center flex-shrink-0">
                      {(item as any).badge}
                    </span>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t flex-shrink-0" style={{ borderColor: "rgba(234,179,8,0.08)" }}>
          <div className={`flex items-center gap-3 ${!sidebarOpen ? "justify-center" : ""}`}>
            <UserAvatar name={userName} imageUrl={userImage} />
            <AnimatePresence>
              {sidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="overflow-hidden flex-1">
                  <div className="text-xs font-semibold text-white truncate">{userName}</div>
                  <div className={`text-xs font-medium truncate ${
                    role === "ADMIN" ? "text-red-400" : "text-estate-400"
                  }`}>{role === "ADMIN" ? "Admin" : role.replace("_"," ")}</div>
                </motion.div>
              )}
            </AnimatePresence>
            <button onClick={handleSignOut}
              className="text-muted-foreground hover:text-red-400 transition-colors flex-shrink-0" title="Sign Out">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </motion.aside>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 z-40 md:hidden" />
            <motion.aside initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-64 z-50 md:hidden flex flex-col border-r"
              style={{ borderColor: "rgba(234,179,8,0.1)", background: "#060c18" }}>
              <div className="flex items-center justify-between px-4 py-4 border-b h-14"
                style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                <div className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-white"
                    style={{ border: "1px solid rgba(234,179,8,0.3)" }}>
                    <Image src="/logo.jpeg" alt="CRS" fill sizes="32px" className="object-contain p-0.5" />
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">City Real Space</div>
                    <div className="text-xs" style={{ color: "#eab308" }}>CRM Platform</div>
                  </div>
                </div>
                <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link key={item.href} href={item.href} prefetch={true}>
                      <div className={`nav-item ${active ? "active" : ""} ${(item as any).highlight ? "!text-yellow-400" : ""}`}>
                        <item.icon className="w-4 h-4" />
                        <span className="flex-1 text-sm">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
              <div className="p-3 border-t" style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                <div className="flex items-center gap-3">
                  <UserAvatar name={userName} imageUrl={userImage} />
                  <div className="flex-1">
                    <div className="text-xs font-semibold text-white">{userName}</div>
                    <div className={`text-xs font-medium ${
                      role === "ADMIN" ? "text-red-400" : "text-estate-400"
                    }`}>{role === "ADMIN" ? "Admin" : role.replace("_"," ")}</div>
                  </div>
                  <button onClick={handleSignOut}
                    className="text-muted-foreground hover:text-red-400 transition-colors" title="Sign Out">
                    <LogOut className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center gap-2 px-3 md:px-5 h-14 border-b flex-shrink-0"
          style={{ borderColor: "rgba(234,179,8,0.08)", background: "rgba(4,8,15,0.95)", backdropFilter: "blur(12px)" }}>
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-muted-foreground hover:text-white">
            <Menu className="w-5 h-5" />
          </button>

          <div className="md:hidden flex items-center gap-2">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-white"
              style={{ border: "1px solid rgba(234,179,8,0.3)" }}>
              <Image src="/logo.jpeg" alt="CRS" fill sizes="28px" className="object-contain p-0.5" />
            </div>
            <span className="text-sm font-bold text-white">City Real Space</span>
          </div>

          <div className="hidden md:flex flex-1 max-w-sm" ref={searchRef}>
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground z-10" />
              {searchLoading && <div className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-estate-400 border-t-transparent rounded-full animate-spin" />}
              <input value={search} onChange={e => setSearch(e.target.value)}
                onFocus={() => search.length >= 2 && setSearchOpen(true)}
                placeholder="Search leads, properties, deals..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none transition-all text-white placeholder:text-muted-foreground"
                style={{ background: "rgba(30,58,95,0.3)", border: "1px solid rgba(234,179,8,0.1)" }}
                onFocus={e => { e.target.style.borderColor = "rgba(234,179,8,0.4)"; if (search.length >= 2) setSearchOpen(true); }}
                onBlur={e  => (e.target.style.borderColor = "rgba(234,179,8,0.1)")} />

              {/* Dropdown */}
              {searchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1.5 rounded-xl border border-white/10 shadow-2xl z-[200] overflow-hidden"
                  style={{ background: "#0a1628", maxHeight: "70vh", overflowY: "auto" }}>
                  {Object.keys(searchResults).length === 0 ? (
                    <div className="px-4 py-6 text-sm text-muted-foreground text-center">No results for "{search}"</div>
                  ) : (
                    <div className="py-1">
                      {(searchResults.leads as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <Users className="w-3 h-3" /> Leads
                          </div>
                          {(searchResults.leads as any[]).map((l: any) => (
                            <Link key={l.id} href={`/leads?id=${l.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-bold text-blue-400 flex-shrink-0">{l.name[0]}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{l.name}</div>
                                <div className="text-xs text-muted-foreground">{l.phone} · {l.source}</div>
                              </div>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 flex-shrink-0">{l.status}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.properties as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <Building2 className="w-3 h-3" /> Properties
                          </div>
                          {(searchResults.properties as any[]).map((p: any) => (
                            <Link key={p.id} href={`/properties?id=${p.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-estate-500/20 flex items-center justify-center flex-shrink-0"><Home className="w-3.5 h-3.5 text-estate-400" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{p.title}</div>
                                <div className="text-xs text-muted-foreground">{p.locality} · {p.type}</div>
                              </div>
                              <span className="text-xs text-estate-400 flex-shrink-0">₹{Number(p.price).toLocaleString("en-IN")}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.deals as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <TrendingUp className="w-3 h-3" /> Deals
                          </div>
                          {(searchResults.deals as any[]).map((d: any) => (
                            <Link key={d.id} href={`/deals?id=${d.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-orange-500/20 flex items-center justify-center flex-shrink-0"><TrendingUp className="w-3.5 h-3.5 text-orange-400" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{d.title}</div>
                                <div className="text-xs text-muted-foreground">{d.lead?.name} · {d.stage}</div>
                              </div>
                              <span className="text-xs text-orange-400 flex-shrink-0">₹{Number(d.value).toLocaleString("en-IN")}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.owners as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <UserCircle className="w-3 h-3" /> Property Owners
                          </div>
                          {(searchResults.owners as any[]).map((o: any) => (
                            <Link key={o.id} href={`/owners?id=${o.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center text-xs font-bold text-purple-400 flex-shrink-0">{o.name[0]}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{o.name}</div>
                                <div className="text-xs text-muted-foreground">{o.phone}{o.company ? ` · ${o.company}` : ""}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.visits as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <CalendarDays className="w-3 h-3" /> Site Visits
                          </div>
                          {(searchResults.visits as any[]).map((v: any) => (
                            <Link key={v.id} href={`/visits?id=${v.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-pink-500/20 flex items-center justify-center flex-shrink-0"><CalendarDays className="w-3.5 h-3.5 text-pink-400" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{v.lead?.name} → {v.property?.title || "—"}</div>
                                <div className="text-xs text-muted-foreground">{new Date(v.scheduledAt).toLocaleDateString("en-IN")} · {v.status}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.employees as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <Users className="w-3 h-3" /> Employees
                          </div>
                          {(searchResults.employees as any[]).map((e: any) => (
                            <Link key={e.id} href={`/admin-employees/${e.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400 flex-shrink-0">{e.name[0]}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{e.name}</div>
                                <div className="text-xs text-muted-foreground">{e.position} · {e.role}</div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      )}
                      {(searchResults.agreements as any[])?.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider border-b border-white/5">
                            <FileText className="w-3 h-3" /> Agreements
                          </div>
                          {(searchResults.agreements as any[]).map((a: any) => (
                            <Link key={a.id} href={`/agreements?id=${a.id}`} onClick={handleSearchSelect}
                              className="flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors cursor-pointer">
                              <div className="w-7 h-7 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0"><FileText className="w-3.5 h-3.5 text-yellow-400" /></div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-white truncate">{a.title}</div>
                                <div className="text-xs text-muted-foreground">{a.client} · {a.type}</div>
                              </div>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-400 flex-shrink-0">{a.status}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 ml-auto">
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
              style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}>
              <Zap className="w-3 h-3" /> AI Active
            </div>

            {isEmployee && (
              <div className="flex items-center gap-1">
                {todayRecord && (
                  <button onClick={handleBreak}
                    className={`hidden sm:flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border transition-colors ${
                      onBreak
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse"
                        : breakUsed >= BREAK_LIMIT
                        ? "bg-white/5 text-muted-foreground border-white/10 opacity-50 cursor-not-allowed"
                        : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400 hover:border-yellow-500/30"
                    }`}
                    disabled={!onBreak && breakUsed >= BREAK_LIMIT}>
                    <Coffee className="w-3 h-3" />
                    <span className="hidden lg:inline">{onBreak ? "End Break" : `Break${breakUsed > 0 ? ` (${Math.floor((BREAK_LIMIT-breakUsed)/60)}m)` : ""}`}</span>
                  </button>
                )}
                <button onClick={handlePunch} disabled={punching}
                  className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 ${
                    todayRecord
                      ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 animate-pulse"
                  }`}>
                  {todayRecord ? <PunchOut className="w-3 h-3" /> : <LogIn className="w-3 h-3" />}
                  <span className="hidden sm:inline">{punching ? "..." : todayRecord ? "Out" : "In"}</span>
                </button>
              </div>
            )}

            <NotificationBell />
            <button onClick={() => router.push(role === "ADMIN" ? "/attendance" : "/employee")}
              className="cursor-pointer flex items-center gap-1" title={role === "ADMIN" ? "Admin Dashboard" : "My Panel"}>
              <UserAvatar name={userName} imageUrl={userImage} size={28} />
              <span className={`hidden lg:block text-xs font-semibold px-2 py-0.5 rounded-full ${
                role === "ADMIN"
                  ? "bg-red-500/15 text-red-400 border border-red-500/25"
                  : "bg-estate-500/15 text-estate-300 border border-estate-500/25"
              }`}>{role === "ADMIN" ? "Admin" : role.replace("_"," ")}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div key={pathname} style={{ animation: "pageEnter 120ms ease-out" }}>
            {children}
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="mobile-bottom-nav border-t"
          style={{ background: "rgba(4,8,15,0.97)", borderColor: "rgba(234,179,8,0.1)", backdropFilter: "blur(12px)" }}>
          <div className="w-full flex items-center justify-around px-1 py-2">
            {[
              { href: "/dashboard",   icon: Home,        label: "Home" },
              { href: "/leads",       icon: Users,       label: "Leads" },
              { href: "/properties",  icon: Building2,   label: "Props" },
              { href: "/deals",       icon: TrendingUp,  label: "Deals" },
              { href: role === "ADMIN" ? "/attendance" : "/employee", icon: UserCircle, label: role === "ADMIN" ? "Attend" : "Me" },
            ].map(item => {
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link key={item.href} href={item.href}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-0 ${
                    active ? "text-yellow-400" : "text-muted-foreground"
                  }`}>
                  <item.icon className={`w-5 h-5 flex-shrink-0 ${active ? "text-yellow-400" : ""}`} />
                  <span className="text-[10px] font-medium truncate">{item.label}</span>
                  {active && <span className="w-1 h-1 rounded-full bg-yellow-400" />}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
      </>
      }
    </div>
  );
}
