// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FeatureType =
  | "attraction"
  | "exhibition"
  | "collection"
  | "experience"
  | "amenity";

export type VenueFeature = {
  id: number;
  slug: string;
  title: string;
  feature_type: FeatureType;
  description: string | null;
  image_url: string | null;
  url: string | null;
  is_seasonal: boolean;
  start_date: string | null;
  end_date: string | null;
  price_note: string | null;
  is_free: boolean;
  sort_order: number;
};

type VenueFeatureFilterOptions = {
  portalSlug?: string | null;
  venueSlug?: string | null;
};

// ---------------------------------------------------------------------------
// Feature type labels (for badges)
// ---------------------------------------------------------------------------

export const FEATURE_TYPE_LABELS: Record<FeatureType, string> = {
  attraction: "Attraction",
  exhibition: "Exhibition",
  collection: "Collection",
  experience: "Experience",
  amenity: "Amenity",
};

// ---------------------------------------------------------------------------
// Venue type category helpers
// ---------------------------------------------------------------------------

const EVENT_HEAVY_TYPES = new Set([
  "music_venue",
  "theater",
  "nightclub",
  "comedy_club",
  "cinema",
]);

const FEATURE_HEAVY_TYPES = new Set([
  "park",
  "historic_site",
  "museum",
  "gallery",
]);

export function isEventHeavyType(
  venueType: string | null | undefined
): boolean {
  return !!venueType && EVENT_HEAVY_TYPES.has(venueType);
}

export function isFeatureHeavyType(
  venueType: string | null | undefined
): boolean {
  return !!venueType && FEATURE_HEAVY_TYPES.has(venueType);
}

const FAMILY_GLOBAL_EXCLUDED_SLUGS = new Set(["birdseed-fundraiser-pick-up"]);

const FAMILY_EXCLUDED_TEXT_PATTERNS = [
  /\bfundraiser\b/i,
  /\bpick[\s-]?up\b/i,
  /\bmember(s)? only\b/i,
  /\bstaff\b/i,
  /\bvolunteer\b/i,
];

const FAMILY_ALLOWED_SLUGS_BY_VENUE: Record<string, Set<string>> = {
  "chattahoochee-nature-center": new Set([
    "wildlife-walk",
    "river-boardwalk-trails",
    "interactive-nature-play",
    "weekend-activities",
    "river-roots-science-stations",
    "naturally-artistic-interactive-exhibits",
    "winter-gallery",
    "spring-gallery",
  ]),
};

function shouldExcludeFromFamily(
  feature: VenueFeature,
  venueSlug: string | null
): boolean {
  if (FAMILY_GLOBAL_EXCLUDED_SLUGS.has(feature.slug)) {
    return true;
  }

  const combinedText = [feature.slug, feature.title, feature.description]
    .filter(Boolean)
    .join(" ");
  if (FAMILY_EXCLUDED_TEXT_PATTERNS.some((pattern) => pattern.test(combinedText))) {
    return true;
  }

  if (venueSlug) {
    const allowlist = FAMILY_ALLOWED_SLUGS_BY_VENUE[venueSlug];
    if (allowlist && !allowlist.has(feature.slug)) {
      return true;
    }
  }

  return false;
}

export function filterVenueFeaturesForPortal(
  features: VenueFeature[],
  { portalSlug, venueSlug }: VenueFeatureFilterOptions = {}
): VenueFeature[] {
  if (portalSlug !== "atlanta-families") {
    return features;
  }

  return features.filter(
    (feature) => !shouldExcludeFromFamily(feature, venueSlug ?? null)
  );
}
