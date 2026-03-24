# Atlanta Portal Performance & Data Architecture Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce cold-load waterfall, shrink API payloads, fix missing DB indexes, and eliminate unnecessary per-request queries for the Atlanta portal feed.

**Architecture:** The feed currently renders a skeleton, hydrates JS, fires a main API call, then 6+ self-fetching sections fire their own requests. This plan attacks the waterfall from three angles: make first paint meaningful earlier (server-side hero preload), reduce round-trips (embed destinations in city-pulse), and shrink what's transferred (strip descriptions, move filters server-side). Database fixes (indexes, `updated_at` triggers, YMCA cache) run in parallel as migrations.

**Tech Stack:** Next.js 16, Supabase/PostgreSQL, React Query, Vercel

**Audit sources:** Architecture review, performance engineer, data specialist — all run 2026-03-24.

---

## Task 1: Server-side hero image preload

The hero photo is the LCP element but its URL is only computed after JS hydrates. `getCityPhoto()` is a pure function of time-of-day + day-of-week — it can run server-side.

**Files:**
- Modify: `web/app/[portal]/page.tsx` (server component — compute hero URL, pass as prop)
- Modify: `web/app/[portal]/_templates/default.tsx` (accept heroImageUrl prop, pass to shell)
- Modify: `web/components/feed/CityPulseShell.tsx` (accept serverHeroUrl prop)
- Modify: `web/components/feed/CityBriefing.tsx` (use server-provided URL as initial state)

- [ ] **Step 1: Compute hero URL server-side in page.tsx**

Import `getCityPhoto` and `getDayOfWeek` from `web/lib/city-pulse/header-defaults.ts` and `web/lib/city-pulse/time-slots.ts`. Compute the URL in the server component and pass it to `DefaultTemplate`.

- [ ] **Step 2: Thread the URL through DefaultTemplate → CityPulseShell → CityBriefing**

Add a `serverHeroUrl?: string` prop to each component. In CityBriefing, use it as the initial value for `heroImageUrl` state instead of computing client-side.

- [ ] **Step 3: Add `<link rel="preload">` in page head**

In `page.tsx`, use Next.js metadata or a `<head>` tag to emit:
```html
<link rel="preload" as="image" href="{heroUrl}" fetchpriority="high" />
```

This lets the browser start downloading the hero image during HTML parse, before any JS executes.

- [ ] **Step 4: Verify with browser DevTools**

Load `/atlanta` with DevTools Network tab. Confirm the hero image request starts during HTML parse (before JS bundle). Check LCP in Lighthouse.

- [ ] **Step 5: Commit**

```
feat: server-side hero image preload for LCP improvement
```

---

## Task 2: Strip event descriptions from feed response

