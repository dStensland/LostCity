# Classes & Workshops Lane — Design Spec (v2)

## Context

The Classes lane is one of 9 lanes in the Find tab's Explore shell. It currently shows a "Coming soon" placeholder. The data infrastructure is complete: `is_class` boolean on the events table, `class_category` (11 types), `skill_level`, `instructor`, `capacity` columns, 70+ crawlers classifying classes, and a full `/api/classes` endpoint with filtering, pagination, and sorting. A partial `ClassesView` component exists in a development worktree but hasn't been merged.

Classes are excluded from the Events, Regulars, and Feed lanes to prevent volume pollution — daily programming from studios would drown one-off events. Classes surface in general search results but have their own dedicated lane with specialized filters.

**Data model note:** The current model treats classes as events with an `is_class` flag. By the north star's entity taxonomy, recurring classes with sessions, skill levels, and capacity are closer to Programs than Events. This is acknowledged as pragmatic technical debt — the `is_class` flag ships V1, but the long-term model is a dedicated program entity.

---

## What This Builds

A two-level studio-first browsing experience:

1. **Studios List** (default) — venue-grouped classes with category/date/skill filter chips
2. **Studio Schedule** — deduplicated class list for a specific venue

Plus search (inline filtering) and map view (V2, deferred).

---

## Level 1: Studios List (Default Landing)

When the user enters the Classes lane (`?view=find&lane=classes`), they land directly on a browsable list of studios — not a category picker. This matches every other lane in Find (Events, Places, Regulars all drop you into content immediately).

### Search Bar

Full-width search input at top. Searches across class titles, descriptions, instructors, and venue names. When a query is active, the studios list filters to only studios with matching classes. Clearing the search (`q` param removed) restores the unfiltered list.

### Filter Bar

Horizontal scrollable chip row below the search bar:

**Category chips**: All (default) | Painting | Cooking | Pottery | Dance | Fitness | Crafts | Photography

8 categories (merged from 11):
- "Candle Making" + "Floral" + "Mixed" → **Crafts** (combined catch-all for small-volume categories)
- "Outdoor Skills" → merged into **Fitness**
- Remaining 7 stay as-is

Each chip shows a count badge: "Painting (24)". Zero-count chips render dimmed but remain visible.

**Date window chips** (after a subtle separator): This Week (default) | Weekend | Next 2 Weeks | All Upcoming

**Skill level chips** (after separator): All Levels (default) | Beginner | Intermediate | Advanced

Active chips use the classes accent color at 10% opacity: `color-mix(in srgb, var(--classes-accent) 10%, transparent)`. The accent color is `#C9874F` — needs a CSS variable token (`--classes-accent` or closest existing token).

Filters sync to URL params via `window.history.replaceState()` (no full navigation).

### Category Icons

Used in filter chips and studio cards:

| Category | Label | Icon (Phosphor) |
|----------|-------|-----------------|
| painting | Painting | Palette |
| cooking | Cooking | CookingPot |
| pottery | Pottery | HandGrabbing |
| dance | Dance | PersonSimpleRun |
| fitness | Fitness | Barbell |
| woodworking | Woodworking | Hammer |
| photography | Photography | Camera |
| crafts | Crafts | Sparkle |

Dance uses `PersonSimpleRun` (not `MusicNotes`, which belongs to the Live Music lane).

### Studio Cards

Sorted by class count descending (busiest studios first). Each card:

```
┌──────────────────────────────────────────────────────┐
│  [venue image   ]  Atlanta Clay Works                 │
│  [or fallback   ]  Inman Park · 2.1 mi               │
│  [80x80 rounded ]  8 classes this week                │
│                    Next: Wheel Throwing · Tue 6pm     │
│                    Painting · Pottery         See schedule → │
└──────────────────────────────────────────────────────────────┘
```

