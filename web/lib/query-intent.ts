/**
 * Query Intent Analysis
 *
 * Analyzes search queries to detect user intent and prioritize result types accordingly.
 * Helps provide more relevant search results by understanding what the user is looking for.
 */

export type QueryIntent =
  | "time" // User is looking for events at a specific time (tonight, this weekend)
  | "location" // User is looking for things in a specific location
  | "category" // User is looking for a specific category of events
  | "venue" // User is explicitly searching for venues
  | "organizer" // User is searching for an organizer/producer
  | "series" // User is searching for a recurring event or series
  | "general"; // No specific intent detected

export interface QueryIntentResult {
  intent: QueryIntent;
  confidence: number; // 0-1
  extractedValue?: string; // The matched term/phrase
  typePriority: SearchTypePriority;
  dateFilter?: "today" | "tonight" | "tomorrow" | "weekend" | "week";
  suggestions?: string[]; // Related search suggestions
}

export type SearchType = "event" | "venue" | "organizer" | "series" | "list" | "neighborhood" | "category" | "festival";

export type SearchTypePriority = {
  [K in SearchType]?: number; // Higher numbers = higher priority
};

// Time-related patterns
const TIME_PATTERNS: { pattern: RegExp; dateFilter: QueryIntentResult["dateFilter"]; variations: string[] }[] = [
  {
    pattern: /\b(tonight|tonite|this evening)\b/i,
    dateFilter: "tonight",
    variations: ["tonight", "this evening"],
  },
  {
    pattern: /\b(today|now|happening now|right now)\b/i,
    dateFilter: "today",
    variations: ["today", "now"],
  },
  {
    pattern: /\b(tomorrow|tmrw|tmw)\b/i,
    dateFilter: "tomorrow",
    variations: ["tomorrow"],
  },
  {
    pattern: /\b(this weekend|weekend|sat(urday)?|sun(day)?)\b/i,
    dateFilter: "weekend",
    variations: ["this weekend", "saturday", "sunday"],
  },
  {
    pattern: /\b(this week|next few days|upcoming)\b/i,
    dateFilter: "week",
    variations: ["this week", "upcoming"],
  },
];

// Location-related patterns
const LOCATION_PATTERNS: RegExp[] = [
  /\b(near|nearby|close to|around|in|at)\b/i,
  /\b(downtown|midtown|buckhead|east atlanta|west end|little five|l5p|virginia highland|va-?hi|inman park|grant park|old fourth ward|o4w|decatur|east point|kirkwood)\b/i,
];

// Category-related patterns and keywords
const CATEGORY_KEYWORDS: { pattern: RegExp; category: string }[] = [
  { pattern: /\b(live music|live show|live band|concert|band|show|live)\b/i, category: "music" },
  { pattern: /\b(comedy|standup|stand-up|improv|open mic)\b/i, category: "comedy" },
  { pattern: /\b(theater|theatre|play|musical|drama)\b/i, category: "theater" },
  { pattern: /\b(art|gallery|exhibit|exhibition|museum)\b/i, category: "art" },
  { pattern: /\b(film|movie|screening|cinema)\b/i, category: "film" },
  { pattern: /\b(sports|game|match|race)\b/i, category: "sports" },
  { pattern: /\b(food|drink|tasting|brunch|dinner)\b/i, category: "food_drink" },
  { pattern: /\b(nightlife|club|dj|dance|party)\b/i, category: "nightlife" },
  { pattern: /\b(community|meetup|networking|social)\b/i, category: "community" },
  { pattern: /\b(fitness|yoga|workout|run|class)\b/i, category: "fitness" },
  { pattern: /\b(family|kids|children|all ages)\b/i, category: "family" },
  { pattern: /\b(free|no cover|donation)\b/i, category: "free" },
];

// Venue search indicators
const VENUE_PATTERNS: RegExp[] = [
  /\b(venue|spot|place|bar|restaurant|club|theater|theatre|gallery|park)\b/i,
  /\b(where to|best place|good spot)\b/i,
];

// Organizer search indicators
const ORGANIZER_PATTERNS: RegExp[] = [
  /\b(organizer|producer|promoter|host|by|presented by)\b/i,
  /\b(who (runs|hosts|puts on))\b/i,
];

