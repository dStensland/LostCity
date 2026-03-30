# Game Day Feed Section — Design Spec

**Date**: 2026-03-30
**Status**: Approved (revised after expert review)
**Reference pattern**: NowShowingSection (theater carousel + customizer)

## Overview

A new CityPulse feed section called "Game Day" that shows upcoming games and sports events across Atlanta teams. Users see team-centric cards in a horizontal carousel, with a customizer to add/remove teams. Follows the exact same UX pattern as the "Now Showing" cinema section — default teams shown, gear icon opens customizer, preferences persisted to localStorage.

## Problem

Sports events exist in the database but have no dedicated feed presence. The CityPulse feed has sections for music, cinema, recurring hangs, and destinations — but nothing for games. Hawks at State Farm Arena tonight is as much a "city event" as a concert at The Tabernacle, yet there's no way to see it in the feed without searching.

Note: Sports is already NOT excluded from the main `buildEventQuery` in `fetch-events.ts` (the exclusion there covers recreation, unknown, support_group, religious, etc.). Sports IS excluded from the Planning Horizon pool — that exclusion should remain, since regular-season games aren't horizon-worthy alongside festivals and tentpoles.

## Design Decisions

- **Team-centric cards**: Each configured team gets its own card showing upcoming games. Teams with no events in the 14-day window are simply omitted.
- **Static teams config in TypeScript**: Not a DB table. Similar to `cinema-filter.ts`. Easy to add teams, no migration needed.
- **Hybrid card layout**: Next game prominent at top, up to 3 upcoming games listed below. Balances "should I go tonight?" with planning value.
- **Section title: "Game Day"**: Broad enough to cover roller derby, monster trucks, and wrestling alongside traditional sports.
- **No overflow card in v1**: Unmatched sports events (watch parties at bars, etc.) are accessible via the "See all" link to the Find view with sports filter. A "Watch Parties & More" junk drawer card adds complexity without clarity.
- **Default-on tracks data reality**: Only teams with active crawlers producing events are default-on. Teams without data are in the config but default-off — their cards light up when crawlers are added.

## Teams Config

### Data Model

```ts
type TeamConfig = {
  slug: string;           // "atlanta-hawks"
  name: string;           // "Atlanta Hawks"
  shortName: string;      // "Hawks"
  sport: string;          // "basketball"
  league: string;         // "NBA"
  city: string;           // "atlanta" — for future multi-city support
  accentColor: string;    // team brand color
  logoUrl: string;        // "/teams/hawks.svg" in public/
  sourceSlugs: string[];  // human-readable source slugs (resolved to IDs at runtime)
  tags: string[];         // fallback match via event tags
  venueSlug?: string;     // home venue
  defaultEnabled: boolean;
  priority: number;       // display order (lower = first)
}
```

### Event Matching

An event matches a team if:
1. `event.source_id IN team.resolvedSourceIds` (precise, preferred), OR
2. `event.tags` overlaps `team.tags` AND event has a sports-context tag (`watch-party`, `game-day`, `home-game`, `sports`) — prevents false positives from non-sports events that happen to mention a team name

Source IDs are resolved from `sourceSlugs` at startup and cached (1-hour TTL), mirroring the YMCA source ID caching pattern in `fetch-events.ts`.

**Multi-team collision rule**: If an event matches multiple teams via tags, it's assigned to the first team by priority order. No duplication across cards.

**"united" false positive**: The `tag_inference.py` soccer pattern uses bare `"united"` which matches civic events (United Way, United Methodist). Should be tightened to `"atlanta united"` and `"atlutd"` to match what `_sports_bar_common.py` already does correctly. This is an upstream fix.

### Team Roster (21 teams)

