# Game Day Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Game Day team cards from flat data cards to cinematic sport-forward cards with atmospheric photos, real logos, sport badges, and opponent-forward titles.

**Architecture:** Sport photos in `/public/sports/`, mapped via `SPORT_PHOTOS` in teams-config. Card layout redesigned with photo strip (h-36), overlapping logo (48px), sport pill, and `formatOpponent()` for cleaner titles. Card width bumped to 288px.

**Tech Stack:** SmartImage for photo rendering with fallback, existing design tokens, no new dependencies.

**Spec:** `docs/superpowers/specs/2026-03-30-game-day-card-redesign.md`

---

### Task 1: Sport Photos and Config Updates

**Files:**
- Create: `web/public/sports/` — 8 atmospheric sport photos
- Modify: `web/lib/teams-config.ts` — add `SPORT_PHOTOS` map, update Hawks/Braves logo URLs

- [ ] **Step 1: Create sport photo placeholders**

We need 8 dark, atmospheric sport photos at roughly 800x400px. Since we can't download from external sources, generate solid gradient placeholder images that will be replaced with real photos later. Use the canvas-design skill or create simple SVG files:

```bash
mkdir -p web/public/sports
```

For each sport, create a dark gradient SVG that evokes the sport's atmosphere:

| File | Dominant color | Secondary |
|------|---------------|-----------|
| basketball.jpg | #1a0a0a (warm dark) | #8B2500 (court amber) |
| baseball.jpg | #0a1a0a (green dark) | #2d5016 (grass) |
| soccer.jpg | #0a0a1a (blue dark) | #1a4a2a (pitch green) |
| football.jpg | #0f0f14 (deep night) | #1a1a30 (stadium blue) |
| hockey.jpg | #0a1a2a (ice blue dark) | #1a3a5a (cold blue) |
| volleyball.jpg | #1a0f0a (warm amber) | #3a2a1a (court) |
| lacrosse.jpg | #0a1a0a (green dark) | #2a3a1a (field) |
| multi.jpg | #0f0f14 (deep night) | #1a1a1a (neutral) |

