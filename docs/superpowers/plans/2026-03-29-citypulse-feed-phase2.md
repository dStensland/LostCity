# CityPulse Feed Redesign — Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich feed event cards with place data (Google ratings, open status), rewire the Destinations section with context lenses, and make the Browse grid alive with real content, badges, and data-driven collections.

**Architecture:** Three independent workstreams — (1) Enriched Cards adds a `place_vertical_details.google` join to EVENT_SELECT and renders rating/status on StandardRow, HeroCard, and RecurringStrip; (2) Destinations is a pipeline rewire from occasion-only to multi-lens with self-fetching lazy load; (3) Grid passes the event pool to `buildBrowseSection` for per-category snippets and adds a lazy-loaded collections row.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Vitest, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-29-citypulse-feed-redesign.md` (Section 2: Enriched Cards, Section 4: Destinations, Section 6: The Grid)

**Prerequisite:** Phase 0 data layer from Unified Find spec — COMPLETE. `place_profile` and `place_vertical_details` wired into `/api/spots` and `getSpotDetail()`.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `web/lib/city-pulse/pipeline/fetch-destinations-v2.ts` | Multi-lens destinations fetch — replaces occasion-only `fetch-destinations.ts` |
| `web/lib/city-pulse/pipeline/fetch-destinations-v2.test.ts` | Tests for lens filtering, data gates, fallback |
| `web/components/feed/sections/DestinationsSectionV2.tsx` | Destinations section with context lens chips, self-fetching |
| `web/app/api/portals/[slug]/destinations/route.ts` | Destinations API — returns ~20 places with lens metadata |
| `web/components/feed/sections/BrowseGridTile.tsx` | Individual alive browse tile — count, snippet, badge |
| `web/app/api/portals/[slug]/collections/route.ts` | Collections API — returns data-driven themed bundles |
| `web/components/feed/sections/CollectionsRow.tsx` | Horizontal scroll of collection cards |

### Modified Files
| File | Changes |
|------|---------|
| `web/lib/city-pulse/pipeline/fetch-events.ts` | Add `place_vertical_details(google)` to EVENT_SELECT venue join |
| `web/components/EventCard.tsx` | Extend `FeedEventData` venue type with `google_rating`, `google_rating_count` (venue type defined here, ~line 139) |
| `web/components/feed/StandardRow.tsx` | Render optional Google rating badge |
| `web/components/feed/HeroCard.tsx` | Render optional Google rating in metadata row |
| `web/components/feed/lineup/RecurringStrip.tsx` | Render optional Google rating in event rows |
| `web/components/feed/sections/NowShowingSection.tsx` | Add Google rating to theater/venue cards (See Shows enrichment) |
| `web/lib/city-pulse/section-builders.ts` | Pass `todayEventsPool` to `buildBrowseSection`, add per-category representative event |
| `web/lib/city-pulse/pipeline/build-sections.ts` | Thread event pool to browse builder |
| `web/components/feed/sections/BrowseSection.tsx` | Replace static tiles with alive BrowseGridTile, add collections row |
| `web/components/feed/CityPulseShell.tsx` | Wire DestinationsSectionV2 as lazy-loaded section |

---

## Task 1: Extend EVENT_SELECT with Google Ratings

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts:25-35`
- Modify: `web/components/EventCard.tsx` (FeedEventData venue type defined here, ~line 139)

- [ ] **Step 1: Add Google rating join to EVENT_SELECT**

In `fetch-events.ts`, extend the `venue:places(...)` join to include `place_vertical_details`:

Current:
```
venue:places(id, name, neighborhood, slug, place_type, location_designator, city, image_url, is_active)
```

Change to:
```
venue:places(id, name, neighborhood, slug, place_type, location_designator, city, image_url, is_active, place_vertical_details(google))
```

This is a nested PostgREST join — `place_vertical_details` is keyed by `place_id` (FK to `places.id`). The `google` column is a JSONB field containing `{ rating, rating_count, price_level, ... }`.

- [ ] **Step 2: Extend FeedEventData venue type**

