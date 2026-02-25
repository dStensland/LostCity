# Find Filter Product Audit (Feb 19, 2026)

## Scope
Audit covers consumer Find surfaces and their backing API/data contracts:
- Events (`list`, `calendar`, `map`)
- Destinations (`list`, `map`)
- Classes
- Showtimes

## Current State Matrix

### 1) Events (Find)
UI entry points:
- `web/components/find/FindView.tsx` (events-only filter bar, search, map location/date pills)
- `web/components/find/FindFilterBar.tsx` (category/date/mood + advanced sheet)
- `web/components/filters/ActiveFiltersRow.tsx` (active chips)

Current user-facing filters:
- Search text
- Categories (multi)
- Genres (multi, only when exactly one category is selected)
- Date (`today`, `tomorrow`, `weekend`, `week`, plus exact date)
- Mood (single)
- Tags (multi, in sheet)
- Vibes (multi, in sheet)
- Free only
- Map-only location control (`all`, `nearby`, `neighborhood`) + map date pills

API/data supports (and UI mostly uses):
- `search`, `categories`, `subcategories`, `genres`, `tags`, `vibes`, `neighborhoods`, `price/free`, `date`, `mood`
- Implemented in `web/app/api/events/route.ts` and `web/lib/search.ts`

Notes:
- API supports `subcategories` and more date variants (`now`, `month`) but primary UI does not expose them.
- `ActiveFiltersRow` does not show all active params (notably search and neighborhoods).

### 2) Destinations (Find)
UI entry points:
- `web/components/PortalSpotsView.tsx` (list + filters)
- `web/lib/hooks/useMapSpots.ts` (map data reads URL filters)

Current user-facing filters:
- Search
- Open now
- With events
- Price level
- Venue type(s)
- Neighborhood(s)
- Vibes
- Sort (category/neighborhood/alphabetical)

API/data supports (and UI uses):
- `open_now`, `with_events`, `price_level`, `venue_type`, `neighborhood`, `vibes`, `genres`, `q`
- Implemented in `web/app/api/spots/route.ts`

Notes:
- List and map share destination filters through URL sync in `PortalSpotsView`.
- Destinations map lacks a dedicated filter control panel; users need to apply most filters in list first.

### 3) Classes
UI entry points:
- `web/components/find/ClassesView.tsx`

Current user-facing filters:
- Class category only

API/data supports (underutilized):
- `class_category`, `start_date`, `end_date`, `price_min`, `price_max`, `skill_level`, `neighborhood`, `sort`
- Implemented in `web/app/api/classes/route.ts`

Notes:
- Classes surface is materially simpler than what backend supports.
- Good candidate for adding 2-3 high-value controls without complexity explosion.

### 4) Showtimes
UI entry points:
- `web/components/find/ShowtimesView.tsx`

Current user-facing filters:
- Date
- View mode (by movie / by theater)
- Special screenings toggle

API/data supports (partially surfaced):
- `date`, `mode`, `special`, `theater`, `include_chains`, `meta`
- Implemented in `web/app/api/showtimes/route.ts`

Notes:
- Theater filter exists in API but no UI control.

## Cross-Screen Behavior

### Persistence and switching
- Type switching now resets cross-type filters in `FindView` (`events/classes/destinations/showtimes`).
- Within-type switching still preserves relevant params (good), e.g. events list/calendar/map and destinations list/map.

### Gaps / friction points
1. Hidden active filters
- `ActiveFiltersRow` omits `search` and `neighborhoods`, so users can have invisible constraints.

2. Taxonomy and options can be noisy
- Events category/tag/vibe controls are static constants in `FindFilterBar`, not the availability-indexed filter inventory from `available_filters`.
- This can expose dead/low-signal options.

3. Classes and showtimes are asymmetrical
- Classes UI is too sparse vs backend capability.
- Showtimes lacks theater-level refinement despite API support.

4. Map query key mismatch risk (events map)
- `useMapEvents` query key does not include all request-driving params (e.g., mood/genres/free can affect API params), risking stale cache behavior when those change.

## Recommended Filter Framework (Streamlined + Comprehensive)

### Principle
Use **core 4** on every view, then **view-specific 2-3** maximum:
- Core 4: `Search`, `When`, `Where`, `Type`
- View-specific: only what materially improves decision quality for that content type

### Events (target)
Keep:
- Search, Category, Date, Free, Mood
Add/adjust:
- Surface Neighborhood in standard controls (not only map selector)
- Replace static options with availability-aware options (`available_filters`) where possible
- Keep tags/vibes behind “More filters” to avoid clutter

### Destinations (target)
Keep:
- Search, Open now, Venue type, Neighborhood
Optional advanced:
- Price level, Vibes, With events
UX:
- Add same filter drawer in map mode (parity with list)

### Classes (target)
Keep simple but useful:
- Category
- Date window (`Today`, `This week`, `Weekend`)
- Skill level (`Beginner`, `All levels` first)
Advanced optional:
- Price bucket
- Neighborhood

### Showtimes (target)
Keep:
- Date, By movie/by theater, Special screenings
Add:
- Theater quick filter chips/dropdown
Optional:
- Genre quick chips if data density supports it

## Priority Plan

### P0 (high impact, low risk)
1. Make active filter state fully visible (include search + neighborhoods).
2. Add theater filter UI for showtimes (API already supports).
3. Fix `useMapEvents` query key parity with request params.

### P1 (high impact, medium effort)
1. Add minimal class filter row: date window + skill level.
2. Add destination filter access in map mode.

### P2 (quality optimization)
1. Migrate events filter option lists to availability-aware sources.
2. Introduce unified filter schema per find type to reduce drift between UI, URL, and API.

## Suggested Success Metrics
- Filter adoption rate by view (`events`, `destinations`, `classes`, `showtimes`)
- Zero-result rate after filter interaction
- Time-to-first-click on detail after filter change
- Filter-clear frequency (proxy for over-filtering/confusion)
- Cross-type switch bounce rate
