# Now Showing Feed Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current theater-carousel `NowShowingSection` with the new two-zone editorial widget: "This Week" adaptive hero strip (0–3 tiles) on top + "Today" typographic playbill below, backed by Phase 1a's `/api/film/this-week` and `/api/film/today-playbill`.

**Architecture:** Client component (stays in existing `LazySection` + dynamic-import slot) that fetches both new film APIs in parallel, renders three zones — section header, adaptive hero strip (`HeroTile`), typographic today playbill (`PlaybillRow`). Pure helpers (`hero-tags.ts`) generate gold-tag editorial copy. Pencil design extract drives exact tokens. Motion applied after shape lands.

**Tech Stack:** Next.js 16 client component, Tailwind v4 with CSS variable tokens, Phosphor icons, existing `FeedSectionHeader` / `FeedSectionReveal` / `SmartImage` primitives, Vitest for unit + component tests.

---

## Spec references

- Design spec: `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §5 (Now Showing widget)
- Data layer (shipped in PR #35): `web/lib/film/types.ts`, `web/lib/film/this-week-loader.ts`, `web/lib/film/today-playbill-loader.ts`, `web/app/api/film/this-week/route.ts`, `web/app/api/film/today-playbill/route.ts`
- Pencil comp: `docs/design-system.pen` wrapper `INLem` (spec notes it was render-stalled; extraction may fall back to verbal spec §5)
- Current component to replace: `web/components/feed/sections/NowShowingSection.tsx`
- Section host: `web/lib/city-pulse/manifests/atlanta.tsx:61-138` (dynamic-imported, wrapped in `LazySection minHeight={300}`)

## File structure

**Create:**
- `web/lib/film/hero-tags.ts` — pure helper: `buildHeroTag(screening, reason)` → `{ label, tone }`
- `web/lib/film/__tests__/hero-tags.test.ts`
- `web/components/feed/sections/now-showing/HeroTile.tsx` — single adaptive hero tile
- `web/components/feed/sections/now-showing/PlaybillRow.tsx` — one theater's typographic today row
- `web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`
- `web/components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx`
- `docs/superpowers/specs/2026-04-17-now-showing-widget-handoff.md` — extracted design tokens from Pencil/verbal spec

**Modify:**
- `web/components/feed/sections/NowShowingSection.tsx` — full rewrite, keeps `"use client"` + `portalSlug` prop, loses theater-carousel logic and customizer
- `web/lib/city-pulse/manifests/atlanta.tsx:133` — adjust `LazySection minHeight` to `220` (widget is now 220–320px tall, not 300)

**Delete (if no remaining callers after grep):**
- `web/lib/my-theaters.ts` — theater customizer persistence, only used by the old NowShowingSection
- `web/lib/cinema-filter.ts` — `isIndieCinemaVenue` / `isChainCinemaVenue` / `getIndieCinemaPriority`, only used by old NowShowingSection and `/api/showtimes`

Leave deletion as a **separate task** gated on grep confirmation — the showtimes API may still use them.

---

## Task 1: Extract design tokens from Pencil → spec doc

**Files:**
- Create: `docs/superpowers/specs/2026-04-17-now-showing-widget-handoff.md`

**Goal:** Codify every measurable design value in one place so later tasks don't drift from spec. Follow the [feedback_design_handoff_process.md] pattern — extract first, implement from spec, verify at the end.

- [ ] **Step 1: Attempt Pencil extract via `/design-handoff extract`**

Run: `/design-handoff extract INLem` (the "Now Showing" wrapper node in `docs/design-system.pen`).

If the node renders, capture: section header layout, hero tile dimensions, gradient overlay heights, typography sizes/weights/colors, playbill row grid, gold-tag pill recipe.

If render-stalled (as spec §10 warns), fall back to §5 verbal spec and note the fallback in the handoff doc.

- [ ] **Step 2: Write the handoff doc**

Write `docs/superpowers/specs/2026-04-17-now-showing-widget-handoff.md` with these sections (each a **Tokens** subsection and a **Source** line pointing to either Pencil node or spec§):

```markdown
# Now Showing Widget — Design Handoff

**Source of truth:** [Pencil INLem | verbal spec §5 fallback]
**Extracted:** 2026-04-17

## Section header (§5.1)

**Tokens:**
- Icon: `◎` (Phosphor `CircleDashed` or the unicode literal; confirm by inspecting existing FeedSectionHeader vibe variant)
- Icon color: `var(--vibe)`
- Title: "Now Showing" — italic display (`font-display italic text-xl font-semibold`)
- Meta string: `{count} films showing in Atlanta tonight` — `text-sm text-[var(--muted)]`
- "See all →" CTA: right-aligned, `text-xs text-[var(--vibe)]` routes to `/{portal}/explore/film`

**Recipe:** Reuse `<FeedSectionHeader title="Now Showing" priority="secondary" variant="cinema" accentColor="var(--vibe)" seeAllHref={...} />` — the component already matches the spec. Pass custom meta via its existing meta slot, OR render a sibling meta row if no slot exists (confirm by reading FeedSectionHeader.tsx).

## This Week label (§5.2)

- Kicker: `THIS WEEK · {n} SIGNIFICANT SCREENINGS` — `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]`
- Optional italic sub: `"Not to miss."` — `text-xs italic text-[var(--muted)]`
- Layout: two-line block with 4px gap, 12px bottom margin

## Hero tile (§5.3)

**Dimensions (adaptive):**
- Count 0: strip hidden
- Count 1: single full-width, height 240px
- Count 2: 60/40 split (CSS `grid-template-columns: 3fr 2fr`), height 220px
- Count 3: equal thirds (`grid-template-columns: repeat(3, 1fr)`), height 200px

