# What's On Lane — Design Spec (v3)

## Context

The Find tab has a "What's On" concept (`WhatsOnView`) that currently orchestrates Film/Music/Stage as separate sub-views. The feed has a VENUES widget (`VenuesSection.tsx`) with 7 tabs (Film, Music, Comedy, Theater, Nightlife, Arts, Attractions) showing venue-grouped content. The feed → Find connection is broken — "See all" links point to the legacy HappeningView instead of Find lanes.

**Live bug**: The Stage & Comedy lane currently shows the same content as Live Music (rock concerts with genre chips). It doesn't filter to theater/comedy at all.

This spec consolidates all venue-based entertainment into a single **"What's On"** lane with 5 sub-tabs, fixes the live bug, upgrades to venue-grouped layouts, and routes feed "See all" links correctly.

---

## What This Builds

1. **"What's On" lane** — single sidebar entry with 5 sub-tabs: Film | Music | Theater | Comedy | Game Day
2. **Venue-grouped upgrades** — Music, Theater, Comedy use venue-grouped shows (mirrors feed VENUES widget)
3. **Game Day tab** — calendar-first timeline with team filter chips, game cards (schedule-only for v1)
4. **Feed routing** — all VENUES widget tabs → correct Find lane/tab
5. **Sidebar consolidation** — Now Showing + Live Music + Stage & Comedy → "What's On" (reduces sidebar from 11 to 9 items)

### Sidebar After

```
BROWSE
  Events
  What's On        → Film | Music | Theater | Comedy | Game Day
  Regulars
  Places
  Classes

VIEWS
  Calendar
  Map
```

7 browse + 2 views = 9 total (was 11 with separate show lanes).

---

## Architecture: WhatsOnView as Tab Orchestrator

The existing `WhatsOnView` component already orchestrates Film/Music/Stage tabs. This spec extends it to 5 tabs and upgrades each tab's renderer.

### URL Scheme

```
?view=find&lane=whats-on                        → default tab (Film)
?view=find&lane=whats-on&tab=film                → Film showtimes
?view=find&lane=whats-on&tab=music               → Live music
?view=find&lane=whats-on&tab=theater             → Theater/dance
?view=find&lane=whats-on&tab=comedy              → Comedy
?view=find&lane=whats-on&tab=game-day            → Game Day
```

**Backward compat** (in normalize-find-url.ts):
- `?view=find&lane=now-showing` → `?view=find&lane=whats-on&tab=film`
- `?view=find&lane=live-music` → `?view=find&lane=whats-on&tab=music`
- `?view=find&lane=stage` → `?view=find&lane=whats-on&tab=theater`
- `?view=happening&content=showtimes` → `?view=find&lane=whats-on`
- `?view=happening&content=showtimes&vertical=film` → `?view=find&lane=whats-on&tab=film`
- `?view=happening&content=showtimes&vertical=music` → `?view=find&lane=whats-on&tab=music`

### Tab Bar

Horizontal tab strip below the lane header. Matches the feed VENUES widget's tab style.

```
┌──────────────────────────────────────────────────────┐
│  [Film]  [Music]  [Theater]  [Comedy]  [Game Day]    │
└──────────────────────────────────────────────────────┘
```

Active tab highlighted with accent underline. Tabs scroll horizontally on mobile if needed.

### Tab → Renderer Mapping

| Tab | Renderer | Data Source |
|-----|----------|-------------|
| Film | `ShowtimesView` (existing, 825 lines, production-ready) | `/api/showtimes` |
| Music | `MusicListingsView` (upgrade to venue-grouped) | `/api/whats-on/music` |
| Theater | `TheaterListingsView` (rename + upgrade from StageListingsView) | `/api/whats-on/stage?filter=theater` |
| Comedy | `ComedyListingsView` (new) | `/api/whats-on/stage?filter=comedy` |
| Game Day | `GameDayView` (new) | `/api/portals/[slug]/game-day` |

Each renderer is lazy-loaded via `dynamic()`. The tab bar persists (not inside Suspense).

---

## Tab 1: Film (ShowtimesView — No Changes)

Already production-ready at 825 lines. Theater-grouped showtimes with date pills, by-theater/by-movie toggle, theater customizer. No changes needed.

---

## Tab 2: Music — Venue-Grouped Upgrade

Upgrade `MusicListingsView` from flat list to venue-grouped shows mirroring the feed VENUES Music tab.

### Content

**Date navigation**: Horizontal date pill strip (7 days forward). Tonight is default.

