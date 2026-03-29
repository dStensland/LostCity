# Find Tab v2: Deep-Dive Tool Routing

**Date:** 2026-03-29
**Status:** Approved for implementation (post expert review)
**Builds on:** `2026-03-29-unified-find-and-detail-redesign.md` (v1 — stream + cards, shipped)

---

## Problem

Find v1 shipped with a shallow stream overview that replaced the functional depth of the old Happening + Places tabs. Users lost: search with typeahead, 13+ filters (date, neighborhood, category, price, cuisine, vibes), map mode, calendar mode, occasion chips, sort controls, and hundreds of paginated results. The stream is the right entry point but it's not a discovery tool — it's a menu.

## Solution

The Find tab becomes a **routing layer** that funnels users into the right deep-dive tool for what they're looking for. The existing tools (`WhatsOnView`, `EventsFinder`, `PortalSpotsView`, `RegularsView`, `CalendarView`, map mode) are all reused as-is — **zero modifications to existing tools**.

### Find Tab Layout (top to bottom)

```
┌──────────────────────────────────────┐
│  Search Bar (FindSearchInput w/ typeahead) │
├──────────────────────────────────────┤
│  Tool Chip Row (scrollable, time-reordered) │
│  [Tonight's Music] [Now Showing] [Stage] │
│  [All Events] [Regulars] [Calendar] [Map] │
├──────────────────────────────────────┤
│  Right Now stream (existing)          │
├──────────────────────────────────────┤
│  Lane previews (existing)             │
│  Arts & Culture · See all →           │
│  Eat & Drink · See all →              │
│  ...                                  │
└──────────────────────────────────────┘
```

Content-first: one search bar, one chip row, then immediately the stream. No multi-tier hero/utility blocks — the chips ARE the routing layer.

### 1. Search Bar

Wire to the existing `FindSearchInput` component (`web/components/find/FindSearchInput.tsx`) with typeahead. When activated, opens the search overlay with trending pills and results. Searches across both events and places — on submit, navigates to `?view=happening&search={query}&from=find` (events search) with a "Search places instead" link that goes to `?view=places&q={query}&from=find`.

### 2. Tool Chip Row

A single scrollable row of jewel-tone chips using the existing `QuickLinksBar` visual pattern: `color-mix(in srgb, accent 12%, #0F0F14)` background, `color-mix(in srgb, accent 30%, transparent)` border, Phosphor icons at duotone weight, mono labels.

**Time-of-day reordering:** All chips are always present. The first 2-3 chips shift to match the current moment. The rest follow in a stable order.

| Time Window | First Chips | Remaining (stable order) |
|---|---|---|
| Evening (5pm+) | Tonight's Music, Now Showing | Stage, All Events, Regulars, Calendar, Map |
| Daytime weekday (9am-5pm) | Now Showing, All Events | Tonight's Music, Stage, Regulars, Calendar, Map |
| Weekend morning (Sat/Sun before 2pm) | Weekend Events, Now Showing | Tonight's Music, Stage, Regulars, Calendar, Map |
| Late night (10pm-9am) | Now Showing, Regulars | Tonight's Music, Stage, All Events, Calendar, Map |

**Timezone:** Use the portal's timezone (Atlanta = America/New_York), not the browser timezone. Events are local.

**Chip definitions:**

| Chip | Accent | Icon | Navigates to |
|---|---|---|---|
| Tonight's Music | `#A78BFA` (vibe) | MusicNotes | `?view=happening&content=showtimes&vertical=music&from=find` |
| Now Showing | `#FF6B7A` (coral) | FilmSlate | `?view=happening&content=showtimes&vertical=film&from=find` |
| Stage & Comedy | `#E855A0` (magenta) | MaskHappy | `?view=happening&content=showtimes&vertical=stage&from=find` |
| All Events | `#FF6B7A` (coral) | Ticket | `?view=happening&from=find` |
| Regulars | `#FFD93D` (gold) | ArrowsClockwise | `?view=happening&content=regulars&from=find` |
| Calendar | `#00D9A0` (green) | CalendarBlank | `?view=happening&display=calendar&from=find` |
| Map | `#00D4E8` (cyan) | MapTrifold | `?view=happening&display=map&from=find` |

**No count badges for v1.** Counts require a new API endpoint. The chip labels alone are strong CTAs. Add counts in a follow-up when data is available.

### 3. Right Now Stream (existing)

Keep as-is from v1. "Right Now" temporal section with fuzzy-deduped interleaved events + places. Compact cards with vertical-specific rendering.

### 4. Lane Previews → Existing Tools

Each lane shows 3 compact card previews with "See all →". Tapping "See all →" navigates to the existing tool:

| Lane | Navigates to | URL |
|---|---|---|
| Arts & Culture | `PortalSpotsView` | `?view=places&tab=things-to-do&venue_type=museum,gallery,arts_center,theater&from=find` |
| Eat & Drink | `PortalSpotsView` | `?view=places&tab=eat-drink&from=find` |
| Nightlife | `PortalSpotsView` | `?view=places&tab=nightlife&from=find` |
| Outdoors | `PortalSpotsView` | `?view=places&tab=things-to-do&venue_type=park,trail,recreation,viewpoint,landmark&from=find` |
| Music & Shows | `WhatsOnView` | `?view=happening&content=showtimes&vertical=music&from=find` |
| Entertainment | `PortalSpotsView` | `?view=places&tab=things-to-do&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium,cinema&from=find` |

