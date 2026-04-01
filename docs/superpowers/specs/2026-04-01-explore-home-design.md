# Explore Home — Dashboard Wayfinding Surface

## Context

The Find tab (`?view=find`) is LostCity's unified discovery surface — events, showtimes, venues, regulars, and alternate modalities (calendar, map) all live behind lane-based navigation. The restructure spec (2026-03-31) defines the shell architecture: sidebar on desktop, chip bar on mobile, lane renderers in the content area.

What's missing is a compelling **launchpad** — the experience when no lane is selected. The current implementation is a basic teaser grid. This spec defines Explore Home: a dashboard wayfinding surface that helps people find the right discovery lane through alive/quiet preview sections.

### What Explore Home Is

A tasting menu. Each lane gets a preview that communicates "here's what's behind this door and why you'd care right now." Enough to hook, not enough to consume. The Feed is the content surface; Explore Home is the wayfinding surface.

### What Explore Home Is Not

- Not a recommendation engine. No personalization, no scoring-based exclusion.
- Not a second Feed. No editorial voice, no curated sections, no contextual storytelling.
- Not the navigation itself. The sidebar (desktop) and chip bar (mobile) handle lane-switching. Explore Home helps you make the first choice.

---

## Lanes

Nine content lanes in fixed order. Order never changes between visits — liveness affects content state only, never position.

| # | Lane | Slug | Renderer | Status |
|---|------|------|----------|--------|
| 1 | Events | `events` | EventsFinder | Existing |
| 2 | Now Showing | `now-showing` | WhatsOnView (film) | Existing |
| 3 | Live Music | `live-music` | WhatsOnView (music) | Existing |
| 4 | Stage & Comedy | `stage` | WhatsOnView (stage) | Existing |
| 5 | Regulars | `regulars` | RegularsView | Existing |
| 6 | Places | `places` | PortalSpotsView | Existing |
| 7 | Classes & Workshops | `classes` | ClassesView | **New — needs renderer** |
| 8 | Calendar | `calendar` | EventsFinder (calendar mode) | Existing |
| 9 | Map | `map` | EventsFinder (map mode) | Existing |

**Search** is not a lane. It is a header-level element — persistent search bar above the grid on desktop, pinned magnifying glass chip in the mobile chip bar. Search results are grouped by content type with "See all in [lane] →" links, serving as a crossroads into lanes.

---

## Section Anatomy

All lanes share one unified section format. Lane-specific *content* (movie posters, venue photos, artist names) provides visual variety. The container is consistent everywhere.

### Alive State

A lane is alive when it has content happening today/tonight or this weekend.

```
┌─────────────────────────────────────────────────┐
│  LANE NAME                         TONIGHT · 12  │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │  image   │  │  image   │  │  image   │   ...   │
│  │         │  │         │  │         │          │
│  │  Title   │  │  Title   │  │  Title   │          │
│  │  meta    │  │  meta    │  │  meta    │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│                                                   │
│                              Explore Events →     │
└─────────────────────────────────────────────────┘
```

- Section header: lane name (left) + liveness badge (right) — e.g., "TONIGHT · 12" in coral, "THIS WEEKEND · 28" in accent green
- 3-5 preview items in a horizontal strip, consistent card format: image/icon, title, one metadata line
- "Explore [Lane] →" link at bottom-right
- Card content is lane-native: Events show event image + title + venue + time. Now Showing shows poster + film title + showtime count. Places show venue photo + name + neighborhood. Etc.

### Quiet State

A lane is quiet when it has content but nothing imminent (no today/weekend activity above threshold).

```
┌─────────────────────────────────────────────────┐
│  LANE NAME                                       │
│                                                   │
│  3 productions running this week                 │
│  — tickets available                    Browse → │
│                                                   │
└─────────────────────────────────────────────────┘
```

- Same section footprint as alive — not compressed, not hidden
- No preview items. Honest count with good copy that frames the content positively.
- "Browse →" link

### Zero State

A lane has no content at all (e.g., Classes lane during early data build-out).

```
┌─────────────────────────────────────────────────┐
│  CLASSES & WORKSHOPS                             │
│                                                   │
│  Coming soon — know a great class?      Tell us →│
│                                                   │
└─────────────────────────────────────────────────┘
```

- Single-line CTA encouraging community contribution, or "Coming soon" if no submission path exists
- Same section footprint, minimal height

---

## Layout

### Desktop (lg+)

