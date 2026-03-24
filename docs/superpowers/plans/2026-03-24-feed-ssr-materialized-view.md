# Feed SSR + Materialized View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the client-side feed loading waterfall by server-rendering the feed with real data, backed by a pre-computed materialized table that replaces the complex 20+ query pipeline with a single fast read.

**Architecture:** Two complementary changes: (1) A `feed_events_ready` denormalized table pre-joins events+venues, pre-filters (active, feed-ready, not class, not sensitive), and pre-scores — refreshed every 5 minutes by an RPC. The feed pipeline reads this table with one simple query instead of 4+ complex queries with OR clauses through RLS. (2) The feed data is fetched server-side in the RSC (`page.tsx`) and passed as props to the client shell, so the HTML contains real events — no skeleton, no client-side API call for the initial view.

**Tech Stack:** PostgreSQL (materialized table + refresh RPC), Supabase, Next.js 16 RSC + Streaming, React Query (for tab switching only)

---

## File Structure

### New files
- `supabase/migrations/XXXXXX_feed_events_ready.sql` — materialized table + refresh RPC
- `web/lib/city-pulse/pipeline/fetch-feed-ready.ts` — reads the pre-computed table (simple SELECT)

### Modified files
- `web/app/[portal]/page.tsx` — server-side feed data fetch, pass as props
- `web/app/[portal]/_templates/default.tsx` — accept + forward feed data
- `web/components/feed/CityPulseShell.tsx` — accept server data, skip client fetch when provided
- `web/lib/hooks/useCityPulseFeed.ts` — accept `initialData` to skip the fetch
- `web/app/api/portals/[slug]/city-pulse/route.ts` — use `feed_events_ready` for event pools
- `web/lib/city-pulse/pipeline/fetch-events.ts` — add `fetchEventPoolsFromReady()` alternative

### Existing patterns to follow
- `feed_category_counts` table + `refresh_feed_counts()` RPC (migration `20260318160000`)
- `getOrSetSharedCacheJson` for in-process caching
- Pipeline barrel exports in `web/lib/city-pulse/pipeline/index.ts`

---

## Task 1: Create the `feed_events_ready` denormalized table

The core idea: pre-join events + venues, pre-filter all the complex WHERE clauses, pre-compute scores. Refreshed by an RPC every 5 minutes. The feed query becomes `SELECT * FROM feed_events_ready WHERE portal_id = $1 AND start_date = $2 LIMIT 300`.

**Files:**
- Create: `supabase/migrations/XXXXXX_feed_events_ready.sql`

- [ ] **Step 1: Design the table schema**

The table denormalizes the EVENT_SELECT join into flat columns. Key columns:
- All event fields currently in `EVENT_SELECT` (id, title, start_date, start_time, end_date, end_time, category, genres, image_url, tags, etc.)
- Venue fields from the inner join (venue_id, venue_name, venue_slug, venue_neighborhood, venue_city, venue_type, venue_image_url, venue_active)
- Series fields (series_id, series_name, series_type, series_slug)
- Computed: `data_quality` score, `portal_id` (from source→portal_source_access)
- Metadata: `refreshed_at` timestamp

```sql
CREATE TABLE IF NOT EXISTS feed_events_ready (
  event_id        INT NOT NULL,
  portal_id       UUID NOT NULL,
  title           TEXT,
  start_date      DATE NOT NULL,
  start_time      TIME,
  end_date        DATE,
  end_time        TIME,
  is_all_day      BOOLEAN DEFAULT false,
  is_free         BOOLEAN DEFAULT false,
  price_min       NUMERIC,
  price_max       NUMERIC,
  category        TEXT,
  genres          TEXT[],
  image_url       TEXT,
  featured_blurb  TEXT,
  tags            TEXT[],
  festival_id     INT,
  is_tentpole     BOOLEAN DEFAULT false,
  is_featured     BOOLEAN DEFAULT false,
  series_id       INT,
  is_recurring    BOOLEAN DEFAULT false,
  source_id       INT,
  organization_id INT,
  importance      TEXT,
  data_quality    NUMERIC,
  on_sale_date    DATE,
  presale_date    DATE,
  early_bird_deadline DATE,
  sellout_risk    TEXT,
  attendee_count  INT DEFAULT 0,
  -- Venue (denormalized)
  venue_id        INT,
  venue_name      TEXT,
  venue_slug      TEXT,
  venue_neighborhood TEXT,
  venue_city      TEXT,
  venue_type      TEXT,
  venue_image_url TEXT,
  -- Series (denormalized)
  series_name     TEXT,
  series_type     TEXT,
  series_slug     TEXT,
  -- Metadata
  refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, portal_id)
);

-- The critical index: what the feed query uses
CREATE INDEX idx_feed_events_ready_portal_date
  ON feed_events_ready (portal_id, start_date, data_quality DESC);

-- For horizon queries
CREATE INDEX idx_feed_events_ready_horizon
  ON feed_events_ready (portal_id, start_date)
  WHERE is_tentpole = true OR festival_id IS NOT NULL OR importance = 'flagship';
```

