"use client";
import { useEffect } from "react";

export default function SplashScreen() {
  useEffect(() => {
    const s = document.createElement("div");
    s.id = "crs-splash";

    const style = document.createElement("style");
    style.textContent = `
      #crs-splash{position:fixed;inset:0;z-index:9999999;background:linear-gradient(160deg,#04080f 0%,#0b1a2e 55%,#04080f 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;transition:opacity 0.55s ease;overflow:hidden;cursor:pointer;}
      #crs-splash-glow{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:520px;height:520px;background:radial-gradient(circle,rgba(234,179,8,0.13) 0%,transparent 70%);border-radius:50%;animation:crsGlowPulse 2s ease-in-out infinite alternate;}
      #crs-splash-ring{position:absolute;width:320px;height:320px;border-radius:50%;border:1px solid rgba(234,179,8,0.12);animation:crsRingSpin 8s linear infinite;}
      #crs-splash-ring2{position:absolute;width:420px;height:420px;border-radius:50%;border:1px dashed rgba(234,179,8,0.07);animation:crsRingSpin 14s linear infinite reverse;}
      #crs-splash-logo{width:min(200px,52vw);height:min(200px,52vw);border-radius:50%;object-fit:cover;position:relative;z-index:2;animation:crsLogoIn 0.9s cubic-bezier(0.175,0.885,0.32,1.275) forwards;box-shadow:0 0 0 4px rgba(234,179,8,0.25),0 0 60px rgba(234,179,8,0.2),0 20px 60px rgba(0,0,0,0.6);}
      #crs-splash-name{margin-top:28px;font-family:system-ui,sans-serif;font-size:clamp(18px,4vw,26px);font-weight:800;letter-spacing:0.04em;background:linear-gradient(135deg,#eab308,#facc15,#fde68a,#eab308);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:crsShimmer 2.5s linear infinite;position:relative;z-index:2;}
      #crs-splash-sub{margin-top:8px;font-family:system-ui,sans-serif;font-size:clamp(11px,2.5vw,13px);color:rgba(148,163,184,0.8);letter-spacing:0.12em;text-transform:uppercase;position:relative;z-index:2;animation:crsFadeUp 0.7s ease 0.6s both;}
      #crs-splash-bar-wrap{position:fixed;bottom:0;left:0;right:0;height:3px;background:rgba(255,255,255,0.05);}
      #crs-splash-bar{height:100%;width:0;background:linear-gradient(90deg,#eab308,#facc15);animation:crsBar 2s ease 0.3s forwards;}
      @keyframes crsLogoIn{0%{transform:scale(0.2) rotate(-15deg);opacity:0;}65%{transform:scale(1.08) rotate(3deg);opacity:1;}100%{transform:scale(1) rotate(0deg);opacity:1;}}
      @keyframes crsGlowPulse{0%{opacity:0.6;transform:translate(-50%,-50%) scale(1);}100%{opacity:1;transform:translate(-50%,-50%) scale(1.2);}}
      @keyframes crsRingSpin{to{transform:rotate(360deg);}}
      @keyframes crsShimmer{to{background-position:200% center;}}
      @keyframes crsFadeUp{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
      @keyframes crsBar{to{width:100%;}}
    `;

    s.appendChild(style);
    s.innerHTML += `
      <div id="crs-splash-glow"></div>
      <div id="crs-splash-ring"></div>
      <div id="crs-splash-ring2"></div>
      <img id="crs-splash-logo" src="/logo.jpeg" alt="City Real Space" />
      <div id="crs-splash-name">City Real Space</div>
      <div id="crs-splash-sub">Ahmedabad &nbsp;·&nbsp; Real Estate CRM</div>
      <div id="crs-splash-bar-wrap"><div id="crs-splash-bar"></div></div>
    `;

    document.body.appendChild(s);

    function dismiss() {
      if (!s.parentNode) return;
      s.style.opacity = "0";
      setTimeout(() => { if (s.parentNode) s.remove(); }, 560);
    }

    const t = setTimeout(dismiss, 2600);
    s.addEventListener("click", () => { clearTimeout(t); dismiss(); });
    document.addEventListener("focusin", function onF(e: Event) {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") {
        clearTimeout(t); dismiss();
        document.removeEventListener("focusin", onF);
      }
    });

    return () => { clearTimeout(t); if (s.parentNode) s.remove(); };
  }, []);

  return null;
}
