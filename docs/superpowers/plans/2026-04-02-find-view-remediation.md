# Find View Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the Find/Explore view — search-forward home, fixed navigation, consolidated architecture, correct data, dead code removal.

**Architecture:** Replace the ExploreHome preview grid with a search-forward layout (FindSearchInput hero + quick-action chips + visually rich lane tile grid). Consolidate lane definitions into a single source of truth. Fix URL contract, Events filter gap, Regulars data, and sidebar/mobile navigation. Clean up dead code.

**Tech Stack:** Next.js 16, React, TypeScript, Supabase, Tailwind CSS, Phosphor Icons

**Spec:** `docs/superpowers/specs/2026-04-02-find-view-remediation-design.md`

---

## File Structure

### New Files
- `web/lib/find-url.ts` — URL builder utility with canonical param names

### Major Rewrites
- `web/components/find/ExploreHome.tsx` — Search-forward layout replacing preview grid

### Modifications
- `web/lib/explore-lane-meta.ts` — Single source for lane lists, accent color updates, icon exports
- `web/lib/normalize-find-url.ts` — Import SHELL_LANE_SET from meta
- `web/components/find/FindSidebar.tsx` — Explore heading as home, search button, remove pulse/CategoryPulse
- `web/components/find/MobileLaneBar.tsx` — Always render, import from meta
- `web/components/find/FindShellClient.tsx` — Import from meta, showFilters={false} for calendar/map
- `web/components/find/EventsFinder.tsx` — Internalize filters with showFilters prop
- `web/components/find/HappeningView.tsx` — Use EventsFinder showFilters instead of external composition
- `web/components/find/FindSearchInput.tsx` — Fix resolveViewAllHref to route to Find shell
- `web/lib/explore-home-data.ts` — Fix Regulars filters, add error logging, remove preview queries
- `web/lib/types/explore-home.ts` — Remove items from LanePreview type

### Deletions (after dependencies are clear)
- `web/components/find/FindView.tsx`
- `web/components/find/ExploreHomeSection.tsx`
- `web/components/find/FindToolChipRow.tsx`
- `web/components/find/RightNowSection.tsx`
- `web/components/find/FindSpotlight.tsx`
- `web/lib/find-data.ts`
- `web/app/api/portals/[slug]/find-data/route.ts`

---

## Task 1: Lane Meta Consolidation + Accent Colors

**Files:**
- Modify: `web/lib/explore-lane-meta.ts`
- Modify: `web/lib/normalize-find-url.ts:103`
- Modify: `web/components/find/FindShellClient.tsx:42-45`
- Modify: `web/components/find/MobileLaneBar.tsx:9-12`
- Modify: `web/components/find/ExploreHome.tsx:13-22`
- Modify: `web/components/find/FindSidebar.tsx:34-94`

- [ ] **Step 1: Add exports and update accents in explore-lane-meta.ts**

Add lane list exports and icon map below the existing `LANE_META` definition. Update accent colors.

```typescript
// At the top, add icon imports
import {
  Ticket,
  FilmSlate,
  Trophy,
  ArrowsClockwise,
  MapPin,
  GraduationCap,
  CalendarBlank,
  MapTrifold,
} from "@phosphor-icons/react/dist/ssr";

// Update LANE_META accent values:
// shows: accent: "var(--vibe)"          (was var(--coral))
// game-day: accent: "var(--neon-cyan)"  (was var(--coral))
// classes: accent: "var(--copper)"      (was #C9874F)

// Add after LANE_META:
export type { LaneSlug };

export const LANE_SLUGS = Object.keys(LANE_META) as LaneSlug[];
export const SHELL_LANE_SET = new Set(LANE_SLUGS);

export const BROWSE_LANES: LaneSlug[] = [
  "events", "shows", "game-day", "regulars", "places", "classes",
];
export const VIEW_LANES: LaneSlug[] = ["calendar", "map"];

export const LANE_ICONS: Record<LaneSlug, typeof Ticket> = {
  events: Ticket,
  shows: FilmSlate,
  "game-day": Trophy,
  regulars: ArrowsClockwise,
  places: MapPin,
  classes: GraduationCap,
  calendar: CalendarBlank,
  map: MapTrifold,
};
```

- [ ] **Step 2: Add --copper CSS variable to the design system**

In the global CSS file (check `web/app/globals.css` or the portal theme file), add `--copper: #C9874F` alongside the other accent variables.

- [ ] **Step 3: Replace SHELL_LANES in normalize-find-url.ts**