```
┌──────────┬──────────────────────────────────────────┐
│          │  [🔍 Search bar                        ]  │
│ EXPLORE  │                                           │
│          │  ┌──────────────────┐ ┌────────────────┐  │
│ BROWSE   │  │    Events        │ │  Now Showing   │  │
│ Events   │  │    (alive)       │ │  (alive)       │  │
│ Film     │  └──────────────────┘ └────────────────┘  │
│ Music    │  ┌──────────────────┐ ┌────────────────┐  │
│ Stage    │  │  Live Music      │ │  Stage         │  │
│ Regulars │  │  (alive)         │ │  (quiet)       │  │
│ Places   │  └──────────────────┘ └────────────────┘  │
│ Classes  │  ┌──────────────────┐ ┌────────────────┐  │
│          │  │  Regulars        │ │  Places        │  │
│ VIEWS    │  │  (alive)         │ │  (alive)       │  │
│ Calendar │  └──────────────────┘ └────────────────┘  │
│ Map      │  ┌──────────────────┐ ┌────────────────┐  │
│          │  │  Classes         │ │  Calendar      │  │
│          │  │  (zero)          │ │  (alive)       │  │
│          │  └──────────────────┘ └────────────────┘  │
│          │  ┌──────────────────┐                     │
│          │  │  Map (quiet)     │                     │
│          │  └──────────────────┘                     │
└──────────┴──────────────────────────────────────────┘
```

- Sidebar always visible, fixed to viewport (per restructure spec: 240px, `position: fixed`, below header)
- Content area: fixed 2-column grid. All sections same cell width. No column-spanning.
- Fixed order always — lanes 1-9 fill left-to-right, top-to-bottom
- Search bar spans full content width above the grid
- Sidebar shows lane names with liveness indicators (dot or count badge)

### Mobile

```
┌─────────────────────────────┐
│  [🔍 Search bar           ] │
│                              │
│  ┌────────────────────────┐  │
│  │  Events (alive)        │  │
│  │  preview items...      │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Now Showing (alive)   │  │
│  │  preview items...      │  │
│  └────────────────────────┘  │
│  ┌────────────────────────┐  │
│  │  Live Music (alive)    │  │
│  │  preview items...      │  │
│  └────────────────────────┘  │
│  ...                         │
└─────────────────────────────┘
```

- Single column, stacked. Fixed order.
- No chip bar on Explore Home — preview sections serve as navigation entry points
- Chip bar appears when user enters a lane (per restructure spec)
- All 9 lanes in horizontally scrollable chip bar, no overflow tricks
- "Explore" home chip pinned left in chip bar

---

## Navigation

### Airlock Model

Explore Home is the entry point. Once you enter a lane, the sidebar/chip bar takes over for lane-switching.

**Entering a lane:**
1. User clicks a preview section's "Explore [Lane] →" link, or clicks a sidebar lane (desktop), or taps a preview section (mobile)
2. Content area transitions to the lane renderer (per restructure spec)
3. URL updates to `?view=find&lane={slug}`
4. Mobile: chip bar appears
5. Sidebar: active lane highlighted

**Returning to Explore Home:**
- Desktop: click "Explore" at top of sidebar (with ← arrow affordance)
- Mobile: tap "Explore" home chip (first chip, pinned left)
- Browser back works naturally (URL-driven)
- Explore Home refetches display priority data on return — content states may have shifted

**Preview item taps:** Tapping a specific item within a preview (e.g., a movie poster, an event card) navigates to that item's detail page, NOT to the lane. The "Explore [Lane] →" link enters the lane. On mobile, the section header is also a tap target that enters the lane — this is the primary mobile navigation affordance since "Explore →" links may be below the fold within a section.

---

## Display Priority (Liveness)

Server-computed per lane. Affects content state only — never position, never size.

### Scoring

| Signal | Weight |
|--------|--------|
| Has content today/tonight | +3 |
| Has content this weekend | +2 |
| Item count above lane threshold | +1 |
| Time-of-day boost (inherits CityPulse time slots: morning/midday/happy_hour/evening/late_night) | +0-2 |

- Time-of-day boost: Live Music and Stage score higher during evening/late_night. Events and Places score higher during morning/midday. Regulars scores higher during happy_hour.
- Each lane has a threshold for "alive" — a minimum score below which it renders in quiet state.
- Zero items = zero state, regardless of score.

### What It Drives

| State | Condition | Rendering |
|-------|-----------|-----------|
| Alive | Score ≥ lane threshold | Section header + liveness badge + 3-5 preview items + "Explore →" link |
| Quiet | Score > 0, below threshold | Section header + count copy + "Browse →" link |
| Zero | No items | Section header + CTA or "Coming soon" |

