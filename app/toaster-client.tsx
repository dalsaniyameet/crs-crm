"use client";
import dynamic from "next/dynamic";

const Toaster = dynamic(
  () => import("react-hot-toast").then((m) => m.Toaster),
  { ssr: false }
);

export default function ToasterClient() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: { background: "#1e293b", color: "#f1f5f9", border: "1px solid #334155" },
        success: { iconTheme: { primary: "#10b981", secondary: "#fff" } },
        error:   { iconTheme: { primary: "#ef4444", secondary: "#fff" } },
      }}
    />
  );
}
