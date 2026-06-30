"use client";
import { useEffect, useRef, useState, useCallback } from "react";
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
  const [message, setMessage]           = useState("Starting camera...");
  const [faceDetected, setFaceDetected] = useState(false);
  const [countdown, setCountdown]       = useState(0);
  const [retryKey, setRetryKey]         = useState(0);

  // Error type flags
  const [errorName, setErrorName] = useState("");
  const [errorMsg,  setErrorMsg]  = useState("");
  const isBlocked  = status === "error" && (errorName === "NotAllowedError" || errorName === "PermissionDeniedError");
  const isSiteBlocked = isBlocked && errorMsg === "SITE_BLOCKED";
  const isBusy     = status === "error" && (errorName === "NotReadableError" || errorName === "TrackStartError");
  const isNotFound = status === "error" && (errorName === "NotFoundError" || errorName === "DevicesNotFoundError");

  function stopCamera() {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  }

  const init = useCallback(async () => {
    stopCamera();
    setStatus("loading");
    setMessage("Starting camera...");
    setFaceDetected(false);
    setErrorName("");
    setErrorMsg("");

    // Check mediaDevices API availability
    if (!navigator?.mediaDevices?.getUserMedia) {
      setStatus("error");
      setErrorName("NotSupportedError");
      setErrorMsg("Camera API not available — use Chrome or Safari over HTTPS");
      setMessage("Camera not supported");
      return;
    }

    // Check Permissions API state first
    try {
      const perm = await navigator.permissions.query({ name: "camera" as PermissionName });
      if (perm.state === "denied") {
        setStatus("error");
        setErrorName("NotAllowedError");
        setErrorMsg("SITE_BLOCKED");
        setMessage("Camera blocked by browser");
        return;
      }
    } catch { /* some browsers don't support permissions API */ }

    // Request camera — bare { video: true } for max compatibility
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true });
    } catch (err: any) {
      setStatus("error");
      setErrorName(err?.name || "UnknownError");
      setErrorMsg(`${err?.message || ""} | UA: ${navigator.userAgent.slice(0,80)}`);
      setMessage(err?.name || "Camera error");
      return;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      try { await videoRef.current.play(); } catch { /* ignore */ }
    }

    setStatus("scanning");
    setMessage("Position your face in the frame");

    // Load face detection models
    try {
      const fapi = await import("face-api.js");
      const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
      await Promise.all([
        fapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        fapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
      ]);

      let stableFrames = 0;
      intervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const detection = await fapi
          .detectSingleFace(videoRef.current, new fapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 }))
          .withFaceLandmarks(true);

        const ctx = canvasRef.current.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, 640, 480);

        if (detection) {
          stableFrames++;
          setFaceDetected(true);
          const b = detection.detection.box;
          ctx.strokeStyle = "#eab308"; ctx.lineWidth = 2;
          ctx.strokeRect(b.x, b.y, b.width, b.height);
          const cs = 18;
          ctx.strokeStyle = "#facc15"; ctx.lineWidth = 3;
          [[b.x,b.y,cs,0,0,cs],[b.x+b.width,b.y,-cs,0,0,cs],[b.x,b.y+b.height,cs,0,0,-cs],[b.x+b.width,b.y+b.height,-cs,0,0,-cs]].forEach(([x,y,dx1,dy1,dx2,dy2]) => {
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx1,y+dy1); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x,y); ctx.lineTo(x+dx2,y+dy2); ctx.stroke();
          });

          if (stableFrames >= 3) {
            clearInterval(intervalRef.current!);
            setStatus("detected");
            let capturedImage: string | undefined;
            try {
              const snap = document.createElement("canvas");
              snap.width = videoRef.current!.videoWidth || 640;
              snap.height = videoRef.current!.videoHeight || 480;
              const sc = snap.getContext("2d");
              if (sc && videoRef.current) {
                sc.scale(-1,1); sc.drawImage(videoRef.current, -snap.width, 0, snap.width, snap.height);
                capturedImage = snap.toDataURL("image/jpeg", 0.7);
              }
            } catch { /* ignore */ }

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
          stableFrames = 0;
          setFaceDetected(false);
          setMessage("No face detected — look at the camera");
        }
      }, 500);

    } catch {
      setStatus("error");
      setErrorName("ModelError");
      setErrorMsg("Face detection failed to load");
      setMessage("Face detection failed. Check internet.");
    }
  }, [retryKey]);

  useEffect(() => {
    init();
    return () => stopCamera();
  }, [init]);

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
              <motion.div key={countdown} initial={{ scale: 1.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="absolute top-3 right-3 w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold text-black"
                style={{ background: "#eab308" }}>{countdown}</motion.div>
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
                  <div className="space-y-2 text-center w-full">
                    {isSiteBlocked ? (
                      <>
                        <p className="text-sm text-white font-bold">Camera Blocked 🚫</p>
                        <p className="text-xs text-yellow-300">Chrome ne is site ka camera block kar rakha hai. Niche steps follow karo:</p>
                        <div className="text-left bg-white/5 rounded-xl p-3 space-y-2.5 text-xs text-white/90">
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400 font-bold shrink-0">1.</span>
                            <span>Yeh popup <span className="text-yellow-400 font-semibold">band karo</span> (Close button)</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400 font-bold shrink-0">2.</span>
                            <span>Address bar mein <span className="text-yellow-400 font-semibold">🔒 lock icon</span> tap karo</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400 font-bold shrink-0">3.</span>
                            <span><span className="text-yellow-400 font-semibold">Permissions</span> tap karo</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400 font-bold shrink-0">4.</span>
                            <span><span className="text-yellow-400 font-semibold">Camera → Allow</span> select karo</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span className="text-yellow-400 font-bold shrink-0">5.</span>
                            <span>Page <span className="text-yellow-400 font-semibold">reload</span> karo phir dobara try karo</span>
                          </div>
                        </div>
                        <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2 text-[11px] text-blue-300">
                          ⚠️ Agar Camera option nahi dikh raha: <strong>Reset permissions</strong> karo — Site Settings → Clear & Reset
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-white font-semibold">Camera Permission Denied</p>
                        <div className="text-[11px] text-white/80 space-y-1 text-left bg-white/5 rounded-lg p-3">
                          <p className="font-semibold text-yellow-400 mb-1">📋 How to allow camera:</p>
                          <p>📱 <span className="font-medium">Android Chrome:</span></p>
                          <p className="ml-3">Settings → Apps → Chrome → Permissions → Camera → Allow</p>
                          <p>🍎 <span className="font-medium">iPhone Safari:</span></p>
                          <p className="ml-3">Settings → Safari → Camera → Allow</p>
                          <p>💻 <span className="font-medium">Desktop:</span></p>
                          <p className="ml-3">Click 🔒 in address bar → Camera → Allow</p>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {isBusy && (
                  <div className="text-center space-y-1">
                    <p className="text-xs text-white font-semibold">Camera is busy</p>
                    <p className="text-xs text-white/70">Close other apps using camera (WhatsApp, Zoom, etc.) then try again</p>
                  </div>
                )}

                {isNotFound && (
                  <p className="text-xs text-center text-white font-semibold">No camera found. Connect a camera and try again.</p>
                )}

                {!isBlocked && !isBusy && !isNotFound && (
                  <p className="text-xs text-center text-white/70">{errorName}: {errorMsg || "Camera error"}</p>
                )}

                <div className="flex gap-2 mt-1 flex-wrap justify-center">
                  <button onClick={() => setRetryKey(k => k + 1)}
                    className="px-3 py-1.5 rounded-lg bg-yellow-500 text-black text-xs font-semibold hover:bg-yellow-400 transition-colors">
                    🔄 Try Again
                  </button>
                  {isBlocked && (
                    <a
                      href="javascript:void(0)"
                      onClick={() => {
                        // Works on Chrome desktop — opens site settings
                        window.open(`chrome://settings/content/siteDetails?site=${encodeURIComponent(window.location.origin)}`);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 border border-blue-500/30 text-blue-300 text-xs font-semibold hover:bg-blue-500/30 transition-colors">
                      ⚙️ Open Settings
                    </a>
                  )}
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
            {status === "scanning" && (faceDetected ? "✅ Face detected — hold still" : "👤 " + message)}
            {status === "detected" && `✅ Confirming in ${countdown}s...`}
            {status === "loading" && message}
            {status === "success" && message}
            {status === "error" && "Camera error — see instructions above"}
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
