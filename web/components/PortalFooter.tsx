"use client";

import { usePortal, DEFAULT_PORTAL_SLUG } from "@/lib/portal-context";
import PageFooter from "./PageFooter";

/**
 * Portal-aware footer that automatically applies branding from the current portal context.
 * Use this in portal pages ([portal]/*) to get white-label footer support.
 * For non-portal pages, use PageFooter directly.
 */
export default function PortalFooter() {
  const { portal } = usePortal();

  if (!portal) {
    return <PageFooter />;
  }

  const branding = portal.branding || {};

  // Non-default portals show their own name in footer instead of Lost City logo
  const isNonDefault = portal.slug !== DEFAULT_PORTAL_SLUG;

  return (
    <PageFooter
      cityName={portal.name}
      tagline={portal.tagline || undefined}
      hideAttribution={branding.hide_attribution}
      footerText={branding.footer_text}
      footerLinks={branding.footer_links}
      logoUrl={branding.logo_url}
      portalName={isNonDefault ? portal.name : undefined}
    />
  );
}
