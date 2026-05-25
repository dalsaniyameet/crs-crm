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
    <ClerkProvider>
      <html lang="en" suppressHydrationWarning style={{ colorScheme: "dark" }}>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <link rel="icon" href="/logo.jpeg" type="image/jpeg" />
          <link rel="apple-touch-icon" href="/logo.jpeg" />
        </head>
        <body className="antialiased" suppressHydrationWarning>
          <SplashScreen />
          {children}
          <ToasterClient />
        </body>
      </html>
    </ClerkProvider>
  );
}
