import { notFound } from "next/navigation";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import PortalThemeClient from "@/components/PortalThemeClient";
import { NavigationProgress } from "@/components/ui/NavigationProgress";
import { UnifiedSearchShell } from "@/components/search/UnifiedSearchShell";
import { Cormorant_Garamond, DM_Sans, IBM_Plex_Mono, Inter, Playfair_Display, Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { getVerticalStyles } from "@/lib/portal-animation-config";
import { buildPortalOrigin } from "@/lib/site-url";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { RESERVED_PORTAL_ROUTE_SLUGS } from "@/lib/portal-runtime/types";

import type { Metadata } from "next";
import { headers } from "next/headers";

// Hotel vertical fonts — preload disabled so they only load for hotel portals
const cormorantGaramond = Cormorant_Garamond({
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const inter = Inter({
  weight: ["400", "500", "600"],
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Family vertical fonts — Plus Jakarta Sans (display) + DM Sans (body) for Lost Youth portal
const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const dmSans = DM_Sans({
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Adventure vertical fonts — Space Grotesk for Lost Track portal
const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

// Arts vertical fonts — IBM Plex Mono (labels/nav/metadata) + Playfair Display italic (exhibition titles)
const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
  preload: false,
});

const playfairDisplay = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair-display",
  display: "swap",
  preload: false,
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: slug } = await params;
  const headersList = await headers();
  const request = await resolvePortalRequest({ slug, headersList });
  const portal = request?.portal;

  if (!portal) {
    return { title: "Not Found | Lost City" };
  }

  const branding = portal.branding || {};

  const origin = buildPortalOrigin(portal);
  const pathSlug = portal.city_slug || portal.slug;

  return {
    title: `${portal.name} Events | Lost City`,
    description: portal.tagline || `Find your thing and do it in ${portal.name}. ${portal.portal_type === "city" ? "Shows, sounds, scenes, and the good stuff." : ""}`,
    alternates: {
      canonical: `${origin}/${pathSlug}`,
    },
    openGraph: {
      title: `${portal.name} | Lost City`,
      description: portal.tagline || `Find your thing and do it in ${portal.name}`,
      images: branding.og_image_url ? [{ url: branding.og_image_url as string }] : [],
    },
    icons: branding.favicon_url ? { icon: branding.favicon_url as string } : undefined,
  };
}

export default async function PortalLayout({ children, params }: Props) {
  const { portal: slug } = await params;

  if ((RESERVED_PORTAL_ROUTE_SLUGS as readonly string[]).includes(slug)) {
    notFound();
  }

  const headersList = await headers();
  const request = await resolvePortalRequest({ slug, headersList });
  if (!request) {
    notFound();
  }

  const verticalStyles = getVerticalStyles(request.effectiveVertical);

  return (
    <PortalProvider portal={request.portal}>
      <PortalTheme portal={request.portal} nonce={headersList.get("x-nonce") ?? ""} />
      <PortalThemeClient portal={request.portal} />
      {verticalStyles && <style>{verticalStyles}</style>}
      <div
        data-vertical={request.vertical}
        data-atmosphere={request.disableAmbientEffects ? "disabled" : "default"}
        data-theme={request.isLightTheme ? "light" : undefined}
        className={[
          request.isHotel ? `${cormorantGaramond.variable} ${inter.variable}` : "",
          request.isFamily ? `${plusJakartaSans.variable} ${dmSans.variable}` : "",
          request.isAdventure ? spaceGrotesk.variable : "",
          request.vertical === "arts" ? `${ibmPlexMono.variable} ${playfairDisplay.variable}` : "",
        ].filter(Boolean).join(" ")}
        >
          <NavigationProgress />
          <UnifiedSearchShell portalSlug={slug} mode="overlay" />
          <Suspense fallback={null}>{children}</Suspense>
          <div className="grain-overlay" aria-hidden="true" />
      </div>
    </PortalProvider>
  );
}
