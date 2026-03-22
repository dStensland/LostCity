# Search Redesign — Implementation Plan

**Spec:** `docs/superpowers/specs/2026-03-22-search-redesign.md`
**Date:** 2026-03-22
**Status:** Ready for implementation

---

## Architectural Review

### What Already Works (do not rebuild)

The existing search architecture is solid and well-layered. Most of the spec is achievable by enhancing what exists rather than replacing it.

1. **Instant search fast path** — `search_suggestions` materialized view + triple caching (shared/in-flight/client) delivers 20-75ms. No changes needed.
2. **`useInstantSearch` hook** — 637 lines of well-structured state management with debounce, abort, prefix cache fallback, deduplication, keyboard navigation, analytics. The hook powers both the Find search and can power header search with no modifications.
3. **`FindSearchInput.tsx`** — Already implements ~80% of the spec: full-width bar, instant dropdown, pre-search trending pills, category chips, grouped results via `SuggestionGroup`, keyboard navigation, URL sync (`?search=` param). The pre-search state (trending + categories) is already rendered inline.
4. **`SuggestionGroup.tsx`** — Grouped results with type icons, highlight matching, date badges, "view all" links. Matches the spec's InstantResultsDropdown requirements.
5. **Search-to-browse pipeline** — The `?search=` URL param already flows end-to-end: `FindSearchInput` writes it → `useEventsList` reads it → `/api/events` passes it to `getFilteredEventsWithSearch`. Pressing Enter in `FindSearchInput` already commits the query to the URL and the event list re-fetches with the search filter applied.
6. **`buildInstantSearchPayload`** — Server-side composition of fast-path suggestions + RPC fallback + ranking + grouping + quick actions. Clean separation.

### What Needs Work

1. **Pre-search API** — The instant search route returns 400 on empty query. Need to return trending/popular data instead.
2. **Pre-search discovery state** — `FindSearchInput` has hardcoded `TRENDING_SEARCHES` and `CATEGORY_CHIPS` arrays. These should come from the API (dynamic trending) and be visually elevated (the spec calls for "Popular Right Now" cards too).
3. **Search chip in browse mode** — When Enter commits the search, there's no visible chip in the filter bar showing the active search term. The query just silently filters results. Need a clearable chip.
4. **Header search input** — `HeaderSearchButton` is a button that navigates to Find view. The spec wants a compact input that can show an inline dropdown on non-Find pages, or navigate to Find with the query pre-filled.
5. **Mobile full-screen overlay** — `SearchOverlay.tsx` (691 lines) already exists as a `createPortal`-based full-screen overlay with its own search implementation (separate from `useInstantSearch`). It duplicates the search hook's logic with its own cache/debounce/state. The spec wants the mobile experience to use the same `useInstantSearch` pipeline. This is an unification opportunity.
6. **Full search performance** — `/api/search` runs social proof, facets, and spelling sequentially or in a non-optimal order. Needs optimization to hit <500ms.

### Architectural Decisions

**Q1: State management between header and Find view?**
The header compact input should NOT maintain its own search state. Two options:
- **(A) Navigate-on-type**: Header input navigates to `/{portal}?view=happening&search={query}` on every keystroke (bad UX — page transitions on each character).
- **(B) Navigate-on-commit**: Header input has its own lightweight `useInstantSearch` instance for the dropdown. On Enter or result selection, navigate to Find with `?search=` or the result's detail page. On focus (mobile), navigate to Find immediately.
- **Decision: (B)**. The header search is an independent `useInstantSearch` consumer. The hook already supports this — it's parameterized by portal/viewMode and is purely client-side state until a navigation happens. The `?search=` URL param is the handoff mechanism.

**Q2: Pre-search API shape and caching?**
Extend `/api/search/instant` to return pre-search data when `q` is absent. Use a separate cache namespace with a longer TTL (5 minutes vs 30 seconds) since trending data changes slowly. The pre-search response is a different shape from the instant search response — use a discriminated union.

