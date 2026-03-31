# Explore Page — Full Design & Architecture Restructure

## Context

The Explore page was intended as a unified "find stuff to do" workspace with sidebar navigation unifying events, showtimes, regulars, and places. Instead, HappeningView (a standalone page with its own full navigation stack) was embedded inside a sidebar shell without decomposition. The result: two competing navigation systems, broken lanes, redundant chrome, and a confusing UX.

This spec defines the clean architecture that was originally intended.

## Core Principle

**The Explore shell owns navigation. Content renderers are headless.**

The sidebar (desktop) and chip bar (mobile) are the single source of truth for "what am I looking at." The content area renders results with its own filters/search but NO top-level nav tabs. HappeningView's control panel (Events/Regulars/Showtimes tabs + List/Calendar/Map toggles) is not used — renderers are called directly.

---

## Sidebar Structure (Desktop)

```
EXPLORE (← link to launchpad, with ← icon affordance)

BROWSE
  Events              → curated timeline, trending chips, category/date filters
  Now Showing         → film showtimes
  Live Music          → music showtimes
  Stage & Comedy      → stage/comedy showtimes
  Regulars            → weekly recurring, day/activity filters
  Places              → all 6 verticals as sub-tabs (Arts/Dining/Nightlife/Outdoors/Music/Entertainment)

VIEWS
  Calendar            → month grid + day detail
  Map                 → spatial exploration (events + places)

[date + weather context block]
```

- Fixed to viewport below header (`position: fixed`, `top: 73px`, `bottom: 0`), 240px wide, `overflow-y-auto`
- Active lane highlighted with accent background + colored text/icon
- "Explore" title links back to launchpad (clears lane) — with ← arrow icon so it reads as navigation, not just a heading
- Browse and Views groups separated by a mono section label (matching existing `BROWSE` label pattern)

## Mobile Navigation — MobileLaneBar

Sticky horizontal chip bar below header, replacing the sidebar:

```
┌──────────────────────────────────────────────────────────────────────┐
│ [⌂ Explore] [Events] [Film] [Music] [Stage] [Regulars] [Places] ...│
└──────────────────────────────────────────────────────────────────────┘
```

- First chip is always "Explore" (home icon) — links to launchpad. Always visible, left-pinned.
- Short labels: Events, Film, Music, Stage, Regulars, Places, Calendar, Map (8 chips)
- `overflow-x-auto scrollbar-hide`, accent styling matching sidebar lane colors
- Active chip highlighted with accent color
- Mounted below portal header, above content area. `sticky top-[73px] z-40`.
- Visible on `< lg` breakpoints (inverse of sidebar)
- Hidden when on launchpad (no lane selected) — launchpad teasers serve as mobile nav entry points
- Shown when a lane is active — provides lane switching without browser back

## Launchpad (No Lane Selected)

Unchanged from current implementation:
- Search bar (full-width)
- "Right Now" contextual lane teasers (2-col mobile, 5-col desktop grid)
- Category spotlight sections (Arts & Culture, Eat & Drink, Outdoors)

Lane teasers link to lanes defined above. Clicking a teaser activates the lane and shows the chip bar on mobile.

## Lane → Renderer Mapping

