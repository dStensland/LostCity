import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import PortalThemeClient from "@/components/PortalThemeClient";
import CannyWidget from "@/components/CannyWidget";
import PortalFooter from "@/components/PortalFooter";
import { PortalTracker } from "./_components/PortalTracker";
import { Cormorant_Garamond, Inter } from "next/font/google";
import { Suspense } from "react";
import { isEmoryDemoPortal } from "@/lib/hospital-art";
import { isPCMDemoPortal } from "@/lib/marketplace-art";

import type { Metadata } from "next";

// Hotel vertical fonts
const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  weight: ["400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: slug } = await params;
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    return { title: "Not Found | Lost City" };
  }

  const branding = portal.branding || {};

  return {
    title: `${portal.name} Events | Lost City`,
    description: portal.tagline || `Find your people in ${portal.name}. ${portal.portal_type === "city" ? "Shows, sounds, scenes, and the good stuff." : ""}`,
    alternates: {
      canonical: `/${portal.slug}`,
    },
    openGraph: {
      title: `${portal.name} | Lost City`,
      description: portal.tagline || `Find your people in ${portal.name}`,
      images: branding.og_image_url ? [{ url: branding.og_image_url as string }] : [],
    },
    icons: branding.favicon_url ? { icon: branding.favicon_url as string } : undefined,
  };
}

export default async function PortalLayout({ children, params }: Props) {
  const { portal: slug } = await params;

  // Special handling for known non-portal routes to avoid conflicts
  const reservedRoutes = ["admin", "api", "auth", "collections", "data", "events", "foryou", "invite", "notifications", "portal", "privacy", "profile", "saved", "settings", "spots", "terms"];
  if (reservedRoutes.includes(slug)) {
    notFound();
  }

  // All portals must exist in the database - no hardcoded fallback
  const portal = await getCachedPortalBySlug(slug);

  if (!portal) {
    notFound();
  }

  // Detect vertical type to apply appropriate styling and components
  const vertical = getPortalVertical(portal);
  const isHotel = vertical === "hotel";
  const isFilm = vertical === "film";
  const isMarketplace = vertical === "marketplace" || isPCMDemoPortal(portal.slug);
  const isEmoryDemo = isEmoryDemoPortal(portal.slug);

  return (
    <PortalProvider portal={portal}>
      <PortalTheme portal={portal} />
      <PortalThemeClient portal={portal} />
      {isMarketplace && (
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }

          [data-vertical="marketplace"] .animate-page-enter,
          [data-vertical="marketplace"] .animate-glitch-flicker,
          [data-vertical="marketplace"] .animate-flicker,
          [data-vertical="marketplace"] .animate-flicker-fast,
          [data-vertical="marketplace"] .animate-coral-shimmer,
          [data-vertical="marketplace"] .animate-coral-scan,
          [data-vertical="marketplace"] .animate-coral-pulse,
          [data-vertical="marketplace"] .animate-happening-now-pulse,
          [data-vertical="marketplace"] .animate-pulse-glow {
            animation: none !important;
          }

          [data-vertical="marketplace"] [class*="animate-"] {
            animation: none !important;
          }
        `}</style>
      )}
      {vertical === "dog" && (
        <style>{`
          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }

          [data-vertical="dog"] .animate-page-enter,
          [data-vertical="dog"] .animate-glitch-flicker,
          [data-vertical="dog"] .animate-flicker,
          [data-vertical="dog"] .animate-flicker-fast,
          [data-vertical="dog"] .animate-coral-shimmer,
          [data-vertical="dog"] .animate-coral-scan,
          [data-vertical="dog"] .animate-coral-pulse,
          [data-vertical="dog"] .animate-happening-now-pulse,
          [data-vertical="dog"] .animate-pulse-glow {
            animation: none !important;
          }

          [data-vertical="dog"] [class*="animate-"] {
            animation: none !important;
          }
        `}</style>
      )}
      {isFilm && (
        <style>{`
          [data-vertical="film"] {
            --coral: #b8c8f8;
            --coral-hsl: 225 80% 85%;
            --neon-amber: #b8c8f8;
            --neon-amber-hsl: 225 80% 85%;
            --gold: #dbe5ff;
          }

          body::before { opacity: 0 !important; }
          body::after { opacity: 0 !important; }
          .ambient-glow { opacity: 0 !important; }
          .rain-overlay { display: none !important; }
          .cursor-glow { display: none !important; }

          [data-vertical="film"] .animate-page-enter,
          [data-vertical="film"] .animate-glitch-flicker,
          [data-vertical="film"] .animate-flicker,
          [data-vertical="film"] .animate-flicker-fast,
          [data-vertical="film"] .animate-coral-shimmer,
          [data-vertical="film"] .animate-coral-scan,
          [data-vertical="film"] .animate-coral-pulse,
          [data-vertical="film"] .animate-happening-now-pulse,
          [data-vertical="film"] .animate-pulse-glow {
            animation: none !important;
          }

          [data-vertical="film"] [class*="animate-"] {
            animation: none !important;
          }
        `}</style>
      )}
      <div
        data-vertical={vertical}
        className={isHotel ? `${cormorantGaramond.variable} ${inter.variable}` : ""}
      >
        <Suspense fallback={null}>
          <PortalTracker portalSlug={portal.slug} />
        </Suspense>
        {children}
        {!isEmoryDemo && <PortalFooter />}
        {!isEmoryDemo && <CannyWidget />}
      </div>
    </PortalProvider>
  );
}
