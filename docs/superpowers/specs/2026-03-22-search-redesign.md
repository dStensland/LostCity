# Search Redesign Spec — Premium Search Experience

## Goal

Rebuild search as the primary discovery surface for Lost City. Search and browse become the same experience — the Find view IS the search results page. Instant suggestions provide a fast path to known items; pressing Enter drops into full filtered browse mode.

## Design Principles

1. **Search and browse are one surface.** No separate search results page. The Find view is the results page. Searching filters it.
2. **Instant suggestions are the fast path.** Most queries resolve in the dropdown without pressing Enter. Rich cards with images, dates, venue names.
3. **Enter = full browse mode.** Query becomes a clearable filter chip in Find. Combine with date, price, neighborhood, category filters.
4. **Pre-search is discovery.** Empty search state shows trending searches, category shortcuts, and contextual suggestions — not emptiness.
5. **Always accessible.** Full-width in Find view, compact in header on all other pages. ⌘K shortcut from anywhere.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│ HEADER (all pages)                                   │
│ [Compact Search Input] ──click/focus──→ Find view    │
│  or inline dropdown on non-Find pages                │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│ FIND VIEW                                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ [🔍 Full-width Search Bar                    ]  │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│ ┌─ PRE-SEARCH STATE (no query) ─────────────────┐  │
│ │ TRENDING: "Shaky Knees" "patio brunch" "comedy"│  │
│ │ CATEGORIES: [Music] [Food] [Art] [Outdoors]... │  │
│ │ POPULAR NOW: 3 venue/event cards               │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ TYPING STATE (instant dropdown) ─────────────┐  │
│ │ EVENTS (12)           SEE ALL →                │  │
│ │ ┌─ Event Card ─┐ ┌─ Event Card ─┐ ┌─ Card ─┐ │  │
│ │ └──────────────┘ └──────────────┘ └────────┘  │  │
│ │ VENUES (5)            SEE ALL →                │  │
│ │ ┌─ Venue Card ─┐ ┌─ Venue Card ─┐            │  │
│ │ └──────────────┘ └──────────────┘              │  │
│ │ SERIES (3)            SEE ALL →                │  │
│ │ ┌─ Series Card ─┐ ┌─ Series Card ─┐          │  │
│ │ └───────────────┘ └───────────────┘            │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ ┌─ BROWSE STATE (after Enter / "See all") ──────┐  │
│ │ [🔍 "live music" ✕]  [Today ✕]  [Free ✕]     │  │
│ │ ┌─ Full Event List ───────────────────────┐   │  │
│ │ │ Event rows with images, dates, venues   │   │  │
│ │ │ (standard Find view event cards)        │   │  │
│ │ └────────────────────────────────────────┘    │  │
│ └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. SearchBar (header version)

**Location:** Header, all pages (replaces current "Search... ⌘K" button)

**Behavior:**
- Compact input: ~200px wide on desktop, icon-only on mobile (<768px)
- Click/focus: on the Find view, focuses the full-width bar. On other pages, either opens an inline dropdown or navigates to Find with search focused.
- ⌘K (Mac) / Ctrl+K (Win) shortcut focuses it from anywhere
- Typing triggers instant search after 150ms debounce (existing behavior)
- Escape clears and blurs

**Visual:**
- `font-mono text-sm` placeholder "Search events, venues..."
- Search icon (MagnifyingGlass) left-aligned
- ⌘K badge right-aligned (desktop only)
- Border: `border-[var(--twilight)]`, focus: `border-[var(--coral)]`

### 2. FindSearchBar (Find view version)

**Location:** Top of Find view. **This enhances the existing `FindSearchInput.tsx`**, which already implements ~80% of the described behavior (full-width, instant search, pre-search trending pills, category chips, grouped dropdown, keyboard navigation, URL sync). The work here is elevating the visual design and adding the pre-search discovery state — not rebuilding from scratch.

**Behavior:**
- Full-width, prominent, always visible at the top of Find
- Same instant search mechanics as header version but larger, more visual
- Pre-search state renders below it (trending, categories)
- Typing state renders the instant results dropdown below it
- Enter key transitions to browse state (query becomes filter chip)
- Clear button (✕) resets to pre-search state

**Visual:**
- Height: 48px (min-h-[48px])
- `text-base` input text, `text-sm` placeholder
- Background: `bg-[var(--dusk)]` with `border border-[var(--twilight)]`
- Focus ring: `focus:border-[var(--coral)]`
- Rounded: `rounded-xl`
- Search icon left, clear button right (when query present)

### 3. PreSearchState

**Location:** Below FindSearchBar when no query is active

**Content (3 sections):**

