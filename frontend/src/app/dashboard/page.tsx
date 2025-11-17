import { Metadata } from "next";
import { generatePageMetadata } from "@/lib/seo-config";
import DashboardPageClient from "./DashboardPageClient";

export const metadata: Metadata = generatePageMetadata({
  title: "Dashboard",
  description: "Your Fundsly dashboard. View your portfolio, create tokens, trade, and manage your holdings.",
  path: "/dashboard",
});

export default function DashboardPage() {
  return <DashboardPageClient />;
}
