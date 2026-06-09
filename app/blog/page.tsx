import type { Metadata } from "next";
import BlogClient from "./BlogClient";

export const metadata: Metadata = {
  title: "Real Estate CRM Blog | City Real Space",
  description: "Tips, guides and insights for Ahmedabad real estate brokers. Learn about AI lead scoring, WhatsApp automation, deal pipeline management and property CRM software.",
  alternates: { canonical: "https://cityrealspacecrm.com/blog" },
  openGraph: {
    title: "Real Estate CRM Blog | City Real Space",
    description: "Expert tips for Ahmedabad property brokers on CRM, automation and closing more deals.",
    url: "https://cityrealspacecrm.com/blog",
    images: [{ url: "https://cityrealspacecrm.com/logo.jpeg", width: 1200, height: 630, alt: "City Real Space CRM Blog" }],
  },
};

export default function BlogPage() {
  return <BlogClient />;
}
