import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/wallet/WalletProviders";
import { EarlyDevelopmentNotice } from "@/components/EarlyDevelopmentNotice";

/**
 * Plain-language overview:
 * This layout file is the shell that wraps every page. It sets up global fonts, metadata,
 * and wraps the UI with the wallet providers so visitors stay connected no matter which
 * page they are viewing.
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Metadata feeds the browser and search engines with a human-readable title and description.
 * It helps people discover Fundly and understand the value proposition in a sentence or two.
 */
export const metadata: Metadata = {
  title: "Fundly | Solana Startup Incubator",
  description:
    "Fundly connects vetted startups with early investors through compliant Solana token launches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {/* Early development notice - shows on first visit */}
        <EarlyDevelopmentNotice />
        {/* WalletProviders keeps the Solana connection available across every route. */}
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
