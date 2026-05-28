"use client";
import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  Menu, X, ChevronRight, Zap, Search, LogOut, LogIn,
  LogOut as PunchOut, Coffee,
  LayoutDashboard, Users, Building2, GitBranch, Bot, MoreHorizontal,
} from "lucide-react";
import NotificationBell from "@/components/ui/notification-bell";
import { getNavForRole, UserRole } from "@/lib/roles";
import { useUser, useClerk } from "@clerk/nextjs";
import toast from "react-hot-toast";

// Mobile bottom nav — 5 most used items
const MOBILE_NAV = [
  { href: "/dashboard",   label: "Home",       icon: LayoutDashboard },
  { href: "/leads",       label: "Leads",      icon: Users },
  { href: "/properties",  label: "Properties", icon: Building2 },
  { href: "/deals",       label: "Deals",      icon: GitBranch },
  { href: "/ai-assistant",label: "AI",         icon: Bot },
];

function NavProgress() {
  const pathname = usePathname();
  const [width, setWidth] = useState(0);
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    setOpacity(1); setWidth(0);
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
      <div className="h-full bg-gradient-to-r from-yellow-400 to-yellow-500"
        style={{ width: `${width}%`, transition: width === 0 ? "none" : "width 300ms ease-out" }} />
    </div>
  );
}

