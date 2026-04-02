# Shows & Game Day Lanes — Design Spec

## Context

The Find tab has 3 showtime lanes (Now Showing, Live Music, Stage & Comedy) and no Game Day lane. Now Showing is production-ready (825-line ShowtimesView). Live Music and Stage are functional but basic — flat list views that don't mirror the feed's venue-grouped "See Shows" experience. The feed's "See all" links still point to the legacy HappeningView instead of the Find shell lanes.

This spec upgrades Live Music, splits Stage & Comedy into separate Theater and Comedy lanes, adds a Game Day lane for sports, and routes all feed "See all" links to the correct Find lanes — including Nightlife/Arts/Attractions routing to the Places lane.

The feed's VENUES widget has 7 tabs (Film, Music, Comedy, Theater, Nightlife, Arts, Attractions). Each tab's "See all" should land in the appropriate Find lane:

| Feed Tab | Find Lane Destination |
|----------|----------------------|
| Film | Now Showing (existing, production-ready) |
| Music | Live Music (upgrade) |
| Comedy | Comedy (new lane, split from Stage & Comedy) |
| Theater | Theater (rename from Stage & Comedy, upgrade) |
| Nightlife | Places lane → `?view=find&lane=places&vertical=nightlife` |
| Arts | Places lane → `?view=find&lane=places&vertical=arts` |
| Attractions | Places lane → `?view=find&lane=places&vertical=entertainment` |
| Game Day | Game Day (new lane) |

---

## What This Builds

1. **Live Music lane** — upgrade from flat list to venue-grouped shows (mirrors feed Music tab)
2. **Theater lane** — rename from "Stage & Comedy", upgrade to venue-grouped productions (mirrors feed Theater tab)
3. **Comedy lane** — new lane, split from Stage & Comedy (mirrors feed Comedy tab)
4. **Game Day lane** — new lane with calendar-first timeline, team filter chips, game-as-hub grouping
5. **Feed routing** — update all VENUES widget "See all" links to correct Find lanes
6. **Sidebar + chip bar + Explore Home** — add Comedy and Game Day, rename Stage & Comedy → Theater

---

## Live Music Lane — Venue-Grouped Upgrade

Currently `MusicListingsView` (151 lines) renders a flat date-by-date list. The feed's "See Shows" Music tab uses `PlaceGroupedShowsList` which groups by venue. The lane should be the deep version of that feed widget.

### Landing (`?view=find&lane=live-music`)

**Date navigation**: Horizontal date pill strip (7 days forward, same as current). Tonight is default.

**Genre filter chips**: All (default) | Rock | Hip-Hop | Jazz | Electronic | R&B | Country | Latin. Each chip shows count for selected date: "Jazz (4)". Counts computed client-side from fetched data.

**Venue-grouped shows**: Each venue that has shows on the selected date appears as a card:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Terminal West                         │
│                 Westside · 3 shows tonight            │
│                                                       │
│  8:00 PM  Blackberry Smoke           $25  Tickets →  │
│  9:30 PM  DJ Logic                   $15  Tickets →  │
│  11:00 PM Late Night Jazz Jam       Free              │
└──────────────────────────────────────────────────────────┘
```

- Venue image (from places table), name, neighborhood, show count
- Shows listed chronologically within the venue
- Each show: time, artist/title, price, ticket link (if available)
- Genre badges on individual shows when "All" genre is active

**Sort**: Venues sorted by show count descending (busiest first). Within venue, shows sorted by time.

**URL sync**: `&date=2026-04-05&genre=jazz` via `window.history.replaceState`.

**Empty state**: "No live music on {date}. Check the weekend — that's when the city comes alive." with shortcuts to Friday/Saturday.

**Loading skeleton**: 3 venue cards with shimmer.

### API

Existing `/api/whats-on/music` already returns venue-grouped data. The current `MusicListingsView` flattens it. The upgrade uses the grouped structure directly.

---

## Theater Lane — Venue-Grouped Upgrade

Renamed from "Stage & Comedy." Comedy becomes its own lane (see below). Theater covers plays, musicals, dance, and dramatic performances.

### Landing (`?view=find&lane=theater`)

**Date navigation**: Same date pill strip.

**Category filter chips**: All (default) | Drama | Musical | Dance | Improv. With counts.

**Venue-grouped productions**: Each venue with shows on the selected date:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Alliance Theatre                      │
│                 Midtown · 2 shows tonight             │
│                                                       │
│  7:30 PM  The Lehman Trilogy          $45  Tickets → │
│           Drama · Runs through Apr 30                 │
│  2:00 PM  School Matinee             $15  Tickets → │
│           Musical · Today only                        │
└──────────────────────────────────────────────────────────┘
```