| Lane | URL | Renderer | Props | Notes |
|------|-----|----------|-------|-------|
| Events | `?view=find&lane=events` | EventsFinder | `displayMode="list"`, `hasActiveFilters`, `portalExclusive` | Keeps search, trending chips, category/date filters. No content-type tabs. |
| Now Showing | `?view=find&lane=now-showing` | WhatsOnView | `vertical="film"` via URL param | **Single-vertical mode**: Film/Music/Stage sub-tabs SUPPRESSED since vertical is pre-selected. Date picker, By Movie/By Theater toggle kept. |
| Live Music | `?view=find&lane=live-music` | WhatsOnView | `vertical="music"` via URL param | **Single-vertical mode**: sub-tabs suppressed. Genre chips, date picker kept. |
| Stage & Comedy | `?view=find&lane=stage` | WhatsOnView | `vertical="stage"` via URL param | **Single-vertical mode**: sub-tabs suppressed. Date picker kept. |
| Regulars | `?view=find&lane=regulars` | RegularsView | `portalId`, `portalSlug` | Day-of-week filter, activity filter. Standalone. |
| Places | `?view=find&lane=places` | PortalSpotsView | `portalId`, `portalSlug`, `isExclusive` | All 6 vertical sub-tabs (Arts/Dining/Nightlife/Outdoors/Music/Entertainment). Search, venue-type filters. |
| Calendar | `?view=find&lane=calendar` | EventsFinder | `displayMode="calendar"`, `portalExclusive` | NOT extracted — EventsFinder with calendar display mode. Category filter kept. |
| Map | `?view=find&lane=map` | EventsFinder | `displayMode="map"`, `portalExclusive` | NOT extracted — EventsFinder with map display mode. Full map hooks/state stay in EventsFinder. |

**Renderers are called directly — NOT wrapped in HappeningView.** Each renderer keeps its own internal controls (search, filters) but has no content-type or display-mode chrome.

**WhatsOnView single-vertical mode**: When invoked with a `vertical` URL param from the shell, suppress the Film/Music/Stage tab bar. The user already chose the vertical via the sidebar — showing tabs that could switch to a different vertical while the sidebar still highlights the original lane creates a mismatch. If the user wants a different vertical, they click a different sidebar lane.

**Calendar and Map are NOT extracted** into standalone components. They render as `EventsFinder` with the appropriate `displayMode` prop. EventsFinder's map mode requires 6+ hooks and stateful logic that is not worth extracting for v1. Extract later if there's a concrete reason.

## URL Scheme

Clean lane-based URLs. The `lane` param is the only routing signal for the shell.

```
?view=find                    → launchpad
?view=find&lane=events        → events timeline
?view=find&lane=now-showing   → film showtimes
?view=find&lane=live-music    → music showtimes
?view=find&lane=stage         → stage & comedy showtimes
?view=find&lane=regulars      → regulars
?view=find&lane=places        → places browser
?view=find&lane=calendar      → calendar
?view=find&lane=map           → map
```

Renderers may add their own filter params (e.g., `&date=2026-04-01`, `&category=music`, `&venue_type=bar`). These are renderer-internal, not shell-level routing.

**Backward compatibility**: Legacy lane IDs are mapped in `normalize-find-url.ts`:
```
LEGACY_LANE_MAP = { film: "now-showing", music: "live-music" }
```
Old `?view=find&lane=film` URLs redirect to `?view=find&lane=now-showing`. Old `?view=happening&content=showtimes` URLs continue to work via the standalone HappeningView path.

## Component Hierarchy

```
page.tsx (RSC)
└── ExploreShell (async RSC — fetches pulse data for sidebar badges)
    ├── FindSidebar (client, desktop only — fixed viewport, OUTSIDE Suspense)
    ├── MobileLaneBar (client, mobile only — sticky chip bar, OUTSIDE Suspense)
    └── FindContext.Provider (wraps content area — provides portalId, portalSlug, portalExclusive)
        └── Suspense fallback={<ContentSkeleton />}  ← content-only Suspense
            └── Content area (flex-1):
                ├── lane=null        → FindView (launchpad)
                ├── lane=events      → EventsFinder (displayMode="list")
                ├── lane=now-showing → WhatsOnView (vertical=film, single-vertical mode)
                ├── lane=live-music  → WhatsOnView (vertical=music, single-vertical mode)
                ├── lane=stage       → WhatsOnView (vertical=stage, single-vertical mode)
                ├── lane=regulars    → RegularsView
                ├── lane=places      → PortalSpotsView (all 6 category sub-tabs)
                ├── lane=calendar    → EventsFinder (displayMode="calendar")
                └── lane=map         → EventsFinder (displayMode="map")
```

