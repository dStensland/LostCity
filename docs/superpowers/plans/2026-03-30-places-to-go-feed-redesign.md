# Places to Go Feed Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the BrowseSection's static tile grid with 12 expandable jeweltone category tiles that show contextually-selected place cards with vertical-specific callouts.

**Architecture:** Single self-fetching API endpoint computes all 12 categories server-side (1 main query + 3 parallel secondary queries). Three pure-function modules (constants, scoring, callouts) keep the route handler thin. Three UI components (Section, Tile, Card) render the grid with expand/collapse interaction.

**Tech Stack:** Next.js 16, Supabase Postgres, React Query, Tailwind v4, vitest

**Spec:** `docs/superpowers/specs/2026-03-30-places-to-go-feed-redesign.md`

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `web/lib/places-to-go/constants.ts` | Category definitions, accent colors, icons, place_type mappings, see-all routing |
| `web/lib/places-to-go/scoring.ts` | `scorePlaceForCategory()` pure function + `passesQualityGate()` |
| `web/lib/places-to-go/callouts.ts` | `CALLOUT_CONFIG`, `buildCallouts()`, `buildSummary()` — data-driven cascade |
| `web/lib/places-to-go/types.ts` | Shared types: `PlacesToGoCategory`, `PlacesToGoCard`, response interfaces |
| `web/lib/places-to-go/scoring.test.ts` | Scoring unit tests |
| `web/lib/places-to-go/callouts.test.ts` | Callout + summary cascade tests |
| `web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts` | API route orchestrator |
| `web/components/feed/sections/PlacesToGoSection.tsx` | Section wrapper, grid, expand state, useQuery fetch |
| `web/components/feed/sections/PlacesToGoCategoryTile.tsx` | Single tile (collapsed + expanded) |
| `web/components/feed/sections/PlacesToGoCard.tsx` | Compact place card inside expanded tile |

### Modified files
| File | Change |
|------|--------|
| `web/components/feed/CityPulseShell.tsx` | Add PlacesToGoSection render, remove browse block |
| `web/components/feed/CityPulseSection.tsx` | Remove `case "browse"` and `case "experiences"` |

### Deleted files (cleanup task)
| File | Reason |
|------|--------|
| `web/components/feed/sections/BrowseSection.tsx` | Replaced by PlacesToGoSection |
| `web/components/feed/sections/BrowseGridTile.tsx` | Replaced by PlacesToGoCategoryTile |
| `web/components/feed/sections/ExperiencesSection.tsx` | Dead code, never rendered |
| `web/app/api/portals/[slug]/city-pulse/experiences/route.ts` | Replaced by places-to-go route |

---

## Task 1: Constants & Types

**Files:**
- Create: `web/lib/places-to-go/types.ts`
- Create: `web/lib/places-to-go/constants.ts`

- [ ] **Step 1: Create types file**

```typescript
// web/lib/places-to-go/types.ts

export interface PlacesToGoCategoryConfig {
  key: string;
  label: string;
  placeTypes: readonly string[];
  accentColor: string;
  iconType: string;
  seeAllTab?: string;        // "eat-drink" for restaurants/bars — uses ?view=places&tab=X
}

export interface PlacesToGoCategory {
  key: string;
  label: string;
  accent_color: string;
  icon_type: string;
  count: number;
  summary: string;
  has_activity_today: boolean;
  places: PlacesToGoCard[];
  see_all_href: string;
}

export interface PlacesToGoCard {
  id: number;
  name: string;
  slug: string;
  image_url: string | null;
  neighborhood: string | null;
  is_open: boolean | null;
  callouts: string[];
  event_count: number;
  href: string;
}

export interface PlacesToGoResponse {
  categories: PlacesToGoCategory[];
}

/** Context passed to scoring and callout functions for each place */
export interface PlaceContext {
  placeId: number;
  categoryKey: string;
  // Weather
  weatherMatch: boolean;
  seasonMatch: boolean;
  timeOfDayMatch: boolean;
  // Activity
  eventsToday: number;
  eventsThisWeek: number;
  hasActiveSpecial: boolean;
  todayEventTitle: string | null;   // for "Tonight: [show]" callouts
  // Quality
  hasImage: boolean;
  hasDescription: boolean;
  isFeatured: boolean;
  occasionCount: number;
  // Data fields for callouts
  occasions: string[];
  vibes: string[];
  cuisine: string[];
  neighborhood: string | null;
  nearestMarta: string | null;
  difficulty: string | null;
  driveTimeMinutes: number | null;
  bestSeasons: string[];
  weatherFitTags: string[];
  shortDescription: string | null;
  libraryPass: boolean;
  isNew: boolean;                   // created < 30 days
  specialTitle: string | null;      // for "Happy hour til 7" callouts
  specialTimeEnd: string | null;
  indoorOutdoor: string | null;
  // Dates
  createdDaysAgo: number;
  hasNewEventsThisWeek: boolean;
}
```

- [ ] **Step 2: Create constants file**