```typescript
// Line 1-2: Add import
import { SHELL_LANE_SET } from "@/lib/explore-lane-meta";

// Line 103: Replace the hardcoded Set
// OLD: const SHELL_LANES = new Set(["events", "shows", "regulars", "places", "calendar", "map"]);
// NEW:
const SHELL_LANES = SHELL_LANE_SET;
```

- [ ] **Step 4: Replace SHELL_LANES in FindShellClient.tsx**

```typescript
// Line 2: Add import
import { SHELL_LANE_SET } from "@/lib/explore-lane-meta";

// Lines 42-45: Delete the local SHELL_LANES definition
// Replace all references to SHELL_LANES with SHELL_LANE_SET
```

- [ ] **Step 5: Replace MOBILE_LANE_ORDER in MobileLaneBar.tsx**

```typescript
// Line 2: Add import
import { BROWSE_LANES, VIEW_LANES } from "@/lib/explore-lane-meta";

// Lines 9-12: Delete MOBILE_LANE_ORDER
// Replace usage with [...BROWSE_LANES, ...VIEW_LANES]
```

- [ ] **Step 6: Replace LANE_ORDER in ExploreHome.tsx**

```typescript
// Add import
import { BROWSE_LANES, VIEW_LANES } from "@/lib/explore-lane-meta";

// Lines 13-22: Delete LANE_ORDER
// Replace usage with [...BROWSE_LANES, ...VIEW_LANES]
```

- [ ] **Step 7: Replace lane arrays in FindSidebar.tsx**

```typescript
// Add import
import { BROWSE_LANES, VIEW_LANES, LANE_ICONS } from "@/lib/explore-lane-meta";

// Lines 34-94: Delete the local BROWSE_LANES and VIEW_LANES arrays
// Reconstruct Lane[] from the imported arrays + LANE_META + LANE_ICONS:
const browseLanes: Lane[] = BROWSE_LANES.map((id) => ({
  id,
  label: LANE_META[id].mobileLabel,
  icon: LANE_ICONS[id],
  accent: LANE_META[id].accent,
  href: LANE_META[id].href,
}));
const viewLanes: Lane[] = VIEW_LANES.map((id) => ({
  id,
  label: LANE_META[id].mobileLabel,
  icon: LANE_ICONS[id],
  accent: LANE_META[id].accent,
  href: LANE_META[id].href,
}));
```

- [ ] **Step 8: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No new errors. All lane references resolve correctly.

- [ ] **Step 9: Commit**

```bash
git add web/lib/explore-lane-meta.ts web/lib/normalize-find-url.ts web/components/find/FindShellClient.tsx web/components/find/MobileLaneBar.tsx web/components/find/ExploreHome.tsx web/components/find/FindSidebar.tsx web/app/globals.css
git commit -m "refactor: consolidate lane definitions into explore-lane-meta as single source of truth

- Export LANE_SLUGS, SHELL_LANE_SET, BROWSE_LANES, VIEW_LANES, LANE_ICONS
- Delete 5 duplicate lane list definitions
- Fix normalize-find-url.ts missing game-day and classes (latent bug)
- Update accent colors: shows→vibe, game-day→neon-cyan, classes→copper CSS var"
```

---

## Task 2: URL Builder Utility

