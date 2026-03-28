---
description: Use when building or modifying CityPulse feed sections, debugging feed data issues, adding new section builders, or working with RecurringStrip, activity types, or feed time filtering
---

# CityPulse Feed Section

$ARGUMENTS

## Overview

The CityPulse feed is a 6-stage data pipeline that transforms event pools into rendered feed sections. This skill codifies the pipeline architecture, section builder pattern, and the gotchas that have caused the most bug-fix churn (time filtering, dedup, activity types).

## Pipeline Architecture

```
Stage 1: resolve-portal     → Portal lookup, auth, time context, manifest
Stage 2: fetch-events       → Event pools (today, trending, horizon)
Stage 3: fetch-counts       → Tab/category counts
Stage 4: fetch-enrichments  → Weather venues, specials, editorial, social proof
Stage 5: build-sections     → Section assembly from pools + enrichments
Stage 6: assemble-response  → Final response + cross-section dedup
```

**Entry point:** `GET /api/portals/[slug]/city-pulse`
**Query params:** `?time_slot=`, `?day=`, `?tab=this_week|coming_up`, `?interests=chip1,chip2`
**Caching:** 5 min anon / 1 min auth, keyed by `${slug}|${timeSlot}|${today}`

## Adding a New Section

### 1. Write the builder function

In `web/lib/city-pulse/section-builders.ts`:

```typescript
export function buildMyNewSection(
  ctx: PipelineContext,
  pools: EventPools,
  signals: ScoringSignals,
  friendsMap: FriendsMap,
  editorialMap: EditorialMap,
): CityPulseSection | null {
  // Filter events from pools
  const candidates = pools.todayEvents.filter(e => /* your criteria */);
  if (candidates.length === 0) return null; // Return null = section omitted

  // Wrap with makeEventItem
  const items = candidates.slice(0, 8).map(e =>
    makeEventItem(e, { contextual_label: "My Label" }, editorialMap)
  );

  return {
    type: "my_new_section",
    title: "Section Title",
    subtitle: "Optional subtitle",
    items,
    layout: "carousel", // or "grid", "list"
  };
}
```

### 2. Wire it into build-sections

In `web/lib/city-pulse/pipeline/build-sections.ts`, call your builder and add it to the sections array. Position determines display order. Return `null` to omit.

### 3. Render it

The feed renderer maps `section.type` to a component. Add your section type to the switch/map in the feed view component.

**Key rule:** Sections return `null` when they have no data. They are filtered with `.filter(Boolean)` before rendering. Never render an empty section.

## makeEventItem — The Transform Layer

```typescript
function makeEventItem(event, opts?, editorialMap?): CityPulseEventItem
```

**What it does:**
1. Computes `activity_type` via `matchActivityType()` — **only for recurring events** (has `series_id` or `is_recurring=true`)
2. Assigns `card_tier` via `getCardTier()` — hero (score >= 30), featured (>= 15), standard
3. Attaches editorial mentions from `editorialMap`
4. Wraps everything into the `CityPulseEventItem` display shape

**Never removes events** — only annotates them. Filtering happens before calling makeEventItem.

### Card Tier Scoring

| Signal | Points |
|--------|--------|
| `is_tentpole` | +40 |
| `importance = "flagship"` | +40 |
| `importance = "major"` | +20 |
| `is_featured` or `featured_blurb` | +15 |
| `festival_id` | +30 |
| Editorial mention | +15 |
| Has `image_url` | +10 |
| Friends going > 0 | → featured (minimum) |

Thresholds: >= 30 hero, >= 15 featured, else standard.

## Time Filtering — The #1 Source of Bugs

### Late-night continuity

```typescript
// In resolve-portal.ts:
if (effectiveNow.getHours() < 5) {
  effectiveNow.setDate(effectiveNow.getDate() - 1);
}
// Between midnight–5am, "today" = yesterday. Sunday night doesn't end at midnight.
```

### Time format mismatch (HH:MM vs HH:MM:SS)

**DB returns** `start_time` as `"18:00:00"` (with seconds).
**Client helpers** return `"18:45"` (HH:MM only).

**Always slice:** `startTime.slice(0, 5)` before comparing. This caused multiple RecurringStrip bugs.

### Local time, not UTC

Use `Intl.DateTimeFormat` with portal timezone (`"America/New_York"` for Atlanta). Never use `new Date().toISOString()` for date comparisons — it's UTC.

### ISO day convention

DB stores ISO 8601: 1=Mon, 7=Sun. JS `getDay()` returns 0=Sun, 6=Sat. Convert with:
```typescript
function getIsoDay(dateStr: string): number {
  const jsDay = new Date(dateStr + "T00:00:00").getDay();
  return jsDay === 0 ? 7 : jsDay;
}
```

### Time slots

```typescript
hour >= 22 || hour < 5  → "late_night"
hour >= 18              → "evening"
hour >= 15              → "happy_hour"
hour >= 11              → "midday"
hour >= 5               → "morning"
```

