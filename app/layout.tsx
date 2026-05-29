import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ToasterClient from "./toaster-client";
import SplashScreen from "./splash-screen";

export const metadata: Metadata = {
  title: "City Real Space CRM | Ahmedabad Real Estate",
  description: "AI-powered Real Estate CRM for City Real Space, Ahmedabad",
  icons: { icon: "/logo.jpeg", apple: "/logo.jpeg" },
  metadataBase: new URL("https://cityrealspace.com"),
  openGraph: {
    title: "City Real Space CRM",
    description: "AI-powered Real Estate CRM for Ahmedabad brokers",
    url: "https://cityrealspace.com",
    siteName: "City Real Space",
    images: [{ url: "/logo.jpeg" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider fallbackRedirectUrl="/dashboard">
      <html lang="en" suppressHydrationWarning style={{ colorScheme: "dark" }}>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/logo.jpeg" type="image/jpeg" />
          <link rel="apple-touch-icon" href="/logo.jpeg" />
        </head>
        <body className="antialiased" suppressHydrationWarning>
          {/* DevTools / inspect protection */}
          <script dangerouslySetInnerHTML={{ __html: `
(function(){
  // Disable right-click
  document.addEventListener('contextmenu', function(e){ e.preventDefault(); });
  // Block common DevTools keyboard shortcuts
  document.addEventListener('keydown', function(e){
    if(
      e.key === 'F12' ||
      (e.ctrlKey && e.shiftKey && ['I','J','C','U'].includes(e.key)) ||
      (e.ctrlKey && e.key === 'U') ||
      (e.metaKey && e.altKey && ['I','J','C'].includes(e.key))
    ){ e.preventDefault(); e.stopPropagation(); return false; }
  });
  // DevTools size-change detector
  var _dt = false;
  var _check = function(){
    var w = window.outerWidth - window.innerWidth > 160;
    var h = window.outerHeight - window.innerHeight > 160;
    if((w || h) && !_dt){
      _dt = true;
      document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#050508;color:#334155;font-family:sans-serif;font-size:14px">Access Denied</div>';
    }
    if(!w && !h){ _dt = false; }
  };
  setInterval(_check, 1000);
  // Disable view-source
  document.addEventListener('keydown', function(e){
    if(e.ctrlKey && e.key === 'u'){ e.preventDefault(); }
  });
})();
` }} />
          <SplashScreen />
          {children}
          <ToasterClient />
        </body>
      </html>
    </ClerkProvider>
  );
}