**Files:**
- Create: `web/lib/find-url.ts`
- Test: `web/lib/__tests__/find-url.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// web/lib/__tests__/find-url.test.ts
import { describe, it, expect } from "vitest";
import { buildFindUrl } from "@/lib/find-url";

describe("buildFindUrl", () => {
  it("builds base explore URL with no params", () => {
    expect(buildFindUrl({ portalSlug: "atlanta" })).toBe("/atlanta?view=find");
  });

  it("builds lane URL", () => {
    expect(buildFindUrl({ portalSlug: "atlanta", lane: "events" })).toBe(
      "/atlanta?view=find&lane=events"
    );
  });

  it("builds search URL with canonical param name", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: "jazz" })
    ).toBe("/atlanta?view=find&lane=events&search=jazz");
  });

  it("builds date filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", date: "today" })
    ).toBe("/atlanta?view=find&lane=events&date=today");
  });

  it("builds categories filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", categories: "music" })
    ).toBe("/atlanta?view=find&lane=events&categories=music");
  });

  it("builds price filter URL", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", price: "free" })
    ).toBe("/atlanta?view=find&lane=events&price=free");
  });

  it("encodes search values", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: "live jazz & blues" })
    ).toBe("/atlanta?view=find&lane=events&search=live+jazz+%26+blues");
  });

  it("omits undefined params", () => {
    expect(
      buildFindUrl({ portalSlug: "atlanta", lane: "events", search: undefined })
    ).toBe("/atlanta?view=find&lane=events");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run lib/__tests__/find-url.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// web/lib/find-url.ts
import type { LaneSlug } from "@/lib/explore-lane-meta";

interface FindUrlParams {
  portalSlug: string;
  lane?: LaneSlug;
  search?: string;
  date?: "today" | "tomorrow" | "weekend" | "week" | (string & {});
  categories?: string;
  price?: "free";
  genres?: string;
  tags?: string;
  vibes?: string;
  free?: "1";
}

/**
 * Build a canonical Find URL. Param names match what useFilterEngine reads.
 * Construction only — parsing/normalization stays in normalize-find-url.ts.
 */
export function buildFindUrl(params: FindUrlParams): string {
  const sp = new URLSearchParams();
  sp.set("view", "find");

  if (params.lane) sp.set("lane", params.lane);
  if (params.search) sp.set("search", params.search);
  if (params.date) sp.set("date", params.date);
  if (params.categories) sp.set("categories", params.categories);
  if (params.price) sp.set("price", params.price);
  if (params.genres) sp.set("genres", params.genres);
  if (params.tags) sp.set("tags", params.tags);
  if (params.vibes) sp.set("vibes", params.vibes);
  if (params.free) sp.set("free", params.free);

  return `/${params.portalSlug}?${sp.toString()}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run lib/__tests__/find-url.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add web/lib/find-url.ts web/lib/__tests__/find-url.test.ts
git commit -m "feat: add buildFindUrl utility for canonical Find URL construction"
```

---

## Task 3: Regulars Data Fix + Error Logging

**Files:**
- Modify: `web/lib/explore-home-data.ts:563-622` (Regulars queries)
- Modify: `web/lib/explore-home-data.ts` (buildLane error logging)

- [ ] **Step 1: Fix Regulars count and preview queries**

In `web/lib/explore-home-data.ts`, find the 4 Regulars lane queries (around lines 563-622). Each query currently has:

```typescript
.not("series_id", "is", null)
.or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
```

Replace the `.or(...)` line and add category exclusions to match the production Regulars API at `web/app/api/regulars/route.ts`. For each of the 4 Regulars queries, apply these changes:

```typescript
// REMOVE: .or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")
// ADD:
.eq("is_regular_ready", true)
.not("is_class", "eq", true)
.not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)")
```

- [ ] **Step 2: Add error logging in buildLane**

Find the `buildLane` function (or wherever count results are unwrapped). Add error logging before the `count ?? 0` fallback:

```typescript
// After unwrapping the count result:
if (countResult.error) {
  console.warn(`[explore-home-data] Lane "${lane}" count query error:`, countResult.error);
}
const rawTotal = countResult.count ?? 0;
```

Apply the same pattern for `count_today` and `count_weekend` results.

- [ ] **Step 3: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add web/lib/explore-home-data.ts
git commit -m "fix: align Regulars explore-home query with production API filters

Add is_regular_ready strict gate, exclude classes and non-hang categories
(film, theater, education, support, etc.) to prevent showtimes from
appearing in Regulars previews. Add error logging for silent query failures."
```

---

## Task 4: FindSearchInput resolveViewAllHref Fix

**Files:**
- Modify: `web/components/find/FindSearchInput.tsx:24-49`

- [ ] **Step 1: Update resolveViewAllHref to route to Find shell**

In `web/components/find/FindSearchInput.tsx`, find `resolveViewAllHref` (lines 24-49). The current `else` fallback routes to `?view=happening`:

```typescript
// OLD (around line 45):
return `/${portalSlug}?view=happening&search=${encodeURIComponent(q)}`;
```

Update to route to the Find shell events lane:

```typescript
// NEW:
return `/${portalSlug}?view=find&lane=events&search=${encodeURIComponent(q)}`;
```

Also update the venue case to use the Find shell places lane:

```typescript
// OLD:
return `/${portalSlug}?view=places&search=${encodeURIComponent(q)}`;
// NEW:
return `/${portalSlug}?view=find&lane=places&search=${encodeURIComponent(q)}`;
```