- [ ] **Step 2: Create the refresh RPC**

```sql
CREATE OR REPLACE FUNCTION refresh_feed_events_ready(p_portal_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If a specific portal is given, only refresh that portal.
  -- Otherwise refresh all portals.
  DELETE FROM feed_events_ready
  WHERE (p_portal_id IS NULL OR portal_id = p_portal_id)
    AND start_date < CURRENT_DATE - INTERVAL '1 day';

  -- Upsert current + future events
  INSERT INTO feed_events_ready (
    event_id, portal_id, title, start_date, start_time, end_date, end_time,
    is_all_day, is_free, price_min, price_max, category, genres, image_url,
    featured_blurb, tags, festival_id, is_tentpole, is_featured, series_id,
    is_recurring, source_id, organization_id, importance, data_quality,
    on_sale_date, presale_date, early_bird_deadline, sellout_risk, attendee_count,
    venue_id, venue_name, venue_slug, venue_neighborhood, venue_city,
    venue_type, venue_image_url,
    series_name, series_type, series_slug,
    refreshed_at
  )
  SELECT
    e.id, psa.portal_id, e.title, e.start_date, e.start_time, e.end_date, e.end_time,
    e.is_all_day, e.is_free, e.price_min, e.price_max, e.category_id, e.genres, e.image_url,
    e.featured_blurb, e.tags, e.festival_id, e.is_tentpole, e.is_featured, e.series_id,
    e.is_recurring, e.source_id, e.organization_id, e.importance, e.data_quality,
    e.on_sale_date, e.presale_date, e.early_bird_deadline, e.sellout_risk,
    COALESCE(e.attendee_count, 0),
    v.id, v.name, v.slug, v.neighborhood, v.city,
    v.venue_type, v.image_url,
    s.name, s.series_type, s.slug,
    now()
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN series s ON s.id = e.series_id
  INNER JOIN portal_source_access psa ON psa.source_id = e.source_id
  WHERE e.is_active = true
    AND e.canonical_event_id IS NULL
    AND COALESCE(e.is_class, false) = false
    AND COALESCE(e.is_sensitive, false) = false
    AND COALESCE(e.is_feed_ready, true) = true
    AND e.start_date >= CURRENT_DATE - INTERVAL '1 day'
    AND e.start_date <= CURRENT_DATE + INTERVAL '180 days'
    AND (p_portal_id IS NULL OR psa.portal_id = p_portal_id)
  ON CONFLICT (event_id, portal_id)
  DO UPDATE SET
    title = EXCLUDED.title,
    start_date = EXCLUDED.start_date,
    start_time = EXCLUDED.start_time,
    end_date = EXCLUDED.end_date,
    end_time = EXCLUDED.end_time,
    is_all_day = EXCLUDED.is_all_day,
    is_free = EXCLUDED.is_free,
    price_min = EXCLUDED.price_min,
    price_max = EXCLUDED.price_max,
    category = EXCLUDED.category,
    genres = EXCLUDED.genres,
    image_url = EXCLUDED.image_url,
    featured_blurb = EXCLUDED.featured_blurb,
    tags = EXCLUDED.tags,
    festival_id = EXCLUDED.festival_id,
    is_tentpole = EXCLUDED.is_tentpole,
    is_featured = EXCLUDED.is_featured,
    series_id = EXCLUDED.series_id,
    is_recurring = EXCLUDED.is_recurring,
    importance = EXCLUDED.importance,
    data_quality = EXCLUDED.data_quality,
    attendee_count = EXCLUDED.attendee_count,
    venue_id = EXCLUDED.venue_id,
    venue_name = EXCLUDED.venue_name,
    venue_slug = EXCLUDED.venue_slug,
    venue_neighborhood = EXCLUDED.venue_neighborhood,
    venue_city = EXCLUDED.venue_city,
    venue_type = EXCLUDED.venue_type,
    venue_image_url = EXCLUDED.venue_image_url,
    series_name = EXCLUDED.series_name,
    series_type = EXCLUDED.series_type,
    series_slug = EXCLUDED.series_slug,
    refreshed_at = now();
END;
$$;
```

