# Find View Remediation — Design Spec

**Date:** 2026-04-02
**Status:** Approved (rev 2 — post-review)

## Context

A product/design audit of the Find/Explore view identified 10+ issues ranging from broken search to wrong data to missing navigation. Architect root-cause analysis revealed these aren't isolated bugs — they stem from structural issues: no shared URL contract, duplicated lane definitions, a retrofitted Events lane, and an ExploreHome that serves as a "table of contents" rather than an intent-driven discovery surface.

This spec addresses all audit findings through a cohesive redesign rather than individual patches.

## Decisions Made

- **ExploreHome concept:** Search-forward home (not grid-of-previews, not tonight-first). Explore answers "what are you looking for?" — the Feed already handles "what's happening."
- **Layout:** Stacked — search hero + quick-action chips + visually rich 2-col lane tile grid with icons, accent-tinted backgrounds, and liveness counts.
- **Sidebar home pattern:** "Explore" heading is the home affordance (always clickable, gets active state when on home). Search button (not input) at top for persistent search discoverability.
- **Adaptive UX:** Quick-action chips ordered by time-of-day context. Hook point for user-signal reordering later, but no personalization logic in this spec.
- **HappeningView coexistence:** `?view=happening` continues to work as a legacy path. Not retired in this spec. Events filter internalization must preserve HappeningView's layout.

---

## 1. ExploreHome Redesign

### Current State
ExploreHome renders 8 lane preview sections (ExploreHomeSection) in a two-column masonry grid. Each section fetches preview items and counts via `/api/portals/[slug]/explore-home`. The search bar is a plain `<input>` with no typeahead. Calendar and Map sections show "Coming soon" despite being functional lanes. Regulars shows movie showtimes due to missing query filters.

### New Design
Replace the preview grid with a search-forward layout:

1. **Search hero** — Full `FindSearchInput` component (typeahead, recent searches, suggestions). Not a bespoke `<input>`. Implementation notes:
   - Must be wrapped in `<Suspense>` (FindSearchInput uses `useSearchParams()`)
   - Must replicate `onPreSearchChange` / `PreSearchState` pattern from EventsFinderFilters for trending pills
   - `resolveViewAllHref` must be updated to route to `?view=find&lane=events&search=` instead of `?view=happening&search=`
2. **Quick-action chips** — Below search. Each chip navigates to a lane with pre-set filters using actual param names from `useFilterEngine`:
   - "Tonight" → `?view=find&lane=events&date=today`
   - "This weekend" → `?view=find&lane=events&date=weekend`
   - "Free" → `?view=find&lane=events&price=free`
   - "Music" → `?view=find&lane=events&categories=music`
   - "Classes" → `?view=find&lane=classes`
   - Chip order: determined by time-of-day context (e.g., morning → Classes first, evening → Tonight/Music first). Implementation is a simple `getChipOrder(hour: number)` function. Hook point for user-signal reordering added but not implemented.
3. **Lane tile grid** — 2-column grid of visually rich lane tiles. Each tile: lane icon + label + liveness count, with accent-tinted background using the lane's accent color. Tiles should feel like destinations, not menu items — think icon grid with `h-24` minimum height, subtle accent `background: color-mix(in srgb, var(--accent) 8%, transparent)`. Click navigates to that lane.
4. **Calendar & Map** — Utility links below the lane grid (icon + label). Not data-dependent, no liveness state. Always navigable.
5. **Zero-count graceful degradation** — Lanes with 0 count still appear but render muted (reduced opacity, no count shown). A portal with sparse coverage should look intentionally calm, not broken.

### Files Changed
- `web/components/find/ExploreHome.tsx` — Rewrite. Replace preview grid with search + chips + lane tile grid.
- `web/components/find/ExploreHomeSection.tsx` — Delete (after ExploreHome rewrite lands).
- `web/components/find/FindSearchInput.tsx` — Update `resolveViewAllHref` to route to Find shell, not HappeningView.
- `web/app/api/portals/[slug]/explore-home/route.ts` — Keep as count-only endpoint (has correct caching headers and in-memory shared cache). Remove preview item queries.
- `web/lib/explore-home-data.ts` — Reduce to lane count queries only. Fix Regulars filters (see Section 5). Delete `items` field from `LanePreview` type, delete preview queries, delete mapper functions.

