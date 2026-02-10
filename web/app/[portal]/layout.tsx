import { notFound } from "next/navigation";
import { getCachedPortalBySlug, getPortalVertical } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import PortalThemeClient from "@/components/PortalThemeClient";
import CannyWidget from "@/components/CannyWidget";
import PortalFooter from "@/components/PortalFooter";
import { Cormorant_Garamond, Inter } from "next/font/google";

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

  return (
    <PortalProvider portal={portal}>
      <PortalTheme portal={portal} />
      <PortalThemeClient portal={portal} />
      <div
        data-vertical={vertical}
        className={isHotel ? `${cormorantGaramond.variable} ${inter.variable}` : ""}
      >
        {children}
        <PortalFooter />
        <CannyWidget />
      </div>
    </PortalProvider>
  );
}