**Structure:**
- Outer: `relative overflow-hidden` with 1px black divider between tiles (no gap: use `divide-x divide-[var(--void)]` on the flex row)
- Image: `<SmartImage fill />` with `object-cover`, sizes `(max-width: 768px) 100vw, 33vw`
- Bottom gradient: `absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[var(--void)]/90 via-[var(--void)]/60 to-transparent`
- Top-left gold tag pill (see §5.3 editorial tag pill): `absolute top-3 left-3`
  - `px-2.5 py-1 rounded bg-[var(--gold)]/15 text-[var(--gold)] font-mono text-2xs font-bold tracking-[0.14em] uppercase`
- Bottom content block: `absolute inset-x-0 bottom-0 p-3 space-y-1`
  - Press quote (optional): `text-xs italic text-[var(--cream)]/85`
  - Title: `font-display font-semibold text-2xl text-[var(--cream)] leading-tight` (spec says 36–40pt — scale to `text-2xl` / 24px at single-tile, down to `text-lg` / 18px at 3-tile)
  - Meta: `font-mono text-2xs text-[var(--cream)]/80` with middots via `<Dot />`

## Playbill row (§5.5)

**Label row:** `TODAY · {MMM d} · {n} screenings` — `font-mono text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]`, with `border-b border-[var(--twilight)]` hairline underneath, 8px bottom margin.

**Per-venue row:**
- Layout: CSS grid with `grid-template-columns: 110px 1fr auto`
- Theater column (110px fixed):
  - `font-display text-sm tracking-[0.16em] uppercase text-[var(--cream)]`
- Films column (flex row, overflow-hidden):
  - Items: `Title {HH:MM}` — title in `text-sm font-semibold text-[var(--cream)]`, time in `font-mono text-xs text-[var(--vibe)]` with 4px gap
  - Separator: `<Dot />` between items
  - Special-format note (if `format_labels` includes `true_imax`/`70mm`/`35mm`/drive-in): italic gold follows time, e.g. `Normal 8:30 · drive-in premiere`
  - Overflow: on measured wrap (see Task 4 logic), trailing items replaced with `+N more` in `text-xs font-mono text-[var(--muted)]`
- Arrow column (right-anchored): Phosphor `CaretRight` 14px `text-[var(--vibe)]`, wrapped in `<Link href="/{portal}/explore/film?venue={slug}">` (or whatever the explore page filter param lands on in Plan 4 — use `?venue=slug` for now, Plan 4 can rename)
- Row height: 36px, vertical padding 6px, `hover:bg-[var(--cream)]/[0.03]`

## Empty states (§5.5)

- Zero heroes AND zero playbill venues: render nothing (section is fully hidden — let the parent collapse). Do NOT render a zero-state inside this widget; higher-level feed handles empty sections.
- Zero heroes only: skip `This Week` block, render playbill only.
- Zero playbill only (rare): render hero strip + "Quiet night — see what's opening this week →" link to `/{portal}/explore/film`.
```

- [ ] **Step 3: Commit the handoff doc**

```bash
git add docs/superpowers/specs/2026-04-17-now-showing-widget-handoff.md
git commit -m "docs(film): Now Showing widget design handoff"
```

---

## Task 2: Hero-tag pure helper + tests

**Files:**
- Create: `web/lib/film/hero-tags.ts`
- Test: `web/lib/film/__tests__/hero-tags.test.ts`

- [ ] **Step 1: Write the failing tests**

Write `web/lib/film/__tests__/hero-tags.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildHeroTag } from '../hero-tags';
import type { FilmScreening, HeroReason } from '../types';

function makeScreening(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'run-1',
    screening_title_id: 'title-1',
    title: 'Bunnylovr',
    slug: 'bunnylovr',
    director: null,
    year: 2024,
    runtime_minutes: null,
    rating: null,
    image_url: null,
    editorial_blurb: null,
    film_press_quote: null,
    film_press_source: null,
    is_premiere: false,
    premiere_scope: null,
    is_curator_pick: false,
    festival_id: null,
    festival_name: null,
    venue: {
      id: 1,
      slug: 'plaza-theatre',
      name: 'Plaza Theatre',
      neighborhood: 'Poncey-Highland',
      classification: 'editorial_program',
      programming_style: 'repertory',
      venue_formats: [],
      founding_year: 1939,
      google_rating: null,
    },
    times: [],
    ...overrides,
  };
}