---

## 2. Sidebar Navigation

### Current State
"Explore" title at sidebar top shows a `←` back arrow only when a lane is active. On the Explore home, it reads as a static heading. No persistent home affordance.

### New Design
- **"Explore" heading is the home affordance** — Always clickable, always links to `?view=find`. When on Explore home (no lane selected), it gets active accent treatment (e.g., accent color text, subtle underline, or background highlight). When in a lane, it reads as a clickable link back to home. No back arrow needed — the heading itself is the persistent landmark.
- **Search button** at the top of the sidebar (above "Explore" heading or integrated into it). Styled as a button with a search icon, NOT as an `<input>`. Clicking it navigates to `?view=find` and focuses the main `FindSearchInput`. This avoids the false-affordance problem of a non-functional input that users try to type into.
- **Remove the `← Explore` back arrow pattern entirely.** No contextual back navigation.

### Files Changed
- `web/components/find/FindSidebar.tsx` — Restyle "Explore" heading as persistent home link with active state, add search button, remove back arrow logic. Also remove `CategoryPulse` type import from `find-data.ts` and the unused `pulse` prop.

---

## 3. Mobile Lane Bar

### Current State
`MobileLaneBar` returns `null` when no lane is active (`if (!activeLane && !isPending) return null`). Mobile users on the Explore home have zero lane sub-navigation.

### New Design
- **Always render** — Remove the early-return guard.
- **Home/Search as first icon** in the mobile strip. When on Explore home, Home is active. When in a lane, that lane is active.
- The component already has the Home button with a House icon — it just needs to always render.

### Files Changed
- `web/components/find/MobileLaneBar.tsx` — Remove line 44 guard, ensure Home icon renders first.

---

## 4. Architecture Fixes

### 4a. URL Contract Layer

**Problem:** 6 different files construct Find URLs ad-hoc. ExploreHome uses `q=`, everything else uses `search=`. No shared param names.

**Fix:** Create `web/lib/find-url.ts`:
```typescript
export function buildFindUrl(params: {
  portalSlug: string;
  lane?: LaneSlug;
  search?: string;
  date?: 'today' | 'tomorrow' | 'weekend' | 'week' | string;
  categories?: string;
  price?: 'free';
  // ...other canonical params matching useFilterEngine
}): string
```

All components import `buildFindUrl` instead of constructing URLs via string interpolation. Canonical param names enforced at the type level. **Param names must match what `useFilterEngine` actually reads** (`date` not `when`, `categories` not `category`).

This utility is **construction-only**. URL parsing/normalization stays in `normalize-find-url.ts` — no overlap.

### 4b. Lane List Consolidation

**Problem:** Lane membership defined in 6 separate files. `normalize-find-url.ts` is missing `game-day` and `classes` (latent bug).

**Fix:** `web/lib/explore-lane-meta.ts` becomes the single source:
```typescript
export const LANE_SLUGS: LaneSlug[] = Object.keys(LANE_META) as LaneSlug[];
export const SHELL_LANE_SET = new Set(LANE_SLUGS);
export const BROWSE_LANES: LaneSlug[] = ['events', 'shows', 'game-day', 'regulars', 'places', 'classes'];
export const VIEW_LANES: LaneSlug[] = ['calendar', 'map'];
```

Delete duplicate definitions in: `FindShellClient.tsx`, `MobileLaneBar.tsx`, `ExploreHome.tsx`, `FindSidebar.tsx`, `normalize-find-url.ts`.

### 4c. Events Lane Self-Contained Filters

**Problem:** Events is the only lane with split filter/content exports. `FindShellClient` imports `EventsFinder` (content only) but not `EventsFinderFilters`. Every other lane self-contains its filter UI.