- **Venue image** from `places` table (80x80 rounded). **Fallback** when no image: category-tinted icon box — accent color at 15% opacity background with a duotone Phosphor icon for the studio's primary category. Uses the existing `IconBox` component pattern from the design system.
- Studio name, neighborhood, distance (if location available)
- Class count for current filter window (date + skill + category applied)
- Next upcoming class as teaser (title + day + time)
- Category pills showing what the studio offers (when "All" category is active)
- **"See schedule →"** link navigates to studio schedule

Studios with zero classes in the current filter window drop to bottom, dimmed.

### Data Density Check

If the total class count across all categories is below 10, skip the filter chips and show a simple chronological list of classes with no grouping. This prevents the filterable studios list from looking empty on portals with thin class data.

### Empty States

- **No classes match filters**: "No {category} classes found for {date window}. Try a broader date range or different category." with a button to reset filters.
- **No classes at all**: "Classes coming soon. Know a studio that should be listed?" with a suggestion link.
- **Search no results**: "No classes matching '{query}'. Try a different search or browse all categories." with a button to clear search.

### Loading State

Studios list skeleton: 4 studio card placeholders (image shimmer + text lines), matching the card layout. Uses `animate-pulse` with `bg-[var(--twilight)]` shimmer elements.

### Error State

"Unable to load classes. Try refreshing." centered, matching the ExploreHome error pattern.

---

## Level 2: Studio Schedule

When "See schedule →" is tapped on a studio card (`?view=find&lane=classes&studio=atlanta-clay-works`):

### Studio Header

Compact hero: venue image (full-width, 120px height, fallback to accent gradient), studio name, neighborhood. Link to full venue detail page ("See venue →").

### Back Navigation

"← Studios" breadcrumb at top. On mobile, the back arrow collapses into the header area to save vertical space (no separate breadcrumb row).

### Class List

**Deduplicated by series with title+venue fallback.** Grouping logic:

1. **Primary**: Group by `series_id` when present
2. **Fallback**: Group by `(place_id + normalized_title + start_time)` for classes with `series_id = NULL` but identical title/venue/time across multiple dates
3. **Ungrouped**: One-off workshops that don't match either pattern

Each unique class appears once:

```
┌──────────────────────────────────────────────────────┐
│  Wheel Throwing Basics                                │
│  [Beginner] · $45 · Capacity: 12                     │
│  Tuesdays & Thursdays, 6:00–8:00 PM                 │
│  Instructor: Sarah Chen                               │
│  Next: Tue Apr 8                        Details →    │
└──────────────────────────────────────────────────────┘
```

### Three class display patterns:

**Regular recurring** (`series_id` set, or title+venue+time match across 3+ dates):
- Show schedule pattern: "Tuesdays & Thursdays, 6–8 PM"
- Show "Next: {date}" for the upcoming instance

**Multi-session series** (same series_id, varying dates, finite count):
- Show date range + count: "6 sessions · Apr 5 – May 10"
- Show next session date

**One-off workshop** (single date, no series match):
- Show single date: "Saturday, Apr 12 · 10:00 AM – 1:00 PM"

**"Too complex" fallback**: If pattern derivation produces an irregular result (e.g., Mon, Wed, Fri one week, Tue, Thu the next), show "Multiple sessions" with an expandable list of individual dates.

### Metadata

- **Skill level badge**: Color-coded pill. Beginner = `var(--neon-green)`, Intermediate = `var(--gold)`, Advanced = `var(--coral)`, All Levels = `var(--twilight)` background with `var(--soft)` text.
- **Capacity**: Show "Capacity: N" when capacity data exists (raw capacity from source). Do not imply remaining availability ("spots left") unless the crawler provides it directly. Omit if null.
- **Instructor**: Show if available. Omit if null.
- **Price**: Show if available ($45, Free, etc.). Omit if null.
- **"Details →"**: Links to the event detail page for the next upcoming instance. The event detail page should show series siblings if the event has a `series_id` — this is existing behavior, not new work.

### Sort

Recurring series first (alphabetical by title), then one-offs by date.

### Filters

