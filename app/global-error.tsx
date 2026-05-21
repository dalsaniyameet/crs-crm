"use client";
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ background: "#04080f", color: "white", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "16px", fontFamily: "system-ui" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: "bold", color: "#eab308" }}>Something went wrong</h1>
        <button onClick={reset} style={{ padding: "8px 20px", background: "#eab308", color: "#000", borderRadius: "8px", fontWeight: "600", cursor: "pointer", border: "none" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