- [ ] **Step 2: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add web/components/find/FindSearchInput.tsx
git commit -m "fix: route FindSearchInput 'View all' links to Find shell, not legacy views"
```

---

## Task 5: Events Lane Self-Contained Filters

**Files:**
- Modify: `web/components/find/EventsFinder.tsx:130-155`
- Modify: `web/components/find/FindShellClient.tsx:170-212`
- Modify: `web/components/find/HappeningView.tsx:373-395`

- [ ] **Step 1: Add showFilters prop to EventsFinder default export**

In `web/components/find/EventsFinder.tsx`, update the `EventsFinderProps` interface (around line 30):

```typescript
interface EventsFinderProps {
  portalId: string;
  portalSlug: string;
  portalExclusive: boolean;
  displayMode: DisplayMode;
  hasActiveFilters: boolean;
  vertical?: string | null;
  showFilters?: boolean; // NEW — default true for list mode
}
```

In the default export `EventsFinder` function (around line 155), add filter rendering at the top of the return JSX when `showFilters` is true:

```typescript
export default function EventsFinder({
  portalId,
  portalSlug,
  portalExclusive,
  displayMode,
  hasActiveFilters,
  vertical,
  showFilters = true,  // NEW default
}: EventsFinderProps) {
  // Only show filters in list mode by default
  const renderFilters = showFilters && displayMode === "list";

  return (
    <>
      {renderFilters && (
        <Suspense fallback={<div className="h-10 bg-[var(--night)] rounded-xl mt-3" />}>
          <EventsFinderFiltersInner
            portalId={portalId}
            portalSlug={portalSlug}
            portalExclusive={portalExclusive}
            displayMode={displayMode}
            hasActiveFilters={hasActiveFilters}
            vertical={vertical}
          />
        </Suspense>
      )}
      {/* existing content rendering below */}
    </>
  );
}
```

- [ ] **Step 2: Update FindShellClient to remove hasActiveFilters={false}**

In `web/components/find/FindShellClient.tsx`, the events lane EventsFinder (around line 170) no longer needs `hasActiveFilters={false}` hardcoded since filters are now internal. Calendar and map modes pass `showFilters={false}`:

```typescript
{lane === "events" && (
  <EventsFinder
    portalId={portalId}
    portalSlug={portalSlug}
    portalExclusive={portalExclusive}
    displayMode="list"
    hasActiveFilters={false}
  />
)}
{lane === "calendar" && (
  <EventsFinder
    portalId={portalId}
    portalSlug={portalSlug}
    portalExclusive={portalExclusive}
    displayMode="calendar"
    hasActiveFilters={false}
    showFilters={false}
  />
)}
{lane === "map" && (
  <EventsFinder
    portalId={portalId}
    portalSlug={portalSlug}
    portalExclusive={portalExclusive}
    displayMode="map"
    hasActiveFilters={false}
    showFilters={false}
  />
)}
```

- [ ] **Step 3: Update HappeningView to use EventsFinder's internal filters**

In `web/components/find/HappeningView.tsx`, remove the external `EventsFinderFilters` composition (around lines 373-382) and let `EventsFinder` render its own filters. The `contentType === "all"` guard in HappeningView still applies — when contentType is "all", EventsFinder renders with `showFilters={true}` (default). When contentType is something else, EventsFinder isn't rendered at all, so no filter conflict.

```typescript
// REMOVE the EventsFinderFilters block (lines 373-382):
// {contentType === "all" && (
//   <EventsFinderFilters ... />
// )}

// EventsFinder already renders below — it now handles its own filters:
{contentType === "all" && (
  <EventsFinder
    portalId={portalId}
    portalSlug={portalSlug}
    portalExclusive={portalExclusive}
    displayMode={displayMode}
    hasActiveFilters={hasActiveFilters}
    vertical={vertical}
  />
)}
```

**Important:** Visually verify that the filter bar still appears correctly inside HappeningView's control panel `<section>`. The filters now render at the top of EventsFinder rather than as a sibling inside the control panel. If the layout breaks (filters appear below the control panel instead of inside it), pass `showFilters={false}` to EventsFinder and keep the external `EventsFinderFilters` in HappeningView as a transitional measure. Document what you find.

- [ ] **Step 4: Remove the named EventsFinderFilters export**

Once HappeningView no longer uses it, remove the `EventsFinderFilters` named export from `EventsFinder.tsx` (lines 130-150). Keep `EventsFinderFiltersInner` as a private component within the file.

- [ ] **Step 5: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors. If HappeningView or any other file still imports `EventsFinderFilters`, the build will fail — fix those imports.

- [ ] **Step 6: Visual check**

Run the dev server. Navigate to:
1. `?view=find&lane=events` — verify search bar and filter chips appear above the events list
2. `?view=find&lane=calendar` — verify NO search bar appears above the calendar
3. `?view=find&lane=map` — verify NO search bar appears above the map
4. `?view=happening` — verify filters still work in the legacy HappeningView

- [ ] **Step 7: Commit**

```bash
git add web/components/find/EventsFinder.tsx web/components/find/FindShellClient.tsx web/components/find/HappeningView.tsx
git commit -m "feat: internalize Events lane filters into EventsFinder

