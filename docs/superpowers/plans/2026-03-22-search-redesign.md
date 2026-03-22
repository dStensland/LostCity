# Search Redesign — Implementation Plan (Revised)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Spec:** `docs/superpowers/specs/2026-03-22-search-redesign.md`
**Date:** 2026-03-22 (revised after expert cross-review)
**Status:** Ready for implementation

---

## Expert Review Findings Incorporated

This revision addresses findings from both the architect and product designer cross-reviews:

- **PreSearchState as sibling** (not inside dropdown) — core architectural change
- **Browse-mode input behavior** — show dimmed query in bar, not empty
- **No-results state** — "Did you mean?" + fallback trending
- **QuickActions restyle** — vertical → horizontal pills (build task, not polish)
- **Search chip is a restyle** — ActiveFiltersRow already renders it, just needs coral variant
- **Cut category grid** — keep trending pills, drop 4-column grid (duplicates filter bar)
- **Dark-only seamless dropdown join** — breaks on HelpATL light mode
- **Remove backdrop-blur** — solid surface + shadow per design evolution
- **Deprioritize pre-warm (4.4)** — low ROI
- **Slow-connection fallback** — serve curated trending from client bundle while API fetches
- **Pre-search fetch abort** — abort when user starts typing
- **SearchOverlay imported in PlatformHeader** — must update before deletion
- **Phosphor icons for categories** — not emoji

---

## What Already Works (do not rebuild)

1. **Instant search fast path** — 20-75ms via materialized view + triple caching
2. **`useInstantSearch` hook** — 637 lines, debounce, abort, prefix cache, keyboard nav
3. **`FindSearchInput.tsx`** — 80% of spec: full-width bar, instant dropdown, trending pills, category chips, grouped results, keyboard nav, URL sync
4. **`SuggestionGroup.tsx`** — grouped results with icons, highlights, date badges
5. **Search-to-browse pipeline** — `?search=` URL param flows end-to-end
6. **`ActiveFiltersRow`** — already renders a search chip (lines 47-64), just needs coral restyle

---

## Implementation Plan

### Phase 1: Pre-Search API + Discovery State

- [ ] **1.1 — Extend `/api/search/instant` for pre-search response**
  - File: `web/app/api/search/instant/route.ts`
  - When `q` is absent/empty, return pre-search payload (not 400)
  - Response: `{ preSearch: { trending: string[], popularNow: {...}[] } }`
  - **No categories in response** — cut the 4-column grid (duplicates filter bar). Keep trending pills + popular cards only.
  - Trending source: merge curated `TRENDING_SEARCHES` with top entities from `search_suggestions` by frequency
  - Popular source: top 2 events by `data_quality` score with future dates
  - Cache: 5-minute TTL in `api:search-presearch` namespace
  - **Slow-connection fallback**: serve curated `TRENDING_SEARCHES` from client bundle immediately, hydrate with API data when it arrives (stale-while-revalidate pattern)

- [ ] **1.2 — Add pre-search data fetching to `useInstantSearch`**
  - File: `web/lib/hooks/useInstantSearch.ts`
  - Add `preSearchData` state, fetch on mount when `query.length === 0`
  - **Abort handling**: use separate `AbortController` for pre-search fetch. Abort it immediately when `query.length >= 2` to prevent stale pre-search response overwriting typing results.
  - Cache pre-search in client cache with 60s TTL (vs 20s for search)
  - Expose `preSearchData` from hook return

- [ ] **1.3 — Extract `PreSearchState` component**
  - New file: `web/components/search/PreSearchState.tsx`
  - Props: `trending`, `popularNow`, `onTrendingClick`, `portalSlug`, `layout: "wrap" | "horizontal"`, `loading`
  - `layout="wrap"` for desktop Find (trending pills flex-wrap, popular cards stacked)
  - `layout="horizontal"` for mobile overlay (trending pills single-row scrollable `overflow-x-auto flex-nowrap`)
  - Loading state: shimmer pill shapes for trending, shimmer rows for popular cards (`bg-[var(--twilight)]/30 animate-pulse`)
  - **Use Phosphor icons** (not emoji) for any category/type indicators — match existing `CategoryIcon` component
  - Popular cards: 40px thumbnail + title + venue + time + badge (LIVE=`--neon-red`, FREE=`--neon-green`, TRENDING=`--gold`)

