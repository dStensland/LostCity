# Find View Architecture Phase 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire HappeningView (eliminate parallel system), restore smart dynamic imports, standardize filter state, consolidate explore-home queries.

**Architecture:** Four independent workstreams. Workstream A (dynamic imports) is a quick win. Workstream B (HappeningView retirement) is the structural fix — normalize legacy URLs server-side, then migrate references in batches, then delete. Workstream C (filter hook) standardizes state management. Workstream D (SQL consolidation) reduces explore-home from 18 queries to 1.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, PostgreSQL

---

## Workstream A: Restore Dynamic Imports + Hover Preload

### Task 1: Restore dynamic imports with hover preload

**Files:**
- Modify: `web/components/find/FindShellClient.tsx:19-25`
- Modify: `web/components/find/FindSidebar.tsx` (onLaneHover prop already exists)

- [ ] **Step 1: Replace static lane imports with dynamic + preload factories**

In `FindShellClient.tsx`, replace lines 19-25:

```typescript
// REMOVE these static imports:
// import { ShowsView } from "./ShowsView";
// import RegularsView from "./RegularsView";
// import SpotsFinder from "./SpotsFinder";
// import { ClassesView } from "./ClassesView";
// import { GameDayView } from "./GameDayView";

// ADD: dynamic imports with preload factories
import dynamic from "next/dynamic";

function LaneSkeleton() {
  return (
    <div className="space-y-4 py-6 px-2 animate-pulse">
      <div className="h-10 bg-[var(--twilight)]/30 rounded-xl" />
      <div className="h-10 bg-[var(--twilight)]/20 rounded-xl" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 bg-[var(--twilight)]/15 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

const showsImport = () => import("./ShowsView").then((m) => m.ShowsView);
const regularsImport = () => import("./RegularsView");
const spotsImport = () => import("./SpotsFinder");
const classesImport = () => import("./ClassesView").then((m) => m.ClassesView);
const gameDayImport = () => import("./GameDayView").then((m) => m.GameDayView);

const ShowsView = dynamic(showsImport, { loading: LaneSkeleton });
const RegularsView = dynamic(regularsImport, { loading: LaneSkeleton });
const SpotsFinder = dynamic(spotsImport, { loading: LaneSkeleton });
const ClassesView = dynamic(classesImport, { loading: LaneSkeleton });
const GameDayView = dynamic(gameDayImport, { loading: LaneSkeleton });

export const LANE_PRELOADS: Record<string, () => void> = {
  shows: () => void showsImport(),
  regulars: () => void regularsImport(),
  places: () => void spotsImport(),
  classes: () => void classesImport(),
  "game-day": () => void gameDayImport(),
};
```

Keep `EventsFinder` and `ExploreHome` as static imports — EventsFinder is used for events/calendar/map (3 lanes), and ExploreHome is the default view.

- [ ] **Step 2: Wire hover preload to sidebar**

In `FindShellClient.tsx`, pass preload to FindSidebar:

```typescript
<FindSidebar
  portalSlug={portalSlug}
  activeLane={lane}
  laneStates={exploreData?.lanes}
  onLaneHover={(laneId) => LANE_PRELOADS[laneId]?.()}
/>
```

`FindSidebar` already has `onLaneHover` prop and `onMouseEnter` handler from the earlier polish work — verify it's still wired up. If the prop was removed when static imports were added, re-add the `onMouseEnter` call on the lane `<a>` elements.

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/components/find/FindShellClient.tsx
git commit -m "perf: restore dynamic imports for lane views with hover preload