Add showFilters prop (default true, list mode only). Events lane in Find
shell now has search bar + filter chips. Calendar/map pass showFilters=false.
Remove external EventsFinderFilters export."
```

---

## Task 6: Sidebar Navigation Redesign

**Files:**
- Modify: `web/components/find/FindSidebar.tsx:19,104-109,140-145,247-256`

- [ ] **Step 1: Remove CategoryPulse import and pulse prop**

In `web/components/find/FindSidebar.tsx`:

```typescript
// Line 19: DELETE this import
// import type { CategoryPulse } from "@/lib/find-data";

// Lines 140-145: Remove pulse from props interface
interface FindSidebarProps {
  portalSlug: string;
  activeLane?: string | null;
  // pulse?: CategoryPulse[];  // DELETE
  laneStates?: Record<string, { state: string; count: number; count_today: number | null }>;
}

// Lines 104-109: Delete the getBadgeCount function that uses pulse
// Also delete LANE_PULSE_MAPPING if it's only used by getBadgeCount
```

- [ ] **Step 2: Add search button above sidebar**

Add a search button (not an input) near the top of the sidebar, before the Browse section. Use a Phosphor `MagnifyingGlass` icon:

```typescript
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

// In the sidebar render, above the BROWSE section:
<button
  onClick={() => router.push(`/${portalSlug}?view=find`)}
  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg
    bg-[var(--void)]/50 border border-[var(--twilight)]/40
    text-[var(--muted)] text-sm hover:border-[var(--twilight)]
    hover:text-[var(--cream)] transition-colors"
>
  <MagnifyingGlass size={14} weight="duotone" />
  <span>Search...</span>
</button>
```

- [ ] **Step 3: Restyle "Explore" heading as persistent home link**

Replace the back-arrow pattern (lines 247-256) with a heading that always looks clickable and gets active state when on home:

```typescript
<a
  href={`/${portalSlug}?view=find`}
  onClick={handleExploreClick}
  className={`text-2xl font-bold leading-none transition-colors cursor-pointer ${
    !visualActiveLane
      ? "text-[var(--coral)]"  // Active state when on home
      : "text-[var(--cream)] hover:text-[var(--coral)]"
  }`}
>
  Explore
</a>
```

No `ArrowLeft` icon. No conditional rendering. The heading is always the same — only its color changes based on whether we're on home or in a lane.

- [ ] **Step 4: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors. The `pulse` prop removal may cause errors if any caller passes it — check `FindShellClient.tsx` (it doesn't pass pulse, confirmed from code review).

- [ ] **Step 5: Visual check**

Run dev server. Navigate to:
1. `?view=find` (home) — "Explore" should be coral colored, search button visible
2. `?view=find&lane=events` — "Explore" should be cream, clickable back to home
3. Click the search button — should navigate to home

- [ ] **Step 6: Commit**

```bash
git add web/components/find/FindSidebar.tsx
git commit -m "feat: sidebar nav redesign — Explore heading as home, search button, remove pulse"
```

---

## Task 7: Mobile Lane Bar Always Renders

**Files:**
- Modify: `web/components/find/MobileLaneBar.tsx:44,49-56`

- [ ] **Step 1: Remove the early-return guard**

In `web/components/find/MobileLaneBar.tsx`, delete line 44:

```typescript
// DELETE: if (!activeLane && !isPending) return null;
```

- [ ] **Step 2: Ensure Home icon is always first and gets active state on home**

The Home icon (lines 49-56) already exists. Update its active state to highlight when no lane is active:

```typescript
<a
  href={`/${portalSlug}?view=find`}
  onClick={(e) => handleClick(portalSlug, null, e)}
  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
    !activeLane && !isPending
      ? "bg-[var(--coral)]/15 text-[var(--coral)]"  // Active when on home
      : "text-[var(--muted)] hover:text-[var(--cream)]"
  }`}
>
  <House size={14} weight="duotone" />
  Explore
</a>
```

- [ ] **Step 3: Visual check on mobile viewport**

Run dev server. Use browser devtools to set mobile viewport (375px wide). Navigate to:
1. `?view=find` (home) — mobile lane bar should be visible, "Explore" chip active
2. `?view=find&lane=events` — "Events" chip active, "Explore" chip inactive
3. Tap "Explore" chip — should navigate back to home

