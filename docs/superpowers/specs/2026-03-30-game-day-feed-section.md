# Game Day Feed Section — Design Spec

**Date**: 2026-03-30
**Status**: Approved
**Reference pattern**: NowShowingSection (theater carousel + customizer)

## Overview

A new CityPulse feed section called "Game Day" that shows upcoming games and sports events across Atlanta teams. Users see team-centric cards in a horizontal carousel, with a customizer to add/remove teams. Follows the exact same UX pattern as the "Now Showing" cinema section — default teams shown, gear icon opens customizer, preferences persisted to localStorage.

## Problem

Sports events (category_id = 'sports') are blanket-excluded from the CityPulse feed via `fetch-events.ts`. This hides Hawks games, United matches, and other major city events from the feed. The exclusion was a noise filter for Ticketmaster spam, but it threw out the baby with the bathwater.

## Design Decisions

- **Team-centric with venue fallback**: Each configured team gets its own card. Sports events that don't match any team are grouped by venue into a "Watch Parties & More" overflow card.
- **Static teams config in TypeScript**: Not a DB table. Similar to `cinema-filter.ts`. Easy to add teams, no migration needed.
- **Hybrid card layout**: Next game prominent at top, 2-3 upcoming games listed below. Balances "should I go tonight?" with planning value.
- **Section title: "Game Day"**: Broad enough to cover roller derby, monster trucks, and wrestling alongside traditional sports.
- **Unblock sports from main feed**: Remove `sports` from the exclusion list in `fetch-events.ts` so games also appear in the Lineup. Keep `recreation` excluded.

## Teams Config

### Data Model

```ts
type TeamConfig = {
  slug: string;           // "atlanta-hawks"
  name: string;           // "Atlanta Hawks"
  shortName: string;      // "Hawks"
  sport: string;          // "basketball"
  league: string;         // "NBA"
  accentColor: string;    // team brand color
  logoUrl: string;        // "/teams/hawks.svg" in public/
  sourceSlugs: string[];  // match events from these crawler sources
  tags: string[];         // fallback match via event tags
  venueSlug?: string;     // home venue
  defaultEnabled: boolean;
  priority: number;       // display order (lower = first)
}
```

### Team Roster (21 teams)

#### Major Pro (default on, priority 1-6)
| # | Team | Sport | League | Accent Color |
|---|------|-------|--------|-------------|
| 1 | Atlanta Hawks | Basketball | NBA | #E03A3E |
| 2 | Atlanta United | Soccer | MLS | #80000B |
| 3 | Atlanta Braves | Baseball | MLB | #CE1141 |
| 4 | Atlanta Falcons | Football | NFL | #A71930 |
| 5 | Atlanta Dream | Basketball | WNBA | #E31937 |
| 6 | Atlanta Vibe | Volleyball | PVF | #FF6B35 |

#### Minor Pro (default on, priority 7-11)
| # | Team | Sport | League | Accent Color |
|---|------|-------|--------|-------------|
| 7 | College Park Skyhawks | Basketball | G-League | #78BE20 |
| 8 | Atlanta Gladiators | Hockey | ECHL | #003DA5 |
| 9 | Atlanta Hustle | Ultimate | AUDL | #FFD100 |
| 10 | Georgia Swarm | Lacrosse | NLL | #F9A825 |
| 11 | Gwinnett Stripers | Baseball | AAA | #F37021 |

#### College (default on, priority 12-13)
| # | Team | Sport | League | Accent Color |
|---|------|-------|--------|-------------|
| 12 | Georgia Tech | Multi | NCAA | #B3A369 |
| 13 | Georgia State | Multi | NCAA | #0039A6 |

#### Nearby / Occasional (default off, priority 14-15)
| # | Team | Sport | League | Accent Color |
|---|------|-------|--------|-------------|
| 14 | Georgia Bulldogs | Multi | NCAA | #BA0C2F |
| 15 | Atlanta FaZe | Esports | CDL | #EE1133 |

#### Alternative / Action (default off, priority 16-21)
| # | Team | Sport | League | Accent Color |
|---|------|-------|--------|-------------|
| 16 | Atlanta Roller Derby | Roller Derby | WFTDA | #E91E63 |
| 17 | NASCAR at AMS | Racing | NASCAR | #FFD659 |
| 18 | Supercross | Motocross | AMA | #FF5722 |
| 19 | Monster Jam | Monster Trucks | — | #4CAF50 |
| 20 | WWE / AEW | Wrestling | — | #FFD700 |
| 21 | PBR Bull Riding | Bull Riding | PBR | #8B4513 |

### Event Matching

An event matches a team if:
1. `event.source_slug IN team.sourceSlugs` (precise, preferred), OR
2. `event.tags` overlaps `team.tags` (fallback for watch parties at sports bars)

Source-first matching is authoritative. Tag fallback catches events from venue crawlers (Sports & Social, etc.) that mention a team in their tags.

Events that match zero configured teams go into the "Watch Parties & More" overflow bucket, grouped by venue.

## API

### Endpoint

`GET /api/portals/[slug]/game-day`

### Response

