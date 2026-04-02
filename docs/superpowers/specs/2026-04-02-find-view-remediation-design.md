# Find View Remediation — Design Spec

**Date:** 2026-04-02
**Status:** Approved

## Context

A product/design audit of the Find/Explore view identified 10+ issues ranging from broken search to wrong data to missing navigation. Architect root-cause analysis revealed these aren't isolated bugs — they stem from structural issues: no shared URL contract, duplicated lane definitions, a retrofitted Events lane, and an ExploreHome that serves as a "table of contents" rather than an intent-driven discovery surface.

This spec addresses all audit findings through a cohesive redesign rather than individual patches.

## Decisions Made

- **ExploreHome concept:** Search-forward home (not grid-of-previews, not tonight-first). Explore answers "what are you looking for?" — the Feed already handles "what's happening."
- **Layout:** Stacked — search hero + quick-action chips + compact 2-col lane grid with liveness counts.
- **Sidebar home pattern:** Inline search affordance at top + "Home" as the first Browse list item. No contextual back arrow.
- **Adaptive UX:** Quick-action chips ordered by time-of-day context. Hook point for user-signal reordering later, but no personalization logic in this spec.

---

## 1. ExploreHome Redesign

### Current State
ExploreHome renders 8 lane preview sections (ExploreHomeSection) in a two-column masonry grid. Each section fetches preview items and counts via `/api/portals/[slug]/explore-home`. The search bar is a plain `<input>` with no typeahead. Calendar and Map sections show "Coming soon" despite being functional lanes. Regulars shows movie showtimes due to missing query filters.

### New Design
Replace the preview grid with a search-forward layout:

1. **Search hero** — Full `FindSearchInput` component (typeahead, recent searches, suggestions). Not a bespoke `<input>`.
2. **Quick-action chips** — Below search. "Tonight", "This weekend", "Free", "Near me", "Outdoors". Each chip navigates to a lane with pre-set filters:
   - "Tonight" → `?view=find&lane=events&when=tonight`
   - "This weekend" → `?view=find&lane=events&when=weekend`
   - "Free" → `?view=find&lane=events&price=free`
   - "Near me" → `?view=find&lane=places&sort=distance`
   - "Outdoors" → `?view=find&lane=events&category=outdoors`
   - Chip order: determined by time-of-day context (e.g., morning → Classes/Outdoors first, evening → Tonight/Shows first). Implementation is a simple `getChipOrder(hour: number)` function. Hook point for user-signal reordering added but not implemented.
3. **Compact lane grid** — 2-column grid of lane tiles. Each tile: accent dot + label + liveness count. Click navigates to that lane. No preview images, no preview items.
4. **Calendar & Map** — Utility links below the lane grid (icon + label). Not data-dependent, no liveness state. Always navigable.

### Files Changed
- `web/components/find/ExploreHome.tsx` — Rewrite. Replace preview grid with search + chips + lane grid.
- `web/components/find/ExploreHomeSection.tsx` — Delete.
- `web/app/api/portals/[slug]/explore-home/route.ts` — Delete (or reduce to count-only if liveness counts still need a server endpoint).
- `web/lib/explore-home-data.ts` — Reduce to lane count queries only (no preview item queries). Fix Regulars filters (see Section 5).

---

## 2. Sidebar Navigation

### Current State
"Explore" title at sidebar top shows a `←` back arrow only when a lane is active. On the Explore home, it reads as a static heading. No persistent home affordance.

### New Design
- **Inline search input** at the top of the sidebar. Not a functional search — clicking it navigates to `?view=find` (Explore home) and focuses the main `FindSearchInput`. Visual affordance only.
- **"Home" as first Browse item** — House icon, same visual weight as lane items. Gets active accent treatment when on Explore home (no lane selected). Deactivates when a lane is active.
- **Remove the `← Explore` back arrow pattern entirely.** The "Explore" title becomes static text (or is removed if the search input + Home item make it redundant). No contextual back navigation.

### Files Changed
- `web/components/find/FindSidebar.tsx` — Add search input affordance, add Home item to Browse list, remove back arrow logic.

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
  when?: string;
  category?: string;
  // ...other canonical params
}): string
```

All components import `buildFindUrl` instead of constructing URLs via string interpolation. Canonical param names enforced at the type level.

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

**Fix:** Move `EventsFinderFilters` rendering into `EventsFinder` itself, controlled by a `showFilters` prop (default `true`). This matches the pattern used by Shows, Regulars, Places, Classes, and Game Day. Remove the separate `EventsFinderFilters` export. Update `HappeningView` to let `EventsFinder` render its own filters instead of composing them externally.

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
- `web/components/find/FindShellClient.tsx` — Import lane set from meta, remove duplicate.
- `web/components/find/MobileLaneBar.tsx` — Import lane order from meta, remove duplicate.
- `web/components/find/ExploreHome.tsx` — Import lane order from meta, remove duplicate.
- `web/components/find/FindSidebar.tsx` — Import lane lists from meta, remove duplicates.
- `web/components/find/EventsFinder.tsx` — Internalize filter rendering.
- `web/components/happening/HappeningView.tsx` — Stop composing EventsFinderFilters externally.

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

With ExploreHome no longer fetching preview items (only counts for the lane grid), the explore-home data layer shrinks significantly. Preview item queries are deleted. Only per-lane count queries remain — and these may be simple enough to inline in the ExploreHome component as parallel `fetch()` calls rather than a dedicated API route.

### Files Changed
- `web/lib/explore-home-data.ts` — Fix Regulars filters, add error logging, remove preview item queries.

---

## 6. Dead Code Removal

| File | Action | Reason |
|------|--------|--------|
| `web/components/find/FindView.tsx` | Delete | Imported but never rendered. Superseded by ExploreHome. |
| `web/components/find/ExploreHomeSection.tsx` | Delete | Preview card component, no longer needed. |
| `web/components/find/FindToolChipRow.tsx` | Verify & delete | Only imported by FindView. |
| `web/components/find/RightNowSection.tsx` | Verify & delete | Only imported by FindView. |
| `web/components/find/FindSpotlight.tsx` | Verify & delete | Only imported by FindView. |
| `web/lib/find-data.ts` | Verify & delete | Only used by FindView's data fetching. |
| Dynamic import in `page.tsx` | Remove | The `FindView` dynamic import line. |

**Verification method:** `grep -r "FindToolChipRow\|RightNowSection\|FindSpotlight\|find-data" web/` before deletion to confirm no other consumers.

---

## Out of Scope

- SmartImage fallback audit across other card surfaces
- Quick-action chip adaptive ordering by user signals (hook point added, no personalization logic)
- Search quality improvements (typeahead ranking, cross-lane results)
- Events lane filter design (which categories/filters to show — separate design question)
- Explore-home API route decision (keep as count-only vs inline fetches) — implementation detail for the plan
