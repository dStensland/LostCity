# /explore/film Schedule View — Design Handoff

**Source of truth:** verbal spec §6.5 (Pencil node `i2XB5` covered shell + By-Theater; Schedule wasn't re-extracted)
**Extracted:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6.5

---

## Geometry

| Constant | Value | Purpose |
|---|---|---|
| `SCHEDULE_START_HOUR` | 11 | First column = 11:00 AM |
| `SCHEDULE_END_HOUR` | 25 | Last column = 01:00 AM next day |
| `PX_PER_MINUTE` | 3 | Grid density |
| `ROW_HEIGHT` | 72 | Per-theater row height |
| `CELL_MIN_WIDTH` | 48 | Minimum cell width (narrow cells feel broken below) |
| `TIER_DIVIDER_HEIGHT` | 32 | PREMIUM FORMATS inline divider |
| `GRID_WIDTH_PX` | (25-11) × 60 × 3 = 2520 | Total scrollable grid width |

Horizontal scroll on both desktop + mobile. Vertical-transpose deferred (spec §9 Q1).

---

## Time axis (§6.5)

- Container: sticky top, `h-8 border-b border-[var(--twilight)] bg-[var(--night)]/95 backdrop-blur-sm z-10`
- Width: `GRID_WIDTH_PX` (2520px)
- Hour labels (15 entries, 11 AM → 1 AM): `font-mono text-2xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]`, anchored `left: minutes * PX_PER_MINUTE + 4px top 1.5`
- Tick marks: 1px × 8px, `bg-[var(--twilight)]/60`, bottom-anchored

---

## Theater row

- Container: `flex border-b border-[var(--twilight)]/60 last:border-0`, `height: ROW_HEIGHT`
- Left sticky label column (160px):
  - `font-mono text-xs font-bold uppercase tracking-[0.14em] truncate`
  - Venues with `venue_formats` containing `true_imax` → `text-[var(--gold)]` (else `text-[var(--cream)]`)
  - `programming_style === 'drive_in'` → append `drive-in` suffix in `text-[var(--gold)]/80` mono caps
- Right scroll region: `relative flex-1 h-full`, width `GRID_WIDTH_PX`
  - Absolute hour gridlines: `w-px top-0 bottom-0 bg-[var(--twilight)]/40`
  - Absolute cells (positioned by `cellLeft(start_time)` + `cellWidth(runtime_minutes)`)

---

## Cell (§6.5)

**Position:**
- `left = cellLeft(start_time)` → `minutesSinceStart * PX_PER_MINUTE`
- `width = cellWidth(runtime_minutes)` → `max(runtime × PX_PER_MINUTE, CELL_MIN_WIDTH)`
- `top: 4px`, `height: 64px` (72 row - 8 vertical padding)

**Styling:**
- Container: `absolute flex flex-col justify-center px-2 py-1 rounded-md bg-[var(--dusk)] border {borderTone} hover:bg-[var(--dusk)]/80 transition-colors overflow-hidden`
- Border tone:
  - `is_premiere` → `border-[var(--gold)]`
  - `closesToday` → `border-[var(--coral)]` (prop exists in v1; data wiring deferred — needs `run.end_date` on FilmScreening)
  - else → `border-[var(--vibe)]/40`

**Content:**
- Line 1: `font-semibold text-sm text-[var(--cream)] truncate leading-tight` — film title
- Line 2: `font-mono text-2xs text-[var(--muted)] truncate mt-0.5` — `{runtime}m · {rating} · {PRIMARY FORMAT}` (each bit optional)

**Filter dim:** when `matchesFilter === false`: `opacity-20 grayscale pointer-events-none`
**Filter match halo (optional): `hover:ring-1 hover:ring-[var(--cream)]/30`

**Navigation:** tap → `buildSeriesUrl(slug, portal, 'film')` → `/{portal}/showtimes/{slug}`

---

## Current-time (NOW) line

- Only rendered when `playbill.date === today (local)`
- Vertical 1px `bg-[var(--coral)] pointer-events-none`, absolute inside the scroll region, spans top 0 bottom 0
- `left = 160 + currentTimeMinutes(now) × PX_PER_MINUTE` (adds 160px for the sticky row-label column)
- Label pinned at top: `absolute -translate-x-1/2 -translate-y-full px-1.5 py-0.5 rounded-b bg-[var(--coral)] text-[var(--void)] font-mono text-2xs font-bold whitespace-nowrap` — `NOW {HH:MM}`
- State refreshes via `setInterval(60_000)` in a client `useEffect`

---

## Sunset marker

- Only rendered on rows where `venue.programming_style === 'drive_in'`
- Sunset time from month table `ATLANTA_SUNSET_BY_MONTH[month]` (0-indexed). Real `suncalc` integration deferred.
- Vertical: `border-l border-dashed border-[var(--gold)]/70`, spans the row top-bottom, `left = sunsetMinutesForDate(iso) × PX_PER_MINUTE`
- Label: `font-mono text-2xs text-[var(--gold)]` positioned `left + 4px` top 1 — `sunset`

---

## PREMIUM FORMATS divider (§6.5)

Between last Tier 1 row and first Tier 2 row:

- `flex items-center gap-3 border-y border-[var(--twilight)] bg-[var(--night)]/90 px-4`, `height: TIER_DIVIDER_HEIGHT`, width `GRID_WIDTH_PX + 160`
- Left: `flex-1 h-px bg-[var(--twilight)]`
- Label: `PREMIUM FORMATS` — `font-mono text-2xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]`
- Right: `flex-1 h-px bg-[var(--twilight)]`

---

## Empty state (§6.5)

Same pattern as ByTheaterView / ByFilmView — identical copy:

- Icon: Phosphor `FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto"`
- Heading: `No screenings on this date.` in `text-xl font-display text-[var(--cream)]`
- Sub: `Try another day from the strip above.` in `text-sm text-[var(--muted)]`

---

## ScheduleView wrapper (header)

- `<header className="flex items-baseline justify-between">`
- Left: `Schedule · {WEEKDAY, MON D}` — `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]` + italic subhead `A print-style grid — scroll right for later tonight.` in `text-sm italic text-[var(--soft)]`
- Right: `{total_screenings} screenings` — `font-mono text-xs text-[var(--muted)]`

---

## Filter behavior

**Critical difference from By Theater / By Film:** this view does NOT filter out cells or reflow the grid. Every screening stays in its positional slot. Non-matching cells are visually dimmed (opacity-20 + grayscale); matching cells remain full-color. Density becomes contrast.

---

## Out-of-scope

- Mobile vertical-transpose layout (spec §9 Q1) — deferred
- Real suncalc-based sunset computation — deferred; v1 uses 12-entry month table
- Tier 3 additional theaters opt-in — deferred (consistent with other views)
- Plan-creation on cell tap — deferred; v1 tap navigates to film detail
- Coral closes-today border — prop exists, but `FilmScreening` doesn't carry `run.end_date` today; wiring deferred to a follow-up
- Long-press / (i) glyph for film details — deferred
- Half-hour minor tick marks between hour labels — v1 shows only hour ticks (add half-hour visuals if design review warrants)

---

## Tokens used (reference)

- Surfaces: `--void`, `--night`, `--dusk`, `--twilight`
- Text: `--cream`, `--soft`, `--muted`
- Accent: `--vibe` (regular border), `--gold` (premiere border, True IMAX tint, sunset, drive-in badge), `--coral` (NOW line, closes-today border)
- Typography: `font-mono`, `font-display`, `text-2xs`, `text-xs`, `text-sm`, `text-xl`
- Components reused: `<SmartImage>`, `<Dot />` (not needed here), Phosphor `FilmSlate`
- Utilities: `buildSeriesUrl(slug, portal, 'film')`, `formatTime(hhmm)` (unused — we render `HH:MM` directly in the NOW label for simplicity)
