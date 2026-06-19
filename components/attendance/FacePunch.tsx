"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { X, CheckCircle, AlertCircle, Loader2, ScanFace } from "lucide-react";

type Props = {
  employeeName: string;
  action: "IN" | "OUT";
  onSuccess: (faceImage?: string) => void;
  onClose: () => void;
};

type Status = "loading" | "scanning" | "detected" | "success" | "error";

export default function FacePunch({ employeeName, action, onSuccess, onClose }: Props) {
  const videoRef    = useRef<HTMLVideoElement>(null);
  const canvasRef   = useRef<HTMLCanvasElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const [status, setStatus]             = useState<Status>("loading");
  const [message, setMessage]           = useState("Camera shuru ho rahi hai...");
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown]       = useState(0);
  const [retryKey, setRetryKey]         = useState(0);
  const [errorName, setErrorName]       = useState("");

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setMessage("Camera shuru ho rahi hai...");
    setFaceDetected(false);
    setErrorName("");

    async function init() {
      let stream: MediaStream;
      try {
        // Try with front camera first, fallback to any camera
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
        } catch {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        }
      } catch (camErr: any) {
        if (!cancelled) {
          setErrorName(camErr?.name || "UnknownError");
          setStatus("error");
        }
        return;
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStatus("scanning");
      setMessage("Position your face in the frame");

      try {
        const fapi = await import("face-api.js");
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        await Promise.all([
          fapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          fapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        ]);

        if (cancelled) return;

        let stableFrames = 0;
        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !canvasRef.current) return;

          const detection = await fapi
            .detectSingleFace(videoRef.current, new fapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
            .withFaceLandmarks(true);

          const canvas = canvasRef.current;
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          if (detection) {
            stableFrames++;
            setFaceDetected(true);
            const b = detection.detection.box;
            ctx.strokeStyle = "#eab308"; ctx.lineWidth = 2;
            ctx.strokeRect(b.x, b.y, b.width, b.height);
            const cs = 18;
            ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
            [[b.x, b.y, cs, 0, 0, cs],[b.x+b.width, b.y, -cs, 0, 0, cs],
             [b.x, b.y+b.height, cs, 0, 0, -cs],[b.x+b.width, b.y+b.height, -cs, 0, 0, -cs],
            ].forEach(([x,y,dx1,dy1,dx2,dy2]) => {
              ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx1,y+dy1); ctx.stroke();
              ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx2,y+dy2); ctx.stroke();
            });

            if (stableFrames >= 3) {
              clearInterval(intervalRef.current!);
              setStatus("detected");
              let capturedImage: string | undefined;
              try {
                const snap = document.createElement("canvas");
                snap.width  = videoRef.current!.videoWidth  || 640;
                snap.height = videoRef.current!.videoHeight || 480;
                const sc = snap.getContext("2d");
                if (sc && videoRef.current) {
                  sc.scale(-1, 1);
                  sc.drawImage(videoRef.current, -snap.width, 0, snap.width, snap.height);
                  capturedImage = snap.toDataURL("image/jpeg", 0.7);
                }
              } catch {}

              let c = 3; setCountdown(c);
              const t = setInterval(() => {
                c--; setCountdown(c);
                if (c <= 0) {
                  clearInterval(t); stopCamera();
                  setStatus("success");
                  setMessage(`Punch ${action === "IN" ? "In" : "Out"} successful!`);
                  setTimeout(() => onSuccess(capturedImage), 1200);
                }
              }, 1000);
            }
          } else {
            stableFrames = 0; setFaceDetected(false);
            setMessage("No face detected — look at the camera");
          }
        }, 500);
      } catch {
        if (!cancelled) { setStatus("error"); setErrorName("ModelLoadError"); }
      }
    }

    init();
    return () => { cancelled = true; stopCamera(); };
  }, [retryKey]);

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
  }

  const isBlocked   = errorName === "NotAllowedError" || errorName === "PermissionDeniedError";
  const isBusy      = errorName === "NotReadableError" || errorName === "TrackStartError" || errorName === "AbortError";
  const isNotFound  = errorName === "NotFoundError"    || errorName === "DevicesNotFoundError";

  const borderColor =
    status === "success" ? "border-emerald-500" :
    status === "error"   ? "border-red-500/60" :
    faceDetected         ? "border-emerald-500/70" : "border-yellow-500/40";

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.88)", backdropFilter: "blur(8px)" }}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden"
        style={{ background: "#0a0a0f", border: "1px solid rgba(234,179,8,0.2)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: "rgba(234,179,8,0.1)" }}>
          <div className="flex items-center gap-2">
            <ScanFace className="w-5 h-5 text-yellow-400" />
            <div>
              <div className="text-sm font-semibold text-white">Face {action === "IN" ? "Punch In" : "Punch Out"}</div>
              <div className="text-xs text-muted-foreground">{employeeName}</div>
            </div>
          </div>
          <button onClick={() => { stopCamera(); onClose(); }}
            className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4">
          {/* Camera / Error view */}
          <div className={`relative rounded-2xl overflow-hidden border-2 transition-colors duration-300 ${borderColor}`}
            style={{ aspectRatio: "4/3", background: "#000" }}>

            <video ref={videoRef} className="w-full h-full object-cover" style={{ transform: "scaleX(-1)" }} muted playsInline />
            <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ transform: "scaleX(-1)" }} width={640} height={480} />

            {(status === "scanning" || status === "detected") && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-36 h-44 rounded-full border-2 border-dashed opacity-40"
                  style={{ borderColor: faceDetected ? "#10b981" : "#eab308" }} />
              </div>
            )}

            {status === "detected" && countdown > 0 && (
              <motion.div key={countdown}
                initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-black"
                style={{ background: "#eab308" }}>
                {countdown}
              </motion.div>
            )}

            {status === "loading" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.75)" }}>
                <Loader2 className="w-8 h-8 text-yellow-400 animate-spin mb-2" />
                <p className="text-xs text-white">{message}</p>
              </div>
            )}

            {status === "success" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: "rgba(0,0,0,0.8)" }}>
                <motion.div animate={{ scale: [0.8, 1.1, 1] }} transition={{ duration: 0.4 }}>
                  <CheckCircle className="w-16 h-16 text-emerald-400 mb-2" />
                </motion.div>
                <p className="text-sm font-semibold text-white">{message}</p>
              </motion.div>
            )}

            {status === "error" && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4" style={{ background: "rgba(0,0,0,0.93)" }}>
                <AlertCircle className="w-9 h-9 text-red-400 shrink-0" />

                {isBlocked && (
                  <>
                    <p className="text-xs text-center text-white font-semibold">Camera Permission Denied</p>
                    <div className="text-xs text-center text-white/70 space-y-1">
                      <p>Android: <span className="text-white">Settings → Apps → Chrome → Permissions → Camera → Allow</span></p>
                      <p>Ya address bar mein 🔒 → Camera → Allow</p>
                    </div>
                  </>
                )}
                {isBusy && (
                  <>
                    <p className="text-xs text-center text-white font-semibold">Camera Busy</p>
                    <p className="text-xs text-center text-white/70">Doosri app band karo (WhatsApp, Zoom, etc.) phir Try Again dabao</p>
                  </>
                )}
                {isNotFound && (
                  <p className="text-xs text-center text-white font-semibold">Camera nahi mila</p>
                )}
                {!isBlocked && !isBusy && !isNotFound && (
                  <p className="text-xs text-center text-white/70">{errorName || "Camera error"}</p>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 mt-1">
                  <button onClick={() => { stopCamera(); setRetryKey(k => k + 1); }}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500 text-black text-xs font-semibold hover:bg-yellow-400 transition-colors">
                    🔄 Try Again
                  </button>
                  <button onClick={() => { stopCamera(); onClose(); }}
                    className="px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs hover:bg-white/20 transition-colors">
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>

          <p className={`mt-3 text-xs text-center font-medium ${
            status === "success" ? "text-emerald-400" :
            status === "error"   ? "text-red-400" :
            faceDetected         ? "text-emerald-400" : "text-yellow-400"
          }`}>
            {status === "scanning"  && (faceDetected ? "✅ Face detected — hold still" : "👤 " + message)}
            {status === "detected"  && `✅ Confirming in ${countdown}s...`}
            {status === "loading"   && message}
            {status === "success"   && message}
            {status === "error"     && (isBlocked ? "🔒 Permission denied" : isBusy ? "📵 Camera busy" : isNotFound ? "📷 Camera nahi mila" : "❌ " + errorName)}
          </p>

          <div className="mt-3 flex justify-center">
            <span className={`px-4 py-1.5 rounded-full text-xs font-semibold border ${
              action === "IN"
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-red-500/15 text-red-400 border-red-500/30"
            }`}>
              {action === "IN" ? "🟢 Punch In" : "🔴 Punch Out"} · {employeeName}
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
