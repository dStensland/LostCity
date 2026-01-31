"use client";

import { usePortal } from "@/lib/portal-context";
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

  return (
    <PageFooter
      cityName={portal.name}
      tagline={portal.tagline || undefined}
      hideAttribution={branding.hide_attribution}
      footerText={branding.footer_text}
      footerLinks={branding.footer_links}
      logoUrl={branding.logo_url}
    />
  );
}
