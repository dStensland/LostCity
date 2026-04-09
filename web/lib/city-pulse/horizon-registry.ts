import type { FeedEventData } from "@/components/EventCard";
import registryData from "./data/atlanta-horizon-targets.json";

export type HorizonTargetKind = "festival" | "tentpole_event";
export type HorizonTargetTier = "tier_a" | "tier_b";

export type HorizonExpectedWindow = {
  start_month: number;
  end_month: number;
};

export type HorizonTarget = {
  canonical_key: string;
  name: string;
  kind: HorizonTargetKind;
  tier: HorizonTargetTier;
  portal_slug: string;
  aliases: string[];
  source_url: string;
  source_slug_hints: string[];
  expected_window: HorizonExpectedWindow;
  surface_in_horizon: boolean;
};

export type HorizonFestivalRow = {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  image_url: string | null;
  website: string | null;
  announced_start: string | null;
  announced_end: string | null;
  pending_start: string | null;
  pending_end: string | null;
  free: boolean | null;
  primary_type: string | null;
  categories: string[] | null;
  genres: string[] | null;
  neighborhood: string | null;
  location: string | null;
};

type CanonicalMatchable = Pick<
  FeedEventData,
  "festival_id" | "title" | "image_url" | "venue"
> & {
  source_slug?: string | null;
};

const ALL_TARGETS = registryData as HorizonTarget[];

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

export function normalizeHorizonText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getExplicitMatchKeys(target: HorizonTarget): string[] {
  return unique([
    target.canonical_key,
    ...target.source_slug_hints,
  ].map((value) => normalizeHorizonText(value)).filter(Boolean));
}

function getTitleAliases(target: HorizonTarget): string[] {
  return unique([
    target.name,
    ...target.aliases,
  ].map((value) => normalizeHorizonText(value)).filter(Boolean));
}

export function getPortalHorizonTargets(portalSlug: string): HorizonTarget[] {
  return ALL_TARGETS.filter((target) => target.portal_slug === portalSlug);
}

export function getSurfaceablePortalHorizonTargets(portalSlug: string): HorizonTarget[] {
  return getPortalHorizonTargets(portalSlug).filter((target) => target.surface_in_horizon);
}

export function getPortalHorizonSourceSlugHints(portalSlug: string): string[] {
  return unique(
    getSurfaceablePortalHorizonTargets(portalSlug).flatMap((target) => target.source_slug_hints),
  );
}

export function getTierImportance(tier: HorizonTargetTier): "flagship" | "major" {
  return tier === "tier_a" ? "flagship" : "major";
}

export function buildHorizonPoolFilter(extraSourceIds: number[] = []): string {
  const base = [
    "is_tentpole.eq.true",
    "festival_id.not.is.null",
    "importance.eq.flagship",
    "importance.eq.major",
    "significance.eq.high",
    "tags.ov.{festival,fest,fair,parade,pride,carnival}",
    "title.ilike.%festival%",
    "title.ilike.%fest%",
    "title.ilike.%fair%",
    "title.ilike.%parade%",
    "title.ilike.%pride%",
    "title.ilike.%carnival%",
  ];

  if (extraSourceIds.length === 0) return base.join(",");
  const ids = unique(extraSourceIds.filter((id) => Number.isInteger(id))).sort((a, b) => a - b);
  if (ids.length === 0) return base.join(",");
  return [...base, `source_id.in.(${ids.join(",")})`].join(",");
}

export function resolveCanonicalHorizonTarget(
  candidate: Pick<CanonicalMatchable, "festival_id" | "title" | "source_slug">,
  portalSlug: string,
): HorizonTarget | null {
  const targets = getSurfaceablePortalHorizonTargets(portalSlug);
  if (targets.length === 0) return null;

  const normalizedFestivalId = normalizeHorizonText(candidate.festival_id);
  if (normalizedFestivalId) {
    const explicitMatch = targets.find((target) =>
      getExplicitMatchKeys(target).includes(normalizedFestivalId),
    );
    if (explicitMatch) return explicitMatch;
  }

  const normalizedSourceSlug = normalizeHorizonText(candidate.source_slug);
  if (normalizedSourceSlug) {
    const sourceMatch = targets.find((target) =>
      getExplicitMatchKeys(target).includes(normalizedSourceSlug),
    );
    if (sourceMatch) return sourceMatch;
  }

  const normalizedTitle = normalizeHorizonText(candidate.title);
  if (!normalizedTitle) return null;

  return targets.find((target) =>
    getTitleAliases(target).some((alias) => normalizedTitle.includes(alias)),
  ) ?? null;
}