Same filter bar carries over from Level 1: date window + skill level chips. Category chips hidden (you're already scoped to a studio). Active filters from Level 1 persist into Level 2.

### Empty State

"No upcoming classes at this studio for {date window}." with suggestion to expand date range.

### Loading State

Class list skeleton: 3 class card placeholders with shimmer text lines.

---

## Map View (V2 — Deferred)

Map is deferred to a follow-up spec. The core browse flow (Studios List → Studio Schedule) ships first, polished.

When built, the map will:
- Follow the split-pane pattern from Events/Places map views
- Show studio pins colored by primary category (when category filter active) or default accent (when unfiltered)
- Use the `/api/classes/studios` endpoint for pin data (lat, lng, name, count, categories)
- Multi-category studios on the unfiltered map use the default classes accent

The URL `?view=find&lane=classes&display=map` is reserved for this future work.

---

## Explore Home Integration

### Update `explore-home-data.ts`

Replace the hardcoded zero state for the classes lane with a real query:

- Count: `SELECT COUNT(*) FROM events WHERE is_class = true AND start_date >= today AND portal scope`
- Count today: same with `start_date = today`
- Preview items: 3-4 upcoming classes with images, using the same pattern as other lane previews

**Important**: The Explore Home preview query follows the same simple count + items pattern as other lanes. It does NOT load category counts or studio grouping — those are only fetched when entering the Classes lane.

### Scoring

Classes use the non-temporal scoring path (same as Places): alive when `totalCount >= 3`.

---

## Data Architecture

### Existing API — `/api/classes`

Already supports filtering by `class_category`, `skill_level`, date range, `neighborhood`, search/`q`, `sort`, `limit`/`offset`, portal scoping. **Hard limit: 50 results per page.**

### New: Add `place_id` filter to `/api/classes`

The existing endpoint has no way to filter by venue. Add a `place_id` parameter (accepts numeric ID or venue slug) to the query builder. This is essential for Level 2 (studio schedule).

### New: `GET /api/classes/studios` — Server-Side Studio Grouping

The existing `/api/classes` returns flat class rows with a 50-item page limit. Client-side grouping would require multiple paginated requests. Instead, create a lightweight server-side grouping endpoint:

```
GET /api/classes/studios?class_category=painting&start_date=2026-04-01&end_date=2026-04-07&skill_level=beginner&portal=atlanta
```

Response:
```json
{
  "studios": [
    {
      "place_id": 123,
      "name": "Atlanta Clay Works",
      "slug": "atlanta-clay-works",
      "neighborhood": "Inman Park",
      "lat": 33.758,
      "lng": -84.352,
      "image_url": "...",
      "class_count": 8,
      "categories": ["painting", "pottery"],
      "next_class": {
        "title": "Wheel Throwing Basics",
        "start_date": "2026-04-08",
        "start_time": "18:00"
      }
    }
  ],
  "category_counts": {
    "painting": 24,
    "cooking": 18,
    "pottery": 15,
    "dance": 31,
    "fitness": 47,
    "woodworking": 6,
    "photography": 3,
    "crafts": 13
  },
  "total_count": 157
}
```

This endpoint:
- Groups by `place_id` with count, next class, and categories per studio
- Returns category counts in one shot (replaces the separate RPC)
- Applies the same portal scoping chain as `/api/classes`: portal context resolution, federated scope, city filter, content scope filter
- Cached at 90 seconds (matching `/api/classes`)

### Series Deduplication (Client-Side)

For Level 2 (studio schedule), fetch all classes for a venue via `/api/classes?place_id=X&limit=200`, then group client-side:

1. Group by `series_id` when not null
2. Fallback: group by `(place_id + normalized_title + start_time)` — normalized_title strips date suffixes
3. Ungrouped: one-off workshops

Derive schedule pattern from the grouped instances:
- 3+ instances on the same weekday → "Tuesdays, 6–8 PM"
- 3+ instances on multiple weekdays → "Tuesdays & Thursdays, 6–8 PM"
- Finite series with varying dates → "6 sessions · Apr 5 – May 10"
- Irregular → "Multiple sessions" with expandable date list

---

## Component Architecture

| Component | File | Purpose |
|-----------|------|---------|
| `ClassesView` | `web/components/find/ClassesView.tsx` | Top-level lane component, owns data fetching via `useClassesData`, URL routing |
| `ClassStudiosList` | `web/components/find/classes/ClassStudiosList.tsx` | Venue-grouped list with filter bar |
| `ClassStudioSchedule` | `web/components/find/classes/ClassStudioSchedule.tsx` | Deduplicated class list for a venue |
| `ClassStudioCard` | `web/components/find/classes/ClassStudioCard.tsx` | Individual studio card |
| `ClassCard` | `web/components/find/classes/ClassCard.tsx` | Individual class row in schedule |
| `useClassesData` | `web/lib/hooks/useClassesData.ts` | Data fetching hook — manages fetch lifecycle, caching, shared state |

### Data Fetching — `useClassesData`

`ClassesView` owns the `useClassesData` hook and passes data to sub-components via props. The hook:

- Fetches from `/api/classes/studios` for the studios list
- Fetches from `/api/classes?place_id=X` for the studio schedule
- Manages loading/error/data states per level
- Caches fetched data for session duration within the lane — navigating back from Level 2 to Level 1 does NOT re-fetch
- Shares studios data between list view and (future) map view

Sub-components are display-only — they receive data via props and render it. They do not fetch independently.

`ClassStudiosList` and `ClassStudioSchedule` are lazy-loaded via `dynamic()`.

---

## URL Scheme

```
?view=find&lane=classes                                → studios list (all categories)
?view=find&lane=classes&category=painting               → studios list (painting filter active)
?view=find&lane=classes&category=painting&window=weekend → studios list with date filter
?view=find&lane=classes&studio=atlanta-clay-works        → studio schedule
?view=find&lane=classes&q=pottery                        → studios list filtered by search
```

URL param `studio` uses the venue slug for readability. `ClassesView` resolves the slug to `place_id` from the studios list data (already loaded at Level 1). If deep-linked directly to a studio schedule, the component fetches studio metadata separately.

Filter params: `category`, `window` (date), `skill`, `q` (search). All optional.

---

## Navigation Integration

### FindShellClient

Replace the placeholder:
```typescript
{lane === "classes" && (
  <ClassesView portalId={portalId} portalSlug={portalSlug} />
)}
```

### Sidebar + MobileLaneBar

Already have the Classes lane (added in Explore Home work). No changes needed.

### Chip Bar Behavior

When inside the Classes lane, the mobile chip bar shows "Classes" as the active chip. Navigating between studios list and studio schedule stays within the lane — the chip bar doesn't change.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. Studios list: renders studio cards sorted by class count, all 8 category chips with counts
3. Category chip tap: filters studios list to matching category
4. Date window + skill level chips: filter correctly
5. Studio card "See schedule →" → schedule with series deduplication
6. Regular recurring classes: show schedule pattern ("Tuesdays & Thursdays, 6–8 PM")
7. Multi-session series: show date range + session count
8. One-off workshops: show single date
9. Irregular classes: show "Multiple sessions" with expandable dates
10. Title+venue fallback grouping: classes with same title/venue but no series_id group together
11. Back navigation: studio schedule → studios list preserves filter state and scroll position
12. Search: typing a query filters studios to matching. Clearing restores unfiltered list.
13. Mobile (375px): full-width studio cards, horizontally scrollable filter chips, compact header
14. Empty states: no-results, no-classes, search-no-results all render correctly
15. Loading states: skeleton cards while fetching
16. Error state: "Unable to load" message on API failure
17. Data density: below 10 total classes, simplified flat list without filters
18. Image fallbacks: studios without images show category-tinted icon box
19. Explore Home: Classes lane shows alive state with preview items (not "Coming soon")
20. URL params sync correctly when filtering and navigating
21. Navigating back from schedule to studios list does NOT re-fetch (cached)
