import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/wallet/WalletProviders";
import { EarlyDevelopmentNotice } from "@/components/EarlyDevelopmentNotice";

/**
 * Plain-language overview:
 * This layout file is the shell that wraps every page. It sets up global fonts, metadata,
 * and wraps the UI with the wallet providers so visitors stay connected no matter which
 * page they are viewing.
 */

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

/**
 * Metadata feeds the browser and search engines with a human-readable title and description.
 * It helps people discover Fundly and understand the value proposition in a sentence or two.
 */
export const metadata: Metadata = {
  title: "Fundly | Launch Without The Fear - Rugpull-Proof Token Launcher",
  description:
    "The first Solana token launcher with mandatory vesting and automatic DEX migration. No rugpulls. No scams. Just transparent, trustless token launches.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        {/* Early development notice - shows on first visit */}
        <EarlyDevelopmentNotice />
        {/* WalletProviders keeps the Solana connection available across every route. */}
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
