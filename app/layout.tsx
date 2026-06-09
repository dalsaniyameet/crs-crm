import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import ToasterClient from "./toaster-client";
import SplashScreen from "./splash-screen";

export const metadata: Metadata = {
  metadataBase: new URL("https://cityrealspacecrm.com"),

  title: {
    default: "City Real Space CRM | #1 Real Estate CRM Ahmedabad",
    template: "%s | City Real Space CRM",
  },
  description:
    "Best real estate CRM software in Ahmedabad. AI lead scoring, WhatsApp automation, deal pipeline & commission tracker for property brokers. Free 14-day trial.",
  keywords: [
    "real estate CRM Ahmedabad",
    "property broker software Ahmedabad",
    "real estate software Gujarat",
    "CRM for real estate agents India",
    "AI real estate CRM",
    "WhatsApp CRM real estate",
    "lead management real estate",
    "property management software",
    "broker CRM India",
    "City Real Space",
    "real estate automation Ahmedabad",
    "commercial property CRM",
    "residential property software",
    "deal pipeline real estate",
    "commission tracker broker",
  ],
  authors: [{ name: "City Real Space", url: "https://cityrealspace.com" }],
  creator: "City Real Space",
  publisher: "City Real Space",
  category: "Real Estate Software",
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  alternates: {
    canonical: "https://cityrealspacecrm.com",
  },
  icons: {
    icon: "/logo.jpeg",
    apple: "/logo.jpeg",
    shortcut: "/logo.jpeg",
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: "https://cityrealspacecrm.com",
    siteName: "City Real Space CRM",
    title: "City Real Space CRM | #1 Real Estate CRM Ahmedabad",
    description:
      "AI-powered real estate CRM for Ahmedabad brokers. Manage leads, properties, deals & commissions — all in one place. Free 14-day trial.",
    images: [
      {
        url: "https://cityrealspacecrm.com/logo.jpeg",
        width: 1200,
        height: 630,
        alt: "City Real Space CRM — Real Estate Software Ahmedabad",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "City Real Space CRM | Real Estate Software Ahmedabad",
    description: "AI lead scoring, WhatsApp automation & deal pipeline for Ahmedabad real estate brokers.",
    images: ["https://cityrealspacecrm.com/logo.jpeg"],
  },
  verification: {
    google: "hFLmQNbgW-txvaJx_-WqilKtvgBERNbU5wAWQvkSun4",
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
          {/* JSON-LD Structured Data — Google Rich Results */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "SoftwareApplication",
                "name": "City Real Space CRM",
                "applicationCategory": "BusinessApplication",
                "operatingSystem": "Web",
                "description": "AI-powered real estate CRM for Ahmedabad brokers. Lead management, WhatsApp automation, deal pipeline, commission tracker.",
                "url": "https://cityrealspacecrm.com",
                "screenshot": "https://cityrealspacecrm.com/logo.jpeg",
                "offers": {
                  "@type": "Offer",
                  "price": "4999",
                  "priceCurrency": "INR",
                  "priceValidUntil": "2026-12-31",
                  "availability": "https://schema.org/InStock",
                  "url": "https://cityrealspacecrm.com/free-trial"
                },
                "aggregateRating": {
                  "@type": "AggregateRating",
                  "ratingValue": "4.9",
                  "reviewCount": "87",
                  "bestRating": "5"
                },
                "publisher": {
                  "@type": "Organization",
                  "name": "City Real Space",
                  "url": "https://cityrealspace.com",
                  "logo": "https://cityrealspacecrm.com/logo.jpeg",
                  "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Ahmedabad",
                    "addressRegion": "Gujarat",
                    "addressCountry": "IN"
                  },
                  "contactPoint": {
                    "@type": "ContactPoint",
                    "email": "info@cityrealspace.com",
                    "contactType": "customer support"
                  }
                }
              },
              {
                "@context": "https://schema.org",
                "@type": "Organization",
                "name": "City Real Space",
                "url": "https://cityrealspace.com",
                "logo": "https://cityrealspacecrm.com/logo.jpeg",
                "description": "Ahmedabad's leading real estate brokerage with AI-powered CRM platform for property brokers.",
                "address": {
                  "@type": "PostalAddress",
                  "addressLocality": "Ahmedabad",
                  "addressRegion": "Gujarat",
                  "postalCode": "380001",
                  "addressCountry": "IN"
                },
                "email": "info@cityrealspace.com",
                "sameAs": [
                  "https://cityrealspace.com",
                  "https://cityrealspacecrm.com"
                ]
              },
              {
                "@context": "https://schema.org",
                "@type": "FAQPage",
                "mainEntity": [
                  {
                    "@type": "Question",
                    "name": "What is City Real Space CRM?",
                    "acceptedAnswer": { "@type": "Answer", "text": "City Real Space CRM is an AI-powered real estate CRM software built for Ahmedabad property brokers. It includes lead management, WhatsApp automation, deal pipeline, commission tracking, and smart analytics." }
                  },
                  {
                    "@type": "Question",
                    "name": "Is there a free trial for City Real Space CRM?",
                    "acceptedAnswer": { "@type": "Answer", "text": "Yes, City Real Space CRM offers a 14-day free trial with full access to all features. No credit card required." }
                  },
                  {
                    "@type": "Question",
                    "name": "Which cities does City Real Space CRM support?",
                    "acceptedAnswer": { "@type": "Answer", "text": "City Real Space CRM is primarily built for Ahmedabad, Gujarat real estate brokers but works for any city in India." }
                  },
                  {
                    "@type": "Question",
                    "name": "What is the pricing of City Real Space CRM?",
                    "acceptedAnswer": { "@type": "Answer", "text": "City Real Space CRM starts at \u20b94,999/month for solo brokers. Professional plan is \u20b912,999/month. Enterprise pricing is custom." }
                  }
                ]
              }
            ]) }}
          />
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