```ts
type GameDayResponse = {
  teams: TeamSchedule[];
  watchParties: VenueGroup[];
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

type VenueGroup = {
  venue: {
    name: string;
    slug: string;
    neighborhood: string | null;
  };
  events: GameEvent[];
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

1. Fetch all events where `category_id = 'sports'`, `start_date >= today`, `is_active = true`, portal-scoped
2. Order by `start_date ASC, start_time ASC`
3. For each configured team, match events via source slug → tag fallback
4. Assign `nextGame` (first chronologically) and `upcoming` (next 3 max)
5. Collect unmatched events, group by venue → `watchParties`
6. Omit teams with zero events from response
7. Limit: 14-day lookahead to keep response focused

## UI Component

### GameDaySection.tsx

Location: `web/components/feed/sections/GameDaySection.tsx`

Dynamic import in CityPulseShell, lazy-loaded. Only renders if API returns at least one team with events.

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
│  ─────────────────────     │  ← subtle divider
│  vs Magic · Apr 2 · 7pm   │  ← compact upcoming rows
│  vs 76ers · Apr 4 · 8pm   │
│  vs Knicks · Apr 6 · 3pm  │
│                            │
│  +4 more →                 │  ← overflow link
└────────────────────────────┘
```

**Visual tokens**:
- Card: `bg-[var(--night)] border border-[var(--twilight)]/40 rounded-card shadow-card-sm hover-lift`
- Team accent: `border-t-2` with dynamic color via ScopedStyles
- Team name: `text-base font-semibold text-[var(--cream)]`
- League badge: `text-2xs font-mono font-bold uppercase tracking-wider` in `--muted`
- Opponent (next game): `text-sm font-medium text-[var(--soft)]`
- Time chips: same pattern as NowShowingSection showtime chips
- TONIGHT badge: `bg-[var(--neon-red)]/15 text-[var(--neon-red)]`
- FREE badge: `bg-[var(--neon-green)]/15 text-[var(--neon-green)]`
- Upcoming rows: `text-xs text-[var(--muted)]`
- "+N more →": `text-xs text-[var(--neon-cyan)]`

### Watch Parties Overflow Card

Same 256px width. Header: "Watch Parties & More" with beer mug or TV icon. Venue-grouped list of sports events that didn't match any team. Same visual pattern as theater cards with venue name + event rows.

### Carousel

Horizontal snap scroll with dot indicators on mobile (mirrors NowShowingSection exactly):
- `flex gap-3 overflow-x-auto snap-x snap-mandatory scroll-smooth`
- Mobile: dot indicators or `N / M` counter
- Cards: `flex-shrink-0 w-64 snap-start`

### Team Customizer

Gear icon opens inline panel below carousel (same as TheaterCustomizer):

- **"Your teams"**: Current teams with Hide button
- **"Add teams"**: Searchable, grouped by section (Major Pro / Minor Pro / College / Alternative)
- Search input filters by team name or sport
- Add/Remove buttons toggle teams

### localStorage Persistence

New file: `web/lib/my-teams.ts` (mirrors `web/lib/my-theaters.ts`):

```ts
const STORAGE_KEY = "lc-my-teams";
const HIDDEN_KEY = "lc-hidden-teams";

export function getMyTeams(): string[];        // added non-default teams
export function addMyTeam(slug: string): void;
export function removeMyTeam(slug: string): void;
export function getHiddenTeams(): string[];     // hidden default teams
export function hideTeam(slug: string): void;
export function unhideTeam(slug: string): void;
```

## Feed Integration

### CityPulseShell Position

Add `GameDaySection` after See Shows, before Planning Horizon:

```
6. See Shows (SeeShowsSection)
7. Game Day (GameDaySection)        ← NEW
8. Around the City (PortalTeasersSection)
9. On the Horizon (PlanningHorizonSection)
```

Dynamic import: `const GameDaySection = dynamic(() => import("..."), { ssr: false })`

### Unblock Sports from Main Feed

In `web/lib/city-pulse/pipeline/fetch-events.ts`, change:

```ts
// Before:
.not("category_id", "in", "(sports,recreation,support_group,religious)")

// After:
.not("category_id", "in", "(recreation,support_group,religious)")
```

This lets sports events appear in the Lineup section too. A Hawks game tonight should show in "Today" alongside concerts and festivals — it's a real city event.

## Files to Create/Modify

### New Files
- `web/lib/teams-config.ts` — team roster + types
- `web/lib/my-teams.ts` — localStorage helpers
- `web/app/api/portals/[slug]/game-day/route.ts` — API endpoint
- `web/components/feed/sections/GameDaySection.tsx` — feed section component
- `web/public/teams/*.svg` — team logos (21 files)

### Modified Files
- `web/components/feed/CityPulseShell.tsx` — add GameDaySection to section order
- `web/lib/city-pulse/pipeline/fetch-events.ts` — remove `sports` from exclusion list

## Out of Scope

- New crawlers for teams without data (Braves, Falcons, Vibe, etc.) — those cards simply won't render until crawlers exist
- Opponent logos or team-vs-team visual treatment — keep it text-based for now
- Score updates or live game state — this is a schedule, not a scoreboard
- User notifications for game reminders — future feature
- Sports portal integration — this is a feed section, not a portal feature
