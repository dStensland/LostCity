import { notFound } from "next/navigation";
import { getPortalBySlug, DEFAULT_PORTAL } from "@/lib/portal";
import { PortalProvider } from "@/lib/portal-context";
import { PortalTheme } from "@/components/PortalTheme";
import type { Metadata } from "next";
import type { Portal } from "@/lib/portal-context";

type Props = {
  children: React.ReactNode;
  params: Promise<{ portal: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { portal: slug } = await params;
  const portal = await getPortalBySlug(slug);

  if (!portal) {
    return { title: "Not Found | Lost City" };
  }

  const branding = portal.branding || {};

  return {
    title: `${portal.name} Events | Lost City`,
    description: portal.tagline || `Discover events in ${portal.name}. ${portal.portal_type === "city" ? "Concerts, shows, food, nightlife and more." : ""}`,
    openGraph: {
      title: `${portal.name} | Lost City`,
      description: portal.tagline || `Discover events in ${portal.name}`,
      images: branding.og_image_url ? [{ url: branding.og_image_url as string }] : [],
    },
    icons: branding.favicon_url ? { icon: branding.favicon_url as string } : undefined,
  };
}

export default async function PortalLayout({ children, params }: Props) {
  const { portal: slug } = await params;

  // Special handling for known non-portal routes to avoid conflicts
  const reservedRoutes = ["admin", "api", "auth", "collections", "data", "events", "foryou", "invite", "notifications", "portal", "profile", "saved", "settings", "spots"];
  if (reservedRoutes.includes(slug)) {
    notFound();
  }

  const portal = await getPortalBySlug(slug);

  if (!portal) {
    // For Atlanta, use default if not in database yet
    if (slug === "atlanta") {
      return (
        <PortalProvider portal={DEFAULT_PORTAL}>
          <PortalTheme portal={DEFAULT_PORTAL} />
          {children}
        </PortalProvider>
      );
    }
    notFound();
  }

  return (
    <PortalProvider portal={portal}>
      <PortalTheme portal={portal} />
      {children}
    </PortalProvider>
  );
}