Feed cards never display full descriptions. Removing them from the API response saves 20-30% payload.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts` (trim EVENT_SELECT)
- Modify: `web/lib/city-pulse/types.ts` (make `description` optional in feed types if needed)

- [ ] **Step 1: Find the EVENT_SELECT constant in fetch-events.ts**

Locate the select string that includes `description`. Replace with `description_excerpt` computed as a substring, or remove entirely.

- [ ] **Step 2: Check all feed components for description usage**

Grep for `event.description` or `e.description` across `web/components/feed/`. Confirm none of them render the full description. The `EditorialCallout` and `PressQuote` components use `snippet` from editorial_mentions, not event description.

- [ ] **Step 3: Remove description from the select**

If no feed component uses it, remove `description` from EVENT_SELECT entirely. If any component uses a truncated version, replace with a Postgres `LEFT(description, 150)` alias.

- [ ] **Step 4: Verify response size reduction**

Use DevTools Network tab to compare city-pulse response size before/after. Target: 20%+ reduction.

- [ ] **Step 5: Commit**

```
perf: strip event descriptions from feed API response
```

---

## Task 3: Embed destinations in city-pulse response

Destinations are above the fold but fire a separate API call after the main feed loads. Embedding them eliminates a round-trip.

**Files:**
- Modify: `web/app/api/portals/[slug]/city-pulse/route.ts` (add destinations to response)
- Modify: `web/lib/city-pulse/types.ts` (add `destinations` field to CityPulseResponse)
- Modify: `web/components/feed/CityPulseShell.tsx` (pass embedded destinations to section)
- Modify: `web/components/feed/sections/DestinationsSection.tsx` (accept data as prop, skip self-fetch when provided)
- Modify: `web/app/api/portals/[slug]/destinations/route.ts` (parallelize internal queries)

- [ ] **Step 1: Parallelize the destinations route internally**

In `destinations/route.ts`, the venue query (step 2) and editorial_mentions query (step 3) depend on venue_occasions IDs but not each other. Wrap them in `Promise.all`. Also parallelize the fallback path queries.

- [ ] **Step 2: Extract destinations logic into a shared function**

Create a `fetchDestinations(portalSlug, supabase)` function that both the standalone route and the city-pulse pipeline can call. Keep the existing route as a thin wrapper.

- [ ] **Step 3: Call fetchDestinations in the city-pulse pipeline**

Add it to the Phase A `Promise.all` in the city-pulse route. Include the result in the response as `destinations: DestinationItem[]`.

- [ ] **Step 4: Update DestinationsSection to accept embedded data**

Add an optional `initialData` prop. When provided, skip the self-fetch and render immediately. CityPulseShell passes `data?.destinations` through.

- [ ] **Step 5: Verify one fewer network request**

DevTools Network tab: confirm `/api/portals/atlanta/destinations` no longer fires on feed load.

- [ ] **Step 6: Commit**

```
perf: embed destinations in city-pulse response, parallelize queries
```

---

## Task 4: Parallax scroll — bypass React rendering

Two `setState` calls per scroll frame cause two React re-renders per frame in CityBriefing.

**Files:**
- Modify: `web/components/feed/CityBriefing.tsx` (replace state with CSS custom properties)

- [ ] **Step 1: Replace parallax state with CSS variable approach**

Remove `parallaxY` and `contentParallax` state. In the scroll handler, set CSS custom properties on the hero ref element:
```typescript
el.style.setProperty("--parallax-y", `${offset * 0.4}px`);
el.style.setProperty("--parallax-weather", `${offset * 0.15}px`);
el.style.setProperty("--parallax-masthead", `${offset * 0.08}px`);
el.style.setProperty("--parallax-meta", `${offset * 0.04}px`);
```

- [ ] **Step 2: Update layout variants to use CSS variables**

Replace inline `style={{ transform: translateY(${parallaxY}px) }}` with `style={{ transform: "translateY(var(--parallax-y, 0px))" }}` etc. across CenteredLayout, BottomLeftLayout, SplitLayout, EditorialLayout, FlagshipHeroContent.

- [ ] **Step 3: Remove will-change-transform from non-essential elements**

Keep `will-change-transform` only on the hero background image div. Remove from the 11 text/content elements that have tiny parallax offsets.

- [ ] **Step 4: Verify smooth scrolling**

Open DevTools Performance tab, record a scroll interaction. Confirm no React re-renders during scroll (no component function calls in the flame chart).

- [ ] **Step 5: Commit**

```
perf: bypass React rendering in parallax scroll handler
```

---

## Task 5: Code-split below-fold feed sections

LazySection defers rendering but all section JS is in the initial bundle.

**Files:**
- Modify: `web/components/feed/CityPulseShell.tsx` (dynamic imports for below-fold sections)

- [ ] **Step 1: Convert below-fold imports to next/dynamic**

Replace static imports with dynamic imports for:
- `TheSceneSection`
- `SeeShowsSection`
- `PlanningHorizonSection`
- `PortalTeasersSection`
- `FeedTimeMachine`
- `YonderRegionalEscapesSection`
- `YonderDestinationNodeQuestsSection`

```typescript
import dynamic from "next/dynamic";
const TheSceneSection = dynamic(() => import("./sections/TheSceneSection"), { ssr: false });
// ... etc
```

Keep above-fold components (CityBriefing, LineupSection, DestinationsSection) as static imports.

- [ ] **Step 2: Verify chunk splitting**

Run `npm run build` and check `.next/analyze` or build output for separate chunks. The main feed chunk should be smaller.

- [ ] **Step 3: Commit**

```
perf: code-split below-fold feed sections with next/dynamic
```

---

## Task 6: Database migrations — indexes and updated_at

**Files:**
- Create: `supabase/migrations/20260324100000_performance_indexes.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Foreign key indexes (missing)
CREATE INDEX IF NOT EXISTS idx_events_series_id
  ON events (series_id) WHERE series_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_festival_id
  ON events (festival_id) WHERE festival_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_events_organization_id
  ON events (organization_id) WHERE organization_id IS NOT NULL;

-- Destinations query support
CREATE INDEX IF NOT EXISTS idx_venue_occasions_occasion_confidence
  ON venue_occasions (occasion, confidence DESC);

CREATE INDEX IF NOT EXISTS idx_editorial_mentions_venue_id
  ON editorial_mentions (venue_id);

-- updated_at on core tables
ALTER TABLE venues ADD COLUMN IF NOT EXISTS updated_at
  TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at
  TIMESTAMPTZ NOT NULL DEFAULT now();

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language plpgsql;