In `web/components/EventCard.tsx`, find the venue shape within `FeedEventData` (around line 139-147). The venue type is defined here, NOT in `types.ts`. Add:

```typescript
google_rating?: number | null;
google_rating_count?: number | null;
```

These should be extracted from the nested join: `venue.place_vertical_details?.google?.rating`.

**Note on cuisine/price and open status:** The spec also lists cuisine/price (from `place_vertical_details.dining`) and open/closed status (from `places.hours`) as enrichment fields. These are **deferred within Phase 2** — the Google rating is the highest-value, lowest-risk enrichment. Cuisine/price requires additional join complexity and rendering space. Open/closed requires real-time computation from hours JSONB. Both can be added as follow-up tasks after the rating is verified working.

- [ ] **Step 3: Map the nested data in the pipeline**

In `fetch-events.ts`, after the query returns, map the nested `place_vertical_details.google` data into flat `google_rating` / `google_rating_count` fields on each event's venue object. Check how the existing pipeline transforms raw query results into `FeedEventData` — follow that pattern. The nested join returns:

```typescript
venue: {
  id, name, ...,
  place_vertical_details: [{ google: { rating: 4.5, rating_count: 200, ... } }] | null
}
```

Extract: `venue.place_vertical_details?.[0]?.google?.rating` → `venue.google_rating`.

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(feed): add Google ratings to EVENT_SELECT venue join"
```

---

## Task 2: Render Ratings on StandardRow

**Files:**
- Modify: `web/components/feed/StandardRow.tsx`

- [ ] **Step 1: Read current StandardRow**

Understand the layout: accent bar + title + venue/time metadata row + price badge.

- [ ] **Step 2: Add optional rating badge**

After the venue name in the metadata row, add a rating badge when available:

```tsx
{event.venue?.google_rating != null && (
  <>
    <Dot />
    <span className="text-xs text-[var(--gold)]">
      {event.venue.google_rating.toFixed(1)} ★
    </span>
  </>
)}
```

Use the `<Dot />` component from `@/components/ui/Dot` for the separator. Use `var(--gold)` for the star rating (time/featured accent). Only render when `google_rating` is non-null.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): show Google rating on StandardRow event cards"
```

---

## Task 3: Render Ratings on HeroCard

**Files:**
- Modify: `web/components/feed/HeroCard.tsx`

- [ ] **Step 1: Add rating to metadata row**

In `buildMetadataRow()` (around line 55-78), add the venue rating as an additional metadata element when available:

```typescript
if (event.venue?.google_rating != null) {
  parts.push(`${event.venue.google_rating.toFixed(1)} ★`);
}
```

This keeps it in the existing metadata flow. No separate badge needed — the hero card's metadata row already handles multiple elements with separators.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): show Google rating on HeroCard metadata row"
```

---

## Task 4: Render Ratings on RecurringStrip

**Files:**
- Modify: `web/components/feed/lineup/RecurringStrip.tsx`

- [ ] **Step 1: Add rating to recurring event rows**

In the event row rendering (around line 225-275), after the venue name + time, add:

```tsx
{ev.event.venue?.google_rating != null && (
  <>
    <Dot />
    <span className="text-[var(--gold)]">
      {ev.event.venue.google_rating.toFixed(1)} ★
    </span>
  </>
)}
```

Keep it compact — the recurring strip rows are dense. Only the star rating, no review count.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): show Google rating on recurring event rows"
```

---

## Task 5: Render Ratings on See Shows Theater Cards

**Files:**
- Modify: `web/components/feed/sections/NowShowingSection.tsx`

The spec says enriched cards apply to Lineup AND See Shows. The whats-on/showtimes API already joins `place_vertical_details.google` (done in Phase 1 See Shows enrichment task). The theater/venue cards in NowShowingSection need to render the rating.

- [ ] **Step 1: Read NowShowingSection.tsx**

Find where theater name/venue info is rendered in the film cards. Check what data is available — the `TheaterFilm` type should already include `google_rating` from the Phase 1 showtimes API enrichment.

- [ ] **Step 2: Add rating next to theater name**

After the theater name in film rows, add the rating when available:

