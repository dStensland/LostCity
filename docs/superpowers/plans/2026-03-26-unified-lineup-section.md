# Unified Lineup Section — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge The Lineup, Regular Hangs, and On the Horizon into a single unified section with 4 tabs (Tonight / This Week / Coming Up / Every Week) and 3 visual tiers (tentpole / standard / recurring).

**Architecture:** New `/api/portals/[slug]/lineup` endpoint handles ALL filtering server-side—the client becomes a dumb renderer. Each tab has its own query and response shape but shares a common LineupEvent type with server-assigned `display_tier`. Existing components (TieredEventList, PlanningHorizonCard) are reused for tentpole/standard tiers; a new RecurringStrip handles the compact recurring treatment.

**Tech Stack:** Next.js 16 API route, Supabase queries, React client components, Tailwind v4, Phosphor icons

---

## File Map

### New files
| File | Responsibility |
|------|---------------|
| `web/lib/lineup/types.ts` | LineupEvent, LineupTab, LineupResponse types + tab constants |
| `web/lib/lineup/tiers.ts` | assignDisplayTier(), assignCardTier() — server-side tier logic |
| `web/lib/lineup/queries.ts` | Per-tab Supabase queries, shared SELECT, post-processing |
| `web/lib/lineup/counts.ts` | Chip count + meta count computation (per-tab) |
| `web/app/api/portals/[slug]/lineup/route.ts` | GET handler — tab dispatch, caching, response assembly |
| `web/components/feed/UnifiedLineupSection.tsx` | Main component: tabs, chips, content routing, lazy loading |
| `web/components/feed/lineup/RecurringStrip.tsx` | Compact recurring events at bottom of Tonight/This Week |
| `web/components/feed/lineup/EveryWeekTab.tsx` | Activity chips + day filter + compact grid (absorbs TheSceneSection) |
| `web/components/feed/lineup/ComingUpTab.tsx` | Month pills + tentpole carousel (absorbs PlanningHorizonSection) |

### Modified files
| File | Change |
|------|--------|
| `web/components/feed/CityPulseShell.tsx` | Replace 3 sections (LineupSection, TheSceneSection, PlanningHorizonSection) with single UnifiedLineupSection |
| `web/lib/city-pulse/types.ts` | Add `FeedBlockId` value "lineup" if needed |
| `web/lib/hooks/useCityPulseFeed.ts` | Remove lineup-specific data handling (tab counts, fetchTab) |

### Reused as-is
| File | What we use |
|------|-------------|
| `web/lib/scene-event-routing.ts` | `isSceneEvent()`, `matchActivityType()` — for tier assignment |
| `web/lib/city-pulse/tier-assignment.ts` | `getCardTier()` — card tier within display tier |
| `web/lib/city-pulse/pipeline/resolve-portal.ts` | Portal context resolution, date computation |
| `web/lib/city-pulse/pipeline/fetch-events.ts` | `EVENT_SELECT`, `buildEventQuery()`, `postProcessEvents()` |
| `web/lib/city-pulse/section-builders.ts` | `deduplicateSeries()` |
| `web/components/feed/TieredEventList.tsx` | Renders hero/featured/standard cards |
| `web/components/feed/PlanningHorizonCard.tsx` | Coming Up card |
| `web/components/feed/FeedSectionHeader.tsx` | Section header |

### Deprecated (removed from shell, kept in tree)
| File | Reason |
|------|--------|
| `web/components/feed/LineupSection.tsx` | Replaced by UnifiedLineupSection |
| `web/components/feed/sections/TheSceneSection.tsx` | Absorbed into Every Week tab |
| `web/components/feed/sections/PlanningHorizonSection.tsx` | Absorbed into Coming Up tab |

---

## Design Decisions

### Tab behavior
- **Tonight / This Week**: Category chips (Music, Comedy, Art, etc.). "All" = no filter (truly all events). Blended content: tentpoles get hero cards, standard events get normal cards, recurring events get compact rows at the bottom.
- **Coming Up**: Month pills (Apr, May, Jun...). Quality-gated to tentpoles/festivals/flagship only. No category chips — everything here is big.
- **Every Week**: Activity type chips (Trivia, Karaoke, Comedy...) + day-of-week filter. Discovery mode for recurring patterns. "See all" links to `/[portal]/regulars`.

### Display tiers (server-assigned)
```
tentpole:  is_tentpole || festival_id || importance === "flagship"
recurring: (series_id || is_recurring) && matchActivityType() !== null
standard:  everything else
```

### Card tiers (server-assigned, within display tier)
- Tentpoles: hero / featured / standard via existing getCardTier()
- Standard events: hero / featured / standard via existing getCardTier()
- Recurring: always "standard" (compact row treatment)

### "All" means all
No union matcher. "All" chip shows every event in the tab unfiltered. Individual chips (Music, Comedy) filter to that category. This is a breaking change from the old behavior where "All" meant "union of selected interests."

### Server-side filtering
ALL filtering that was previously client-side moves to the server:
- Scene event → tagged as `display_tier: "recurring"` (not excluded)
- Film events → excluded (belongs in See Shows section)
- Activism/mobilize → excluded (separate opt-in section)
- YMCA sources → excluded (classes)
- Category chips → server filters to category
- Series dedup → server deduplicates (one per series per day)

### Data freshness
- Tonight tab: fetched on initial load, included in city-pulse initial payload if possible
- This Week / Coming Up / Every Week: lazy-loaded on tab click
- Cache: 3 min for anon, 1 min for auth (same as current)

---

## Tasks

### Task 1: Lineup types and constants

**Files:**
- Create: `web/lib/lineup/types.ts`

- [ ] **Step 1: Create the types file**