- [ ] **Step 3: Seed the table with initial data**

At the end of the migration, call the refresh for all portals:
```sql
SELECT refresh_feed_events_ready();
```

- [ ] **Step 4: Add to post-crawl maintenance**

In `crawlers/scripts/post_crawl_maintenance.py`, add a call to `refresh_feed_events_ready()` after `refresh_feed_counts()`. Check the existing pattern there and follow it.

- [ ] **Step 5: Commit**

```
feat: add feed_events_ready denormalized table with refresh RPC
```

---

## Task 2: Read from `feed_events_ready` in the pipeline

Replace the complex 4-query `fetchEventPools` with a single read from the pre-computed table.

**Files:**
- Create: `web/lib/city-pulse/pipeline/fetch-feed-ready.ts`
- Modify: `web/app/api/portals/[slug]/city-pulse/route.ts`
- Modify: `web/lib/city-pulse/pipeline/fetch-events.ts`
- Modify: `web/lib/city-pulse/pipeline/index.ts`

- [ ] **Step 1: Create `fetch-feed-ready.ts`**

This file exports a function that reads from `feed_events_ready` and returns the same `EventPools` shape that `fetchEventPools` returns, so the rest of the pipeline (section building, enrichments) works unchanged.

```typescript
export async function fetchEventPoolsFromReady(
  supabase: SupabaseClient,
  ctx: PipelineContext,
): Promise<EventPools> {
  // Single query — no OR clauses, no RLS overhead, no joins
  const { data: todayRows, error } = await supabase
    .from("feed_events_ready")
    .select("*")
    .eq("portal_id", ctx.portalData.id)
    .gte("start_date", ctx.today)
    .lte("start_date", ctx.today)
    .order("data_quality", { ascending: false })
    .limit(300);
  // ... reshape rows into FeedEventData format
  // ... split into today/trending/horizon pools
}
```

The key challenge: `feed_events_ready` has flat columns, but `FeedEventData` expects nested `venue: { id, name, ... }` and `series: { ... }` objects. This function must reconstruct the nested shape.

- [ ] **Step 2: Add a feature flag**

In `web/lib/launch-flags.ts`, add:
```typescript
export const USE_FEED_READY_TABLE =
  process.env.USE_FEED_READY_TABLE === "true";
```

- [ ] **Step 3: Wire into the city-pulse route**

In the city-pulse route, swap `fetchEventPools` for `fetchEventPoolsFromReady` when the flag is on:

```typescript
const pools = USE_FEED_READY_TABLE
  ? await fetchEventPoolsFromReady(supabase, ctx)
  : await fetchEventPools(portalClient, ctx);
```

This uses the regular `supabase` client (service key for the pre-computed table, no RLS needed) instead of the `portalClient` (anon key with RLS that causes timeouts).

- [ ] **Step 4: Export from barrel**

Add the new function to `web/lib/city-pulse/pipeline/index.ts`.

- [ ] **Step 5: Test locally**

Set `USE_FEED_READY_TABLE=true` in `.env.local`. Load `/atlanta`. Verify the lineup appears with real events. Check the server log for timing — should be dramatically faster.

- [ ] **Step 6: Commit**

```
feat: read feed events from pre-computed table (flag-gated)
```

---

## Task 3: Server-render the feed data in RSC

Fetch the city-pulse data server-side and pass it as props. The HTML contains real events — no skeleton on initial load.

**Files:**
- Modify: `web/app/[portal]/page.tsx`
- Modify: `web/app/[portal]/_templates/default.tsx`
- Modify: `web/components/feed/CityPulseShell.tsx`
- Modify: `web/lib/hooks/useCityPulseFeed.ts`

- [ ] **Step 1: Fetch feed data server-side in page.tsx**

In the default template branch of `PortalPage`, call the pipeline directly:

```typescript
// Only for the default (city) template — other verticals have their own shells
import { getServerFeedData } from "@/lib/city-pulse/server-feed";

// Inside PortalPage, after portal resolution:
const feedData = await getServerFeedData(portal.slug, portal.id);
```

Create `web/lib/city-pulse/server-feed.ts` as a thin server-only wrapper that calls the pipeline stages (or reads from the shared cache if warm). This keeps the heavy imports out of page.tsx.

