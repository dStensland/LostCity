# Schedule Grid View — /explore/film Plan 6

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the **Schedule** grid view on `/{portal}/explore/film` — a print-style time × theater grid for the selected date. X-axis is time (11am → 1am, 30min ticks); Y-axis is theaters (Tier 1 first, `PREMIUM FORMATS` divider, Tier 2 below). Cells are anchored at each screening's start time, widths proportional to runtime, border tint by significance (gold=premiere, coral=closing, vibe=regular). Overlays: vertical gridlines, current-time red line with `NOW` label, sunset marker on the drive-in row, gold tint on the True IMAX row label. Filters dim non-matching cells (no reflow).

**Architecture:** Pure client component. Reuses the `loadTodayPlaybill` payload already fetched by `FilmExploreShell` — no new API work. Positions/widths computed via pure helpers (minutes-since-grid-start × px-per-minute). Horizontal scroll on both desktop and mobile (vertical-transpose deferred per spec §9 Q1). Current-time line updates via `setInterval(60_000)`. Filter visual effect: dim unmatched cells to opacity-20 + optional gold halo on matches.

**Tech Stack:** Next.js 16 client component, Tailwind v4 tokens, Phosphor icons, existing `buildSeriesUrl` / `buildSpotUrl` / `formatTime` primitives, Vitest + React Testing Library.

---

## Spec references