- [ ] **1.4 — Wire PreSearchState as sibling in HappeningView**
  - File: `web/components/find/HappeningView.tsx` (or parent of FindSearchInput)
  - **Critical layout change**: PreSearchState must render BELOW FindSearchInput as a sibling, NOT inside the dropdown. Currently `showPreSearch` is inside the dropdown div (line 301-404 of FindSearchInput). Move it out.
  - Show PreSearchState when `query.length === 0` and no browse-mode active
  - Hide PreSearchState when typing starts (query >= 2 chars) or browse mode active
  - Remove the `showPreSearch` logic from inside FindSearchInput's dropdown

- [ ] **1.5 — Add no-results state to instant dropdown**
  - File: `web/components/find/FindSearchInput.tsx`
  - When instant search returns 0 results for a query:
    - Show "Did you mean: X?" spelling suggestion (data from `search.didYouMean` if available)
    - Below that, show 3-4 trending pills as fallback: "Try: Shaky Knees, patio brunch, free events"
    - Use same pill style as pre-search trending pills
  - **API error fallback**: if `/api/search/instant` errors, fall back to curated `TRENDING_SEARCHES` and skip popular cards

### Phase 2: Browse State Polish

- [ ] **2.1 — Restyle search chip in ActiveFiltersRow**
  - File: `web/components/filters/ActiveFiltersRow.tsx`
  - The chip already exists (lines 47-64). Change visual to coral-branded:
    - `bg-[var(--action-primary)]/15 text-[var(--action-primary)]` (uses portal token, not hardcoded coral)
    - Ensure search chip renders first in the filter list (it already does)
  - Clearing the chip: already removes `?search=` from URL

- [ ] **2.2 — Browse-mode input behavior**
  - File: `web/components/find/FindSearchInput.tsx`
  - **After Enter commits query**: show the query text dimmed/greyed in the input (not empty). The chip provides the clear affordance, the bar provides the visual reminder.
  - Add `browseMode` boolean state. When `browseMode=true` AND `?search=` is in URL:
    - Input shows the query in `text-[var(--muted)]` (dimmed, not editable cursor)
    - Clicking the input clears browseMode, focuses, and pre-fills the query for editing
  - **This decouples input display from URL sync** — the `skipUrlSyncRef` pattern already exists for this exact reason (lines 68-73)

- [ ] **2.3 — Add result count header**
  - File: `web/components/find/HappeningView.tsx` or `EventsFinder.tsx`
  - When `?search=` is active, show a header above results: `"47 events · live music"` in `font-mono text-xs text-[var(--soft)] uppercase tracking-wider`
  - Count comes from the event list length or the API response total

- [ ] **2.4 — Restyle QuickActions to horizontal pills**
  - File: `web/components/search/QuickAction.tsx` or `QuickActionsList.tsx`
  - Convert from full-width vertical rows (icon + label + description) to compact horizontal pills
  - Pill style: same as trending pills but with accent-tinted bg per action type
  - Only show in the typing-state dropdown, not in pre-search

### Phase 3: Header Compact Search Input

- [ ] **3.1 — Upgrade HeaderSearchButton to compact input**
  - File: `web/components/HeaderSearchButton.tsx`
  - Desktop (>=768px): compact `<input>` (~200px) with search icon + ⌘K badge
  - Own `useInstantSearch` instance for dropdown
  - On Enter: navigate to `/{portal}?view=happening&search={query}`
  - On result click: navigate to detail page
  - On Escape: clear and blur
  - Mobile (<768px): keep icon-only button (Phase 5 handles overlay)
  - Dropdown: absolute-positioned, `z-[110]`, max-height 60vh, solid `bg-[var(--dusk)]` + `shadow-card-xl` (NO backdrop-blur)
  - **Seamless dropdown join (border-top-none) only on dark themes** — skip on `[data-theme="light"]`

- [ ] **3.2 — Wire into StandardHeader**
  - File: `web/components/headers/StandardHeader.tsx`
  - Replace `<HeaderSearchButton>` with upgraded component
  - Hide when on Find/Happening view (existing logic)
  - Prevent ⌘K double-registration when FindSearchInput is visible