**Genre filter chips**: All (default) | Rock | Hip-Hop | Jazz | Electronic | R&B | Country | Latin. Each chip shows count for selected date: "Jazz (4)". Counts computed client-side.

**Venue-grouped shows**: Each venue with shows on the selected date:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Terminal West                         │
│                 Westside · 3 shows tonight            │
│                                                       │
│  8:00 PM  Blackberry Smoke           $25  Tickets →  │
│           Rock · 21+                                  │
│  9:30 PM  DJ Logic                   $15  Tickets →  │
│           Electronic                                  │
│  11:00 PM Late Night Jazz Jam       Free              │
│           Jazz · All Ages                             │
└──────────────────────────────────────────────────────┘
```

- Venue image (from places table) with `IconBox` fallback (music icon, magenta tint)
- Venue name, neighborhood, show count
- Shows chronological within venue: time, artist/title, price, ticket link
- Genre badges on individual shows
- Age policy when available

**Visual differentiation**: Magenta accent (`var(--neon-magenta)`). Genre badges prominent. Artist names as primary text.

**Sort**: Venues by show count descending. Shows by time within venue.

**URL sync**: `&date=2026-04-05&genre=jazz` via `window.history.replaceState`.

**Empty state**: "No live music on {date}. Check the weekend — that's when the city comes alive." with shortcuts to Friday/Saturday.

**Loading skeleton**: 3 venue cards with shimmer.

### API

Existing `/api/whats-on/music` already returns venue-grouped data. The current `MusicListingsView` flattens it. The upgrade uses the grouped structure directly.

---

## Tab 3: Theater — Rename + Venue-Grouped Upgrade

Rename `StageListingsView` → `TheaterListingsView`. Filter to theater/dance content (not comedy).

### Content

**Date navigation**: Same date pill strip.

**Category filter chips**: All (default) | Drama | Musical | Dance | Improv. With counts.

**Venue-grouped productions**:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Alliance Theatre                      │
│                 Midtown · 2 productions               │
│                                                       │
│  7:30 PM  The Lehman Trilogy          $45  Tickets → │
│           Drama · Runs through Apr 30                 │
│  2:00 PM  School Matinee             $15  Tickets → │
│           Musical · Today only                        │
└──────────────────────────────────────────────────────┘
```

Key difference from Music: Theater productions run for weeks. Show the run period ("Runs through Apr 30" or "Final weekend" or "Today only"). This info comes from `start_date`/`end_date` on the event.

**Visual differentiation**: Cyan accent (`var(--neon-cyan)`). Run period badges prominent. Production title as primary text (not artist name).

**Sort, URL sync, empty state, skeleton**: Same patterns as Music.

### API

Existing `/api/whats-on/stage` with `?filter=theater` to filter to `category_id IN ('theater', 'dance')`. **Note**: The API's `STAGE_CATEGORIES` currently excludes `dance` — needs to be added to the theater filter path.

---

## Tab 4: Comedy — New

Separate from Theater because comedy has distinct venues (comedy clubs, improv theaters), distinct formats (stand-up vs improv vs open mic), and is a separate tab in the feed VENUES widget.

### Content

**Date navigation**: Same date pill strip.

**Format filter chips**: All (default) | Stand-Up | Improv | Open Mic. With counts.

