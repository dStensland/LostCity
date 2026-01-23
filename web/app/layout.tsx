import type { Metadata } from "next";
import { Suspense } from "react";
import { Outfit, Instrument_Serif, JetBrains_Mono, Space_Grotesk, Bebas_Neue } from "next/font/google";
import { AuthProvider } from "@/lib/auth-context";
import { ThemeProvider } from "@/lib/theme-context";
import { ToastProvider } from "@/components/Toast";
import { QueryProvider } from "@/lib/providers/QueryProvider";
import DarkHoursTheme from "@/components/DarkHoursTheme";
import RainEffect from "@/components/RainEffect";
import CursorGlow from "@/components/CursorGlow";
import NavigationProgress from "@/components/NavigationProgress";
import SkipLink from "@/components/SkipLink";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  weight: "400",
  style: "italic",
  variable: "--font-instrument",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
});

const bebasNeue = Bebas_Neue({
  weight: "400",
  variable: "--font-bebas",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://lostcity.ai"),
  title: "Lost City - Discover Local Events",
  description: "Discover local events near you. AI-powered event aggregation from 20+ sources.",
  openGraph: {
    title: "Lost City - Discover Local Events",
    description: "Discover local events near you",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to external domains for faster resource loading */}
        <link rel="preconnect" href="https://rtppvljfrkjtoxmaizea.supabase.co" />
        <link rel="preconnect" href="https://img.evbuc.com" />
        <link rel="preconnect" href="https://cdn.evbuc.com" />
        <link rel="preconnect" href="https://s1.ticketm.net" />
        <link rel="dns-prefetch" href="https://images.unsplash.com" />
      </head>
      <body className={`${outfit.variable} ${instrumentSerif.variable} ${jetbrainsMono.variable} ${spaceGrotesk.variable} ${bebasNeue.variable} antialiased`}>
        <ThemeProvider>
          <QueryProvider>
            {/* Skip link for keyboard users */}
            <SkipLink />
            {/* Navigation progress bar */}
            <Suspense fallback={null}>
              <NavigationProgress />
            </Suspense>
            {/* Ambient glow effect */}
            <div className="ambient-glow" aria-hidden="true" />
            {/* Rain overlay effect */}
            <RainEffect />
            {/* Cursor glow effect */}
            <CursorGlow />
            <AuthProvider>
              <DarkHoursTheme />
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