### Phase 4: Full Search Performance

- [ ] **4.1 — Make social proof lazy**
  - File: `web/lib/unified-search.ts`
  - Set `includeEventPopularitySignals: false` by default
  - Saves 50-200ms on every full search

- [ ] **4.2 — Skip spelling on non-empty results**
  - File: `web/lib/unified-search.ts`
  - Only run `did_you_mean` when primary search returns <3 results
  - Saves 50-150ms on most queries

- [ ] **4.3 — Verify facets run in parallel**
  - File: `web/lib/unified-search.ts`
  - Audit `Promise.all` — ensure facets + all 7 RPCs are parallel, not sequential

- [ ] ~~**4.4 — Pre-warm popular queries**~~ **DEPRIORITIZED** — other optimizations are sufficient

### Phase 5: Mobile Full-Screen Search Overlay

- [ ] **5.1 — Build MobileSearchOverlay**
  - New file: `web/components/search/MobileSearchOverlay.tsx`
  - `createPortal(content, document.body)`, `fixed inset-0 z-[200] bg-[var(--void)]`
  - Top bar: "Cancel" text button (iOS pattern, not X icon) + full-width input + clear
  - Content: `PreSearchState` with `layout="horizontal"` (trending pills scroll, popular cards reduced to 2)
  - Typing: full-screen result list (not dropdown), `SuggestionGroup` components
  - No-results: same treatment as Phase 1.5
  - Back button: push dummy history entry, listen `popstate` to close. Clean up listener on unmount.
  - Keyboard dismissal: `onTouchStart` on results area blurs input
  - Selecting result: navigate + close overlay
  - Enter: navigate to browse + close overlay

- [ ] **5.2 — Wire mobile overlay trigger**
  - File: `web/components/HeaderSearchButton.tsx`
  - Mobile tap opens MobileSearchOverlay instead of navigating
  - Conditionally rendered, not always in DOM

- [ ] **5.3 — Deprecate SearchOverlay.tsx**
  - **Check `PlatformHeader.tsx` import first** — update it to use MobileSearchOverlay
  - Then remove `SearchOverlay.tsx` (691 lines) + dead code: `SearchBarWrapper.tsx`, `SearchBar.tsx`, `SearchResultsHeader.tsx`

### Phase 6: Polish and Verification

- [ ] **6.1 — Visual QA**
  - Heights, colors, typography, spacing per design doc
  - Solid `bg-[var(--dusk)]` dropdown (no backdrop-blur)
  - Seamless join dark-only, gap on light themes

- [ ] **6.2 — Performance verification**
  - Pre-search <100ms, instant <100ms, full search <500ms

- [ ] **6.3 — Portal theming**
  - Test Atlanta (dark), HelpATL (light), FORTH (hotel)
  - Search chip uses `--action-primary` (not hardcoded `--coral`)
  - Pre-search respects `data-theme="light"`

- [ ] **6.4 — Accessibility**
  - `role="combobox"`, `aria-expanded`, keyboard nav (already present)
  - Mobile overlay focus trap
  - `aria-keyshortcuts` for ⌘K

---

## Phase Sequencing

All 4 implementation phases can START in parallel. Phase 5 needs Phase 1.3 (PreSearchState). Phase 6 needs all others.

```
Phase 1 (Pre-search) ──────────┬──→ Phase 5 (Mobile) ──┐
Phase 2 (Browse polish) ───────┤                         ├──→ Phase 6 (Polish)
Phase 3 (Header input) ────────┤                         │
Phase 4 (Performance) ─────────┘                         │
                                                          │
```

## New Files (2)
| File | Phase |
|------|-------|
| `web/components/search/PreSearchState.tsx` | 1.3 |
| `web/components/search/MobileSearchOverlay.tsx` | 5.1 |

## Key Risk: Browse-Mode Input State (Phase 2.2)
The URL-sync bidirectional flow is fragile (`skipUrlSyncRef` counter pattern). The `browseMode` flag must suppress URL→input sync without breaking input→URL sync on re-focus. Test thoroughly: Enter commits → input dims → click input → editing resumes → Enter recommits → chip updates. The `useEffect` at lines 86-93 of FindSearchInput that syncs URL to input is the code path that needs the guard.