**Fix:** Move `EventsFinderFilters` rendering into `EventsFinder` itself, controlled by a `showFilters` prop (default `true`). This matches the pattern used by Shows, Regulars, Places, Classes, and Game Day. Remove the separate `EventsFinderFilters` export.

**HappeningView preservation:** `HappeningView` (at `web/components/find/HappeningView.tsx`) currently renders filters inside its own control panel `<section>` with sticky positioning, separate from the content area. After internalization, HappeningView renders `<EventsFinder showFilters={true} />` and the filters appear inside EventsFinder's own layout. Verify this doesn't break the HappeningView control panel visual (tabs + display mode toggle sit above the filters). If the layout diverges, HappeningView can pass `showFilters={false}` and continue rendering its own filter composition as a transitional measure.

**Calendar/map guard:** `FindShellClient` renders `EventsFinder` with `displayMode="calendar"` and `displayMode="map"`. These must pass `showFilters={false}` explicitly to avoid adding a search bar above calendar/map views.

### 4d. Accent Color Differentiation

**Problem:** Events, Shows, Game Day all use `--coral`. Places and Calendar both use `--neon-green`. Classes uses a hardcoded hex value.

**Fix:** Update `explore-lane-meta.ts`:

| Lane | Current | New |
|------|---------|-----|
| Events | `--coral` | `--coral` (keep) |
| Shows | `--coral` | `--vibe` |
| Game Day | `--coral` | `--neon-cyan` |
| Regulars | `--gold` | `--gold` (keep) |
| Places | `--neon-green` | `--neon-green` (keep) |
| Classes | `#C9874F` | CSS var (add `--copper: #C9874F` to design system) |
| Calendar | `--neon-green` | n/a (utility link) |
| Map | `--neon-cyan` | n/a (utility link) |

### Files Changed
- `web/lib/find-url.ts` — New file. URL builder utility.
- `web/lib/explore-lane-meta.ts` — Single source for lane lists, updated accents.
- `web/lib/normalize-find-url.ts` — Import lane set from meta instead of hardcoding.
- `web/components/find/FindShellClient.tsx` — Import lane set from meta, remove duplicate. Pass `showFilters={false}` for calendar/map EventsFinder instances.
- `web/components/find/MobileLaneBar.tsx` — Import lane order from meta, remove duplicate.
- `web/components/find/ExploreHome.tsx` — Import lane order from meta, remove duplicate.
- `web/components/find/FindSidebar.tsx` — Import lane lists from meta, remove duplicates.
- `web/components/find/EventsFinder.tsx` — Internalize filter rendering with `showFilters` prop.
- `web/components/find/HappeningView.tsx` — Update to use `EventsFinder` with `showFilters={true}` instead of composing `EventsFinderFilters` externally. Verify layout compatibility.

---

## 5. Data Layer Fixes

### 5a. Regulars Count Query Parity

**Problem:** The Regulars count query in `explore-home-data.ts` uses a broad `.or("is_feed_ready.eq.true,is_feed_ready.is.null,is_regular_ready.eq.true")` filter. The production Regulars API has 3 additional filters that exclude film, theater, education, support groups, etc. Film showtimes leak through because they have `series_id` and `is_feed_ready=true`.

**Fix:** Align the count query with the Regulars API (`/api/regulars/route.ts`):
1. Replace `.or(...)` with `.eq("is_regular_ready", true)`
2. Add `.not("is_class", "eq", true)`
3. Add `.not("category_id", "in", "(film,theater,education,support,support_group,civic,volunteer,religious,community,family,learning)")`

### 5b. Error Logging in buildLane

**Problem:** Supabase query errors are silently swallowed — `count: null` becomes `0` becomes "zero" state.

**Fix:** Add `console.warn` for non-null errors in `buildLane()` so failed queries surface in server logs.

### 5c. Scope Reduction

With ExploreHome no longer fetching preview items (only counts for the lane grid), the explore-home data layer shrinks significantly. Preview item queries are deleted. Only per-lane count queries remain. Keep the API route (it has correct `s-maxage=120, stale-while-revalidate=300` caching headers and in-memory shared cache that would be lost if inlined).

