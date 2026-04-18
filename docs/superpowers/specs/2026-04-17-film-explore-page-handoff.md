# /explore/film Page — Design Handoff

**Source of truth:** verbal spec §6 (Pencil `i2XB5` in `docs/explore-film.pen` was not re-extracted in this session — prior session flagged it as render-capable but the plan's v1 design tokens derive cleanly from the verbal spec alone)
**Extracted:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md` §6

---

## Page shell (§6.1)

- Outer container: `<main className="max-w-screen-xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6 pb-16 space-y-6 sm:space-y-8">`
- Breadcrumb: `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--vibe)]`
  - Markup: `EXPLORE  /  FILM` with a middle `<span className="text-[var(--muted)] mx-1.5">/</span>` separator
- Title row: `flex items-end justify-between`
  - Title: `<h1 className="font-display italic text-3xl sm:text-5xl font-semibold text-[var(--cream)]">Films Showing in Atlanta.</h1>`
  - Right: `<span className="font-mono text-xs uppercase tracking-[0.14em] text-[var(--muted)]">CURATED BY <span className="text-[var(--gold)]">Lost City Film</span></span>`
- Editorial subtitle: `text-sm sm:text-base italic text-[var(--soft)]` — computed server-side via `buildEditorialSubtitle(thisWeek.heroes)`

## Date strip (§6.1)

- Label row: `flex items-baseline justify-between mb-2`
  - Left: `THE NEXT TWO WEEKS` — `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]`
  - Right (v1 visual only, disabled): `Pick a date ↗` — `font-mono text-xs text-[var(--muted)] opacity-60`
- Pills row: `flex gap-2 overflow-x-auto scrollbar-hide pb-1`
- Pill (button): `flex-shrink-0 w-[88px] h-[86px] rounded-card border flex flex-col items-center justify-center gap-0.5 transition-colors`
  - Active: `bg-[var(--vibe)]/15 border-[var(--vibe)]/50 text-[var(--cream)]`
  - Today (inactive): `border-[var(--gold)]/40 text-[var(--cream)]`
  - Default: `border-[var(--twilight)] text-[var(--soft)] hover:border-[var(--muted)]`
- Pill content (top→bottom):
  - Row 1: weekday abbrev or `TODAY` — `font-mono text-2xs font-bold uppercase tracking-[0.14em]` (today in `text-[var(--gold)]`)
  - Row 2: day-of-month number — `font-display text-2xl tabular-nums leading-none`
  - Row 3: count (`N films` / `1 film`) or `★ premiere` (in `text-[var(--gold)]`) — `font-mono text-2xs text-[var(--muted)]`

## View toggle (§6.1)

- Container: `inline-flex items-center gap-0 rounded-card border border-[var(--twilight)] bg-[var(--night)] p-0.5`
- Segment button: `px-3 py-1.5 rounded-[calc(var(--radius-card)-2px)] font-mono text-xs uppercase tracking-[0.12em] transition-colors flex items-center gap-1.5`
  - Active: `bg-[var(--vibe)]/15 text-[var(--cream)]` + trailing gold dot `w-1 h-1 rounded-full bg-[var(--gold)]`
  - Inactive: `text-[var(--muted)] hover:text-[var(--cream)]`
  - Disabled (v1: By Film + Schedule): `text-[var(--twilight)] cursor-not-allowed` + trailing `soon` in `text-[0.6rem] text-[var(--muted)]`

## Filter chips (§6.1)

- Row: `flex items-center gap-2 overflow-x-auto scrollbar-hide`
- Label: `Filter:` — `font-mono text-xs uppercase tracking-[0.12em] text-[var(--muted)] shrink-0`
- Chips: reuse `<FilterChip size="sm" />`
  - Formats (multi-select OR) — `variant="date"`: `35mm`, `70mm`, `True IMAX`, `IMAX`, `Dolby Cinema`, `4DX`, `drive-in`
  - Attributes (multi-select AND) — `variant="vibe"`: `premieres only`, `one-night-only`, `festival`

## This Week zone (§6.2)

Same pattern as the feed widget's hero strip but **larger** (`hero-large-*` densities of `HeroTile`):

- Heights: `hero-large-full` → 300px, `hero-large-half` → 280px, `hero-large-third` → 240px
- Title sizes: full → `text-4xl`, half → `text-3xl`, third → `text-2xl`
- Press quote: always rendered (no `line-clamp-1`), can wrap to 2 lines
- Founding-year suffix in meta: shown on full + half, suppressed on third
- Adaptive grid: 1 → `grid-cols-1`, 2 → `grid-cols-[3fr_2fr]`, 3 → `grid-cols-3`
- Wrapper: `rounded-card overflow-hidden divide-x divide-[var(--void)]` on inner grid; `section` wraps with kicker + grid, `space-y-3`
- Kicker: `THIS WEEK · {n} SIGNIFICANT SCREENING[S]` in `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]`; right span `Not to miss.` in `text-xs italic text-[var(--muted)]`

## By Theater view (§6.3)

**Zone header** (above the blocks):
- Left: `BY THEATER · {WEEKDAY} {MON} {D}` — `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--muted)]` + italic subhead `Atlanta's programs tonight.` in `text-sm italic text-[var(--soft)]`
- Right: `{n} indies + {m} premium screens · {total} screenings` — `font-mono text-xs text-[var(--muted)]`

### Tier 1 block (full programmer's board)