**Critical: Suspense boundary placement.** The sidebar and MobileLaneBar are OUTSIDE the Suspense boundary. They render immediately with pulse data from the RSC. Only the content area is inside Suspense — lane switches show a content skeleton while the new renderer loads, but the sidebar never disappears.

**FindContext.Provider** wraps the content area to provide `{ portalId, portalSlug, portalExclusive }` to all renderers and their children. This replaces the FindContext that HappeningView previously provided. Renderers and child components that call `useFindPortal()` will work without changes.

**Dynamic imports**: WhatsOnView, RegularsView, and PortalSpotsView should use `dynamic()` imports to avoid loading all renderers upfront. EventsFinder (used by 3 lanes: events, calendar, map) is eagerly imported.

## What Dies

- **HappeningView's control panel** — content-type tabs (Events/Regulars/Showtimes) and display-mode toggles (List/Calendar/Map) are not rendered inside the shell. HappeningView itself survives only for the standalone `?view=happening` backward-compat path.
- **FindToolChipRow** — already removed, stays removed.
- **`from=find` back links** — no longer needed since lanes render inside the shell.
- **Old lane redirects in normalize-find-url.ts** — replaced by LEGACY_LANE_MAP for renamed lanes. SHELL_LANES set updated to new IDs.
- **HappeningView's analytics harness** (filter tracking, detail-click tracking) — not replicated in shell for v1. Per-renderer analytics is the cleaner long-term approach; migrate when needed.
- **HappeningView's sticky offset measurement** (`--find-list-sticky-top`) — renderers that need sticky positioning should measure it themselves or use a shared hook.

## What Survives

- **HappeningView** as standalone page for `?view=happening` direct links (backward compat)
- **EventsFinder** internal controls: search bar, trending chips, category dropdown, date dropdown, filters button
- **WhatsOnView** internal controls: date picker, By Movie/By Theater toggle, genre chips. Film/Music/Stage sub-tabs suppressed when vertical is pre-selected (single-vertical mode).
- **RegularsView** internal controls: day-of-week pills, activity filter
- **PortalSpotsView** / SpotsFinder: all 6 vertical sub-tabs (Arts/Dining/Nightlife/Outdoors/Music/Entertainment), search, open_now toggle

## State Preservation

Lane switches unmount the previous renderer and mount the new one. This is by design:
- Scroll position is not preserved across lane switches
- Non-URL filter state (search input text, expanded accordions) resets
- Fetched data is re-fetched on mount

This is standard URL-driven routing behavior and acceptable for a discovery UI. If scroll restoration becomes a UX issue later, the fix is SWR/React Query cache for data persistence — NOT keeping all renderers mounted.

## Verification

1. `npx tsc --noEmit` — clean build
2. Desktop: sidebar shows 8 lanes in 2 groups (Browse: 6 + Views: 2). Active lane highlighted.
3. Desktop: click each lane → content renderer appears, no HappeningView chrome (no Events/Regulars/Showtimes tabs, no List/Calendar/Map toggles)
4. Desktop: WhatsOnView lanes (Now Showing, Live Music, Stage) render in single-vertical mode — no Film/Music/Stage sub-tab bar
5. Desktop: click "Explore" title → returns to launchpad
6. Desktop: renderer internal controls work (search, filters, date pickers)
7. Desktop: sidebar never disappears during lane transitions (Suspense boundary is content-only)
8. Mobile (375px): launchpad shows teasers, no chip bar
9. Mobile: click teaser → lane content full-width, chip bar appears at top with "Explore" home chip
10. Mobile: switch lanes via chip bar → content switches
11. Mobile: click "Explore" chip → returns to launchpad, chip bar hides
12. Backward compat: `?view=happening&content=showtimes&vertical=film` still works (standalone HappeningView)
13. Backward compat: `?view=find&lane=film` redirects to `?view=find&lane=now-showing`
