import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Free Trial | City Real Space CRM — Real Estate Software Ahmedabad",
  description:
    "Start your 14-day free trial of City Real Space CRM. No credit card required. Full access to AI lead scoring, WhatsApp automation & deal pipeline for Ahmedabad real estate brokers.",
  alternates: { canonical: "https://cityrealspacecrm.com/free-trial" },
  openGraph: {
    title: "Free Trial — City Real Space CRM",
    description: "14-day free trial. No credit card. Full CRM access for Ahmedabad real estate brokers.",
    url: "https://cityrealspacecrm.com/free-trial",
  },
};

export default function FreeTrialLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