Users get the full filter bar, occasion chips, map toggle, sort controls, and hundreds of paginated results — everything the old tabs had.

**Lane preview selection:** Top 3 places per lane, ordered by `final_score` (quality ranking from Google score + event density). Not random query order. The existing `/api/spots` event-led path already sorts by event count which is a reasonable proxy.

**Empty lanes:** If a lane has 0 results, show the lane header + "Nothing nearby right now" text instead of collapsing. The stream density shouldn't vary unpredictably.

### 5. Navigation Pattern — `from=find` Breadcrumb

**Critical architecture decision:** Tools are NOT embedded inside FindView. They are navigated to via normal URL routing. The `from=find` param enables return navigation.

How it works:
1. User is on `?view=find` (Find overview with stream)
2. User taps "Eat & Drink — See all →"
3. `router.push()` navigates to `?view=places&tab=eat-drink&from=find`
4. The existing `PortalSpotsView` renders with all its filters, exactly as before
5. A **"← Find" back link** appears in the header (reads `from=find` param)
6. User taps back → `router.push('?view=find')`
7. Browser back button also works (because step 3 used `push`, not `replace`)

**Why not embed tools inside FindView:** The existing tools (`PortalSpotsView`, `EventsFinder`, `WhatsOnView`) all read and write URL params directly via `router.replace()`. Embedding them inside FindView causes URL param contamination — a cuisine filter would wipe `view=find` from the URL. The `from=find` approach means zero modifications to any existing tool.

**The back link:** When `searchParams.get("from") === "find"`, show a subtle "← Find" link above the tool's header. This is the ONLY new UI added to the existing tool pages. It can be implemented in the portal layout (`page.tsx`) rather than inside each tool component.

### 6. What Gets Removed

- `LaneView.tsx` — replaced by routing to `PortalSpotsView`
- `LaneFilterBar.tsx` — the fake filter bar with display-only chips
- `ExpandedPlaceCard.tsx` — `PortalSpotsView` uses `PlaceCard` which is richer
- The `useLaneSpots` hook's 60-item mode — only the 3-item preview mode is needed

### 7. What Gets Kept

- `FindView.tsx` — the shell, now with chip row at top
- `RightNowSection.tsx` — temporal stream
- `LanePreviewSection.tsx` — compact card previews (3 per lane)
- All compact card components (`CompactDiningCard`, etc.) — used in lane previews and Right Now
- `FindSidebar.tsx` — desktop lane navigation (shows "← Back to Find" when on a tool page)
- `useRightNow.ts` — Right Now data fetching
- `normalizeFinURLParams()` — URL migration (update to handle `from=find` preservation)

### 8. Implementation Approach

This is primarily a **routing change**, not a new build:
1. Create `FindToolChipRow` component (scrollable chips with time-of-day reordering)
2. Wire search bar to existing `FindSearchInput` with typeahead
3. Change lane "See all →" links to navigate to existing tool URLs with `&from=find`
4. Add chip tap handlers that navigate to existing tool URLs with `&from=find`
5. Add "← Find" back link to portal page layout when `from=find` is present
6. Delete `LaneView`, `LaneFilterBar`, `ExpandedPlaceCard`
7. Update `normalizeFinURLParams()` to preserve `from` param through redirects
8. Test that all existing filter/map/calendar functionality works unmodified

### 9. Scope Boundaries

**In scope:**
- `FindToolChipRow` component with time-of-day reordering
- Search bar wiring to `FindSearchInput`
- Lane "See all →" routing to existing tool URLs
- `from=find` breadcrumb navigation pattern
- "← Find" back link in portal layout
- Delete unused components (LaneView, LaneFilterBar, ExpandedPlaceCard)
- Update `normalizeFinURLParams()` for `from` param

**Out of scope:**
- Any modifications to `WhatsOnView`, `EventsFinder`, `PortalSpotsView`, `RegularsView`, `CalendarView`, or map mode — they work as-is
- Count badges on chips (requires new API endpoint — follow-up)
- New filter or search features
- Detail view changes (shipped in v1)

### 10. Review Log

**Expert review completed 2026-03-29. Three reviewers:**

**Architecture:** URL param contamination is the biggest risk. Solved by `from=find` breadcrumb — tools own their URL, no embedding. Unify routing on standard `?view=` params, not a new `?tool=` param. Use portal timezone for time-of-day logic.

**Business Strategy:** Routing architecture is sound. EventsFinder needs a permanent chip ("All Events" added). Lane preview selection logic must use quality ranking. Empty lanes show "nothing nearby" not collapse. Lobby page risk mitigated by stream content quality.

**Product Design:** Collapse hero cards + utility row into single chip row (adopted). Side-by-side hero cards break at 375px. Content-first, not navigation-first. Search bar must wire to real `FindSearchInput`. Back navigation must use `router.push()`.