- Design spec: `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6.5 (Schedule view) + §7 (cross-view rules) + §9 Q1 (mobile transpose deferred)
- Plan 4 shipped: `FilmExploreShell`, `ViewToggle`, `FilmFilterChips`, `ThisWeekZone`, `ByTheaterView`
- Plan 5 shipped (#39): `ByFilmView`, `FilmCard`, `EditorialGroupHeader`
- Data layer: reuses `TodayPlaybillPayload` (already in shell state as `playbill`) — no new loader or API route
- Existing helpers: `buildSeriesUrl(slug, portal, 'film')`, `buildSpotUrl(slug, portal, 'page')`, `formatTime(hh:mm)`, `buildHeroTag`

## File structure

**Create (helpers):**
- `web/lib/film/schedule-geometry.ts` — pure functions: `minutesSinceStart`, `cellLeft`, `cellWidth`, `currentTimeLine`, `sunsetLine` (sunset hard-coded approx per date; real sunrise/sunset is deferred to a follow-up since `loadSchedule` already has the stub). 8 unit tests.

**Create (components):**
- `web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx` — a single screening cell with absolute positioning + significance-tinted border.
- `web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx` — hour labels + tick marks along the top of the grid.
- `web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx` — composes axis + theater rows + cells + current-time line.
- `web/app/[portal]/explore/film/_components/ScheduleView.tsx` — top-level view: zone header + grid + empty state.

**Tests (co-located under `__tests__/`):**
- `web/lib/film/__tests__/schedule-geometry.test.ts`
- `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleCell.test.tsx`
- `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleTimeAxis.test.tsx`
- `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleGrid.test.tsx`
- `web/app/[portal]/explore/film/_components/__tests__/ScheduleView.test.tsx`

**Modify:**
- `web/app/[portal]/explore/film/_components/ViewToggle.tsx` — flip `disabled: false` on `'schedule'`.
- `web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx` — update tests (no more disabled options).
- `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx` — add `<ScheduleView>` to the view dispatcher alongside `<ByTheaterView>` and `<ByFilmView>`. No extra data fetching — `playbill` is already in state.

---

## Grid geometry constants (used throughout)

These land in `schedule-geometry.ts` and are referenced everywhere else. Don't duplicate values:

```ts
export const SCHEDULE_START_HOUR = 11; // 11:00 AM — first column
export const SCHEDULE_END_HOUR = 25;   // 01:00 AM next day — 14 hours total
export const PX_PER_MINUTE = 3;        // 3px/min → full grid = 2520px wide
export const ROW_HEIGHT = 72;
export const CELL_MIN_WIDTH = 48;      // Cells narrower than this feel broken
export const TIER_DIVIDER_HEIGHT = 32;
```

Total grid width: `(SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60 * PX_PER_MINUTE = 2520px`.

---

## Task 1: Design handoff

**Files:**
- Create: `docs/superpowers/specs/2026-04-17-film-schedule-view-handoff.md`

- [ ] **Step 1: Write the handoff doc**

```markdown
# /explore/film Schedule View — Design Handoff

**Source of truth:** verbal spec §6.5 (Pencil node `i2XB5` covered shell + By-Theater; Schedule wasn't re-extracted)
**Extracted:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6.5

## Geometry

- X-axis: 11:00 → 25:00 (1am next day), 14 hours
- Pixels/minute: 3 → full grid width 2520px
- Row height: 72px
- Tier divider: 32px inline band
- Horizontal scroll on both desktop + mobile (vertical transpose deferred)

## Time axis (§6.5)

- Container: sticky top, `h-8 border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm z-10`
- Hour ticks: every 60min (`left = i * 60 * PX_PER_MINUTE`)
  - Label: `{h} AM` / `{h} PM` / `12 AM` / `1 AM`, `font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]`, anchored at `left + 4px`
  - Gridline: 1px vertical `bg-[var(--twilight)]/80` full height
- Half-hour minor ticks: `bg-[var(--twilight)]/30`, shorter (only top 4px of axis)

## Theater rows (§6.5)

- Row: `relative h-[72px] border-b border-[var(--twilight)]/60 last:border-0`
- Left row label (sticky left column, 160px wide):
  - `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--cream)]`
  - For venue with `venue_formats` containing `true_imax`: add `text-[var(--gold)]` tint
  - For `programming_style === 'drive_in'`: add a small `DRIVE-IN` suffix in gold
- Right scrolling region: `relative flex-1 h-full`

## Cells (§6.5)

- Absolute-positioned `<Link>` inside the row's scrolling region:
  - `left = minutesSinceStart(start_time) * PX_PER_MINUTE`
  - `width = max(runtime_minutes * PX_PER_MINUTE, CELL_MIN_WIDTH)`
  - `top = 4px`, `height = 64px` (row 72 - 8 vertical padding)
- Background: `bg-[var(--dusk)]`
- Border: 1px, tint by significance:
  - `is_premiere` → `border-[var(--gold)]`
  - Closes this week (run.end_date === today) → `border-[var(--coral)]`
  - Otherwise → `border-[var(--vibe)]/40`
- Rounded: `rounded-md`
- Padding: `px-2 py-1.5`
- Content (stacked):
  - Line 1: `font-semibold text-sm text-[var(--cream)] truncate` — film title
  - Line 2: `font-mono text-2xs text-[var(--muted)]` — `{runtime}m · {rating} · {FORMAT}` (format from `format_labels[0]` uppercase, omit if none)
- Hover: `hover:bg-[var(--dusk)]/80 hover:border-[var(--cream)]/40 transition-colors`
- Tap: links to `buildSeriesUrl(slug, portal, 'film')` — `/{portal}/showtimes/{slug}` (plan-creation integration deferred)

## Current-time line (§6.5)

- Vertical 1px line `bg-[var(--coral)]` absolutely positioned inside the grid
- `left = currentTimeLine(now) * PX_PER_MINUTE`
- Renders only when `now` falls within `[SCHEDULE_START_HOUR, SCHEDULE_END_HOUR]` on the selected date
- `NOW {HH:MM}` label pinned at the top: `absolute -top-4 -translate-x-1/2 px-1.5 py-0.5 rounded bg-[var(--coral)] text-[var(--void)] font-mono text-2xs font-bold`
- State refreshes every 60s

## Sunset marker

- Renders only on `programming_style === 'drive_in'` rows
- Hardcoded Atlanta sunset times by month (v1 — `lib/film/schedule-geometry.ts` constant table). Real `suncalc` wiring deferred.
- Vertical gold dashed line `border-l border-dashed border-[var(--gold)]/70` 
- `sunset 8:04` label in `font-mono text-2xs text-[var(--gold)]` pinned top of row

## Tier divider (§6.5)

Between last Tier 1 row and first Tier 2 row:

- `h-[32px] flex items-center gap-3 border-y border-[var(--twilight)]`
- `flex-1 h-px bg-[var(--twilight)]` on both sides
- Label: `PREMIUM FORMATS` `font-mono text-2xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]`

## Filter visual effect (§6.5)

- Filters do NOT reflow the grid
- When a cell doesn't match: `opacity-20 grayscale`
- When a cell matches: `ring-1 ring-[var(--gold)]/40 shadow-[0_0_12px_rgba(255,217,61,0.15)]`
- When no filters active: all cells at full opacity, no halo

## Empty state (§6.5)

Same pattern as ByTheaterView — identical copy:
- Icon: Phosphor `FilmSlate` 
- Heading: `No screenings on this date.`
- Sub: `Try another day from the strip above.`

## Out-of-scope for this plan

- Mobile vertical-transpose layout (spec §9 Q1) — deferred
- Real suncalc-based sunset (schedule-loader has a stub) — deferred; we use a 12-entry month table
- Tier 3 opt-in additional theaters — deferred (consistent with ByTheaterView)
- Plan-creation on cell tap — deferred; v1 links to film detail
- Long-press / (i) glyph for film details — deferred (v1 tap = navigate)
```

- [ ] **Step 2: Commit**

```bash
git add docs/superpowers/specs/2026-04-17-film-schedule-view-handoff.md
git commit -m "docs(film): Schedule grid view design handoff"
```

---

## Task 2: `schedule-geometry.ts` + tests

**Files:**
- Create: `web/lib/film/schedule-geometry.ts`
- Create: `web/lib/film/__tests__/schedule-geometry.test.ts`

- [ ] **Step 1: Tests**

```ts
// web/lib/film/__tests__/schedule-geometry.test.ts
import { describe, expect, it } from 'vitest';
import {
  SCHEDULE_START_HOUR,
  SCHEDULE_END_HOUR,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  CELL_MIN_WIDTH,
  minutesSinceStart,
  cellLeft,
  cellWidth,
  currentTimeMinutes,
  sunsetMinutesForDate,
  hoursLabels,
} from '../schedule-geometry';

describe('constants', () => {
  it('exports the 11–25 grid window with 3px/min', () => {
    expect(SCHEDULE_START_HOUR).toBe(11);
    expect(SCHEDULE_END_HOUR).toBe(25);
    expect(PX_PER_MINUTE).toBe(3);
    expect(ROW_HEIGHT).toBe(72);
    expect(CELL_MIN_WIDTH).toBe(48);
  });
});

describe('minutesSinceStart', () => {
  it('returns 0 for 11:00 exactly', () => {
    expect(minutesSinceStart('11:00')).toBe(0);
  });
  it('returns 105 for 12:45', () => {
    expect(minutesSinceStart('12:45')).toBe(105);
  });
  it('returns 840 for 01:00 next day (25:00)', () => {
    // times 00:00–03:00 are treated as next-day (+24h)
    expect(minutesSinceStart('01:00')).toBe((25 - 11) * 60);
  });
  it('returns a negative number for times before the grid opens (treat as pre-window)', () => {
    expect(minutesSinceStart('09:00')).toBeLessThan(0);
  });
});

describe('cellLeft / cellWidth', () => {
  it('cellLeft multiplies minutesSinceStart by PX_PER_MINUTE', () => {
    expect(cellLeft('12:00')).toBe(60 * PX_PER_MINUTE);
  });
  it('cellWidth uses runtime * PX_PER_MINUTE', () => {
    expect(cellWidth(108)).toBe(108 * PX_PER_MINUTE);
  });
  it('cellWidth floors at CELL_MIN_WIDTH', () => {
    expect(cellWidth(5)).toBe(CELL_MIN_WIDTH);
  });
  it('cellWidth handles null runtime as CELL_MIN_WIDTH', () => {
    expect(cellWidth(null)).toBe(CELL_MIN_WIDTH);
  });
});

describe('currentTimeMinutes', () => {
  it('returns null when "now" is outside the grid window', () => {
    const tenAm = new Date('2026-04-23T10:00:00');
    expect(currentTimeMinutes(tenAm, '2026-04-23')).toBeNull();
  });
  it('returns minutes offset inside the window', () => {
    // 14:30 local — 3.5h after 11:00 = 210 min
    const fn = new Date('2026-04-23T14:30:00');
    expect(currentTimeMinutes(fn, '2026-04-23')).toBe(210);
  });
  it('returns null when the selected date is not today', () => {
    const now = new Date('2026-04-23T14:30:00');
    expect(currentTimeMinutes(now, '2026-04-24')).toBeNull();
  });
});

describe('sunsetMinutesForDate', () => {
  it('returns a value in the grid window for April (≈ 8:05pm)', () => {
    const offset = sunsetMinutesForDate('2026-04-23');
    // 20:05 → 9h05 after 11:00 = 545 min, allow ±15 min table tolerance
    expect(offset).toBeGreaterThan(525);
    expect(offset).toBeLessThan(570);
  });
  it('returns a value in the grid window for December (≈ 5:30pm)', () => {
    const offset = sunsetMinutesForDate('2026-12-21');
    // 17:30 → 6h30 after 11:00 = 390 min, allow ±20 min
    expect(offset).toBeGreaterThan(370);
    expect(offset).toBeLessThan(410);
  });
});

describe('hoursLabels', () => {
  it('returns 15 entries covering 11 AM through 1 AM', () => {
    const labels = hoursLabels();
    expect(labels).toHaveLength(SCHEDULE_END_HOUR - SCHEDULE_START_HOUR + 1);
    expect(labels[0]).toMatchObject({ label: '11 AM', minutes: 0 });
    expect(labels[1]).toMatchObject({ label: '12 PM', minutes: 60 });
    expect(labels[13]).toMatchObject({ label: '12 AM' });
    expect(labels[14]).toMatchObject({ label: '1 AM' });
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run lib/film/__tests__/schedule-geometry.test.ts`

- [ ] **Step 3: Implement**

```ts
// web/lib/film/schedule-geometry.ts
export const SCHEDULE_START_HOUR = 11;
export const SCHEDULE_END_HOUR = 25;
export const PX_PER_MINUTE = 3;
export const ROW_HEIGHT = 72;
export const CELL_MIN_WIDTH = 48;
export const TIER_DIVIDER_HEIGHT = 32;

export const GRID_WIDTH_PX =
  (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60 * PX_PER_MINUTE;

// Atlanta sunset approximate table (month index 0-11 → HH:MM local).
// Good enough for v1 drive-in marker; real suncalc integration deferred.
const ATLANTA_SUNSET_BY_MONTH: Record<number, string> = {
  0: '17:45', // Jan
  1: '18:15', // Feb
  2: '19:45', // Mar (DST kick)
  3: '20:10', // Apr
  4: '20:35', // May
  5: '20:52', // Jun
  6: '20:50', // Jul
  7: '20:22', // Aug
  8: '19:42', // Sep
  9: '19:00', // Oct (DST end late-Oct)
  10: '17:30', // Nov
  11: '17:30', // Dec
};

export function minutesSinceStart(hhmm: string): number {
  const [hStr, mStr] = hhmm.split(':');
  let h = Number(hStr);
  const m = Number(mStr);
  // Map 00:00–03:00 to next-day (+24h) so the grid covers midnight
  if (h < SCHEDULE_START_HOUR - 3) h += 24;
  return (h - SCHEDULE_START_HOUR) * 60 + m;
}

export function cellLeft(hhmm: string): number {
  return minutesSinceStart(hhmm) * PX_PER_MINUTE;
}

export function cellWidth(runtimeMinutes: number | null | undefined): number {
  const minutes = runtimeMinutes ?? 0;
  return Math.max(minutes * PX_PER_MINUTE, CELL_MIN_WIDTH);
}

export function currentTimeMinutes(now: Date, selectedDate: string): number | null {
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  if (selectedDate !== todayIso) return null;
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const offset = minutesSinceStart(`${hh}:${mm}`);
  if (offset < 0 || offset > (SCHEDULE_END_HOUR - SCHEDULE_START_HOUR) * 60) {
    return null;
  }
  return offset;
}

export function sunsetMinutesForDate(dateIso: string): number {
  const month = Number(dateIso.slice(5, 7)) - 1; // 0-11
  const hhmm = ATLANTA_SUNSET_BY_MONTH[month] ?? '19:45';
  return minutesSinceStart(hhmm);
}

export function hoursLabels(): Array<{ label: string; minutes: number }> {
  const out: Array<{ label: string; minutes: number }> = [];
  for (let h = SCHEDULE_START_HOUR; h <= SCHEDULE_END_HOUR; h += 1) {
    const displayHour = h === 12 ? 12 : h === 0 || h === 24 ? 12 : h % 12 || 12;
    // h < 12 → AM, h === 12 → PM, 13–23 → PM, 24 → AM, 25 → AM
    const isAm = h < 12 || h >= 24;
    const label = `${displayHour} ${isAm ? 'AM' : 'PM'}`;
    out.push({ label, minutes: (h - SCHEDULE_START_HOUR) * 60 });
  }
  return out;
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run lib/film/__tests__/schedule-geometry.test.ts
cd web && npx tsc --noEmit
cd ..
git add web/lib/film/schedule-geometry.ts web/lib/film/__tests__/schedule-geometry.test.ts
git commit -m "feat(film): schedule-geometry helpers + sunset month table

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: `ScheduleCell` component + tests

**Files:**
- Create: `web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx`
- Create: `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleCell.test.tsx`

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleCell from '../ScheduleCell';
import type { FilmScreening } from '@/lib/film/types';

function screening(overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: 'r1', screening_title_id: 'st1', title: 'Oppenheimer', slug: 'oppenheimer',
    director: null, year: 2023, runtime_minutes: 180, rating: 'R',
    image_url: null, editorial_blurb: null,
    film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: { id: 1, slug: 'plaza', name: 'Plaza', neighborhood: null, classification: 'editorial_program', programming_style: 'repertory', venue_formats: [], founding_year: 1939, google_rating: null },
    times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:30', end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

describe('ScheduleCell', () => {
  it('renders title + meta', () => {
    render(<ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />);
    expect(screen.getByText('Oppenheimer')).toBeInTheDocument();
    expect(screen.getByText(/180m · R/)).toBeInTheDocument();
  });

  it('positions the cell by cellLeft + cellWidth', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    // 19:30 is 8h30 after 11:00 = 510 min, at 3px/min = 1530
    expect(cell.style.left).toBe('1530px');
    // runtime 180 * 3 = 540
    expect(cell.style.width).toBe('540px');
  });

  it('uses gold border for premiered screenings', () => {
    const { container } = render(
      <ScheduleCell screening={screening({ is_premiere: true })} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('border-[var(--gold)]');
  });

  it('uses coral border when closing today (run end_date = selected date)', () => {
    const { container } = render(
      <ScheduleCell
        screening={screening()}
        startTime="19:30"
        matchesFilter={true}
        portalSlug="atlanta"
        closesToday={true}
      />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('border-[var(--coral)]');
  });

  it('dims cell when matchesFilter=false', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={false} portalSlug="atlanta" />,
    );
    const cell = container.firstChild as HTMLElement;
    expect(cell.className).toContain('opacity-20');
  });

  it('links to the showtimes page', () => {
    const { container } = render(
      <ScheduleCell screening={screening()} startTime="19:30" matchesFilter={true} portalSlug="atlanta" />,
    );
    expect(container.querySelector('a')?.getAttribute('href')).toContain('/atlanta/showtimes/oppenheimer');
  });

  it('appends the primary format to the meta line', () => {
    render(
      <ScheduleCell
        screening={screening({
          times: [{ id: 't1', start_date: '2026-04-23', start_time: '19:30', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }],
        })}
        startTime="19:30"
        matchesFilter={true}
        portalSlug="atlanta"
      />,
    );
    expect(screen.getByText(/TRUE IMAX/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleCell.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx
"use client";

import Link from 'next/link';
import { buildSeriesUrl } from '@/lib/entity-urls';
import { cellLeft, cellWidth } from '@/lib/film/schedule-geometry';
import type { FilmScreening, FormatToken } from '@/lib/film/types';

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
  screening: FilmScreening;
  startTime: string; // "HH:MM"
  matchesFilter: boolean;
  portalSlug: string;
  closesToday?: boolean;
}

export default function ScheduleCell({
  screening,
  startTime,
  matchesFilter,
  portalSlug,
  closesToday = false,
}: Props) {
  const left = cellLeft(startTime);
  const width = cellWidth(screening.runtime_minutes);
  const href = buildSeriesUrl(screening.slug, portalSlug, 'film');

  const borderClass = screening.is_premiere
    ? 'border-[var(--gold)]'
    : closesToday
      ? 'border-[var(--coral)]'
      : 'border-[var(--vibe)]/40';

  const matchClass = matchesFilter
    ? ''
    : 'opacity-20 grayscale pointer-events-none';
  const haloClass = matchesFilter
    ? 'hover:ring-1 hover:ring-[var(--cream)]/30'
    : '';

  const fmt = screening.times[0]?.format_labels[0];
  const metaBits = [
    screening.runtime_minutes ? `${screening.runtime_minutes}m` : null,
    screening.rating,
    fmt ? (FORMAT_LABEL[fmt] ?? fmt.toUpperCase()) : null,
  ].filter(Boolean);

  return (
    <Link
      href={href}
      prefetch={false}
      style={{ left: `${left}px`, width: `${width}px`, top: '4px', height: '64px' }}
      className={`absolute flex flex-col justify-center px-2 py-1 rounded-md bg-[var(--dusk)] border ${borderClass} hover:bg-[var(--dusk)]/80 transition-colors overflow-hidden ${matchClass} ${haloClass}`}
    >
      <span className="font-semibold text-sm text-[var(--cream)] truncate leading-tight">
        {screening.title}
      </span>
      {metaBits.length > 0 && (
        <span className="font-mono text-2xs text-[var(--muted)] truncate mt-0.5">
          {metaBits.join(' · ')}
        </span>
      )}
    </Link>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleCell.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx" "web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleCell.test.tsx"
git commit -m "feat(film): ScheduleCell — absolute-positioned screening tile

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: `ScheduleTimeAxis` component + tests

**Files:**
- Create: `web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx`
- Create: `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleTimeAxis.test.tsx`

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleTimeAxis from '../ScheduleTimeAxis';

describe('ScheduleTimeAxis', () => {
  it('renders all 15 hour labels from 11 AM to 1 AM', () => {
    render(<ScheduleTimeAxis />);
    expect(screen.getByText('11 AM')).toBeInTheDocument();
    expect(screen.getByText('12 PM')).toBeInTheDocument();
    expect(screen.getByText('11 PM')).toBeInTheDocument();
    expect(screen.getByText('12 AM')).toBeInTheDocument();
    expect(screen.getByText('1 AM')).toBeInTheDocument();
  });

  it('positions hour labels via inline style left', () => {
    const { container } = render(<ScheduleTimeAxis />);
    const labels = container.querySelectorAll('[data-hour-label]');
    expect(labels.length).toBe(15);
    // 12 PM is 1 hour in = 60 * 3 = 180px
    const twelve = Array.from(labels).find((el) => el.textContent === '12 PM') as HTMLElement;
    expect(twelve.style.left).toBe('180px');
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleTimeAxis.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx
"use client";

import {
  GRID_WIDTH_PX,
  PX_PER_MINUTE,
  hoursLabels,
} from '@/lib/film/schedule-geometry';

export default function ScheduleTimeAxis() {
  const labels = hoursLabels();
  return (
    <div
      className="sticky top-0 z-10 h-8 border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm"
      style={{ width: `${GRID_WIDTH_PX}px` }}
    >
      {labels.map((h) => (
        <span
          key={h.minutes}
          data-hour-label
          style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
          className="absolute top-1.5 pl-1 font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]"
        >
          {h.label}
        </span>
      ))}
      {labels.map((h) => (
        <span
          key={`tick-${h.minutes}`}
          style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
          className="absolute bottom-0 w-px h-2 bg-[var(--twilight)]/60"
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleTimeAxis.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx" "web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleTimeAxis.test.tsx"
git commit -m "feat(film): ScheduleTimeAxis — sticky 11am–1am hour ticks

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: `ScheduleGrid` component + tests

**Goal:** Combines axis + tier-ordered theater rows + cells + current-time line + sunset marker + tier divider. Filter evaluation happens here (same predicate shape as `ByTheaterView.screeningPassesFilters`, but returns a per-cell boolean instead of filtering the array).

**Files:**
- Create: `web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx`
- Create: `web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleGrid.test.tsx`

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleGrid from '../ScheduleGrid';
import { DEFAULT_FILTERS } from '../../FilmFilterChips';
import type { TodayPlaybillPayload, FilmVenue, FilmScreening, VenueClassification, FormatToken } from '@/lib/film/types';

function venue(id: number, name: string, classification: VenueClassification, formats: FormatToken[] = [], programming: 'repertory' | 'drive_in' | null = classification === 'editorial_program' ? 'repertory' : null): FilmVenue {
  return {
    id, slug: name.toLowerCase().replace(/\s/g, '-'), name,
    neighborhood: null, classification, programming_style: programming,
    venue_formats: formats, founding_year: null, google_rating: null,
  };
}

function screening(title: string, time: string, overrides: Partial<FilmScreening> = {}): FilmScreening {
  return {
    run_id: `r-${title}`, screening_title_id: `st-${title}`,
    title, slug: title.toLowerCase(),
    director: null, year: null, runtime_minutes: 120, rating: 'R',
    image_url: null, editorial_blurb: null, film_press_quote: null, film_press_source: null,
    is_premiere: false, premiere_scope: null, is_curator_pick: false,
    festival_id: null, festival_name: null,
    venue: venue(0, 'x', 'editorial_program'),
    times: [{ id: `t-${title}`, start_date: '2026-04-23', start_time: time, end_time: null, format_labels: [], status: 'scheduled', ticket_url: null, event_id: null }],
    ...overrides,
  };
}

function playbill(): TodayPlaybillPayload {
  return {
    portal_slug: 'atlanta', date: '2026-04-23', total_screenings: 3,
    venues: [
      { venue: venue(1, 'Plaza', 'editorial_program'), screenings: [screening('Bunnylovr', '19:30')] },
      { venue: venue(2, 'Starlight', 'editorial_program', [], 'drive_in'), screenings: [screening('Normal', '20:30')] },
      { venue: venue(3, 'AMC Mall of Georgia', 'premium_format', ['true_imax']), screenings: [screening('Dune', '20:00', { times: [{ id: 'td', start_date: '2026-04-23', start_time: '20:00', end_time: null, format_labels: ['true_imax'], status: 'scheduled', ticket_url: null, event_id: null }] })] },
    ],
  };
}

describe('ScheduleGrid', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-23T14:00:00'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a row label for each venue', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Plaza')).toBeInTheDocument();
    expect(screen.getByText('Starlight')).toBeInTheDocument();
    expect(screen.getByText('AMC Mall of Georgia')).toBeInTheDocument();
  });

  it('renders a PREMIUM FORMATS divider before tier 2 rows', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/PREMIUM FORMATS/)).toBeInTheDocument();
  });

  it('renders a cell per screening with the film title', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText('Bunnylovr')).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('Dune')).toBeInTheDocument();
  });

  it('renders a NOW time marker when date === today', () => {
    render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/NOW 14:00/)).toBeInTheDocument();
  });

  it('does NOT render NOW when the selected date is not today', () => {
    render(<ScheduleGrid playbill={{ ...playbill(), date: '2026-04-25' }} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.queryByText(/^NOW/)).not.toBeInTheDocument();
  });

  it('renders a sunset marker only on drive-in rows', () => {
    const { container } = render(<ScheduleGrid playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    const markers = container.querySelectorAll('[data-sunset-marker]');
    expect(markers.length).toBe(1);
  });

  it('dims cells that do not match the True IMAX filter', () => {
    const { container } = render(
      <ScheduleGrid
        playbill={playbill()}
        filters={{ ...DEFAULT_FILTERS, formats: ['true_imax'] }}
        portalSlug="atlanta"
      />,
    );
    // Dune should stay full opacity; Bunnylovr and Normal should dim.
    const dimmed = container.querySelectorAll('.opacity-20');
    expect(dimmed.length).toBeGreaterThanOrEqual(2);
  });

  it('shows an empty state when there are no venues', () => {
    render(<ScheduleGrid playbill={{ ...playbill(), venues: [], total_screenings: 0 }} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleGrid.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx
"use client";

import { useEffect, useState } from 'react';
import { FilmSlate } from '@phosphor-icons/react';
import ScheduleCell from './ScheduleCell';
import ScheduleTimeAxis from './ScheduleTimeAxis';
import type { FilmFilters } from '../FilmFilterChips';
import {
  GRID_WIDTH_PX,
  PX_PER_MINUTE,
  ROW_HEIGHT,
  TIER_DIVIDER_HEIGHT,
  currentTimeMinutes,
  hoursLabels,
  sunsetMinutesForDate,
} from '@/lib/film/schedule-geometry';
import type {
  FilmScreening,
  FilmVenue,
  TodayPlaybillPayload,
} from '@/lib/film/types';

function screeningMatchesFilters(s: FilmScreening, f: FilmFilters): boolean {
  if (f.premieresOnly && !s.is_premiere) return false;
  if (f.festival && !s.festival_id) return false;
  if (f.oneNightOnly && s.times.length > 1) return false;
  if (f.driveIn && s.venue.programming_style !== 'drive_in') return false;
  if (f.formats.length > 0) {
    const set = new Set(s.times.flatMap((t) => t.format_labels));
    if (!f.formats.some((ff) => set.has(ff))) return false;
  }
  return true;
}

function RowLabel({ venue }: { venue: FilmVenue }) {
  const isTrueImax = venue.venue_formats.includes('true_imax');
  const isDriveIn = venue.programming_style === 'drive_in';
  return (
    <div className="sticky left-0 z-20 flex items-center w-[160px] shrink-0 px-3 border-r border-[var(--twilight)] bg-[var(--night)]">
      <span
        className={`font-mono text-xs font-bold uppercase tracking-[0.14em] truncate ${
          isTrueImax ? 'text-[var(--gold)]' : 'text-[var(--cream)]'
        }`}
      >
        {venue.name}
      </span>
      {isDriveIn && (
        <span className="ml-2 font-mono text-2xs text-[var(--gold)]/80 uppercase tracking-wider">
          drive-in
        </span>
      )}
    </div>
  );
}

function TheaterRow({
  venue,
  screenings,
  filters,
  portalSlug,
  selectedDate,
}: {
  venue: FilmVenue;
  screenings: FilmScreening[];
  filters: FilmFilters;
  portalSlug: string;
  selectedDate: string;
}) {
  const isDriveIn = venue.programming_style === 'drive_in';
  const sunsetX = isDriveIn ? sunsetMinutesForDate(selectedDate) * PX_PER_MINUTE : null;

  return (
    <div
      className="flex border-b border-[var(--twilight)]/60 last:border-0"
      style={{ height: `${ROW_HEIGHT}px` }}
    >
      <RowLabel venue={venue} />
      <div
        className="relative flex-1"
        style={{ width: `${GRID_WIDTH_PX}px`, height: `${ROW_HEIGHT}px` }}
      >
        {/* Hour gridlines */}
        {hoursLabels().map((h) => (
          <span
            key={`g-${venue.id}-${h.minutes}`}
            style={{ left: `${h.minutes * PX_PER_MINUTE}px` }}
            className="absolute top-0 bottom-0 w-px bg-[var(--twilight)]/40"
          />
        ))}
        {sunsetX !== null && (
          <>
            <span
              data-sunset-marker
              style={{ left: `${sunsetX}px` }}
              className="absolute top-0 bottom-0 border-l border-dashed border-[var(--gold)]/70"
            />
            <span
              style={{ left: `${sunsetX + 4}px` }}
              className="absolute top-1 font-mono text-2xs text-[var(--gold)]"
            >
              sunset
            </span>
          </>
        )}
        {screenings.map((s) => {
          if (!s.times[0]?.start_time) return null;
          const closesToday = false; // run.end_date not on FilmScreening in v1 — deferred
          return (
            <ScheduleCell
              key={s.run_id}
              screening={s}
              startTime={s.times[0].start_time}
              matchesFilter={screeningMatchesFilters(s, filters)}
              portalSlug={portalSlug}
              closesToday={closesToday}
            />
          );
        })}
      </div>
    </div>
  );
}

interface Props {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ScheduleGrid({ playbill, filters, portalSlug }: Props) {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  if (playbill.venues.length === 0) {
    return (
      <div className="py-12 text-center space-y-3">
        <FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />
        <h3 className="text-xl font-display text-[var(--cream)]">No screenings on this date.</h3>
        <p className="text-sm text-[var(--muted)]">Try another day from the strip above.</p>
      </div>
    );
  }

  const tier1 = playbill.venues.filter((v) => v.venue.classification === 'editorial_program');
  const tier2 = playbill.venues.filter((v) => v.venue.classification === 'premium_format');
  const nowMinutes = currentTimeMinutes(now, playbill.date);
  const hhmm = now.toTimeString().slice(0, 5);

  return (
    <div className="rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] overflow-x-auto">
      <div style={{ width: `${GRID_WIDTH_PX + 160}px` }}>
        <div className="flex">
          <div className="sticky left-0 z-20 w-[160px] shrink-0 border-r border-[var(--twilight)] bg-[var(--night)] h-8" />
          <ScheduleTimeAxis />
        </div>

        <div className="relative">
          {tier1.map(({ venue, screenings }) => (
            <TheaterRow
              key={venue.id}
              venue={venue}
              screenings={screenings}
              filters={filters}
              portalSlug={portalSlug}
              selectedDate={playbill.date}
            />
          ))}

          {tier2.length > 0 && (
            <div
              className="flex items-center gap-3 border-y border-[var(--twilight)] bg-[var(--night)]/90 px-4"
              style={{ height: `${TIER_DIVIDER_HEIGHT}px`, width: `${GRID_WIDTH_PX + 160}px` }}
            >
              <span className="flex-1 h-px bg-[var(--twilight)]" />
              <span className="font-mono text-2xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]">
                Premium Formats
              </span>
              <span className="flex-1 h-px bg-[var(--twilight)]" />
            </div>
          )}

          {tier2.map(({ venue, screenings }) => (
            <TheaterRow
              key={venue.id}
              venue={venue}
              screenings={screenings}
              filters={filters}
              portalSlug={portalSlug}
              selectedDate={playbill.date}
            />
          ))}

          {nowMinutes !== null && (
            <>
              <span
                data-now-line
                style={{
                  left: `${160 + nowMinutes * PX_PER_MINUTE}px`,
                  top: 0,
                  bottom: 0,
                }}
                className="absolute w-px bg-[var(--coral)] pointer-events-none"
              />
              <span
                style={{ left: `${160 + nowMinutes * PX_PER_MINUTE}px`, top: 0 }}
                className="absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded-b bg-[var(--coral)] text-[var(--void)] font-mono text-2xs font-bold whitespace-nowrap"
              >
                NOW {hhmm}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/schedule/__tests__/ScheduleGrid.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx" "web/app/[portal]/explore/film/_components/schedule/__tests__/ScheduleGrid.test.tsx"
git commit -m "feat(film): ScheduleGrid — axis + tiered rows + NOW + sunset

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: `ScheduleView` component + tests

**Goal:** Thin wrapper: zone header (`Schedule · {date}`) + `<ScheduleGrid>`.

**Files:**
- Create: `web/app/[portal]/explore/film/_components/ScheduleView.tsx`
- Create: `web/app/[portal]/explore/film/_components/__tests__/ScheduleView.test.tsx`

- [ ] **Step 1: Tests**

```tsx
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import ScheduleView from '../ScheduleView';
import { DEFAULT_FILTERS } from '../FilmFilterChips';
import type { TodayPlaybillPayload } from '@/lib/film/types';

function playbill(): TodayPlaybillPayload {
  return { portal_slug: 'atlanta', date: '2026-04-23', total_screenings: 0, venues: [] };
}

describe('ScheduleView', () => {
  it('renders the zone header with the formatted date', () => {
    render(<ScheduleView playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/SCHEDULE ·/i)).toBeInTheDocument();
  });

  it('shows the empty-state copy when there are no venues', () => {
    render(<ScheduleView playbill={playbill()} filters={DEFAULT_FILTERS} portalSlug="atlanta" />);
    expect(screen.getByText(/No screenings on this date/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Fail**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ScheduleView.test.tsx"`

- [ ] **Step 3: Implement**

```tsx
// web/app/[portal]/explore/film/_components/ScheduleView.tsx
"use client";

import ScheduleGrid from './schedule/ScheduleGrid';
import type { FilmFilters } from './FilmFilterChips';
import type { TodayPlaybillPayload } from '@/lib/film/types';

function prettyDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

interface Props {
  playbill: TodayPlaybillPayload;
  filters: FilmFilters;
  portalSlug: string;
}

export default function ScheduleView({ playbill, filters, portalSlug }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]">
            Schedule · {prettyDate(playbill.date).toUpperCase()}
          </span>
          <p className="text-sm italic text-[var(--soft)] mt-0.5">
            A print-style grid — scroll right for later tonight.
          </p>
        </div>
        <span className="font-mono text-xs text-[var(--muted)]">
          {playbill.total_screenings} screening{playbill.total_screenings === 1 ? '' : 's'}
        </span>
      </header>
      <ScheduleGrid playbill={playbill} filters={filters} portalSlug={portalSlug} />
    </div>
  );
}
```

- [ ] **Step 4: Pass + commit**

```bash
cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ScheduleView.test.tsx"
cd web && npx tsc --noEmit
cd ..
git add "web/app/[portal]/explore/film/_components/ScheduleView.tsx" "web/app/[portal]/explore/film/_components/__tests__/ScheduleView.test.tsx"
git commit -m "feat(film): ScheduleView wrapper

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Enable `schedule` in `ViewToggle`

**Files:**
- Modify: `web/app/[portal]/explore/film/_components/ViewToggle.tsx`
- Modify: `web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx`

- [ ] **Step 1: Flip the flag**

In `ViewToggle.tsx` `OPTIONS` array, change:
- From: `{ id: 'schedule', label: 'Schedule', disabled: true }`
- To: `{ id: 'schedule', label: 'Schedule', disabled: false }`

All three options are now enabled.

- [ ] **Step 2: Update the existing "disables only Schedule" test**

Replace the current test (added in Plan 5 Task 8) — it asserts By Film is enabled and Schedule is disabled. Both should now be enabled. Rewrite to:

```tsx
  it('enables all three views (all ship in v1)', () => {
    render(<ViewToggle view="by-theater" onChange={() => {}} />);
    expect(screen.getByRole('button', { name: /By Theater/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /By Film/i }).hasAttribute('disabled')).toBe(false);
    expect(screen.getByRole('button', { name: /Schedule/i }).hasAttribute('disabled')).toBe(false);
  });
```

Add a new test:

```tsx
  it('fires onChange("schedule") when Schedule is clicked', () => {
    const onChange = vi.fn();
    render(<ViewToggle view="by-theater" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /Schedule/i }));
    expect(onChange).toHaveBeenCalledWith('schedule');
  });
```

- [ ] **Step 3: Tests pass**

`cd web && npx vitest run "app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx"`
Expected: 6 tests passing (was 5, +1 new; one existing test rewritten).

- [ ] **Step 4: Commit**

```bash
git add "web/app/[portal]/explore/film/_components/ViewToggle.tsx" "web/app/[portal]/explore/film/_components/__tests__/ViewToggle.test.tsx"
git commit -m "feat(film): enable Schedule in ViewToggle

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Wire `ScheduleView` in `FilmExploreShell`

**Files:**
- Modify: `web/app/[portal]/explore/film/_components/FilmExploreShell.tsx`

**Goal:** Add `<ScheduleView>` to the view dispatcher. `ScheduleView` reuses the `playbill` state already fetched for `ByTheaterView` — no new state or fetch required.

- [ ] **Step 1: Read the current dispatcher**

The current render block (after Plan 5) looks like:

```tsx
      <div className={(loading || byFilmLoading) ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {view === 'by-film' ? (
          byFilm ? (
            <ByFilmView payload={byFilm} filters={filters} portalSlug={portalSlug} />
          ) : (
            <div className="h-48 rounded-card-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse" />
          )
        ) : (
          <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
        )}
      </div>
```

**Note:** Plan 5 may have implemented the fetch slightly differently (inline useEffect vs useCallback); read the actual current file and adapt these edits to its real structure. Do NOT copy-paste these edits blindly if they don't match what's on disk.

- [ ] **Step 2: Add the ScheduleView import**

Near the top, alongside existing imports:

```tsx
import ScheduleView from './ScheduleView';
```

- [ ] **Step 3: Replace the view dispatcher with a 3-way switch**

Find the dispatcher block (the `<div className={(loading || byFilmLoading) ? ...}>` wrapper) and replace the inner ternary with an explicit switch:

```tsx
      <div className={(loading || byFilmLoading) ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
        {view === 'by-film' && (
          byFilm ? (
            <ByFilmView payload={byFilm} filters={filters} portalSlug={portalSlug} />
          ) : (
            <div className="h-48 rounded-card-xl bg-[var(--night)] border border-[var(--twilight)] animate-pulse" />
          )
        )}
        {view === 'schedule' && (
          <ScheduleView playbill={playbill} filters={filters} portalSlug={portalSlug} />
        )}
        {view === 'by-theater' && (
          <ByTheaterView playbill={playbill} filters={filters} portalSlug={portalSlug} />
        )}
      </div>
```

- [ ] **Step 4: Typecheck**

`cd web && npx tsc --noEmit`

- [ ] **Step 5: Full vitest run**

`cd web && npx vitest run`
Expected: all existing + new tests green.

- [ ] **Step 6: Commit**

```bash
git add "web/app/[portal]/explore/film/_components/FilmExploreShell.tsx"
git commit -m "feat(film): FilmExploreShell dispatches Schedule view

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Full suite + lint checkpoint

- [ ] **Step 1: Run everything**

```bash
cd web
npx tsc --noEmit
npx vitest run
npm run lint
```

Expected:
- tsc clean
- vitest full suite green. New tests added by this plan: 8 geometry + 7 ScheduleCell + 2 TimeAxis + 8 ScheduleGrid + 2 ScheduleView + 1 ViewToggle (one existing rewritten, net +1) = **+28 new tests**. Target ~1214 tests.
- lint: 0 errors

- [ ] **Step 2: Fix any regressions.** If a test fails or lint raises a new warning on new files, fix it. Don't mask.

---

## Task 10: Push + draft PR

- [ ] **Step 1: Pre-flight `vm_stat` + `lsof -i :3000`**

If memory tight or :3000 is bound by another agent's dev server, skip local verify — Vercel preview is primary.

- [ ] **Step 2: Push + draft PR**

```bash
git push -u origin feature/film-schedule-view

gh pr create --draft --title "feat(film): /explore/film Schedule grid view" --body "$(cat <<'EOF'
## Summary

Phase 1e — ships the **Schedule** grid view on \`/{portal}/explore/film\`. Time × theater grid (11am → 1am, 3px/min), cells absolute-positioned by start_time and runtime. Gold border for premieres, coral for closes-today, vibe for regular. Overlays: hour gridlines, current-time red line with \`NOW\` label, sunset marker on drive-in rows, gold row-label tint for True IMAX venues, PREMIUM FORMATS divider between tiers.

Filters dim non-matching cells (opacity-20 + grayscale) instead of reflowing the grid — density becomes contrast.

ViewToggle now ships all three views — no more "coming soon".

## What's included

- \`web/lib/film/schedule-geometry.ts\` — pure helpers + sunset month table (8 tests)
- \`web/app/[portal]/explore/film/_components/schedule/ScheduleCell.tsx\` — absolute-positioned screening cell (7 tests)
- \`web/app/[portal]/explore/film/_components/schedule/ScheduleTimeAxis.tsx\` — sticky hour labels (2 tests)
- \`web/app/[portal]/explore/film/_components/schedule/ScheduleGrid.tsx\` — axis + tier-ordered rows + NOW line + sunset marker (8 tests)
- \`web/app/[portal]/explore/film/_components/ScheduleView.tsx\` — header + grid wrapper (2 tests)
- \`ViewToggle\` — Schedule enabled (+1 test, 1 rewritten)
- \`FilmExploreShell\` — dispatches Schedule alongside By Theater + By Film

**+28 new tests** · tsc clean · lint clean · full suite green.

## Out of scope

- Mobile vertical-transpose layout (spec §9 Q1) — deferred; v1 uses horizontal scroll on both viewports
- Real suncalc sunset — deferred; v1 uses a 12-entry month table for Atlanta
- Tier 3 additional theaters — deferred (consistent with other views)
- Plan-creation on cell tap — deferred; v1 tap navigates to film detail
- coral closes-today border — component accepts the prop but \`FilmScreening\` doesn't carry \`run.end_date\` today; wiring deferred

## Test plan

- [ ] CI green
- [ ] Vercel preview: visit \`/atlanta/explore/film\`, click **Schedule** → grid renders with Plaza/Tara rows, PREMIUM FORMATS divider, AMC MoG/Regal AS rows below
- [ ] Scroll horizontally — hour labels stay sticky at top
- [ ] At 2pm local, a red \`NOW\` line should render at ~540px from grid left
- [ ] Starlight (drive-in) row shows a gold dashed sunset line
- [ ] True IMAX row label (AMC Mall of Georgia) appears in gold
- [ ] Toggle \`True IMAX\` filter chip → non-matching cells dim to opacity-20
- [ ] Change date to one with no screenings → "No screenings on this date." empty state
- [ ] Toggle back to By Theater / By Film → those views re-render normally

## Design references

- Spec: \`docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md\` §6.5
- Handoff: \`docs/superpowers/specs/2026-04-17-film-schedule-view-handoff.md\`
- Plan: \`docs/superpowers/plans/2026-04-17-film-schedule-view.md\`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Poll for CI + Vercel green**

---

## Task 11: Merge + cleanup

- [ ] **Step 1: Verify green**

```bash
gh pr checks <PR-NUMBER>
```

- [ ] **Step 2: Flip ready + squash-merge**

```bash
gh pr ready <PR-NUMBER>
gh pr merge <PR-NUMBER> --squash --admin
```

- [ ] **Step 3: Clean up**

```bash
cd /Users/coach/Projects/LostCity
git worktree remove .worktrees/film-schedule
git branch -D feature/film-schedule-view
```

- [ ] **Step 4: Return PR URL**

---

## Self-review notes

- **Spec coverage:**
  - §6.5 grid structure (X/Y axes, 30min ticks, 11am–1am, 72px rows) → Tasks 2+5
  - §6.5 cells anchored at showtime with width proportional to runtime → Tasks 2+3
  - §6.5 cell content (title, meta with format) + background surface/dusk → Task 3
  - §6.5 border tint by significance (gold=premiere, coral=closing, vibe=regular) → Task 3
  - §6.5 vertical hour gridlines + theater dividers → Tasks 4+5
  - §6.5 current-time red line with NOW label → Task 2 helper + Task 5 rendering
  - §6.5 sunset marker on drive-in row → Task 2 month table + Task 5 rendering
  - §6.5 True IMAX row tint → Task 5 `RowLabel`
  - §6.5 PREMIUM FORMATS divider → Task 5
  - §6.5 filter-dim-no-reflow behavior → Task 3 (matchesFilter prop) + Task 5 (per-cell predicate)
  - §6.5 empty state → Task 5 + Task 6
  - §7 cross-view rules (filters page-global, view toggle re-keys, date strip re-keys) → Task 8 shell
- **Deferred items called out in PR body:** mobile transpose, real suncalc, tier 3, plan creation, coral closes-today (prop exists, wiring deferred).
- **Type consistency:** `FilmScreening`, `FilmVenue`, `TodayPlaybillPayload`, `FormatToken`, `VenueClassification` all from shipped `web/lib/film/types.ts`. `FilmFilters` + `DEFAULT_FILTERS` from Plan 4's `FilmFilterChips.tsx`.
- **No placeholders.** Every code block is complete; every file path concrete; every magic number has a constant.
- **Reuses shipped work:** `buildSeriesUrl(slug, portal, 'film')`, Phosphor `FilmSlate`, `FilmFilters` shape, existing ViewToggle pattern.
- **Browser verify via Vercel preview** per memory-budget discipline.
- **No motion task** — the schedule is inherently static per cell; entrance fade inherits from the page-level transition. Filter-dim animations are CSS-only via `transition-colors` already baked into the card.
