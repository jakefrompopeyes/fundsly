/**
 * SEO Configuration for Fundsly
 * Centralized location for all SEO-related metadata and settings
 * 
 * To customize: Update the values below with your production information
 */

export const seoConfig = {
  // Site Information
  siteName: "Fundsly",
  siteUrl: process.env.NEXT_PUBLIC_BASE_URL || "https://fundsly.app",
  
  // Default Metadata
  defaultTitle: "Fundsly | Launch Without The Fear - Rugpull-Proof Token Launcher",
  titleTemplate: "%s | Fundsly", // %s will be replaced with page title
  defaultDescription: "The first Solana token launcher with mandatory vesting and automatic DEX migration. No rugpulls. No scams. Just transparent, trustless token launches.",
  
  // Keywords
  keywords: [
    "Solana token launcher",
    "rugpull proof",
    "crypto vesting",
    "bonding curve",
    "DEX migration",
    "Raydium integration",
    "token creation",
    "DeFi platform",
    "Solana DeFi",
    "trustless token launch",
    "anti-scam crypto",
    "smart contract vesting",
    "Initital Coin Offering",
  ],

  // Social Media Links (Update these with your actual handles)
  social: {
    twitter: "https://x.com/FundslyApp", // Update with your Twitter/X handle
    discord: "https://discord.gg/fundsly", // Update with your Discord invite
  },

  // Contact Information
  contact: {
    email: "support@fundsly.app", // Update with your support email
    supportUrl: "/dashboard/support",
  },

  // OpenGraph Images
  images: {
    ogImage: "/og-image.png", // Main OpenGraph image (1200x630px recommended)
    ogImageAlt: "Fundsly - Rugpull-Proof Token Launcher on Solana",
    twitterImage: "/twitter-image.png", // Twitter card image (1200x600px recommended)
  },

  // Analytics & Tracking (Optional - add your IDs here)
  analytics: {
    googleAnalyticsId: process.env.NEXT_PUBLIC_GA_ID || "", // e.g., "G-XXXXXXXXXX"
    googleSearchConsole: process.env.NEXT_PUBLIC_GSC_ID || "", // Google Search Console verification
  },

  // Application Information
  app: {
    name: "Fundsly",
    shortName: "Fundsly",
    description: "Launch tokens without fear of rugpulls",
    themeColor: "#a855f7", // Purple from your brand
    backgroundColor: "#0f172a", // Slate-950 from your design
  },

  // Blockchain/Crypto Specific
  blockchain: {
    network: "Solana",
    networkType: process.env.NEXT_PUBLIC_NETWORK || "devnet", // devnet or mainnet-beta
    programId: "BVvQ8Y8PfWqcVLqrGz3vXYNQi3gTZ2KxuHAWiNVSDt4e", // Your program ID
  },

  // Organization Schema.org Data
  organization: {
    name: "Fundsly",
    legalName: "Fundsly",
    foundingDate: "2024",
    description: "A rugpull-proof token launcher on Solana with mandatory vesting and automatic DEX migration",
    logo: "/fundsly-logo.svg",
    sameAs: [
      "https://twitter.com/fundsly_app", // Update with actual URLs
      "https://github.com/fundsly",
      "https://discord.gg/fundsly",
    ],
  },
};

/**
 * Helper function to generate page-specific metadata
 */
export function generatePageMetadata({
  title,
  description,
  path = "",
  image,
  noIndex = false,
}: {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  noIndex?: boolean;
}) {
  const fullTitle = title 
    ? `${title} | ${seoConfig.siteName}`
    : seoConfig.defaultTitle;
  
  const fullDescription = description || seoConfig.defaultDescription;
  const fullUrl = `${seoConfig.siteUrl}${path}`;
  const ogImage = image || `${seoConfig.siteUrl}${seoConfig.images.ogImage}`;

  return {
    title: fullTitle,
    description: fullDescription,
    keywords: seoConfig.keywords.join(", "),
    
    ...(noIndex && {
      robots: {
        index: false,
        follow: false,
      },
    }),

    alternates: {
      canonical: fullUrl,
    },

    openGraph: {
      type: "website",
      locale: "en_US",
      url: fullUrl,
      siteName: seoConfig.siteName,
      title: fullTitle,
      description: fullDescription,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: seoConfig.images.ogImageAlt,
        },
      ],
    },

    twitter: {
      card: "summary_large_image",
      site: seoConfig.social.twitter,
      creator: seoConfig.social.twitter,
      title: fullTitle,
      description: fullDescription,
      images: [ogImage],
    },
  };
}