```typescript
// web/lib/places-to-go/constants.ts

import type { PlacesToGoCategoryConfig } from "./types";

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
    placeTypes: ["bar", "brewery", "cocktail_bar", "wine_bar", "rooftop", "lounge", "sports_bar", "nightclub", "club", "distillery", "winery"],
    accentColor: "#E879F9",
    iconType: "nightlife",
    seeAllTab: "eat-drink",
  },
  {
    key: "markets_local",
    label: "Markets & Local Finds",
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
    placeTypes: ["arcade", "escape_room", "eatertainment", "bowling", "pool_hall", "recreation", "karaoke", "theme_park", "attraction"],
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

/** All place_types across all categories — used for the main query filter */
export const ALL_PLACES_TO_GO_TYPES: string[] = PLACES_TO_GO_CATEGORIES.flatMap(
  (c) => [...c.placeTypes],
);

/** Map from place_type to category key — for bucketing query results */
export function getCategoryKeyForPlaceType(placeType: string): string | null {
  for (const cat of PLACES_TO_GO_CATEGORIES) {
    if (cat.placeTypes.includes(placeType)) return cat.key;
  }
  return null;
}

/** Build the "see all" href for a category */
export function buildSeeAllHref(
  portalSlug: string,
  category: PlacesToGoCategoryConfig,
): string {
  if (category.seeAllTab) {
    return `/${portalSlug}?view=places&tab=${category.seeAllTab}`;
  }
  return `/${portalSlug}?view=places&venue_type=${category.placeTypes[0]}`;
}

/** Chain venue name prefixes to filter out (from experiences route) */
export const CHAIN_VENUE_PREFIXES = [
  "amc ", "regal ", "planet fitness", "la fitness", "orangetheory",
  "lifetime fitness", "equinox ", "crunch ", "anytime fitness",
];
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors from the new files

- [ ] **Step 4: Commit**

```bash
git add web/lib/places-to-go/types.ts web/lib/places-to-go/constants.ts
git commit -m "feat(places-to-go): add category constants and types"
```

---

## Task 2: Scoring Module + Tests

**Files:**
- Create: `web/lib/places-to-go/scoring.ts`
- Create: `web/lib/places-to-go/scoring.test.ts`

- [ ] **Step 1: Write the scoring tests**

```typescript
// web/lib/places-to-go/scoring.test.ts

import { describe, it, expect } from "vitest";
import { scorePlaceForCategory, passesQualityGate } from "./scoring";
import type { PlaceContext } from "./types";

function makeContext(overrides: Partial<PlaceContext> = {}): PlaceContext {
  return {
    placeId: 1,
    categoryKey: "parks_gardens",
    weatherMatch: false,
    seasonMatch: false,
    timeOfDayMatch: false,
    eventsToday: 0,
    eventsThisWeek: 0,
    hasActiveSpecial: false,
    todayEventTitle: null,
    hasImage: true,
    hasDescription: true,
    isFeatured: false,
    occasionCount: 0,
    occasions: [],
    vibes: [],
    cuisine: [],
    neighborhood: null,
    nearestMarta: null,
    difficulty: null,
    driveTimeMinutes: null,
    bestSeasons: [],
    weatherFitTags: [],
    shortDescription: null,
    libraryPass: false,
    isNew: false,
    specialTitle: null,
    specialTimeEnd: null,
    indoorOutdoor: null,
    createdDaysAgo: 365,
    hasNewEventsThisWeek: false,
    ...overrides,
  };
}

describe("scorePlaceForCategory", () => {
  it("returns base quality score for a place with image + description", () => {
    const score = scorePlaceForCategory(makeContext());
    // image: 8 + description: 5 = 13
    expect(score).toBe(13);
  });

  it("adds weather match points", () => {
    const score = scorePlaceForCategory(makeContext({ weatherMatch: true }));
    // 13 base + 20 weather = 33
    expect(score).toBe(33);
  });

  it("caps events today at 30 points", () => {
    const score = scorePlaceForCategory(makeContext({ eventsToday: 5 }));
    // 13 base + 30 (capped) = 43
    expect(score).toBe(43);
  });

  it("caps events this week at 20 points", () => {
    const score = scorePlaceForCategory(makeContext({ eventsThisWeek: 10 }));
    // 13 base + 20 (capped) = 33
    expect(score).toBe(33);
  });

  it("adds active specials bonus", () => {
    const score = scorePlaceForCategory(makeContext({ hasActiveSpecial: true }));
    expect(score).toBe(23); // 13 + 10
  });

  it("adds featured flag points", () => {
    const score = scorePlaceForCategory(makeContext({ isFeatured: true }));
    expect(score).toBe(18); // 13 + 5
  });

  it("adds occasion count bonus for 3+ occasions", () => {
    const score = scorePlaceForCategory(makeContext({ occasionCount: 4 }));
    expect(score).toBe(15); // 13 + 2
  });

  it("adds recency bonus for new places (< 30 days)", () => {
    const score = scorePlaceForCategory(makeContext({ isNew: true, createdDaysAgo: 15 }));
    expect(score).toBe(23); // 13 + 10
  });

  it("adds smaller recency bonus for 30-90 day old places", () => {
    const score = scorePlaceForCategory(makeContext({ createdDaysAgo: 60 }));
    expect(score).toBe(18); // 13 + 5
  });

  it("combines all scoring dimensions", () => {
    const score = scorePlaceForCategory(makeContext({
      weatherMatch: true,     // +20
      timeOfDayMatch: true,   // +10
      seasonMatch: true,      // +10
      eventsToday: 1,         // +15
      eventsThisWeek: 2,      // +10
      hasActiveSpecial: true, // +10
      hasImage: true,         // +8
      hasDescription: true,   // +5
      isFeatured: true,       // +5
      occasionCount: 5,       // +2
      isNew: true,            // +10
      createdDaysAgo: 5,      // (covered by isNew)
    }));
    // contextual: 40, activity: 30 (capped), quality: 20, recency: 10 = 100
    expect(score).toBe(100);
  });
});