**Q3: Browse state transition?**
Already works. `FindSearchInput` writes `?search=live+music` to the URL on Enter. `useEventsList` reads it and fetches filtered events. The only missing piece is the visual chip. Add a `SearchChip` component to `ActiveFiltersRow` that reads the `search` URL param and renders a clearable pill.

**Q4: Mobile overlay?**
Use `createPortal` (same pattern as existing `SearchOverlay.tsx`). The overlay mounts a `useInstantSearch` instance and renders full-screen results. Back button closes the overlay via `popstate` listener. Do NOT do a route change — the overlay is ephemeral UI state.

**Q5: Full search performance?**
The spec's suggestions (lazy social proof, conditional spelling, parallel facets) are sufficient. The `/api/search` route already has `include_event_popularity`, `include_did_you_mean`, and `include_facets` params — the client just needs to use them strategically.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Pre-search API adds latency to instant search route | Low | Separate code path (early return when no `q`), separate cache namespace |
| Header search dropdown causes layout shift on non-Find pages | Medium | Dropdown is absolute-positioned overlay, doesn't affect page flow |
| Mobile overlay competes with existing `SearchOverlay.tsx` | Medium | Deprecate `SearchOverlay.tsx` after migration, don't maintain both |
| `useInstantSearch` used in two places (header + Find) causes double-fetching | Low | Same cache key = same shared cache entry. In-flight deduplication handles concurrent requests |
| Search chip removal clears `?search=` but doesn't clear the input in `FindSearchInput` | Medium | `FindSearchInput` already syncs URL → input via `useEffect` on `searchParams.get("search")` |

---

## Implementation Plan

### Phase 1: Pre-Search API + Discovery State (backend + FindSearchInput enhancement)

This phase makes the empty search state useful. No new components needed — enhance what exists.

- [ ] **1.1 — Extend `/api/search/instant` for pre-search response**
  - File: `web/app/api/search/instant/route.ts`
  - When `q` is absent or empty, skip the 400 error and return a pre-search payload
  - Pre-search response shape:
    ```typescript
    {
      preSearch: {
        trending: string[],           // Top 8 from search_suggestions + curated
        categories: { id: string, label: string, count: number }[],
        popularNow: { type: string, id: number, title: string, venue?: string, image_url?: string, start_time?: string }[]
      }
    }
    ```
  - **Trending source**: Merge `TRENDING_SEARCHES` curated list with top entities from `search_suggestions` materialized view (query: `SELECT name FROM search_suggestions ORDER BY frequency DESC LIMIT 8`). Deduplicate.
  - **Categories source**: Lightweight count query — `SELECT category_id, count(*) FROM events WHERE start_date >= now()::date AND portal_id = $1 GROUP BY category_id ORDER BY count DESC LIMIT 8`
  - **Popular now source**: Top 3 events by `data_quality + rsvp_count` with future dates. Single query.
  - Cache with 5-minute TTL in separate namespace `api:search-presearch` (vs 30s for instant search)
  - Add `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`

- [ ] **1.2 — Add pre-search data fetching to `useInstantSearch`**
  - File: `web/lib/hooks/useInstantSearch.ts`
  - Add `preSearchData` state: `{ trending: string[], categories: {...}[], popularNow: {...}[] } | null`
  - Fetch pre-search data on mount (when `query.length === 0`) from `/api/search/instant?portal={slug}` (no `q` param)
  - Cache the pre-search response in the client cache with a longer TTL (60s vs 20s)
  - Expose `preSearchData` from the hook return

- [ ] **1.3 — Upgrade pre-search UI in `FindSearchInput`**
  - File: `web/components/find/FindSearchInput.tsx`
  - Replace hardcoded `TRENDING_SEARCHES` and `CATEGORY_CHIPS` with `search.preSearchData`
  - Add "Popular Right Now" section with compact event cards (image + title + venue + time)
  - Use existing card patterns from the design system (40x40 thumbnail + text)
  - Keep the existing trending pill and category chip click handlers — they already work
  - Loading skeleton while pre-search data fetches (show shimmer pills, not emptiness)

