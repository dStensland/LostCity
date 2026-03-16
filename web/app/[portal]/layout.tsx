import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getCachedPortalByVerticalAndCity, getPortalVertical } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import PortalThemeClient from "@/components/PortalThemeClient";
import CannyWidget from "@/components/CannyWidget";
import PortalFooter from "@/components/PortalFooter";
import { PortalTracker } from "./_components/PortalTracker";
import { Cormorant_Garamond, Inter, Plus_Jakarta_Sans } from "next/font/google";
import { Suspense } from "react";
import { isPCMDemoPortal } from "@/lib/marketplace-art";
import { applyPreset } from "@/lib/apply-preset";
import type { PortalBranding } from "@/lib/portal-context";
import { getVerticalStyles } from "@/lib/portal-animation-config";
import { buildPortalOrigin } from "@/lib/site-url";
import { shouldDisableAmbientEffects } from "@/lib/portal-taxonomy";

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

// Family vertical fonts — Plus Jakarta Sans for Lost Youth portal
const plusJakartaSans = Plus_Jakarta_Sans({
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
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
  const vertical = headersList.get("x-lc-vertical");

  let portal;
  if (vertical) {
    portal = await getCachedPortalByVerticalAndCity(vertical, slug);
    if (!portal) portal = await getCachedPortalBySlug(slug);
  } else {
    portal = await getCachedPortalBySlug(slug);
  }

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

  // Special handling for known non-portal routes to avoid conflicts
  const reservedRoutes = ["admin", "api", "auth", "calendar", "claim", "collections", "community", "dashboard", "data", "design", "events", "festivals", "find-friends", "foryou", "friends", "happening-now", "invite", "invite-friends", "logo-concepts", "notifications", "onboarding", "people", "plans", "privacy", "profile", "saved", "series", "settings", "spots", "submit", "terms", "venue", "welcome"];
  if (reservedRoutes.includes(slug)) {
    notFound();
  }

  // Resolve portal: check for vertical subdomain header first
  const headersList = await headers();
  const subdomainVertical = headersList.get("x-lc-vertical");

  let portal;
  if (subdomainVertical) {
    // Subdomain routing: vertical from middleware header, city from path segment
    portal = await getCachedPortalByVerticalAndCity(subdomainVertical, slug);
    // Fallback to slug-based lookup for backward compat
    if (!portal) portal = await getCachedPortalBySlug(slug);
  } else {
    // Standard path routing (root domain or no subdomain)
    portal = await getCachedPortalBySlug(slug);
  }

  if (!portal) {
    notFound();
  }

  // Detect vertical type to apply appropriate styling and components.
  // Slug-based overrides (Emory demo → hospital, PCM demo → marketplace) are
  // resolved here so getVerticalStyles receives the canonical vertical key.
  const vertical = getPortalVertical(portal);
  const isHotel = vertical === "hotel";
  const isFamily = vertical === "family";
  const resolvedBranding = applyPreset((portal.branding || {}) as PortalBranding);
  const isLightTheme = resolvedBranding.theme_mode === "light";
  const isMarketplace = vertical === "marketplace" || isPCMDemoPortal(portal.slug);

  // Resolve the effective vertical key for animation/style config. Slug-based
  // demo portals use their canonical vertical name regardless of what
  // getPortalVertical() returns for their DB record.
  const effectiveVertical = isMarketplace
    ? "marketplace"
    : vertical;

  const verticalStyles = getVerticalStyles(effectiveVertical);
  const suppressPortalStyleAtmosphere = shouldDisableAmbientEffects(vertical);

  return (
    <PortalProvider portal={portal}>
      <PortalTheme portal={portal} />
      <PortalThemeClient portal={portal} />
      {verticalStyles && <style>{verticalStyles}</style>}
      <div
        data-vertical={vertical}
        data-atmosphere={suppressPortalStyleAtmosphere ? "disabled" : "default"}
        data-theme={isLightTheme ? "light" : undefined}
        className={[
          isHotel ? `${cormorantGaramond.variable} ${inter.variable}` : "",
          isFamily ? plusJakartaSans.variable : "",
        ].filter(Boolean).join(" ")}
      >
        <Suspense fallback={null}>
          <PortalTracker portalSlug={portal.slug} />
        </Suspense>
        {children}
        <PortalFooter />
        <CannyWidget />
      </div>
    </PortalProvider>
  );
}
