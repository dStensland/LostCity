/**
 * Context-Aware Search Ranking
 *
 * Provides boost factors for search results based on:
 * 1. Current navigation context (view mode, find type)
 * 2. User preferences (followed orgs, venues, categories)
 * 3. Query intent analysis
 */

import type { ViewMode, FindType, UserPreferences } from "./search-context";
import type { SearchResult } from "./unified-search";

// ============================================
// Types
// ============================================

export interface SearchContext {
  viewMode: ViewMode;
  findType: FindType;
  portalSlug?: string;
  portalId?: string;
  userPreferences?: UserPreferences;
}

export interface QuickAction {
  id: string;
  label: string;
  description: string;
  icon: "category" | "time" | "free" | "neighborhood" | "filter";
  /** URL params to apply when action is selected */
  params: Record<string, string>;
  /** Full URL path */
  url: string;
}

export type ResultType = SearchResult["type"];

// ============================================
// Context Boost Configuration
// ============================================

/**
 * Boost factors for result types based on current view context.
 * Higher numbers = higher priority in results.
 */
type FindTypeKey = "events" | "classes" | "destinations" | "default";

const CONTEXT_BOOSTS: Record<
  ViewMode,
  Record<FindTypeKey, Record<ResultType, number>>
> = {
  feed: {
    default: {
      event: 10,
      venue: 10,
      organizer: 10,
      series: 8,
      list: 5,
      neighborhood: 3,
      category: 2,
    },
    events: { event: 10, venue: 10, organizer: 10, series: 8, list: 5, neighborhood: 3, category: 2 },
    classes: { event: 10, venue: 10, organizer: 10, series: 8, list: 5, neighborhood: 3, category: 2 },
    destinations: { event: 10, venue: 10, organizer: 10, series: 8, list: 5, neighborhood: 3, category: 2 },
  },
  find: {
    default: {
      event: 20,
      venue: 15,
      organizer: 10,
      series: 10,
      list: 5,
      neighborhood: 8,
      category: 8,
    },
    events: {
      event: 30,
      venue: 10, // Venues are still useful for filtering
      organizer: 10,
      series: 15,
      list: 5,
      neighborhood: 10,
      category: 10,
    },
    destinations: {
      venue: 30,
      event: 10, // Events at venues still relevant
      organizer: 5,
      series: 5,
      list: 5,
      neighborhood: 15,
      category: 5,
    },
    classes: {
      event: 25, // Classes are events
      venue: 20, // Studios/venues offering classes
      organizer: 15,
      series: 15,
      list: 5,
      neighborhood: 10,
      category: 10,
    },
  },
  community: {
    default: {
      organizer: 25,
      list: 20,
      event: 10,
      venue: 5,
      series: 10,
      neighborhood: 3,
      category: 3,
    },
    events: { organizer: 25, list: 20, event: 10, venue: 5, series: 10, neighborhood: 3, category: 3 },
    classes: { organizer: 25, list: 20, event: 10, venue: 5, series: 10, neighborhood: 3, category: 3 },
    destinations: { organizer: 25, list: 20, event: 10, venue: 5, series: 10, neighborhood: 3, category: 3 },
  },
};

// Personalization boost factors
const PERSONALIZATION_BOOSTS = {
  followedOrganizer: 20,
  followedVenue: 15,
  favoriteCategory: 10,
};

// ============================================
// Ranking Functions
// ============================================

/**
 * Get the context boost for a result type based on current navigation state.
 */
export function getContextBoost(
  resultType: ResultType,
  context: SearchContext
): number {
  const viewBoosts = CONTEXT_BOOSTS[context.viewMode];
  const findTypeKey: FindTypeKey = context.findType || "default";
  const typeBoosts = viewBoosts[findTypeKey] || viewBoosts.default;

  return typeBoosts[resultType] || 0;
}

/**
 * Get personalization boost for a result based on user preferences.
 */