- [ ] **1.4 — Extract `PreSearchState` component**
  - New file: `web/components/search/PreSearchState.tsx`
  - Extract the pre-search UI from `FindSearchInput` into a standalone component
  - Props: `trending`, `categories`, `popularNow`, `onTrendingClick`, `onCategoryClick`, `portalSlug`
  - This component will be shared between `FindSearchInput` and `MobileSearchOverlay`
  - Update `web/components/search/index.ts` to export it

### Phase 2: Search Chip in Browse Mode

This phase makes the search-to-browse transition visible with a clearable chip.

- [ ] **2.1 — Add search chip to `ActiveFiltersRow`**
  - File: `web/components/filters/ActiveFiltersRow.tsx` (or wherever `ActiveFiltersRow` is defined)
  - Read `searchParams.get("search")` — if present, render a clearable chip before other filter chips
  - Chip visual: `bg-[var(--coral)]/15 text-[var(--coral)] font-mono text-xs rounded-full px-3 py-1` with close button
  - Clearing the chip: remove `?search=` from URL via `router.replace()`
  - The chip should appear at the top of the filter bar, visually distinct from category/date chips

- [ ] **2.2 — Show `ActiveFiltersRow` when search is active**
  - File: `web/components/find/EventsFinder.tsx`
  - Currently `ActiveFiltersRow` only shows when `hasActiveFilters` is true. The `hasActiveFilters` check may not include the `search` param.
  - Trace how `hasActiveFilters` is computed and ensure `search` is included
  - File to check: wherever `HappeningView` computes `hasActiveFilters` (likely in the portal page component)

### Phase 3: Header Compact Search Input

This phase replaces the button-only header search with a functional input.

- [ ] **3.1 — Build `HeaderSearchInput` component**
  - New behavior for: `web/components/HeaderSearchButton.tsx` (modify in place — rename is optional)
  - Desktop (>=768px): Render a compact `<input>` (~200px wide) with search icon and keyboard shortcut badge
  - The input uses its own `useInstantSearch` instance (same hook, `viewMode: "feed"`)
  - On focus: show dropdown (positioned absolute below header)
  - On type: show instant results in dropdown (same `SuggestionGroup` components)
  - On Enter: navigate to `/{portal}?view=happening&search={query}`, close dropdown
  - On result click: navigate to result detail page, close dropdown
  - On Escape: clear and blur
  - Mobile (<768px): Keep the existing icon-only button. On tap, navigate to `/{portal}?view=happening` with search focused (same as current behavior). Do NOT open the full-screen overlay from the header — that's Phase 5.
  - The dropdown uses `SuggestionGroup` from `web/components/search/` — same as FindSearchInput
  - Dropdown max-height: 60vh, scrollable, same visual treatment as FindSearchInput dropdown

- [ ] **3.2 — Wire `HeaderSearchInput` into `StandardHeader`**
  - File: `web/components/headers/StandardHeader.tsx`
  - Replace `<HeaderSearchButton>` with the upgraded component
  - Ensure the dropdown `z-index` is above the nav tabs but below modals (z-[110] — header is z-[100])
  - Hide the header search when the user is already on the Find/Happening view (existing logic at line 377 already does this: `currentView !== "find" && currentView !== "happening"`)