**a) Trending Searches (pills)**
- 6-8 trending search terms as clickable pills
- Source: most popular recent searches from `search_suggestions` materialized view, or curated editorial picks
- Clicking a pill fills the search bar and triggers instant search
- Visual: `font-mono text-xs` pills with `bg-[var(--twilight)]/40 hover:bg-[var(--twilight)]` rounded-full

**b) Category Shortcuts (grid)**
- 8 category chips matching the existing Browse section categories: Music, Food & Drink, Art, Comedy, Outdoors, Nightlife, Film, Sports
- Clicking navigates to Find with that category filter active (same as existing quick links)
- Visual: icon + label, same pattern as existing CategoryGrid but inline

**c) Popular Right Now (cards)**
- 3 horizontal cards showing trending events/venues right now
- Source: CityPulse trending section data or popularity-scored events
- Visual: compact event cards (image + title + venue + time)

**Data source:** New API endpoint or extend existing instant search to return pre-search data when query is empty. The trending data can come from the `search_suggestions` view (top by frequency) and the popular data from the CityPulse trending pool.

### 4. InstantResultsDropdown

**Location:** Below FindSearchBar when query is 2+ characters

**Content:**
- Grouped results by entity type, ordered by intent relevance
- Each group: heading with count + "See all →" link + 3 result cards
- Groups shown (in order, based on intent detection):
  - **Events** — title, date, venue, category icon, image thumbnail
  - **Venues** — name, neighborhood, type, image thumbnail
  - **Series** — title, frequency label, venue
  - **Festivals** — title, date range, image
- Quick actions row at top (contextual): "Show free events", "Tonight only", "Near me"
- Keyboard navigation: ↑↓ moves between results, Enter selects, Esc closes

**Behavior:**
- Renders as an overlay/dropdown below the search bar
- On desktop: max-height ~60vh, scrollable
- On mobile: full-screen overlay (bottom sheet pattern)
- Clicking a result navigates to its detail page
- Clicking "See all →" on a group transitions to browse state filtered by that type

**Data source:** Existing `/api/search/instant` endpoint (fast path, 20-75ms). Already returns grouped results with the right shape.

**Visual per result card:**
- Event: `[img 40x40] [title · venue · date/time]` — one line, compact
- Venue: `[img 40x40] [name · neighborhood · type]`
- Series: `[icon] [title · "Every Thursday" · venue]`
- Highlight matching text in results (bold the query match)

### 5. BrowseState (filtered Find view)

**Location:** Find view after pressing Enter or clicking "See all"

**Behavior:**
- The search query becomes a filter chip in the existing filter bar
- The chip shows the query text with a ✕ to clear
- The event list below shows results matching the query
- All existing filters (date, free, category, neighborhood) work alongside the search filter
- If the user arrived from "See all → Venues", switch to the Places tab with the query active

**Visual:**
- Search chip: `bg-[var(--coral)]/15 text-[var(--coral)] font-mono text-xs rounded-full px-3 py-1` with ✕ button
- Results: standard Find view event/venue cards (no changes needed)

---

## API Changes

### Extend `/api/search/instant` for pre-search

When `q` is empty or absent, return pre-search data:

```typescript
// GET /api/search/instant?portal=atlanta (no q param)
{
  preSearch: {
    trending: ["Shaky Knees", "patio brunch", "comedy tonight", "free events", "BeltLine", "art galleries"],
    categories: [
      { id: "music", label: "Music", icon: "MusicNotes", count: 938 },
      { id: "food_drink", label: "Food & Drink", icon: "ForkKnife", count: 297 },
      // ...
    ],
    popularNow: [
      { type: "event", id: 12345, title: "...", venue: "...", image_url: "...", start_time: "..." },
      // 3 items
    ]
  }
}
```

**Source for trending:** The `search_suggestions` materialized view contains entity names (venues, events, categories) weighted by importance — not user search queries. Use the top 8 entities by frequency as "Popular" suggestions. For editorial trending terms ("patio brunch", "comedy tonight"), use a curated list — the existing `TRENDING_SEARCHES` array in the codebase already does this. Hybrid approach: curated editorial terms + top entities by frequency, merged and deduplicated.

**Source for categories:** Existing category counts from the CityPulse pipeline or a lightweight `SELECT category_id, count(*) FROM events WHERE ...` query.

**Source for popularNow:** Top 3 events from the CityPulse trending pool, or events with highest `data_quality + social_proof` scores.

### Performance Target

| Interaction | Target | Current |
|-------------|--------|---------|
| Pre-search load | <100ms | N/A (new) |
| Instant suggestions (typing) | <100ms | 20-75ms (fast path) ✅ |
| Full results (Enter) | <500ms | 400-1500ms (needs work) |
| Cache warm | <30ms | 20ms ✅ |