```typescript
// web/lib/lineup/types.ts

/**
 * Unified Lineup types — shared between API route and client components.
 *
 * Display tiers control visual treatment:
 *   tentpole → hero/featured cards with urgency badges
 *   standard → normal event cards
 *   recurring → compact rows (activity dot + venue + time)
 *
 * Card tiers control size within a display tier:
 *   hero → full-width image card
 *   featured → medium card in carousel
 *   standard → compact row
 */

import type { FeedEventData } from "@/components/EventCard";
import type { CardTier } from "@/lib/city-pulse/types";

// ── Tab definitions ─────────────────────────────────────────────────

export type LineupTab = "tonight" | "this_week" | "coming_up" | "every_week";

export const LINEUP_TABS: { id: LineupTab; label: string; accent: string }[] = [
  { id: "tonight",    label: "TONIGHT",    accent: "var(--coral)" },
  { id: "this_week",  label: "THIS WEEK",  accent: "var(--neon-green)" },
  { id: "coming_up",  label: "COMING UP",  accent: "var(--gold)" },
  { id: "every_week", label: "EVERY WEEK", accent: "var(--vibe)" },
];

// ── Display tier ────────────────────────────────────────────────────

export type DisplayTier = "tentpole" | "standard" | "recurring";

// ── Lineup event (extends base event data with server-assigned tiers) ─

export interface LineupEvent {
  event: FeedEventData;

  /** Visual treatment tier — controls which component renders this event */
  display_tier: DisplayTier;

  /** Card size within the display tier */
  card_tier: CardTier;

  /** Scene activity type for recurring events (trivia, karaoke, etc.) */
  activity_type: string | null;

  /** Human-readable recurrence pattern ("Every Tuesday · 8 PM") */
  recurrence_label: string | null;

  /** Urgency text for tentpoles ("Starts tomorrow", "Last 2 days") */
  urgency: string | null;

  /** Ticket freshness for tentpoles ("On sale", "Presale open") */
  ticket_freshness: string | null;

  /** Social proof */
  going_count: number;
  friends_going: { user_id: string; username: string; display_name: string }[];
}

// ── API response ────────────────────────────────────────────────────

export interface LineupResponse {
  tab: LineupTab;
  events: LineupEvent[];
  total_count: number;

  /** Per-tab total counts (all tabs, for badge display) */
  tab_counts: Record<LineupTab, number>;

  /** Per-category counts for the active tab (for chip badges) */
  chip_counts: Record<string, number>;

  /** Tab-specific metadata */
  meta: {
    /** Coming Up: events per month ("2026-04": 5) */
    month_counts?: Record<string, number>;
    /** Every Week: events per activity type ("trivia": 8) */
    activity_counts?: Record<string, number>;
    /** Every Week: events per ISO day (1=Mon, 7=Sun) */
    day_counts?: Record<number, number>;
  };
}

// ── Category chip (simplified — no union matcher) ───────────────────

export const LINEUP_CATEGORY_CHIPS: { id: string; label: string; color: string }[] = [
  { id: "all",       label: "All",       color: "var(--coral)" },
  { id: "music",     label: "Music",     color: "var(--neon-magenta)" },
  { id: "comedy",    label: "Comedy",    color: "var(--gold)" },
  { id: "art",       label: "Art",       color: "var(--vibe)" },
  { id: "food_drink", label: "Food",     color: "var(--neon-green)" },
  { id: "nightlife", label: "Nightlife", color: "var(--neon-magenta)" },
  { id: "sports",    label: "Sports",    color: "var(--neon-cyan)" },
  { id: "community", label: "Community", color: "var(--neon-cyan)" },
  { id: "free",      label: "Free",      color: "var(--neon-green)" },
];

// ── Excluded categories (handled by other sections) ─────────────────

export const LINEUP_EXCLUDED_CATEGORIES = new Set([
  "film",           // See Shows section
  "recreation",     // noise
  "unknown",        // noise
  "support_group",  // not public events
  "religious",      // not public events
]);
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean (no errors from this file)

- [ ] **Step 3: Commit**

```bash
git add web/lib/lineup/types.ts
git commit -m "feat(lineup): add unified lineup types and constants"
```

---

### Task 2: Display tier and card tier assignment

**Files:**
- Create: `web/lib/lineup/tiers.ts`

- [ ] **Step 1: Create the tier assignment module**

```typescript
// web/lib/lineup/tiers.ts

/**
 * Server-side tier assignment for the unified Lineup.
 *
 * Display tier determines visual treatment:
 *   tentpole  → hero/featured cards, urgency badges, gold accent
 *   standard  → normal event cards, category-colored accent
 *   recurring → compact rows, activity-type dot, vibe accent
 *
 * Card tier determines size within a display tier (hero > featured > standard).
 */

import type { FeedEventData } from "@/components/EventCard";
import type { CardTier } from "@/lib/city-pulse/types";
import type { DisplayTier } from "./types";
import { matchActivityType } from "@/lib/scene-event-routing";
import { getCardTier } from "@/lib/city-pulse/tier-assignment";

/** Assign display tier based on event signals. */
export function assignDisplayTier(event: FeedEventData): DisplayTier {
  // Tentpole: flagship events worth planning around
  if (event.is_tentpole) return "tentpole";
  if (event.festival_id) return "tentpole";
  if ((event as Record<string, unknown>).importance === "flagship") return "tentpole";

  // Recurring: series events that match a scene activity type
  if (event.series_id || event.is_recurring) {
    const activityType = matchActivityType(event as Parameters<typeof matchActivityType>[0]);
    if (activityType) return "recurring";
  }

  return "standard";
}

/** Assign card tier within a display tier. */
export function assignCardTierForLineup(
  event: FeedEventData,
  displayTier: DisplayTier,
  friendsGoingCount: number = 0,
): CardTier {
  // Recurring events are always compact — no hero/featured treatment
  if (displayTier === "recurring") return "standard";

  // Tentpoles and standard events use the existing scoring logic
  return getCardTier(
    {
      is_tentpole: event.is_tentpole ?? false,
      is_featured: event.is_featured ?? false,
      festival_id: event.festival_id ?? null,
      image_url: event.image_url ?? null,
      featured_blurb: (event as Record<string, unknown>).featured_blurb as string | null ?? null,
      importance: ((event as Record<string, unknown>).importance as string) ?? null,
      venue_has_editorial: false,
    },
    friendsGoingCount,
  );
}