export function getPersonalizationBoost(
  result: SearchResult,
  userPreferences?: UserPreferences
): { boost: number; reason?: string } {
  if (!userPreferences) {
    return { boost: 0 };
  }

  // Check if result is from followed organizer
  if (result.type === "organizer") {
    if (userPreferences.followedOrganizers.includes(String(result.id))) {
      return {
        boost: PERSONALIZATION_BOOSTS.followedOrganizer,
        reason: "From followed",
      };
    }
  }

  // Check if result is event by followed organizer (would need metadata)
  // This would require organizer_id in event metadata

  // Check if result is at followed venue
  if (result.type === "venue") {
    if (userPreferences.followedVenues.includes(Number(result.id))) {
      return {
        boost: PERSONALIZATION_BOOSTS.followedVenue,
        reason: "Followed venue",
      };
    }
  }

  // Check if result matches favorite category
  if (result.metadata?.category) {
    if (userPreferences.favoriteCategories.includes(result.metadata.category)) {
      return {
        boost: PERSONALIZATION_BOOSTS.favoriteCategory,
        reason: "Favorite category",
      };
    }
  }

  return { boost: 0 };
}

/**
 * Apply all boosts to a search result score.
 */
export function applyAllBoosts(
  result: SearchResult,
  context: SearchContext
): SearchResult & { personalizationReason?: string } {
  let newScore = result.score;

  // Apply context boost
  newScore += getContextBoost(result.type, context);

  // Apply personalization boost
  const personalization = getPersonalizationBoost(result, context.userPreferences);
  newScore += personalization.boost;

  return {
    ...result,
    score: newScore,
    personalizationReason: personalization.reason,
  };
}

/**
 * Sort and rank results with context and personalization.
 */
export function rankResults(
  results: SearchResult[],
  context: SearchContext
): (SearchResult & { personalizationReason?: string })[] {
  return results
    .map((result) => applyAllBoosts(result, context))
    .sort((a, b) => b.score - a.score);
}

// ============================================
// Quick Actions
// ============================================

/**
 * Category patterns for quick action detection
 */
const CATEGORY_PATTERNS: { pattern: RegExp; category: string; label: string }[] = [
  { pattern: /\bjazz\b/i, category: "music", label: "jazz" },
  { pattern: /\bcomedy\b/i, category: "comedy", label: "comedy" },
  { pattern: /\blive music\b/i, category: "music", label: "live music" },
  { pattern: /\bmusic\b/i, category: "music", label: "music" },
  { pattern: /\bart\b/i, category: "art", label: "art" },
  { pattern: /\bfilm\b/i, category: "film", label: "film" },
  { pattern: /\btheater\b/i, category: "theater", label: "theater" },
  { pattern: /\btheatre\b/i, category: "theater", label: "theatre" },
  { pattern: /\bsports\b/i, category: "sports", label: "sports" },
  { pattern: /\bfood\b/i, category: "food_drink", label: "food" },
  { pattern: /\bdrink\b/i, category: "food_drink", label: "drinks" },
  { pattern: /\bnightlife\b/i, category: "nightlife", label: "nightlife" },
  { pattern: /\bdj\b/i, category: "nightlife", label: "DJ" },
  { pattern: /\bfitness\b/i, category: "fitness", label: "fitness" },
  { pattern: /\byoga\b/i, category: "fitness", label: "yoga" },
  { pattern: /\bkids\b/i, category: "family", label: "kids" },
  { pattern: /\bfamily\b/i, category: "family", label: "family" },
];

/**
 * Time patterns for quick action detection
 */
const TIME_PATTERNS: { pattern: RegExp; dateFilter: string; label: string }[] = [
  { pattern: /\btonight\b/i, dateFilter: "tonight", label: "tonight" },
  { pattern: /\btoday\b/i, dateFilter: "today", label: "today" },
  { pattern: /\btomorrow\b/i, dateFilter: "tomorrow", label: "tomorrow" },
  { pattern: /\bweekend\b/i, dateFilter: "weekend", label: "this weekend" },
  { pattern: /\bthis week\b/i, dateFilter: "week", label: "this week" },
];