Create as SVGs (they'll be served by SmartImage fine):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 400">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="DOMINANT"/>
      <stop offset="100%" stop-color="SECONDARY"/>
    </linearGradient>
  </defs>
  <rect width="800" height="400" fill="url(#g)"/>
</svg>
```

Name them with `.jpg` extension even though they're SVGs — SmartImage handles both. Or better, use `.svg` extension and update the SPORT_PHOTOS map to match.

- [ ] **Step 2: Add SPORT_PHOTOS map to teams-config.ts**

Add after the `GROUP_LABELS` export:

```ts
/** Maps sport type to atmospheric photo path. Fallback: team accent gradient. */
export const SPORT_PHOTOS: Record<string, string> = {
  basketball: "/sports/basketball.svg",
  baseball: "/sports/baseball.svg",
  soccer: "/sports/soccer.svg",
  football: "/sports/football.svg",
  hockey: "/sports/hockey.svg",
  volleyball: "/sports/volleyball.svg",
  lacrosse: "/sports/lacrosse.svg",
  multi: "/sports/multi.svg",
  ultimate: "/sports/multi.svg",
};

/** Capitalize sport name for display. Maps internal values to readable labels. */
export const SPORT_LABELS: Record<string, string> = {
  basketball: "Basketball",
  baseball: "Baseball",
  soccer: "Soccer",
  football: "Football",
  hockey: "Hockey",
  volleyball: "Volleyball",
  lacrosse: "Lacrosse",
  multi: "College",
  ultimate: "Ultimate",
  "roller-derby": "Roller Derby",
  racing: "Racing",
  motocross: "Motocross",
  "monster-trucks": "Monster Trucks",
  wrestling: "Wrestling",
  "bull-riding": "Bull Riding",
  esports: "Esports",
};
```

- [ ] **Step 3: Update Hawks and Braves logo URLs**

In the TEAMS array, update:

```ts
// Hawks — change from:
logoUrl: "/teams/hawks.svg",
// to:
logoUrl: "https://cdn.nba.com/logos/nba/1610612737/global/D/logo.svg",

// Braves — change from:
logoUrl: "/teams/braves.svg",
// to:
logoUrl: "https://www.mlbstatic.com/team-logos/share/144.jpg",
```

Keep all other teams on their `/teams/*.svg` placeholders.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add web/public/sports/ web/lib/teams-config.ts
git commit -m "feat(game-day): add sport photos, SPORT_PHOTOS map, real logo URLs for Hawks/Braves"
```

---

### Task 2: TeamCard Redesign

**Files:**
- Modify: `web/components/feed/sections/GameDaySection.tsx`

This is the core visual redesign. Changes:
1. `CARD_WIDTH` from 256 to 288
2. Photo strip (h-36) with SmartImage + gradient overlay + sport pill + overlapping logo
3. `formatOpponent()` helper for cleaner game titles
4. Updated skeleton loader
5. Sport pill on each card

- [ ] **Step 1: Update CARD_WIDTH**

```ts
const CARD_WIDTH = 288; // w-72 (was 256 / w-64)
```

- [ ] **Step 2: Add formatOpponent helper**

Add after the existing `formatShortDate` function:

```ts
/** Extract opponent name from full game title. "Atlanta Braves vs. Athletics" → "vs. Athletics" */
function formatOpponent(title: string, shortName: string): string {
  const vsMatch = title.match(/\s+vs\.?\s+/i);
  if (!vsMatch) return title;
  const idx = vsMatch.index!;
  const before = title.substring(0, idx).trim();
  const after = title.substring(idx + vsMatch[0].length).trim();
  const isHomeFirst = before.toLowerCase().includes(shortName.toLowerCase());
  const opponent = isHomeFirst ? after : before;
  return `vs. ${opponent}`;
}
```

- [ ] **Step 3: Add sport photo import**

Add to the imports from teams-config:

```ts
import {
  TEAMS,
  GROUP_LABELS,
  SPORT_PHOTOS,
  SPORT_LABELS,
  type TeamConfig,
  type TeamSchedule,
  type GameDayResponse,
} from "@/lib/teams-config";
```

- [ ] **Step 4: Redesign the TeamCard function**

Replace the entire `TeamCard` function with the new layout. Key changes:

**Photo strip** (replaces the old h-8 gradient band):
```tsx
{/* Photo strip */}
<div className="relative h-36 overflow-hidden">
  {sportPhoto ? (
    <SmartImage
      src={sportPhoto}
      alt=""
      fill
      sizes="288px"
      className="object-cover"
      fallback={
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg, ${team.accentColor}30 0%, var(--night) 100%)`,
          }}
        />
      }
    />
  ) : (
    <div
      className="absolute inset-0"
      style={{
        background: `linear-gradient(135deg, ${team.accentColor}30 0%, var(--night) 100%)`,
      }}
    />
  )}
  {/* Gradient fade into card body */}
  <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[var(--night)] via-[var(--night)]/70 to-transparent pointer-events-none" />
  {/* Sport pill */}
  <span className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded font-mono text-2xs font-bold uppercase tracking-wider bg-[var(--night)]/70 backdrop-blur-sm text-[var(--cream)]/80">
    {sportLabel}
  </span>
  {/* Team logo — overlapping card boundary */}
  <div className="absolute -bottom-5 left-3 z-10 w-12 h-12 rounded-full bg-[var(--night)] shadow-card-sm border border-[var(--twilight)]/60 p-1.5 flex items-center justify-center">
    <SmartImage
      src={team.logoUrl}
      alt={team.shortName}
      width={32}
      height={32}
      className="rounded-full object-contain"
      fallback={
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white"
          style={{ backgroundColor: team.accentColor }}
        >
          {team.shortName.charAt(0)}
        </div>
      }
    />
  </div>
</div>
```

**Card header** (with spacer for logo overlap):
```tsx
<div className="px-3 pt-1">
  {/* Spacer for overlapping logo */}
  <div className="h-6" />
  <div className="flex items-center gap-2">
    <span className="text-base font-semibold text-[var(--cream)] truncate flex-1 min-w-0">
      {team.shortName}
    </span>
    {team.league && (
      <span className="shrink-0 text-2xs font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--twilight)] text-[var(--muted)]">
        {team.league}
      </span>
    )}
  </div>
</div>
```

**Next game** — use `formatOpponent`:
```tsx
<p className="text-sm font-semibold text-[var(--cream)] group-hover:text-[var(--soft)] transition-colors truncate">
  {formatOpponent(team.nextGame.title, team.shortName)}
</p>
```

**Upcoming rows** — also use `formatOpponent`:
```tsx
<span className="text-xs text-[var(--muted)] group-hover:text-[var(--soft)] transition-colors">
  {formatOpponent(game.title, team.shortName)}
  <span className="text-[var(--twilight)] mx-1">·</span>
  {formatShortDate(game.startDate)}
  {game.startTime && (
    <>
      <span className="text-[var(--twilight)] mx-1">·</span>
      {formatTime(game.startTime)}
    </>
  )}
</span>
```

**Card container** — update width class:
```tsx
<div className="flex-shrink-0 w-72 snap-start rounded-card overflow-hidden bg-[var(--night)] shadow-card-sm hover-lift border border-[var(--twilight)]/40">
```

The `sportPhoto` and `sportLabel` variables at the top of TeamCard:
```tsx
const sportPhoto = SPORT_PHOTOS[team.sport] ?? null;
const sportLabel = SPORT_LABELS[team.sport] ?? team.sport;
```

- [ ] **Step 5: Update skeleton loader**

Update the loading skeleton to reflect the new card shape (h-36 photo strip instead of h-8 band):

```tsx
<div
  key={i}
  className="flex-shrink-0 w-72 rounded-card overflow-hidden bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse"
>
  <div className="h-36 bg-[var(--twilight)]/20" />
  <div className="p-3 space-y-2.5">
    <div className="h-4 bg-[var(--twilight)]/30 rounded w-3/4" />
    <div className="space-y-1.5">
      <div className="h-3 bg-[var(--twilight)]/15 rounded w-full" />
      <div className="h-3 bg-[var(--twilight)]/15 rounded w-5/6" />
    </div>
  </div>
</div>
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add web/components/feed/sections/GameDaySection.tsx
git commit -m "feat(game-day): cinematic card redesign with sport photos, logos, opponent titles"
```

---

### Task 3: Browser QA

**Files:** None (verification only)

- [ ] **Step 1: Verify the feed loads**

Navigate to `http://localhost:3000/atlanta`, scroll to Game Day section. Verify:
- Cards now show the photo strip at top (gradient placeholders until real photos)
- Team logos render (Hawks should show NBA CDN logo, others show colored circle placeholders)
- Sport pills visible ("Basketball", "Baseball", "Soccer", etc.)
- Opponent names show as "vs. Athletics" not "Atlanta Braves vs. Athletics"
- Cards are wider (288px)
- Logo overlaps photo/card boundary cleanly

- [ ] **Step 2: Check console for errors**

No errors related to game-day, SmartImage, or missing assets.

- [ ] **Step 3: Verify card interactions**

- Click a game → navigates to event detail
- "+N more →" link works
- Carousel scrolls horizontally
- Gear icon opens customizer

- [ ] **Step 4: Commit any fixes**

```bash
git add -A && git commit -m "fix(game-day): QA fixes from card redesign testing"
```
