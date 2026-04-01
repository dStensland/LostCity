# Classes & Workshops Lane — Design Spec

## Context

The Classes lane is one of 9 lanes in the Find tab's Explore shell. It currently shows a "Coming soon" placeholder. The data infrastructure is complete: `is_class` boolean on the events table, `class_category` (11 types), `skill_level`, `instructor`, `capacity` columns, 70+ crawlers classifying classes, and a full `/api/classes` endpoint with filtering, pagination, and sorting. A partial `ClassesView` component exists in a development worktree but hasn't been merged.

Classes are excluded from the Events, Regulars, and Feed lanes to prevent volume pollution — daily programming from studios would drown one-off events. Classes surface in general search results but have their own dedicated lane with specialized filters.

## What This Builds

A three-level category-first browsing experience for classes and workshops:

1. **Category Landing** — grid of 11 category tiles with counts
2. **Studios List** — venue-grouped results within a selected category
3. **Studio Schedule** — deduplicated class list for a specific venue

Plus a map view accessible from the category landing.

---

## Level 1: Category Landing

When the user enters the Classes lane (`?view=find&lane=classes`), they see:

### Search Bar

Full-width search input above the category grid. Searches across class titles, descriptions, instructors, and venue names. When a search query is active, results display as a flat chronological list (breaking out of the category hierarchy) with class cards showing category badge, title, venue, date/time, skill level, price.

### Map Toggle

Button in the search bar row (right side). Toggles to map view — all studios with classes, pins colored by category. Tap pin → studio card with class count and categories offered. Tap card → navigates to that studio's schedule within the classes lane.

URL: `?view=find&lane=classes&display=map`

### Category Tiles

Responsive grid: 3 columns desktop, 2 columns mobile. Each tile:

- Category icon (Phosphor, weight="duotone")
- Category name
- Active class count ("24 classes this week")
- Tap → navigates to studios list for that category

The 11 categories and their icons:

| Category | Label | Icon |
|----------|-------|------|
| painting | Painting | Palette |
| cooking | Cooking | CookingPot |
| pottery | Pottery | Shapes (or custom) |
| dance | Dance | MusicNotes |
| fitness | Fitness | Barbell |
| woodworking | Woodworking | Hammer |
| floral | Floral | Flower |
| photography | Photography | Camera |
| candle-making | Candle Making | Flame |
| outdoor-skills | Outdoor Skills | Tree |
| mixed | Crafts & More | Sparkle |

Categories with zero classes this week render dimmed (reduced opacity) but visible — not hidden.

### "All Classes" Entry Point

First position in the tile grid or a prominent chip above — for users who want to browse all categories at once. Navigates to studios list with no category filter.

### URL Scheme

```
?view=find&lane=classes                          → category landing
?view=find&lane=classes&display=map              → map view
?view=find&lane=classes&category=painting         → studios list (painting)
?view=find&lane=classes&category=painting&venue=atlanta-clay-works → studio schedule
?view=find&lane=classes&q=pottery                 → search results (flat list)
```

---

## Level 2: Studios List

When a category tile is tapped (`?view=find&lane=classes&category=painting`):

### Breadcrumb

"← Painting" with back arrow. Shows subtitle: "24 classes at 6 studios." Tapping the arrow returns to category landing.

### Filter Bar

Horizontal chip row:

- **Date window**: This Week (default) | This Weekend | Next 2 Weeks | All Upcoming
- **Skill level**: All Levels (default) | Beginner | Intermediate | Advanced

Filters sync to URL params via `window.history.replaceState()` (no full navigation). Active chip uses category accent color (`#C9874F`) at 10% opacity background.

### Studio Cards

Sorted by class count descending (busiest studios first). Each card:

```
[venue image]  Studio Name
               Neighborhood · distance
               N classes this week
               Next: Class Title · Day Time
                                    View all →
```

- Venue image from `places` table (80x80 rounded)
- Studio name, neighborhood, distance (if location available)
- Class count for current filter window (date + skill level applied)
- Next upcoming class as teaser (title + day + time)
- "View all →" link expands to studio schedule

Studios with zero classes in the current filter window drop to bottom, dimmed.

### Empty State

"No {category} classes found for {date window}." with a suggestion to expand the date range.

---

## Level 3: Studio Schedule

When "View all →" is tapped on a studio card (`?view=find&lane=classes&category=painting&venue=atlanta-clay-works`):

### Studio Header

Compact hero: venue image (full-width, 120px height), studio name, neighborhood. Link to full venue detail page ("See venue →").

### Class List

**Deduplicated by series.** Each unique class (identified by `series_id`) appears once:

```
Class Title
Skill Level · $Price · N spots left
Schedule Pattern (e.g., "Tuesdays & Thursdays, 6–8 PM")
Instructor: Name
Next: Date                              Details →
```

- **Series classes**: Show schedule pattern derived from recurring instances ("Tuesdays & Thursdays, 6–8 PM"), not individual dates. `series_id IS NOT NULL` groups instances.
- **One-off workshops**: Show single date and time ("Saturday, Apr 12 · 10:00 AM–1:00 PM").
- **Skill level badge**: Color-coded (beginner=green, intermediate=gold, advanced=coral, all-levels=soft).
- **Capacity**: Show "N spots left" if capacity data exists and is meaningful. Omit if null.
- **Instructor**: Show if available. Omit if null.
- **"Details →"**: Links to the event detail page for the next upcoming instance.