```tsx
{film.google_rating != null && (
  <>
    <Dot />
    <span className="text-xs text-[var(--gold)]">
      {film.google_rating.toFixed(1)} ★
    </span>
  </>
)}
```

Follow the same pattern as StandardRow (Task 2). Check if the field name is `google_rating` or something else in the NowShowingSection's type — adapt accordingly.

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): show Google rating on See Shows theater cards"
```

---

## Task 6: Destinations API Endpoint

**Files:**
- Create: `web/app/api/portals/[slug]/destinations/route.ts`

- [ ] **Step 1: Build the destinations API**

This is a new self-fetching endpoint that returns ~20 places with all lens metadata. The response includes essential fields only (no full profiles — those load on detail tap).

```typescript
// GET /api/portals/[slug]/destinations
// Returns: { destinations: DestinationV2Item[], lensAvailability: Record<string, boolean> }
```

**Query strategy (two queries, not one complex join):**

**Query A:** Fetch ~30 active places from `places` with nested PostgREST joins:
```
.from("places")
.select("id, name, slug, neighborhood, place_type, image_url, hours, indoor_outdoor, created_at, place_profile(hero_image_url, short_description, wheelchair, family_suitability), place_vertical_details(google, outdoor)")
.eq("is_active", true)
.eq("city", portalCity)
.limit(30)
```

**Query B:** Fetch closing exhibitions separately (PostgREST can't do a reverse FK join from places→exhibitions in the same select):
```
.from("exhibitions")
.select("id, title, closing_date, place_id, venue:places(name)")
.gte("closing_date", today)
.lte("closing_date", today14)
.limit(10)
```

Merge Query B results into Query A results by matching `place_id`. Places with a closing exhibition get `closing_exhibition: { title, days_remaining }`.

Both queries run in parallel via `Promise.all`.

Return top 20 with flat fields:
```typescript
{
  id, name, slug, neighborhood, place_type, image_url,
  google_rating, google_rating_count,
  is_open: boolean | null,  // computed from hours + current time
  created_at,  // for "new" lens
  indoor_outdoor,
  wheelchair, family_suitability,  // from place_profile
  closing_exhibition?: { title, days_remaining },  // from Query B
  short_description,
}
```
4. Compute `lensAvailability`: check if enough destinations have data for each lens
   - `weather: true` (always — uses indoor_outdoor)
   - `closing_soon: closingCount >= 1`
   - `new: newCount >= 3` (created_at within 30 days)
   - `open_now: openCount >= 5` (have hours data)
   - `top_rated: ratedCount >= 6` (have google_rating)

**Cache:** 5 minutes, shared server cache.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Test with curl**

Run: `curl -s http://localhost:3000/api/portals/atlanta/destinations | jq '.destinations | length'`
Expected: A number (5-20 depending on data)

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): add multi-lens destinations API endpoint"
```

---

## Task 7: DestinationsSection V2 Component

**Files:**
- Create: `web/components/feed/sections/DestinationsSectionV2.tsx`

- [ ] **Step 1: Build the component**

Self-fetching lazy-loaded section with context lens chips.

**Structure:**
1. Header: "Destinations" title + "Explore all →" link
2. Lens chip row: horizontal scroll of filter chips (Weather, Closing Soon, New, Open Now, Top Rated)
   - Each chip conditionally shown based on `lensAvailability` from API
   - Active chip highlighted with accent color
   - Default: no lens active (smart mix)
3. Card list: vertical list of destination cards (not carousel — vertical is more scannable)

**Destination card:**
- Image (60x60 rounded, with `<SmartImage>` + themed gradient fallback)
- Name + neighborhood + place_type
- Google rating + review count (when available, gold accent)
- Open/closed status badge (green "Open" / muted "Closed")
- Contextual line per active lens:
  - Weather: "72° and clear — perfect evening"
  - Closing Soon: "Basquiat closes in 12 days" (neon-red)
  - New: "Opened 2 weeks ago" (gold)

**Lens switching is client-side** — fetch once, filter/sort locally per lens.

**Empty state:** If fewer than 2 destinations after filtering, show nothing (return null).

**Design system:**
- Use `<FeedSectionHeader>` for the section header
- Use `<SmartImage>` for all images (NEVER `<Image>`)
- Use `<Badge>` for status badges
- Use `<Dot />` for metadata separators
- Lens chips: use `<FilterChip>` if available, or hand-roll per the chip recipe
- All colors from CSS variable tokens

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): add DestinationsSectionV2 with context lens chips"
```

