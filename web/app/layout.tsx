import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { Outfit, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/Toast";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import DarkHoursTheme from "@/components/DarkHoursTheme";
import NavigationProgress from "@/components/NavigationProgress";
import SkipLink from "@/components/SkipLink";
import ClientEffects from "@/components/ClientEffects";
import ScrollReset from "@/components/ScrollReset";
import "./globals.css";

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

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai"),
  title: "Lost City - Find Your People",
  description: "Find your people. Discover the underground events, shows, and happenings in your city.",
  openGraph: {
    title: "Lost City - Find Your People",
    description: "Find your people. Discover the underground.",
    images: ["/og-image.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? "";

  return (
    <html lang="en">
      <head>
        <meta name="csp-nonce" content={nonce} />
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://rtppvljfrkjtoxmaizea.supabase.co" />
        <link rel="preconnect" href="https://img.evbuc.com" />
        <link rel="preconnect" href="https://cdn.evbuc.com" />
        <link rel="preconnect" href="https://s1.ticketm.net" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className={`${outfit.variable} ${jetbrainsMono.variable} antialiased`}>
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