**Sort**: Recurring series first (alphabetical), then one-offs by date.

### Back Navigation

"← Painting Studios" breadcrumb returns to the studios list.

---

## Map View

Accessible from the category landing via the map toggle button.

### Display

Full-height map (desktop: split-pane with sidebar list, mobile: full map with bottom sheet). Follows the same split-pane pattern used by the Events and Places map views.

### Pins

Each pin represents a studio (venue) that offers classes. Pin color matches the category if a category filter is active. If no category filter, pins use the default classes accent (#C9874F).

### Pin Interaction

Tap pin → studio popup card showing: studio name, neighborhood, class count, categories offered as pills. Tap card → navigates to studio schedule within the classes lane.

### Filters

Same filter bar as studios list: category chips (if viewing "All Classes" map) + date window + skill level. Applied client-side to the map data.

---

## Explore Home Integration

The Classes lane on Explore Home currently shows zero state ("Coming soon"). Once this lane ships:

### Alive State

Update `explore-home-data.ts` to query classes data instead of hardcoding zero. The alive preview shows:

- Section header: "CLASSES & WORKSHOPS" with liveness badge
- 3-4 preview items: upcoming classes with images, title, venue, time
- "Explore Classes →" footer link

### Scoring

Classes are non-temporal in the same way Places is — they're always available if data exists. Use the same non-temporal scoring path: alive when `totalCount >= 3`.

---

## Data Architecture

### Existing API

`GET /api/classes` already supports all needed queries:

| Parameter | Purpose |
|-----------|---------|
| `class_category` | Filter by category (11 values) |
| `skill_level` | Filter by skill |
| `start_date` / `end_date` | Date window |
| `neighborhood` | Geographic filter |
| `search` / `q` | Full-text search |
| `sort` | "date" (default) or "price" |
| `limit` / `offset` | Pagination |
| `portal` / `portal_id` | Portal scoping |

### New Queries Needed

**Category counts**: For the category landing, we need counts per category. Options:
- 11 parallel calls to `/api/classes?class_category=X&limit=0` (using count-only mode)
- A new lightweight endpoint or RPC: `get_class_category_counts(portal_id, start_date, end_date)` → `{ painting: 24, cooking: 18, ... }`

Recommendation: New RPC for efficiency. One query instead of 11.

**Studios grouped by venue**: The existing `/api/classes` returns flat class rows. For the studios list, we need classes grouped by venue with count and next-class info. Options:
- Client-side grouping from flat results
- A new endpoint: `GET /api/classes/studios?category=painting&date_window=this_week` → grouped response

Recommendation: Client-side grouping from the existing endpoint is simpler and the result set is small enough (typically <100 classes per category per week).

**Series deduplication**: For the studio schedule, group by `series_id`. Events with the same `series_id` are instances of the same recurring class. Show one entry per series, with the schedule pattern derived from the instance dates/times.

Recommendation: Client-side deduplication. Fetch all classes for a venue, group by `series_id`, compute schedule pattern from the instances.

---

## Component Architecture

| Component | File | Purpose |
|-----------|------|---------|
| `ClassesView` | `web/components/find/ClassesView.tsx` | Top-level lane component, handles URL routing between levels |
| `ClassCategoryGrid` | `web/components/find/classes/ClassCategoryGrid.tsx` | Category tile grid with counts |
| `ClassStudiosList` | `web/components/find/classes/ClassStudiosList.tsx` | Venue-grouped list with filters |
| `ClassStudioSchedule` | `web/components/find/classes/ClassStudioSchedule.tsx` | Deduplicated class list for a venue |
| `ClassSearchResults` | `web/components/find/classes/ClassSearchResults.tsx` | Flat search results list |
| `ClassMapView` | `web/components/find/classes/ClassMapView.tsx` | Map view with studio pins |

`ClassesView` reads URL params (`category`, `venue`, `display`, `q`) and renders the appropriate sub-component. Sub-components are lazy-loaded via `dynamic()`.

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

When inside the Classes lane, the mobile chip bar shows "Classes" as the active chip. Navigating between category landing, studios list, and studio schedule stays within the Classes lane — the chip bar doesn't change.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. Category landing: 11 category tiles render with counts. Zero-count categories are dimmed.
3. Category tile tap → studios list with correct category filter
4. Studios list: venue cards sorted by class count. Filters (date window, skill level) work.
5. Studio "View all →" → schedule with series deduplication
6. Series classes show schedule pattern ("Tuesdays & Thursdays, 6–8 PM")
7. One-off workshops show single date
8. Back navigation works at each level
9. Search bar: typing a query shows flat results
10. Map view: studio pins render, tap → popup card → studio schedule
11. Mobile (375px): 2-column category grid, stacked studios list, full-width schedule
12. Empty states render correctly at each level
13. Explore Home: Classes lane shows alive state with preview items (not "Coming soon")
14. URL params sync correctly at each navigation level