Static imports caused every lane's JS to bundle into the initial chunk.
Dynamic imports with hover preload give both: small initial bundle AND
no first-click jank (chunk loads while cursor travels to click)."
```

---

## Workstream B: Retire HappeningView

### Task 2: Update URL normalizer to redirect legacy views

**Files:**
- Modify: `web/lib/normalize-find-url.ts`
- Modify: `web/lib/__tests__/normalize-find-url.test.ts`

This is the safety net — before migrating 109 URL references, make the normalizer catch legacy URLs server-side so nothing breaks during migration.

- [ ] **Step 1: Read the current normalizer and test file**

Read `web/lib/normalize-find-url.ts` and `web/lib/__tests__/normalize-find-url.test.ts` to understand the full normalization logic.

- [ ] **Step 2: Add normalization for ?view=happening**

In `normalizeFinURLParams()`, add handling for `?view=happening`:

```typescript
// ?view=happening → ?view=find&lane=events (with content/display mapping)
if (view === "happening") {
  next.set("view", "find");
  const content = next.get("content");
  const display = next.get("display");

  if (content === "regulars") {
    next.set("lane", "regulars");
  } else if (content === "showtimes") {
    next.set("lane", "shows");
    // Map vertical to tab
    const vertical = next.get("vertical");
    if (vertical === "film") next.set("tab", "film");
    else if (vertical === "music") next.set("tab", "music");
  } else {
    next.set("lane", "events");
  }

  // Map display mode to lane for calendar/map
  if (display === "calendar") {
    next.set("lane", "calendar");
  } else if (display === "map") {
    next.set("lane", "map");
  }

  // Clean up legacy params
  next.delete("content");
  next.delete("display");
  next.delete("vertical");

  return next;
}
```

- [ ] **Step 3: Add normalization for ?view=places**

```typescript
// ?view=places → ?view=find&lane=places
if (view === "places") {
  next.set("view", "find");
  next.set("lane", "places");
  return next;
}
```

- [ ] **Step 4: Write tests for the new normalizations**

Add to the existing test file:

```typescript
describe("happening view normalization", () => {
  it("normalizes ?view=happening to ?view=find&lane=events", () => {
    const params = new URLSearchParams("view=happening");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("events");
  });

  it("normalizes ?view=happening&content=regulars to regulars lane", () => {
    const params = new URLSearchParams("view=happening&content=regulars");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("regulars");
  });

  it("normalizes ?view=happening&content=showtimes to shows lane", () => {
    const params = new URLSearchParams("view=happening&content=showtimes");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("shows");
  });

  it("normalizes ?view=happening&display=calendar to calendar lane", () => {
    const params = new URLSearchParams("view=happening&display=calendar");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("calendar");
  });

  it("normalizes ?view=happening&display=map to map lane", () => {
    const params = new URLSearchParams("view=happening&display=map");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("map");
  });

  it("preserves search param through normalization", () => {
    const params = new URLSearchParams("view=happening&search=jazz");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("events");
    expect(result.get("search")).toBe("jazz");
  });
});

describe("places view normalization", () => {
  it("normalizes ?view=places to ?view=find&lane=places", () => {
    const params = new URLSearchParams("view=places");
    const result = normalizeFinURLParams(params);
    expect(result.get("view")).toBe("find");
    expect(result.get("lane")).toBe("places");
  });
});
```

- [ ] **Step 5: Run tests**

Run: `cd web && npx vitest run lib/__tests__/normalize-find-url.test.ts`

- [ ] **Step 6: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 7: Commit**

```bash
git add web/lib/normalize-find-url.ts web/lib/__tests__/normalize-find-url.test.ts
git commit -m "feat: normalize ?view=happening and ?view=places to Find shell URLs

Server-side safety net: any legacy URL hitting the server gets redirected
to the equivalent ?view=find&lane=... URL. This allows incremental
migration of the ~109 client-side references."
```

---

### Task 3: Migrate URL references — page routes and redirects

**Files:** All files under `web/app/[portal]/` that construct `?view=happening` or `?view=places` URLs for redirects.

- [ ] **Step 1: Migrate redirect pages**

These files redirect users to legacy URLs. Update them to use Find shell URLs:

```
web/app/[portal]/calendar/page.tsx     — ?view=happening&display=calendar → ?view=find&lane=calendar
web/app/[portal]/showtimes/page.tsx    — ?view=happening&content=showtimes → ?view=find&lane=shows
web/app/[portal]/tonight/page.tsx      — ?view=happening&... → ?view=find&lane=events&date=today
web/app/[portal]/this-weekend/page.tsx — ?view=happening&... → ?view=find&lane=events&date=weekend
web/app/[portal]/free/page.tsx         — ?view=happening&... → ?view=find&lane=events&price=free
web/app/[portal]/parks/page.tsx        — ?view=places&... → ?view=find&lane=places&...
web/app/[portal]/services/page.tsx     — ?view=places&... → ?view=find&lane=places&...
web/app/[portal]/venues/page.tsx       — ?view=places&... → ?view=find&lane=places
```

For each file: read it, find the redirect URL, update to the Find shell equivalent. Use `buildFindUrl` where possible.

- [ ] **Step 2: Migrate detail page breadcrumbs**

```
web/app/[portal]/events/[id]/page.tsx  — breadcrumb "Events" link
web/app/[portal]/series/[slug]/page.tsx — breadcrumb link
web/app/[portal]/festivals/[slug]/page.tsx — breadcrumb link
web/app/[portal]/spots/[slug]/page.tsx — breadcrumb "Places" link
web/app/[portal]/neighborhoods/[slug]/page.tsx — link to places
```

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/
git commit -m "migrate: page routes and breadcrumbs from ?view=happening to Find shell URLs"
```