/** Get the scene activity type for a recurring event (null for non-recurring). */
export function getActivityType(event: FeedEventData): string | null {
  if (!event.series_id && !event.is_recurring) return null;
  const match = matchActivityType(event as Parameters<typeof matchActivityType>[0]);
  return match?.id ?? null;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add web/lib/lineup/tiers.ts
git commit -m "feat(lineup): server-side display tier and card tier assignment"
```

---

### Task 3: Event query helpers

**Files:**
- Create: `web/lib/lineup/queries.ts`

- [ ] **Step 1: Create query helpers for each tab**

This module builds Supabase queries for each tab. All filtering happens here — the client never filters.

```typescript
// web/lib/lineup/queries.ts

/**
 * Per-tab Supabase queries for the unified Lineup.
 *
 * Each tab has a dedicated query that returns exactly what should render.
 * No client-side filtering needed — "what the server sends is what you show."
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { EVENT_SELECT, postProcessEvents } from "@/lib/city-pulse/pipeline/fetch-events";
import { deduplicateSeries } from "@/lib/city-pulse/section-builders";
import type { FeedEventData } from "@/components/EventCard";
import type { PipelineContext } from "@/lib/city-pulse/pipeline/resolve-portal";
import { LINEUP_EXCLUDED_CATEGORIES } from "./types";

// ── Shared query builder ────────────────────────────────────────────

function baseEventQuery(
  client: SupabaseClient,
  ctx: PipelineContext,
  startDate: string,
  endDate: string,
  limit: number,
) {
  let query = client
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", startDate)
    .lte("start_date", endDate)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(limit);

  // Exclude categories handled by other sections
  for (const cat of LINEUP_EXCLUDED_CATEGORIES) {
    query = query.neq("category_id", cat);
  }

  // Portal scope (federation, geo, city)
  query = ctx.applyPortalScope(query);

  return query;
}

// ── Tonight: all events today (one-offs + recurring) ────────────────

export async function fetchTonightEvents(
  client: SupabaseClient,
  ctx: PipelineContext,
): Promise<FeedEventData[]> {
  const { data, error } = await baseEventQuery(client, ctx, ctx.today, ctx.today, 200);

  if (error || !data) return [];

  let events = postProcessEvents(data as FeedEventData[]);

  // Exclude activism (separate section)
  events = events.filter((e) => {
    const tags = (e.tags as string[] | null) ?? [];
    return !tags.includes("activism") && !tags.includes("mobilize");
  });

  // Dedup series (keep earliest occurrence per series)
  events = deduplicateSeries(events);

  return events;
}

// ── This Week: all events next 7 days ───────────────────────────────

export async function fetchThisWeekEvents(
  client: SupabaseClient,
  ctx: PipelineContext,
): Promise<FeedEventData[]> {
  const { data, error } = await baseEventQuery(client, ctx, ctx.tomorrow, ctx.weekAhead, 300);

  if (error || !data) return [];

  let events = postProcessEvents(data as FeedEventData[]);

  events = events.filter((e) => {
    const tags = (e.tags as string[] | null) ?? [];
    return !tags.includes("activism") && !tags.includes("mobilize");
  });

  events = deduplicateSeries(events);

  return events;
}

// ── Coming Up: tentpoles/festivals/flagships 1-6 months out ─────────

export async function fetchComingUpEvents(
  client: SupabaseClient,
  ctx: PipelineContext,
): Promise<FeedEventData[]> {
  // Only events worth planning around
  const { data, error } = await client
    .from("events")
    .select(EVENT_SELECT)
    .gte("start_date", ctx.weekAhead)
    .lte("start_date", ctx.horizonEnd)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .or("is_tentpole.eq.true,festival_id.not.is.null,importance.eq.flagship")
    .not("category_id", "in", "(recreation,unknown,support_group,religious)")
    .order("start_date", { ascending: true })
    .limit(100);

  if (error || !data) return [];

  let events = postProcessEvents(data as FeedEventData[]);

  // Quality gate: require image
  events = events.filter((e) => !!e.image_url);

  // Quality gate: 90+ days out needs real description
  const now = new Date();
  const ninetyDaysAhead = new Date(now.getTime() + 90 * 86400000).toISOString().slice(0, 10);
  events = events.filter((e) => {
    if (e.start_date >= ninetyDaysAhead) {
      const desc = ((e as Record<string, unknown>).description as string ?? "").trim();
      return desc.length >= 20;
    }
    return true;
  });

  // Quality gate: no recurring series in multi-day path
  events = events.filter((e) => {
    if (e.end_date && e.end_date !== e.start_date && e.series_id) return false;
    return true;
  });

  // Dedup by series and normalized title
  events = deduplicateSeries(events);

  return events;
}

// ── Every Week: recurring events for next 7 days ────────────────────

export async function fetchEveryWeekEvents(
  client: SupabaseClient,
  ctx: PipelineContext,
): Promise<FeedEventData[]> {
  const { data, error } = await client
    .from("events")
    .select(EVENT_SELECT)
    .not("series_id", "is", null)
    .gte("start_date", ctx.today)
    .lte("start_date", ctx.weekAhead)
    .is("canonical_event_id", null)
    .or("is_class.eq.false,is_class.is.null")
    .or("is_sensitive.eq.false,is_sensitive.is.null")
    .eq("is_regular_ready", true)
    .not("category_id", "in", "(film,theater,family,learning,support_group,community)")
    .order("start_date", { ascending: true })
    .order("start_time", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error || !data) return [];

  let events = postProcessEvents(data as FeedEventData[]);

  // Dedup: one per series (keep earliest this week)
  events = deduplicateSeries(events);

  return events;
}

// ── Category filter (applied on top of any tab's events) ────────────

export function filterByCategory(
  events: FeedEventData[],
  category: string | null,
): FeedEventData[] {
  if (!category || category === "all") return events;

  if (category === "free") {
    return events.filter((e) => {
      if (e.is_free) return true;
      const tags = (e.tags as string[] | null) ?? [];
      return tags.includes("free");
    });
  }

  return events.filter((e) => e.category === category);
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean. If `postProcessEvents` or `deduplicateSeries` have import issues, check the actual export names in those files and adjust.

- [ ] **Step 3: Commit**

```bash
git add web/lib/lineup/queries.ts
git commit -m "feat(lineup): per-tab event queries with server-side filtering"
```

---

### Task 4: Count computation

**Files:**
- Create: `web/lib/lineup/counts.ts`

- [ ] **Step 1: Create count computation module**

```typescript
// web/lib/lineup/counts.ts

/**
 * Count computation for the unified Lineup.
 *
 * Chip counts are derived from the actual event pool — no separate count
 * queries, no pre-computed tables, no mismatches. What you count is what
 * you render.
 */

import type { FeedEventData } from "@/components/EventCard";
import { matchActivityType } from "@/lib/scene-event-routing";

/** Compute per-category chip counts from an event pool. */
export function computeChipCounts(events: FeedEventData[]): Record<string, number> {
  const counts: Record<string, number> = { all: events.length };

  for (const event of events) {
    // Category
    if (event.category) {
      counts[event.category] = (counts[event.category] || 0) + 1;
    }

    // Free
    if (event.is_free || ((event.tags as string[] | null) ?? []).includes("free")) {
      counts["free"] = (counts["free"] || 0) + 1;
    }
  }

  return counts;
}

/** Compute per-month counts for Coming Up tab. */
export function computeMonthCounts(events: FeedEventData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const monthKey = event.start_date.slice(0, 7); // "2026-04"
    counts[monthKey] = (counts[monthKey] || 0) + 1;
  }
  return counts;
}

/** Compute per-activity-type counts for Every Week tab. */
export function computeActivityCounts(events: FeedEventData[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const event of events) {
    const match = matchActivityType(event as Parameters<typeof matchActivityType>[0]);
    if (match) {
      counts[match.id] = (counts[match.id] || 0) + 1;
    }
  }
  return counts;
}

/** Compute per-day-of-week counts for Every Week tab. ISO: 1=Mon, 7=Sun. */
export function computeDayCounts(events: FeedEventData[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const event of events) {
    const date = new Date(event.start_date + "T12:00:00");
    // JS getDay: 0=Sun, convert to ISO: 1=Mon...7=Sun
    const jsDay = date.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    counts[isoDay] = (counts[isoDay] || 0) + 1;
  }
  return counts;
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add web/lib/lineup/counts.ts
git commit -m "feat(lineup): chip and meta count computation from event pools"
```

---

### Task 5: Unified Lineup API route

**Files:**
- Create: `web/app/api/portals/[slug]/lineup/route.ts`

- [ ] **Step 1: Create the API route**

This is the main endpoint. It resolves portal context, fetches the requested tab's events, assigns tiers, computes counts, and returns the response. All filtering is done here — the client just renders.

```typescript
// web/app/api/portals/[slug]/lineup/route.ts

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePortalContext } from "@/lib/city-pulse/pipeline/resolve-portal";
import { matchActivityType } from "@/lib/scene-event-routing";
import { buildRecurrenceLabel } from "@/lib/city-pulse/section-builders";
import {
  fetchTonightEvents,
  fetchThisWeekEvents,
  fetchComingUpEvents,
  fetchEveryWeekEvents,
  filterByCategory,
} from "@/lib/lineup/queries";
import { assignDisplayTier, assignCardTierForLineup, getActivityType } from "@/lib/lineup/tiers";
import { computeChipCounts, computeMonthCounts, computeActivityCounts, computeDayCounts } from "@/lib/lineup/counts";
import type { LineupTab, LineupEvent, LineupResponse } from "@/lib/lineup/types";
import type { FeedEventData } from "@/components/EventCard";

