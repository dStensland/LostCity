# Shows & Game Day Lanes — Design Spec

## Context

The Find tab has 3 showtime lanes (Now Showing, Live Music, Stage & Comedy) and no Game Day lane. Now Showing is production-ready (825-line ShowtimesView). Live Music and Stage are functional but basic — flat list views that don't mirror the feed's venue-grouped "See Shows" experience. The feed's "See all" links still point to the legacy HappeningView instead of the Find shell lanes.

This spec upgrades Live Music and Stage to venue-grouped experiences matching their feed counterparts, adds a Game Day lane for sports, and routes all feed "See all" links to the correct Find lanes.

---

## What This Builds

1. **Live Music lane** — upgrade from flat list to venue-grouped shows (mirrors feed's SeeShows Music tab)
2. **Stage & Comedy lane** — upgrade from flat list to venue-grouped productions (mirrors feed's SeeShows Theater tab)
3. **Game Day lane** — new lane with calendar-first timeline, team filter chips, game-as-hub grouping
4. **Feed routing** — update SeeShowsSection + GameDaySection "See all" links to Find lanes
5. **Sidebar + chip bar + Explore Home** — add Game Day

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

## Stage & Comedy Lane — Venue-Grouped Upgrade

Same architectural pattern as Live Music but adapted for stage content.

### Landing (`?view=find&lane=stage`)

**Date navigation**: Same date pill strip.

**Category filter chips**: All (default) | Theater | Comedy | Dance. With counts.

**Venue-grouped productions**: Each venue with shows on the selected date:

```
┌──────────────────────────────────────────────────────┐
│  [venue image]  Dad's Garage Theatre                  │
│                 Inman Park · 2 shows tonight          │
│                                                       │
│  7:30 PM  The Improvised Musical     $20  Tickets →  │
│           Comedy · Runs through Apr 30                │
│  9:30 PM  Thunderdome               $15  Tickets →  │
│           Improv · Tonight only                       │
└──────────────────────────────────────────────────────────┘
```

Key difference from Music: Stage productions often run for weeks. Show the run period ("Runs through Apr 30" or "Tonight only" or "Fri-Sun through May 15"). This info comes from `start_date`/`end_date` on the event.

**Sort, URL sync, empty state, skeleton**: Same patterns as Live Music.

### API

Existing `/api/whats-on/stage` already returns the data. Same upgrade path — use grouped structure instead of flattening.

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

Update feed section "See all" links to point to Find lanes:

| Feed Section | Current URL | New URL |
|---|---|---|
| SeeShows (Film tab) | `?view=happening&content=showtimes` | `?view=find&lane=now-showing` |
| SeeShows (Music tab) | `?view=happening&content=showtimes` | `?view=find&lane=live-music` |
| SeeShows (Theater tab) | `?view=happening&content=showtimes` | `?view=find&lane=stage` |
| GameDay | `?view=happening&category=sports` | `?view=find&lane=game-day` |

Also update any other feed sections that point to HappeningView with content/filter params. The legacy `?view=happening` URLs should continue to work (backward compat via normalize-find-url.ts).

### Files to update:
- `web/components/feed/sections/SeeShowsSection.tsx`
- `web/components/feed/sections/NowShowingSection.tsx`
- `web/components/feed/sections/GameDaySection.tsx`

---

## Sidebar + Chip Bar + Explore Home

### Sidebar

Add Game Day to BROWSE group:

```
BROWSE
  Events
  Now Showing
  Live Music
  Stage & Comedy
  Game Day          ← NEW
  Regulars
  Places
  Classes

VIEWS
  Calendar
  Map
```

Position after Stage & Comedy, before Regulars. Icon: `Trophy` from Phosphor. Accent: team-neutral color — use `var(--gold)` (#FFD93D) for the sports energy.

### MobileLaneBar

Add Game Day chip: `{ id: "game-day", label: "Game Day", accent: "var(--gold)", href: "?view=find&lane=game-day" }`

### FindShellClient

Add `"game-day"` to `SHELL_LANES`. Add dynamic import for `GameDayView`. Conditional render.

### Explore Home

Add Game Day lane to `explore-home-data.ts`:
- Count: events with `category_id = 'sports'`, upcoming
- Count today: same with today filter
- Preview: 2-3 upcoming games with team logos
- Scoring: temporal (uses today/weekend counts like Events)

Add to `explore-lane-meta.ts`:
```typescript
"game-day": { label: "GAME DAY", mobileLabel: "Game Day", accent: "var(--gold)", href: "?view=find&lane=game-day", zeroCta: "" },
```

Update `LaneSlug` type to include `"game-day"`.

---

## Component Architecture

| Component | File | Purpose |
|-----------|------|---------|
| `MusicListingsView` | `web/components/find/MusicListingsView.tsx` | **Upgrade in place** — venue-grouped shows |
| `StageListingsView` | `web/components/find/StageListingsView.tsx` | **Upgrade in place** — venue-grouped productions |
| `VenueShowsCard` | `web/components/find/shows/VenueShowsCard.tsx` | Shared venue card for Music + Stage |
| `ShowRow` | `web/components/find/shows/ShowRow.tsx` | Individual show row within a venue card |
| `GameDayView` | `web/components/find/GameDayView.tsx` | Top-level Game Day lane component |
| `GameHubCard` | `web/components/find/gameday/GameHubCard.tsx` | Game hub with satellite events |
| `TeamChip` | `web/components/find/gameday/TeamChip.tsx` | Team filter chip with logo |

### Shared Components

`VenueShowsCard` and `ShowRow` are shared between Music and Stage lanes. The venue card container is identical — only the show metadata differs (Music shows genres, Stage shows run period). Use a `variant` prop or conditional metadata rendering.

---

## Verification

1. `npx tsc --noEmit` — clean build
2. **Live Music**: venue-grouped shows, genre chips with counts, date navigation, URL sync
3. **Stage & Comedy**: venue-grouped productions with run periods, category chips, date nav
4. **Game Day**: calendar timeline, team chips, game hub with tailgates/watch parties
5. **Feed routing**: SeeShows "See all" → correct Find lanes, GameDay "See all" → game-day lane
6. **Sidebar**: Game Day visible in BROWSE group with Trophy icon
7. **Mobile chip bar**: Game Day chip present
8. **Explore Home**: Game Day lane shows alive/quiet state
9. **Empty states**: all three lanes handle no-data gracefully
10. **Mobile (375px)**: venue cards full-width, filter chips scrollable, game hubs readable
11. **Backward compat**: `?view=happening&content=showtimes` still works
12. **URL sync**: date/genre/team params persist in URL via replaceState