---

### Task 4: Migrate URL references — components

**Files:** Components that construct `?view=happening` or `?view=places` URLs.

- [ ] **Step 1: Run a comprehensive grep to find all remaining references**

```bash
cd web
grep -rn "view=happening\|view=places" --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v ".next" | grep -v __tests__
```

- [ ] **Step 2: Migrate each file**

For each file in the grep results, read the file, find the URL construction, and update to the Find shell equivalent. Common patterns:

```typescript
// OLD: href={`/${portalSlug}?view=happening`}
// NEW: href={`/${portalSlug}?view=find&lane=events`}

// OLD: href={`/${portalSlug}?view=happening&search=${q}`}
// NEW: href={`/${portalSlug}?view=find&lane=events&search=${q}`}

// OLD: href={`/${portalSlug}?view=places`}
// NEW: href={`/${portalSlug}?view=find&lane=places`}

// OLD: href={`/${portalSlug}?view=places&tab=${tab}`}
// NEW: href={`/${portalSlug}?view=find&lane=places&tab=${tab}`}
```

Key file groups to migrate:
- `web/components/HeaderSearchButton.tsx`
- `web/components/MapView.tsx`
- `web/components/PortalCommunityView.tsx`
- `web/components/calendar/` (4 files)
- `web/components/civic/CivicTabBar.tsx`
- `web/components/family/` (3 files)
- `web/components/explore/ExploreTrackSection.tsx`
- `web/components/feed/FeedShell.tsx`
- `web/components/feed/sections/` (3 files)
- `web/components/find/SpotsFinder.tsx`
- `web/app/[portal]/_components/film/` (2 files)
- `web/app/[portal]/_components/hotel/` (4 files)
- `web/app/page.tsx` (home page category grid — ~10 refs)
- `web/lib/city-pulse/dashboard-cards.ts` (~8 refs)
- `web/lib/search-*.ts` files (search system URLs)

- [ ] **Step 3: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 4: Run a grep to verify no remaining references**

```bash
grep -rn "view=happening\|view=places" --include="*.ts" --include="*.tsx" web/ | grep -v node_modules | grep -v ".next" | grep -v __tests__ | grep -v normalize-find-url
```

Expected: zero results (except normalize-find-url.ts which handles backward compat).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "migrate: all component/lib references from ?view=happening/?view=places to Find shell

~109 URL references updated across ~40 files. Normalize-find-url.ts
still handles any remaining legacy URLs as a safety net."
```

---

### Task 5: Delete HappeningView and legacy routing

**Files:**
- Delete: `web/components/find/HappeningView.tsx`
- Modify: `web/app/[portal]/page.tsx` — remove viewMode "happening" and "places" branches
- Modify: `web/lib/normalize-find-url.ts` — remove backward-compat comments

- [ ] **Step 1: Verify no imports of HappeningView remain**

```bash
grep -rn "HappeningView\|happening-view" --include="*.ts" --include="*.tsx" web/ | grep -v node_modules | grep -v ".next"
```

Expected: only `HappeningView.tsx` itself and `page.tsx` (which we're about to modify).

- [ ] **Step 2: Remove HappeningView routing from page.tsx**

In `web/app/[portal]/page.tsx`:

1. Delete the `HappeningViewWithData` async function (lines ~120-156)
2. Delete the `viewMode === "happening"` rendering branch (lines ~574-608)
3. Delete the `viewMode === "places"` rendering branch (lines ~610-629) — SpotsFinder is already rendered via FindShellClient's places lane
4. Remove `"happening" | "places"` from the `ViewMode` type
5. Remove any `happeningContent` variable resolution
6. Remove unused imports (HappeningView, getServerRegularsData, WhatsOnView)
7. In the view mode detection logic, remove cases that set `viewMode = "happening"` or `viewMode = "places"` — these now fall through to `viewMode = "find"` via the normalizer

- [ ] **Step 3: Delete HappeningView.tsx**

```bash
rm web/components/find/HappeningView.tsx
```

- [ ] **Step 4: Delete any orphaned server-side data fetchers**

Check if `getServerRegularsData` is only used by HappeningViewWithData. If so, find and delete it.

- [ ] **Step 5: Run tsc**

Run: `cd web && npx tsc --noEmit`
Fix any remaining import references that broke.

- [ ] **Step 6: Run full test suite**

Run: `cd web && npx vitest run`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: delete HappeningView and legacy ?view=happening/?view=places routing

One rendering system, one URL contract. ~450 lines removed.
The normalizer still catches any remaining legacy URLs as a safety net."
```