### Full Search Performance Fix

The full search route (`/api/search`) should be optimized:

1. **Make social proof optional and lazy.** Don't block the initial response on social proof counts. Return results immediately, then optionally fetch social proof as a separate lightweight call (or skip it entirely for the initial render — it's nice-to-have, not essential for deciding what to click).

2. **Parallelize facets with results.** Currently facets may be sequential with results. They should be a single `Promise.all`.

3. **Skip spelling suggestions on non-empty results.** Only run did-you-mean when the primary search returns <3 results. Currently it runs on every query.

4. **Pre-warm popular queries.** On CityPulse feed load, pre-fetch and cache the top 10 trending search terms' instant results. When the user types one, it's a cache hit.

---

## Mobile Experience

### Mobile Search Bar (header)
- Icon-only trigger (MagnifyingGlass) in header on <768px
- Tapping opens full-screen search overlay (not a dropdown)

### Mobile Full-Screen Search
- Input at top with back arrow (←) and clear (✕)
- Pre-search state: trending pills horizontally scrollable, category chips in 2-row grid, popular cards vertical
- Typing state: full-screen list of results (no dropdown — results fill the screen)
- Keyboard pushes content up naturally
- Selecting a result navigates to detail, back button returns to search with query preserved

### Mobile Browse State
- Same as desktop Find view but search chip is part of the scrollable filter bar
- Filter sheet accessible via "Filters" button

---

## Interaction Flow

```
User lands on Find view
  → Sees full-width search bar + pre-search state (trending, categories, popular)

User taps a trending pill ("Shaky Knees")
  → Search bar fills with "Shaky Knees"
  → Instant dropdown appears with Shaky Knees festival + related events + venues

User types "live mus"
  → After 150ms debounce, instant dropdown appears
  → Shows: Events (Vinyl Night, Jazz Jam, ...), Venues (The Earl, Terminal West, ...), Series (Friday Jazz)
  → Quick action: "Tonight only" pill

User presses Enter on "live music"
  → Dropdown closes
  → Find view shows filtered event list for "live music"
  → "live music ✕" chip appears in filter bar
  → User can add more filters: "Today", "Free", "Midtown"

User clicks "See all → Venues" in dropdown
  → Find view switches to Places tab with "live music" query active
  → Shows venue cards matching "live music"

User on Feed page clicks header search
  → Navigates to Find view with search bar focused
  → Pre-search state visible, ready to type
```

---

## Files to Create/Modify

### New Files
- `web/components/search/PreSearchState.tsx` — trending + categories + popular discovery state
- `web/components/search/MobileSearchOverlay.tsx` — full-screen mobile search (portal-mounted overlay)

### Modified Files
- `web/components/find/FindSearchInput.tsx` — elevate to premium search bar (this component already handles instant search, dropdown, URL sync — enhance visuals and add pre-search state)
- `web/components/headers/StandardHeader.tsx` — replace search button with compact search input
- `web/components/find/HappeningView.tsx` — integrate enhanced search bar at top, manage search/browse state transitions
- `web/app/api/search/instant/route.ts` — add pre-search response when `q` is empty (currently returns 400 on empty query — change validation to return pre-search data instead)

### Existing Files (extend, don't rebuild)
- `web/components/search/SuggestionGroup` — already renders grouped result cards with type icons, titles, subtitles, thumbnails. Restyle rather than rebuild.
- `web/lib/instant-search-service.ts` — client-side hooks already work well, extend for pre-search state

### Existing Files (no changes needed)
- `web/lib/instant-search-service.ts` — instant search client hooks (already good)
- `web/lib/search-suggestion-results.ts` — suggestion result mapping (already good)
- `web/lib/search-ranking.ts` — relevance scoring (already good)
- `web/app/api/search/instant/route.ts` — fast path (already 20-75ms, keep as-is except pre-search extension)

---

## What This Does NOT Include

- **Natural language queries** ("where should I eat near the BeltLine") — future enhancement, not this refactor
- **Map integration** — the map view already exists in Find, search results should work with it but no map-specific search UX changes
- **Saved searches / alerts** — future feature
- **Voice search** — not needed
- **AI-powered recommendations** — the feed already does this; search is for intentional discovery

---

## Success Criteria

1. **A user on the Find view sees an inviting search experience** — not an empty page waiting for input
2. **Typing produces results in <100ms** — the instant path already achieves this
3. **The transition from search to browse is seamless** — no page reload, no context loss
4. **Full filtered results load in <500ms** — down from 1.5s+ on cold cache
5. **Mobile search is a first-class experience** — full-screen overlay, not a cramped dropdown
6. **Search is always one click/keystroke away** — header input + ⌘K from any page