- [ ] **3.3 — Preserve keyboard shortcut (Cmd+K / Ctrl+K)**
  - The existing `useEffect` in `HeaderSearchButton` already registers the global shortcut
  - Ensure the shortcut focuses the header input on non-Find pages
  - On Find pages, the shortcut should focus the `FindSearchInput` instead (already works via `FindSearchInput` having its own focus handler — just need to make sure the header search doesn't also capture it when hidden)
  - Prevent double-registration: the header search should not register the shortcut when `currentView === "happening"` since FindSearchInput handles it

### Phase 4: Full Search Performance Optimization

This phase brings `/api/search` from 400-1500ms to <500ms.

- [ ] **4.1 — Make social proof lazy**
  - File: `web/lib/unified-search.ts`
  - Currently `fetchSocialProofCounts` is called inline. Move it behind the `includeEventPopularitySignals` flag (already exists but may still be called)
  - In the `/api/search` route, set `includeEventPopularitySignals: false` by default for the initial response
  - Social proof can be fetched as a separate lightweight call if needed later

- [ ] **4.2 — Skip spelling on non-empty results**
  - File: `web/lib/unified-search.ts` (inside `unifiedSearch`)
  - Currently `includeDidYouMean` triggers a spelling query on every search
  - Change: only run the spelling query when the primary search returns fewer than 3 results
  - This saves 50-150ms on most queries (the happy path)

- [ ] **4.3 — Verify facets run in parallel**
  - File: `web/lib/unified-search.ts`
  - Confirm that facet queries run inside the same `Promise.all` as the primary search queries
  - If they're sequential, restructure to parallelize
  - Audit the 7 parallel RPCs to ensure none are accidentally sequential

- [ ] **4.4 — Pre-warm popular queries on feed load**
  - File: `web/components/feed/FeedView.tsx` (or CityPulse container)
  - After the feed renders, fire background fetches for the top 5 trending search terms' instant results
  - Use `fetch()` with low priority (no `await`, fire-and-forget)
  - These populate the shared cache so when the user opens search, results are instant
  - Only do this on desktop (not mobile — bandwidth is precious)

### Phase 5: Mobile Full-Screen Search Overlay

This phase builds the premium mobile search experience.

- [ ] **5.1 — Build `MobileSearchOverlay` component**
  - New file: `web/components/search/MobileSearchOverlay.tsx`
  - Uses `createPortal(content, document.body)` — same pattern as existing `SearchOverlay.tsx`
  - Mounts its own `useInstantSearch` instance
  - Layout:
    - Fixed full-screen overlay: `fixed inset-0 z-[200] bg-[var(--void)]`
    - Top bar: back arrow (left) + input (center/full-width) + clear button (right)
    - Content area: scrollable, fills remaining height
    - Pre-search state: `PreSearchState` component (from Phase 1.4)
    - Typing state: full-screen list of results using `SuggestionGroup` (not a dropdown — fills the screen)
  - Back button behavior: close overlay, do NOT navigate back in history
  - Push a dummy history entry on open, listen for `popstate` to close (so hardware back button works)
  - Selecting a result: navigate to detail page, close overlay
  - Pressing Enter: navigate to `/{portal}?view=happening&search={query}`, close overlay

- [ ] **5.2 — Wire mobile overlay trigger**
  - File: `web/components/HeaderSearchButton.tsx` (or the upgraded `HeaderSearchInput`)
  - Mobile (<768px) tap on the search icon opens `MobileSearchOverlay` instead of navigating
  - The overlay is conditionally rendered (not always in the DOM)
  - State: `const [mobileSearchOpen, setMobileSearchOpen] = useState(false)`

- [ ] **5.3 — Deprecate `SearchOverlay.tsx`**
  - File: `web/components/SearchOverlay.tsx` (691 lines)
  - This component has its own search cache, debounce, state management — all duplicating `useInstantSearch`
  - After `MobileSearchOverlay` is verified working, remove `SearchOverlay.tsx`
  - Check for any remaining imports/usages before deletion
  - Also check: `SearchBarWrapper.tsx`, `SearchBar.tsx`, `SearchResultsHeader.tsx` — these may be dead code related to the old overlay

### Phase 6: Polish and Integration Testing

- [ ] **6.1 — Visual QA against spec**
  - Verify all visual specs from the design doc (heights, colors, typography, spacing)
  - FindSearchInput: 48px height, `text-base` input, `rounded-xl`, coral focus ring
  - Trending pills: `font-mono text-xs`, `bg-[var(--twilight)]/40`, `rounded-full`
  - Search chip: `bg-[var(--coral)]/15 text-[var(--coral)]`
  - Header input: `border-[var(--twilight)]`, `border-[var(--coral)]` on focus
  - Mobile overlay: back arrow, full-screen, hardware back button works

- [ ] **6.2 — Performance verification**
  - Pre-search load: verify <100ms (should be ~50ms with cache)
  - Instant suggestions: verify <100ms (already 20-75ms)
  - Full results after Enter: verify <500ms with lazy social proof + conditional spelling
  - Add Server-Timing headers to pre-search path for monitoring

- [ ] **6.3 — Accessibility audit**
  - `role="combobox"` on search input (already present)
  - `aria-expanded`, `aria-controls`, `aria-activedescendant` (already present)
  - Keyboard navigation: Arrow keys, Enter, Escape (already present)
  - Screen reader: "Search results" landmark, group labels
  - Mobile overlay: focus trap, escape key closes
  - Cmd+K shortcut announced via `aria-keyshortcuts`

- [ ] **6.4 — Portal theming verification**
  - Test on Atlanta (base portal), HelpATL (light mode), FORTH (hotel portal)
  - Ensure search chip uses `--action-primary` semantic token (not hardcoded `--coral`)
  - Ensure pre-search state respects `data-theme="light"` (HelpATL)

---

## File Summary

### New Files
| File | Phase | Purpose |
|------|-------|---------|
| `web/components/search/PreSearchState.tsx` | 1.4 | Reusable pre-search discovery UI (trending, categories, popular) |
| `web/components/search/MobileSearchOverlay.tsx` | 5.1 | Full-screen mobile search experience |

### Modified Files
| File | Phase | Changes |
|------|-------|---------|
| `web/app/api/search/instant/route.ts` | 1.1 | Return pre-search data when `q` is empty |
| `web/lib/hooks/useInstantSearch.ts` | 1.2 | Add `preSearchData` state, fetch on mount |
| `web/components/find/FindSearchInput.tsx` | 1.3 | Use dynamic pre-search data, extract pre-search UI |
| `web/components/search/index.ts` | 1.4 | Export `PreSearchState` |
| `web/components/filters/ActiveFiltersRow.tsx` | 2.1 | Render search chip when `?search=` is present |
| `web/components/find/EventsFinder.tsx` | 2.2 | Ensure `hasActiveFilters` includes `search` param |
| `web/components/HeaderSearchButton.tsx` | 3.1, 5.2 | Upgrade to compact input (desktop) + mobile overlay trigger |
| `web/components/headers/StandardHeader.tsx` | 3.2 | Wire upgraded header search, z-index management |
| `web/lib/unified-search.ts` | 4.1-4.3 | Lazy social proof, conditional spelling, parallel facets |

### Deprecated Files (remove after Phase 5)
| File | Reason |
|------|--------|
| `web/components/SearchOverlay.tsx` | Replaced by `MobileSearchOverlay` using shared `useInstantSearch` |
| `web/components/SearchBarWrapper.tsx` | Likely dead code from old overlay |
| `web/components/SearchBar.tsx` | Likely dead code from old overlay |
| `web/components/SearchResultsHeader.tsx` | Likely dead code from old overlay |

---

## Phase Sequencing

Phases 1-2 can run in parallel (no dependencies). Phase 3 depends on Phase 1 (needs pre-search data for header dropdown). Phase 4 is independent (pure backend optimization). Phase 5 depends on Phase 1 (reuses `PreSearchState`). Phase 6 depends on all others.

```
Phase 1 (Pre-search API + UI) ──────────┬──→ Phase 3 (Header input) ──┐
                                         │                              │
Phase 2 (Search chip) ──────────────────┤                              ├──→ Phase 6 (Polish)
                                         │                              │
Phase 4 (Performance) ──────────────────┤                              │
                                         │                              │
                                         └──→ Phase 5 (Mobile overlay) ┘
```

**Estimated total effort**: 3-4 focused sessions. The heaviest lift is Phase 5 (mobile overlay), but even that is substantially simplified by reusing `useInstantSearch` and `PreSearchState`. The spec is conservative — it respects the existing architecture and extends it rather than replacing it.