- [ ] **Step 2: Thread feed data through DefaultTemplate**

Add `serverFeedData?: CityPulseResponse` to `DefaultTemplateProps`. Pass it to `CityPulseShell`.

- [ ] **Step 3: Accept server data in CityPulseShell**

Add `serverFeedData?: CityPulseResponse` prop. When provided:
- Use it as the initial data source (no skeleton, no loading state)
- Pass it as `initialData` to `useCityPulseFeed`

- [ ] **Step 4: Accept initialData in useCityPulseFeed**

React Query supports `initialData` natively:
```typescript
const query = useQuery({
  queryKey: ["city-pulse", portalSlug, ...],
  queryFn: fetchCityPulse,
  initialData: serverFeedData, // <-- skip the fetch entirely on first render
  staleTime: 2 * 60 * 1000,
  // ...
});
```

When `initialData` is provided, React Query uses it immediately without firing the fetch. The first refetch happens after `staleTime` (2 minutes) or on window focus.

- [ ] **Step 5: Use Suspense streaming for progressive delivery**

Wrap the feed in a Suspense boundary so the hero section streams immediately while the feed data resolves:

```tsx
<Suspense fallback={<FeedSkeleton vertical={vertical} />}>
  <DefaultTemplate portal={portal} serverHeroUrl={serverHeroUrl} />
</Suspense>
```

The server sends the shell HTML immediately, then streams the feed data as it resolves. The user sees the header + hero instantly, then events fill in without a client-side fetch.

- [ ] **Step 6: Verify no double-fetch**

Load `/atlanta` with DevTools Network tab. Confirm that `/api/portals/atlanta/city-pulse` does NOT fire on initial load (the data came from the server). It should only fire on tab switching or after staleTime.

- [ ] **Step 7: Commit**

```
feat: server-render feed data in RSC, eliminate client-side initial fetch
```

---

## Task 4: Background tab pre-fetching

After the initial feed loads, pre-fetch "This Week" and "Coming Up" data so tab switching is instant.

**Files:**
- Modify: `web/lib/hooks/useCityPulseFeed.ts`
- Modify: `web/components/feed/CityPulseShell.tsx`

- [ ] **Step 1: Add background pre-fetch after initial load**

In `useCityPulseFeed`, after the initial data resolves, schedule background fetches for the other tabs using `requestIdleCallback`:

```typescript
useEffect(() => {
  if (!data || prefetchedRef.current) return;
  prefetchedRef.current = true;

  const prefetch = () => {
    fetchTab("this_week").catch(() => {});
    fetchTab("coming_up").catch(() => {});
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(prefetch);
  } else {
    setTimeout(prefetch, 2000);
  }
}, [data, fetchTab]);
```

- [ ] **Step 2: Commit**

```
perf: pre-fetch tab data in background after initial feed load
```

---

## Task 5: Add refresh cron to crawler pipeline

Ensure `feed_events_ready` stays fresh via scheduled refresh.

**Files:**
- Modify: `crawlers/scripts/post_crawl_maintenance.py`

- [ ] **Step 1: Add refresh call after existing `refresh_feed_counts`**

Follow the exact pattern used for `refresh_feed_counts()`. Call `refresh_feed_events_ready()` with no arguments (refreshes all portals).

- [ ] **Step 2: Commit**

```
feat: add feed_events_ready refresh to post-crawl maintenance
```

---

## Execution Order

Tasks are sequential — each builds on the previous:
1. **Task 1** (DB migration) — creates the table and refresh RPC
2. **Task 2** (pipeline read) — adds the fast query path, flag-gated
3. **Task 3** (SSR) — server-renders feed data, eliminates client fetch
4. **Task 4** (tab prefetch) — instant tab switching
5. **Task 5** (cron) — keeps the table fresh

Tasks 1-2 can ship independently and immediately improve the timeout problem. Task 3 is the big UX win. Task 4 is polish. Task 5 is operational.

---

## Expected Results

| Metric | Before | After |
|--------|--------|-------|
| Client API calls on feed load | 9+ | 0 (server-rendered) |
| Event query complexity | 4 parallel queries, OR clauses, RLS | 1 simple SELECT on flat table |
| Event query time | 74ms-4500ms (timeout risk) | <10ms |
| Time to meaningful content | ~1-3s (skeleton → fetch → render) | ~200ms (HTML contains events) |
| Tab switching | 300-800ms (API call) | Instant (pre-fetched) |
| Feed data staleness | Real-time | 5 minutes (same as current cache) |