// ── Cache config ────────────────────────────────────────────────────

const CACHE_TTL_S = 180; // 3 minutes
const STALE_WHILE_REVALIDATE_S = 360;

// ── Valid tabs ──────────────────────────────────────────────────────

const VALID_TABS = new Set<LineupTab>(["tonight", "this_week", "coming_up", "every_week"]);

// ── Wrap raw event as LineupEvent ───────────────────────────────────

function wrapEvent(event: FeedEventData, friendsGoingCount: number = 0): LineupEvent {
  const displayTier = assignDisplayTier(event);
  const cardTier = assignCardTierForLineup(event, displayTier, friendsGoingCount);
  const activityType = getActivityType(event);

  // Build recurrence label for recurring events
  let recurrenceLabel: string | null = null;
  if (event.series_id || event.is_recurring) {
    try {
      recurrenceLabel = buildRecurrenceLabel(event as Parameters<typeof buildRecurrenceLabel>[0]);
    } catch {
      recurrenceLabel = null;
    }
  }

  return {
    event,
    display_tier: displayTier,
    card_tier: cardTier,
    activity_type: activityType,
    recurrence_label: recurrenceLabel,
    urgency: null, // TODO: compute from existing urgency utils
    ticket_freshness: null,
    going_count: 0,
    friends_going: [],
  };
}

// ── Route handler ───────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const url = new URL(request.url);
  const tab = (url.searchParams.get("tab") || "tonight") as LineupTab;
  const category = url.searchParams.get("category") || null;

  if (!VALID_TABS.has(tab)) {
    return NextResponse.json({ error: "Invalid tab" }, { status: 400 });
  }

  // Resolve portal context (dates, scoping, manifest)
  const supabase = await createClient();
  const resolved = await resolvePortalContext(slug, supabase, {});

  if ("notFound" in resolved) {
    return NextResponse.json({ error: "Portal not found" }, { status: 404 });
  }

  const { context: ctx } = resolved;

  // Fetch events for requested tab
  let rawEvents: FeedEventData[];
  switch (tab) {
    case "tonight":
      rawEvents = await fetchTonightEvents(supabase, ctx);
      break;
    case "this_week":
      rawEvents = await fetchThisWeekEvents(supabase, ctx);
      break;
    case "coming_up":
      rawEvents = await fetchComingUpEvents(supabase, ctx);
      break;
    case "every_week":
      rawEvents = await fetchEveryWeekEvents(supabase, ctx);
      break;
  }

  // Apply category filter (if provided)
  const filteredEvents = filterByCategory(rawEvents, category);

  // Wrap as LineupEvents with tier assignment
  const events: LineupEvent[] = filteredEvents.map((e) => wrapEvent(e));

  // Sort: tentpoles first, then standard, then recurring
  const tierOrder: Record<string, number> = { tentpole: 0, standard: 1, recurring: 2 };
  events.sort((a, b) => {
    const tierDiff = (tierOrder[a.display_tier] ?? 1) - (tierOrder[b.display_tier] ?? 1);
    if (tierDiff !== 0) return tierDiff;
    // Within same tier, chronological
    return a.event.start_date.localeCompare(b.event.start_date)
      || (a.event.start_time ?? "").localeCompare(b.event.start_time ?? "");
  });

  // Compute counts from UNFILTERED pool (so chip badges reflect full tab)
  const chipCounts = computeChipCounts(rawEvents);

  // Tab-specific meta
  const meta: LineupResponse["meta"] = {};
  if (tab === "coming_up") {
    meta.month_counts = computeMonthCounts(rawEvents);
  }
  if (tab === "every_week") {
    meta.activity_counts = computeActivityCounts(rawEvents);
    meta.day_counts = computeDayCounts(rawEvents);
  }

  // Tab counts (lightweight — count from raw pools for non-active tabs)
  // For the initial load, only tonight count is accurate.
  // Other tabs return 0 until fetched (client updates after lazy load).
  const tabCounts: Record<LineupTab, number> = {
    tonight: tab === "tonight" ? rawEvents.length : 0,
    this_week: tab === "this_week" ? rawEvents.length : 0,
    coming_up: tab === "coming_up" ? rawEvents.length : 0,
    every_week: tab === "every_week" ? rawEvents.length : 0,
  };

  const response: LineupResponse = {
    tab,
    events,
    total_count: filteredEvents.length,
    tab_counts: tabCounts,
    chip_counts: chipCounts,
    meta,
  };

  return NextResponse.json(response, {
    headers: {
      "Cache-Control": `public, s-maxage=${CACHE_TTL_S}, stale-while-revalidate=${STALE_WHILE_REVALIDATE_S}`,
    },
  });
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`

Check for import resolution issues. Common fixes:
- `buildRecurrenceLabel` may have a different signature — check `section-builders.ts` and adjust the call
- `resolvePortalContext` may require additional params — check the actual signature
- `applyPortalScope` is on the PipelineContext — verify the query builder pattern

- [ ] **Step 3: Test the endpoint manually**

Run: `cd web && npm run dev &`

Then: `curl -s "http://localhost:3000/api/portals/atlanta/lineup?tab=tonight" | jq '.total_count, .chip_counts, (.events | length)'`

Expected: Non-zero total_count, chip_counts with category keys, events array with display_tier fields.

- [ ] **Step 4: Test each tab**

```bash
curl -s "http://localhost:3000/api/portals/atlanta/lineup?tab=this_week" | jq '.total_count'
curl -s "http://localhost:3000/api/portals/atlanta/lineup?tab=coming_up" | jq '.total_count, .meta.month_counts'
curl -s "http://localhost:3000/api/portals/atlanta/lineup?tab=every_week" | jq '.total_count, .meta.activity_counts'
```

Expected: All return data. Coming Up should have month_counts. Every Week should have activity_counts.

- [ ] **Step 5: Test category filtering**

```bash
curl -s "http://localhost:3000/api/portals/atlanta/lineup?tab=tonight&category=music" | jq '.total_count'
```

Expected: Fewer events than unfiltered tonight.

- [ ] **Step 6: Commit**

```bash
git add web/app/api/portals/[slug]/lineup/route.ts
git commit -m "feat(lineup): unified API endpoint with 4 tabs and server-side filtering"
```

---

### Task 6: RecurringStrip component

**Files:**
- Create: `web/components/feed/lineup/RecurringStrip.tsx`

- [ ] **Step 1: Create the compact recurring events component**

This renders at the bottom of Tonight/This Week tabs — a compact list of recurring events with activity-type accent dots, venue names, and recurrence labels.

```typescript
// web/components/feed/lineup/RecurringStrip.tsx

"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { LineupEvent } from "@/lib/lineup/types";
import { SCENE_ACTIVITY_TYPES } from "@/lib/scene-event-routing";

const INITIAL_SHOW = 5;

/** Color map from activity type → accent color */
const ACTIVITY_COLORS: Record<string, string> = Object.fromEntries(
  SCENE_ACTIVITY_TYPES.map((a) => [a.id, a.color]),
);

interface RecurringStripProps {
  events: LineupEvent[];
  portalSlug: string;
}

