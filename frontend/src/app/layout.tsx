import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/wallet/WalletProviders";
import { EarlyDevelopmentNotice } from "@/components/EarlyDevelopmentNotice";
import { seoConfig } from "@/lib/seo-config";

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
 * Comprehensive SEO Metadata
 * Includes OpenGraph, Twitter Cards, and structured data for optimal discoverability
 */
export const metadata: Metadata = {
  metadataBase: new URL(seoConfig.siteUrl),
  title: {
    default: seoConfig.defaultTitle,
    template: seoConfig.titleTemplate,
  },
  description: seoConfig.defaultDescription,
  keywords: seoConfig.keywords,
  authors: [{ name: seoConfig.siteName }],
  creator: seoConfig.siteName,
  publisher: seoConfig.siteName,
  
  // Application Manifest
  applicationName: seoConfig.app.name,
  
  // Icons and Favicons
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [
      { url: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },

  // OpenGraph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: seoConfig.siteUrl,
    siteName: seoConfig.siteName,
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [
      {
        url: `${seoConfig.siteUrl}${seoConfig.images.ogImage}`,
        width: 1200,
        height: 630,
        alt: seoConfig.images.ogImageAlt,
      },
    ],
  },

  // Twitter
  twitter: {
    card: "summary_large_image",
    site: seoConfig.social.twitter,
    creator: seoConfig.social.twitter,
    title: seoConfig.defaultTitle,
    description: seoConfig.defaultDescription,
    images: [`${seoConfig.siteUrl}${seoConfig.images.twitterImage}`],
  },

  // Alternate URLs
  alternates: {
    canonical: seoConfig.siteUrl,
  },

  // Robots
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Verification (add your verification codes here)
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_VERIFICATION,
    // yandex: "your-yandex-verification-code",
    // other: "your-other-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Schema.org structured data for SEO
  const schemaOrgData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${seoConfig.siteUrl}/#organization`,
        name: seoConfig.organization.name,
        url: seoConfig.siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${seoConfig.siteUrl}${seoConfig.organization.logo}`,
        },
        description: seoConfig.organization.description,
        foundingDate: seoConfig.organization.foundingDate,
        sameAs: seoConfig.organization.sameAs,
        contactPoint: {
          "@type": "ContactPoint",
          email: seoConfig.contact.email,
          contactType: "customer support",
          url: `${seoConfig.siteUrl}${seoConfig.contact.supportUrl}`,
        },
      },
      {
        "@type": "WebSite",
        "@id": `${seoConfig.siteUrl}/#website`,
        url: seoConfig.siteUrl,
        name: seoConfig.siteName,
        description: seoConfig.defaultDescription,
        publisher: {
          "@id": `${seoConfig.siteUrl}/#organization`,
        },
        inLanguage: "en-US",
      },
      {
        "@type": "WebApplication",
        "@id": `${seoConfig.siteUrl}/#webapp`,
        name: seoConfig.app.name,
        description: seoConfig.app.description,
        url: seoConfig.siteUrl,
        applicationCategory: "FinanceApplication",
        operatingSystem: "Web Browser",
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
        featureList: [
          "Rugpull-proof token launching",
          "Mandatory vesting schedules",
          "Bonding curve price discovery",
          "Automatic DEX migration",
          "On-chain transparency",
          "Smart contract security",
        ],
      },
    ],
  };

  return (
    <html lang="en">
      <head>
        {/* Schema.org structured data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrgData) }}
        />
      </head>
      <body className={`${inter.variable} ${spaceGrotesk.variable} antialiased`}>
        {/* Early development notice - shows on first visit */}
        <EarlyDevelopmentNotice />
        {/* WalletProviders keeps the Solana connection available across every route. */}
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
