// Places to Go feed section — category definitions and utilities

import type { PlacesToGoCategoryConfig } from "./types";

/** The 12 category definitions for the Places to Go feed section. */
export const PLACES_TO_GO_CATEGORIES: readonly PlacesToGoCategoryConfig[] = [
  {
    key: "parks_gardens",
    label: "Parks & Gardens",
    placeTypes: ["park", "garden", "zoo", "aquarium"],
    accentColor: "#86EFAC",
    iconType: "park",
  },
  {
    key: "trails_nature",
    label: "Trails & Nature",
    placeTypes: ["trail", "viewpoint", "outdoor_venue"],
    accentColor: "#4ADE80",
    iconType: "trail",
  },
  {
    key: "museums",
    label: "Museums",
    placeTypes: ["museum", "arts_center"],
    accentColor: "#A78BFA",
    iconType: "museum",
  },
  {
    key: "galleries_studios",
    label: "Galleries & Studios",
    placeTypes: ["gallery", "studio"],
    accentColor: "#C084FC",
    iconType: "gallery",
  },
  {
    key: "theaters_stage",
    label: "Theaters & Stage",
    placeTypes: ["theater", "comedy_club", "amphitheater", "cinema"],
    accentColor: "#F472B6",
    iconType: "theater",
  },
  {
    key: "music_venues",
    label: "Music Venues",
    placeTypes: ["music_venue", "arena", "stadium"],
    accentColor: "#FF6B7A",
    iconType: "music",
  },
  {
    key: "restaurants",
    label: "Restaurants",
    placeTypes: ["restaurant", "coffee_shop", "food_hall", "cooking_school"],
    accentColor: "#FB923C",
    iconType: "food",
    seeAllTab: "eat-drink",
  },
  {
    key: "bars_nightlife",
    label: "Bars & Nightlife",
    placeTypes: [
      "bar",
      "brewery",
      "cocktail_bar",
      "wine_bar",
      "rooftop",
      "lounge",
      "sports_bar",
      "nightclub",
      "club",
      "distillery",
      "winery",
    ],
    accentColor: "#E879F9",
    iconType: "nightlife",
    seeAllTab: "eat-drink",
  },
  {
    key: "markets_local",
    label: "Markets & Local",
    placeTypes: ["farmers_market", "market", "bookstore", "record_store", "retail"],
    accentColor: "#FCA5A5",
    iconType: "market",
  },
  {
    key: "libraries_learning",
    label: "Libraries & Learning",
    placeTypes: ["library", "institution", "community_center"],
    accentColor: "#60A5FA",
    iconType: "library",
  },
  {
    key: "fun_games",
    label: "Fun & Games",
    placeTypes: [
      "arcade",
      "escape_room",
      "eatertainment",
      "bowling",
      "pool_hall",
      "recreation",
      "karaoke",
      "theme_park",
      "attraction",
    ],
    accentColor: "#22D3EE",
    iconType: "games",
  },
  {
    key: "historic_sites",
    label: "Historic Sites",
    placeTypes: ["landmark", "historic_site", "skyscraper", "artifact", "public_art"],
    accentColor: "#FBBF24",
    iconType: "landmark",
  },
] as const;

/** Flat array of all place_types across all categories. */
export const ALL_PLACES_TO_GO_TYPES: readonly string[] = PLACES_TO_GO_CATEGORIES.flatMap(
  (c) => c.placeTypes
);

/** Maps a place_type string to its category key. Returns null if unmapped. */
export function getCategoryKeyForPlaceType(placeType: string): string | null {
  for (const category of PLACES_TO_GO_CATEGORIES) {
    if ((category.placeTypes as readonly string[]).includes(placeType)) {
      return category.key;
    }
  }
  return null;
}

/**
 * Builds the "see all" URL for a category.
 * If seeAllTab is set, routes to the tab on the Find view.
 * Otherwise, routes to the Find view with all of the category's place types as
 * a comma-separated venue_type param. The Find view's parseDestinationsQueryState
 * will auto-infer the correct tab from the venue types.
 */
export function buildSeeAllHref(
  portalSlug: string,
  category: PlacesToGoCategoryConfig
): string {
  if (category.seeAllTab) {
    return buildExploreUrl({
      portalSlug,
      lane: "places",
      extraParams: { tab: category.seeAllTab },
    });
  }
  return buildExploreUrl({
    portalSlug,
    lane: "places",
    extraParams: { venue_type: category.placeTypes.join(",") },
  });
}

/**
 * Chain venue name prefixes to filter out of the Places to Go section.
 * Lowercased for case-insensitive prefix matching.
 */
export const CHAIN_VENUE_PREFIXES: readonly string[] = [
  // Cinema chains
  "amc ",
  "regal ",
  // Fitness chains
  "planet fitness",
  "la fitness",
  "orangetheory",
  "lifetime fitness",
  "equinox ",
  "crunch ",
  "anytime fitness",
  // Paint-and-sip franchise chains — high event volume floods gallery rankings
  "painting with a twist",
  "paint nite",
  "muse paintbar",
  "pinot's palette",
  "board & brush",
  "wine & design",
  "upaint",
  "painting it forward",
  "sip and stroke",
];
import { buildExploreUrl } from "@/lib/find-url";