export function RecurringStrip({ events, portalSlug }: RecurringStripProps) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) return null;

  const visible = expanded ? events : events.slice(0, INITIAL_SHOW);
  const remaining = events.length - INITIAL_SHOW;

  return (
    <div className="mt-4 pt-3 border-t border-[var(--twilight)]/30">
      {/* Strip header */}
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-2xs font-bold uppercase tracking-wider text-[var(--vibe)]">
          Also happening — regulars
        </span>
        <Link
          href={`/${portalSlug}/regulars`}
          className="flex items-center gap-0.5 text-2xs font-mono text-[var(--vibe)] opacity-70 hover:opacity-100 transition-opacity"
        >
          All regulars
          <ArrowRight weight="bold" className="w-2.5 h-2.5" />
        </Link>
      </div>

      {/* Compact event rows */}
      <div className="space-y-1">
        {visible.map((item) => {
          const color = ACTIVITY_COLORS[item.activity_type ?? ""] ?? "var(--vibe)";
          const venue = item.event.venue;

          return (
            <Link
              key={item.event.id}
              href={`/${portalSlug}?event=${item.event.id}`}
              className="flex items-center gap-2.5 py-1.5 px-2 -mx-2 rounded-lg hover:bg-[var(--dusk)]/40 transition-colors group"
            >
              {/* Activity type dot */}
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />

              {/* Title + venue */}
              <span className="flex-1 min-w-0 text-sm text-[var(--cream)] truncate group-hover:text-[var(--soft)] transition-colors">
                {item.event.title}
              </span>

              {/* Venue + recurrence */}
              <span className="flex items-center gap-1 text-xs text-[var(--muted)] flex-shrink-0">
                {venue?.name && (
                  <span className="truncate max-w-[120px]">{venue.name}</span>
                )}
                {venue?.name && item.recurrence_label && <Dot />}
                {item.recurrence_label && (
                  <span className="font-mono text-2xs">{item.recurrence_label}</span>
                )}
              </span>
            </Link>
          );
        })}
      </div>

      {/* Show more / less */}
      {remaining > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          {expanded ? "Show less" : `+${remaining} more regulars`}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean. If `SCENE_ACTIVITY_TYPES` is not exported, check scene-event-routing.ts and adjust.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/lineup/RecurringStrip.tsx
git commit -m "feat(lineup): RecurringStrip component for compact recurring event rows"
```

---

### Task 7: ComingUpTab component

**Files:**
- Create: `web/components/feed/lineup/ComingUpTab.tsx`

- [ ] **Step 1: Create the Coming Up tab content**

Absorbs PlanningHorizonSection into a tab. Month pills + horizontal carousel of tentpole cards.

```typescript
// web/components/feed/lineup/ComingUpTab.tsx

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import { PlanningHorizonCard } from "@/components/feed/PlanningHorizonCard";
import type { LineupEvent, LineupResponse } from "@/lib/lineup/types";

function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString("en-US", { month: "short" });
}

interface ComingUpTabProps {
  events: LineupEvent[];
  meta: LineupResponse["meta"];
  portalSlug: string;
}

export function ComingUpTab({ events, meta, portalSlug }: ComingUpTabProps) {
  const [activeMonth, setActiveMonth] = useState<string | null>(null);
  const carouselRef = useRef<HTMLDivElement>(null);

  const monthCounts = meta.month_counts ?? {};
  const sortedMonths = useMemo(() => Object.keys(monthCounts).sort(), [monthCounts]);

  // Reset scroll on month change
  useEffect(() => {
    if (carouselRef.current) carouselRef.current.scrollLeft = 0;
  }, [activeMonth]);

  const filtered = useMemo(() => {
    if (!activeMonth) return events;
    return events.filter((item) => item.event.start_date.startsWith(activeMonth));
  }, [events, activeMonth]);

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        No big events on the horizon yet
      </p>
    );
  }

  return (
    <div>
      {/* Month selector pills */}
      {sortedMonths.length > 1 && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
          <button
            onClick={() => setActiveMonth(null)}
            className={[
              "shrink-0 px-3 py-2 min-h-[44px] flex items-center justify-center rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
              activeMonth === null
                ? "border"
                : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
            ].join(" ")}
            style={
              activeMonth === null
                ? {
                    color: "var(--gold)",
                    backgroundColor: "color-mix(in srgb, var(--gold) 12%, transparent)",
                    borderColor: "color-mix(in srgb, var(--gold) 30%, transparent)",
                  }
                : undefined
            }
          >
            All ({events.length})
          </button>
          {sortedMonths.map((monthKey) => (
            <button
              key={monthKey}
              onClick={() => setActiveMonth(monthKey)}
              className={[
                "shrink-0 px-3 py-2 min-h-[44px] flex items-center justify-center rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                activeMonth === monthKey
                  ? "border"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
              ].join(" ")}
              style={
                activeMonth === monthKey
                  ? {
                      color: "var(--gold)",
                      backgroundColor: "color-mix(in srgb, var(--gold) 12%, transparent)",
                      borderColor: "color-mix(in srgb, var(--gold) 30%, transparent)",
                    }
                  : undefined
              }
            >
              {monthLabel(monthKey)} ({monthCounts[monthKey]})
            </button>
          ))}
        </div>
      )}

      {/* Horizontal card carousel */}
      <div ref={carouselRef} className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-4 px-4">
        {filtered.map((item) => (
          <PlanningHorizonCard
            key={`horizon-${item.event.id}`}
            event={{
              ...(item.event as Record<string, unknown>),
              urgency: item.urgency ?? null,
              ticket_freshness: item.ticket_freshness ?? null,
            } as Parameters<typeof PlanningHorizonCard>[0]["event"]}
            portalSlug={portalSlug}
          />
        ))}
      </div>

      {/* Empty state for filtered month */}
      {activeMonth && filtered.length === 0 && (
        <p className="py-4 text-center text-sm text-[var(--muted)]">
          No big events in {monthLabel(activeMonth)}
        </p>
      )}

      {/* See all link */}
      <div className="mt-2 text-center">
        <Link
          href={`/${portalSlug}?view=happening&dateRange=month`}
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--gold)] hover:opacity-80 transition-opacity"
        >
          All big events
          <ArrowRight weight="bold" className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean. PlanningHorizonCard prop types may need adjustment — check its interface.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/lineup/ComingUpTab.tsx
git commit -m "feat(lineup): ComingUpTab with month pills and tentpole carousel"
```

---

### Task 8: EveryWeekTab component

**Files:**
- Create: `web/components/feed/lineup/EveryWeekTab.tsx`

- [ ] **Step 1: Create the Every Week tab content**

Absorbs TheSceneSection into a tab. Activity type chips + day-of-week filter + compact rows.

```typescript
// web/components/feed/lineup/EveryWeekTab.tsx

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";
import Dot from "@/components/ui/Dot";
import type { LineupEvent, LineupResponse } from "@/lib/lineup/types";
import { SCENE_ACTIVITY_TYPES } from "@/lib/scene-event-routing";

// ── Constants ───────────────────────────────────────────────────────

const INITIAL_ROWS = 10;

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const DEFAULT_ACTIVITIES = ["trivia", "karaoke", "comedy", "happy_hour", "open_mic"];