**Venue-grouped shows**:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Laughing Skull Lounge                 │
│                 Midtown · 3 shows tonight             │
│                                                       │
│  7:00 PM  Open Mic Night            Free              │
│           Open Mic · Weekly                           │
│  8:30 PM  Best of Atlanta Comedy    $20  Tickets →   │
│           Stand-Up                                    │
│  10:00 PM Late Show                 $15  Tickets →   │
│           Stand-Up · 21+                              │
└──────────────────────────────────────────────────────┘
```

**Visual differentiation**: Gold accent (`var(--gold)`). Format badges (Stand-Up/Improv/Open Mic) as the primary metadata. Warm, spotlight energy.

**Sort, URL sync, empty state, skeleton**: Same patterns as Music.

### API

Same `/api/whats-on/stage` endpoint with `?filter=comedy` to filter to `category_id = 'comedy'`.

---

## Tab 5: Game Day — New (Schedule-Only for V1)

Calendar-first timeline of upcoming games. Hub model (tailgates/watch parties) deferred to V2 — requires crawler tag infrastructure that doesn't exist yet.

### V1 Content

**Team filter chips**: Horizontal scrollable. All (default) | Hawks | United | Braves | Falcons | Dream | + minor/college teams. Each chip shows team logo (16px) + short name. Active chip highlighted in team's accent color.

Team metadata from `web/lib/teams-config.ts`.

**Date grouping**: Games grouped by day ("Tonight", "Tomorrow", "Friday Apr 4"). Within each day, sorted by time.

**Game cards**:

```
┌──────────────────────────────────────────────────────┐
│  [team logo]  Hawks vs Celtics                        │
│               State Farm Arena · 7:30 PM              │
│               NBA                        Tickets →   │
└──────────────────────────────────────────────────────┘
```

Simple, clean game card. Team logo, opponent, venue, time, league badge, ticket link.

**Visual differentiation**: Each game card tinted with the home team's accent color at low opacity. Trophy icon for the tab. Coral accent (`var(--coral)`) for the lane.

**Empty state**: "No games scheduled this week." Seasonal: "Season starts {date}" if we have that data.

**Loading skeleton**: 3 game cards with shimmer.

### V2 (Future — when tag data exists)

Game-as-hub: below each game card, show satellite events (tailgates, watch parties, after-parties) grouped by type. Requires crawlers producing context tags: `tailgate`, `watch-party`, `pre-game`, `after-party`. Only build when data audit confirms these tags exist with meaningful volume.

### URL

```
?view=find&lane=whats-on&tab=game-day              → all teams
?view=find&lane=whats-on&tab=game-day&team=hawks    → Hawks filter
```

### API

Existing `/api/portals/[slug]/game-day` returns team schedules. No changes needed for V1.

---

## Feed "See All" Routing

Update the VENUES widget (`VenuesSection.tsx`) "See all" links for each tab:

| Feed Tab | New "See All" URL |
|----------|-------------------|
| Film | `?view=find&lane=whats-on&tab=film` |
| Music | `?view=find&lane=whats-on&tab=music` |
| Comedy | `?view=find&lane=whats-on&tab=comedy` |
| Theater | `?view=find&lane=whats-on&tab=theater` |
| Nightlife | `?view=find&lane=places&venue_type=bar,nightclub,lounge` |
| Arts | `?view=find&lane=places&venue_type=museum,gallery,arts_center,theater` |
| Attractions | `?view=find&lane=places&venue_type=arcade,attraction,entertainment,escape_room,bowling,zoo,aquarium` |

Also update:
- `GameDaySection.tsx` "See all" → `?view=find&lane=whats-on&tab=game-day`
- `NowShowingSection.tsx` "See all" → `?view=find&lane=whats-on&tab=film`

**Nightlife/Arts/Attractions note**: These route to Places with `venue_type` filter (not `vertical` — SpotsFinder doesn't support that param). This is a context shift from temporal (feed shows tonight's events) to spatial (Places shows all venues). Acceptable for V1 but noted as a future improvement — could add a `with_events=true` default filter.

### Files to update:
- `web/components/feed/sections/VenuesSection.tsx` — all tab "See all" links
- `web/components/feed/sections/NowShowingSection.tsx` — Film "See all"
- `web/components/feed/sections/GameDaySection.tsx` — Game Day "See all"
- `web/lib/normalize-find-url.ts` — backward compat mappings

---

## Sidebar + Chip Bar + Explore Home

### Sidebar

Consolidate show lanes into "What's On":

```
BROWSE
  Events
  What's On        ← consolidation of Now Showing + Live Music + Stage & Comedy + Game Day
  Regulars
  Places
  Classes

VIEWS
  Calendar
  Map