function UserAvatar({ name = "A", imageUrl }: { name?: string; imageUrl?: string }) {
  if (imageUrl) return (
    <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 border border-white/10">
      <Image src={imageUrl} alt={name} width={32} height={32} className="object-cover w-full h-full" />
    </div>
  );
  return (
    <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
      style={{ background: "linear-gradient(135deg,#ca8a04,#eab308)" }}>
      {name[0].toUpperCase()}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileOpen, setMobileOpen]   = useState(false);
  const [search, setSearch]           = useState("");
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();

  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const role      = ((user?.publicMetadata?.role as string) || "BROKER").toUpperCase() as UserRole;
  const clerkName = user?.fullName || user?.firstName || "";
  const userEmail = user?.primaryEmailAddress?.emailAddress || "";
  const [dbAvatar, setDbAvatar] = useState("");

  useEffect(() => {
    if (!userEmail) return;
    fetch("/api/employee/profile")
      .then(r => r.ok ? r.json() : null)
      .then((emp: any) => { if (emp?.avatarUrl) setDbAvatar(emp.avatarUrl); })
      .catch(() => {});
  }, [userEmail]);

  const userName  = clerkName || userEmail.split("@")[0] || "User";
  const userImage = dbAvatar || user?.imageUrl || "";
  const navItems  = getNavForRole(isLoaded ? role : "BROKER");

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
    router.push("/sign-in");
  };

  // Punch state
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [locations, setLocations]     = useState<any[]>([]);
  const [punching, setPunching]       = useState(false);
  const [onBreak, setOnBreak]         = useState(false);
  const [breakStart, setBreakStart]   = useState(0);
  const [breakUsed, setBreakUsed]     = useState(0);
  const BREAK_LIMIT = 3600;
  const isEmployee  = isLoaded && role !== "ADMIN";

  // ── SECURITY: Office hours + auto-logout for employees ──────────────────
  useEffect(() => {
    if (!isLoaded || !isEmployee) return;

    function getISTHour() {
      const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      return ist.getUTCHours() * 60 + ist.getUTCMinutes(); // minutes since midnight IST
    }

    function isOfficeHours() {
      const now = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
      const day = now.getUTCDay(); // 0=Sun
      const cur = now.getUTCHours() * 60 + now.getUTCMinutes();
      if (day === 0) return false; // Sunday — no access
      // Mon-Sat: 9:30 AM to 7:30 PM IST
      return cur >= 9 * 60 + 30 && cur <= 19 * 60 + 30;
    }

    // Check immediately
    if (!isOfficeHours()) {
      signOut().then(() => router.push("/sign-in?reason=outside-hours")).catch(() => {});
      return;
    }

    // Check every minute
    const interval = setInterval(() => {
      if (!isOfficeHours()) {
        toast.error("Office hours over. You have been logged out.", { duration: 5000 });
        setTimeout(() => {
          signOut().then(() => router.push("/sign-in?reason=outside-hours")).catch(() => {});
        }, 2000);
        clearInterval(interval);
      }
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [isLoaded, isEmployee, signOut, router]);

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
      if (todayRecord) { e.preventDefault(); e.returnValue = "You are still punched in!"; }
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
        ...(isPunchedIn ? { action: "OUT" } : {}),
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
      setBreakStart(Date.now()); setOnBreak(true);
      toast(`Break started ☕ (${Math.floor(remaining/60)}m remaining)`, { icon: "☕" });
    } else {
      const elapsed = Math.floor((Date.now() - breakStart) / 1000);
      const newUsed = breakUsed + elapsed;
      setBreakUsed(newUsed); setOnBreak(false);
      const remaining = Math.max(0, BREAK_LIMIT - newUsed);
      toast.success(`Break ended · ${Math.floor(elapsed/60)}m used, ${Math.floor(remaining/60)}m remaining`);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#04080f" }} suppressHydrationWarning>
      {!mounted ? null : <>
      <NavProgress />

      {/* ── Desktop Sidebar ── */}
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
                  <div className={`text-xs font-medium truncate ${role === "ADMIN" ? "text-red-400" : "text-estate-400"}`}>
                    {role === "ADMIN" ? "Admin" : role.replace("_"," ")}
                  </div>
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

      {/* ── Mobile Full Drawer (More menu) ── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-black/70 z-40 md:hidden" />
            <motion.aside
              initial={{ x: "-100%" }} animate={{ x: 0 }} exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed left-0 top-0 bottom-0 w-72 z-50 md:hidden flex flex-col border-r"
              style={{ borderColor: "rgba(234,179,8,0.1)", background: "#060c18" }}>

              {/* Header */}
              <div className="flex items-center justify-between px-4 py-4 border-b"
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
                <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-white p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User info */}
              <div className="px-4 py-3 border-b flex items-center gap-3"
                style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                <UserAvatar name={userName} imageUrl={userImage} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{userName}</div>
                  <div className={`text-xs font-medium ${role === "ADMIN" ? "text-red-400" : "text-estate-400"}`}>
                    {role === "ADMIN" ? "Admin" : role.replace("_"," ")}
                  </div>
                </div>
                <button onClick={handleSignOut} className="text-muted-foreground hover:text-red-400 transition-colors p-1">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>

              {/* Punch in/out for mobile */}
              {isEmployee && (
                <div className="px-4 py-3 border-b flex items-center gap-2"
                  style={{ borderColor: "rgba(234,179,8,0.08)" }}>
                  {todayRecord ? (
                    <>
                      <span className="text-xs text-emerald-400 flex-1">
                        ● In since {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                      </span>
                      <button onClick={handleBreak} disabled={!onBreak && breakUsed >= BREAK_LIMIT}
                        className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                          onBreak ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" : "bg-white/5 text-muted-foreground border-white/10"
                        }`}>
                        <Coffee className="w-3 h-3 inline mr-1" />{onBreak ? "End Break" : "Break"}
                      </button>
                      <button onClick={handlePunch} disabled={punching}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 border border-red-500/30">
                        <PunchOut className="w-3 h-3 inline mr-1" />Out
                      </button>
                    </>
                  ) : (
                    <button onClick={handlePunch} disabled={punching}
                      className="w-full text-xs py-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">
                      <LogIn className="w-3 h-3 inline mr-1" />Punch In
                    </button>
                  )}
                </div>
              )}

              {/* Nav items */}
              <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(item.href + "/");
                  return (
                    <Link key={item.href} href={item.href} prefetch={true}>
                      <div className={`nav-item ${active ? "active" : ""} ${(item as any).highlight ? "!text-yellow-400" : ""}`}>
                        <item.icon className={`w-4 h-4 ${(item as any).highlight ? "text-yellow-400" : ""}`} />
                        <span className="flex-1 text-sm">{item.label}</span>
                      </div>
                    </Link>
                  );
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 max-w-full">

        {/* Topbar */}
        <header className="flex items-center gap-2 px-3 md:px-5 h-14 border-b flex-shrink-0 overflow-x-auto"
          style={{ borderColor: "rgba(234,179,8,0.08)", background: "rgba(4,8,15,0.95)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}>

          {/* Mobile: Hamburger + Logo only */}
          <div className="flex md:hidden items-center gap-2 flex-shrink-0">
            <button onClick={() => setMobileOpen(true)} className="text-slate-400 hover:text-white transition-colors p-1 active:scale-95">
              <Menu className="w-5 h-5" />
            </button>
            <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-white flex-shrink-0"
              style={{ border: "1px solid rgba(234,179,8,0.3)" }}>
              <Image src="/logo.jpeg" alt="CRS" fill sizes="28px" className="object-contain p-0.5" />
            </div>
            <span className="text-xs font-bold text-white truncate">CRS</span>
          </div>

          {/* Desktop: Search */}
          <div className="hidden md:flex flex-1 max-w-sm">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search leads, properties, deals..."
                className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none transition-all text-white placeholder:text-muted-foreground"
                style={{ background: "rgba(30,58,95,0.3)", border: "1px solid rgba(234,179,8,0.1)" }}
                onFocus={e => (e.target.style.borderColor = "rgba(234,179,8,0.4)")}
                onBlur={e  => (e.target.style.borderColor = "rgba(234,179,8,0.1)")} />
            </div>
          </div>

          <div className="flex items-center gap-1 md:gap-2 ml-auto flex-shrink-0">
            {/* AI Badge */}
            {role === "ADMIN" && (
              <div className="hidden sm:flex items-center gap-1 px-2 md:px-2.5 py-1 rounded-full text-xs font-semibold flex-shrink-0"
                style={{ background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)", color: "#facc15" }}>
                <Zap className="w-3 h-3" /> <span className="hidden md:inline">AI Active</span>
              </div>
            )}

            {/* Punch in time desktop */}
            {isEmployee && todayRecord && (
              <div className="hidden sm:flex flex-col items-end mr-1 text-xs">
                <span className="font-semibold text-emerald-400">
                  ● {new Date(todayRecord.punchIn).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
                <span className="text-muted-foreground hidden lg:block text-[10px]">Punched In</span>
              </div>
            )}

            {/* Desktop punch buttons */}
            {isEmployee && (
              <div className="hidden sm:flex items-center gap-1">
                {todayRecord && (
                  <button onClick={handleBreak} disabled={!onBreak && breakUsed >= BREAK_LIMIT}
                    className={`flex items-center gap-1 text-xs px-2 md:px-2.5 py-1.5 rounded-lg border transition-colors flex-shrink-0 ${
                      onBreak
                        ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse"
                        : breakUsed >= BREAK_LIMIT
                        ? "bg-white/5 text-muted-foreground border-white/10 opacity-50 cursor-not-allowed"
                        : "bg-white/5 text-muted-foreground border-white/10 hover:text-yellow-400 hover:border-yellow-500/30"
                    }`}>
                    <Coffee className="w-3 h-3" />
                    <span className="hidden md:inline">{onBreak ? "End Break" : "Break"}</span>
                  </button>
                )}
                <button onClick={handlePunch} disabled={punching}
                  className={`flex items-center gap-1 text-xs px-2 md:px-3 py-1.5 rounded-lg border font-medium transition-colors disabled:opacity-50 flex-shrink-0 ${
                    todayRecord
                      ? "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30"
                      : "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/30 animate-pulse"
                  }`}>
                  {todayRecord ? <PunchOut className="w-3 h-3" /> : <LogIn className="w-3 h-3" />}
                  <span className="hidden md:inline">{punching ? "..." : todayRecord ? "Punch Out" : "Punch In"}</span>
                </button>
              </div>
            )}

            <NotificationBell />

            <button onClick={() => router.push(role === "ADMIN" ? "/attendance" : "/employee")}
              className="cursor-pointer flex items-center gap-1.5 flex-shrink-0 active:scale-95 transition-transform" title={role === "ADMIN" ? "Admin Dashboard" : "My Panel"}>
              <UserAvatar name={userName} imageUrl={userImage} />
              <span className={`hidden md:block text-xs font-semibold px-2 py-0.5 rounded-full ${
                role === "ADMIN"
                  ? "bg-red-500/15 text-red-400 border border-red-500/25"
                  : "bg-estate-500/15 text-estate-300 border border-estate-500/25"
              }`}>{role === "ADMIN" ? "Admin" : role.replace("_"," ")}</span>
            </button>
          </div>
        </header>

        {/* Page content — stops at bottom nav on mobile */}
        <main
          className="flex-1 overflow-y-auto overflow-x-hidden scroll-smooth"
          style={{ paddingBottom: "calc(64px + env(safe-area-inset-bottom, 8px))" }}
        >
          <div>
            {children}
          </div>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation Bar ── */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-[60] flex items-stretch border-t"
        style={{
          background: "rgba(4,8,15,0.99)",
          borderColor: "rgba(234,179,8,0.15)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          height: "calc(56px + env(safe-area-inset-bottom, 0px))",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          boxShadow: "0 -1px 0 rgba(234,179,8,0.08), 0 -8px 24px rgba(0,0,0,0.5)",
        }}
      >
        {MOBILE_NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={true}
              className={`flex flex-col items-center justify-center gap-0.5 flex-1 transition-all active:scale-90 touch-manipulation ${
                active ? "text-yellow-400" : "text-slate-500"
              }`}
              style={{ minHeight: "56px", WebkitTapHighlightColor: "transparent" }}
            >
              <div className={`relative flex items-center justify-center w-10 h-7 rounded-xl transition-all ${
                active ? "bg-yellow-400/15" : ""
              }`}>
                <Icon className={`w-5 h-5 flex-shrink-0 transition-transform ${
                  active ? "scale-110" : ""
                }`} />
              </div>
              <span className="text-[10px] font-semibold leading-none tracking-wide">{item.label}</span>
            </Link>
          );
        })}
        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center gap-0.5 flex-1 text-slate-500 active:scale-90 transition-all touch-manipulation"
          style={{ minHeight: "56px", WebkitTapHighlightColor: "transparent" }}
        >
          <div className="flex items-center justify-center w-10 h-7 rounded-xl">
            <MoreHorizontal className="w-5 h-5 flex-shrink-0" />
          </div>
          <span className="text-[10px] font-semibold leading-none tracking-wide">More</span>
        </button>
      </nav>

      </>}
    </div>
  );
}
