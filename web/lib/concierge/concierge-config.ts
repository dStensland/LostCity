/**
 * Concierge Configuration
 *
 * Reads portal settings to produce a ConciergeConfig that determines
 * which pillars to show, labels, default pillar, and guest phase.
 */

import type { Portal } from "@/lib/portal-context";
import type { ConciergeConfig, Pillar, PillarConfig, GuestPhase } from "./concierge-types";

/**
 * Build concierge configuration from portal data.
 */
export function getConciergeConfig(portal: Portal, conciergePhone: string): ConciergeConfig {
  const settings = portal.settings || {};
  const variant = typeof settings.experience_variant === "string"
    ? settings.experience_variant.toLowerCase()
    : "default";

  // Determine guest phase from portal settings or default to in_stay
  const guestPhase: GuestPhase = (settings.guest_phase as GuestPhase) || "in_stay";

  // Build pillar list based on phase
  const pillars = buildPillarList(portal, guestPhase);

  // Default pillar depends on phase
  const defaultPillar: Pillar = guestPhase === "pre_arrival" ? "planner" : "around";

  return {
    portalSlug: portal.slug,
    portalName: portal.name,
    experienceVariant: variant || "default",
    defaultPillar,
    pillars,
    guestPhase,
    skipOnboarding: Boolean(settings.skip_onboarding),
    conciergePhone,
  };
}

function buildPillarList(portal: Portal, phase: GuestPhase): PillarConfig[] {
  const settings = portal.settings || {};
  const pillarLabels = settings.pillar_labels as Record<string, string> | undefined;

  // Service pillar label is configurable per portal
  const serviceLabel = pillarLabels?.services || `At ${portal.name}`;

  const allPillars: PillarConfig[] = [
    { id: "services", label: serviceLabel, icon: "building" },
    { id: "around", label: pillarLabels?.around || "Discover", icon: "map-pin" },
    { id: "planner", label: pillarLabels?.planner || "Planner", icon: "list-checks" },
  ];

  // Pre-arrival hides Services
  if (phase === "pre_arrival") {
    return allPillars.filter((p) => p.id !== "services");
  }

  return allPillars;
}

/**
 * Check if a portal is a concierge-enabled portal.
 */
export function isConciergePortal(portal: Portal): boolean {
  const variant = typeof portal.settings?.experience_variant === "string"
    ? portal.settings.experience_variant.toLowerCase()
    : "";

  return (
    portal.slug === "forth" ||
    variant === "forth" ||
    variant === "forth_signature" ||
    variant === "concierge"
  );
}

/**
 * Get the initial pillar from URL search params.
 */
export function getPillarFromSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
  config: ConciergeConfig
): Pillar {
  const param = typeof searchParams.pillar === "string" ? searchParams.pillar : null;
  if (param && config.pillars.some((p) => p.id === param)) {
    return param as Pillar;
  }
  return config.defaultPillar;
}