- [ ] **Step 4: Commit**

```bash
git add web/components/find/MobileLaneBar.tsx
git commit -m "fix: mobile lane bar always renders, Home icon active on Explore home"
```

---

## Task 8: ExploreHome Search-Forward Rewrite

**Files:**
- Rewrite: `web/components/find/ExploreHome.tsx`
- Modify: `web/lib/explore-home-data.ts` (remove preview queries)
- Modify: `web/lib/types/explore-home.ts` (remove items from LanePreview)

- [ ] **Step 1: Remove items from LanePreview type**

In `web/lib/types/explore-home.ts`, remove the `items` field and `PreviewItem` type if no longer needed:

```typescript
export interface LanePreview {
  state: LaneState;
  count: number;
  count_today: number | null;
  count_weekend: number | null;
  copy: string;
  // items: PreviewItem[];  // DELETE
}
```

Check if `PreviewItem` is imported elsewhere. If only used by ExploreHomeSection (which we're deleting), remove the type too.

- [ ] **Step 2: Remove preview item queries from explore-home-data.ts**

In `web/lib/explore-home-data.ts`, delete:
- The 6 preview item queries (the data-fetching queries at indices 3, 7, 11, 15, 17, 21 in the Promise.allSettled array)
- Helper functions: `eventPreviewSelect`, `EventPreviewRow`, `PlacePreviewRow`, `eventToPreviewItem`, `placeToPreviewItem`, `formatTimeCompact`, `PREVIEW_LIMIT`
- The `items` field population in the lane-building logic

Keep: all count queries, `computeLaneState`, `generateLaneCopy`, `getWeekendRange`, `getTimeBoostForLane`, `buildLane` structure, portal scope filtering.

- [ ] **Step 3: Rewrite ExploreHome.tsx**

Replace the entire component with the search-forward layout:

```typescript
"use client";

import { Suspense, useState } from "react";
import { useRouter } from "next/navigation";
import FindSearchInput from "@/components/find/FindSearchInput";
import { BROWSE_LANES, VIEW_LANES, LANE_META, LANE_ICONS } from "@/lib/explore-lane-meta";
import { buildFindUrl } from "@/lib/find-url";
import type { LaneSlug } from "@/lib/explore-lane-meta";
import type { ExploreHomeResponse } from "@/lib/types/explore-home";
import { CalendarBlank, MapTrifold } from "@phosphor-icons/react/dist/ssr";

interface QuickChip {
  label: string;
  href: string;
}

function getQuickChips(portalSlug: string): QuickChip[] {
  const hour = new Date().getHours();
  const chips: QuickChip[] = [
    { label: "Tonight", href: buildFindUrl({ portalSlug, lane: "events", date: "today" }) },
    { label: "This weekend", href: buildFindUrl({ portalSlug, lane: "events", date: "weekend" }) },
    { label: "Free", href: buildFindUrl({ portalSlug, lane: "events", price: "free" }) },
    { label: "Music", href: buildFindUrl({ portalSlug, lane: "events", categories: "music" }) },
    { label: "Classes", href: buildFindUrl({ portalSlug, lane: "classes" }) },
  ];

  // Time-of-day reordering: morning pushes Classes first, evening pushes Tonight first
  if (hour < 12) {
    const classesIdx = chips.findIndex((c) => c.label === "Classes");
    if (classesIdx > 0) {
      const [cls] = chips.splice(classesIdx, 1);
      chips.unshift(cls);
    }
  }
  // Evening: Tonight is already first, no reordering needed

  return chips;
}

interface ExploreHomeProps {
  portalSlug: string;
  portalId: string;
  data: ExploreHomeResponse | null;
  loading: boolean;
  onRetry?: () => void;
}

export default function ExploreHome({
  portalSlug,
  portalId,
  data,
  loading,
  onRetry,
}: ExploreHomeProps) {
  const router = useRouter();
  const [preSearchData, setPreSearchData] = useState<unknown>(null);
  const [preSearchLoading, setPreSearchLoading] = useState(false);

  const chips = getQuickChips(portalSlug);

  return (
    <div className="flex flex-col gap-6 max-w-lg mx-auto px-4 py-8">
      {/* Search hero */}
      <div className="text-center">
        <p className="text-2xs font-mono uppercase tracking-[0.14em] text-[var(--muted)] mb-3">
          Explore {data?.portalLabel ?? "Atlanta"}
        </p>
        <Suspense fallback={<div className="h-12 bg-[var(--night)] rounded-xl" />}>
          <FindSearchInput
            portalSlug={portalSlug}
            portalId={portalId}
            placeholder="Search places, events, classes..."
            onPreSearchChange={(d, l) => {
              setPreSearchData(d);
              setPreSearchLoading(l);
            }}
          />
        </Suspense>
      </div>

      {/* Quick-action chips */}
      <div className="flex gap-2 justify-center flex-wrap">
        {chips.map((chip) => (
          <a
            key={chip.label}
            href={chip.href}
            onClick={(e) => {
              e.preventDefault();
              router.push(chip.href);
            }}
            className="px-4 py-2 rounded-full text-sm font-medium
              bg-[var(--void)]/60 border border-[var(--twilight)]/40
              text-[var(--cream)]/80 hover:border-[var(--coral)]/40
              hover:text-[var(--coral)] transition-colors"
          >
            {chip.label}
          </a>
        ))}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--twilight)]/20" />

      {/* Lane tile grid */}
      <div className="grid grid-cols-2 gap-2">
        {BROWSE_LANES.map((slug) => {
          const meta = LANE_META[slug];
          const Icon = LANE_ICONS[slug];
          const laneData = data?.lanes?.[slug];
          const count = laneData?.count ?? 0;
          const isZero = count === 0 && !loading;

          return (
            <a
              key={slug}
              href={meta.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(meta.href);
              }}
              className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                isZero
                  ? "opacity-50 border-[var(--twilight)]/20 bg-transparent"
                  : "border-[var(--twilight)]/30 hover:border-[var(--twilight)]/60"
              }`}
              style={{
                background: isZero
                  ? "transparent"
                  : `color-mix(in srgb, ${meta.accent} 6%, transparent)`,
              }}
            >
              <Icon
                size={22}
                weight="duotone"
                className="flex-shrink-0"
                style={{ color: meta.accent }}
              />
              <div className="min-w-0">
                <div className="text-sm font-medium text-[var(--cream)] truncate">
                  {meta.mobileLabel}
                </div>
                {!isZero && count > 0 && (
                  <div
                    className="text-2xs font-mono"
                    style={{ color: meta.accent }}
                  >
                    {laneData?.copy || `${count.toLocaleString()}`}
                  </div>
                )}
                {loading && (
                  <div className="h-3 w-16 rounded bg-[var(--twilight)]/30 animate-pulse" />
                )}
              </div>
            </a>
          );
        })}
      </div>

      {/* Utility links: Calendar & Map */}
      <div className="flex gap-4 justify-center">
        {VIEW_LANES.map((slug) => {
          const meta = LANE_META[slug];
          const Icon = LANE_ICONS[slug];
          return (
            <a
              key={slug}
              href={meta.href}
              onClick={(e) => {
                e.preventDefault();
                router.push(meta.href);
              }}
              className="flex items-center gap-1.5 text-sm text-[var(--muted)]
                hover:text-[var(--cream)] transition-colors"
            >
              <Icon size={16} weight="duotone" />
              {meta.mobileLabel}
            </a>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Update ExploreHome callsite in FindShellClient**

Check how `FindShellClient` renders `ExploreHome` when no lane is active. Update props to match the new interface (add `portalId` if not already passed). Remove any `ExploreHomeSection` imports.

- [ ] **Step 5: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors. ExploreHomeSection imports will fail if still referenced — remove them.

- [ ] **Step 6: Visual check**

Run dev server. Navigate to `?view=find`:
1. Search bar should render with typeahead functionality
2. Quick-action chips should be visible and clickable
3. Lane tiles should show icons, labels, and counts with accent backgrounds
4. Calendar & Map utility links should appear below the grid
5. Clicking a lane tile should navigate to that lane
6. Clicking a chip should navigate to the events lane with the correct filter

- [ ] **Step 7: Commit**

```bash
git add web/components/find/ExploreHome.tsx web/lib/explore-home-data.ts web/lib/types/explore-home.ts web/components/find/FindShellClient.tsx
git commit -m "feat: search-forward ExploreHome with FindSearchInput hero, quick-action chips, lane tile grid

Replace preview grid with search-forward layout. Remove preview item
queries from explore-home-data. Lane tiles show icons with accent-tinted
backgrounds. Calendar/Map as utility links."
```

---

## Task 9: Dead Code Removal

**Files:**
- Delete: `web/components/find/FindView.tsx`
- Delete: `web/components/find/ExploreHomeSection.tsx`
- Delete: `web/components/find/FindToolChipRow.tsx`
- Delete: `web/components/find/RightNowSection.tsx`
- Delete: `web/components/find/FindSpotlight.tsx`
- Delete: `web/lib/find-data.ts`
- Delete: `web/app/api/portals/[slug]/find-data/route.ts`
- Modify: `web/app/[portal]/page.tsx:16-18` (remove FindView import)

- [ ] **Step 1: Verify no live consumers**

Run these greps to confirm each file is dead:

```bash
cd web
grep -r "FindView" --include="*.ts" --include="*.tsx" -l
grep -r "ExploreHomeSection" --include="*.ts" --include="*.tsx" -l
grep -r "FindToolChipRow" --include="*.ts" --include="*.tsx" -l
grep -r "RightNowSection" --include="*.ts" --include="*.tsx" -l
grep -r "FindSpotlight" --include="*.ts" --include="*.tsx" -l
grep -r "find-data" --include="*.ts" --include="*.tsx" -l
```

For each grep:
- `FindView` should only appear in `FindView.tsx` itself and `page.tsx` (the import to remove)
- `ExploreHomeSection` should only appear in itself (ExploreHome was rewritten in Task 8)
- `FindToolChipRow` should only appear in itself and `FindView.tsx`
- `RightNowSection` should only appear in itself and `FindView.tsx` (not `city-pulse/section-builders.ts` which has a different `buildRightNowSection`)
- `FindSpotlight` should only appear in itself and `FindView.tsx`
- `find-data` should only appear in itself, `FindView.tsx`, `FindToolChipRow.tsx`, `RightNowSection.tsx`, and the API route. **Confirm FindSidebar.tsx no longer imports it** (cleaned up in Task 6).

If any grep shows unexpected consumers, stop and investigate before deleting.

- [ ] **Step 2: Remove FindView dynamic import from page.tsx**

In `web/app/[portal]/page.tsx`, delete lines 16-18:

```typescript
// DELETE:
const FindView = dynamic(() => import("@/components/find/FindView"), {
  loading: () => <div className="py-16 text-center text-[var(--muted)] font-mono text-sm">Loading...</div>,
});
```

Also search for any `<FindView` JSX usage and remove it (should be none based on code review).

- [ ] **Step 3: Delete all dead files**

```bash
rm web/components/find/FindView.tsx
rm web/components/find/ExploreHomeSection.tsx
rm web/components/find/FindToolChipRow.tsx
rm web/components/find/RightNowSection.tsx
rm web/components/find/FindSpotlight.tsx
rm web/lib/find-data.ts
rm web/app/api/portals/[slug]/find-data/route.ts
```

- [ ] **Step 4: Update rate limit test coverage if needed**

Check `web/lib/api-rate-limit-coverage.test.ts` for references to `find-data`. Remove the route from the allowed-uncovered list if present.

- [ ] **Step 5: Run TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: No errors. If anything breaks, a live consumer was missed in Step 1.

- [ ] **Step 6: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests pass. No test files should import from deleted modules.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove dead code — FindView, ExploreHomeSection, FindToolChipRow, RightNowSection, FindSpotlight, find-data

All superseded by ExploreHome rewrite and Find shell. Verified no live
consumers via grep before deletion. Removes ~800 lines of unused code
and one dead API route."
```

---

## Task 10: Integration Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `cd web && npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 2: Run full test suite**

Run: `cd web && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Visual smoke test — Explore home**

Navigate to `?view=find`:
- Search bar renders with typeahead
- Quick-action chips visible, clicking "Tonight" goes to `?view=find&lane=events&date=today`
- Lane tiles show correct icons, labels, accent colors, and liveness counts
- Calendar & Map links work
- Mobile viewport: lane bar visible on home with active Home icon

- [ ] **Step 4: Visual smoke test — lane navigation**

From Explore home:
- Click "Events" tile → events lane loads with search bar and filter chips
- Click "Shows" tile → shows lane loads
- Sidebar: "Explore" heading is cream (not active), clicking it returns to home
- Sidebar: search button navigates to home
- Mobile: lane bar shows correct active state per lane

- [ ] **Step 5: Visual smoke test — legacy path**

Navigate to `?view=happening`:
- HappeningView still works with filters
- No regressions in content type switching or display modes

- [ ] **Step 6: Visual smoke test — accent colors**

Check sidebar liveness dots and mobile lane bar chips:
- Events = coral
- Shows = vibe (purple)
- Game Day = neon-cyan
- Regulars = gold
- Places = neon-green
- Classes = copper

- [ ] **Step 7: Document any issues found**

If anything is broken, create a follow-up task. Do not block the commit for cosmetic issues — only functional regressions.
