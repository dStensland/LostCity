/**
 * Shared taxonomy contract for live portal runtime decisions.
 *
 * This module centralizes portal roles, runtime verticals, and entity-family
 * naming so manifest building, portal context, and route gating stop drifting
 * apart as the content-pillar strategy evolves.
 */

export const PORTAL_VERTICALS = [
  "city",
  "community",
  "family",
  "adventure",
  "arts",
  "sports",
  "hotel",
  "hospital",
  "film",
  "marketplace",
  "dog",
] as const;

export type PortalVertical = (typeof PORTAL_VERTICALS)[number];

export const PORTAL_VERTICAL_ALIASES = {
  civic: "community",
} as const;

export type PortalVerticalAlias = keyof typeof PORTAL_VERTICAL_ALIASES;

export const PORTAL_ROLES = [
  "base_city",
  "content_pillar",
  "distribution",
  "specialty",
] as const;

export type PortalRole = (typeof PORTAL_ROLES)[number];

export const CONTENT_PILLAR_VERTICALS = [
  "community",
  "family",
  "adventure",
  "arts",
  "sports",
] as const;

export const BESPOKE_FEED_SHELL_VERTICALS = [
  "community",
  "family",
  "arts",
] as const;

export const AMBIENT_DISABLED_VERTICALS = [
  "film",
  "community",
  "marketplace",
  "dog",
] as const;

export const GLOBAL_EFFECTS_SUPPRESSED_VERTICALS = [
  "film",
  "community",
  "arts",
  "marketplace",
  "dog",
  "hotel",
  "hospital",
] as const;

export const FEED_SKELETON_VERTICALS = [
  "hotel",
  "film",
  "marketplace",
] as const;

export type FeedSkeletonVertical = (typeof FEED_SKELETON_VERTICALS)[number] | "city";

export const ENTITY_FAMILIES = [
  "events",
  "destinations",
  "programs",
  "exhibitions",
  "open_calls",
  "volunteer_opportunities",
  "games",
  "destination_details",
  "venue_features",
  "venue_specials",
  "editorial_mentions",
  "venue_occasions",
] as const;

export type EntityFamily = (typeof ENTITY_FAMILIES)[number];

const PORTAL_VERTICAL_SET = new Set<string>(PORTAL_VERTICALS);
const ENTITY_FAMILY_SET = new Set<string>(ENTITY_FAMILIES);
const CONTENT_PILLAR_VERTICAL_SET = new Set<string>(CONTENT_PILLAR_VERTICALS);
const BESPOKE_FEED_SHELL_VERTICAL_SET = new Set<string>(BESPOKE_FEED_SHELL_VERTICALS);
const AMBIENT_DISABLED_VERTICAL_SET = new Set<string>(AMBIENT_DISABLED_VERTICALS);
const GLOBAL_EFFECTS_SUPPRESSED_VERTICAL_SET = new Set<string>(GLOBAL_EFFECTS_SUPPRESSED_VERTICALS);
const FEED_SKELETON_VERTICAL_SET = new Set<string>(FEED_SKELETON_VERTICALS);

export function isPortalVertical(value: unknown): value is PortalVertical {
  return typeof value === "string" && PORTAL_VERTICAL_SET.has(value);
}

export function isEntityFamily(value: unknown): value is EntityFamily {
  return typeof value === "string" && ENTITY_FAMILY_SET.has(value);
}

export function coercePortalVertical(value: unknown): PortalVertical | null {
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }

  if (value in PORTAL_VERTICAL_ALIASES) {
    return PORTAL_VERTICAL_ALIASES[value as PortalVerticalAlias];
  }

  return isPortalVertical(value) ? value : null;
}

export function normalizePortalVertical(
  value: unknown,
  fallback: PortalVertical = "city",
): PortalVertical {
  return coercePortalVertical(value) ?? fallback;
}

export function defaultPortalVerticalForType(portalType: string | null | undefined): PortalVertical {
  return portalType === "business" ? "community" : "city";
}

export function getPortalRole(vertical: PortalVertical): PortalRole {
  switch (vertical) {
    case "city":
      return "base_city";
    case "community":
    case "family":
    case "adventure":
    case "arts":
    case "sports":
      return "content_pillar";
    case "hotel":
    case "hospital":
      return "distribution";
    case "film":
    case "marketplace":
    case "dog":
      return "specialty";
  }
}

export function isContentPillarVertical(vertical: PortalVertical): boolean {
  return CONTENT_PILLAR_VERTICAL_SET.has(vertical);
}

export function isFilmPortalVertical(vertical: PortalVertical): boolean {
  return vertical === "film";
}

export function hasBespokeFeedShell(vertical: PortalVertical): boolean {
  return BESPOKE_FEED_SHELL_VERTICAL_SET.has(vertical);
}

export function supportsPortalSpots(vertical: PortalVertical): boolean {
  return !isFilmPortalVertical(vertical);
}

export function supportsPortalArtists(vertical: PortalVertical): boolean {
  return vertical === "city" || vertical === "community" || isFilmPortalVertical(vertical);
}

export function supportsPortalWeather(vertical: PortalVertical): boolean {
  return vertical !== "dog";
}

export function supportsPortalMap(vertical: PortalVertical): boolean {
  return vertical !== "hotel";
}

export function shouldDisableAmbientEffects(vertical: PortalVertical): boolean {
  return AMBIENT_DISABLED_VERTICAL_SET.has(vertical);
}

export function shouldSuppressGlobalEffects(vertical: PortalVertical): boolean {
  return GLOBAL_EFFECTS_SUPPRESSED_VERTICAL_SET.has(vertical);
}

export function toFeedSkeletonVertical(vertical: PortalVertical): FeedSkeletonVertical {
  return FEED_SKELETON_VERTICAL_SET.has(vertical) ? (vertical as FeedSkeletonVertical) : "city";
}