Key difference from Music: Theater productions often run for weeks. Show the run period ("Runs through Apr 30" or "Today only" or "Fri-Sun through May 15"). This info comes from `start_date`/`end_date` on the event.

**Sort, URL sync, empty state, skeleton**: Same patterns as Live Music.

### API

Existing `/api/whats-on/stage` already returns the data. Filter to `category_id IN ('theater', 'dance')` — excluding comedy (which gets its own lane). The lane slug changes from `stage` to `theater` but the API can stay the same with a category filter param.

### URL

```
?view=find&lane=theater                    → all theater
?view=find&lane=theater&date=2026-04-05    → specific date
```

**Backward compat**: `?view=find&lane=stage` redirects to `?view=find&lane=theater` via normalize-find-url.ts.

---

## Comedy Lane — New (Split from Stage & Comedy)

Comedy gets its own lane because it has distinct venues (comedy clubs, improv theaters), distinct browsing patterns (open mics vs headliner shows vs improv nights), and is a separate tab in the feed's VENUES widget.

### Landing (`?view=find&lane=comedy`)

**Date navigation**: Same date pill strip.

**Category filter chips**: All (default) | Stand-Up | Improv | Open Mic. With counts.

**Venue-grouped shows**: Same card pattern as Music and Theater:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Laughing Skull Lounge                 │
│                 Midtown · 3 shows tonight             │
│                                                       │
│  7:00 PM  Open Mic Night            Free              │
│           Open Mic · Weekly                           │
│  8:30 PM  Best of Atlanta Comedy    $20  Tickets →   │
│           Stand-Up · Tonight only                     │
│  10:00 PM Late Show                 $15  Tickets →   │
│           Stand-Up                                    │
└──────────────────────────────────────────────────────────┘
```

**Sort, URL sync, empty state, skeleton**: Same patterns as Music.

### API

Same `/api/whats-on/stage` endpoint but filtered to `category_id = 'comedy'`. Or a new `/api/whats-on/comedy` if the filtering needs to be server-side.

### URL

```
?view=find&lane=comedy                     → all comedy
?view=find&lane=comedy&date=2026-04-05     → specific date
```

---

## Game Day Lane — New

### Landing (`?view=find&lane=game-day`)

Calendar-first timeline with team filter chips. Default shows all teams, all upcoming games.

**Team filter chips**: Horizontal scrollable. All (default) | Hawks | United | Braves | Falcons | Dream | + minor/college teams. Each chip shows team logo (small, 16px) + short name. Active chip highlighted in team's accent color.

Team metadata comes from `web/lib/teams-config.ts` which already has slugs, sport, league, accent colors, logos, tags, and source slugs.

**Date grouping**: Games grouped by day ("Tonight", "Tomorrow", "Friday Apr 4", etc.). Within each day, games sorted by time.

**Game-as-hub**: Each game is a hub card that collects its satellite events:

```
┌──────────────────────────────────────────────────────┐
│  TONIGHT                                              │
│                                                       │
│  [Hawks logo]  Hawks vs Celtics                       │
│                State Farm Arena · 7:30 PM             │
│                                        Tickets →     │
│                                                       │
│  🍖 Tailgate (2)                                     │
│     Hawks Pregame Party · Lot 1 · 5:00 PM            │
│     ATL Tailgate Co · Lot 3 · 5:30 PM               │
│                                                       │
│  📺 Watch Parties (5)                                │
│     Stats Brewpub · Midtown · 7:00 PM                │
│     Hudson Grille · Brookhaven · 7:00 PM             │
│     +3 more                                    See all│
│                                                       │
│  🎶 After-Party                                      │
│     Hawks After Dark · Terminal West · 10 PM          │
└──────────────────────────────────────────────────────────┘
```

**Hub sections**:
1. **The Game** — the actual event at the venue, with ticket link
2. **Tailgate / Pre-Game** — events tagged as tailgate/pre-game, temporally before the game, geographically near the venue
3. **Watch Parties** — events tagged as watch-party for this game's team, same date
4. **After-Party / Post-Game** — events tagged as after-party or starting 1+ hours after game time

**Matching logic**: Related events are matched to games by:
- Same team tag (e.g., "hawks") + same date
- Event tags include context tags: "tailgate", "watch-party", "pre-game", "after-party", "game-day"
- Temporal proximity: pre-game events start before game time, post-game start after

**When no related events exist**: The game card renders without the satellite sections — just the game itself. No empty "Tailgate (0)" sections.

**Empty state**: "No games scheduled this week. Check back closer to game day." with link to team schedules.

**Loading skeleton**: 2 game hub cards with shimmer.

### URL Scheme

```
?view=find&lane=game-day                           → all teams, upcoming games
?view=find&lane=game-day&team=hawks                → Hawks schedule
?view=find&lane=game-day&team=hawks&date=2026-04-05 → specific date
```

### API

Existing `/api/portals/[slug]/game-day` returns team schedules. For the hub (related events), a new query or endpoint is needed:

**Option A (recommended)**: Extend the existing game-day API to accept a `?include_related=true` flag. When set, the response includes related events per game (watch parties, tailgates, after-parties) matched by team tag + date + context tags.

**Option B**: Client-side fetch of related events via `/api/events?tags=hawks,watch-party&date=2026-04-05` for each game. More requests but simpler server-side.

Recommendation: Option A. One request, server-side matching is more efficient and cacheable.

### Data Requirements

The game-as-hub grouping depends on events being tagged correctly:
- Team tags: `hawks`, `braves`, `atlutd`, `falcons`, etc. (already in teams-config.ts)
- Context tags: `tailgate`, `watch-party`, `pre-game`, `after-party`, `game-day`

Check if crawlers are producing these tags. If not, the hub will just show games without satellites — which is still a functional lane, just less rich.

---

## Feed "See All" Routing

Update all VENUES widget tab "See all" links and other feed section links:

| Feed Section / Tab | Current URL | New URL |
|---|---|---|
| VENUES → Film | `?view=happening&content=showtimes` | `?view=find&lane=now-showing` |
| VENUES → Music | `?view=happening&content=showtimes` | `?view=find&lane=live-music` |
| VENUES → Comedy | `?view=happening&content=showtimes` | `?view=find&lane=comedy` |
| VENUES → Theater | `?view=happening&content=showtimes` | `?view=find&lane=theater` |
| VENUES → Nightlife | `?view=happening` or places | `?view=find&lane=places&vertical=nightlife` |
| VENUES → Arts | `?view=happening` or places | `?view=find&lane=places&vertical=arts` |
| VENUES → Attractions | `?view=happening` or places | `?view=find&lane=places&vertical=entertainment` |
| Game Day | `?view=happening&category=sports` | `?view=find&lane=game-day` |

Legacy `?view=happening` URLs continue to work via normalize-find-url.ts. Add new legacy mappings:
- `?view=find&lane=stage` → `?view=find&lane=theater` (renamed lane)

### Files to update:
- `web/components/feed/sections/SeeShowsSection.tsx` — all tab "See all" links
- `web/components/feed/sections/NowShowingSection.tsx` — Film "See all"
- `web/components/feed/sections/GameDaySection.tsx` — Game Day "See all"
- `web/lib/normalize-find-url.ts` — add `stage → theater` legacy mapping

---

## Sidebar + Chip Bar + Explore Home

### Sidebar

Rename Stage & Comedy → Theater, add Comedy and Game Day to BROWSE group:

```
BROWSE
  Events
  Now Showing
  Live Music
  Theater           ← RENAMED from "Stage & Comedy"
  Comedy            ← NEW (split from Stage & Comedy)
  Game Day          ← NEW
  Regulars
  Places
  Classes

