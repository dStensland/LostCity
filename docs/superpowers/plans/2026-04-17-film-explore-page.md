# `/{portal}/explore/film` Page — Shell + This Week + By Theater

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a usable `/{portal}/explore/film` page: breadcrumb + title + 14-day date strip + view toggle + global filter chips + "This Week" hero triptych + **By Theater** view (Tier 1 programmer's board + Tier 2 premium-format blocks).

**Architecture:** Server RSC page resolves portal → imports `loadThisWeek` + `loadTodayPlaybill` server loaders directly (no self-fetch). Client shell owns `selectedDate` + filter state; child view components receive filtered data via props. By Film + Schedule views land in Plans 5 & 6 — their toggle buttons render as disabled "coming soon" stubs in this plan. Tier 3 (opt-in additional theaters) is deferred to its own task after this plan if confirmed in-scope.

**Tech Stack:** Next.js 16 App Router RSC + client islands, Tailwind v4 tokens, Phosphor icons, existing `FilterChip` / `SmartImage` / `Dot` primitives, Vitest + React Testing Library.

---

## Spec references

- Design spec: `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6.1 (shell), §6.2 (This Week), §6.3 (By Theater), §7 (cross-view rules)
- Data layer (shipped in PR #35): `web/lib/film/types.ts`, `loadThisWeek`, `loadTodayPlaybill` (`date` arg supported), `/api/film/this-week`, `/api/film/today-playbill`
- Feed widget (shipped in PR #36): `web/components/feed/sections/now-showing/{HeroTile,PlaybillRow}.tsx` — `HeroTile` will be reused with a new `'hero-large'` density; `PlaybillRow` stays feed-only.
- Existing routing pattern: `web/app/[portal]/explore/page.tsx` uses `resolvePortalRequest` + `ExploreSurface` — copy this pattern for the `/film` subroute.

## File structure

**Create (route + shell):**
- `web/app/[portal]/explore/film/page.tsx` — server component, resolves portal, loads initial data, renders shell
- `web/app/[portal]/explore/film/loading.tsx` — Suspense fallback
- `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx` — client: owns `selectedDate`, `filters`, fetches `/api/film/today-playbill?date=...` on date change
- `web/app/[portal]/explore/film/_components/DateStrip.tsx` — 14-day pills with counts
- `web/app/[portal]/explore/film/_components/ViewToggle.tsx` — segmented control (`By Theater | By Film | Schedule`); Film + Schedule disabled in this plan
- `web/app/[portal]/explore/film/_components/FilmFilterChips.tsx` — format + attribute chips (wired to state; filtering logic in Task 10)
- `web/app/[portal]/explore/film/_components/ThisWeekZone.tsx` — larger variant of feed's hero strip (reuses `HeroTile` with new density)
- `web/app/[portal]/explore/film/_components/ByTheaterView.tsx` — dispatches tier 1 vs tier 2 blocks
- `web/app/[portal]/explore/film/_components/TheaterBlockTier1.tsx` — full programmer's board card
- `web/app/[portal]/explore/film/_components/TheaterBlockTier2.tsx` — compressed format-led card
- `web/app/[portal]/explore/film/_components/FilmRowTier1.tsx` — portrait still + editorial line + showtime chips
- `web/app/[portal]/explore/film/_components/FilmRowTier2.tsx` — compact row with format-tagged showtime chips

**Create (data):**
- `web/lib/film/date-counts-loader.ts` — server loader: returns `[{ date, count, hasPremiere }]` for a 14-day window
- `web/app/api/film/date-counts/route.ts` — wraps the loader
- `web/lib/film/__tests__/date-counts-loader.test.ts` — unit test on the counting logic (using a mock query, or a pure-function extract)

**Modify:**
- `web/components/feed/sections/now-showing/HeroTile.tsx` — extend `Density` to add `'hero-large'` (300px tall, larger title/meta, press quote uncollapsed) **OR** create a sibling `HeroTileLarge.tsx` if the branching gets messy. Pick one path in Task 5.

**Tests:**
- `web/app/[portal]/explore/film/_components/__tests__/DateStrip.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/FilmFilterChips.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/ByTheaterView.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier1.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier2.test.tsx`

---

## Task 1: Design handoff extract

**Files:**
- Create: `docs/superpowers/specs/2026-04-17-film-explore-page-handoff.md`

**Goal:** Codify layout tokens for shell / date strip / view toggle / filter chips / This Week zone / Tier 1 + Tier 2 theater blocks before any code is written. Reference Pencil `i2XB5` (explore-film.pen) + verbal spec §6.

- [ ] **Step 1: Attempt `/design-handoff extract i2XB5`**

Try the Pencil extract from `docs/explore-film.pen` for node `i2XB5`. If it renders, capture layout + tokens.

If render-stalled, fall back to verbal spec §6.1–6.3 and note it.

- [ ] **Step 2: Write the handoff doc**

Create `docs/superpowers/specs/2026-04-17-film-explore-page-handoff.md` with these sections (tokens + source line for each):

```markdown
# /explore/film Page — Design Handoff

**Source of truth:** [Pencil i2XB5 | verbal spec §6 fallback]
**Extracted:** 2026-04-17
**Spec:** docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md §6

## Page shell (§6.1)

- Outer container: `<main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6 sm:space-y-8">`
- Breadcrumb: `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--vibe)]`
  - Markup: `EXPLORE  /  FILM` with a middle `<span className="text-[var(--muted)]">/</span>` separator
- Title row: `flex items-end justify-between mb-2`
  - Title: `<h1 className="font-display italic text-3xl sm:text-5xl font-semibold text-[var(--cream)]">Films Showing in Atlanta.</h1>`
  - Right: `<span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">CURATED BY <span className="text-[var(--gold)]">Lost City Film</span></span>`
- Editorial subtitle: `text-sm sm:text-base italic text-[var(--soft)]` — computed server-side in Task 2 (string interpolation over `thisWeek.heroes`)

## Date strip (§6.1)

- Label row: `flex items-baseline justify-between mb-2`
  - Left: `THE NEXT TWO WEEKS` in `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]`
  - Right: `Pick a date ↗` (v1 disabled link, just visual — picker deferred)
- Pills row: `flex gap-2 overflow-x-auto scrollbar-hide pb-1` with 14 pills
- Pill structure: `flex-shrink-0 w-[88px] h-[86px] rounded-card border flex flex-col items-center justify-center transition-colors`
  - Active: `bg-[var(--vibe)]/15 border-[var(--vibe)]/50 text-[var(--cream)]`
  - Today (inactive): `border-[var(--gold)]/40 text-[var(--cream)]`
  - Default: `border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--muted)]`
- Pill content (top→bottom):
  - Row 1: `font-mono text-2xs font-bold uppercase tracking-[0.14em]` — day abbrev or `TODAY` (today uses `text-[var(--gold)]`)
  - Row 2: `font-display text-2xl tabular-nums` — day-of-month number
  - Row 3: `font-mono text-2xs text-[var(--muted)]` — count (`14 films`) or `★ premiere` in `text-[var(--gold)]` when any screening that day has `is_premiere=true`

## View toggle (§6.1)

- Container: `inline-flex items-center gap-0 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-0.5`
- Segment button: `px-3 py-1.5 rounded-card-sm font-mono text-xs uppercase tracking-[0.12em] transition-colors`
  - Active: `bg-[var(--vibe)]/15 text-[var(--cream)]`
  - Inactive: `text-[var(--muted)] hover:text-[var(--cream)]`
  - Disabled (By Film / Schedule in this plan): `text-[var(--twilight)] cursor-not-allowed` + small `soon` suffix in `text-[var(--muted)]`
- Active indicator: small gold dot `w-1 h-1 rounded-full bg-[var(--gold)]` right of label on active

## Filter chips (§6.1)

- Row: `flex items-center gap-2 overflow-x-auto scrollbar-hide`
- Label: `Filter:` in `font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)]`
- Chips: reuse `<FilterChip variant="date" size="sm" />` with custom active tint (gold for formats, vibe for attributes)
- Chip list:
  - Formats (multi-select OR): `35mm`, `70mm`, `True IMAX`, `IMAX`, `Dolby Cinema`, `4DX`, `drive-in`
  - Attributes (multi-select AND): `premieres only`, `one-night-only`, `festival`

## This Week zone (§6.2)

Same structure as feed widget but larger:
- Heights per density: `hero-large` → 300px (full), 280px (half), 240px (third)
- Title scales: `hero-large full` → `text-4xl`, half → `text-3xl`, third → `text-2xl`
- Press quote always rendered (no line-clamp)
- Meta line can wrap to 2 lines
- Link under strip: `Coming next week →` in `font-mono text-xs text-[var(--vibe)] hover:text-[var(--cream)]` — static link to `/{portal}/explore/film?week=next` (page accepts param but this plan does NOT implement next-week navigation; clicking logs a no-op or is disabled in v1)

## By Theater view (§6.3)

Zone header:
- `BY THEATER · TODAY · {WEEKDAY} {MON D}` in `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]`
- Italic subhead: `Atlanta's programs tonight.` (or `Atlanta's programs on {date}.` when not today) — `text-sm italic text-[var(--soft)]`
- Right-align: `{n} indies + {m} premium screens · {total} screenings` — `font-mono text-xs text-[var(--muted)]`

### Tier 1 block (full programmer's board)

- Outer: `rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-4`
- Header row: `flex items-end justify-between gap-4 pb-3 border-b border-[var(--twilight)]`
  - Left: `<h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)]">{venue.name}</h2>`
  - Founding year chip: `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]` — `EST. 1939`
  - Meta line: `{neighborhood} · {rating ★} · {films.length} films` in `font-mono text-xs text-[var(--muted)]`
  - Right CTA: `See the week →` in `font-mono text-xs text-[var(--vibe)]` — links to `/{portal}/explore/film?venue={slug}` (same URL — no-op this plan)
- Film row: `flex gap-4 py-3 border-b border-[var(--twilight)]/50 last:border-0`
  - Left portrait still: `w-24 sm:w-[96px] h-[144px] rounded-card overflow-hidden flex-shrink-0 bg-[var(--dusk)]`
  - Right growing: stacked content
    - Title: `font-display text-xl sm:text-2xl font-semibold text-[var(--cream)]`
    - Meta: `font-mono text-xs text-[var(--muted)]` — `{director} · {year} · {runtime}m · {rating}`
    - Optional gold badge: `inline-block mt-1 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]` — ATL PREMIERE / 35MM · SATURDAY ONLY / etc (use `buildHeroTag` helper from PR #36)
    - Editorial line (optional): `text-sm italic text-[var(--soft)]` — `editorial_blurb` field if present
    - Showtime chip row: `flex items-center gap-1.5 flex-wrap mt-2` with chips `px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25` — each links to the same showtimes page for now (plan creation is a separate feature)
- `+N more films tonight` line at bottom: `text-sm font-mono text-[var(--vibe)]/70 hover:text-[var(--vibe)]` when films.length > MAX_SHOWN (5)

### Tier 2 block (compressed format-led)

- Outer: same `rounded-card-xl border bg-[var(--night)] p-5 sm:p-6 space-y-3`
- Header:
  - `<h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--cream)]">{venue.name}</h2>`
  - Format badges row: `flex gap-1.5 mt-1 flex-wrap` with per-format pill `px-2 py-0.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]` — `TRUE IMAX`, `IMAX`, `70MM`, `DOLBY CINEMA`, `4DX`, `RPX`, `SCREENX` (color variants per spec §4; v1 all gold-tinted)
  - Meta line below: `font-mono text-xs text-[var(--muted)]` — `{neighborhood} · {films.length} films`
- Film row: `flex gap-3 py-2 border-b border-[var(--twilight)]/30 last:border-0`
  - Left still: `w-16 sm:w-[64px] h-[96px] rounded overflow-hidden flex-shrink-0`
  - Right: title `text-base sm:text-lg font-semibold text-[var(--cream)]`, meta `font-mono text-xs text-[var(--muted)]` (`{runtime}m · {rating}`), showtime chips with per-showing format tag:
    - Chip: `px-2 py-0.5 rounded font-mono text-xs tabular-nums` — bg/border by format (true_imax = gold fill; imax/dolby = outlined gold; 4dx = coral fill; else = vibe)
    - Format suffix: ` · IMAX` / ` · 4DX` in `text-2xs` inside chip

## Divider between tiers

Between last Tier 1 block and first Tier 2 block:

- Kicker: `── PREMIUM FORMATS ──` in `font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]` centered with hairline borders extending

## Empty state (date with 0 results)

If selected date returns 0 venues with screenings:
- Icon: Phosphor `FilmSlate` w-12 h-12 text-[var(--twilight)]
- Heading: `No screenings on this date.` in `text-xl font-display text-[var(--cream)]`
- CTA: `← Back to today` links back to default date
```

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-film-explore-page-handoff.md
git commit -m "docs(film): /explore/film page design handoff"
```

---

## Task 2: Editorial subtitle helper

**Goal:** Pure function that derives the editorial subtitle from `ThisWeekPayload.heroes`. Something like *"This week — Bunnylovr opens at Plaza, Dune: Part Three lights up the true IMAX at Mall of Georgia, Cassavetes on 35mm at Tara."*

**Files:**
- Create: `web/lib/film/editorial-subtitle.ts`
- Test: `web/lib/film/__tests__/editorial-subtitle.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// web/lib/film/__tests__/editorial-subtitle.test.ts
import { describe, expect, it } from 'vitest';
import { buildEditorialSubtitle } from '../editorial-subtitle';
import type { FilmScreening, HeroReason } from '../types';

function hero(title: string, venue: string, reason: HeroReason, overrides: Partial<FilmScreening> = {}): FilmScreening & { hero_reason: HeroReason } {
  return {
    run_id: `r-${title}`,
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
    venue: {
      id: 1,
      slug: venue.toLowerCase().replace(/\s/g, '-'),
      name: venue,
      neighborhood: null,
      classification: 'editorial_program',
      programming_style: null,
      venue_formats: [],
      founding_year: null,
      google_rating: null,
    },
    times: [],
    hero_reason: reason,
    ...overrides,
  };
}

describe('buildEditorialSubtitle', () => {
  it('returns null for empty heroes', () => {
    expect(buildEditorialSubtitle([])).toBeNull();
  });

  it('uses "opens at" for opens_this_week heroes', () => {
    const subtitle = buildEditorialSubtitle([
      hero('Bunnylovr', 'Plaza', 'opens_this_week'),
    ]);
    expect(subtitle).toContain('Bunnylovr opens at Plaza');
  });

  it('uses "lights up the true IMAX at" for special_format with true_imax', () => {
    const h = hero('Dune Part Three', 'Mall of Georgia', 'special_format', {
      times: [{ id: 't', start_date: '2026-04-20', start_time: null, end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    const subtitle = buildEditorialSubtitle([h]);
    expect(subtitle).toContain('Dune Part Three lights up the true IMAX at Mall of Georgia');
  });

  it('uses "on 35mm at" for special_format with 35mm', () => {
    const h = hero('Faces', 'Tara', 'special_format', {
      times: [{ id: 't', start_date: '2026-04-20', start_time: null, end_time: null, format_labels: ['35mm'], status: 'scheduled', ticket_url: null, event_id: null }],
    });
    expect(buildEditorialSubtitle([h])).toContain('Faces on 35mm at Tara');
  });

  it('joins multiple fragments with comma and starts with "This week —"', () => {
    const result = buildEditorialSubtitle([
      hero('A', 'Plaza', 'opens_this_week'),
      hero('B', 'Tara', 'curator_pick'),
    ]);
    expect(result).toMatch(/^This week —/);
    expect(result).toContain(',');
  });

  it('ends with a period', () => {
    const r = buildEditorialSubtitle([hero('A', 'Plaza', 'opens_this_week')]);
    expect(r?.endsWith('.')).toBe(true);
  });

  it('caps at 3 fragments for readability', () => {
    const heroes = [
      hero('A', 'Plaza', 'opens_this_week'),
      hero('B', 'Tara', 'curator_pick'),
      hero('C', 'Starlight', 'opens_this_week'),
      hero('D', 'Landmark', 'curator_pick'),
    ];
    const r = buildEditorialSubtitle(heroes);
    expect(r).toContain('A opens at Plaza');
    expect(r).not.toContain('Landmark');
  });
});
```

- [ ] **Step 2: Run to verify fail**

`cd web && npx vitest run lib/film/__tests__/editorial-subtitle.test.ts`
Expected: FAIL with "Cannot find module".

- [ ] **Step 3: Implement**

```ts
// web/lib/film/editorial-subtitle.ts
// Pure derivation of the editorial subtitle on /explore/film.
import type { FilmScreening, HeroReason } from './types';

const MAX_FRAGMENTS = 3;

function hasFormat(h: FilmScreening, fmt: string): boolean {
  return h.times.some((t) => t.format_labels.includes(fmt as never));
}

function fragment(h: FilmScreening & { hero_reason: HeroReason }): string {
  const venueName = h.venue.name;
  if (h.hero_reason === 'special_format') {
    if (hasFormat(h, 'true_imax')) return `${h.title} lights up the true IMAX at ${venueName}`;
    if (hasFormat(h, '70mm')) return `${h.title} on 70mm at ${venueName}`;
    if (hasFormat(h, '35mm')) return `${h.title} on 35mm at ${venueName}`;
    if (hasFormat(h, 'dolby_cinema')) return `${h.title} in Dolby Cinema at ${venueName}`;
    return `${h.title} in a premium format at ${venueName}`;
  }
  if (h.hero_reason === 'opens_this_week') return `${h.title} opens at ${venueName}`;
  if (h.hero_reason === 'closes_this_week') return `${h.title} closes at ${venueName}`;
  if (h.hero_reason === 'festival') {
    return h.festival_name
      ? `${h.title} at ${h.festival_name}`
      : `${h.title} (festival) at ${venueName}`;
  }
  // curator_pick or default
  return `${h.title} at ${venueName}`;
}

export function buildEditorialSubtitle(
  heroes: Array<FilmScreening & { hero_reason: HeroReason }>,
): string | null {
  if (heroes.length === 0) return null;
  const fragments = heroes.slice(0, MAX_FRAGMENTS).map(fragment);
  return `This week — ${fragments.join(', ')}.`;
}
```

- [ ] **Step 4: Run tests — pass**

`cd web && npx vitest run lib/film/__tests__/editorial-subtitle.test.ts`
Expected: 7 passing.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/editorial-subtitle.ts web/lib/film/__tests__/editorial-subtitle.test.ts
git commit -m "feat(film): editorial subtitle helper for /explore/film"
```

---

## Task 3: date-counts loader + API

**Goal:** `/api/film/date-counts?portal=&from=&to=` returns `[{date, count, hasPremiere}]` for each date in the `[from, to]` range.

**Files:**
- Create: `web/lib/film/date-counts-loader.ts`
- Create: `web/app/api/film/date-counts/route.ts`
- Test: `web/lib/film/__tests__/date-counts-loader.test.ts`
- Test: `web/app/api/film/date-counts/__tests__/route.test.ts`

- [ ] **Step 1: Pre-check — look at an existing API-route test**

Run: `ls web/app/api/film/this-week/__tests__/` — confirm the test pattern. Copy it.

- [ ] **Step 2: Write the loader test (pure summarization)**

```ts
// web/lib/film/__tests__/date-counts-loader.test.ts
import { describe, expect, it } from 'vitest';
import { summarizeDateCounts } from '../date-counts-loader';

describe('summarizeDateCounts', () => {
  it('returns zero-count entries for every date in the window', () => {
    const result = summarizeDateCounts([], '2026-04-17', '2026-04-19');
    expect(result).toEqual([
      { date: '2026-04-17', count: 0, hasPremiere: false },
      { date: '2026-04-18', count: 0, hasPremiere: false },
      { date: '2026-04-19', count: 0, hasPremiere: false },
    ]);
  });

  it('counts screenings per date', () => {
    const rows = [
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-18', is_premiere: false },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-18');
    expect(result[0]).toEqual({ date: '2026-04-17', count: 2, hasPremiere: false });
    expect(result[1]).toEqual({ date: '2026-04-18', count: 1, hasPremiere: false });
  });

  it('flags hasPremiere when any screening on that date is a premiere', () => {
    const rows = [
      { start_date: '2026-04-17', is_premiere: false },
      { start_date: '2026-04-17', is_premiere: true },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-17');
    expect(result[0].hasPremiere).toBe(true);
  });

  it('ignores dates outside the window', () => {
    const rows = [
      { start_date: '2026-04-10', is_premiere: false },
      { start_date: '2026-04-20', is_premiere: false },
    ];
    const result = summarizeDateCounts(rows, '2026-04-17', '2026-04-18');
    expect(result.every((r) => r.count === 0)).toBe(true);
  });
});
```

- [ ] **Step 3: Run — fail**

`cd web && npx vitest run lib/film/__tests__/date-counts-loader.test.ts`
Expected: FAIL with module-not-found.

- [ ] **Step 4: Implement loader**

```ts
// web/lib/film/date-counts-loader.ts
import 'server-only';
import { createClient } from '@/lib/supabase/server';
import { resolvePortalId } from './portal-id';

export type DateCount = {
  date: string;
  count: number;
  hasPremiere: boolean;
};

type RawRow = { start_date: string; is_premiere: boolean };

export function summarizeDateCounts(
  rows: RawRow[],
  from: string,
  to: string,
): DateCount[] {
  // Build every date in the window
  const dates: string[] = [];
  const startMs = new Date(from + 'T00:00:00Z').getTime();
  const endMs = new Date(to + 'T00:00:00Z').getTime();
  for (let t = startMs; t <= endMs; t += 86_400_000) {
    dates.push(new Date(t).toISOString().slice(0, 10));
  }
  const byDate = new Map<string, { count: number; hasPremiere: boolean }>();
  for (const d of dates) byDate.set(d, { count: 0, hasPremiere: false });

  for (const r of rows) {
    const entry = byDate.get(r.start_date);
    if (!entry) continue;
    entry.count += 1;
    if (r.is_premiere) entry.hasPremiere = true;
  }

  return dates.map((d) => ({
    date: d,
    count: byDate.get(d)!.count,
    hasPremiere: byDate.get(d)!.hasPremiere,
  }));
}

export async function loadDateCounts(args: {
  portalSlug: string;
  from: string;
  to: string;
}): Promise<DateCount[]> {
  const supabase = await createClient();
  const portalId = await resolvePortalId(supabase, args.portalSlug);

  const { data, error } = await supabase
    .from('screening_times')
    .select(
      `start_date, screening_runs!inner (screening_titles!inner (is_premiere), places!inner (portal_id))`,
    )
    .gte('start_date', args.from)
    .lte('start_date', args.to)
    .eq('status', 'scheduled');

  if (error) throw error;

  // Narrow portal filter in-memory (Supabase can't filter nested !inner portal_id cleanly on 3-level join in all cases)
  const rows: { start_date: string; is_premiere: boolean }[] = (data ?? [])
    .filter((r) => {
      const run = r.screening_runs as unknown as {
        places?: { portal_id?: string };
        screening_titles?: { is_premiere?: boolean };
      } | null;
      return run?.places?.portal_id === portalId;
    })
    .map((r) => ({
      start_date: r.start_date,
      is_premiere: Boolean(
        (r.screening_runs as unknown as { screening_titles?: { is_premiere?: boolean } } | null)?.screening_titles?.is_premiere,
      ),
    }));

  return summarizeDateCounts(rows, args.from, args.to);
}
```

**Pre-check:** confirm `web/lib/film/portal-id.ts` exists and exports `resolvePortalId`. If not, the other loaders (`this-week-loader.ts`, `today-playbill-loader.ts`) have an inline resolver — copy that pattern instead of importing. Grep: `grep -n "resolvePortalId\|portal_id" web/lib/film/this-week-loader.ts`.

If the portal-id resolution helper is inline in each loader, extract it to `web/lib/film/portal-id.ts` as a shared helper in this same commit (the other loaders can keep working since the extraction preserves behavior).

- [ ] **Step 5: Run loader tests — pass**

`cd web && npx vitest run lib/film/__tests__/date-counts-loader.test.ts`
Expected: 4 passing.

- [ ] **Step 6: API route**

```ts
// web/app/api/film/date-counts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import {
  applyRateLimit,
  RATE_LIMITS,
  getClientIdentifier,
} from '@/lib/rate-limit';
import { loadDateCounts } from '@/lib/film/date-counts-loader';

export const revalidate = 300;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request),
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portal = searchParams.get('portal');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  if (!portal || !from || !to) {
    return NextResponse.json(
      { error: 'Missing required query params: portal, from, to' },
      { status: 400 },
    );
  }
  if (!DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: 'Invalid date format. Use YYYY-MM-DD.' },
      { status: 400 },
    );
  }

  try {
    const counts = await loadDateCounts({ portalSlug: portal, from, to });
    const res = NextResponse.json({ portal_slug: portal, from, to, counts });
    res.headers.set(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600',
    );
    return res;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to load date counts',
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 7: Route tests**

```ts
// web/app/api/film/date-counts/__tests__/route.test.ts
import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET } from '../route';

vi.mock('@/lib/film/date-counts-loader', () => ({
  loadDateCounts: vi.fn().mockResolvedValue([
    { date: '2026-04-17', count: 3, hasPremiere: false },
    { date: '2026-04-18', count: 1, hasPremiere: true },
  ]),
}));

describe('GET /api/film/date-counts', () => {
  it('400s when portal missing', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?from=2026-04-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('400s on bad date format', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?portal=atlanta&from=4-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('200s with counts', async () => {
    const req = new NextRequest('http://x/api/film/date-counts?portal=atlanta&from=2026-04-17&to=2026-04-18');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.counts).toHaveLength(2);
  });
});
```

- [ ] **Step 8: Run — pass**

`cd web && npx vitest run lib/film/__tests__/date-counts-loader.test.ts app/api/film/date-counts/__tests__/route.test.ts`
Expected: 7 passing.

- [ ] **Step 9: Commit**

```bash
git add web/lib/film/date-counts-loader.ts web/lib/film/__tests__/date-counts-loader.test.ts web/app/api/film/date-counts/route.ts web/app/api/film/date-counts/__tests__/route.test.ts
# plus web/lib/film/portal-id.ts if extracted
git commit -m "feat(film): /api/film/date-counts route + loader"
```

---

## Task 4: DateStrip component

**Files:**
- Create: `web/app/[portal]/explore/film/_components/DateStrip.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/DateStrip.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/DateStrip.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DateStrip from '../DateStrip';

const counts = Array.from({ length: 14 }, (_, i) => {
  const d = new Date('2026-04-17T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + i);
  return { date: d.toISOString().slice(0, 10), count: i === 0 ? 14 : i === 3 ? 0 : 6, hasPremiere: i === 5 };
});

describe('DateStrip', () => {
  it('renders 14 pills', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    const pills = screen.getAllByRole('button');
    expect(pills).toHaveLength(14);
  });

  it('marks today with TODAY label in gold', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getByText('TODAY')).toBeInTheDocument();
  });

  it('renders star premiere marker when hasPremiere is true', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getAllByText(/★ premiere/i).length).toBeGreaterThan(0);
  });

  it('renders film count when no premiere', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={() => {}} />);
    expect(screen.getByText('14 films')).toBeInTheDocument();
  });

  it('calls onSelect with ISO date when pill clicked', () => {
    const onSelect = vi.fn();
    render(<DateStrip counts={counts} selectedDate="2026-04-17" today="2026-04-17" onSelect={onSelect} />);
    const pills = screen.getAllByRole('button');
    fireEvent.click(pills[2]);
    expect(onSelect).toHaveBeenCalledWith(counts[2].date);
  });

  it('marks the selected pill with aria-pressed', () => {
    render(<DateStrip counts={counts} selectedDate="2026-04-18" today="2026-04-17" onSelect={() => {}} />);
    const pills = screen.getAllByRole('button');
    expect(pills[1].getAttribute('aria-pressed')).toBe('true');
    expect(pills[0].getAttribute('aria-pressed')).toBe('false');
  });
});
```

- [ ] **Step 2: Fail**
`cd web && npx vitest run app/[portal]/explore/film/_components/__tests__/DateStrip.test.tsx`

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/DateStrip.tsx
"use client";

import type { DateCount } from '@/lib/film/date-counts-loader';

const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function fmtMonthDay(iso: string): { wd: string; dom: number } {
  const d = new Date(iso + 'T00:00:00Z');
  return { wd: WEEKDAY_SHORT[d.getUTCDay()], dom: d.getUTCDate() };
}

interface DateStripProps {
  counts: DateCount[];
  selectedDate: string;
  today: string;
  onSelect: (date: string) => void;
}

export default function DateStrip({ counts, selectedDate, today, onSelect }: DateStripProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
          The next two weeks
        </span>
        <span className="font-mono text-xs text-[var(--muted)] opacity-60">
          Pick a date ↗
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
        {counts.map((c) => {
          const isActive = c.date === selectedDate;
          const isToday = c.date === today;
          const { wd, dom } = fmtMonthDay(c.date);
          const borderTone = isActive
            ? 'bg-[var(--vibe)]/15 border-[var(--vibe)]/50 text-[var(--cream)]'
            : isToday
              ? 'border-[var(--gold)]/40 text-[var(--cream)]'
              : 'border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--muted)]';
          return (
            <button
              key={c.date}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(c.date)}
              className={`flex-shrink-0 w-[88px] h-[86px] rounded-card border flex flex-col items-center justify-center gap-0.5 transition-colors ${borderTone}`}
            >
              <span
                className={`font-mono text-2xs font-bold uppercase tracking-[0.14em] ${
                  isToday ? 'text-[var(--gold)]' : ''
                }`}
              >
                {isToday ? 'TODAY' : wd}
              </span>
              <span className="font-display text-2xl tabular-nums leading-none">{dom}</span>
              {c.hasPremiere ? (
                <span className="font-mono text-2xs text-[var(--gold)]">★ premiere</span>
              ) : (
                <span className="font-mono text-2xs text-[var(--muted)]">
                  {c.count === 0 ? '—' : c.count === 1 ? '1 film' : `${c.count} films`}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run app/\[portal\]/explore/film/_components/__tests__/DateStrip.test.tsx
# 6/6 passing
git add web/app/\[portal\]/explore/film/_components/DateStrip.tsx web/app/\[portal\]/explore/film/_components/__tests__/DateStrip.test.tsx
git commit -m "feat(film): DateStrip — 14-day pill row for /explore/film"
```

---

## Task 5: ThisWeekZone — reuse HeroTile with 'hero-large' density

**Goal:** Extend `HeroTile.tsx` to accept a `'hero-large'` density → 300/280/240 heights, larger title, press quote uncollapsed. Wrap in `ThisWeekZone.tsx`.

**Files:**
- Modify: `web/components/feed/sections/now-showing/HeroTile.tsx`
- Modify: `web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx` (add a test for `hero-large`)
- Create: `web/app/[portal]/explore/film/_components/ThisWeekZone.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/ThisWeekZone.test.tsx`

- [ ] **Step 1: Extend HeroTile Density type**

Edit `HeroTile.tsx`: change the `Density` type and `HEIGHT` / `TITLE_SIZE` maps.

```tsx
type Density = 'full' | 'half' | 'third' | 'hero-large-full' | 'hero-large-half' | 'hero-large-third';

const HEIGHT: Record<Density, string> = {
  full: 'h-[240px]',
  half: 'h-[220px]',
  third: 'h-[200px]',
  'hero-large-full': 'h-[300px]',
  'hero-large-half': 'h-[280px]',
  'hero-large-third': 'h-[240px]',
};

const TITLE_SIZE: Record<Density, string> = {
  full: 'text-3xl',
  half: 'text-2xl',
  third: 'text-lg',
  'hero-large-full': 'text-4xl',
  'hero-large-half': 'text-3xl',
  'hero-large-third': 'text-2xl',
};
```

In the press-quote rendering, add a variant: when density starts with `'hero-large-'`, drop the `line-clamp-1` class so the quote can wrap.

Change the condition `density !== 'third'` on the founding-year suffix to `!density.endsWith('-third') && density !== 'third'`.

- [ ] **Step 2: Add one new HeroTile test for the large variant**

Append to `web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`:

```tsx
it('renders larger title for hero-large-full density', () => {
  const hero = { ...makeHero(), hero_reason: 'curator_pick' as HeroReason };
  const { container } = render(<HeroTile hero={hero} portalSlug="atlanta" density="hero-large-full" />);
  expect(container.querySelector('h3')?.className).toContain('text-4xl');
});
```

- [ ] **Step 3: Run — all 7 HeroTile tests pass**

`cd web && npx vitest run components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`
Expected: 7 passing.

- [ ] **Step 4: ThisWeekZone test**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/ThisWeekZone.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThisWeekZone from '../ThisWeekZone';
import type { ThisWeekPayload } from '@/lib/film/types';

function payload(heroCount: number): ThisWeekPayload {
  const heroes = Array.from({ length: heroCount }, (_, i) => ({
    run_id: `r-${i}`,
    screening_title_id: `st-${i}`,
    title: `Film ${i}`,
    slug: `film-${i}`,
    director: null, year: null, runtime_minutes: null, rating: null,
    image_url: null, editorial_blurb: null, film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: true,
    festival_id: null, festival_name: null,
    venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program' as const, programming_style: null, venue_formats: [], founding_year: null, google_rating: null },
    times: [],
    hero_reason: 'curator_pick' as const,
  }));
  return { portal_slug: 'atlanta', iso_week_start: '2026-04-13', iso_week_end: '2026-04-19', heroes };
}

describe('ThisWeekZone', () => {
  it('returns null when heroes is empty', () => {
    const { container } = render(<ThisWeekZone thisWeek={payload(0)} portalSlug="atlanta" />);
    expect(container.firstChild).toBeNull();
  });

  it('renders 1 tile when heroes has 1', () => {
    render(<ThisWeekZone thisWeek={payload(1)} portalSlug="atlanta" />);
    expect(screen.getByText('Film 0')).toBeInTheDocument();
  });

  it('renders 3 tiles when heroes has 3', () => {
    render(<ThisWeekZone thisWeek={payload(3)} portalSlug="atlanta" />);
    expect(screen.getByText('Film 0')).toBeInTheDocument();
    expect(screen.getByText('Film 2')).toBeInTheDocument();
  });

  it('shows the kicker label "THIS WEEK · n"', () => {
    render(<ThisWeekZone thisWeek={payload(2)} portalSlug="atlanta" />);
    expect(screen.getByText(/THIS WEEK · 2/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Fail**

- [ ] **Step 6: Implement**

```tsx
// web/app/[portal]/explore/film/_components/ThisWeekZone.tsx
"use client";

import HeroTile from '@/components/feed/sections/now-showing/HeroTile';
import type { ThisWeekPayload } from '@/lib/film/types';

type Density = 'hero-large-full' | 'hero-large-half' | 'hero-large-third';

function densityFor(count: number): Density {
  if (count === 1) return 'hero-large-full';
  if (count === 2) return 'hero-large-half';
  return 'hero-large-third';
}

interface ThisWeekZoneProps {
  thisWeek: ThisWeekPayload;
  portalSlug: string;
}

export default function ThisWeekZone({ thisWeek, portalSlug }: ThisWeekZoneProps) {
  const heroes = thisWeek.heroes;
  if (heroes.length === 0) return null;

  const density = densityFor(heroes.length);
  const gridCols =
    heroes.length === 1
      ? 'grid-cols-1'
      : heroes.length === 2
        ? 'grid-cols-[3fr_2fr]'
        : 'grid-cols-3';

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">
          This Week · {heroes.length} Significant Screening{heroes.length === 1 ? '' : 's'}
        </span>
        <span className="text-xs italic text-[var(--muted)]">Not to miss.</span>
      </div>
      <div className={`grid gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden ${gridCols}`}>
        {heroes.map((hero) => (
          <HeroTile key={hero.run_id} hero={hero} portalSlug={portalSlug} density={density} />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 7: Pass + commit**

`cd web && npx vitest run app/\[portal\]/explore/film/_components/__tests__/ThisWeekZone.test.tsx components/feed/sections/now-showing/__tests__/HeroTile.test.tsx`

Expected: 4 + 7 passing.

```bash
git add web/components/feed/sections/now-showing/HeroTile.tsx web/components/feed/sections/now-showing/__tests__/HeroTile.test.tsx web/app/\[portal\]/explore/film/_components/ThisWeekZone.tsx web/app/\[portal\]/explore/film/_components/__tests__/ThisWeekZone.test.tsx
git commit -m "feat(film): ThisWeekZone + hero-large HeroTile densities"
```

---

## Task 6: ViewToggle component

**Files:**
- Create: `web/app/[portal]/explore/film/_components/ViewToggle.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx`

- [ ] **Step 1: Tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ViewToggle from '../ViewToggle';

describe('ViewToggle', () => {
  it('renders all three view labels', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Theater/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /By Film/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Schedule/i })).toBeInTheDocument();
  });

  it('marks the active view with aria-pressed', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Theater/i }).getAttribute('aria-pressed')).toBe('true');
  });

  it('disables By Film and Schedule (v1)', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Film/i }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: /Schedule/i }).hasAttribute('disabled')).toBe(true);
  });

  it('fires onChange("by-theater") when that button is clicked', () => {
    const onChange = vi.fn();
    // Start on by-theater so it's a no-op test against self; force a re-render scenario by rendering another view first:
    render(<ViewToggle view="by-theater" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /By Theater/i }));
    expect(onChange).toHaveBeenCalledWith('by-theater');
  });
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/ViewToggle.tsx
"use client";