// Series/recurring event indicators
const SERIES_PATTERNS: RegExp[] = [
  /\b(series|recurring|weekly|monthly|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b/i,
  /\b(open mic|trivia night|karaoke|movie night)\b/i,
];

/**
 * Analyze a search query to determine user intent
 */
export function analyzeQueryIntent(query: string): QueryIntentResult {
  const trimmedQuery = query.trim().toLowerCase();

  if (!trimmedQuery || trimmedQuery.length < 2) {
    return {
      intent: "general",
      confidence: 0,
      typePriority: getDefaultPriority(),
    };
  }

  // Check for time-based queries first (highest priority)
  for (const { pattern, dateFilter, variations } of TIME_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "time",
        confidence: 0.9,
        extractedValue: variations[0],
        dateFilter,
        typePriority: {
          event: 100, // Events are primary for time queries
          series: 50,
          venue: 20,
          organizer: 10,
        },
        suggestions: variations.length > 1 ? variations.slice(1) : undefined,
      };
    }
  }

  // Check for venue-specific queries
  for (const pattern of VENUE_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "venue",
        confidence: 0.8,
        typePriority: {
          venue: 100,
          event: 40, // Still show events at matching venues
          neighborhood: 30,
          organizer: 10,
        },
      };
    }
  }

  // Check for organizer-specific queries
  for (const pattern of ORGANIZER_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "organizer",
        confidence: 0.8,
        typePriority: {
          organizer: 100,
          event: 50, // Show events by this organizer
          venue: 20,
        },
      };
    }
  }

  // Check for series/recurring event queries
  for (const pattern of SERIES_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "series",
        confidence: 0.85,
        typePriority: {
          series: 100,
          event: 60, // Show instances of the series
          venue: 30,
          organizer: 20,
        },
      };
    }
  }

  // Check for category queries
  for (const { pattern, category } of CATEGORY_KEYWORDS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "category",
        confidence: 0.75,
        extractedValue: category,
        typePriority: {
          event: 100,
          venue: 60, // Venues that host this category
          series: 50,
          organizer: 40,
        },
      };
    }
  }

  // Check for location-based queries
  for (const pattern of LOCATION_PATTERNS) {
    if (pattern.test(trimmedQuery)) {
      return {
        intent: "location",
        confidence: 0.7,
        typePriority: {
          venue: 80,
          event: 70,
          neighborhood: 60,
          organizer: 20,
        },
      };
    }
  }

  // Default to general search
  return {
    intent: "general",
    confidence: 0.5,
    typePriority: getDefaultPriority(),
  };
}

/**
 * Get default type priority for general searches
 */
function getDefaultPriority(): SearchTypePriority {
  return {
    event: 80, // Events are typically what users want
    venue: 70,
    festival: 60,
    organizer: 50,
    series: 40,
    list: 30,
    neighborhood: 20,
    category: 10,
  };
}

/**
 * Apply intent-based scoring boost to search results
 */
export function applyIntentBoost(
  baseScore: number,
  resultType: SearchType,
  intent: QueryIntentResult
): number {
  const priority = intent.typePriority[resultType] || 0;

  // Apply boost based on priority and confidence
  const boost = (priority / 100) * intent.confidence * 50;

  return baseScore + boost;
}

/**
 * Extract clean search terms after removing intent modifiers
 */
export function extractCleanQuery(query: string, intent: QueryIntentResult): string {
  let cleanQuery = query.trim();

  // Remove time modifiers
  if (intent.intent === "time" && intent.dateFilter) {
    for (const { pattern } of TIME_PATTERNS) {
      cleanQuery = cleanQuery.replace(pattern, "").trim();
    }
  }

  // Remove location modifiers
  if (intent.intent === "location") {
    cleanQuery = cleanQuery
      .replace(/\b(near|nearby|close to|around)\b/gi, "")
      .trim();
  }

  // Remove venue/organizer search indicators
  cleanQuery = cleanQuery
    .replace(/\b(venue|spot|place|where to|best place|good spot)\b/gi, "")
    .replace(/\b(organizer|producer|promoter|host|presented by)\b/gi, "")
    .trim();

  return cleanQuery || query.trim();
}

/**
 * Get related search suggestions based on intent
 */
export function getIntentSuggestions(intent: QueryIntentResult, query: string): string[] {
  const suggestions: string[] = [];

  switch (intent.intent) {
    case "time":
      // Suggest category variations with time
      suggestions.push(
        `${intent.extractedValue} live music`,
        `${intent.extractedValue} comedy`,
        `${intent.extractedValue} free events`
      );
      break;

    case "category":
      // Suggest time variations with category
      if (intent.extractedValue) {
        suggestions.push(
          `${intent.extractedValue} tonight`,
          `${intent.extractedValue} this weekend`,
          `free ${intent.extractedValue}`
        );
      }
      break;

    case "location":
      // Suggest popular nearby categories
      suggestions.push(`${query} bars`, `${query} music`, `${query} restaurants`);
      break;

    default:
      // General suggestions based on query
      suggestions.push(`${query} tonight`, `${query} near me`, `free ${query}`);
  }

  return suggestions.slice(0, 3);
}

/**
 * Check if a query is likely a typo and needs correction
 */
export function isPotentialTypo(query: string): boolean {
  const trimmed = query.trim().toLowerCase();

  // Common typo patterns
  const typoPatterns = [
    /comdy/i, // comedy
    /musci/i, // music
    /concrt/i, // concert
    /theatr(?!e)/i, // theater
    /dnace/i, // dance
    /pary/i, // party
  ];

  return typoPatterns.some((p) => p.test(trimmed));
}
