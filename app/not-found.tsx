"use client";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 text-white" style={{ background: "#04080f" }}>
      <h1 className="text-6xl font-bold text-yellow-400">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
    </div>
  );
}