#### Major Pro — default on (priority 1-6)
| # | Team | Sport | League | Data Status | Source |
|---|------|-------|--------|-------------|--------|
| 1 | Atlanta Hawks | Basketball | NBA | Ready | `atlanta-hawks` (NBA API) |
| 2 | Atlanta United | Soccer | MLS | Ready | `atlanta-united-fc` (MLS API) |
| 3 | Atlanta Braves | Baseball | MLB | Ready (Apr+) | `truist-park` (MLB API) + tag match `braves` |
| 4 | Atlanta Falcons | Football | NFL | **No crawler** (Sep+) | Default off until crawler exists |
| 5 | Atlanta Dream | Basketball | WNBA | Ready (May+) | `atlanta-dream` (hardcoded schedule, no start times) |
| 6 | Atlanta Vibe | Volleyball | PVF | Ready (seasonal) | `atlanta-vibe` |

Note: Falcons is default **off** — no dedicated crawler, NFL season starts September. Moves to default-on when a crawler ships.

#### Minor Pro — default on where data exists (priority 7-11)
| # | Team | Sport | League | Data Status | Source |
|---|------|-------|--------|-------------|--------|
| 7 | Atlanta Gladiators | Hockey | ECHL | Ready | `atlanta-gladiators` (JSON-LD) |
| 8 | Gwinnett Stripers | Baseball | AAA | Ready (Apr+) | `gwinnett-stripers` (MLB API) |
| 9 | College Park Skyhawks | Basketball | G-League | **Season over** | Default off — schedule expired Mar 25 |
| 10 | Atlanta Hustle | Ultimate | AUDL | Conditional | `atlanta-hustle` (UFA API) — season is summer |
| 11 | Georgia Swarm | Lacrosse | NLL | Conditional | `georgia-swarm` (HTML scraper) — season winding down |

#### College — default on (priority 12-13)
| # | Team | Sport | League | Data Status | Source |
|---|------|-------|--------|-------------|--------|
| 12 | Georgia Tech | Multi | NCAA | Ready | `georgia-tech-athletics` |
| 13 | Georgia State | Multi | NCAA | Ready | `gsu-athletics` |

#### Nearby / Occasional — default off (priority 14-15)
| # | Team | Sport | League | Data Status | Source |
|---|------|-------|--------|-------------|--------|
| 14 | Georgia Bulldogs | Multi | NCAA | Rare | `georgia-bulldogs-baseball-atlanta` (neutral-site only) |
| 15 | Atlanta FaZe | Esports | CDL | No crawler | Aspirational |

#### Alternative / Action — default off (priority 16-21)
| # | Team | Sport | League | Data Status | Source |
|---|------|-------|--------|-------------|--------|
| 16 | Atlanta Roller Derby | Roller Derby | WFTDA | Exists, unverified | `atlanta-roller-derby` |
| 17 | NASCAR at AMS | Racing | NASCAR | Exists (general venue) | `atlanta-motor-speedway` |
| 18 | Supercross | Motocross | AMA | No crawler | May appear via AMS venue crawler |
| 19 | Monster Jam | Monster Trucks | — | Wrong brand | `all-star-monster-trucks` covers a different org |
| 20 | WWE / AEW | Wrestling | — | No crawler | Aspirational |
| 21 | PBR Bull Riding | Bull Riding | PBR | No crawler | Aspirational |

**Day-one reality (~March 30)**: ~6-7 team cards will render: Hawks, United, Vibe (last days of season), Gladiators, GT, GSU, possibly Swarm. Braves and Stripers join in early April. Dream in May. Falcons in September. This is fine — empty teams simply don't appear.

## API

### Endpoint

`GET /api/portals/[slug]/game-day`

### Response

```ts
type GameDayResponse = {
  teams: TeamSchedule[];
};

type TeamSchedule = {
  slug: string;
  name: string;
  shortName: string;
  sport: string;
  league: string;
  accentColor: string;
  logoUrl: string;
  nextGame: GameEvent | null;
  upcoming: GameEvent[];    // up to 3 games after nextGame
  totalUpcoming: number;    // total count for "+N more"
};

type GameEvent = {
  id: number;
  title: string;
  startDate: string;       // ISO date
  startTime: string | null; // HH:MM
  venueName: string;
  venueSlug: string;
  isFree: boolean;
  ticketUrl: string | null;
  imageUrl: string | null;
};
```

### Query Logic