- Outer card: `rounded-card-xl border border-[var(--twilight)] bg-[var(--night)] p-5 sm:p-6 space-y-4`
- Header row: `flex items-end justify-between gap-4 pb-3 border-b border-[var(--twilight)]`
  - Title + founding-year chip inline: `font-display text-2xl sm:text-3xl font-semibold text-[var(--cream)]` + `font-mono text-xs font-bold uppercase tracking-[0.14em] text-[var(--gold)]` → `EST. 1939`
  - Meta line: `{neighborhood} · {rating ★} · {N films}` via `<Dot />`s in `font-mono text-xs text-[var(--muted)]`
  - Right CTA: `See the week →` in `font-mono text-xs text-[var(--vibe)] hover:text-[var(--cream)]`
- Film row: `flex gap-4 py-3 border-b border-[var(--twilight)]/50 last:border-0`
  - Left portrait still: `w-24 sm:w-[96px] h-[144px] rounded-card overflow-hidden flex-shrink-0 bg-[var(--dusk)] relative`
  - Right growing:
    - Title: `font-display text-xl sm:text-2xl font-semibold text-[var(--cream)] hover:text-[var(--vibe)]`
    - Meta (optional): `font-mono text-xs text-[var(--muted)]` — `Dir. {name} · {year} · {runtime} · {rating}`
    - Gold badge (optional): `inline-block mt-1.5 px-2 py-0.5 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]` — derived via `buildHeroTag`
    - Editorial line (optional): `text-sm italic text-[var(--soft)]` — `editorial_blurb` if present
    - Showtime chip row: `flex items-center gap-1.5 flex-wrap mt-2` with chips `px-2 py-0.5 rounded bg-[var(--vibe)]/15 border border-[var(--vibe)]/30 text-[var(--vibe)] font-mono text-xs tabular-nums hover:bg-[var(--vibe)]/25`
- `+N more films tonight →` footer in `text-sm font-mono text-[var(--vibe)]/80 hover:text-[var(--vibe)]`
- Cap: `MAX_SHOWN = 5` films before overflow

### Tier 2 block (compressed format-led)

- Outer card: same chrome, `p-5 sm:p-6 space-y-3`
- Header: no founding-year
  - Title: `font-display text-xl sm:text-2xl font-semibold text-[var(--cream)]`
  - Format capability badges row: `flex gap-1.5 mt-1 flex-wrap` with per-format pill `px-2 py-0.5 rounded bg-[var(--gold)]/10 border border-[var(--gold)]/20 text-[var(--gold)] font-mono text-2xs font-bold uppercase tracking-[0.14em]` — `TRUE IMAX`, `IMAX`, `70MM`, `DOLBY CINEMA`, `4DX`, `RPX`, `SCREENX`, `35MM`
  - Meta line: `{neighborhood} · {N films}` in `font-mono text-xs text-[var(--muted)]`
- Film row: `flex gap-3 py-2 border-b border-[var(--twilight)]/30 last:border-0`
  - Left still: `w-16 sm:w-[64px] h-[96px] rounded overflow-hidden flex-shrink-0`
  - Right:
    - Title: `text-base sm:text-lg font-semibold text-[var(--cream)]`
    - Meta: `font-mono text-xs text-[var(--muted)]` — `{runtime} · {rating}`
    - Showtime chips with per-screening format suffix: `7:30 · IMAX` / `8:00 · 4DX`. Format suffix in inline `text-2xs ml-1 text-[var(--gold)]`
- **Editorial suppression:** Tier 2 never renders `editorial_blurb`, `film_press_quote`, or per-film gold tags — the format IS the voice.

## Premium Formats divider (§6.3)

Between last Tier 1 block and first Tier 2 block:

- Container: `flex items-center gap-3`
- Hairline: `flex-1 h-px bg-[var(--twilight)]`
- Label: `font-mono text-xs font-bold uppercase tracking-[0.2em] text-[var(--muted)]` — `Premium Formats`

## Empty states

- **Date with 0 venues in playbill:** central column `py-12 text-center space-y-3`
  - Icon: Phosphor `<FilmSlate weight="duotone" className="w-12 h-12 text-[var(--twilight)] mx-auto" />`
  - Heading: `text-xl font-display text-[var(--cream)]` — `No screenings on this date.`
  - Subcopy: `text-sm text-[var(--muted)]` — `Try another day from the strip above.`
- **Venues present but all filtered out:** `py-8 text-center` — `text-sm italic text-[var(--muted)]` — `No screenings match your filters.`

## Tokens used

- Surfaces: `--void`, `--night`, `--dusk`, `--twilight`
- Text: `--cream`, `--soft`, `--muted`
- Accent: `--vibe` (cinema), `--gold` (editorial/premiere)
- Typography: `font-display`, `font-mono`, `text-2xs`, `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`, `text-5xl`
- Components reused: `<HeroTile>` (extended), `<FilterChip>`, `<SmartImage>`, `<Dot />`, Phosphor `FilmSlate`
- Utilities: `buildHeroTag()`, `buildEditorialSubtitle()`, `buildSeriesUrl(slug, portal, 'film')`, `buildSpotUrl(slug, portal, 'page')`, `formatTime(hhmm)`

## Out-of-scope

- Tier 3 opt-in "additional theaters" (spec §6.3) — deferred
- By Film view (spec §6.4) — Plan 5
- Schedule grid (spec §6.5) — Plan 6
- "Pick a date ↗" custom date picker — deferred (v1 is visual-only)
- Next-week / previous-week nav on This Week zone — deferred (link renders but is a no-op in v1)
- URL-sync of date/view/filters — deferred (state lives in component)