export type ExploreView = 'by-theater' | 'by-film' | 'schedule';

interface ViewToggleProps {
  view: ExploreView;
  onChange: (next: ExploreView) => void;
}

const OPTIONS: Array<{ id: ExploreView; label: string; disabled: boolean }> = [
  { id: 'by-theater', label: 'By Theater', disabled: false },
  { id: 'by-film', label: 'By Film', disabled: true },
  { id: 'schedule', label: 'Schedule', disabled: true },
];

export default function ViewToggle({ view, onChange }: ViewToggleProps) {
  return (
    <div
      role="group"
      aria-label="View mode"
      className="inline-flex items-center gap-0 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-0.5"
    >
      {OPTIONS.map((o) => {
        const isActive = o.id === view;
        const cls = o.disabled
          ? 'text-[var(--twilight)] cursor-not-allowed'
          : isActive
            ? 'bg-[var(--vibe)]/15 text-[var(--cream)]'
            : 'text-[var(--muted)] hover:text-[var(--cream)]';
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={isActive}
            disabled={o.disabled}
            onClick={() => !o.disabled && onChange(o.id)}
            className={`px-3 py-1.5 rounded-[calc(var(--radius-card)-2px)] font-mono text-xs uppercase tracking-[0.12em] transition-colors flex items-center gap-1.5 ${cls}`}
          >
            <span>{o.label}</span>
            {isActive && <span className="w-1 h-1 rounded-full bg-[var(--gold)]" aria-hidden />}
            {o.disabled && <span className="text-[0.6rem] text-[var(--muted)]">soon</span>}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
git add web/app/\[portal\]/explore/film/_components/ViewToggle.tsx web/app/\[portal\]/explore/film/_components/__tests__/ViewToggle.test.tsx
git commit -m "feat(film): ViewToggle (By Theater active, others coming-soon)"
```

---

## Task 7: FilmFilterChips component

**Files:**
- Create: `web/app/[portal]/explore/film/_components/FilmFilterChips.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/FilmFilterChips.test.tsx`

**Scope note:** Chips hold state; the actual filtering of venues/films is done inside `ByTheaterView` (Task 10). This component is purely presentational + state owner.

- [ ] **Step 1: Tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/FilmFilterChips.test.tsx
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilmFilterChips, { DEFAULT_FILTERS } from '../FilmFilterChips';

describe('FilmFilterChips', () => {
  it('renders all format + attribute chips', () => {
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={() => {}} />);
    expect(screen.getByText(/35mm/i)).toBeInTheDocument();
    expect(screen.getByText(/True IMAX/i)).toBeInTheDocument();
    expect(screen.getByText(/premieres only/i)).toBeInTheDocument();
  });

  it('toggles a format chip on click', () => {
    const onChange = vi.fn();
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /35mm/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ formats: ['35mm'] }));
  });

  it('toggles an attribute chip on click', () => {
    const onChange = vi.fn();
    render(<FilmFilterChips value={DEFAULT_FILTERS} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /premieres only/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ premieresOnly: true }));
  });

  it('turns a format off on second click', () => {
    const onChange = vi.fn();
    render(
      <FilmFilterChips
        value={{ ...DEFAULT_FILTERS, formats: ['35mm'] }}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /35mm/i }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ formats: [] }));
  });
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/FilmFilterChips.tsx
"use client";

import FilterChip from '@/components/filters/FilterChip';
import type { FormatToken } from '@/lib/film/types';

export type FilmFilters = {
  formats: FormatToken[];
  driveIn: boolean;
  premieresOnly: boolean;
  oneNightOnly: boolean;
  festival: boolean;
};

export const DEFAULT_FILTERS: FilmFilters = {
  formats: [],
  driveIn: false,
  premieresOnly: false,
  oneNightOnly: false,
  festival: false,
};

const FORMAT_LABELS: Array<{ id: FormatToken; label: string }> = [
  { id: '35mm', label: '35mm' },
  { id: '70mm', label: '70mm' },
  { id: 'true_imax', label: 'True IMAX' },
  { id: 'imax', label: 'IMAX' },
  { id: 'dolby_cinema', label: 'Dolby Cinema' },
  { id: '4dx', label: '4DX' },
];

interface FilmFilterChipsProps {
  value: FilmFilters;
  onChange: (next: FilmFilters) => void;
}

export default function FilmFilterChips({ value, onChange }: FilmFilterChipsProps) {
  const toggleFormat = (fmt: FormatToken) => {
    const next = value.formats.includes(fmt)
      ? value.formats.filter((f) => f !== fmt)
      : [...value.formats, fmt];
    onChange({ ...value, formats: next });
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
      <span className="font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] shrink-0">
        Filter:
      </span>
      {FORMAT_LABELS.map((f) => (
        <FilterChip
          key={f.id}
          label={f.label}
          variant="date"
          size="sm"
          active={value.formats.includes(f.id)}
          onClick={() => toggleFormat(f.id)}
        />
      ))}
      <FilterChip
        label="drive-in"
        variant="date"
        size="sm"
        active={value.driveIn}
        onClick={() => onChange({ ...value, driveIn: !value.driveIn })}
      />
      <FilterChip
        label="premieres only"
        variant="vibe"
        size="sm"
        active={value.premieresOnly}
        onClick={() => onChange({ ...value, premieresOnly: !value.premieresOnly })}
      />
      <FilterChip
        label="one-night-only"
        variant="vibe"
        size="sm"
        active={value.oneNightOnly}
        onClick={() => onChange({ ...value, oneNightOnly: !value.oneNightOnly })}
      />
      <FilterChip
        label="festival"
        variant="vibe"
        size="sm"
        active={value.festival}
        onClick={() => onChange({ ...value, festival: !value.festival })}
      />
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
git add web/app/\[portal\]/explore/film/_components/FilmFilterChips.tsx web/app/\[portal\]/explore/film/_components/__tests__/FilmFilterChips.test.tsx
git commit -m "feat(film): FilmFilterChips — global format + attribute filters"
```

---

## Task 8: TheaterBlockTier1 component

**Files:**
- Create: `web/app/[portal]/explore/film/_components/TheaterBlockTier1.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier1.test.tsx`

- [ ] **Step 1: Tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier1.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TheaterBlockTier1 from '../TheaterBlockTier1';
import type { FilmVenue, FilmScreening } from '@/lib/film/types';

function venue(): FilmVenue {
  return {
    id: 1, slug: 'plaza-theatre', name: 'Plaza Theatre',
    neighborhood: 'Poncey-Highland', classification: 'editorial_program',
    programming_style: 'repertory', venue_formats: ['70mm', '35mm'],
    founding_year: 1939, google_rating: 4.7,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase().replace(/\s/g, '-'),
    director: 'Jane Doe', year: 2025, runtime_minutes: 101, rating: 'R',
    image_url: null, editorial_blurb: 'A bruising debut.',
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('TheaterBlockTier1', () => {
  it('renders the venue name and founding year', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza Theatre')).toBeInTheDocument();
    expect(screen.getByText(/EST\. 1939/)).toBeInTheDocument();
  });

  it('renders film title, director, year, runtime, rating', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText(/Jane Doe/)).toBeInTheDocument();
    expect(screen.getByText(/2025/)).toBeInTheDocument();
    expect(screen.getByText(/1h 41m/)).toBeInTheDocument();
  });

  it('renders editorial_blurb when present', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText(/A bruising debut\./)).toBeInTheDocument();
  });

  it('renders showtime chip with time', () => {
    render(<TheaterBlockTier1 venue={venue()} screenings={[screening('Bunnylovr', '19:45')]} portalSlug="atlanta" />);
    expect(screen.getByText(/7:45/)).toBeInTheDocument();
  });

  it('renders a +N more footer when more than 5 films', () => {
    const s = Array.from({ length: 7 }, (_, i) => screening(`Film ${i}`, '20:00'));
    render(<TheaterBlockTier1 venue={venue()} screenings={s} portalSlug="atlanta" />);
    expect(screen.getByText(/\+2 more films/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/TheaterBlockTier1.tsx
"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl, buildSpotUrl } from '@/lib/entity-urls';
import { buildHeroTag } from '@/lib/film/hero-tags';
import type { FilmScreening, FilmVenue } from '@/lib/film/types';

const MAX_SHOWN = 5;

function runtimeStr(minutes: number | null): string {
  if (!minutes) return '';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function TheaterBlockTier1({ venue, screenings, portalSlug }: Props) {
  const shown = screenings.slice(0, MAX_SHOWN);
  const overflow = Math.max(screenings.length - MAX_SHOWN, 0);

  return (
    <section className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-4">
      <header className="flex items-end justify-between gap-4 pb-3 border-b border-[var(--twilight)]">
        <div>
          <Link
            href={buildSpotUrl(venue.slug, portalSlug, 'page')}
            className="inline-flex items-center gap-3 hover:text-[var(--vibe)] transition-colors"
          >
            <h2 className="font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)]">
              {venue.name}
            </h2>
            {venue.founding_year && (
              <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]">
                EST. {venue.founding_year}
              </span>
            )}
          </Link>
          <p className="font-mono text-xs text-[var(--muted)] mt-1 flex items-center gap-1.5">
            {venue.neighborhood && <span>{venue.neighborhood}</span>}
            {venue.neighborhood && venue.google_rating != null && <Dot />}
            {venue.google_rating != null && (
              <span className="text-[var(--gold)]">{venue.google_rating.toFixed(1)} ★</span>
            )}
            <Dot />
            <span>{screenings.length} film{screenings.length === 1 ? '' : 's'}</span>
          </p>
        </div>
        <Link
          href={`/${portalSlug}/explore/film?venue=${venue.slug}`}
          className="font-mono text-xs text-[var(--vibe)] hover:text-[var(--cream)] transition-colors shrink-0"
        >
          See the week →
        </Link>
      </header>

      <div>
        {shown.map((s) => {
          const tag =
            s.is_curator_pick
              ? buildHeroTag(s, 'curator_pick')
              : s.is_premiere
                ? buildHeroTag(s, 'opens_this_week')
                : null;
          const meta = [
            s.director ? `Dir. ${s.director}` : null,
            s.year,
            runtimeStr(s.runtime_minutes),
            s.rating,
          ]
            .filter(Boolean)
            .join(' · ');

          return (
            <article key={s.run_id} className="flex gap-4 py-3 border-b border-[var(--twilight)]/50 last:border-0">
              <Link
                href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                className="w-24 sm:w-[96px] h-[144px] rounded-card overflow-hidden flex-shrink-0 bg-[var(--dusk)] relative"
              >
                {s.image_url ? (
                  <SmartImage src={s.image_url} alt="" fill sizes="96px" className="object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                  className="font-display text-xl sm:text-2xl font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
                >
                  {s.title}
                </Link>
                {meta && <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>}
                {tag && (
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]">
                    {tag.label}
                  </span>
                )}
                {s.editorial_blurb && (
                  <p className="text-sm italic text-[var(--soft)] mt-1.5">{s.editorial_blurb}</p>
                )}
                <div className="flex items-center gap-1.5 flex-wrap mt-2">
                  {s.times.map((t) => (
                    <Link
                      key={t.id}
                      href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                      className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                    >
                      {t.start_time ? formatTime(t.start_time) : '—'}
                    </Link>
                  ))}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {overflow > 0 && (
        <Link
          href={`/${portalSlug}/explore/film?venue=${venue.slug}`}
          className="block text-sm font-mono text-[var(--vibe)]/80 hover:text-[var(--vibe)] transition-colors"
        >
          +{overflow} more films tonight →
        </Link>
      )}
    </section>
  );
}
```

**Pre-check:** confirm `buildSpotUrl(slug, portal, context)` exists and accepts `'page'` — read `web/lib/entity-urls.ts` lines 1-25 (confirmed in web/CLAUDE.md).

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run app/\[portal\]/explore/film/_components/__tests__/TheaterBlockTier1.test.tsx
git add web/app/\[portal\]/explore/film/_components/TheaterBlockTier1.tsx web/app/\[portal\]/explore/film/_components/__tests__/TheaterBlockTier1.test.tsx
git commit -m "feat(film): TheaterBlockTier1 — full programmer's board card"
```

---

## Task 9: TheaterBlockTier2 component

**Files:**
- Create: `web/app/[portal]/explore/film/_components/TheaterBlockTier2.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier2.test.tsx`

- [ ] **Step 1: Tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/TheaterBlockTier2.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import TheaterBlockTier2 from '../TheaterBlockTier2';
import type { FilmVenue, FilmScreening } from '@/lib/film/types';

function venue(overrides: Partial<FilmVenue> = {}): FilmVenue {
  return {
    id: 2, slug: 'amc-mog', name: 'AMC Mall of Georgia',
    neighborhood: 'Buford', classification: 'premium_format',
    programming_style: null, venue_formats: ['true_imax', '70mm'],
    founding_year: null, google_rating: null, ...overrides,
  };
}

function screening(title: string, time: string, formats: string[] = []): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase().replace(/\s/g, '-'),
    director: null, year: null, runtime_minutes: 140, rating: 'PG-13',
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: formats as never, status: 'scheduled', ticket_url: null, event_id: null }],
  };
}

describe('TheaterBlockTier2', () => {
  it('renders venue name + format capability badges', () => {
    render(<TheaterBlockTier2 venue={venue()} screenings={[screening('Dune', '19:30', ['true_imax'])]} portalSlug="atlanta" />);
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
    expect(screen.getByText(/TRUE IMAX/)).toBeInTheDocument();
  });

  it('renders per-showing format tag on the chip', () => {
    render(<TheaterBlockTier2 venue={venue()} screenings={[screening('Dune', '19:30', ['true_imax'])]} portalSlug="atlanta" />);
    expect(screen.getAllByText(/TRUE IMAX/).length).toBeGreaterThanOrEqual(2); // header badge + chip suffix
  });

  it('omits editorial blurb even if present (Tier 2 suppresses editorial)', () => {
    const s = screening('X', '20:00');
    const sBlurb = { ...s, editorial_blurb: 'Should not render in Tier 2.' };
    render(<TheaterBlockTier2 venue={venue()} screenings={[sBlurb]} portalSlug="atlanta" />);
    expect(screen.queryByText(/Should not render/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/TheaterBlockTier2.tsx
"use client";

import Link from 'next/link';
import SmartImage from '@/components/SmartImage';
import Dot from '@/components/ui/Dot';
import { formatTime } from '@/lib/formats';
import { buildSeriesUrl } from '@/lib/entity-urls';
import type { FilmScreening, FilmVenue, FormatToken } from '@/lib/film/types';

const FORMAT_LABEL: Partial<Record<FormatToken, string>> = {
  true_imax: 'TRUE IMAX',
  imax: 'IMAX',
  dolby_cinema: 'DOLBY CINEMA',
  '4dx': '4DX',
  screenx: 'SCREENX',
  rpx: 'RPX',
  '70mm': '70MM',
  '35mm': '35MM',
};

interface Props {
  venue: FilmVenue;
  screenings: FilmScreening[];
  portalSlug: string;
}

export default function TheaterBlockTier2({ venue, screenings, portalSlug }: Props) {
  return (
    <section className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-3">
      <header>
        <h2 className="font-display text-xl sm:text-2xl font-semibold text-[var(--cream)]">
          {venue.name}
        </h2>
        <div className="flex gap-1.5 mt-1 flex-wrap">
          {venue.venue_formats.map((f) => (
            <span
              key={f}
              className="px-2 py-0.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]"
            >
              {FORMAT_LABEL[f] ?? f.toUpperCase()}
            </span>
          ))}
        </div>
        <p className="font-mono text-xs text-[var(--muted)] mt-1.5 flex items-center gap-1.5">
          {venue.neighborhood && <span>{venue.neighborhood}</span>}
          {venue.neighborhood && <Dot />}
          <span>{screenings.length} film{screenings.length === 1 ? '' : 's'}</span>
        </p>
      </header>

      <div>
        {screenings.map((s) => {
          const meta = [s.runtime_minutes ? `${s.runtime_minutes}m` : null, s.rating]
            .filter(Boolean)
            .join(' · ');
          return (
            <article key={s.run_id} className="flex gap-3 py-2 border-b border-[var(--twilight)]/30 last:border-0">
              <Link
                href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                className="w-16 sm:w-[64px] h-[96px] rounded overflow-hidden flex-shrink-0 bg-[var(--dusk)] relative"
              >
                {s.image_url ? (
                  <SmartImage src={s.image_url} alt="" fill sizes="64px" className="object-cover" />
                ) : null}
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                  className="text-base sm:text-lg font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors"
                >
                  {s.title}
                </Link>
                {meta && <p className="font-mono text-xs text-[var(--muted)] mt-0.5">{meta}</p>}
                <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                  {s.times.map((t) => {
                    const primaryFmt = t.format_labels[0];
                    const suffix = primaryFmt ? ` · ${FORMAT_LABEL[primaryFmt] ?? primaryFmt.toUpperCase()}` : '';
                    return (
                      <Link
                        key={t.id}
                        href={buildSeriesUrl(s.slug, portalSlug, 'film')}
                        className="px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25 transition-colors"
                      >
                        {t.start_time ? formatTime(t.start_time) : '—'}
                        {suffix && <span className="text-2xs ml-1 text-[var(--gold)]">{suffix}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
git add web/app/\[portal\]/explore/film/_components/TheaterBlockTier2.tsx web/app/\[portal\]/explore/film/_components/__tests__/TheaterBlockTier2.test.tsx
git commit -m "feat(film): TheaterBlockTier2 — compressed format-led card"
```

---

## Task 10: ByTheaterView — tier-aware dispatcher + filter logic

**Files:**
- Create: `web/app/[portal]/explore/film/_components/ByTheaterView.tsx`
- Test: `web/app/[portal]/explore/film/_components/__tests__/ByTheaterView.test.tsx`

- [ ] **Step 1: Tests**

```tsx
// web/app/[portal]/explore/film/_components/__tests__/ByTheaterView.test.tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ByTheaterView from '../ByTheaterView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { TodayPlaybillPayload, FilmVenue, FilmScreening, VenueClassification, FormatToken } from '@/lib/film/types';

function venue(id: number, classification: VenueClassification, name: string, venueFormats: FormatToken[] = []): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification,
    programming_style: classification === 'editorial_program' ? 'repertory' : null,
    venue_formats: venueFormats, founding_year: null, google_rating: null,
  };
}

function screening(title: string, fmt: FormatToken[] = [], overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}-${Math.random()}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase(),
    director: null, year: null, runtime_minutes: null, rating: null,
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(0, 'editorial_program', 'Placeholder'),
    times: [{ id: 't', start_date: '2026-04-23', start_time: '19:45', end_time: null, format_labels: fmt, status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

function payload(): TodayPlaybillPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23',
    total_screenings: 4,
    venues: [
      { venue: venue(1, 'editorial_program', 'Plaza'), screenings: [screening('A')] },
      { venue: venue(2, 'editorial_program', 'Tara'), screenings: [screening('B')] },
      { venue: venue(3, 'premium_format', 'AMC MoG', ['true_imax']), screenings: [screening('C', ['true_imax'])] },
      { venue: venue(4, 'premium_format', 'Regal AS', ['imax', '4dx']), screenings: [screening('D', ['4dx'])] },
    ],
  };
}

describe('ByTheaterView', () => {
  it('groups Tier 1 first, then PREMIUM FORMATS divider, then Tier 2', () => {
    render(<ByTheaterView playbill={payload()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza')).toBeInTheDocument();
    expect(screen.getByText('Tara')).toBeInTheDocument();
    expect(screen.getByText(/PREMIUM FORMATS/i)).toBeInTheDocument();
    expect(screen.getByText('AMC MoG')).toBeInTheDocument();
    expect(screen.getByText('Regal AS')).toBeInTheDocument();
  });

  it('filters by format (true_imax) — drops Regal AS (no true_imax screening)', () => {
    render(
      <ByTheaterView
        playbill={payload()}
        filters={{ ...DEFAULT_FILTERS, formats: ['true_imax'] }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Regal AS')).not.toBeInTheDocument();
    expect(screen.getByText('AMC MoG')).toBeInTheDocument();
  });

  it('filters premieres only — drops all if none flagged', () => {
    render(
      <ByTheaterView
        playbill={payload()}
        filters={{ ...DEFAULT_FILTERS, premieresOnly: true }}
        portalSlug="atlanta"
      />,
    );
    expect(screen.queryByText('Plaza')).not.toBeInTheDocument();
    expect(screen.getByText(/No screenings match/i)).toBeInTheDocument();
  });

  it('shows empty state message when venues is empty', () => {
    render(
      <ByTheaterView
        playbill={{ ...payload(), venues: [], total_screenings: 0 }}
        filters={DEFAULT_FILTERS}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/ByTheaterView.tsx
"use client";

import { FilmSlate } from '@phosphor-icons/react';
import TheaterBlockTier1 from './TheaterBlockTier1';
import TheaterBlockTier2 from './TheaterBlockTier2';
import type { FilmFilters } from './FilmFilterChips';
import type { FilmScreening, TodayPlaybillPayload } from '@/lib/film/types';

function screeningPassesFilters(s: FilmScreening, f: FilmFilters): boolean {
  if (f.premieresOnly && !s.is_premiere) return false;
  if (f.festival && !s.festival_id) return false;
  if (f.oneNightOnly && s.times.length > 1) return false;
  if (f.driveIn && s.venue.programming_style !== 'drive_in') return false;
  if (f.formats.length > 0) {
    const screeningFormats = new Set(s.times.flatMap((t) => t.format_labels));
    const any = f.formats.some((ff) => screeningFormats.has(ff));
    if (!any) return false;
  }
  return true;
}

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface ByTheaterViewProps {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ByTheaterView({ playbill, filters, portalSlug }: ByTheaterViewProps) {
  const filteredVenues = playbill.venues
    .map(({ venue, screenings }) => ({
      venue,
      screenings: screenings.filter((s) => screeningPassesFilters(s, filters)),
    }))
    .filter(({ screenings }) => screenings.length > 0);

  if (playbill.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  if (filteredVenues.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm italic text-[var(--muted)]">
          No screenings match your filters.
        </p>
      </div>
    );
  }

  const tier1 = filteredVenues.filter((v) => v.venue.classification === 'editorial_program');
  const tier2 = filteredVenues.filter((v) => v.venue.classification === 'premium_format');
  const total = filteredVenues.reduce((n, v) => n + v.screenings.length, 0);

  return (
    <div className="space-y-6">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            By Theater · {prettyDate(playbill.date).toUpperCase()}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            Atlanta&apos;s programs tonight.
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {tier1.length} ind{tier1.length === 1 ? 'ie' : 'ies'} + {tier2.length} premium screen
          {tier2.length === 1 ? '' : 's'} · {total} screening{total === 1 ? '' : 's'}
        </span>
      </header>

      <div className="space-y-4">
        {tier1.map(({ venue, screenings }) => (
          <TheaterBlockTier1 key={venue.id} venue={venue} screenings={screenings} portalSlug={portalSlug} />
        ))}
      </div>

      {tier2.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <span className="flex-1 h-px bg-[var(--twilight)]" />
            <span className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
              Premium Formats
            </span>
            <span className="flex-1 h-px bg-[var(--twilight)]" />
          </div>
          <div className="space-y-4">
            {tier2.map(({ venue, screenings }) => (
              <TheaterBlockTier2 key={venue.id} venue={venue} screenings={screenings} portalSlug={portalSlug} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

`cd web && npx vitest run app/\[portal\]/explore/film/_components/__tests__/ByTheaterView.test.tsx`

```bash
git add web/app/\[portal\]/explore/film/_components/ByTheaterView.tsx web/app/\[portal\]/explore/film/_components/__tests__/ByTheaterView.test.tsx
git commit -m "feat(film): ByTheaterView — tier 1 / tier 2 dispatcher + filter logic"
```

---

## Task 11: FilmExploreShell (client) — ties state together

**Files:**
- Create: `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx`

This client component owns:
- `selectedDate` (default: initial date from server)
- `view` (default: 'by-theater')
- `filters` (default: DEFAULT_FILTERS)
- On date change: refetch `/api/film/today-playbill?portal=&date=`

No new tests for this file (integration concerns covered by child tests + Task 14 browser verify). Trust the pieces.

- [ ] **Step 1: Implement**

```tsx
// web/app/[portal]/explore/film/_components/FilmExploreShell.tsx
"use client";

import { useCallback, useEffect, useState } from 'react';
import DateStrip from './DateStrip';
import ViewToggle, { type ExploreView } from './ViewToggle';
import FilmFilterChips, { DEFAULT_FILTERS, type FilmFilters } from './FilmFilterChips';
import ThisWeekZone from './ThisWeekZone';
import ByTheaterView from './ByTheaterView';
import type {
  ThisWeekPayload,
  TodayPlaybillPayload,
} from '@/lib/film/types';
import type { DateCount } from '@/lib/film/date-counts-loader';

interface FilmExploreShellProps {
  portalSlug: string;
  today: string;
  initialDate: string;
  initialCounts: DateCount[];
  initialThisWeek: ThisWeekPayload;
  initialPlaybill: TodayPlaybillPayload;
  editorialSubtitle: string | null;
}

export default function FilmExploreShell({
  portalSlug,
  today,
  initialDate,
  initialCounts,
  initialThisWeek,
  initialPlaybill,
  editorialSubtitle,
}: FilmExploreShellProps) {
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [view, setView] = useState<ExploreView>('by-theater');
  const [filters, setFilters] = useState<FilmFilters>(DEFAULT_FILTERS);
  const [playbill, setPlaybill] = useState<TodayPlaybillPayload>(initialPlaybill);
  const [loading, setLoading] = useState(false);

  const handleDateSelect = useCallback(
    (date: string) => {
      setSelectedDate(date);
      if (date === initialDate) {
        setPlaybill(initialPlaybill);
        return;
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10_000);
      setLoading(true);
      fetch(`/api/film/today-playbill?portal=${portalSlug}&date=${date}`, {
        signal: controller.signal,
      })
        .then((r) => (r.ok ? (r.json() as Promise<TodayPlaybillPayload>) : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((p) => setPlaybill(p))
        .catch((err) => {
          if (err instanceof Error && err.name === 'AbortError') return;
          // fall back to empty playbill for this date
          setPlaybill({
            portal_slug: portalSlug,
            date,
            total_screenings: 0,
            venues: [],
          });
        })
        .finally(() => {
          clearTimeout(timeoutId);
          setLoading(false);
        });
    },
    [portalSlug, initialDate, initialPlaybill],
  );

  useEffect(() => {
    // no-op — placeholder for future URL sync
  }, [selectedDate, view, filters]);

  return (
    <>
      <section className="space-y-1">
        <nav className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--vibe)]">
          Explore <span className="text-[var(--muted)] mx-1.5">/</span> Film
        </nav>
        <div className="flex items-end justify-between">
          <h1 className="font-display italic text-3xl sm:text-5xl font-semibold text-[var(--cream)]">
            Films Showing in Atlanta.
          </h1>
          <span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
            CURATED BY <span className="text-[var(--gold)]">Lost City Film</span>
          </span>
        </div>
        {editorialSubtitle && (
          <p className="text-sm sm:text-base italic text-[var(--soft)] pt-1">
            {editorialSubtitle}
          </p>
        )}
      </section>

      <DateStrip
        counts={initialCounts}
        selectedDate={selectedDate}
        today={today}
        onSelect={handleDateSelect}
      />

      <div className="flex items-center gap-4 flex-wrap">
        <ViewToggle view={view} onChange={setView} />
        <FilmFilterChips value={filters} onChange={setFilters} />
      </div>

      <ThisWeekZone thisWeek={initialThisWeek} portalSlug={portalSlug} />

      <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Typecheck clean**

`cd web && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add web/app/\[portal\]/explore/film/_components/FilmExploreShell.tsx
git commit -m "feat(film): FilmExploreShell — client state container"
```

---

## Task 12: page.tsx + loading.tsx (server RSC)

**Files:**
- Create: `web/app/[portal]/explore/film/page.tsx`
- Create: `web/app/[portal]/explore/film/loading.tsx`

- [ ] **Step 1: Implement loading.tsx**

```tsx
// web/app/[portal]/explore/film/loading.tsx
export default function Loading() {
  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6">
      <div className="h-4 w-48 bg-[var(--twilight)] rounded animate-pulse" />
      <div className="h-12 w-2/3 bg-[var(--twilight)] rounded animate-pulse" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="w-[88px] h-[86px] rounded-card bg-[var(--twilight)] animate-pulse" />
        ))}
      </div>
      <div className="h-[300px] rounded-card bg-[var(--twilight)] animate-pulse" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-48 rounded-card-xl bg-[var(--twilight)] animate-pulse" />
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Implement page.tsx**

```tsx
// web/app/[portal]/explore/film/page.tsx
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { resolvePortalRequest } from '@/lib/portal-runtime/resolvePortalRequest';
import { loadThisWeek } from '@/lib/film/this-week-loader';
import { loadTodayPlaybill } from '@/lib/film/today-playbill-loader';
import { loadDateCounts } from '@/lib/film/date-counts-loader';
import { buildEditorialSubtitle } from '@/lib/film/editorial-subtitle';
import FilmExploreShell from './_components/FilmExploreShell';

type Props = {
  params: Promise<{ portal: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const revalidate = 300;

function todayYyyymmdd(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function PortalExploreFilmPage({ params, searchParams }: Props) {
  const { portal: slug } = await params;
  const searchParamsData = await searchParams;
  const normalizedEntries = Object.entries(searchParamsData).flatMap(([key, value]) =>
    value === undefined
      ? []
      : Array.isArray(value)
        ? value.map((entry) => [key, entry])
        : [[key, value]],
  ) as string[][];
  const rawParams = new URLSearchParams(normalizedEntries);
  const headersList = await headers();
  const request = await resolvePortalRequest({
    slug,
    headersList,
    pathname: `/${slug}/explore/film`,
    searchParams: rawParams,
    surface: 'explore',
  });
  if (!request) notFound();

  const today = todayYyyymmdd();
  const to = addDays(today, 13); // 14-day window inclusive

  const [thisWeek, playbill, counts] = await Promise.all([
    loadThisWeek({ portalSlug: slug }),
    loadTodayPlaybill({ portalSlug: slug, date: today }),
    loadDateCounts({ portalSlug: slug, from: today, to }),
  ]);

  const editorialSubtitle = buildEditorialSubtitle(thisWeek.heroes);

  return (
    <main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6 sm:space-y-8">
      <FilmExploreShell
        portalSlug={slug}
        today={today}
        initialDate={today}
        initialCounts={counts}
        initialThisWeek={thisWeek}
        initialPlaybill={playbill}
        editorialSubtitle={editorialSubtitle}
      />
    </main>
  );
}
```

**Pre-check:** confirm `resolvePortalRequest` is imported from `@/lib/portal-runtime/resolvePortalRequest` (matches `web/app/[portal]/explore/page.tsx` line 3). Adjust if path differs.

- [ ] **Step 3: Typecheck**

`cd web && npx tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add web/app/\[portal\]/explore/film/page.tsx web/app/\[portal\]/explore/film/loading.tsx
git commit -m "feat(film): /{portal}/explore/film page + loading shell"
```

---

## Task 13: Full test suite + lint check

- [ ] **Step 1: Run everything**

```bash
cd web
npx tsc --noEmit
npx vitest run
npm run lint
```

Expected: all green. Prior PR #36 had ~1113 tests; this plan adds +6 DateStrip, +4 ThisWeekZone, +4 ViewToggle, +4 FilmFilterChips, +5 TheaterBlockTier1, +3 TheaterBlockTier2, +4 ByTheaterView, +7 editorial-subtitle, +4 date-counts-loader, +3 date-counts route = **+44 new tests**. Target: ~1157 tests.

- [ ] **Step 2: If anything fails, fix the failing test**

Don't mask failures — root-cause them. If a Tier filter drops a venue unexpectedly, fix the filter logic. If tsc complains about a type, fix the type (not the test).

- [ ] **Step 3: No changes expected from this task — it's a verify-only checkpoint**

---

## Task 14: Browser verify on Vercel preview

**Do NOT start a local dev server if another agent's is running or memory is tight.** Prefer Vercel preview as the primary verification surface.

- [ ] **Step 1: Pre-flight `vm_stat` + `lsof -i :3000`**

If free pages < 5000 OR port 3000 is already bound: skip local verify, push branch, verify on Vercel preview.

- [ ] **Step 2: Push branch early to get preview**

```bash
git push -u origin feature/film-explore-page
```

- [ ] **Step 3: Open draft PR so Vercel builds a preview**

```bash
gh pr create --draft --title "feat(film): /explore/film page (shell + This Week + By Theater) — draft" --body "Draft for preview verification before finalizing. Plans 5 + 6 still outstanding for By Film + Schedule views."
```

- [ ] **Step 4: Wait for preview URL in PR, load it**

When `gh pr view <N> --json statusCheckRollup | jq '.statusCheckRollup[] | select(.name == "Vercel" or .context == "Vercel")'` shows SUCCESS, grab `targetUrl`.

- [ ] **Step 5: Single-agent QA pass**

Use `/qa` skill on `<preview-url>/atlanta/explore/film`.

Capture ≤4 screenshots:
1. Desktop 1440×900 top of page (breadcrumb + title + date strip + This Week)
2. Desktop 1440×900 mid-scroll (Tier 1 Plaza block + Tier 2 AMC MoG)
3. Mobile 375×812 top of page
4. Mobile 375×812 mid-scroll

**Check:**
- Breadcrumb renders as `EXPLORE  /  FILM`
- Title renders with italic display type
- Editorial subtitle appears beneath (derived from curator picks)
- Date strip shows 14 pills with TODAY in gold, film counts, any premiere markers
- ViewToggle shows By Theater active (gold dot), By Film + Schedule disabled with "soon"
- Filter chips interactive
- This Week zone renders 1–3 hero tiles (depends on seed)
- At least one Tier 1 block (Plaza/Tara/etc) renders with editorial blurb + showtime chips
- At least one Tier 2 block (AMC Mall of Georgia) renders with TRUE IMAX badge + format-tagged showtime chips
- Click a date pill in the strip → By-Theater block updates to that date's screenings
- Click a format filter chip → unmatching venues are hidden
- Empty state (click a date with 0 results if possible) → "No screenings on this date."

- [ ] **Step 6: File browser issues inline in the PR body if any surface**

- [ ] **Step 7: Mark PR ready for review**

```bash
gh pr ready <PR-NUMBER>
```

---

## Task 15: Motion audit + light polish

- [ ] **Step 1: `/motion audit <preview-url>/atlanta/explore/film`**

Expected output: staggered entrance on Tier 1 blocks, hover lifts on film rows inside the programmer's board, showtime-chip press feedback, date-pill active tint transition.

- [ ] **Step 2: Light-touch apply**

Skip over-animation. The widget already has entrance via page-level transition. Acceptable additions (if not gold-plating):
- 150ms fade on ByTheaterView when date changes (already wired via `loading ? opacity-60 : ''` in FilmExploreShell)
- `hover:translate-y-[-1px]` on film rows inside Tier 1

If the audit surfaces nothing meaningful, skip and note.

- [ ] **Step 3: Commit any motion tweaks**

```bash
git add -A
git commit -m "feat(film): /explore/film motion polish" || echo "no motion changes"
```

---

## Task 16: Open/update PR for merge

- [ ] **Step 1: Final verify**

```bash
cd web && npx tsc --noEmit && npx vitest run && npm run lint
```

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Update PR description (non-draft)**

```bash
gh pr edit <PR-NUMBER> --title "feat(film): /{portal}/explore/film — shell + This Week + By Theater" --body "$(cat <<'EOF'
## Summary

Phase 1c of the film editorial refresh — ships the first usable `/{portal}/explore/film` page. Venue row arrows in the feed widget (PR #36) now resolve instead of 404'ing.

**Page shell:** breadcrumb `EXPLORE / FILM` · italic display title `Films Showing in Atlanta.` · editorial subtitle auto-derived from This Week heroes.

**Controls:** 14-day date strip with per-day screening counts + premiere markers · view toggle (By Theater active; By Film + Schedule coming in Plans 5 & 6) · global filter chips (formats + attributes).

**This Week zone:** same editorial pattern as the feed widget, at larger scale (`hero-large-*` density variants of `HeroTile`).

**By Theater view:** Tier 1 programmer's board (Plaza/Tara/Starlight/Landmark/Springs) with founding-year accent, per-film portrait still, gold editorial badge, editorial blurb, showtime chips · PREMIUM FORMATS divider · Tier 2 compressed (AMC MoG, Regal AS, Dolby locations) with venue format capability badges + per-showing format-tagged chips.

## What's included

**Client state:**
- `FilmExploreShell` — owns selectedDate / view / filters, fetches `/api/film/today-playbill` on date change.

**New components:**
- `DateStrip` · `ViewToggle` · `FilmFilterChips` · `ThisWeekZone` · `ByTheaterView` · `TheaterBlockTier1` · `TheaterBlockTier2`.

**Reused from PR #36:**
- `HeroTile` (extended with `hero-large-*` densities).

**New pure helpers:**
- `editorial-subtitle.ts` — derives "This week — Bunnylovr opens at Plaza, …" from hero cascade.
- `date-counts-loader.ts` — summarization logic + Supabase wrapper.

**New API:**
- `/api/film/date-counts?portal=&from=&to=` — powers the date strip.

**+44 new tests · typecheck clean · lint clean · full suite green.**

## Out of scope (later plans)

- **Plan 5:** By Film view — editorial grouping (Opens/Now Playing/Closes), playing-at matrix.
- **Plan 6:** Schedule view — time × theater grid with current-time line and sunset marker.
- Tier 3 (additional theaters opt-in) — deferred to a dedicated task after this plan.
- "Pick a date ↗" custom picker for day 15+ — deferred.
- Filter multi-select glyph refinements — deferred.

## Test plan

- [ ] CI green
- [ ] Vercel preview: \`/{portal}/explore/film\` loads with 14-day strip, This Week triptych, Tier 1 blocks, PREMIUM FORMATS divider, Tier 2 blocks
- [ ] Click a date pill → By-Theater view updates (subtle loading fade)
- [ ] Click a format filter chip (e.g. \`True IMAX\`) → only venues with matching screenings remain
- [ ] Click a film title → \`/{portal}/showtimes/{slug}\`
- [ ] Click venue name in Tier 1 header → \`/{portal}/spots/{slug}\`
- [ ] Click "See the week →" on a venue → stays on explore page with \`?venue={slug}\` query (no route yet — expected)
- [ ] Mobile 375px: date strip scrolls horizontally; blocks stack with no overflow

## Design references

- Spec: \`docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md\` §6.1–6.3
- Handoff: \`docs/superpowers/specs/2026-04-17-film-explore-page-handoff.md\`
- Plan: \`docs/superpowers/plans/2026-04-17-film-explore-page.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Return PR URL**

---

## Self-review notes

- **Spec coverage:** §6.1 shell → Tasks 4, 6, 7, 11, 12. §6.2 This Week → Task 5. §6.3 By Theater (Tier 1 + Tier 2) → Tasks 8, 9, 10. §6.3 Tier 3 opt-in → explicitly deferred (not in scope). §7 cross-view rules (1,2,3,5) → FilmExploreShell. §7 (4: filters global) → FilmFilterChips + ByTheaterView.
- **Type consistency:** `FilmScreening`, `FilmVenue`, `TodayPlaybillPayload`, `ThisWeekPayload`, `FormatToken`, `VenueClassification` all from `web/lib/film/types.ts` (shipped PR #35; verified).
- **No placeholders** — every code block is complete, every file path concrete, every test case has actual assertions.
- **Reuses shipped work:** `HeroTile` extended (not forked). `buildHeroTag` reused for Tier 1 gold badges. `buildSeriesUrl(slug, portal, 'film')` — noted correction from PR #36 subagent.
- **Design handoff gate:** Task 1 comes first.
- **Browser verify gate:** Task 14 single-agent, capped screenshots, Vercel preview preferred over local dev per memory-budget rule.
- **Motion posture:** Task 15 light touch, explicitly warns against gold-plating.
- **Split potential:** Tasks are mostly independent after Task 3. If the executor wants parallelism later, Tasks 6/7 + Tasks 8/9 can run in parallel once their parent isn't blocking.