---

## Workstream C: Standardize Filter State

### Task 6: Create useFilterState hook

**Files:**
- Create: `web/lib/hooks/useFilterState.ts`
- Create: `web/lib/hooks/__tests__/useFilterState.test.ts`

The hook reads from `useSearchParams` (correct for back/forward) but writes via `window.history.replaceState` (fast, no Suspense). Syncs both directions.

- [ ] **Step 1: Write the hook**

```typescript
// web/lib/hooks/useFilterState.ts
"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useSyncExternalStore } from "react";

/**
 * Read filter state from URL params (supports back/forward).
 * Write filter state via replaceState (fast, no Suspense thrash).
 *
 * Usage:
 *   const [value, setValue] = useFilterParam("categories");
 *   // value reads from URL, setValue writes via replaceState
 */
export function useFilterParam(key: string): [string | null, (value: string | null) => void] {
  const searchParams = useSearchParams();
  const value = searchParams?.get(key) ?? null;

  const setValue = useCallback(
    (newValue: string | null) => {
      const url = new URL(window.location.href);
      if (newValue === null || newValue === "") {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }
      window.history.replaceState(null, "", url.toString());
    },
    [key]
  );

  return [value, setValue];
}

/**
 * Read multiple filter params at once. Returns an object.
 * Write updates all specified params atomically.
 */
export function useFilterParams<K extends string>(
  keys: readonly K[]
): [Record<K, string | null>, (updates: Partial<Record<K, string | null>>) => void] {
  const searchParams = useSearchParams();

  const values = {} as Record<K, string | null>;
  for (const key of keys) {
    values[key] = searchParams?.get(key) ?? null;
  }

  const setValues = useCallback(
    (updates: Partial<Record<K, string | null>>) => {
      const url = new URL(window.location.href);
      for (const [key, val] of Object.entries(updates) as [K, string | null][]) {
        if (val === null || val === "") {
          url.searchParams.delete(key);
        } else {
          url.searchParams.set(key, val);
        }
      }
      window.history.replaceState(null, "", url.toString());
    },
    []
  );

  return [values, setValues];
}
```

- [ ] **Step 2: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/lib/hooks/useFilterState.ts
git commit -m "feat: useFilterParam/useFilterParams hooks — read from URL, write via replaceState

Standardized filter state pattern: useSearchParams for reads (back/forward
works), replaceState for writes (fast, no Suspense thrash)."
```

---

### Task 7: Migrate EventsFinder filters to useFilterParam

**Files:**
- Modify: `web/components/find/EventsFinder.tsx`

EventsFinder currently uses `router.push()` for filter changes (slow, triggers Suspense). Migrate to `useFilterParam` for the search input and filter bar state.

- [ ] **Step 1: Read EventsFinder.tsx to understand current filter state flow**

Identify where `router.push()` or `router.replace()` is used for filter state changes. The key areas are:
- `EventsFinderFiltersInner` — search input, FindFilterBar, ActiveFiltersRow
- The search input onChange handler
- The filter bar category/date/genre change handlers

- [ ] **Step 2: Replace router-based filter writes with useFilterParam**

In `EventsFinderFiltersInner`, replace `router.push` filter updates with `useFilterParam` writes. The reads already come from `useSearchParams` — keep those. Only change the write path.

This is a surgical change — read the current code carefully before modifying. The goal is to change HOW filter state is written (replaceState instead of router.push), not WHAT state is tracked.

- [ ] **Step 3: Verify filter behavior**

Run dev server, navigate to `?view=find&lane=events`:
- Type in search → URL updates without full navigation
- Click a category filter → URL updates without full navigation
- Clear filters → URL updates
- Back button → previous filter state restored

- [ ] **Step 4: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 5: Commit**

```bash
git add web/components/find/EventsFinder.tsx
git commit -m "perf: EventsFinder filters write via replaceState instead of router.push