Delete from `explore-home-data.ts`: `eventPreviewSelect`, `EventPreviewRow`, `PlacePreviewRow`, `eventToPreviewItem`, `placeToPreviewItem`, `formatTimeCompact`, `PREVIEW_LIMIT`, and the 6 preview item queries. Delete `items` field from `LanePreview` type in `web/lib/types/explore-home.ts`.

### Files Changed
- `web/lib/explore-home-data.ts` — Fix Regulars filters, add error logging, remove preview item queries and helpers.
- `web/lib/types/explore-home.ts` — Remove `items` from `LanePreview` type.

---

## 6. Dead Code Removal

**Important: `ExploreHomeSection.tsx` becomes dead after the ExploreHome rewrite (Section 1), not before. Delete it as a follow-up to the rewrite, not independently.**

**Important: `find-data.ts` has a live consumer — `FindSidebar.tsx` imports `CategoryPulse` type from it. The `pulse` prop on FindSidebar is unused (never passed from FindShellClient). Remove the `pulse` prop and `CategoryPulse` import from FindSidebar BEFORE deleting `find-data.ts`.**

| File | Action | Reason |
|------|--------|--------|
| `web/components/find/FindView.tsx` | Delete | Imported at `web/app/[portal]/page.tsx` line 16 but never rendered. Superseded by ExploreHome. |
| `web/components/find/ExploreHomeSection.tsx` | Delete (after Section 1) | Preview card component, dead after ExploreHome rewrite. |
| `web/components/find/FindToolChipRow.tsx` | Delete | Only imported by FindView. |
| `web/components/find/RightNowSection.tsx` | Delete | Only imported by FindView. (Note: `buildRightNowSection` in `city-pulse/section-builders.ts` is a separate, live function — naming collision only.) |
| `web/components/find/FindSpotlight.tsx` | Delete | Only imported by FindView. |
| `web/lib/find-data.ts` | Delete (after FindSidebar cleanup) | After removing `CategoryPulse` import from FindSidebar, no live consumers remain. |
| `web/app/api/portals/[slug]/find-data/route.ts` | Delete | API route only consumed by FindView. Also update `web/lib/api-rate-limit-coverage.test.ts` which references this route. |
| Dynamic import in `web/app/[portal]/page.tsx` line 16 | Remove | Unused `FindView` import. |

**Verification method:** `grep -r "FindToolChipRow\|RightNowSection\|FindSpotlight\|find-data\|FindView" web/` before each deletion to confirm no other consumers.

---

## Implementation Order

Based on dependency analysis:

1. **Lane meta consolidation** (`explore-lane-meta.ts`) — everything else depends on this
2. **`buildFindUrl` utility** — ExploreHome rewrite and sidebar changes need it
3. **`normalize-find-url.ts` fix** — add `game-day` and `classes` to SHELL_LANES via import from meta
4. **Accent color updates** — low-risk metadata change
5. **Regulars count query fix** — highest immediate-value data fix
6. **Error logging in buildLane** — observability improvement
7. **ExploreHome rewrite** + **MobileLaneBar guard removal** + **Sidebar changes** — the main visual work, done together
8. **FindSearchInput `resolveViewAllHref` fix** — needed once hero search is live
9. **Explore-home data layer reduction** — remove preview queries after ExploreHome no longer needs them
10. **Dead code removal** — FindSidebar `pulse` prop cleanup → FindView + dependencies → find-data.ts + API route → ExploreHomeSection
11. **Events filter internalization** — highest risk, done last with careful HappeningView testing

---

## Out of Scope

- SmartImage fallback audit across other card surfaces
- Quick-action chip adaptive ordering by user signals (hook point added, no personalization logic)
- Search quality improvements (typeahead ranking, cross-lane results)
- Events lane filter design (which categories/filters to show — separate design question)
- HappeningView retirement (coexists for now, retirement is a separate decision)
- "Near me" / geolocation sort (no distance sort exists in filter engine today — future work)