## Deduplication — Three Strategies

| Strategy | Function | When to use |
|----------|----------|-------------|
| Per-series | `deduplicateSeries()` | Section building — keep 1 per series_id (next occurrence) |
| Per-venue-day | `deduplicateByVenueDay()` | Recurring display — same trivia at 6 venues = 6 items |
| Cross-section | Set in `assemble-response.ts` | Final pass — same event can't appear in two sections |

**Per-series** marks kept events: `is_recurring=true`, `recurrence_label="Every Monday"`.

## Activity Types & RecurringStrip

**29 activity types** defined in `web/lib/scene-event-routing.ts` (`SCENE_ACTIVITY_TYPES`).

**Matching order:** genre match → category + title → title-only.

**`isSceneEvent()`** determines if an event routes to RecurringStrip vs regular sections:
- Must be recurring (series_id or is_recurring)
- Must NOT be tentpole, festival, touring, or one-night-only
- Must match a recognized activity type

**RecurringStrip** (`web/components/feed/lineup/RecurringStrip.tsx`):
- Activity chip filters (Trivia, Karaoke, Comedy, etc.)
- Day-of-week filter
- Hides past events for TODAY only (not future days)
- Shows 6 initially, expandable
- Links to full `/[portal]/regulars` page

## Event Pools

The pipeline fetches three pools in Stage 2:

| Pool | Contents | Source query |
|------|----------|--------------|
| `todayEvents` | Today's events + evening supplemental | Portal-scoped, merged |
| `trendingEvents` | 2-week high social proof events | Social proof join |
| `horizonEvents` | 7–180 day tentpoles/festivals/multi-day | Quality-gated |

**Post-processing** on all pools (in order):
1. Suppress images for flagged venues
2. Filter out inactive venue events
3. Deduplicate by event ID
4. Filter out registration-code events (USTA/ALTA)

## React Query Cache Pattern

**Cache key:** `["city-pulse", portalSlug, timeSlot, dayOverride, interestsKey]`

- **Sort interests** before joining: `interests?.slice().sort().join(",")` — otherwise different orderings create different cache keys
- **`keepPreviousData`** prevents skeleton flash when filters change
- **Server-side seed:** `getServerFeedData()` embeds feed in HTML; client revalidates after `staleTime: 2min`
- **Stale times:** Anon = 5 min server + 1 hour SWR. Auth = 1 min + 2 min SWR.

## Section Builders Reference

| Builder | Section Type | Data Source |
|---------|-------------|-------------|
| `buildBannerSection` | banner | Always present |
| `buildRightNowSection` | right_now | Today's time-slot events + specials |
| `buildTonightSection` | tonight | Today evening events |
| `buildTrendingSection` | trending | 2-week social proof |
| `buildPlanningHorizonSection` | planning_horizon | 7–180 day tentpoles |
| `buildWeatherDiscoverySection` | weather_discovery | Weather-matched venues |
| `buildYourPeopleSection` | your_people | Events with friends (auth) |
| `buildNewFromSpotsSection` | new_from_spots | Followed venues (auth) |
| `buildBrowseSection` | browse | Category grid (always present) |
| `buildTabEventPool` | this_week / coming_up | Uncapped pool for tab mode |

## Common Mistakes

- **Using `router.push()` for filter state** → Triggers full Next.js navigation. Use `useState` + `window.history.replaceState()` for instant toggling.
- **Comparing `HH:MM:SS` with `HH:MM`** → Always `.slice(0, 5)` the DB time.
- **Using UTC dates for "today"** → Use local timezone via `Intl.DateTimeFormat`.
- **Forgetting cross-section dedup** → Same event appears in multiple sections.
- **Returning empty array instead of null** → Section renders with no items. Return `null` to omit.
- **Not filtering scene events from regular sections** → Recurring events double-counted in both RecurringStrip and Tonight.

## Key Files

| File | Purpose |
|------|---------|
| `web/lib/city-pulse/pipeline/index.ts` | Pipeline barrel exports |
| `web/lib/city-pulse/pipeline/resolve-portal.ts` | Stage 1: portal + time context |
| `web/lib/city-pulse/pipeline/fetch-events.ts` | Stage 2: event pools + EVENT_SELECT |
| `web/lib/city-pulse/pipeline/build-sections.ts` | Stage 5: section assembly |
| `web/lib/city-pulse/pipeline/assemble-response.ts` | Stage 6: final response + dedup |
| `web/lib/city-pulse/section-builders.ts` | All section builder functions + makeEventItem |
| `web/lib/city-pulse/tier-assignment.ts` | Card tier scoring |
| `web/lib/city-pulse/time-slots.ts` | Time slot classification |
| `web/lib/scene-event-routing.ts` | Activity type matching + isSceneEvent |
| `web/app/api/portals/[slug]/city-pulse/route.ts` | API endpoint |
| `web/lib/hooks/useCityPulseFeed.ts` | React Query hook |
| `web/components/feed/lineup/RecurringStrip.tsx` | Recurring events component |