CREATE TRIGGER set_venues_updated_at
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

- [ ] **Step 2: Test migration locally**

```bash
npx supabase db push --local
```

Verify no errors. Check that `\d events` shows the new `updated_at` column and indexes.

- [ ] **Step 3: Commit**

```
feat: add performance indexes and updated_at triggers on events/venues
```

---

## Task 7: Cache YMCA source IDs

The YMCA source exclusion queries the `sources` table on every cold feed load — data that never changes.

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts` (cache the lookup)

- [ ] **Step 1: Cache YMCA IDs using shared cache**

Replace the per-request query with a shared cache lookup:
```typescript
import { getSharedCacheJson, setSharedCache } from "@/lib/shared-cache";

async function getYmcaSourceIds(supabase: SupabaseClient): Promise<number[]> {
  const cached = await getSharedCacheJson<number[]>("ymca-source-ids");
  if (cached) return cached;

  const { data } = await supabase
    .from("sources")
    .select("id")
    .ilike("slug", "ymca%");

  const ids = (data ?? []).map(r => r.id);
  await setSharedCache("ymca-source-ids", ids, 3600); // 1 hour TTL
  return ids;
}
```

- [ ] **Step 2: Replace both call sites**

Update `fetchEventPools` (line ~365) and `fetchTabEventPool` (line ~489) to use the cached function.

- [ ] **Step 3: Commit**

```
perf: cache YMCA source IDs to eliminate per-request DB query
```

---

## Task 8: Push regulars city filter to Postgres

The regulars route fetches 1000 rows then filters by city in JS.

**Files:**
- Modify: `web/app/api/regulars/route.ts` (add `.eq("venues.city", portalCity)` to query)

- [ ] **Step 1: Add city filter to the Supabase query**

In the query builder, add the city filter before the `.limit(1000)`:
```typescript
if (portalCity) {
  query = query.ilike("venues.city", `%${portalCity}%`);
}
```

- [ ] **Step 2: Remove the JS-side `filterByPortalCity` call**

It's now redundant since the DB handles it.

- [ ] **Step 3: Verify response still correct**

Hit `/api/regulars?portal=atlanta` and confirm results are Atlanta-only.

- [ ] **Step 4: Commit**

```
perf: push regulars city filter to Postgres, remove JS post-filter
```

---

## Task 9: NewsDigest server-side filtering

Fetches 20 posts, filters to 3 client-side.

**Files:**
- Modify: `web/app/api/portals/[slug]/network-feed/route.ts` (add category filter param)
- Modify: `web/components/feed/NewsDigest.tsx` (pass filter param, remove client filter)

- [ ] **Step 1: Add `categories` query param to network-feed route**

Support `?categories=culture,arts,food,music,community&limit=3` so the DB query returns only matching posts.

- [ ] **Step 2: Update NewsDigest to use the filtered endpoint**

```typescript
fetch(`/api/portals/${portalSlug}/network-feed?limit=3&categories=culture,arts,food,music,community`)
```

Remove the client-side `isCulturePositive` filter and dedup (move dedup server-side too).

- [ ] **Step 3: Commit**

```
perf: server-side news filtering, reduce 20→3 post transfer
```

---

## Task 10: Search suggestions cached portal context

**Files:**
- Modify: `web/app/api/search/suggestions/route.ts` (use cached context)

- [ ] **Step 1: Replace `resolvePortalQueryContext` with `getCachedPortalQueryContext`**

Match the pattern used by the main search route and instant search route.

- [ ] **Step 2: Commit**

```
perf: use cached portal context for search suggestions
```

---

## Task 11: feed_category_counts staleness check

**Files:**
- Modify: `web/lib/city-pulse/pipeline/fetch-counts.ts` (add staleness fallback)

- [ ] **Step 1: Add updated_at check to the fallback condition**

After fetching `feed_category_counts`, check if the newest row's `updated_at` is older than 6 hours. If so, fall back to the live count query.

- [ ] **Step 2: Commit**

```
fix: fall back to live counts when feed_category_counts is stale
```

---

## Execution Order

Tasks are independent except:
- Task 6 (migration) should run before Task 11 (staleness check needs `updated_at`)
- Task 3 (embed destinations) depends on destinations route being parallelized (step 1 of task 3)

Recommended parallel groups:
- **Group A (client perf):** Tasks 1, 4, 5 — no server changes, can run in parallel
- **Group B (API optimization):** Tasks 2, 3, 8, 9 — API route changes
- **Group C (DB/cache):** Tasks 6, 7, 10, 11 — migrations and cache fixes
