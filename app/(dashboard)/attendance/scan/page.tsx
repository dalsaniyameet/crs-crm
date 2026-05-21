"use client";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { CheckCircle, XCircle, Loader2, Camera, ArrowLeft, ScanLine } from "lucide-react";
import Link from "next/link";

export default function ScanPage() {
  const [scanning, setScanning]     = useState(false);
  const [processing, setProcessing] = useState(false);
  const [result, setResult]         = useState<{
    success: boolean; message: string; type?: string; name?: string; time?: string;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);

  useEffect(() => () => { stopScanner(); }, []);

  const stopScanner = async () => {
    try {
      if (scannerRef.current?.isScanning) {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      }
    } catch {}
    setScanning(false);
  };

  const startScanner = async () => {
    setResult(null);
    setScanning(true);
    const scanner = new Html5Qrcode("qr-reader");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        async (decoded) => {
          await stopScanner();
          await processQR(decoded);
        },
        () => {}
      );
    } catch {
      setScanning(false);
      setResult({ success: false, message: "Camera access denied. Please allow camera permission in browser settings." });
    }
  };

  const processQR = async (qrData: string) => {
    setProcessing(true);
    try {
      const pos = await new Promise<GeolocationPosition | null>((resolve) =>
        navigator.geolocation.getCurrentPosition(resolve, () => resolve(null), {
          enableHighAccuracy: true, timeout: 6000,
        })
      );

      const res = await fetch("/api/attendance/scan", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qrData,
          latitude:  pos?.coords.latitude  ?? null,
          longitude: pos?.coords.longitude ?? null,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setResult({
          success: true,
          type:    data.type,
          name:    data.employeeName,
          message: data.type === "IN"
            ? `Welcome ${data.employeeName}! Punch In successful.`
            : `Goodbye ${data.employeeName}! Punch Out successful.`,
          time: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }),
        });
      } else {
        setResult({ success: false, message: data.error || "Failed to mark attendance" });
      }
    } catch {
      setResult({ success: false, message: "Network error. Please try again." });
    }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen p-4 flex flex-col max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/attendance" className="text-muted-foreground hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-white">Scan Office QR</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Point camera at the office QR code</p>
        </div>
      </div>

      {/* Instructions */}
      {!scanning && !processing && !result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4 mb-4 space-y-2">
          <p className="text-sm text-white font-medium">How to mark attendance:</p>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>Tap &quot;Open Camera&quot; below</li>
            <li>Point your camera at the QR code posted at the office entrance</li>
            <li>Attendance will be marked automatically</li>
            <li>Scan again at end of day to Punch Out</li>
          </ol>
        </motion.div>
      )}

      {/* Camera / Scanner */}
      <div className="glass-card p-4 flex-1">
        {/* QR reader container */}
        <div
          id="qr-reader"
          className={`w-full rounded-xl overflow-hidden ${scanning ? "block" : "hidden"}`}
          style={{ minHeight: scanning ? 300 : 0 }}
        />

        {!scanning && !processing && !result && (
          <button
            onClick={startScanner}
            className="w-full btn-primary flex items-center justify-center gap-3 py-5 text-base rounded-xl"
          >
            <Camera className="w-6 h-6" />
            Open Camera & Scan QR
          </button>
        )}

        {scanning && (
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-estate-300 animate-pulse">
              <ScanLine className="w-4 h-4" /> Scanning... point at QR code
            </div>
            <button
              onClick={stopScanner}
              className="w-full py-2.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium hover:bg-red-500/20 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {processing && (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 className="w-10 h-10 animate-spin text-estate-400" />
            <span className="text-sm text-muted-foreground">Marking your attendance...</span>
          </div>
        )}
      </div>

      {/* Result */}
      {result && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`mt-4 p-6 rounded-2xl border text-center ${
            result.success
              ? result.type === "IN"
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-blue-500/10 border-blue-500/30"
              : "bg-red-500/10 border-red-500/30"
          }`}
        >
          {result.success ? (
            <CheckCircle className={`w-14 h-14 mx-auto mb-3 ${result.type === "IN" ? "text-emerald-400" : "text-blue-400"}`} />
          ) : (
            <XCircle className="w-14 h-14 text-red-400 mx-auto mb-3" />
          )}

          <div className={`text-2xl font-bold mb-1 ${
            result.success
              ? result.type === "IN" ? "text-emerald-400" : "text-blue-400"
              : "text-red-400"
          }`}>
            {result.success
              ? result.type === "IN" ? "✓ Punched In" : "✓ Punched Out"
              : "Failed"}
          </div>

          <div className="text-sm text-muted-foreground mt-1">{result.message}</div>

          {result.time && (
            <div className="mt-3 text-lg font-semibold text-white">{result.time}</div>
          )}

          <button
            onClick={() => setResult(null)}
            className="mt-5 w-full py-3 rounded-xl bg-white/10 text-white text-sm font-medium hover:bg-white/20 transition-all"
          >
            {result.success ? "Done" : "Try Again"}
          </button>
        </motion.div>
      )}
    </div>
  );
}
