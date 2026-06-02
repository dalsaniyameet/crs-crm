import {
  LayoutDashboard, Users, Building2, GitBranch, Calendar,
  BarChart3, Megaphone, Bot, DollarSign, Settings,
  UserCheck, FileSignature, Home, UserSquare2, UsersRound, ShieldCheck,
  FileText, IndianRupee, MessageCircle, CalendarDays, ClipboardList, Phone, Navigation,
} from "lucide-react";

export type UserRole = "ADMIN" | "BROKER" | "SALES_MANAGER" | "MARKETING";

const ALL_NAV = [
  { href: "/dashboard",       label: "Dashboard",        icon: LayoutDashboard, roles: ["ADMIN","BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/employee",        label: "My Panel",          icon: Home,            roles: ["BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/employee/daily-report", label: "Daily Report",  icon: ClipboardList,   roles: ["BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/leads",           label: "Leads",             icon: Users,           roles: ["ADMIN","BROKER","SALES_MANAGER"], badge: "" },
  { href: "/properties",      label: "Properties",        icon: Building2,       roles: ["ADMIN","SALES_MANAGER","MARKETING"] },
  { href: "/deals",           label: "Deal Pipeline",     icon: GitBranch,       roles: ["ADMIN","BROKER","SALES_MANAGER"] },
  { href: "/visits",          label: "Site Visits",       icon: Calendar,        roles: ["ADMIN","BROKER","SALES_MANAGER"] },
  { href: "/calendar",        label: "Calendar",          icon: CalendarDays,    roles: ["ADMIN","BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/agreements",      label: "Agreements",        icon: FileSignature,   roles: ["ADMIN"] },
  { href: "/owners",          label: "Property Owners",   icon: UserSquare2,     roles: ["ADMIN"] },
  { href: "/commissions",     label: "Commissions",       icon: DollarSign,      roles: ["ADMIN","SALES_MANAGER"] },
  { href: "/attendance",      label: "Attendance",        icon: UserCheck,       roles: ["ADMIN"] },
  { href: "/attendance/me",   label: "My Attendance",     icon: UserCheck,       roles: ["BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/admin-employees", label: "Employees",         icon: UsersRound,      roles: ["ADMIN"] },
  { href: "/admin-employees/daily-reports",    label: "Daily Reports",    icon: ClipboardList, roles: ["ADMIN"] },
  { href: "/admin-employees/telecaller-stats", label: "Telecaller Stats",  icon: Phone,       roles: ["ADMIN"] },
  { href: "/live-location",                    label: "Live Location",    icon: Navigation,  roles: ["ADMIN"] },
  { href: "/reports",         label: "Reports",           icon: BarChart3,       roles: ["ADMIN","SALES_MANAGER"] },
  { href: "/marketing",       label: "Marketing",         icon: Megaphone,       roles: ["ADMIN","BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/team-chat",       label: "Team Chat",         icon: MessageCircle,   roles: ["ADMIN","BROKER","SALES_MANAGER","MARKETING"] },
  { href: "/ai-assistant",    label: "AI Assistant",      icon: Bot,             roles: ["ADMIN","BROKER","SALES_MANAGER","MARKETING"], highlight: true },
  { href: "/admin-users",     label: "User Management",   icon: ShieldCheck,     roles: ["ADMIN"] },
  { href: "/admin-panel",     label: "Admin Panel",       icon: LayoutDashboard, roles: ["ADMIN"] },
  { href: "/settings",        label: "Settings",          icon: Settings,        roles: ["ADMIN"] },
];

export function getNavForRole(role: UserRole) {
  return ALL_NAV.filter(item => item.roles.includes(role));
}