---

## Task 8: Wire Destinations into Shell

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Import and render DestinationsSectionV2**

Add a dynamic import for `DestinationsSectionV2` (same pattern as other lazy sections):

```typescript
const DestinationsSectionV2 = dynamic(
  () => import("./sections/DestinationsSectionV2").then(m => ({ default: m.DestinationsSectionV2 })),
  { ssr: false }
);
```

Render it after the Lineup and before See Shows, wrapped in `<LazySection>`:

```tsx
<LazySection minHeight={300}>
  <DestinationsSectionV2 portalSlug={portalSlug} />
</LazySection>
```

Remove the old commented-out DestinationsSection reference.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): wire DestinationsSectionV2 into shell as lazy-loaded section"
```

---

## Task 9: Alive Browse Grid Tiles

**Files:**
- Create: `web/components/feed/sections/BrowseGridTile.tsx`
- Modify: `web/lib/city-pulse/section-builders.ts`
- Modify: `web/lib/city-pulse/pipeline/build-sections.ts`

- [ ] **Step 1: Extend buildBrowseSection to accept event pool**

In `section-builders.ts`, modify `buildBrowseSection` signature to accept the today event pool:

```typescript
export function buildBrowseSection(
  portalSlug: string,
  venueTypeCounts?: Record<string, number>,
  eventCategoryCounts?: Record<string, number>,
  todayEvents?: FeedEventData[],  // NEW: for per-category representative events
): CityPulseSection
```

Add logic to pick one representative event per category (highest-tier event with an image):

```typescript
const categoryRepresentatives: Record<string, { title: string; venue_name: string }> = {};
if (todayEvents) {
  for (const event of todayEvents) {
    const cat = event.category;
    if (cat && !categoryRepresentatives[cat] && event.title) {
      categoryRepresentatives[cat] = {
        title: event.title,
        venue_name: event.venue?.name ?? "",
      };
    }
  }
}
```

Add `category_representatives` to the returned `meta`.

- [ ] **Step 2: Thread event pool in build-sections.ts**

In `build-sections.ts`, where `buildBrowseSection` is called, pass `pools.todayEvents` as the new parameter.

- [ ] **Step 3: Build BrowseGridTile component**

```typescript
interface BrowseGridTileProps {
  category: string;
  label: string;
  count: number;
  accentColor: string;
  snippet?: { title: string; venue_name: string } | null;  // desktop only
  badge?: "pulse" | "new" | "closing" | null;
  href: string;
}
```

Renders a jewel-tone tile with:
- Category name (text-sm font-semibold)
- Live count (text-xl font-bold, accent color)
- Count label ("this week" / "open now")
- Content snippet (desktop only — hide at <640px with `hidden sm:block`)
- Corner badge (pulse dot / NEW / CLOSING)

Tile links to `href` (Find lane or interim target).

- [ ] **Step 4: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(feed): alive browse grid with per-category snippets and badges"
```

---

## Task 10: Update BrowseSection to Use Alive Tiles

**Files:**
- Modify: `web/components/feed/sections/BrowseSection.tsx`

- [ ] **Step 1: Read current BrowseSection**

Understand the two-tab structure (Things to Do + Places to Go) and how tiles are rendered.

- [ ] **Step 2: Replace static tiles with BrowseGridTile**

Import `BrowseGridTile` and replace the current tile rendering with the alive version. Pass:
- `count` from `category_counts` (already in meta)
- `snippet` from `category_representatives` (new in meta, desktop only)
- `badge` logic:
  - Pulse: check if any event in that category starts within 1 hour (derive from representative event or a separate `happeningNowCategories` set in meta)
  - NEW: check if `category_representatives[cat]` has a recent `created_at` (skip for now — low priority)
  - CLOSING: check if exhibitions closing in that category (from `closingSoonExhibitions` if available in meta)
