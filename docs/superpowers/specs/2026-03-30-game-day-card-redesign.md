# Game Day Card Redesign — Design Spec

**Date**: 2026-03-30
**Status**: Approved
**Scope**: Visual upgrade to TeamCard component in GameDaySection

## Overview

Elevate the Game Day team cards from flat data cards to cinematic sport-forward cards. Add atmospheric sport photography, real team logos, sport type badges, opponent-forward titles, and wider card layout.

## Changes

### 1. Photo Strip (h-36)

Each card gets a full-bleed atmospheric photo at the top, mapped by sport type:

| Sport value | Photo file | Description |
|-------------|-----------|-------------|
| basketball | basketball.jpg | Court + arena lights, wide angle |
| baseball | baseball.jpg | Infield at dusk, grass texture |
| soccer | soccer.jpg | Pitch at night, stadium glow |
| football | football.jpg | Stadium aerial at night |
| hockey | hockey.jpg | Ice surface, cold blue cast |
| volleyball | volleyball.jpg | Court overhead |
| lacrosse | lacrosse.jpg | Field at dusk |
| multi | multi.jpg | Generic stadium crowd aerial |
| (default) | — | Team accent color gradient fallback |

Photos stored at `/public/sports/`. Mapped from `TeamConfig.sport` field. Alternative sports (roller-derby, racing, motocross, etc.) use the accent gradient fallback until photos are sourced.

**Gradient overlay**: `absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/70 to-transparent`

**Fallback**: If no sport photo or SmartImage errors, render team accent color gradient with subtle diagonal texture (same h-36 height).

### 2. Team Logo (48px, overlapping)

Position: `absolute -bottom-5 left-3 z-10` on the photo strip container.
Size: `w-12 h-12 rounded-full`
Style: `bg-[var(--night)] shadow-card-sm border border-[var(--twilight)]/60 p-1.5`

Logo sources (update `teams-config.ts` logoUrl):
- Hawks: `https://cdn.nba.com/logos/nba/1610612737/global/D/logo.svg`
- Braves: `https://www.mlbstatic.com/team-logos/share/144.jpg`
- All others: keep current `/teams/*.svg` placeholders (colored circles with letters)

A `h-6` spacer div in the card header prevents logo-text overlap.

### 3. Sport Type Pill

Position: `absolute bottom-2 right-2 z-10` on the photo strip container.
Style: `px-2 py-0.5 rounded font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--night)]/70 backdrop-blur-sm text-[var(--cream)]/80`
Content: `team.sport` label (capitalize first letter, map "multi" → "College")

Sits alongside the existing league badge (NBA, MLS, etc.) which stays in the header. Sport pill = activity type, league badge = competitive context.

### 4. Opponent-Forward Game Titles

Current: "Atlanta Braves vs. Athletics" — redundant since the card already shows "Braves".
New: "vs. Athletics" — just the opponent.

```ts
function formatOpponent(title: string, shortName: string): string {
  const vsMatch = title.match(/\s+vs\.?\s+/i);
  if (!vsMatch) return title;
  const parts = title.split(vsMatch[0]);
  const isHomeFirst = parts[0].toLowerCase().includes(shortName.toLowerCase());
  const opponent = isHomeFirst ? parts[1] : parts[0];
  return `vs. ${opponent.trim()}`;
}
```

Apply to both `nextGame` and `upcoming` rows.

### 5. Card Width: 288px (w-72)

Update `CARD_WIDTH` from 256 to 288. Update scroll math for dot indicators. Matches the standard carousel card width from component recipes.

### 6. Sport Photo Mapping

Add to `teams-config.ts`:

```ts
/** Maps sport type to atmospheric photo filename */
export const SPORT_PHOTOS: Record<string, string> = {
  basketball: "/sports/basketball.jpg",
  baseball: "/sports/baseball.jpg",
  soccer: "/sports/soccer.jpg",
  football: "/sports/football.jpg",
  hockey: "/sports/hockey.jpg",
  volleyball: "/sports/volleyball.jpg",
  lacrosse: "/sports/lacrosse.jpg",
  multi: "/sports/multi.jpg",
  ultimate: "/sports/multi.jpg",
};
```

### Card Wireframe

```
┌────────────────────────────────────────────────┐
│  [PHOTO STRIP — h-36, relative]                │
│  SmartImage: /sports/{sport}.jpg, object-cover  │
│  Gradient: h-20 from --night to transparent     │
│                                                  │
│  [LOGO] ←absolute -bottom-5 left-3              │
│  w-12 h-12 circle, --night bg                   │
│                                                  │
│            [SPORT PILL] ← absolute bottom-2 right-2
│            "Baseball"                            │
└──────────────────────────────────────────────────┘
│  [h-6 spacer for logo overlap]                  │
│                                                  │
│  Braves                             MLB          │
│  text-base font-semibold            mono badge   │
│                                                  │
│  vs. Athletics                                   │
│  text-sm font-semibold --cream                   │
│  ┌────────┐ ┌─────────┐                         │
│  │TONIGHT │ │ 7:15pm  │                         │
│  └────────┘ └─────────┘                         │
│  Truist Park                                     │
│                                                  │
│  ─────────────── divider ───────────────        │
│  vs. Red Sox    · Apr 5  · 1:35pm               │
│  vs. Rays       · Apr 6  · 7:10pm               │
│  vs. Yankees    · Apr 8  · 7:05pm               │
│                                                  │
│  +4 more →                                       │
└──────────────────────────────────────────────────┘
```

## Files to Modify

- `web/components/feed/sections/GameDaySection.tsx` — TeamCard redesign, CARD_WIDTH, formatOpponent, skeleton update
- `web/lib/teams-config.ts` — add SPORT_PHOTOS map, update Hawks/Braves logoUrl to CDN URLs

## New Assets

- `web/public/sports/basketball.jpg` — ~100KB, 800x400px landscape
- `web/public/sports/baseball.jpg`
- `web/public/sports/soccer.jpg`
- `web/public/sports/football.jpg`
- `web/public/sports/hockey.jpg`
- `web/public/sports/volleyball.jpg`
- `web/public/sports/lacrosse.jpg`
- `web/public/sports/multi.jpg`

Photos should be generic atmospheric shots with no identifiable players or copyrighted branding. Dark/moody tonality preferred to blend with the `--night` card body.

## Out of Scope

- Opponent team logos — text-only for now, slot reserved in markup
- Per-team action shots (too many assets to source)
- Real logos for college/minor/alternative teams (keep SVG placeholders)
