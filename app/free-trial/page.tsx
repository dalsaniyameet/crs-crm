import type { Metadata } from "next";
import FreeTrialClient from "./FreeTrialClient";

export const metadata: Metadata = {
  title: "14-Day Free Trial | City Real Space CRM",
  description: "Start your free 14-day trial of City Real Space CRM. No credit card required. Full access to AI lead scoring, WhatsApp automation & deal pipeline for Ahmedabad real estate brokers.",
  alternates: { canonical: "https://cityrealspacecrm.com/free-trial" },
  openGraph: {
    title: "14-Day Free Trial — City Real Space CRM",
    description: "Full access, no credit card. AI-powered CRM for Ahmedabad real estate brokers.",
    url: "https://cityrealspacecrm.com/free-trial",
    images: [{ url: "https://cityrealspacecrm.com/logo.jpeg", width: 1200, height: 630, alt: "City Real Space CRM Free Trial" }],
  },
};

export default function FreeTrialPage() {
  return <FreeTrialClient />;
}
