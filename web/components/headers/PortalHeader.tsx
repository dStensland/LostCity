"use client";

import { Suspense } from "react";
import { usePortalOptional, DEFAULT_PORTAL } from "@/lib/portal-context";
import { applyPreset } from "@/lib/apply-preset";
import type { HeaderTemplate } from "@/lib/visual-presets";
import StandardHeader from "./StandardHeader";
import MinimalHeader from "./MinimalHeader";
import BrandedHeader from "./BrandedHeader";
import ImmersiveHeader from "./ImmersiveHeader";
import ATLittleHeader from "./ATLittleHeader";

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
  const resolvedSlug = portalSlug || portal.slug;

  // Special case: ATLittle portal has its own custom header
  if (resolvedSlug === "atlanta-families") {
    return <ATLittleHeader />;
  }

  // Common props for all header types
  const commonProps = {
    portalSlug: resolvedSlug,
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
    <header className="portal-feed-header sticky top-0 z-[100] border-b border-[var(--twilight)]/30 bg-[var(--void)]/95 backdrop-blur-sm relative">
      <div className="portal-feed-header-row px-4 py-2 sm:py-3 flex items-center gap-3">
        <div className="h-8 w-24 rounded skeleton-shimmer" />
        <div className="hidden sm:flex flex-1 justify-center">
          <div className="h-9 w-64 rounded-full skeleton-shimmer" />
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="h-8 w-8 rounded-full skeleton-shimmer" />
          <div className="h-8 w-8 rounded-full skeleton-shimmer" />
        </div>
      </div>
      <div className="sm:hidden px-4 py-2 border-t border-[var(--twilight)]/20">
        <div className="h-8 w-full rounded-full skeleton-shimmer" />
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
