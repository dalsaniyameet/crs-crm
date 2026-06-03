"use client";
import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

type UserRow = {
  id: string;
  clerkId: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

const ROLES = ["ADMIN", "BROKER", "SALES_MANAGER", "MARKETING"];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:         "bg-red-500/20 text-red-400 border-red-500/30",
  BROKER:        "bg-blue-500/20 text-blue-400 border-blue-500/30",
  SALES_MANAGER: "bg-green-500/20 text-green-400 border-green-500/30",
  MARKETING:     "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

export default function AdminUsersPage() {
  const { user } = useUser();
  const router   = useRouter();
  const [users, setUsers]       = useState<UserRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const myRole = (user?.publicMetadata?.role as string | undefined)?.toUpperCase() || "ADMIN"; // middleware already guards this page

  useEffect(() => {
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => { setUsers(Array.isArray(d) ? d : []); setLoading(false); })
      .catch(() => { setUsers([]); setLoading(false); });
  }, []);

  async function changeRole(clerkId: string, role: string) {
    setUpdating(clerkId);
    const res = await fetch("/api/admin/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clerkId, role }),
    });
    if (res.ok) {
      setUsers((prev) => prev.map((u) => u.clerkId === clerkId ? { ...u, role } : u));
      toast.success("Role updated");
    } else {
      toast.error("Failed to update role");
    }
    setUpdating(null);
  }

  if (loading) return <div className="p-8 text-muted-foreground">Loading...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">User Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Assign roles to team members</p>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10 bg-white/5">
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Name</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Email</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Current Role</th>
              <th className="text-left px-4 py-3 text-muted-foreground font-medium">Change Role</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td className="px-4 py-3 text-white font-medium">{u.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs border ${ROLE_COLORS[u.role] ?? "bg-white/10 text-white"}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={u.role}
                    disabled={updating === u.clerkId}
                    onChange={(e) => changeRole(u.clerkId, e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-estate-500/50 disabled:opacity-50"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} className="bg-[#0f1f35]">{r}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