describe("passesQualityGate", () => {
  it("passes with image", () => {
    expect(passesQualityGate(makeContext({ hasImage: true, hasDescription: false }))).toBe(true);
  });

  it("passes with description", () => {
    expect(passesQualityGate(makeContext({ hasImage: false, hasDescription: true }))).toBe(true);
  });

  it("fails with neither image nor description", () => {
    expect(passesQualityGate(makeContext({ hasImage: false, hasDescription: false }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/places-to-go/scoring.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the scoring implementation**

```typescript
// web/lib/places-to-go/scoring.ts

import type { PlaceContext } from "./types";

export function scorePlaceForCategory(ctx: PlaceContext): number {
  let score = 0;

  // Contextual fit (0-40)
  if (ctx.weatherMatch) score += 20;
  if (ctx.timeOfDayMatch) score += 10;
  if (ctx.seasonMatch) score += 10;

  // Activity boost (0-30)
  score += Math.min(ctx.eventsToday * 15, 30);
  score += Math.min(ctx.eventsThisWeek * 5, 20);
  // Cap activity at 30 total
  const activityRaw = Math.min(ctx.eventsToday * 15, 30) + Math.min(ctx.eventsThisWeek * 5, 20);
  // Undo the double-count and apply capped total
  score -= activityRaw;
  score += Math.min(activityRaw, 30);
  if (ctx.hasActiveSpecial) score += 10;
  // Re-cap entire activity bucket
  const activityTotal = Math.min(activityRaw, 30) + (ctx.hasActiveSpecial ? 10 : 0);
  score -= (Math.min(activityRaw, 30) + (ctx.hasActiveSpecial ? 10 : 0));
  score += Math.min(activityTotal, 30);

  // Quality floor (0-20)
  if (ctx.hasImage) score += 8;
  if (ctx.hasDescription) score += 5;
  if (ctx.isFeatured) score += 5;
  if (ctx.occasionCount >= 3) score += 2;

  // Recency bonus (0-10)
  if (ctx.isNew && ctx.createdDaysAgo < 30) {
    score += 10;
  } else if (ctx.createdDaysAgo < 90) {
    score += 5;
  }
  if (ctx.hasNewEventsThisWeek) score += 3;
  // Cap recency at 10
  // (the max from the above is 13, so cap it)

  return score;
}

export function passesQualityGate(ctx: PlaceContext): boolean {
  return ctx.hasImage || ctx.hasDescription;
}
```

Wait — the test expectations are based on simpler math. Let me simplify the scoring to match. The spec says each bucket has a max, but individual items within each bucket stack. Let me rewrite to be cleaner:

```typescript
// web/lib/places-to-go/scoring.ts

import type { PlaceContext } from "./types";

export function scorePlaceForCategory(ctx: PlaceContext): number {
  // Contextual fit (0-40)
  const contextual =
    (ctx.weatherMatch ? 20 : 0) +
    (ctx.timeOfDayMatch ? 10 : 0) +
    (ctx.seasonMatch ? 10 : 0);

  // Activity boost (0-30)
  const eventsToday = Math.min(ctx.eventsToday * 15, 30);
  const eventsWeek = Math.min(ctx.eventsThisWeek * 5, 20);
  const specials = ctx.hasActiveSpecial ? 10 : 0;
  const activity = Math.min(eventsToday + eventsWeek + specials, 30);

  // Quality floor (0-20)
  const quality =
    (ctx.hasImage ? 8 : 0) +
    (ctx.hasDescription ? 5 : 0) +
    (ctx.isFeatured ? 5 : 0) +
    (ctx.occasionCount >= 3 ? 2 : 0);

  // Recency bonus (0-10)
  let recency = 0;
  if (ctx.isNew && ctx.createdDaysAgo < 30) recency += 10;
  else if (ctx.createdDaysAgo < 90) recency += 5;
  if (ctx.hasNewEventsThisWeek) recency += 3;
  recency = Math.min(recency, 10);

  return contextual + activity + quality + recency;
}

export function passesQualityGate(ctx: PlaceContext): boolean {
  return ctx.hasImage || ctx.hasDescription;
}
```

Hmm, but the test expects `eventsToday: 5` to yield score 43 (13 base + 30). With the cap at 30 for the whole activity bucket, `eventsToday: 5` = `min(75, 30)` = 30. 13 + 30 = 43. That works.

And `eventsThisWeek: 10` = `min(50, 20)` = 20, then activity = `min(20, 30)` = 20. 13 + 20 = 33. That works.

And `hasActiveSpecial: true` alone = `min(0 + 0 + 10, 30)` = 10. 13 + 10 = 23. Works.

The "combines all" test: contextual = 40, activity = `min(15 + 10 + 10, 30)` = 30, quality = 8+5+5+2 = 20, recency = min(10+3, 10) = 10. Total = 100. Works.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/places-to-go/scoring.test.ts 2>&1 | tail -15`
Expected: All 11 tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/lib/places-to-go/scoring.ts web/lib/places-to-go/scoring.test.ts
git commit -m "feat(places-to-go): add scoring module with tests"
```

---

## Task 3: Callout & Summary Builders + Tests

**Files:**
- Create: `web/lib/places-to-go/callouts.ts`
- Create: `web/lib/places-to-go/callouts.test.ts`

- [ ] **Step 1: Write the callout tests**

```typescript
// web/lib/places-to-go/callouts.test.ts

import { describe, it, expect } from "vitest";
import { buildCallouts, buildSummary } from "./callouts";
import type { PlaceContext } from "./types";

function makeContext(overrides: Partial<PlaceContext> = {}): PlaceContext {
  return {
    placeId: 1,
    categoryKey: "parks_gardens",
    weatherMatch: false,
    seasonMatch: false,
    timeOfDayMatch: false,
    eventsToday: 0,
    eventsThisWeek: 0,
    hasActiveSpecial: false,
    todayEventTitle: null,
    hasImage: true,
    hasDescription: true,
    isFeatured: false,
    occasionCount: 0,
    occasions: [],
    vibes: [],
    cuisine: [],
    neighborhood: null,
    nearestMarta: null,
    difficulty: null,
    driveTimeMinutes: null,
    bestSeasons: [],
    weatherFitTags: [],
    shortDescription: null,
    libraryPass: false,
    isNew: false,
    specialTitle: null,
    specialTimeEnd: null,
    indoorOutdoor: null,
    createdDaysAgo: 365,
    hasNewEventsThisWeek: false,
    ...overrides,
  };
}

describe("buildCallouts", () => {
  it("returns time-sensitive callout first when available", () => {
    const result = buildCallouts("parks_gardens", makeContext({ weatherMatch: true }));
    expect(result[0]).toBe("Great weather today");
  });

  it("falls through to activity when no time-sensitive data", () => {
    const result = buildCallouts("parks_gardens", makeContext({ eventsThisWeek: 3 }));
    expect(result[0]).toBe("3 events this week");
  });

  it("falls through to static when no time-sensitive or activity data", () => {
    const result = buildCallouts("parks_gardens", makeContext({
      occasions: ["dog_friendly"],
    }));
    expect(result[0]).toBe("Dog-friendly");
  });

  it("returns max 2 callouts", () => {
    const result = buildCallouts("parks_gardens", makeContext({
      weatherMatch: true,
      eventsThisWeek: 5,
      occasions: ["dog_friendly", "family_friendly"],
    }));
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it("returns tonight event title for theaters", () => {
    const result = buildCallouts("theaters_stage", makeContext({
      categoryKey: "theaters_stage",
      todayEventTitle: "Hamilton",
      eventsToday: 1,
    }));
    expect(result[0]).toBe("Tonight: Hamilton");
  });

  it("returns vibes for music venues as static fallback", () => {
    const result = buildCallouts("music_venues", makeContext({
      categoryKey: "music_venues",
      vibes: ["divey", "intimate"],
    }));
    expect(result).toContain("Divey");
  });

  it("returns cuisine for restaurants as static fallback", () => {
    const result = buildCallouts("restaurants", makeContext({
      categoryKey: "restaurants",
      cuisine: ["southern", "bbq"],
    }));
    expect(result[0]).toBe("Southern");
  });

  it("returns difficulty + drive time for trails", () => {
    const result = buildCallouts("trails_nature", makeContext({
      categoryKey: "trails_nature",
      difficulty: "moderate",
      driveTimeMinutes: 45,
    }));
    expect(result).toContain("Moderate");
    expect(result).toContain("45 min drive");
  });

  it("returns empty array when no data available at all", () => {
    const result = buildCallouts("historic_sites", makeContext({
      categoryKey: "historic_sites",
    }));
    // Should still work — may return empty or a generic fallback
    expect(Array.isArray(result)).toBe(true);
  });

  it("handles every category key without throwing", () => {
    const keys = [
      "parks_gardens", "trails_nature", "museums", "galleries_studios",
      "theaters_stage", "music_venues", "restaurants", "bars_nightlife",
      "markets_local", "libraries_learning", "fun_games", "historic_sites",
    ];
    for (const key of keys) {
      expect(() => buildCallouts(key, makeContext({ categoryKey: key }))).not.toThrow();
    }
  });
});

describe("buildSummary", () => {
  it("returns weather summary for parks when weather matches", () => {
    const result = buildSummary("parks_gardens", { weatherMatchCount: 8, totalCount: 52 });
    expect(result).toBe("8 match today's weather");
  });

  it("falls back to activity summary", () => {
    const result = buildSummary("theaters_stage", {
      eventsTonight: 5,
      eventsThisWeek: 14,
      venueCountWithEvents: 8,
      totalCount: 120,
    });
    expect(result).toBe("5 shows tonight");
  });

  it("falls back to static summary", () => {
    const result = buildSummary("trails_nature", {
      totalCount: 57,
      withinDriveTime: 12,
      easyCount: 4,
    });
    expect(result).toBe("12 within 45 min");
  });

  it("handles every category key without throwing", () => {
    const keys = [
      "parks_gardens", "trails_nature", "museums", "galleries_studios",
      "theaters_stage", "music_venues", "restaurants", "bars_nightlife",
      "markets_local", "libraries_learning", "fun_games", "historic_sites",
    ];
    for (const key of keys) {
      expect(() => buildSummary(key, { totalCount: 10 })).not.toThrow();
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/places-to-go/callouts.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Write the callout implementation**

Create `web/lib/places-to-go/callouts.ts`. This file has two exports:
- `buildCallouts(categoryKey, placeContext)` — returns `string[]` (max 2) for a single place card
- `buildSummary(categoryKey, categorySummaryData)` — returns `string` for the collapsed tile

The callout builder uses a data-driven config per category. Each category has `timeSensitive`, `activity`, and `static` rule arrays. The `buildCallouts` function walks the cascade: check time-sensitive rules first, then activity, then static. Stop after collecting 2 callouts.

The summary builder uses a similar cascade but operates on aggregate category-level data (counts across all places in the category), not individual place data.

Implementation should be ~150-200 lines. The key design principle: each rule is a `{ check, emit }` pair where `check` returns boolean and `emit` returns the string. This makes adding new categories or callout rules a config change, not a code change.

Capitalize the first letter of vibes/cuisine/difficulty when emitting (e.g., "divey" -> "Divey", "southern" -> "Southern", "moderate" -> "Moderate").

For the `buildSummary` function, accept a flexible `Record<string, number | undefined>` stats object so each category can pass the aggregate stats it needs without a rigid interface.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/places-to-go/callouts.test.ts 2>&1 | tail -15`
Expected: All tests PASS

- [ ] **Step 5: Run all places-to-go tests together**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run lib/places-to-go/ 2>&1 | tail -15`
Expected: All scoring + callout tests PASS

- [ ] **Step 6: Commit**

```bash
git add web/lib/places-to-go/callouts.ts web/lib/places-to-go/callouts.test.ts
git commit -m "feat(places-to-go): add callout and summary builders with tests"
```

---

## Task 4: API Route

**Files:**
- Create: `web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts`

**Reference:** Copy patterns from `web/app/api/portals/[slug]/city-pulse/experiences/route.ts`

- [ ] **Step 1: Create the API route**

The route handler is an orchestrator. It:
1. Rate-limits, resolves portal slug, checks cache
2. Fetches weather from `/api/weather/current`
3. Runs main places query (all active places matching any category's place_types, with FK joins)
4. Runs 3 parallel secondary queries (events, specials, occasions)
5. Buckets places into categories
6. For each category: scores places, selects top 3, builds callouts, builds summary
7. Returns response, sets cache

Key imports to copy from experiences route:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient, createPortalScopedClient } from "@/lib/supabase/server";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { normalizePortalSlug, resolvePortalSlugAlias } from "@/lib/portal-aliases";
import { buildPortalManifest } from "@/lib/portal-manifest";
import { applyManifestFederatedScopeToQuery } from "@/lib/portal-scope";
import { getPortalSourceAccess } from "@/lib/federation";
import { getLocalDateString } from "@/lib/formats";
import { getSharedCacheJson, setSharedCacheJson } from "@/lib/shared-cache";
import { applyFeedGate } from "@/lib/feed-gate";
import { isOpenAt } from "@/lib/hours";
import type { CurrentWeatherResponse } from "@/app/api/weather/current/route";
```

Plus the new modules:
```typescript
import { PLACES_TO_GO_CATEGORIES, ALL_PLACES_TO_GO_TYPES, getCategoryKeyForPlaceType, buildSeeAllHref, CHAIN_VENUE_PREFIXES } from "@/lib/places-to-go/constants";
import { scorePlaceForCategory, passesQualityGate } from "@/lib/places-to-go/scoring";
import { buildCallouts, buildSummary } from "@/lib/places-to-go/callouts";
import type { PlacesToGoResponse, PlacesToGoCategory, PlacesToGoCard, PlaceContext } from "@/lib/places-to-go/types";
```

Cache config:
```typescript
const CACHE_NAMESPACE = "places-to-go";
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_CONTROL = "public, s-maxage=300, stale-while-revalidate=3600";

function getTimeSlot(hour: number): string {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  if (hour < 21) return "evening";
  return "late_night";
}
```

Main places query select string:
```typescript
const PLACE_SELECT = `
  id, name, slug, place_type, neighborhood, image_url, hours,
  vibes, cuisine, created_at, is_active, indoor_outdoor,
  nearest_marta_station, marta_walk_minutes, price_level,
  location_designator, description, short_description,
  place_profile(featured, library_pass),
  place_vertical_details(outdoor)
` as const;
```

The route should follow the experiences route pattern exactly for:
- Rate limiting (lines 72-77 of experiences)
- Portal slug resolution (lines 79-80)
- Portal manifest building (lines 95-105)
- Portal scope helper (lines 136-141)
- Chain venue filtering (lines 169-172)
- Cache get/set (lines 84-92, 212-217)
- Error responses

For the event count query, use the same batched approach as experiences (lines 182-207) but with `place_id` instead of `venue_id`. Apply `applyFeedGate` to the events query.

Weather fetch:
```typescript
let weather: CurrentWeatherResponse | null = null;
try {
  const weatherRes = await fetch(new URL("/api/weather/current", request.url), {
    signal: AbortSignal.timeout(3000),
  });
  if (weatherRes.ok) weather = await weatherRes.json();
} catch {
  // Weather unavailable — skip weather-dependent scoring
}
```

For each place, build a `PlaceContext` from the fetched data, then call `scorePlaceForCategory()` and `buildCallouts()`. For each category, call `buildSummary()` with aggregated stats.

The response omits categories with 0 places. If fewer than 3 categories survive, return `{ categories: [] }`.

- [ ] **Step 2: Test the route locally**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev &`
Then: `curl -s http://localhost:3000/api/portals/atlanta/city-pulse/places-to-go | jq '.categories | length'`
Expected: A number between 3 and 12

Then: `curl -s http://localhost:3000/api/portals/atlanta/city-pulse/places-to-go | jq '.categories[0]'`
Expected: A category object with key, label, accent_color, count, summary, places array

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/app/api/portals/[slug]/city-pulse/places-to-go/route.ts
git commit -m "feat(places-to-go): add API route with scoring, callouts, caching"
```

---

## Task 5: PlacesToGoCard Component

**Files:**
- Create: `web/components/feed/sections/PlacesToGoCard.tsx`

- [ ] **Step 1: Create the card component**

```typescript
// web/components/feed/sections/PlacesToGoCard.tsx
"use client";

import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { Dot } from "@/components/ui/Dot";
import type { PlacesToGoCard as CardData } from "@/lib/places-to-go/types";

interface Props {
  card: CardData;
  accentColor: string;
}

export function PlacesToGoCard({ card, accentColor }: Props) {
  return (
    <Link
      href={card.href}
      className="flex items-start gap-3 p-2.5 rounded-lg bg-[var(--night)] border border-[var(--twilight)]/40 border-l-2 hover:bg-[var(--dusk)] transition-colors"
      style={{ borderLeftColor: accentColor }}
    >
      {/* Image */}
      <div className="relative w-20 h-20 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--twilight)]">
        <SmartImage
          src={card.image_url}
          alt={card.name}
          fill
          className="object-cover"
          loading="lazy"
          fallback={
            <div
              className="w-full h-full"
              style={{
                background: `linear-gradient(135deg, color-mix(in srgb, ${accentColor} 30%, var(--night)), var(--night))`,
              }}
            />
          }
        />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-0.5">
        <p className="text-sm font-semibold text-[var(--cream)] leading-tight truncate">
          {card.name}
        </p>

        {/* Subtitle: neighborhood + open status */}
        <p className="text-xs text-[var(--soft)] mt-0.5 truncate">
          {card.neighborhood}
          {card.neighborhood && card.is_open !== null && <Dot />}
          {card.is_open === true && (
            <span className="text-[var(--neon-green)]">Open now</span>
          )}
          {card.is_open === false && (
            <span className="text-[var(--muted)]">Closed</span>
          )}
        </p>

        {/* Callouts */}
        {card.callouts.length > 0 && (
          <p className="text-xs text-[var(--muted)] mt-1 truncate">
            {card.callouts.join(" · ")}
          </p>
        )}
      </div>

      {/* Event count badge */}
      {card.event_count > 0 && (
        <span
          className="flex-shrink-0 mt-1 px-1.5 py-0.5 rounded-full text-2xs font-mono font-bold tabular-nums"
          style={{
            backgroundColor: `color-mix(in srgb, ${accentColor} 20%, transparent)`,
            color: accentColor,
          }}
        >
          {card.event_count}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors from the new file

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/PlacesToGoCard.tsx
git commit -m "feat(places-to-go): add PlacesToGoCard component"
```

---

## Task 6: PlacesToGoCategoryTile Component

**Files:**
- Create: `web/components/feed/sections/PlacesToGoCategoryTile.tsx`

- [ ] **Step 1: Create the tile component**

This component handles both collapsed and expanded states. When expanded, it renders 2-3 PlacesToGoCard components.

```typescript
// web/components/feed/sections/PlacesToGoCategoryTile.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import type { PlacesToGoCategory } from "@/lib/places-to-go/types";
import { PlacesToGoCard } from "./PlacesToGoCard";

interface Props {
  category: PlacesToGoCategory;
  isExpanded: boolean;
  onToggle: () => void;
}

export const PlacesToGoCategoryTile = memo(function PlacesToGoCategoryTile({
  category,
  isExpanded,
  onToggle,
}: Props) {
  const tileStyle = {
    backgroundColor: `color-mix(in srgb, ${category.accent_color} 15%, transparent)`,
    borderColor: `color-mix(in srgb, ${category.accent_color} 20%, transparent)`,
  };

  return (
    <div
      className={`relative rounded-lg border transition-all ${
        isExpanded
          ? "col-span-2 sm:col-span-3 lg:col-span-4"
          : ""
      }`}
      style={tileStyle}
    >
      {/* Clickable tile header */}
      <button
        onClick={onToggle}
        className="w-full text-left p-3 cursor-pointer"
        aria-expanded={isExpanded}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--cream)] leading-tight">
            {category.label}
          </span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {category.has_activity_today && (
              <span
                aria-label="Events today"
                className="w-2 h-2 rounded-full bg-[var(--neon-green)] animate-pulse"
              />
            )}
          </div>
        </div>

        <span
          className="text-xl font-bold tabular-nums leading-none mt-1 block"
          style={{ color: category.accent_color }}
        >
          {category.count}
        </span>

        <span className="text-xs text-[var(--soft)] mt-0.5 block line-clamp-2">
          {category.summary}
        </span>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 space-y-2 animate-[fadeIn_150ms_ease-out]">
          {/* Place cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {category.places.map((place) => (
              <PlacesToGoCard
                key={place.id}
                card={place}
                accentColor={category.accent_color}
              />
            ))}
          </div>

          {/* See all link */}
          <Link
            href={category.see_all_href}
            className="block text-xs font-mono hover:opacity-80 transition-opacity pt-1"
            style={{ color: category.accent_color }}
          >
            See all {category.count} {category.label.toLowerCase()} →
          </Link>
        </div>
      )}
    </div>
  );
});
```

- [ ] **Step 2: Add fadeIn keyframe if not already in globals.css**

Check if `fadeIn` keyframe exists in `web/app/globals.css`. If not, add:

```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/sections/PlacesToGoCategoryTile.tsx
# Also add globals.css if modified
git commit -m "feat(places-to-go): add PlacesToGoCategoryTile with expand/collapse"
```

---

## Task 7: PlacesToGoSection Component

**Files:**
- Create: `web/components/feed/sections/PlacesToGoSection.tsx`

- [ ] **Step 1: Create the section component**

This is the top-level section. Self-fetches via `useQuery`. Manages expand state. Renders the jeweltone grid.

```typescript
// web/components/feed/sections/PlacesToGoSection.tsx
"use client";

import { useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin } from "@phosphor-icons/react";
import FeedSectionHeader from "@/components/feed/FeedSectionHeader";
import FeedSectionSkeleton from "@/components/feed/FeedSectionSkeleton";
import { PlacesToGoCategoryTile } from "./PlacesToGoCategoryTile";
import type { PlacesToGoResponse } from "@/lib/places-to-go/types";

interface Props {
  portalSlug: string;
}

export function PlacesToGoSection({ portalSlug }: Props) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery<PlacesToGoResponse>({
    queryKey: ["places-to-go", portalSlug],
    queryFn: async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      try {
        const res = await fetch(
          `/api/portals/${portalSlug}/city-pulse/places-to-go`,
          { signal: controller.signal },
        );
        if (!res.ok) throw new Error(`Places-to-go fetch failed: ${res.status}`);
        return res.json();
      } finally {
        clearTimeout(timeoutId);
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const handleToggle = useCallback((key: string) => {
    setExpandedKey((prev) => (prev === key ? null : key));
  }, []);

  if (isLoading) return <FeedSectionSkeleton count={4} />;
  if (isError || !data?.categories?.length) return null;

  return (
    <section className="pb-2">
      <FeedSectionHeader
        title="Places to Go"
        priority="secondary"
        accentColor="var(--neon-green)"
        icon={<MapPin weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=places`}
      />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
        {data.categories.map((category) => (
          <PlacesToGoCategoryTile
            key={category.key}
            category={category}
            isExpanded={expandedKey === category.key}
            onToggle={() => handleToggle(category.key)}
          />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/sections/PlacesToGoSection.tsx
git commit -m "feat(places-to-go): add PlacesToGoSection with useQuery and expand state"
```

---

## Task 8: Wire Into Feed + Remove Old Sections

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`
- Modify: `web/components/feed/CityPulseSection.tsx`
- Delete: `web/components/feed/sections/BrowseSection.tsx`
- Delete: `web/components/feed/sections/BrowseGridTile.tsx`
- Delete: `web/components/feed/sections/ExperiencesSection.tsx`

- [ ] **Step 1: Add PlacesToGoSection to CityPulseShell**

In `web/components/feed/CityPulseShell.tsx`:

Add import near the top with other dynamic imports (~line 76):
```typescript
const PlacesToGoSection = dynamic<{ portalSlug: string }>(
  () => import("./sections/PlacesToGoSection").then((m) => ({ default: m.PlacesToGoSection })),
  { ssr: false },
);
```

Replace the browse block (~lines 567-591). Find this block:
```tsx
{/* Browse — Places to Go + Things to Do (always last) */}
{!hiddenBlockSet.has("browse") && (
  <div
    id="city-pulse-browse"
    ...
```

Replace it with:
```tsx
{/* Places to Go (always last) */}
<div id="city-pulse-places-to-go" className="scroll-mt-28 mt-8">
  <div className="h-px bg-[var(--twilight)]" />
  <div className="pt-6">
    <LazySection minHeight={400}>
      <PlacesToGoSection portalSlug={portalSlug} />
    </LazySection>
  </div>
</div>
```

- [ ] **Step 2: Remove browse and experiences cases from CityPulseSection**

In `web/components/feed/CityPulseSection.tsx`:

Remove the `case "browse"` block and the `case "experiences"` block from the switch statement. Also remove the `BrowseSection` import.

- [ ] **Step 3: Delete old section files**

```bash
rm web/components/feed/sections/BrowseSection.tsx
rm web/components/feed/sections/BrowseGridTile.tsx
rm web/components/feed/sections/ExperiencesSection.tsx
```

- [ ] **Step 4: Verify no broken imports**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -40`
Expected: No errors. If there are broken imports referencing BrowseSection or ExperiencesSection, fix them.

- [ ] **Step 5: Verify dev server loads feed**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev &`
Open `http://localhost:3000/atlanta` in browser. Scroll to bottom of feed. Verify:
- The old "Things to Do" and "Places to Go" grids are gone
- The new "Places to Go" section renders with jeweltone tiles
- Clicking a tile expands it to show place cards
- Clicking another tile collapses the first and expands the new one

- [ ] **Step 6: Commit**

```bash
git add -A web/components/feed/
git commit -m "feat(places-to-go): wire into feed, remove BrowseSection + ExperiencesSection"
```

---

## Task 9: Cleanup Dead Code + Delete Experiences Route

**Files:**
- Delete: `web/app/api/portals/[slug]/city-pulse/experiences/route.ts`
- Modify: `web/lib/city-pulse/section-builders.ts` (if it has experiences builder)

- [ ] **Step 1: Delete the experiences API route**

```bash
rm web/app/api/portals/[slug]/city-pulse/experiences/route.ts
```

- [ ] **Step 2: Remove experiences builder from section-builders if present**

Check `web/lib/city-pulse/section-builders.ts` for any `buildExperiencesSection` function or `experiences`-related code. Remove it. Also remove the `THINGS_TO_DO_TILES` import from this file if it's only used by the experiences builder.

- [ ] **Step 3: Search for any remaining references to deleted files**

Run: `cd /Users/coach/Projects/LostCity/web && grep -rn "ExperiencesSection\|BrowseSection\|BrowseGridTile\|city-pulse/experiences" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next"`

Fix any remaining imports or references.

- [ ] **Step 4: Verify TypeScript compiles clean**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 5: Run all tests**

Run: `cd /Users/coach/Projects/LostCity/web && npx vitest run 2>&1 | tail -20`
Expected: All tests pass (including the new scoring + callout tests)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: remove experiences route and dead section builder code"
```

---

## Task 10: Browser QA

**Files:** None (verification only)

- [ ] **Step 1: Start dev server and open Atlanta feed**

Run: `cd /Users/coach/Projects/LostCity/web && npm run dev`
Open: `http://localhost:3000/atlanta`

- [ ] **Step 2: Verify section renders at bottom of feed**

Scroll to bottom. Confirm:
- "Places to Go" section header visible with MapPin icon and green accent
- 12 jeweltone tiles in 2-col grid (mobile) or 4-col (desktop)
- Each tile shows: category label, count in accent color, summary line
- Tiles with events today show green pulse dot

- [ ] **Step 3: Test expand/collapse**

- Click a tile — it expands to full width showing 2-3 place cards
- Click another tile — first collapses, second expands
- Click the expanded tile again — it collapses (all tiles collapsed)

- [ ] **Step 4: Verify place cards**

Inside an expanded tile:
- Each card shows 80x80 image, name, neighborhood, open/closed status
- Callout line shows vertical-specific data
- Event count badge visible if events exist
- Cards link to correct place detail page
- "See all N [category]" link at bottom works

- [ ] **Step 5: Test on mobile viewport (375px)**

Resize browser to 375px width. Verify:
- 2-column grid, tiles readable
- Summary text visible (text-xs, not too small)
- Expanded tile fills both columns
- Place cards stack vertically inside expanded tile
- No horizontal overflow

- [ ] **Step 6: Check console for errors**

Open browser DevTools console. Verify:
- No React errors
- No failed API calls (200 response from places-to-go endpoint)
- No TypeScript runtime errors

- [ ] **Step 7: Test on another portal**

Navigate to a non-Atlanta portal (e.g., HelpATL). Verify:
- Section still renders (or hides if < 3 categories)
- No cross-portal data leakage
- Categories with 0 places don't appear
