import { notFound } from "next/navigation";
import { getCachedPortalBySlug } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import PortalThemeClient from "@/components/PortalThemeClient";

import type { Metadata } from "next";

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

  return (
    <PortalProvider portal={portal}>
      <PortalTheme portal={portal} />
      <PortalThemeClient portal={portal} />
      {children}
    </PortalProvider>
  );
}