/**
 * Detect and generate quick actions based on query.
 */
export function detectQuickActions(
  query: string,
  portalSlug: string
): QuickAction[] {
  const trimmedQuery = query.trim().toLowerCase();
  if (!trimmedQuery || trimmedQuery.length < 2) {
    return [];
  }

  const actions: QuickAction[] = [];
  const baseUrl = `/${portalSlug}?view=find&type=events`;

  // Check for "free" intent
  if (/\bfree\b/i.test(trimmedQuery)) {
    actions.push({
      id: "free-events",
      label: "Free events this week",
      description: "Show all free events happening this week",
      icon: "free",
      params: { free: "true", date: "week" },
      url: `${baseUrl}&free=true&date=week`,
    });
  }

  // Check for category intent
  for (const { pattern, category, label } of CATEGORY_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      actions.push({
        id: `category-${category}`,
        label: `Show all ${label} events`,
        description: `Browse ${label} events in your area`,
        icon: "category",
        params: { categories: category },
        url: `${baseUrl}&categories=${category}`,
      });
      break; // Only add one category action
    }
  }

  // Check for time intent
  for (const { pattern, dateFilter, label } of TIME_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      actions.push({
        id: `time-${dateFilter}`,
        label: `Events ${label}`,
        description: `See what's happening ${label}`,
        icon: "time",
        params: { date: dateFilter },
        url: `${baseUrl}&date=${dateFilter}`,
      });
      break; // Only add one time action
    }
  }

  // Neighborhood detection (common Atlanta neighborhoods)
  const NEIGHBORHOODS = [
    "midtown",
    "downtown",
    "buckhead",
    "east atlanta",
    "little five",
    "l5p",
    "virginia highland",
    "va-hi",
    "inman park",
    "grant park",
    "west end",
    "old fourth ward",
    "o4w",
    "decatur",
    "kirkwood",
    "east point",
    "cabbagetown",
    "reynoldstown",
    "edgewood",
    "poncey-highland",
  ];

  for (const neighborhood of NEIGHBORHOODS) {
    if (trimmedQuery.includes(neighborhood)) {
      const displayName = neighborhood
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");
      actions.push({
        id: `neighborhood-${neighborhood}`,
        label: `Events in ${displayName}`,
        description: `Browse events in ${displayName}`,
        icon: "neighborhood",
        params: { neighborhoods: neighborhood },
        url: `${baseUrl}&neighborhoods=${encodeURIComponent(neighborhood)}`,
      });
      break; // Only add one neighborhood action
    }
  }

  // Limit to 3 quick actions max
  return actions.slice(0, 3);
}

/**
 * Group search results by type for display.
 */
export function groupResultsByType(
  results: SearchResult[]
): Record<ResultType, SearchResult[]> {
  const groups: Record<ResultType, SearchResult[]> = {
    event: [],
    venue: [],
    organizer: [],
    series: [],
    list: [],
    neighborhood: [],
    category: [],
  };

  for (const result of results) {
    groups[result.type].push(result);
  }

  return groups;
}

/**
 * Get display order for result groups based on context.
 */
export function getGroupDisplayOrder(context: SearchContext): ResultType[] {
  if (context.viewMode === "find") {
    switch (context.findType) {
      case "events":
        return ["event", "venue", "organizer", "series", "neighborhood", "category", "list"];
      case "destinations":
        return ["venue", "neighborhood", "event", "organizer", "series", "category", "list"];
      case "classes":
        return ["event", "venue", "organizer", "series", "neighborhood", "category", "list"];
    }
  }

  if (context.viewMode === "community") {
    return ["organizer", "list", "event", "venue", "series", "neighborhood", "category"];
  }

  // Feed: balanced display
  return ["event", "venue", "organizer", "series", "list", "neighborhood", "category"];
}