- `href`: `/${portalSlug}?view=find&lane=${lane}` or interim `?view=happening&categories=${cat}`

- [ ] **Step 3: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): render alive BrowseGridTile in BrowseSection"
```

---

## Task 11: Collections API Endpoint

**Files:**
- Create: `web/app/api/portals/[slug]/collections/route.ts`

- [ ] **Step 1: Build the collections endpoint**

Returns data-driven themed bundles for the feed grid. Each collection is a parameterized query.

```typescript
// GET /api/portals/[slug]/collections
// Returns: { collections: Collection[] }
```

**Collections to generate (each is a bounded query, max 10 results):**

1. **Free This Weekend** — `events WHERE is_free = true AND start_date IN (next sat, next sun) LIMIT 10`
2. **Date Night [Neighborhood]** — restaurants + shows in tonight's top-count neighborhood. Neighborhood selected by: `SELECT neighborhood, COUNT(*) FROM events JOIN places ON ... WHERE start_date = today GROUP BY neighborhood ORDER BY count DESC LIMIT 1`
3. **New in Atlanta** — `places WHERE created_at > now() - 30 days LIMIT 10`
4. **Family Sunday** — `events WHERE category = 'family' AND start_date = next_sunday LIMIT 10` (only generated on Sat/Sun)
5. **Closing Soon** — `exhibitions WHERE closing_date BETWEEN now AND now+14d LIMIT 10`

Each collection returns: `{ title, count, slug, categories: string[], href: string }`.

Collections with 0 results are excluded from the response.

**Cache:** 15 minutes.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Test with curl**

Run: `curl -s http://localhost:3000/api/portals/atlanta/collections | jq '.collections | length'`

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(feed): add data-driven collections API endpoint"
```

---

## Task 12: Collections Row Component

**Files:**
- Create: `web/components/feed/sections/CollectionsRow.tsx`

- [ ] **Step 1: Build CollectionsRow**

Horizontal scroll of collection cards below the browse grid. Self-fetching from `/api/portals/[slug]/collections`.

```typescript
interface CollectionsRowProps {
  portalSlug: string;
}
```

**Card design:**
- Container: `bg-white/[0.04] border border-white/[0.08] rounded-lg px-3.5 py-2.5`
- Title: `text-sm text-[var(--cream)] font-medium`
- Subtitle: `text-xs text-[var(--muted)]` — count + categories ("24 events · All free")
- Horizontal scroll: `flex gap-2 overflow-x-auto scrollbar-hide`
- Each card links to Find with appropriate filters

**Empty state:** Returns null if no collections.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): add CollectionsRow component for data-driven bundles"
```

---

## Task 13: Wire Collections into BrowseSection

**Files:**
- Modify: `web/components/feed/sections/BrowseSection.tsx`

- [ ] **Step 1: Add CollectionsRow below the grid**

Import `CollectionsRow` and render it after the browse grid tiles:

```tsx
{/* Collections row */}
<div className="mt-6">
  <CollectionsRow portalSlug={portalSlug} />
</div>
```

The CollectionsRow self-fetches and handles its own empty state.

- [ ] **Step 2: Verify build**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(feed): wire CollectionsRow into BrowseSection"
```

---

## Task 14: Final Integration & Verification

- [ ] **Step 1: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All new tests pass. No regressions.

- [ ] **Step 2: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: Clean build.

- [ ] **Step 3: Visual smoke test**

Run dev server and verify:
1. **Enriched Cards:** Event cards in the Lineup show Google ratings (★ badge) where available
2. **Destinations:** New section renders between Lineup and See Shows with context lens chips
3. **Destinations lenses:** Tapping a lens chip filters the list. Lenses with insufficient data are hidden.
4. **Browse Grid:** Tiles show live counts, content snippets on desktop (hidden on mobile)
5. **Collections Row:** Horizontal scroll of themed bundles below the browse grid
6. **Console:** Zero errors

- [ ] **Step 4: Commit any fixes**

```bash
git commit -m "fix(feed): Phase 2 integration fixes"
```
