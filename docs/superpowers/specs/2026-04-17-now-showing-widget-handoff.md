# Now Showing Widget — Design Handoff

**Source of truth:** verbal spec §5 (Pencil node `INLem` was render-stalled per spec §10; `Mek4k` Programmer's Board rendered successfully but covers the Explore page block, not the feed widget)
**Extracted:** 2026-04-17
**Spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md`
**Plan:** `docs/superpowers/plans/2026-04-17-film-now-showing-widget.md`

---

## Overall envelope

- Widget height: 220–320px depending on state
- Widget sits in the feed inside `<LazySection minHeight={220}>` in `web/lib/city-pulse/manifests/atlanta.tsx`
- Wrapped (non-embedded) in `<FeedSectionReveal className="pb-2">` (entrance fade+slide)

---

## Section header (§5.1)

**Recipe:** Reuse `<FeedSectionHeader title="Now Showing" priority="secondary" variant="cinema" accentColor="var(--vibe)" seeAllHref="/{portal}/explore/film" icon={<FilmSlate weight="duotone" className="w-5 h-5" />} />`

**Companion meta row** (rendered directly beneath the header, not inside it):
- Text: `{total_screenings} films showing in Atlanta tonight` (fall-through copy: `Quiet night — see what's opening this week` when `total_screenings === 0`)
- Class: `text-sm text-[var(--muted)] mb-4`

---

## This Week label (§5.2)

Rendered only when `heroes.length > 0`.

- Two-line kicker block in a `flex items-baseline justify-between mb-2` row:
  - Left span: `THIS WEEK · {n} SIGNIFICANT SCREENING[S]`
    - Class: `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--gold)]`
  - Right span: `Not to miss.`
    - Class: `text-xs italic text-[var(--muted)]`

---

## Headline strip (§5.3)

Adaptive grid container:

| `heroes.length` | Container classes |
|---|---|
| 0 | strip not rendered |
| 1 | `grid grid-cols-1 gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden` |
| 2 | `grid grid-cols-[3fr_2fr] gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden` |
| 3 | `grid grid-cols-3 gap-0 divide-x divide-[var(--void)] rounded-card overflow-hidden` |

Strip wrapped in `<div className="mb-5">`.

### Hero tile (per-item)

**Density type:** `'full' | 'half' | 'third'` (full=1-tile, half=2-tile, third=3-tile).

**Heights:**
| Density | Height class |
|---|---|
| full | `h-[240px]` |
| half | `h-[220px]` |
| third | `h-[200px]` |

**Structure:**
- Outer: `<Link href={buildSeriesUrl(hero.slug, portalSlug, 'film_series')} className="relative block overflow-hidden bg-[var(--night)] {HEIGHT[density]} group" />`
- Image layer: `<SmartImage fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />` (fallback to gradient `bg-gradient-to-br from-[var(--dusk)] to-[var(--night)]` when `image_url === null`)
- Bottom gradient for legibility: `absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[var(--void)]/95 via-[var(--void)]/55 to-transparent`

**Gold tag pill (top-left):**
- Position: `absolute top-3 left-3`
- Class: `px-2.5 py-1 rounded bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-mono text-2xs font-bold tracking-[0.14em] uppercase`
- Content: derived via `buildHeroTag(hero, hero.hero_reason).label` — see `web/lib/film/hero-tags.ts` (Task 2)

**Bottom content block:**
- Position: `absolute inset-x-0 bottom-0 p-3 space-y-1`
- Optional press quote (rendered only when `film_press_quote` is present):
  - `<p className="text-xs italic text-[var(--cream)]/85 line-clamp-1">"{quote}"<span className="not-italic text-[var(--gold)]/80"> — {source}</span></p>` (source span rendered only when `film_press_source` present)
- Title: `<h3 className="font-display font-semibold {TITLE_SIZE[density]} text-[var(--cream)] leading-tight line-clamp-2">{title}</h3>`
  - Size map: `full → text-3xl`, `half → text-2xl`, `third → text-lg`
- Meta line: `<p className="font-mono text-2xs text-[var(--cream)]/80 flex items-center gap-1.5 flex-wrap">…</p>`
  - Contents: `{venue.name} · {weekday short} {time}[ · also {n} more date[s]]`
  - Weekday short: `['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getUTCDay()]` from first `times[0].start_date`
  - Time: `formatTime(times[0].start_time)` from existing `web/lib/formats.ts`
  - Optional founding-year suffix (only on `density !== 'third'`): ` · est. {founding_year}` in `text-[var(--gold)]/80` after a `<Dot />`

---

## Today playbill (§5.5)

Rendered only when `venues.filter(v => v.screenings.length > 0).length > 0`.

**Label row:**
- Container: `flex items-baseline justify-between pb-1.5 mb-1 border-b border-[var(--twilight)]`
- Text: `TODAY · {MMM d} · {total_screenings} screening[s]`
  - Date format: `date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })`
- Class: `font-mono text-xs font-bold tracking-[0.12em] uppercase text-[var(--muted)]`

**Rows container:** `space-y-0.5`

### Per-venue row (§5.5 detail)

CSS grid layout with 3 columns: theater / films / arrow.

- Row: `grid grid-cols-[110px_1fr_auto] items-center gap-3 px-2 py-1.5 rounded hover:bg-[var(--cream)]/[0.03] transition-colors`

**Theater column (110px fixed):**
- Class: `font-display text-sm tracking-[0.16em] uppercase text-[var(--cream)] truncate`
- Content: `shortTheaterName(venue.name)` — strips `AMC `/`Regal `/`Cinemark `/`The ` prefix and trailing ` Theatre`/` Theater`/` Cinema`/` Cinemas`

**Films column (flex, wrap):**
- Class: `flex items-center gap-1.5 flex-wrap overflow-hidden`
- Cap: `MAX_FILMS = 4`. Remaining collapse to `+N more` in `text-xs font-mono text-[var(--muted)]`
- Per film span: `<span className="flex items-center gap-1.5">`
  - Title link: `<Link href={buildSeriesUrl(screening.slug, portalSlug, 'film_series')} className="text-sm font-semibold text-[var(--cream)] hover:text-[var(--vibe)] transition-colors">{title}</Link>`
  - Time: `<span className="font-mono text-xs text-[var(--vibe)] tabular-nums">{formatTime(times[0].start_time)}</span>` (rendered only when `start_time` present)
  - Inter-film separator: `<Dot />` between items (not after the last one)
- Drive-in note: if `venue.programming_style === 'drive_in'`, append `<span className="text-xs italic text-[var(--gold)] ml-1">drive-in</span>`

**Arrow column:**
- `<Link href={\`/${portalSlug}/explore/film?venue=${venue.slug}\`} aria-label={\`See all ${venue.name} screenings\`} className="p-1 text-[var(--vibe)] hover:text-[var(--cream)] transition-colors">`
- Icon: `<CaretRight weight="bold" className="w-3.5 h-3.5" />` from `@phosphor-icons/react`

---

## Empty states (§5.5)

Handled entirely in `NowShowingSection.tsx`:

| heroes | playbill venues (with screenings > 0) | Behavior |
|---|---|---|
| 0 | 0 | Return `null` (parent section collapses) |
| 0 | ≥1 | Skip "This Week" strip; render header + playbill only |
| ≥1 | 0 | Render header + This Week strip; below it render italic link `Quiet night — see what's opening this week →` routing to `/{portal}/explore/film` |
| ≥1 | ≥1 | Full render |

---

## Loading / error states

- Loading: render `<div className="h-[220px] rounded-card bg-[var(--night)] border border-[var(--twilight)]/40 animate-pulse" />` beneath the header.
- Failure: return `null` (silent failure; parent section collapses — feed has no "error card" pattern for sections).

---

## Tokens used (reference)

- Surfaces: `--void`, `--night`, `--dusk`, `--twilight`
- Text: `--cream`, `--soft`, `--muted`
- Accent: `--vibe` (cinema), `--gold` (editorial/premiere)
- Typography: `font-display`, `font-mono`, `text-2xs`, `text-xs`, `text-sm`, `text-lg`, `text-2xl`, `text-3xl`
- Components: `<FeedSectionHeader>`, `<FeedSectionReveal>`, `<SmartImage>`, `<Dot />`, Phosphor `FilmSlate` + `CaretRight`
- Utilities: `buildSeriesUrl(slug, portalSlug, 'film_series')`, `formatTime(hhmm)`

---

## Out-of-scope for this widget

- Theater customizer / opt-in Tier 3 (deferred to Plan 4 — Explore page)
- Dynamic ResizeObserver-based overflow (deferred to Plan 4+; v1 uses static `MAX_FILMS = 4` cap)
- Sunrise/sunset markers (deferred to Plan 4/5 — schedule view)
- Press-quote multi-line (line-clamped to 1 here; richer rendering in Explore By-Film card)