const ACTIVITY_MAP = new Map(SCENE_ACTIVITY_TYPES.map((a) => [a.id, a]));

// ── Component ───────────────────────────────────────────────────────

interface EveryWeekTabProps {
  events: LineupEvent[];
  meta: LineupResponse["meta"];
  portalSlug: string;
}

export function EveryWeekTab({ events, meta, portalSlug }: EveryWeekTabProps) {
  const [activeActivity, setActiveActivity] = useState<string>("all");
  const [activeDay, setActiveDay] = useState<number | null>(null); // ISO day or null=all
  const [showAll, setShowAll] = useState(false);

  const activityCounts = meta.activity_counts ?? {};

  // Which activity types have events?
  const availableActivities = useMemo(() => {
    return SCENE_ACTIVITY_TYPES.filter((a) => (activityCounts[a.id] ?? 0) > 0);
  }, [activityCounts]);

  // Filter events
  const filtered = useMemo(() => {
    let result = events;

    if (activeActivity !== "all") {
      result = result.filter((e) => e.activity_type === activeActivity);
    }

    if (activeDay !== null) {
      result = result.filter((e) => {
        const date = new Date(e.event.start_date + "T12:00:00");
        const jsDay = date.getDay();
        const isoDay = jsDay === 0 ? 7 : jsDay;
        return isoDay === activeDay;
      });
    }

    return result;
  }, [events, activeActivity, activeDay]);

  const visible = showAll ? filtered : filtered.slice(0, INITIAL_ROWS);
  const remaining = filtered.length - INITIAL_ROWS;

  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        No regular activities found
      </p>
    );
  }

  return (
    <div>
      {/* Activity type chips */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
        <button
          onClick={() => setActiveActivity("all")}
          className={[
            "shrink-0 px-3 py-1.5 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
            activeActivity === "all"
              ? "bg-[var(--vibe)]/15 text-[var(--vibe)] border border-[var(--vibe)]/30"
              : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
          ].join(" ")}
        >
          All ({events.length})
        </button>
        {availableActivities.map((activity) => {
          const count = activityCounts[activity.id] ?? 0;
          const isActive = activeActivity === activity.id;
          return (
            <button
              key={activity.id}
              onClick={() => setActiveActivity(activity.id)}
              className={[
                "shrink-0 px-3 py-1.5 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                isActive
                  ? "border"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
              ].join(" ")}
              style={
                isActive
                  ? {
                      color: activity.color,
                      backgroundColor: `color-mix(in srgb, ${activity.color} 12%, transparent)`,
                      borderColor: `color-mix(in srgb, ${activity.color} 30%, transparent)`,
                    }
                  : undefined
              }
            >
              {activity.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Day-of-week filter */}
      <div className="flex items-center gap-1 mb-3">
        {DAY_LABELS.map((label, i) => {
          const isoDay = i + 1; // 1=Mon
          const isActive = activeDay === isoDay;
          return (
            <button
              key={isoDay}
              onClick={() => setActiveDay(isActive ? null : isoDay)}
              className={[
                "flex-1 py-1.5 rounded-lg font-mono text-2xs font-medium transition-all text-center",
                isActive
                  ? "bg-[var(--vibe)]/15 text-[var(--vibe)]"
                  : "text-[var(--muted)] hover:text-[var(--soft)] hover:bg-[var(--twilight)]/20",
              ].join(" ")}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Compact event rows */}
      <div className="space-y-0.5">
        {visible.map((item) => {
          const activity = ACTIVITY_MAP.get(item.activity_type ?? "");
          const color = activity?.color ?? "var(--vibe)";
          const venue = item.event.venue;

          return (
            <Link
              key={item.event.id}
              href={`/${portalSlug}?event=${item.event.id}`}
              className="flex items-center gap-2.5 py-2 px-2 -mx-2 rounded-lg hover:bg-[var(--dusk)]/40 transition-colors group"
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--cream)] truncate group-hover:text-[var(--soft)] transition-colors">
                  {item.event.title}
                </p>
                <div className="flex items-center gap-1 mt-0.5">
                  {venue?.name && (
                    <span className="text-xs text-[var(--muted)] truncate">{venue.name}</span>
                  )}
                  {venue?.name && item.recurrence_label && <Dot className="text-[var(--muted)]" />}
                  {item.recurrence_label && (
                    <span className="text-2xs font-mono text-[var(--soft)]">{item.recurrence_label}</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Show more / see all */}
      {remaining > 0 && !showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="mt-2 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          +{remaining} more
        </button>
      )}

      <div className="mt-3 text-center">
        <Link
          href={`/${portalSlug}/regulars`}
          className="inline-flex items-center gap-1 text-xs font-mono text-[var(--vibe)] hover:opacity-80 transition-opacity"
        >
          All regular hangs
          <ArrowRight weight="bold" className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean. If `SCENE_ACTIVITY_TYPES` export is missing the `color` field, check `scene-event-routing.ts`.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/lineup/EveryWeekTab.tsx
git commit -m "feat(lineup): EveryWeekTab with activity chips and day filter"
```

---

### Task 9: UnifiedLineupSection — main component

**Files:**
- Create: `web/components/feed/UnifiedLineupSection.tsx`

- [ ] **Step 1: Create the unified section component**

This is the main component that manages tabs, fetches data per tab, and routes to the correct tab renderer. Tonight/This Week use TieredEventList + RecurringStrip. Coming Up and Every Week use their dedicated components.

```typescript
// web/components/feed/UnifiedLineupSection.tsx

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Lightning, CalendarBlank, Binoculars, Repeat } from "@phosphor-icons/react";
import FeedSectionHeader from "./FeedSectionHeader";
import { TieredEventList } from "./TieredEventList";
import FeedSectionSkeleton from "./FeedSectionSkeleton";
import { RecurringStrip } from "./lineup/RecurringStrip";
import { ComingUpTab } from "./lineup/ComingUpTab";
import { EveryWeekTab } from "./lineup/EveryWeekTab";
import type { LineupTab, LineupEvent, LineupResponse, LINEUP_CATEGORY_CHIPS } from "@/lib/lineup/types";
import { LINEUP_TABS } from "@/lib/lineup/types";
import type { CityPulseEventItem } from "@/lib/city-pulse/types";

// ── Tab icons ───────────────────────────────────────────────────────

const TAB_ICONS: Record<LineupTab, typeof Lightning> = {
  tonight: Lightning,
  this_week: CalendarBlank,
  coming_up: Binoculars,
  every_week: Repeat,
};

// ── Props ───────────────────────────────────────────────────────────

interface UnifiedLineupSectionProps {
  portalSlug: string;
  /** Pre-fetched tonight data from initial feed load (optional). */
  initialData?: LineupResponse | null;
}

// ── Component ───────────────────────────────────────────────────────

export default function UnifiedLineupSection({
  portalSlug,
  initialData,
}: UnifiedLineupSectionProps) {
  const [activeTab, setActiveTab] = useState<LineupTab>("tonight");
  const [activeChip, setActiveChip] = useState<string>("all");
  const [tabData, setTabData] = useState<Record<string, LineupResponse>>(() => {
    if (initialData) return { tonight: initialData };
    return {};
  });
  const [loadingTab, setLoadingTab] = useState<string | null>(
    initialData ? null : "tonight",
  );
  const [tabCounts, setTabCounts] = useState<Record<LineupTab, number>>(
    initialData?.tab_counts ?? { tonight: 0, this_week: 0, coming_up: 0, every_week: 0 },
  );

  // Fetch tab data
  const fetchTab = useCallback(async (tab: LineupTab, category?: string) => {
    setLoadingTab(tab);
    try {
      const params = new URLSearchParams({ tab });
      if (category && category !== "all") params.set("category", category);

      const res = await fetch(`/api/portals/${portalSlug}/lineup?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LineupResponse = await res.json();

      setTabData((prev) => ({ ...prev, [tab]: data }));

      // Update tab counts from response
      setTabCounts((prev) => ({
        ...prev,
        [tab]: data.tab_counts[tab] || data.total_count,
      }));
    } catch {
      // Silently fail — skeleton will stay until retry
    } finally {
      setLoadingTab(null);
    }
  }, [portalSlug]);

  // Fetch tonight on mount if no initial data
  useEffect(() => {
    if (!tabData.tonight) {
      fetchTab("tonight");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tab data on tab switch (lazy load)
  const handleTabClick = useCallback((tab: LineupTab) => {
    setActiveTab(tab);
    // Reset chip when switching to Coming Up or Every Week (different chip sets)
    if (tab === "coming_up" || tab === "every_week") {
      setActiveChip("all");
    }
    if (!tabData[tab]) {
      fetchTab(tab);
    }
  }, [tabData, fetchTab]);

  // Handle chip click — refetch with category filter for Tonight/This Week
  const handleChipClick = useCallback((chipId: string) => {
    setActiveChip(chipId);
    // Client-side filter from existing data (no refetch needed)
  }, []);

  // Current tab data
  const currentData = tabData[activeTab] ?? null;
  const isLoading = loadingTab === activeTab;

  // Split events by display tier for Tonight/This Week
  const { tentpoleEvents, standardEvents, recurringEvents } = useMemo(() => {
    if (!currentData) return { tentpoleEvents: [], standardEvents: [], recurringEvents: [] };

    let events = currentData.events;

    // Apply client-side category filter (data was fetched unfiltered)
    if (activeChip !== "all" && (activeTab === "tonight" || activeTab === "this_week")) {
      events = events.filter((e) => {
        if (activeChip === "free") {
          return e.event.is_free || ((e.event.tags as string[] | null) ?? []).includes("free");
        }
        return e.event.category === activeChip;
      });
    }

    return {
      tentpoleEvents: events.filter((e) => e.display_tier === "tentpole"),
      standardEvents: events.filter((e) => e.display_tier === "standard"),
      recurringEvents: events.filter((e) => e.display_tier === "recurring"),
    };
  }, [currentData, activeChip, activeTab]);

  // Convert to CityPulseEventItem format for TieredEventList
  const tieredItems: CityPulseEventItem[] = useMemo(() => {
    return [...tentpoleEvents, ...standardEvents].map((item) => ({
      item_type: "event" as const,
      event: item.event,
      contextual_label: null,
      friends_going: item.friends_going,
      score: 0,
      reasons: [],
      featured: item.card_tier === "hero" || item.card_tier === "featured",
      is_recurring: item.display_tier === "recurring",
      recurrence_label: item.recurrence_label,
      card_tier: item.card_tier,
      editorial_mentions: [],
    }));
  }, [tentpoleEvents, standardEvents]);

  // Chip counts from current tab data
  const chipCounts = currentData?.chip_counts ?? {};

  // Show category chips only for Tonight / This Week
  const showCategoryChips = activeTab === "tonight" || activeTab === "this_week";

  return (
    <section>
      <FeedSectionHeader
        title="The Lineup"
        priority="secondary"
        accentColor="var(--coral)"
        icon={<Lightning weight="duotone" className="w-5 h-5" />}
        seeAllHref={`/${portalSlug}?view=happening`}
      />

      {/* Tab bar */}
      <div className="flex items-center gap-4 mb-3 border-b border-[var(--twilight)]/30 overflow-x-auto scrollbar-hide -mx-1 px-1">
        {LINEUP_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const TabIcon = TAB_ICONS[tab.id];
          const count = tabCounts[tab.id] ?? 0;

          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={[
                "shrink-0 flex items-center gap-1.5 pb-3 font-mono text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px",
                isActive
                  ? "text-[var(--cream)]"
                  : "text-[var(--muted)] hover:text-[var(--soft)] border-transparent",
              ].join(" ")}
              style={isActive ? { borderBottomColor: tab.accent } : undefined}
            >
              <TabIcon weight={isActive ? "fill" : "bold"} className="w-4 h-4" />
              {tab.label}
              {count > 0 && (
                <span
                  className="font-mono text-2xs tabular-nums px-1.5 py-0.5 rounded-full leading-none min-w-6 text-center inline-block"
                  style={
                    isActive
                      ? { backgroundColor: `color-mix(in srgb, ${tab.accent} 20%, transparent)`, color: tab.accent }
                      : { backgroundColor: "var(--twilight)", color: "var(--muted)" }
                  }
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Category chips (Tonight / This Week only) */}
      {showCategoryChips && currentData && (
        <div className="flex items-center gap-1.5 mb-3 overflow-x-auto scrollbar-none -mx-1 px-1">
          {[
            { id: "all", label: "All", color: "var(--coral)" },
            ...Object.entries(chipCounts)
              .filter(([id, count]) => id !== "all" && id !== "free" && count > 0)
              .map(([id, count]) => ({
                id,
                label: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, " "),
                color: "var(--soft)",
                count,
              })),
            ...(chipCounts["free"] ? [{ id: "free", label: "Free", color: "var(--neon-green)", count: chipCounts["free"] }] : []),
          ].map((chip) => {
            const isActive = activeChip === chip.id;
            const count = chip.id === "all" ? currentData.events.length : chipCounts[chip.id] ?? 0;
            return (
              <button
                key={chip.id}
                onClick={() => handleChipClick(chip.id)}
                className={[
                  "shrink-0 px-3 py-1.5 rounded-full font-mono text-2xs font-medium tracking-wide transition-all whitespace-nowrap",
                  isActive
                    ? "bg-[var(--coral)]/15 text-[var(--coral)] border border-[var(--coral)]/30"
                    : "text-[var(--muted)] hover:text-[var(--soft)] border border-transparent hover:border-[var(--twilight)]/40",
                ].join(" ")}
              >
                {chip.label}
                {count > 0 && (
                  <span className="ml-1 opacity-60">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Tab content */}
      {isLoading ? (
        <FeedSectionSkeleton accentColor="var(--coral)" minHeight={300} />
      ) : activeTab === "coming_up" && currentData ? (
        <ComingUpTab events={currentData.events} meta={currentData.meta} portalSlug={portalSlug} />
      ) : activeTab === "every_week" && currentData ? (
        <EveryWeekTab events={currentData.events} meta={currentData.meta} portalSlug={portalSlug} />
      ) : currentData ? (
        <>
          {/* Tonight / This Week: tiered events + recurring strip */}
          {tieredItems.length > 0 ? (
            <TieredEventList
              items={tieredItems}
              portalSlug={portalSlug}
            />
          ) : (
            <p className="py-8 text-center text-sm text-[var(--muted)]">
              No events match this filter
            </p>
          )}
          <RecurringStrip events={recurringEvents} portalSlug={portalSlug} />
        </>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`

Expect potential issues:
- `TieredEventList` may have different props — check its interface and adjust `tieredItems` mapping
- `CityPulseEventItem` shape may need additional fields — check types.ts
- `FeedSectionSkeleton` may need `onRetry` prop — add if required

Fix any TypeScript errors before proceeding.

- [ ] **Step 3: Commit**

```bash
git add web/components/feed/UnifiedLineupSection.tsx
git commit -m "feat(lineup): UnifiedLineupSection with 4 tabs and tier-aware rendering"
```

---

### Task 10: Wire into CityPulseShell

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Read the current CityPulseShell**

Read `web/components/feed/CityPulseShell.tsx` to understand the current section ordering.

- [ ] **Step 2: Replace 3 sections with unified section**

The changes to CityPulseShell:

1. Import `UnifiedLineupSection` (dynamic import for code splitting)
2. Replace the old LineupSection block + TheSceneSection block + PlanningHorizonSection block with a single UnifiedLineupSection
3. Remove the old `lineupSections`, `planningHorizonSection` splitting logic
4. Remove `fetchTab`, `tabCounts`, `categoryCounts` from useCityPulseFeed hook usage (no longer needed for lineup)

Key edits:

**Add import:**
```typescript
const UnifiedLineupSection = dynamic(
  () => import("./UnifiedLineupSection"),
  { ssr: false },
);
```

**Replace the LineupSection block** (the `<div id="city-pulse-events">` wrapper) with:
```tsx
<div
  id="city-pulse-events"
  data-feed-anchor="true"
  data-index-label="The Lineup"
  data-block-id="events"
  className="mt-4 scroll-mt-28"
>
  <UnifiedLineupSection portalSlug={portalSlug} />
</div>
```

**Remove the "recurring" case** from `renderMiddleSection()` (TheSceneSection) — it's now inside the Lineup.

**Remove the PlanningHorizonSection block** — it's now the Coming Up tab.

**Remove unused imports and variables:**
- `LineupSection`
- `TheSceneSection`
- `PlanningHorizonSection`
- `ContentSwap` (if only used for lineup)
- `TIMELINE_SECTION_TYPES`
- `lineupSections`, `planningHorizonSection` from the `useMemo`
- `fetchTab`, `tabCounts`, `categoryCounts` from `useCityPulseFeed`

- [ ] **Step 3: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -20`
Fix any issues.

- [ ] **Step 4: Test in browser**

Run: `cd web && npm run dev`

Navigate to `http://localhost:3000/atlanta` and verify:
- The Lineup section shows with 4 tabs
- Tonight tab shows events (tentpole heroes + standard cards + recurring strip)
- Clicking This Week fetches and shows events
- Clicking Coming Up shows tentpole carousel with month pills
- Clicking Every Week shows activity chips and recurring rows
- Category chips filter events on Tonight/This Week
- Tab counts update as tabs are loaded
- No console errors

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/CityPulseShell.tsx
git commit -m "feat(lineup): wire unified section into CityPulseShell, remove old 3-section layout"
```

---

### Task 11: Update feed block IDs and layout

**Files:**
- Modify: `web/lib/city-pulse/types.ts`

- [ ] **Step 1: Update FeedBlockId and DEFAULT_FEED_ORDER**

Since "recurring" (Regular Hangs) and "horizon" (On the Horizon) are now inside "events" (The Lineup), remove them from the feed order:

```typescript
// OLD
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "events", "recurring", "hangs", "cinema", "horizon", "browse",
];

// NEW — recurring and horizon absorbed into events (unified lineup)
export const DEFAULT_FEED_ORDER: FeedBlockId[] = [
  "events", "hangs", "cinema", "browse",
];
```

Also add "recurring" and "horizon" to `LEGACY_BLOCK_IDS` so existing user preferences don't break:

```typescript
export const LEGACY_BLOCK_IDS = new Set<string>([
  "timeline", "trending", "your_people", "new_from_spots", "coming_up",
  "recurring", "horizon",  // Now absorbed into unified lineup
]);
```

- [ ] **Step 2: Verify compilation**

Run: `cd web && npx tsc --noEmit --pretty 2>&1 | head -10`
Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add web/lib/city-pulse/types.ts
git commit -m "refactor(lineup): update feed block IDs — recurring and horizon absorbed into unified lineup"
```

---

### Task 12: End-to-end verification

- [ ] **Step 1: Full TypeScript build**

Run: `cd web && npx tsc --noEmit --pretty`
Expected: Zero errors

- [ ] **Step 2: Lint check**

Run: `cd web && npm run lint 2>&1 | tail -20`
Fix any linting issues.

- [ ] **Step 3: Dev server smoke test**

Run: `cd web && npm run dev`

Test the following flows:
1. Load Atlanta portal → Lineup section visible with Tonight tab active
2. Events render with 3 visual tiers (hero tentpoles, standard cards, compact recurring rows)
3. Click "This Week" → loading skeleton → events with day grouping
4. Click "Coming Up" → month pills → tentpole carousel
5. Click "Every Week" → activity chips + day filter → compact rows
6. Category chips filter Tonight/This Week events
7. "All local news" section still renders below the Lineup
8. "See Shows" section still renders
9. No "Regular Hangs" or "On the Horizon" as separate sections
10. No "Around the City" or "Worth Checking Out" sections

- [ ] **Step 4: Mobile viewport check**

Resize browser to 375px wide. Verify:
- Tabs are scrollable horizontally
- Category chips are scrollable
- Recurring strip is readable
- No horizontal overflow

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(lineup): unified lineup section — 4 tabs, 3 visual tiers, server-side filtering

Merges The Lineup, Regular Hangs, and On the Horizon into a single
section with Tonight/This Week/Coming Up/Every Week tabs.

- Tonight/This Week: blended tentpole + standard + recurring events
- Coming Up: quality-gated tentpoles with month pills
- Every Week: activity discovery with type chips and day filter
- All filtering moved server-side — client is a dumb renderer
- 'All' truly means all events (no union matcher restriction)
- Tab counts always accurate (derived from actual event pool)"
```

---

## Post-Launch Cleanup (separate PR)

These are NOT part of this plan but should be tracked:

1. **Remove old city-pulse tab mode** — route.ts lines 180–321 (the `?tab=` handler) are dead code once the new `/lineup` endpoint is live
2. **Remove old section builders** — `buildTabEventPool()` in section-builders.ts is unused
3. **Remove old components** — LineupSection.tsx, TheSceneSection.tsx, PlanningHorizonSection.tsx can be deleted
4. **Remove old interests system** — `buildUnionMatcher()`, `INTEREST_CHIPS` config, interest picker UI are replaced by simple category chips
5. **Social proof integration** — the new API doesn't fetch going_count or friends_going yet. Add as a Phase 2 enrichment.
6. **SSR optimization** — tonight data could be embedded in the initial city-pulse response to eliminate the client fetch. Same pattern as current `serverFeedData`.
7. **Pre-computed tab counts** — fetch lightweight counts for all tabs on initial load so badges show before tabs are clicked.
