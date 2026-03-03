import type { ComponentType } from "react";
import type { IconProps } from "@phosphor-icons/react";
import {
  PaintBrush,
  Image,
  TreePalm,
  FilmSlate,
  Compass,
  Star,
} from "@phosphor-icons/react";

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

// ---------------------------------------------------------------------------
// Section config per venue type
// ---------------------------------------------------------------------------

export type FeatureSectionConfig = {
  title: string;
  Icon: ComponentType<IconProps>;
  color: string;
};

export const FEATURE_SECTION_CONFIG: Record<string, FeatureSectionConfig> = {
  museum: { title: "On View", Icon: PaintBrush, color: "#F472B6" },
  gallery: { title: "Current Exhibition", Icon: Image, color: "#A78BFA" },
  park: { title: "Things to Do", Icon: TreePalm, color: "#4ADE80" },
  cinema: { title: "Now Playing", Icon: FilmSlate, color: "#FBBF24" },
  theater: { title: "Now Playing", Icon: FilmSlate, color: "#FBBF24" },
  historic_site: { title: "Points of Interest", Icon: Compass, color: "#38BDF8" },
};

const DEFAULT_CONFIG: FeatureSectionConfig = {
  title: "Features & Attractions",
  Icon: Star,
  color: "#FB923C",
};

export function getFeatureSectionConfig(
  venueType: string | null | undefined
): FeatureSectionConfig {
  if (venueType && FEATURE_SECTION_CONFIG[venueType]) {
    return FEATURE_SECTION_CONFIG[venueType];
  }
  return DEFAULT_CONFIG;
}

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