VIEWS
  Calendar
  Map
```

**Theater**: Icon stays `MaskHappy`, accent stays `var(--neon-magenta)`. Lane slug changes from `stage` to `theater`.

**Comedy**: Icon `Microphone` from Phosphor. Accent `var(--gold)` — comedy has a warm spotlight energy.

**Game Day**: Icon `Trophy` from Phosphor. Accent `var(--coral)` — high-energy sports red.

### MobileLaneBar

Update and add chips:
- Rename "Stage" chip → "Theater" with new lane slug
- Add Comedy chip: `{ id: "comedy", label: "Comedy", accent: "var(--gold)", href: "?view=find&lane=comedy" }`
- Add Game Day chip: `{ id: "game-day", label: "Game Day", accent: "var(--coral)", href: "?view=find&lane=game-day" }`

### FindShellClient

- Rename `"stage"` → `"theater"` in `SHELL_LANES` (keep `"stage"` as legacy alias via normalize-find-url)
- Add `"comedy"` and `"game-day"` to `SHELL_LANES`
- Add dynamic imports for `TheaterListingsView`, `ComedyListingsView`, `GameDayView`
- Update conditional renders

### Explore Home

Add Comedy and Game Day lanes to `explore-home-data.ts` and `explore-lane-meta.ts`:

```typescript
// explore-lane-meta.ts additions:
comedy:     { label: "COMEDY",   mobileLabel: "Comedy",   accent: "var(--gold)",  href: "?view=find&lane=comedy",   zeroCta: "" },
"game-day": { label: "GAME DAY", mobileLabel: "Game Day", accent: "var(--coral)", href: "?view=find&lane=game-day", zeroCta: "" },
```

Update `LaneSlug` type to include `"comedy"` and `"game-day"`.

Rename `"stage"` to `"theater"` in lane meta, type, and data fetcher.

Comedy scoring: temporal (comedy shows happen tonight or not).
Game Day scoring: temporal (games today/this weekend).

---

## Component Architecture

| Component | File | Purpose |
|-----------|------|---------|
| `MusicListingsView` | `web/components/find/MusicListingsView.tsx` | **Upgrade in place** — venue-grouped shows |
| `TheaterListingsView` | `web/components/find/TheaterListingsView.tsx` | **Rename from StageListingsView** — venue-grouped productions |
| `ComedyListingsView` | `web/components/find/ComedyListingsView.tsx` | **New** — venue-grouped comedy shows |
| `VenueShowsCard` | `web/components/find/shows/VenueShowsCard.tsx` | Shared venue card for Music, Theater, Comedy |
| `ShowRow` | `web/components/find/shows/ShowRow.tsx` | Individual show row within a venue card |
| `GameDayView` | `web/components/find/GameDayView.tsx` | Top-level Game Day lane component |
| `GameHubCard` | `web/components/find/gameday/GameHubCard.tsx` | Game hub with satellite events |
| `TeamChip` | `web/components/find/gameday/TeamChip.tsx` | Team filter chip with logo |

### Shared Components

`VenueShowsCard` and `ShowRow` are shared between Music, Theater, and Comedy lanes. The venue card container is identical — only the show metadata differs (Music shows genres, Theater shows run period, Comedy shows format/style). Use a `variant` prop or conditional metadata rendering.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. **Live Music**: venue-grouped shows, genre chips with counts, date navigation, URL sync
3. **Theater**: venue-grouped productions with run periods, category chips, date nav
4. **Comedy**: venue-grouped comedy shows, format chips, date nav
5. **Game Day**: calendar timeline, team chips, game hub with tailgates/watch parties
6. **Feed routing**: All VENUES widget tabs → correct Find lanes
7. **Feed routing**: Nightlife/Arts/Attractions → Places lane with vertical filter
8. **Feed routing**: GameDay → game-day lane
9. **Sidebar**: Theater (renamed), Comedy, Game Day in BROWSE group
10. **Mobile chip bar**: Theater (renamed), Comedy, Game Day chips present
11. **Explore Home**: Comedy and Game Day lanes show alive/quiet state, Theater renamed
12. **Empty states**: all four lanes handle no-data gracefully
13. **Mobile (375px)**: venue cards full-width, filter chips scrollable, game hubs readable
14. **Backward compat**: `?view=find&lane=stage` redirects to `?view=find&lane=theater`
15. **Backward compat**: `?view=happening&content=showtimes` still works
16. **URL sync**: date/genre/team params persist in URL via replaceState
