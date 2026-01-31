"use client";

import { Suspense } from "react";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { HeaderTemplate } from "@/lib/visual-presets";
import StandardHeader from "./StandardHeader";
import MinimalHeader from "./MinimalHeader";
import BrandedHeader from "./BrandedHeader";
import ImmersiveHeader from "./ImmersiveHeader";

export interface PortalHeaderProps {
  /** Override the portal slug (for use outside portal context) */
  portalSlug?: string;
  /** Override the portal name */
  portalName?: string;
  /** Show back button with contextual label */
  backLink?: {
    href: string;
    label: string;
  };
  /** Hide the main navigation tabs */
  hideNav?: boolean;
}

/**
 * Smart header selector that renders the appropriate header template
 * based on the portal's branding configuration.
 */
function PortalHeaderInner({
  portalSlug,
  portalName,
  backLink,
  hideNav = false,
}: PortalHeaderProps) {
  const portalContext = usePortalOptional();
  const portal = portalContext?.portal ?? DEFAULT_PORTAL;

  // Get the resolved branding with preset defaults applied
  const branding = applyPreset(portal.branding);
  const headerConfig = branding.header;

  // Determine which header template to render
  const template: HeaderTemplate = headerConfig.template || "standard";

  // Common props for all header types
  const commonProps = {
    portalSlug: portalSlug || portal.slug,
    portalName: portalName || portal.name,
    branding: portal.branding,
    backLink,
    hideNav,
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
 * Header loading fallback
 */
function HeaderFallback() {
  return (
    <header className="sticky top-0 z-[100] border-b bg-[var(--void)]/95 backdrop-blur-sm border-[var(--twilight)]/30">
      <div className="px-4 py-3 flex items-center gap-4">
        <div className="h-8 w-24 rounded skeleton-shimmer" />
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full skeleton-shimmer" />
        </div>
      </div>
    </header>
  );
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
  return (
    <Suspense fallback={<HeaderFallback />}>
      <PortalHeaderInner {...props} />
    </Suspense>
  );
}
