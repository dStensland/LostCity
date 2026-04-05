"use client";

import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { HeaderTemplate } from "@/lib/visual-presets";
import StandardHeader from "./StandardHeader";
import MinimalHeader from "./MinimalHeader";
import BrandedHeader from "./BrandedHeader";
import ImmersiveHeader from "./ImmersiveHeader";
import ATLittleHeader from "./ATLittleHeader";
import AdventureHeader from "./AdventureHeader";

export interface PortalHeaderProps {
  /** Override the portal slug (for use outside portal context) */
  portalSlug?: string;
  /** Override the portal name */
  portalName?: string;
  /** Show back button with contextual label. Omit href to use browser history. */
  backLink?: {
    href?: string;
    /** Where to go when there's no in-app history (e.g. direct link, external referrer). */
    fallbackHref?: string;
    label: string;
  };
}

/**
 * Smart header selector that renders the appropriate header template
 * based on the portal's branding configuration.
 */
function PortalHeaderInner({
  portalSlug,
  portalName,
  backLink,
}: PortalHeaderProps) {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;

  // Get the resolved branding with preset defaults applied
  const branding = applyPreset(portal.branding);
  const headerConfig = branding.header;

  // Determine which header template to render
  const template: HeaderTemplate = headerConfig.template || "standard";
  const resolvedSlug = portalSlug || portal.slug;

  // Special case: ATLittle portal has its own custom header
  if (resolvedSlug === "atlanta-families") {
    return <ATLittleHeader />;
  }

  if (resolvedSlug === "adventure") {
    return <AdventureHeader />;
  }

  // Common props for all header types
  const commonProps = {
    portalSlug: resolvedSlug,
    portalName: portalName || portal.name,
    branding: portal.branding,
    backLink,
    headerConfig,
  };

  switch (template) {
    case "minimal":
      return <MinimalHeader {...commonProps} />;
    case "branded":
      return <BrandedHeader {...commonProps} />;
    case "immersive":
      return <ImmersiveHeader {...commonProps} />;
    case "standard":
    default:
      return <StandardHeader {...commonProps} />;
  }
}

/**
 * Portal Header - Renders the appropriate header template based on portal branding.
 *
 * Header Templates:
 * - standard: Current layout - logo left, nav tabs, user menu right
 * - minimal: Logo + user menu only, no nav tabs in header
 * - branded: Large centered logo, nav tabs below
 * - immersive: Transparent over hero image, fades on scroll
 */
export default function PortalHeader(props: PortalHeaderProps) {
  return <PortalHeaderInner {...props} />;
}
