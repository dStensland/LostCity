import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Outfit, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/Toast";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import { safeJsonLd } from "@/lib/formats";
import { getSiteUrl } from "@/lib/site-url";
import DarkHoursTheme from "@/components/DarkHoursTheme";
import NavigationProgress from "@/components/NavigationProgress";
import SkipLink from "@/components/SkipLink";
import ClientEffects from "@/components/ClientEffects";
import ScrollReset from "@/components/ScrollReset";
import "./globals.css";

const SITE_URL = getSiteUrl();

// Primary sans-serif font - used globally
// Only load weights we actually use to reduce font file size
const outfit = Outfit({
  weight: ["400", "500", "600", "700"],
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

// Monospace font - used for badges, code, and technical elements
const jetbrainsMono = JetBrains_Mono({
  weight: ["400", "500"],
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// Display font - geometric with full descenders for Explore track headlines
const spaceGrotesk = Space_Grotesk({
  weight: ["700"],
  variable: "--font-display-alt",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Lost City - Find Your People",
  description: "Find your people. Discover the underground events, shows, and happenings in your city.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Lost City - Find Your People",
    description: "Find your people. Discover the underground.",
    url: SITE_URL,
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lost City - Find Your People",
    description: "Find your people. Discover the underground events, shows, and happenings in your city.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lost City",
    url: SITE_URL,
    logo: `${SITE_URL}/og-image.png`,
  };
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Lost City",
    url: SITE_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: `${SITE_URL}/?search={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <html lang="en" style={{ backgroundColor: "#09090B" }}>
      <head>
        <meta name="csp-nonce" content={nonce} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(organizationSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: safeJsonLd(websiteSchema) }}
        />
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://rtppvljfrkjtoxmaizea.supabase.co" />
        <link rel="preconnect" href="https://img.evbuc.com" />
        <link rel="preconnect" href="https://cdn.evbuc.com" />
        <link rel="preconnect" href="https://s1.ticketm.net" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className={`${outfit.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            {/* Skip link for keyboard users */}
            <SkipLink />
            {/* Navigation progress bar */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {/* Reset scroll on route/view changes */}
            <Suspense fallback={null}>
              <ScrollReset />
            </Suspense>
            {/* Ambient glow effect */}
            <div className="ambient-glow" aria-hidden="true" />
            {/* Visual effects (rain, cursor glow) */}
            <ClientEffects />
            <AuthProvider>
              <DarkHoursTheme />
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  );
}