function stableSyntheticId(seed: string): number {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0;
  }
  if (hash === 0) return -1;
  return -Math.abs(hash);
}

function inferFestivalCategory(row: HorizonFestivalRow): string {
  const candidates = [
    row.primary_type,
    ...(row.categories ?? []),
    ...(row.genres ?? []),
  ].map((value) => normalizeHorizonText(value));

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (candidate.includes("music")) return "music";
    if (candidate.includes("film")) return "film";
    if (candidate.includes("food")) return "food_drink";
    if (candidate.includes("art")) return "art";
    if (candidate.includes("comic") || candidate.includes("anime") || candidate.includes("gaming")) {
      return "gaming";
    }
    if (candidate.includes("community") || candidate.includes("cultural") || candidate.includes("parade")) {
      return "community";
    }
    if (candidate.includes("sports") || candidate.includes("race")) return "sports";
  }

  return "other";
}

export function annotateCanonicalHorizonEvent<T extends FeedEventData>(
  event: T,
  portalSlug: string,
): T {
  const existingKey = (event as T & { canonical_key?: string | null }).canonical_key;
  const target = existingKey
    ? getSurfaceablePortalHorizonTargets(portalSlug).find(
        (candidate) => candidate.canonical_key === existingKey,
      ) ?? null
    : resolveCanonicalHorizonTarget(event, portalSlug);

  if (!target) return event;

  return {
    ...event,
    entity_type: (event.entity_type ?? "event"),
    canonical_key: target.canonical_key,
    canonical_tier: target.tier,
    is_tentpole: target.tier === "tier_a" ? true : event.is_tentpole,
    importance:
      target.tier === "tier_a"
        ? "flagship"
        : event.importance === "flagship"
          ? "flagship"
          : "major",
  };
}

export function buildSyntheticFestivalHorizonEvent(
  row: HorizonFestivalRow,
  portalSlug: string,
): FeedEventData | null {
  const target = resolveCanonicalHorizonTarget(
    {
      festival_id: row.id,
      title: row.name,
      source_slug: row.slug,
    },
    portalSlug,
  );

  if (!target || !target.surface_in_horizon) return null;

  const startDate = row.announced_start ?? row.pending_start;
  if (!startDate || !row.image_url) return null;

  const endDate = row.announced_end ?? row.pending_end ?? startDate;
  const venueName = row.location?.trim() || null;
  const venueNeighborhood = row.neighborhood?.trim() || null;
  const venue =
    venueName || venueNeighborhood
      ? {
          id: stableSyntheticId(`festival-venue:${row.id}`),
          name: venueName ?? row.name,
          neighborhood: venueNeighborhood,
          slug: row.slug,
          image_url: null,
        }
      : null;

  return {
    id: stableSyntheticId(`festival:${row.id}`),
    title: row.name,
    start_date: startDate,
    start_time: null,
    end_date: endDate,
    end_time: null,
    is_all_day: true,
    is_free: row.free ?? false,
    price_min: null,
    price_max: null,
    category: inferFestivalCategory(row),
    tags: row.categories ?? [],
    genres: row.genres ?? [],
    image_url: row.image_url,
    description: row.description,
    featured_blurb: null,
    festival_id: row.id,
    is_tentpole: target.tier === "tier_a",
    is_featured: false,
    importance: getTierImportance(target.tier),
    ticket_url: null,
    source_url: row.website,
    venue,
    series: null,
    series_id: null,
    entity_type: "festival",
    canonical_key: target.canonical_key,
    canonical_tier: target.tier,
    source_slug: row.slug,
  };
}