```

Icon: `Television` from Phosphor (represents "what's on"). Accent: `var(--coral)`.

Remove: Now Showing, Live Music, Stage & Comedy as separate sidebar entries.

### MobileLaneBar

Replace 4 show chips with 1 "What's On" chip: `{ id: "whats-on", label: "What's On", accent: "var(--coral)", href: "?view=find&lane=whats-on" }`

Remove: now-showing, live-music, stage chips.

New chip order: Events | What's On | Regulars | Places | Classes | Calendar | Map = **7 chips** (was 9, will be 11 without consolidation).

### FindShellClient

- Add `"whats-on"` to `SHELL_LANES`
- Keep legacy lane IDs (`now-showing`, `live-music`, `stage`) in SHELL_LANES temporarily for backward compat — they render the same `WhatsOnView` component
- Remove separate WhatsOnView conditional renders for now-showing/live-music/stage — replace with single `whats-on` render that passes the `tab` param
- Or: normalize legacy lane IDs to `whats-on` + tab in the URL normalization layer

### Explore Home

The Explore Home dashboard currently has separate sections for Events, Now Showing, Live Music, and Stage & Comedy. Consolidate into a single "What's On" section:

- **Alive state**: Shows a mixed preview — 1-2 film showtimes + 1-2 music shows + a game if today. Communicates breadth of what's on.
- **Liveness badge**: Combined count of tonight's shows + games
- **"Explore What's On →"** footer link

Update `explore-lane-meta.ts`:
```typescript
"whats-on": { label: "WHAT'S ON", mobileLabel: "What's On", accent: "var(--coral)", href: "?view=find&lane=whats-on", zeroCta: "" },
```

Remove separate now-showing, live-music, stage lane entries from meta and data fetcher. Replace with single `whats-on` lane.

Update `LaneSlug` type: remove `now-showing`, `live-music`, `stage`. Add `whats-on`.

**Explore Home section count drops from 9 to 7** (Events, What's On, Regulars, Places, Classes, Calendar, Map).

---

## Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| `WhatsOnView` | `web/components/find/WhatsOnView.tsx` | **Extend** — tab orchestrator for 5 tabs |
| `ShowtimesView` | `web/components/find/ShowtimesView.tsx` | Film tab (no changes) |
| `MusicListingsView` | `web/components/find/MusicListingsView.tsx` | **Upgrade** — venue-grouped music |
| `TheaterListingsView` | `web/components/find/TheaterListingsView.tsx` | **Rename** from StageListingsView, venue-grouped |
| `ComedyListingsView` | `web/components/find/ComedyListingsView.tsx` | **New** — venue-grouped comedy |
| `GameDayView` | `web/components/find/GameDayView.tsx` | **New** — team-filtered game schedule |
| `VenueShowsCard` | `web/components/find/shows/VenueShowsCard.tsx` | Shared venue card for Music/Theater/Comedy |
| `ShowRow` | `web/components/find/shows/ShowRow.tsx` | Individual show row — uses render prop for lane-specific metadata |
| `GameCard` | `web/components/find/gameday/GameCard.tsx` | Game card with team logo and venue |
| `TeamChip` | `web/components/find/gameday/TeamChip.tsx` | Team filter chip with logo |

### VenueShowsCard + ShowRow

Shared between Music, Theater, and Comedy. The venue card container is identical. The show row uses a **render prop** (`renderMeta`) for lane-specific metadata:
- Music: genre badge + age policy
- Theater: run period badge
- Comedy: format badge (Stand-Up/Improv/Open Mic)

This avoids a string `variant` prop that would calcify as lanes diverge.

---

## API Changes Needed

1. **`/api/whats-on/stage`**: Add `dance` to the theater filter path. When `?filter=theater` is passed, query `category_id IN ('theater', 'dance')`. When `?filter=comedy`, query `category_id = 'comedy'`. Currently `STAGE_CATEGORIES` only has `['comedy', 'theater']`.

2. **No new endpoints needed** for V1. Film, Music, Stage, and Game Day APIs all exist.

3. **Places routing**: SpotsFinder needs to read `venue_type` from URL search params on mount and initialize the venue type filter. Check if this already works — if not, add URL param initialization.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. **What's On tab bar**: 5 tabs render, switching works, active tab highlighted
3. **Film tab**: ShowtimesView renders unchanged (regression check)
4. **Music tab**: venue-grouped shows, genre chips with counts, date nav, URL sync
5. **Theater tab**: venue-grouped productions with run periods, category chips
6. **Comedy tab**: venue-grouped comedy shows, format chips (Stand-Up/Improv/Open Mic)
7. **Game Day tab**: team chips, date-grouped game cards, team filtering
8. **Feed routing**: VENUES widget Film/Music/Comedy/Theater tabs → correct What's On tab
9. **Feed routing**: VENUES widget Nightlife/Arts/Attractions → Places with venue_type
10. **Feed routing**: GameDaySection → What's On Game Day tab
11. **Sidebar**: "What's On" single entry, old show lanes removed
12. **Mobile chip bar**: 7 chips (down from 9+), "What's On" present
13. **Explore Home**: Single "What's On" section replaces 3 separate show sections
14. **Backward compat**: `?lane=now-showing`, `?lane=live-music`, `?lane=stage` all redirect correctly
15. **Empty states**: all 5 tabs handle no-data gracefully
16. **Mobile (375px)**: venue cards full-width, tab bar scrollable, game cards readable
17. **Stage & Comedy bug fixed**: Theater tab shows theater/dance, Comedy tab shows comedy (not rock concerts)