---

## Data Architecture

### API Endpoint

`GET /api/explore/home`

**Parameters:** Portal-scoped (portal slug from route context).

**Cache:** `Cache-Control: public, s-maxage=120, stale-while-revalidate=300`
- Cache key: `${portalSlug}|${timeSlot}|${today}`
- Time slots inherited from CityPulse: morning, midday, happy_hour, evening, late_night
- 2-minute freshness, 5-minute stale-while-revalidate

**Response shape:**

```typescript
interface ExploreHomeResponse {
  lanes: {
    events: LanePreview;
    now_showing: LanePreview;
    live_music: LanePreview;
    stage: LanePreview;
    regulars: LanePreview;
    places: LanePreview;
    classes: LanePreview;
    calendar: LanePreview;
    map: LanePreview;
  };
}

interface LanePreview {
  state: 'alive' | 'quiet' | 'zero';
  count: number;               // total items in lane
  count_today: number | null;  // items today (null if not applicable)
  count_weekend: number | null;
  copy: string;                // server-generated quiet-state copy, e.g., "3 productions running"
  items: PreviewItem[];        // 3-5 items if alive, empty if quiet/zero
}

interface PreviewItem {
  id: string;
  type: 'event' | 'showtime' | 'place' | 'regular' | 'class';
  title: string;
  subtitle: string;           // venue name, neighborhood, etc.
  image_url: string | null;
  metadata: string;           // "Tonight 8pm", "3 showtimes", "Tuesdays", etc.
  detail_url: string;         // deep link to item detail
}
```

**Key decisions:**
- Server computes `state` and `copy` — client just renders what it's told.
- `PreviewItem` is a unified type. Lane-specific content is expressed through the content of the fields, not the shape.
- Calendar day-counts, map pin/cluster data, and search trending queries are NOT in this payload. They load when the user enters those lanes.
- One Supabase RPC call. Runs lane queries in parallel server-side.

### Loading States

- Lane list is known statically — skeleton renders immediately with 9 section placeholders (header + shimmer cards)
- Sidebar and search bar render outside Suspense (per restructure spec)
- Content grid is inside Suspense with skeleton fallback
- On refetch (returning to Explore Home), stale data renders instantly while fresh data loads (stale-while-revalidate)

---

## Classes & Workshops Lane

New lane requiring a new renderer (`ClassesView`). Scoped separately from Events because the discovery intent is different — users are committing to something, often recurring, often with registration deadlines.

**Preview on Explore Home:** Same card anatomy as other lanes. Cards show: class image, class title, instructor/organization, schedule pattern ("Saturdays in April").

**Full lane experience (ClassesView):** Deferred to a separate spec. At minimum:
- Filter by category (art, fitness, cooking, music, etc.)
- Filter by schedule (weekday/weekend, morning/evening)
- Registration status indicator (open/closing soon/waitlist)
- Sort by start date

**Data dependency:** Requires crawlers to classify events as classes/workshops and extract schedule + registration metadata. Data readiness determines when this lane goes alive vs. shows zero state.

---

## Relationship to Existing Specs

This spec **replaces** the "Launchpad" section of the Explore Page Restructure spec (2026-03-31). Specifically:

- Restructure spec line 63-68 ("Launchpad — No Lane Selected"): replaced by this Explore Home design
- All other sections of the restructure spec remain unchanged: shell architecture, sidebar, chip bar, lane renderers, URL scheme, component hierarchy, backward compatibility

The restructure spec should be updated to reference this document for the launchpad definition.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. Desktop: sidebar visible on Explore Home. All 9 lane sections visible in fixed 2-column grid.
3. Desktop: alive sections show preview items with liveness badge. Quiet sections show count copy. Zero sections show CTA.
4. Desktop: search bar spans full content width above grid
5. Desktop: click "Explore [Lane] →" link → enters lane, sidebar highlights active lane
6. Desktop: click preview item → navigates to item detail, not to lane
7. Desktop: click "Explore" in sidebar → returns to Explore Home
8. Mobile: single-column stacked layout. No chip bar visible.
9. Mobile: tap preview section → enters lane, chip bar appears with all 9 lanes scrollable
10. Mobile: tap "Explore" home chip → returns to Explore Home, chip bar hides
11. API: `/api/explore/home` returns all 9 lanes with correct state/items. Response < 500ms.
12. API: cache respects time-slot transitions (happy_hour → evening busts cache)
13. Returning to Explore Home shows updated content states (alive lane may have gone quiet)
14. Zero-state lanes show CTA, not empty sections