1. Fetch all events where `category_id = 'sports'`, `start_date >= today`, `start_date <= today + 14 days`, `is_active = true`, `is_class != true`, portal-scoped via `applyPortalScope()`
2. Order by `start_date ASC, start_time ASC`
3. Resolve team source slugs → source IDs (cached, 1-hour TTL)
4. For each event, match to teams: source_id first, then tag overlap (requiring sports-context tag)
5. Multi-team collision: assign to first team by priority
6. For each team with matches: assign `nextGame` (first chronologically) and `upcoming` (next 3 max)
7. Omit teams with zero events from response

### Source ID Resolution

```ts
// Cache source slug → ID mapping (mirrors YMCA pattern in fetch-events.ts)
let sourceIdCache: Map<string, number> | null = null;
let sourceIdCacheTime = 0;
const SOURCE_ID_CACHE_TTL = 3600_000; // 1 hour

async function resolveSourceIds(supabase: SupabaseClient): Promise<Map<string, number>> {
  if (sourceIdCache && Date.now() - sourceIdCacheTime < SOURCE_ID_CACHE_TTL) {
    return sourceIdCache;
  }
  const allSlugs = TEAMS.flatMap(t => t.sourceSlugs);
  const { data } = await supabase.from("sources").select("id, slug").in("slug", allSlugs);
  sourceIdCache = new Map((data || []).map(s => [s.slug, s.id]));
  sourceIdCacheTime = Date.now();
  return sourceIdCache;
}
```

## UI Component

### GameDaySection.tsx

Location: `web/components/feed/sections/GameDaySection.tsx`

Dynamic import in CityPulseShell, lazy-loaded. Only renders if API returns at least one team with events. Only mounts on portals where sports is relevant (skip civic/hotel verticals).

### Section Header

```tsx
<FeedSectionHeader
  title="Game Day"
  priority="secondary"
  accentColor="var(--neon-cyan)"
  icon={<Trophy weight="duotone" className="w-5 h-5" />}
  seeAllHref={`/${portalSlug}?view=happening&category=sports`}
  actionIcon={user ? <GearSix /> : undefined}
  onAction={user ? toggleCustomizer : undefined}
  actionLabel="Customize teams"
/>
```

### Team Card (256px wide)

```
┌──────────────────────────┐
│▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│  ← team color gradient band (h-8, low opacity)
│ ═══ team accent border ═══│  ← border-t-2 in team.accentColor
│                            │
│  [logo] Hawks        NBA   │  ← 24px logo, name, league badge
│                            │
│  vs Boston Celtics         │  ← next game: opponent
│  ┌───────┐ ┌──────────┐   │
│  │TONIGHT│ │ 7:30 PM  │   │  ← gold time chips, red TONIGHT badge
│  └───────┘ └──────────┘   │
│  State Farm Arena          │  ← venue in --muted
│                            │
│  ─────────────────────     │  ← subtle divider (only if upcoming.length > 0)
│  vs Magic · Apr 2 · 7pm   │  ← compact upcoming rows
│  vs 76ers · Apr 4 · 8pm   │
│  vs Knicks · Apr 6 · 3pm  │
│                            │
│  +4 more →                 │  ← overflow link to Find view
└────────────────────────────┘
```

**Visual tokens**:
- Card: `bg-[var(--night)] border border-[var(--twilight)]/40 rounded-card shadow-card-sm hover-lift`
- **Top zone**: Fixed h-8 gradient band using team accent color at 10-15% opacity → gives visual weight matching theater poster strips
- Team accent: `border-t-2` with dynamic color via ScopedStyles
- Team name: `text-base font-semibold text-[var(--cream)]`
- League badge: `text-2xs font-mono font-bold uppercase tracking-wider` in `--muted`
- Opponent (next game): `text-sm font-medium text-[var(--soft)]`
- Time chips: same pattern as NowShowingSection showtime chips (gold accent)
- TONIGHT badge: `bg-[var(--neon-red)]/15 text-[var(--neon-red)]`
- FREE badge: `bg-[var(--neon-green)]/15 text-[var(--neon-green)]`
- Upcoming rows: `text-xs text-[var(--muted)]`
- "+N more →": `text-xs text-[var(--neon-cyan)]`
- Divider between next game and upcoming: only rendered if `upcoming.length > 0`