Filter changes are now instant (no Suspense boundary trigger).
Reads still from useSearchParams so back/forward works correctly."
```

---

## Workstream D: Explore-Home Query Consolidation

### Task 8: Create SQL function for explore-home counts

**Files:**
- Create: `supabase/migrations/YYYYMMDD_explore_home_counts.sql`

- [ ] **Step 1: Read current explore-home-data.ts queries**

Read `web/lib/explore-home-data.ts` thoroughly to understand every count query. Document:
- Which table each query hits
- What filters each query applies
- What the portal scoping logic is
- Which queries can be combined (they all hit the `events` table with different category/date filters)

- [ ] **Step 2: Write the SQL function**

```sql
CREATE OR REPLACE FUNCTION get_explore_home_counts(
  p_portal_id uuid,
  p_today date DEFAULT CURRENT_DATE,
  p_weekend_start date DEFAULT NULL,
  p_weekend_end date DEFAULT NULL,
  p_source_ids int[] DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Compute all lane counts in a single table scan using conditional aggregation
  SELECT jsonb_build_object(
    'events', jsonb_build_object(
      'count', COUNT(*) FILTER (WHERE category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning') AND NOT COALESCE(is_class, false)),
      'count_today', COUNT(*) FILTER (WHERE category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning') AND NOT COALESCE(is_class, false) AND start_date = p_today),
      'count_weekend', COUNT(*) FILTER (WHERE category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning') AND NOT COALESCE(is_class, false) AND start_date BETWEEN p_weekend_start AND p_weekend_end)
    ),
    'shows', jsonb_build_object(
      'count', COUNT(*) FILTER (WHERE category_id IN ('film','theater','music','comedy','dance')),
      'count_today', COUNT(*) FILTER (WHERE category_id IN ('film','theater','music','comedy','dance') AND start_date = p_today),
      'count_weekend', COUNT(*) FILTER (WHERE category_id IN ('film','theater','music','comedy','dance') AND start_date BETWEEN p_weekend_start AND p_weekend_end)
    ),
    'game-day', jsonb_build_object(
      'count', COUNT(*) FILTER (WHERE category_id = 'sports'),
      'count_today', COUNT(*) FILTER (WHERE category_id = 'sports' AND start_date = p_today),
      'count_weekend', COUNT(*) FILTER (WHERE category_id = 'sports' AND start_date BETWEEN p_weekend_start AND p_weekend_end)
    ),
    'regulars', jsonb_build_object(
      'count', COUNT(*) FILTER (WHERE is_regular_ready = true AND NOT COALESCE(is_class, false) AND category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning')),
      'count_today', COUNT(*) FILTER (WHERE is_regular_ready = true AND NOT COALESCE(is_class, false) AND category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning') AND start_date = p_today),
      'count_weekend', COUNT(*) FILTER (WHERE is_regular_ready = true AND NOT COALESCE(is_class, false) AND category_id NOT IN ('film','theater','education','support','support_group','civic','volunteer','religious','community','family','learning') AND start_date BETWEEN p_weekend_start AND p_weekend_end)
    ),
    'classes', jsonb_build_object(
      'count', COUNT(*) FILTER (WHERE COALESCE(is_class, false) = true),
      'count_today', COUNT(*) FILTER (WHERE COALESCE(is_class, false) = true AND start_date = p_today),
      'count_weekend', COUNT(*) FILTER (WHERE COALESCE(is_class, false) = true AND start_date BETWEEN p_weekend_start AND p_weekend_end)
    )
  ) INTO result
  FROM events
  WHERE is_active = true
    AND (is_feed_ready = true OR is_regular_ready = true)
    AND start_date >= p_today
    AND start_date <= p_today + INTERVAL '7 days'
    AND canonical_event_id IS NULL
    AND (p_source_ids IS NULL OR source_id = ANY(p_source_ids));

  -- Add places count separately (different table)
  result = result || jsonb_build_object(
    'places', jsonb_build_object(
      'count', (SELECT COUNT(*) FROM places WHERE portal_id = p_portal_id AND is_active = true),
      'count_today', NULL,
      'count_weekend', NULL
    )
  );

  RETURN result;
END;
$$;
```

NOTE: This is a starting point. The actual SQL MUST match the exact filters in the current `explore-home-data.ts` queries. Read the current queries line by line and replicate their WHERE clauses exactly. Pay special attention to:
- Portal scoping (source_id filtering via the manifest)
- The `is_feed_ready` vs `is_regular_ready` distinction
- Date range calculations
- Category exclusion lists

- [ ] **Step 3: Test the function locally**

```bash
supabase db reset  # or apply migration
# Then test via psql or Supabase dashboard:
SELECT get_explore_home_counts('portal-uuid-here', CURRENT_DATE, ...);
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: get_explore_home_counts SQL function — single scan for all lane counts"
```

---

### Task 9: Wire explore-home API to SQL function

**Files:**
- Modify: `web/lib/explore-home-data.ts`

- [ ] **Step 1: Replace the 18 individual queries with a single RPC call**

In `getExploreHomeData()`, after the portal bootstrap chain, replace the `Promise.allSettled()` block with:

```typescript
const { data: counts, error } = await supabase.rpc("get_explore_home_counts", {
  p_portal_id: portal.id,
  p_today: today,
  p_weekend_start: weekendStart,
  p_weekend_end: weekendEnd,
  p_source_ids: manifest.sourceIds.length > 0 ? manifest.sourceIds : null,
});

if (error) {
  console.warn("[explore-home-data] RPC error:", error);
  // Fall back to empty state
}
```

Then build `LanePreview` objects from the returned JSON instead of from individual query results.

- [ ] **Step 2: Keep the existing buildLane / computeLaneState / generateLaneCopy logic**

These functions process the counts into human-readable copy and state. They stay — just feed them data from the RPC result instead of individual queries.

- [ ] **Step 3: Remove the 18 individual query builders**

Delete all the individual lane query functions (events count, events today, shows count, etc.). Keep the utility functions (`computeLaneState`, `generateLaneCopy`, `getWeekendRange`, `getTimeBoostForLane`).

- [ ] **Step 4: Parallelize the portal bootstrap**

```typescript
// OLD (sequential):
const portal = await getPortalBySlug(portalSlug);
const access = await getPortalSourceAccess(portal.id);

// NEW (parallel):
const [portal, access] = await Promise.all([
  getPortalBySlug(portalSlug),
  // getPortalSourceAccess needs portal.id, so we can't fully parallelize
  // But we can parallelize portal lookup with other independent work
]);
const sourceAccess = await getPortalSourceAccess(portal.id);
```

Actually — read the code first. If `getPortalSourceAccess` needs `portal.id`, it can't run in parallel with `getPortalBySlug`. Only parallelize truly independent calls.

- [ ] **Step 5: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "perf: replace 18 explore-home queries with single RPC call

get_explore_home_counts does one table scan with conditional aggregation.
Cold cache response drops from 500-800ms to ~200ms."
```

---

## Task 10: Integration Verification

- [ ] **Step 1: Run tsc**

Run: `cd web && npx tsc --noEmit`

- [ ] **Step 2: Run test suite**

Run: `cd web && npx vitest run`

- [ ] **Step 3: Visual smoke test — Explore home**

Navigate to `?view=find`. Lane counts should load fast. Search works. Lane tiles navigate correctly.

- [ ] **Step 4: Visual smoke test — legacy URLs still work**

Navigate to `?view=happening` — should redirect to `?view=find&lane=events`.
Navigate to `?view=places` — should redirect to `?view=find&lane=places`.
Navigate to `?view=happening&content=regulars` — should redirect to `?view=find&lane=regulars`.

- [ ] **Step 5: Visual smoke test — all lanes load**

Click through all 8 lanes. Verify:
- First-click shows skeleton briefly (dynamic import loading)
- Hover-then-click is instant (preloaded)
- Second visit is instant (cached)
- Events lane filters are fast (no Suspense jank)

- [ ] **Step 6: Verify no remaining legacy references**

```bash
grep -rn "view=happening\|view=places" --include="*.ts" --include="*.tsx" web/ | grep -v node_modules | grep -v ".next" | grep -v __tests__ | grep -v normalize-find-url
```

Expected: zero results.