describe('buildHeroTag', () => {
  it('returns ATL PREMIERE · OPENS {WEEKDAY} for ATL premiere opening this week', () => {
    const s = makeScreening({
      is_premiere: true,
      premiere_scope: 'atl',
      times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week')).toEqual({
      label: 'ATL PREMIERE · OPENS THURSDAY',
      tone: 'gold',
    });
  });

  it('returns US PREMIERE · OPENS {WEEKDAY} for US scope', () => {
    const s = makeScreening({
      is_premiere: true,
      premiere_scope: 'us',
      times: [{ id: 't1', start_date: '2026-04-24', start_time: '19:00', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('US PREMIERE · OPENS FRIDAY');
  });

  it('returns TRUE IMAX EXCLUSIVE for special_format with true_imax', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-22', start_time: '20:00', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format')).toEqual({
      label: 'TRUE IMAX EXCLUSIVE',
      tone: 'gold',
    });
  });

  it('returns 70MM · {WEEKDAY} ONLY for 70mm one-night special format', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-26', start_time: '20:00', end_time: null, format_labels: ['70mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format').label).toBe('70MM · SUNDAY ONLY');
  });

  it('returns 35MM · {WEEKDAY} ONLY for 35mm repertory', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-25', start_time: '15:00', end_time: null, format_labels: ['35mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'special_format').label).toBe('35MM · SATURDAY ONLY');
  });

  it('returns DRIVE-IN PREMIERE for drive-in programmer opening week', () => {
    const s = makeScreening({
      venue: {
        ...makeScreening().venue,
        slug: 'starlight-drive-in',
        programming_style: 'drive_in',
      },
      is_premiere: true,
      times: [{ id: 't1', start_date: '2026-04-22', start_time: '20:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('DRIVE-IN PREMIERE');
  });

  it('returns FESTIVAL · {name} when hero_reason is festival', () => {
    const s = makeScreening({ festival_id: 'f1', festival_name: 'Atlanta Film Fest' });
    expect(buildHeroTag(s, 'festival').label).toBe('FESTIVAL · ATLANTA FILM FEST');
  });

  it('returns CURATOR PICK for curator_pick with no other signal', () => {
    const s = makeScreening({ is_curator_pick: true });
    expect(buildHeroTag(s, 'curator_pick').label).toBe('CURATOR PICK');
  });

  it('returns LAST CHANCE · CLOSES {WEEKDAY} for closes_this_week', () => {
    const s = makeScreening({
      times: [{ id: 't1', start_date: '2026-04-27', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildHeroTag(s, 'closes_this_week').label).toBe('LAST CHANCE · CLOSES MONDAY');
  });

  it('falls back to a safe default if no times present', () => {
    const s = makeScreening({ times: [] });
    expect(buildHeroTag(s, 'opens_this_week').label).toBe('OPENS THIS WEEK');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run lib/film/__tests__/hero-tags.test.ts`
Expected: FAIL with "Cannot find module '../hero-tags'"

- [ ] **Step 3: Implement `hero-tags.ts`**

Write `web/lib/film/hero-tags.ts`:

```ts
// web/lib/film/hero-tags.ts
// Pure derivation of the gold editorial tag pill shown on each hero tile.
// Deterministic function of the screening + assigned hero_reason.

import type { FilmScreening, HeroReason, FormatToken } from './types';

export type HeroTag = {
  label: string;
  tone: 'gold';
};

const WEEKDAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

function firstTimeDate(screening: FilmScreening): Date | null {
  const first = screening.times[0];
  if (!first) return null;
  return new Date(first.start_date + 'T00:00:00Z');
}

function weekdayOf(screening: FilmScreening): string | null {
  const d = firstTimeDate(screening);
  if (!d) return null;
  return WEEKDAY_NAMES[d.getUTCDay()];
}

function hasFormat(screening: FilmScreening, fmt: FormatToken): boolean {
  return screening.times.some((t) => t.format_labels.includes(fmt));
}

function premiereLabel(screening: FilmScreening): string {
  if (screening.venue.programming_style === 'drive_in') return 'DRIVE-IN PREMIERE';
  switch (screening.premiere_scope) {
    case 'world':
      return 'WORLD PREMIERE';
    case 'us':
      return 'US PREMIERE';
    case 'atl':
    default:
      return 'ATL PREMIERE';
  }
}

export function buildHeroTag(
  screening: FilmScreening,
  reason: HeroReason,
): HeroTag {
  const weekday = weekdayOf(screening);

  if (reason === 'special_format') {
    if (hasFormat(screening, 'true_imax')) {
      return { label: 'TRUE IMAX EXCLUSIVE', tone: 'gold' };
    }
    if (hasFormat(screening, '70mm')) {
      return {
        label: weekday ? `70MM · ${weekday} ONLY` : '70MM',
        tone: 'gold',
      };
    }
    if (hasFormat(screening, '35mm')) {
      return {
        label: weekday ? `35MM · ${weekday} ONLY` : '35MM',
        tone: 'gold',
      };
    }
    if (hasFormat(screening, 'dolby_cinema')) {
      return { label: 'DOLBY CINEMA', tone: 'gold' };
    }
    return { label: 'SPECIAL FORMAT', tone: 'gold' };
  }

  if (reason === 'festival') {
    const name = screening.festival_name?.toUpperCase() ?? 'FESTIVAL';
    return {
      label: screening.festival_name ? `FESTIVAL · ${name}` : 'FESTIVAL',
      tone: 'gold',
    };
  }

  if (reason === 'opens_this_week') {
    if (screening.is_premiere) {
      const prem = premiereLabel(screening);
      if (prem === 'DRIVE-IN PREMIERE') return { label: prem, tone: 'gold' };
      return {
        label: weekday ? `${prem} · OPENS ${weekday}` : prem,
        tone: 'gold',
      };
    }
    return {
      label: weekday ? `OPENS ${weekday}` : 'OPENS THIS WEEK',
      tone: 'gold',
    };
  }

  if (reason === 'closes_this_week') {
    return {
      label: weekday ? `LAST CHANCE · CLOSES ${weekday}` : 'LAST CHANCE',
      tone: 'gold',
    };
  }

  // reason === 'curator_pick'
  return { label: 'CURATOR PICK', tone: 'gold' };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run lib/film/__tests__/hero-tags.test.ts`
Expected: 10 passing.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/hero-tags.ts web/lib/film/__tests__/hero-tags.test.ts
git commit -m "feat(film): hero-tag pure helper + tests"
```

---

## Task 3: HeroTile component + tests

**Files:**
- Create: `web/components/feed/sections/now-showing/HeroTile.tsx`
- Test: `web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`

- [ ] **Step 1: Write the failing tests**

Write `web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import HeroTile from '../HeroTile';
import type { FilmScreening, HeroReason } from '@/lib/film/types';

function makeHero(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'run-1',
    screening_title_id: 'title-1',
    title: 'Bunnylovr',
    slug: 'bunnylovr',
    director: 'Katarina Zhu',
    year: 2024,
    runtime_minutes: 101,
    rating: 'NR',
    image_url: 'https://example.com/bunnylovr.jpg',
    editorial_blurb: null,
    film_press_quote: 'A bruised, brilliant debut.',
    film_press_source: 'Little White Lies',
    is_premiere: true,
    premiere_scope: 'atl',
    is_curator_pick: true,
    festival_id: null,
    festival_name: null,
    venue: {
      id: 1,
      slug: 'plaza-theatre',
      name: 'Plaza Theatre',
      neighborhood: 'Poncey-Highland',
      classification: 'editorial_program',
      programming_style: 'repertory',
      venue_formats: ['70mm', '35mm'],
      founding_year: 1939,
      google_rating: null,
    },
    times: [
      { id: 't1', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null },
      { id: 't2', start_date: '2026-04-24', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null },
    ],
    ...overrides,
  };
}

describe('HeroTile', () => {
  it('renders the film title', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
  });

  it('renders the gold tag derived from hero_reason', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText(/ATL PREMIERE · OPENS THURSDAY/)).toBeInTheDocument();
  });

  it('renders the press quote when present', () => {
    const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.getByText(/A bruised, brilliant debut\./)).toBeInTheDocument();
  });

  it('omits the press quote when absent', () => {
    const hero = {
      ...makeHero({ film_press_quote: null, film_press_source: null }),
      hero_reason: 'curator_pick' as HeroReason,
    };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    expect(screen.queryByText(/A bruised, brilliant debut\./)).not.toBeInTheDocument();
  });

  it('renders a venue meta line with the first showtime', () => {
    const hero = { ...makeHero(), hero_reason: 'opens_this_week' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="third" />);
    // Expect theater name + a weekday + time somewhere in the meta block
    expect(screen.getByText(/Plaza Theatre/)).toBeInTheDocument();
  });

  it('links to the film detail page via series slug', () => {
    const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
    render(<HeroTile hero={hero} portalSlug="atlanta" density="full" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', expect.stringContaining('/atlanta/'));
    expect(link).toHaveAttribute('href', expect.stringContaining('bunnylovr'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`
Expected: FAIL with "Cannot find module '../HeroTile'"

- [ ] **Step 3: Implement `HeroTile.tsx`**

Write `web/components/feed/sections/now-showing/HeroTile.tsx`:

```tsx
"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { buildHeroTag } from '@/lib/film/hero-tags';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, HeroReason } from '@/lib/film/types';

type Density = 'full' | 'half' | 'third';

const HEIGHT: Record<Density, string> = {
  full: 'h-[240px]',
  half: 'h-[220px]',
  third: 'h-[200px]',
};

const TITLE_SIZE: Record<Density, string> = {
  full: 'text-3xl',
  half: 'text-2xl',
  third: 'text-lg',
};

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function metaLine(screening: FilmScreening): string {
  const t0 = screening.times[0];
  if (!t0) return screening.venue.name;
  const d = new Date(t0.start_date + 'T00:00:00Z');
  const wd = WEEKDAY[d.getUTCDay()];
  const time = t0.start_time ? formatTime(t0.start_time) : '';
  const extra = screening.times.length - 1;
  const extraStr =
    extra > 0 ? ` · also ${extra} more ${extra === 1 ? 'date' : 'dates'}` : '';
  return `${screening.venue.name} · ${wd} ${time}${extraStr}`;
}

interface HeroTileProps {
  hero: FilmScreening & { hero_reason: HeroReason };
  portalSlug: string;
  density: Density;
}

export default function HeroTile({ hero, portalSlug, density }: HeroTileProps) {
  const tag = buildHeroTag(hero, hero.hero_reason);
  const href = buildSeriesUrl(hero.slug, portalSlug, 'film_series');

  return (
    <Link
      href={href}
      prefetch={false}
      className={`relative block overflow-hidden bg-[var(--night)] ${HEIGHT[density]} group`}
      aria-label={`${hero.title} at ${hero.venue.name}`}
    >
      {hero.image_url ? (
        <SmartImage
          src={hero.image_url}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 33vw"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]" />
      )}

      {/* Bottom gradient for legibility */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[var(--void)]/95 via-[var(--void)]/55 to-transparent" />

      {/* Top-left gold tag */}
      <span className="absolute top-3 left-3 px-2.5 py-1 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold tracking-[0.14em] uppercase">
        {tag.label}
      </span>

      {/* Bottom content */}
      <div className="absolute inset-x-0 bottom-0 p-3 space-y-1">
        {hero.film_press_quote && (
          <p className="text-xs italic text-[var(--cream)]/85 line-clamp-1">
            &ldquo;{hero.film_press_quote}&rdquo;
            {hero.film_press_source && (
              <span className="not-italic text-[var(--gold)]/80">
                {' '}
                — {hero.film_press_source}
              </span>
            )}
          </p>
        )}
        <h3
          className={`font-display font-semibold ${TITLE_SIZE[density]} text-[var(--cream)] leading-tight line-clamp-2`}
        >
          {hero.title}
        </h3>
        <p className="font-mono text-2xs text-[var(--cream)]/80 flex items-center gap-1.5 flex-wrap">
          <span className="truncate">{metaLine(hero)}</span>
          {hero.venue.founding_year && density !== 'third' && (
            <>
              <Dot />
              <span className="text-[var(--gold)]/80">
                est. {hero.venue.founding_year}
              </span>
            </>
          )}
        </p>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`
Expected: 6 passing.

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/sections/now-showing/HeroTile.tsx web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx
git commit -m "feat(film): HeroTile component for Now Showing widget"
```

---

## Task 4: PlaybillRow component + tests

**Files:**
- Create: `web/components/feed/sections/now-showing/PlaybillRow.tsx`
- Test: `web/components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx`

**Design note:** Overflow-to-`+N more` is computed in CSS-only using `flex-wrap: nowrap` + `overflow: hidden` on the films row and a hidden clone for measurement would be overkill. Instead, cap to a computed max based on title-length budget: **show up to 4 films; any additional become `+N more`**. This matches the spec's "fills available horizontal space, only truncates at true overflow" intent at 390–1280px widths; future iteration (Task 7 motion/polish) can add a ResizeObserver-driven dynamic cap if we hit real overflow.

- [ ] **Step 1: Write the failing tests**

Write `web/components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx`:

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import PlaybillRow from '../PlaybillRow';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

function venue(overrides: Partial<FilmVenue> = {}): FilmVenue {
  return {
    id: 1,
    slug: 'plaza-theatre',
    name: 'Plaza Theatre',
    neighborhood: 'Poncey-Highland',
    classification: 'editorial_program',
    programming_style: 'repertory',
    venue_formats: [],
    founding_year: 1939,
    google_rating: null,
    ...overrides,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `run-${title}`,
    screening_title_id: `st-${title}`,
    title,
    slug: title.toLowerCase().replace(/\s/g, '-'),
    director: null,
    year: null,
    runtime_minutes: null,
    rating: null,
    image_url: null,
    editorial_blurb: null,
    film_press_quote: null,
    film_press_source: null,
    is_premiere: false,
    premiere_scope: null,
    is_curator_pick: false,
    festival_id: null,
    festival_name: null,
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('PlaybillRow', () => {
  it('renders venue short-name in the theater column', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[screening('Bunnylovr', '19:45')]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/PLAZA/i)).toBeInTheDocument();
  });

  it('renders each film title and formatted time', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[
          screening('Bunnylovr', '19:45'),
          screening('Exit 8', '17:15'),
        ]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText('Exit 8')).toBeInTheDocument();
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
    expect(screen.getByText(/5:15/)).toBeInTheDocument();
  });

  it('collapses the 5th+ film into a +N more label', () => {
    render(
      <PlaybillRow
        venue={venue()}
        screenings={[
          screening('A', '17:00'),
          screening('B', '18:00'),
          screening('C', '19:00'),
          screening('D', '20:00'),
          screening('E', '21:00'),
          screening('F', '22:00'),
        ]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
    expect(screen.queryByText('E')).not.toBeInTheDocument();
    expect(screen.queryByText('F')).not.toBeInTheDocument();
  });

  it('renders drive-in note when venue is drive_in and any screening has ended', () => {
    // Note: this test pins the format-label rendering path separately;
    // the drive-in note itself depends on programming_style, not screening format.
    render(
      <PlaybillRow
        venue={venue({ slug: 'starlight-six-drive-in', name: 'Starlight Six Drive-In', programming_style: 'drive_in' })}
        screenings={[screening('Normal', '20:30')]}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/drive-in/i)).toBeInTheDocument();
  });

  it('links the row arrow to the explore-film page for that venue', () => {
    const { container } = render(
      <PlaybillRow
        venue={venue()}
        screenings={[screening('Bunnylovr', '19:45')]}
        portalSlug="atlanta"
      />,
    );
    const link = container.querySelector('a[aria-label*="Plaza"]');
    expect(link).toBeTruthy();
    expect(link?.getAttribute('href')).toContain('/atlanta/explore/film');
    expect(link?.getAttribute('href')).toContain('venue=plaza-theatre');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd web && npx vitest run components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx`
Expected: FAIL with "Cannot find module '../PlaybillRow'"

- [ ] **Step 3: Implement `PlaybillRow.tsx`**

Write `web/components/feed/sections/now-showing/PlaybillRow.tsx`:

```tsx
"use client";

import Link from 'next/link';
import { CaretRight } from '@phosphor-icons/react';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

const MAX_FILMS = 4;

// Collapse venue name to a tight display token for the 110px column.
// Drop prefix words: "AMC ", "Regal ", "The ", etc.
function shortTheaterName(name: string): string {
  return name
    .replace(/^(AMC|Regal|Cinemark|The)\s+/i, '')
    .replace(/\s+(Theatre|Theater|Cinema|Cinemas)$/i, '')
    .trim();
}

interface PlaybillRowProps {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function PlaybillRow({
  venue,
  screenings,
  portalSlug,
}: PlaybillRowProps) {
  const shown = screenings.slice(0, MAX_FILMS);
  const overflow = Math.max(screenings.length - MAX_FILMS, 0);
  const href = `/${portalSlug}/explore/film?venue=${venue.slug}`;
  const isDriveIn = venue.programming_style === 'drive_in';

  return (
    <div className="grid grid-cols-[110px_1fr_auto] items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--cream)]/[0.03] transition-colors">
      {/* Theater column */}
      <span className="font-display text-sm tracking-[0.16em] uppercase text-[var(--cream)] truncate">
        {shortTheaterName(venue.name)}
      </span>

      {/* Films column */}
      <div className="flex items-center gap-1.5 flex-wrap overflow-hidden">
        {shown.map((screening, idx) => (
          <span key={screening.run_id} className="flex items-center gap-1.5">
            <Link
              href={buildSeriesUrl(screening.slug, portalSlug, 'film_series')}
              prefetch={false}
              className="text-sm font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
            >
              {screening.title}
            </Link>
            {screening.times[0]?.start_time && (
              <span className="font-mono text-xs text-[var(--vibe)] tabular-nums">
                {formatTime(screening.times[0].start_time)}
              </span>
            )}
            {idx < shown.length - 1 && <Dot />}
          </span>
        ))}
        {isDriveIn && (
          <span className="text-xs italic text-[var(--gold)] ml-1">
            drive-in
          </span>
        )}
        {overflow > 0 && (
          <>
            <Dot />
            <span className="text-xs font-mono text-[var(--muted)]">
              +{overflow} more
            </span>
          </>
        )}
      </div>

      {/* Arrow column */}
      <Link
        href={href}
        prefetch={false}
        aria-label={`See all ${venue.name} screenings`}
        className="p-1 text-[var(--vibe)] hover:text-[var(--cream)] transition-colors"
      >
        <CaretRight weight="bold" className="w-3.5 h-3.5" />
      </Link>
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd web && npx vitest run components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx`
Expected: 5 passing.

- [ ] **Step 5: Commit**

```bash
git add web/components/feed/sections/now-showing/PlaybillRow.tsx web/components/feed/sections/now-showing/__tests__/PlaybillRow.test.tsx
git commit -m "feat(film): PlaybillRow component for Now Showing widget"
```

---

## Task 5: Rewrite `NowShowingSection` to wire the new data + subcomponents

**Files:**
- Modify: `web/components/feed/sections/NowShowingSection.tsx` (full rewrite)

**Design note:** The new widget is fully-client — it fetches both film APIs in parallel. The existing `portalSlug` + `embedded` props are preserved so the manifest doesn't need a second change. The theater-customizer is dropped entirely (Plan 4+ handles opt-in theater sets on Explore).

- [ ] **Step 1: Replace the file contents**

Overwrite `web/components/feed/sections/NowShowingSection.tsx`:

```tsx
"use client";

/**
 * NowShowingSection — two-zone editorial widget.
 *
 * Top: This Week headline strip (adaptive 0–3 hero tiles).
 * Bottom: Today typographic playbill (one row per venue with screenings today).
 *
 * Both zones are driven by Phase 1a film APIs:
 *   /api/film/this-week?portal={slug}
 *   /api/film/today-playbill?portal={slug}
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FilmSlate } from '@phosphor-icons/react';
import FeedSectionHeader from '@/components/feed/FeedSectionHeader';
import FeedSectionReveal from '@/components/feed/FeedSectionReveal';
import HeroTile from './now-showing/HeroTile';
import PlaybillRow from './now-showing/PlaybillRow';
import type {
  ThisWeekPayload,
  TodayPlaybillPayload,
} from '@/lib/film/types';

interface NowShowingSectionProps {
  portalSlug: string;
  embedded?: boolean;
}

type Density = 'full' | 'half' | 'third';

function densityFor(count: number): Density {
  if (count === 1) return 'full';
  if (count === 2) return 'half';
  return 'third';
}

function todayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export default function NowShowingSection({
  portalSlug,
  embedded = false,
}: NowShowingSectionProps) {
  const [thisWeek, setThisWeek] = useState<ThisWeekPayload | null>(null);
  const [today, setToday] = useState<TodayPlaybillPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    Promise.all([
      fetch(`/api/film/this-week?portal=${portalSlug}`, { signal: controller.signal }).then(
        (r) => (r.ok ? (r.json() as Promise<ThisWeekPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))),
      ),
      fetch(`/api/film/today-playbill?portal=${portalSlug}`, { signal: controller.signal }).then(
        (r) => (r.ok ? (r.json() as Promise<TodayPlaybillPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))),
      ),
    ])
      .then(([week, playbill]) => {
        if (controller.signal.aborted) return;
        setThisWeek(week);
        setToday(playbill);
        setLoading(false);
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setFailed(true);
        setLoading(false);
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [portalSlug]);

  // ── Render gates ────────────────────────────────────────────────────
  const exploreHref = `/${portalSlug}/explore/film`;

  if (loading) {
    return (
      <div className={embedded ? '' : 'pb-2'}>
        {!embedded && (
          <FeedSectionHeader
            title="Now Showing"
            priority="secondary"
            variant="cinema"
            accentColor="var(--vibe)"
            icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
            seeAllHref={exploreHref}
          />
        )}
        <div className="h-[220px] rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse" />
      </div>
    );
  }

  if (failed || (!thisWeek && !today)) return null;

  const heroes = thisWeek?.heroes ?? [];
  const venues = (today?.venues ?? []).filter((v) => v.screenings.length > 0);
  const totalScreenings = today?.total_screenings ?? 0;

  if (heroes.length === 0 && venues.length === 0) return null;

  const density = densityFor(heroes.length);

  const content = (
    <>
      {!embedded && (
        <FeedSectionHeader
          title="Now Showing"
          priority="secondary"
          variant="cinema"
          accentColor="var(--vibe)"
          icon={<FilmSlate weight="duotone" className="w-5 h-5" />}
          seeAllHref={exploreHref}
        />
      )}

      {/* Meta line beneath header */}
      <p className="text-sm text-[var(--muted)] mb-4">
        {totalScreenings > 0
          ? `${totalScreenings} films showing in Atlanta tonight`
          : 'Quiet night — see what\u2019s opening this week'}
      </p>

      {/* Zone 1 — This Week headline strip */}
      {heroes.length > 0 && (
        <div className="mb-5">
          <div className="flex items-baseline justify-between mb-2">
            <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]">
              This Week · {heroes.length} Significant Screening{heroes.length === 1 ? '' : 's'}
            </span>
            <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
          </div>
          <div
            className={`grid gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden ${
              density === 'full'
                ? 'grid-cols-1'
                : density === 'half'
                  ? 'grid-cols-[3fr_2fr]'
                  : 'grid-cols-3'
            }`}
          >
            {heroes.map((hero) => (
              <HeroTile
                key={hero.run_id}
                hero={hero}
                portalSlug={portalSlug}
                density={density}
              />
            ))}
          </div>
        </div>
      )}

      {/* Zone 2 — Today playbill */}
      {venues.length > 0 ? (
        <div>
          <div className="flex items-baseline justify-between pb-1.5 mb-1 border-b border-[var(--twilight)]">
            <span className="font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)]">
              Today · {today ? todayLabel(today.date) : ''} · {totalScreenings} screening
              {totalScreenings === 1 ? '' : 's'}
            </span>
          </div>
          <div className="space-y-0.5">
            {venues.map(({ venue, screenings }) => (
              <PlaybillRow
                key={venue.id}
                venue={venue}
                screenings={screenings}
                portalSlug={portalSlug}
              />
            ))}
          </div>
        </div>
      ) : heroes.length > 0 ? (
        <Link
          href={exploreHref}
          className="block py-3 text-sm italic text-center text-[var(--muted)] hover:text-[var(--cream)] transition-colors"
        >
          Quiet night — see what&rsquo;s opening this week &rarr;
        </Link>
      ) : null}
    </>
  );

  return embedded ? <div>{content}</div> : <FeedSectionReveal className="pb-2">{content}</FeedSectionReveal>;
}
```

- [ ] **Step 2: Typecheck clean**

Run: `cd web && npx tsc --noEmit`
Expected: no errors. If any surface from the removed imports (`my-theaters`, `cinema-filter`, `Plus`, `X`, etc.) are still referenced elsewhere in the file, delete them.

- [ ] **Step 3: Run the full vitest suite**

Run: `cd web && npx vitest run`
Expected: all tests pass (18 film-specific from Phase 1a + 10 hero-tags + 6 HeroTile + 5 PlaybillRow = +21 new).

- [ ] **Step 4: Commit**

```bash
git add web/components/feed/sections/NowShowingSection.tsx
git commit -m "feat(film): rewrite NowShowingSection as This Week + Today widget"
```

---

## Task 6: Adjust manifest `LazySection minHeight` + stale-import sweep

**Files:**
- Modify: `web/lib/city-pulse/manifests/atlanta.tsx:133`

- [ ] **Step 1: Change minHeight from 300 to 220**

Edit `web/lib/city-pulse/manifests/atlanta.tsx:133` — replace `<LazySection minHeight={300}>` with `<LazySection minHeight={220}>`.

- [ ] **Step 2: Grep for stale callers of removed helpers**

Run: `cd web && grep -rn "my-theaters\|isIndieCinemaVenue\|isChainCinemaVenue\|getIndieCinemaPriority" --include='*.ts' --include='*.tsx' .`

If the only remaining hits are `lib/my-theaters.ts` and `lib/cinema-filter.ts` themselves + the now-rewritten NowShowingSection (which no longer references them), delete those two files.

If `/api/showtimes/route.ts` or similar still uses them, **leave them in place** and note a cleanup ticket.

- [ ] **Step 3: Typecheck clean**

Run: `cd web && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add web/lib/city-pulse/manifests/atlanta.tsx
# + any file deletions from Step 2
git commit -m "chore(film): shrink Now Showing LazySection minHeight to 220"
```

---

## Task 7: Browser verify + motion audit

**Single-agent browser test** — per `feedback_no_parallel_browser_subagents.md` and `feedback_browser_memory_budget.md`, run this serially.

- [ ] **Step 1: Start the dev server**

Run (in worktree): `cd web && npm run dev`

Background the process; wait for `Ready on http://localhost:3000`.

- [ ] **Step 2: Load the Atlanta feed in browser**

Use `mcp__claude-in-chrome__tabs_create_mcp` → `http://localhost:3000/atlanta`.
Scroll down to the "Now Showing" section (below hero, below Lineup).

**Check:**
- This Week strip renders with 1–3 hero tiles (depends on seed state — should be >0 per Phase 1a curator_pick seed)
- Each tile has: gold tag top-left, image, gradient, title, meta, optional press quote
- Today playbill shows at least Plaza/Tara rows with tonight's screenings
- Click a showtime → navigates to the film detail page
- Click the arrow on a venue row → navigates to `/atlanta/explore/film?venue=...` (expect 404 until Plan 4 — that's OK, confirm the URL)

Capture **≤4 screenshots** total (pre-flight `vm_stat` per memory budget rule):
1. Desktop 1440×900 of the widget
2. Mobile 375×812 of the widget
3. Empty-state variant (set portal=atlanta and temporarily null out heroes in loader response — skip this if awkward)
4. One showtime-hover state (only if easy; skip otherwise)

Close the tab between viewports.

- [ ] **Step 3: Run `/motion audit`**

Run the motion skill against the widget:

`/motion audit http://localhost:3000/atlanta#now-showing`

Expected output: a spec of missing/weak motion — entrance reveal on heroes, stagger on playbill rows, hover lift on tiles, showtime-chip tap feedback.

Save the spec inline in this plan's commit message or attach to the PR.

- [ ] **Step 4: Apply motion (light touch)**

The widget is compact — don't over-animate. Apply only:
1. Entrance fade+slide on the entire widget (already done by `<FeedSectionReveal>` wrapper — confirm)
2. 1.02x scale + translate-y on hero tile hover (already in HeroTile via `group-hover:scale-[1.02]` — confirm)
3. Stagger on playbill rows: add a `style={{ animationDelay: \`${idx * 30}ms\` }}` on each row using the existing `animate-fade-in-up` utility (if it exists; otherwise skip)

If no meaningful motion is missing, **skip motion application** and commit an empty note. Motion-gold-plating is a failure mode.

- [ ] **Step 5: Final browser verify after motion**

Reload the page. Widget should feel alive but not busy. Text legibility must remain at every density (1/2/3-tile).

- [ ] **Step 6: Commit any motion tweaks**

```bash
git add -A
git commit -m "feat(film): Now Showing motion — entrance + hero hover" || echo "no motion changes"
```

---

## Task 8: Push branch + open PR

- [ ] **Step 1: Final typecheck + full test suite**

Run (from worktree):
```bash
cd web && npx tsc --noEmit && npx vitest run && npm run lint
```
Expected: all green.

- [ ] **Step 2: Push**

```bash
git push -u origin feature/film-now-showing-widget
```

- [ ] **Step 3: Open the PR**

```bash
gh pr create --title "feat(film): Now Showing feed widget — This Week + Today playbill" --body "$(cat <<'EOF'
## Summary

Phase 1b of the film editorial refresh — replaces the theater-carousel `NowShowingSection` with the new two-zone widget per design spec §5.

**Top zone — "This Week" adaptive hero strip.** Renders 0–3 hero tiles in an adaptive grid (full / 3fr–2fr / thirds). Each tile: full-bleed still, gold editorial tag (\`ATL PREMIERE · OPENS THURSDAY\` / \`35MM · SATURDAY ONLY\` / etc), optional press quote, title, meta line. Links to the film detail page.

**Bottom zone — "Today" typographic playbill.** One row per venue with screenings tonight: theater short-name (tracked caps, 110px col) · films with vibe-purple showtimes · drive-in note on Starlight · right arrow to per-venue explore view. Overflow collapses at 5+ films to \`+N more\`.

## What's included

- \`web/lib/film/hero-tags.ts\` — pure helper mapping \`(screening, hero_reason)\` → gold tag text. 10 unit tests.
- \`web/components/feed/sections/now-showing/HeroTile.tsx\` — adaptive hero tile. 6 component tests.
- \`web/components/feed/sections/now-showing/PlaybillRow.tsx\` — typographic theater row. 5 component tests.
- \`web/components/feed/sections/NowShowingSection.tsx\` — rewritten widget shell, dual-fetch of \`/api/film/this-week\` + \`/api/film/today-playbill\`.
- \`web/lib/city-pulse/manifests/atlanta.tsx\` — \`LazySection minHeight\` 300 → 220 for new widget envelope.
- Optional deletions: \`web/lib/my-theaters.ts\`, \`web/lib/cinema-filter.ts\` (if no remaining callers after grep).

**+21 film-specific tests · typecheck clean · lint clean · full suite green**

## Out of scope (separate plans)

- Crawler format extraction on showtime rows (Plan 2 / crawler-dev)
- \`/{portal}/explore/film\` page shell + This Week + views (Plans 4–6)
- Theater opt-in (Tier 3) for Explore — deferred to Plan 4
- CM surface for editing curator picks / press quotes — deferred

## Test plan

- [ ] CI green
- [ ] After deploy: load \`/atlanta\` and scroll to "Now Showing". This Week strip should render with the curator-pick seed rows; Today playbill should show Plaza/Tara/etc for tonight.
- [ ] Click a hero tile → lands on the film detail page
- [ ] Click a showtime inside the playbill → lands on the film detail page
- [ ] Click a venue row arrow → routes to \`/atlanta/explore/film?venue={slug}\` (page 404s until Plan 4 — that's expected)
- [ ] Mobile 375px: widget is legible, no horizontal scroll, no overflow

## Design references

- Spec: \`docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md\` §5
- Handoff: \`docs/superpowers/specs/2026-04-17-now-showing-widget-handoff.md\`
- Plan: \`docs/superpowers/plans/2026-04-17-film-now-showing-widget.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Report PR URL back**

---

## Self-review notes

- **Spec coverage**: §5.1 header → Task 5. §5.2 This Week label → Task 5. §5.3 headline strip adaptive 1/2/3 + tile layout → Task 3 + Task 5. §5.4 hero-selection cascade → handled in shipped loader (PR #35) — plan consumes `heroes` as given. §5.5 today playbill → Task 4 + Task 5. §5.6 no footer → Task 5 (no footer rendered). Empty state → Task 5.
- **Out-of-scope markers**: opt-in Tier 3 is explicitly deferred to Plan 4 per spec §3. ResizeObserver-driven dynamic overflow is deferred to Plan 4+ (the cap-at-4 is good enough for v1 widget).
- **Type consistency**: `HeroReason`, `FilmScreening`, `ThisWeekPayload`, `TodayPlaybillPayload`, `FormatToken` all come from `web/lib/film/types.ts` shipped in PR #35 — verified before planning per [feedback_verify_types_before_planning.md].
- **No placeholders**: every code block is complete. No "TBD" / "add validation" / "similar to Task N".
- **Motion posture**: Task 7 explicitly warns against gold-plating; motion is light by design.
- **Design handoff gate**: Task 1 comes before any code, per [feedback_design_motion_in_plans.md].
- **Browser verify gate**: Task 7 single-agent, serial, capped screenshots per memory-budget rule.