### Carousel

Horizontal snap scroll with dot indicators on mobile (mirrors NowShowingSection exactly):
- `flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth`
- Mobile: dot indicators or `N / M` counter (switch at 7+ cards)
- Cards: `flex-shrink-0 w-64 snap-start`

### Team Customizer

Gear icon opens inline panel below carousel (same as TheaterCustomizer):

- **"Your teams"**: Current teams with Hide button
- **"Add teams"**: Searchable, grouped by section (Major Pro / Minor Pro / College / Alternative)
- Search input filters by team name or sport
- Add/Remove buttons toggle teams
- Teams with no current events show "(no upcoming games)" in muted text — not hidden from customizer

### localStorage Persistence

New file: `web/lib/my-teams.ts` (mirrors `web/lib/my-theaters.ts`):

```ts
const STORAGE_KEY = "lostcity-my-teams";       // matches "lostcity-" prefix convention
const HIDDEN_KEY = "lostcity-hidden-teams";

export function getMyTeams(): string[];        // added non-default teams
export function addMyTeam(slug: string): void;
export function removeMyTeam(slug: string): void;
export function getHiddenTeams(): string[];     // hidden default teams
export function hideTeam(slug: string): void;
export function unhideTeam(slug: string): void;
```

## Feed Integration

### CityPulseShell Position

Add `GameDaySection` as a `"sports"` block ID in the feed layout system:

```
6. cinema → See Shows (SeeShowsSection)
7. sports → Game Day (GameDaySection)        ← NEW block ID
8. portal-teasers → Around the City
9. horizon → On the Horizon
```

Register `"sports"` in `MIDDLE_BLOCK_IDS` and add a case in `renderMiddleSection`. Dynamic import with `ssr: false`.

**Portal gating**: Only mount GameDaySection on portals where `vertical` is not `community` or `hotel`. The section self-gates on empty data, but skipping the API call on irrelevant portals avoids wasted requests.

### No Feed Exclusion Changes

Sports is already NOT excluded from `buildEventQuery` — sports events can already appear in the Lineup. The Planning Horizon exclusion of sports should remain (regular-season games are not horizon-worthy).

## Files to Create/Modify

### New Files
- `web/lib/teams-config.ts` — team roster, types, and source ID resolution
- `web/lib/my-teams.ts` — localStorage helpers
- `web/app/api/portals/[slug]/game-day/route.ts` — API endpoint
- `web/components/feed/sections/GameDaySection.tsx` — feed section component
- `web/public/teams/*.svg` — team logos (21 files, optimized SVG)

### Modified Files
- `web/components/feed/CityPulseShell.tsx` — add `"sports"` block ID and GameDaySection case
- `crawlers/tag_inference.py` — tighten `"united"` → `"atlanta united"` in soccer patterns (upstream fix)

## Upstream Data Fixes (separate from this feature)

These are crawler issues discovered during review. They should be fixed but don't block the Game Day section:

1. **College Park Skyhawks**: Hardcoded schedule expired Mar 25. Needs API-based crawler or deactivation.
2. **Atlanta Dream**: No start times on events. Crawler needs update to pull from live WNBA schedule.
3. **`tag_inference.py` soccer pattern**: Bare `"united"` keyword causes false positives. Tighten to `"atlanta united"` / `"atlutd"`.
4. **Monster Jam vs All Star Monster Trucks**: Crawler covers a different organization than spec intended. Monster Jam events likely come through venue crawlers (Mercedes-Benz Stadium).

## Out of Scope

- New crawlers for teams without data — cards simply won't render until crawlers exist
- Opponent logos or team-vs-team visual treatment — text-based for now
- Score updates or live game state — this is a schedule, not a scoreboard
- User notifications for game reminders — future feature
- Sports portal integration — this is a feed section, not a portal feature
- Multi-city team configs — `city` field exists on TeamConfig for future use, Atlanta-only for now
- Watch Parties overflow card — cut from v1, accessible via "See all" link instead
