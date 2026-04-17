# Now Showing (Feed) + /{portal}/explore/film — Design Spec

**Status:** design approved, pre-implementation
**Date:** 2026-04-17 (revised 2026-04-17 after expert review)
**Pencil comps:**
- `docs/design-system.pen` — Round 2 Programmer's Board at node `Mek4k` (renders successfully)
- `docs/explore-film.pen` — Page shell + This Week triptych at node `i2XB5` (shell + hero render; main content nodes built but canvas-stalled)

---

## 1. Overview

Two surfaces, one subject:

| Surface | Job | Posture |
|---|---|---|
| **Feed — Now Showing widget** | Tease the week's significant screenings + quick glance at tonight's city-wide schedule | Opinionated, editorial, ~220–320px tall |
| **`/{portal}/explore/film`** | Everything showing in Atlanta, browsable by theater or schedule grid, with forward dates | Comprehensive, filterable, two view modes |

The feed is a teaser into /explore/film. They share editorial DNA (Programmer's Board voice) but differ in density and commitment.

## 2. Phase decomposition

Three phases with explicit dependencies. Each ships and is deployable independently.

### Phase 1 — Data model + crawler prerequisites

Blocks everything else. Lands before any UI work.

**Schema additions** (see §8 for full field-by-field spec):
- `places`: `programming_style` (enum, nullable), `venue_formats` (text[]), `founding_year` (int, nullable)
- `screening_titles` or new `screening_editorial`: `is_curator_pick` (week-scoped), `is_premiere`, `premiere_scope`, `editorial_blurb`, `film_press_quote`, `film_press_source`
- `screening_times.format_labels` — field already exists (see `database/migrations/602_screening_storage.sql`); Phase 1 populates it via crawler work below

**Crawler work** (non-optional — the Explore page loses its distinctiveness without this):
- `crawlers/sources/regal_atlanta.py` — extract format attributes from `Performances[].Attributes` (Regal's API already surfaces `4DX` / `IMAX` / `ScreenX` / `RPX`; crawler ignores them today)
- `crawlers/sources/amc_atlanta.py` — parse format from showtime button text (DOM pattern: `"7:30 PM IMAX"`)
- `crawlers/sources/amc_atlanta.py` — **add AMC Mall of Georgia 20 to LOCATIONS** (the only True IMAX in metro Atlanta; not currently crawled — without this the True IMAX story collapses); also add AMC North Point Mall 12 and AMC Avenue Forsyth 12 (Dolby Cinema, both default-visible)
- `crawlers/sources/plaza_theatre.py` and `crawlers/sources/tara_theatre.py` — refactor from strip-to-capture: current code does `re.sub(r'\s*\((?:4K|2K|35mm|70mm)\)\s*$', ..., title)` discarding the format; capture into `format_labels` instead

**CM / editorial seeding**:
- Seed `programming_style` and `venue_formats` on ~16 Atlanta venues (canonical list in §3 — one migration)
- Seed `founding_year` on Tier-1 venues (5 values)
- Build the curator-pick editing surface OR commit a seeded JSON override file for v1 (architect's risk #1 — spec can't ship Phase 2 empty)

**APIs**:
- `GET /api/film/this-week?portal=<slug>` — returns curator picks + this-week significant screenings
- `GET /api/film/today-playbill?portal=<slug>&date=<iso>` — returns playbill-shaped data for all visible venues
- `GET /api/film/schedule?portal=<slug>&date=<iso>&formats=<csv>` — schedule grid data

All APIs enforce `p_portal_id` for portal isolation per `docs/decisions/2026-02-14-portal-data-isolation.md`.

### Phase 2 — Feed widget

Replaces `web/components/feed/sections/NowShowingSection.tsx`. Height-bounded. Read-only (the customizer moves to /explore/film's opt-in flow). Server-rendered, minimal client state. Registered in the manifest-driven shell.

Depends on Phase 1 fields + APIs. Does **not** depend on Phase 3.

Ships with the realistic hero-strip fill rate of the moment: if only 1-2 items match the cascade that week, the strip adapts (see §5.3).

### Phase 3 — /explore/film page

Depends on Phase 1; independent of Phase 2. Ships incrementally:

- **Phase 3a** — Page shell + This Week hero + By Theater main view (the default; highest value; most of the editorial power)
- **Phase 3b** — Schedule grid view (desktop + mobile time-grouped list)
- **Phase 3c** — Chain opt-in flow + preference persistence

By Film view is **cut from v1** (see §6.4). Revisit as a format-comparison mode after v1 data is real.

---

## 3. Language rules

**Drop "indie" as a framing term throughout.** The product serves anyone going to a movie. Indie and rep theaters *lead editorially* because they program interestingly — but the framing is inclusive.

- Feed section title: `Now Showing`
- Feed section meta: `14 films showing in Atlanta tonight`
- Explore page title: `Films Showing in Atlanta.`
- Editorial voice speaks to the city, not a niche:
  > *"This week — Bunnylovr opens at Plaza, Cassavetes on 35mm at Tara, Dune: Part Three in true IMAX at Mall of Georgia."*

## 4. Theater classification (derived, not stored)

Three display treatments, derived at query time from two stored fields.

| Display treatment | Derivation | Examples |
|---|---|---|
| **Editorial program** (full Programmer's Board) | `programming_style IS NOT NULL` | Plaza (`repertory`), Tara (`repertory`), Starlight (`drive_in`), Landmark Midtown (`arthouse`), Springs (`indie`) |
| **Premium format card** (compressed, format-led) | `programming_style IS NULL AND cardinality(venue_formats) > 0` | AMC Mall of Georgia (formats: `{true_imax, 70mm}`), Regal Atlantic Station (`{imax, 4dx, rpx, screenx}`), AMC North Point (`{dolby_cinema}`) |
| **Additional theater** (opt-in, compressed) | `programming_style IS NULL AND cardinality(venue_formats) = 0` | Every standard Regal/AMC/Cinemark without a premium format |

**Why derived:** avoids drift (architect's concern — someone sets `venue_tier='premium_format'` but forgets `venue_formats`). The two fields that actually drive behavior are stored; the tier is a query-time computation.

**Naming collision resolved:** this spec does NOT use the name `venue_tier`. That name belongs to `PRD-040 Platform Venue Enrichment Tier Contract` (T0–T3 for enrichment scope). Our fields are `programming_style` and `venue_formats`.

### Canonical Atlanta venue list (seeded in Phase 1)

**Editorial program** (`programming_style` set):
- Plaza Theatre · Poncey-Highland · `repertory` · founded 1939 · `venue_formats: {70mm, 35mm}`
- Tara Theatre · Cheshire Bridge · `repertory` · founded 1968 · `venue_formats: {70mm, 35mm}`
- Starlight Six Drive-In · Moreland Ave · `drive_in` · founded 1949 · `venue_formats: {}`
- Landmark Midtown Art Cinema · Midtown · `arthouse` · `venue_formats: {atmos}`
- Springs Cinema & Taphouse · Sandy Springs · `indie` · `venue_formats: {atmos}`
- (CM extensible: festivals, micro-cinemas, pop-up series)

**Premium format** (`venue_formats` set, no `programming_style`):
- AMC Mall of Georgia 20 · Buford · `{true_imax, 70mm}` — only True IMAX in metro Atlanta
- Regal Atlantic Station · Midtown · `{imax, 4dx, rpx, screenx}` — format-stacking venue
- AMC North Point Mall 12 · Alpharetta · `{dolby_cinema}`
- AMC Avenue Forsyth 12 · Cumming · `{dolby_cinema}`
- AMC Southlake Pavilion 24 · Morrow · `{dolby_cinema, imax}`
- AMC Phipps Plaza 14 · Buckhead · `{imax}`
- AMC Barrett Commons 24 · Kennesaw · `{imax}`
- AMC Colonial 18 · Lawrenceville · `{imax}`
- Regal Avalon · Alpharetta · `{imax, rpx}`
- AMC Parkway Pointe 15 · Cumberland · `{atmos}`
- AMC Madison Yards 8 · Reynoldstown · `{atmos}`

**Additional** (opt-in): every other Regal / AMC / Cinemark with no format.

## 5. Format visual language — five signal levels

Consolidated from nine tags to five, per designer review. Over-tagging drowned the signal that matters (True IMAX vs LieMAX). Atmos drops to an informational dot — not a full badge — because it's a sound spec, not a screening format.

| Level | Covers | Badge treatment |
|---|---|---|
| **TRUE IMAX** | `true_imax` | Gold fill, bold mono caps — the only signal that earns this weight |
| **IMAX** | `imax` (digital / LieMAX) | Outline on vibe tint, mono caps |
| **DOLBY CINEMA** | `dolby_cinema` | Outline, mono caps |
| **SPECIALTY** | `70mm`, `35mm` (archival film formats) | Gold outline; hover/tap reveals the specific format |
| **PREMIUM** | `4dx`, `rpx`, `screenx` | Muted outline — experience-category; not tech-spec noise |

**Not a badge:**
- `atmos` → small dot indicator inline with showtime, informational only
- `standard` → no decoration

**Per-screening tag rule:** when a film plays in a multi-format venue (Regal Atlantic Station), the showtime chip carries the format tag for *that specific auditorium*: `7:30 · IMAX` vs `8:00 · 4DX`. This depends on per-screening `format_labels` from Phase 1 crawler work.

## 6. Feed — Now Showing widget

Two-tier compressed section. Total height target 220–320px depending on state.

### 6.1 Section header

```
◎ Now Showing · 14 films showing in Atlanta tonight           See all →
```

- Icon: `FilmSlate` duotone from Phosphor (matches existing NowShowingSection — not a custom glyph)
- Color accent: `--vibe`
- "See all →" routes to `/{portal}/explore/film`

### 6.2 This Week headline strip

Label: `THIS WEEK · N SIGNIFICANT SCREENINGS` in gold mono caps + italic sub *"Not to miss."*

**Adaptive layout:**
- **0 items** → hide the strip entirely (playbill-only state)
- **1 item** → single full-width tile
- **2 items** → 60/40 split (significance-ranked)
- **3 items** → equal thirds (comped primary state)

Each tile (at 1/3 width baseline):
- Full-bleed landscape film **still** (not poster), 200–300px tall
- Top-left: gold editorial tag pill (`ATL PREMIERE · OPENS THURSDAY` / `35MM · SATURDAY ONLY` / `DRIVE-IN PREMIERE` / `TRUE IMAX EXCLUSIVE`)
- Bottom overlay with gradient fade:
  - Press quote (optional, only when seeded) — italic cream, 12pt
  - Film title — Outfit 36–40 bold, cream
  - Meta line — mono, 11pt, cream@80%: `Plaza Theatre · tonight 7:45 PM · also Fri, Sat, Sun`
- 1px black divider between tiles (no gap)

### 6.3 Hero-selection cascade

A film earns a headline tile if it matches any, ranked:

1. `is_curator_pick = true` for the current week (editorial flag — highest priority)
2. Opens this week (`first_date` within current ISO week; derived from screening range)
3. Festival programmed (`festival_id` present)
4. Special format exclusive (`format_labels` contains `true_imax` / `70mm` / `4dx` on a one-night-only run)
5. Closes this week (`last_date` within current ISO week)

Cap at 3 items. Rank by `is_curator_pick` first, then cascade order.

**Realistic fill rate at launch** (per data specialist): before `format_labels` is fully populated, the cascade depends on items 1, 2, 3, 5 — typically 1–2 items per week in Atlanta. CM curator picks are the reliable primary signal. The strip adaptively sizes to what's available; a short week doesn't look broken.

### 6.4 Today playbill

Label: `TODAY · Oct 23 · 14 screenings` in small mono caps, hairline divider below.

Each theater row:
```
PLAZA        Bunnylovr 7:45 · Exit 8 5:15 · Normal 7:30 · Daaaaaalí! 9:30    →
TARA         Faces 2:30 · Lorne 5:30 · Palestine '36 3:15 · Sweet East 7:00  →
STARLIGHT    Normal 8:30 · drive-in premiere                                 →
```

Typography:
- Theater name: Outfit 13pt tracked caps (letter-spacing 2.2), 110px fixed-width column on desktop; truncates with `…` on mobile if name overflows (flagged in §10 — likely fine at 375px for short names; longer names like "AMC MALL OF GEORGIA" truncate acceptably)
- Film title: Outfit 13pt semibold, cream
- Time: JetBrains Mono 11pt, vibe-purple
- Separators: middot in twilight-muted
- Special notes (`drive-in premiere`): italic gold
- Right-anchored arrow: vibe-purple, 14pt

**Overflow behavior:** rows fill available horizontal space. Only when content would wrap to a second line do trailing items collapse to `+N more`. Don't truncate prematurely.

**Mobile (<640px):** single-column list maintained; theater name drops to own line above films if row is tight.

**Empty state** (rare in Atlanta): render playbill with zero-state message *"Quiet night — see what's opening this week →"* linking to Explore.

### 6.5 Chip interaction

**Not one-tap-to-plan.** A showtime chip tap opens a compact bottom-anchored action sheet (150–180px on mobile, centered dialog on desktop):

```
┌────────────────────────────────┐
│  Bunnylovr · 7:45 PM           │
│  Plaza Theatre · Screen 2       │
│  1h 41m · R · ATL PREMIERE      │
│                                 │
│  [ Add to Plans ]  [ Dismiss ]  │
└────────────────────────────────┘
```

- `Add to Plans` is the primary, coral button, **auto-focused** on desktop (hit Enter to confirm)
- `Dismiss` is ghost; backdrop click or Esc also dismisses
- Sheet also shows runtime ("movie ends ~9:26 PM") and next-screening-of-same-film fallback when available
- Same sheet pattern applies wherever chips are tappable (feed playbill, By Theater program, Schedule cells)

The one-more-tap cost is paid for preventing accidental plan creation across 40+ tappable elements on the Explore page.

## 7. Explore — `/{portal}/explore/film`

### 7.1 Page shell (persistent, all views)

**Route:** `/{portal}/explore/film` (not app-root). Registered as a track under the existing Explore surface pattern per `web/CLAUDE.md` portal architecture rules.

**Breadcrumb:** `EXPLORE  /  FILM` mono caps, vibe-purple

**Title block:**
- Title: `Films Showing in Atlanta.` — Outfit italic 52pt bold, cream
- Editorial subtitle (CM-written weekly): *"This week — Bunnylovr opens at Plaza, Cassavetes on 35mm at Tara, Dune: Part Three in true IMAX at Mall of Georgia."*
- Right-align: `CURATED BY / Lost City Film`

**Date strip** (14 days visible, unlimited via picker):
- Label row: `THE NEXT TWO WEEKS` left, `Pick a date ↗` right
- 14 pills, each ~88w × 86h, `fill_container` distribution:
  - Top: day-of-week mono caps (muted) OR `TODAY` (gold)
  - Middle: date number Outfit 24pt
  - Bottom: film count or event marker (`14 films` / `★ premiere` / `6 films`)
- Active state: vibe-tinted fill, gold `TODAY` label, vibe border
- Premieres: replace count with `★ premiere` in gold
- Past dates: hidden (don't show yesterday)

**View toggle** (segmented control — **two views only in v1**):
- `[By Theater]  [Schedule]`
- Active: vibe-tinted bg, cream text, gold dot
- Inactive: transparent, muted text
- Persists per user (see §8 state rules)

**Filter chips** (inline, right of view toggle):
- Label: `Filter:`
- Chips: `35mm` · `70mm` · `True IMAX` · `IMAX` · `Dolby Cinema` · `4DX` · `drive-in` · `premieres only` · `one-night-only` · `festival`
- Active chip: gold-tinted bg, gold border, gold text
- **Overflow on mobile:** single-row horizontal scroll. **No mask-fade** per `feedback_no_carousel_mask_fades.md` rule. Use simple end-of-row fade indicator dots or nothing.

### 7.2 This Week hero zone

Identical pattern to the feed headline strip but **larger**: 300px tall, more breathing room. Press quotes visible on all tiles. Meta line expands: `Tara Theatre · Saturday 2:30 PM · Cassavetes, 1968`.

**Re-key behavior:**
- When the user taps a date pill **within the current ISO week** → This Week zone does **not** re-key (it's the week they're already in)
- When the user taps into a **future ISO week** → This Week zone re-keys to that future week's significant screenings
- Provides the contextual continuity the original spec missed (designer review #6)

Right-align under strip: `Coming next week →` (when viewing current week; hides when user has already navigated forward)

### 7.3 View A — By Theater (default, Phase 3a)

Zone label: `BY THEATER · TODAY · THU OCT 23` mono caps + *"Atlanta's programs tonight."* italic subhead. Right: `5 editorial + 4 premium · 22 screenings`.

**Editorial program block** (repeating — Plaza, Tara, Starlight, Landmark, Springs, etc. — derived by `programming_style IS NOT NULL`):

- Header: theater name (Outfit 36pt) + `founding_year` or programming label in gold mono caps (`1939`, `1968`, `EST. 1949`) + meta (neighborhood · rating · film count · `See the week →`)
- Hairline divider
- Film rows (repeating):
  - Left: 96×144 portrait still (AI-generated seed in v1; CM-replaceable)
  - Right: title (Outfit 26pt) + `dir · year · runtime · rating` mono meta + optional gold badge (`ATL PREMIERE` / `35MM · SATURDAY ONLY`) + editorial line (Outfit 14pt italic soft) + showtime chips
  - Showtime chips open the action sheet on tap (§6.5)
- Footer: `+ N more films tonight (Title — time, Title — time) →`

**Premium format block** (repeating — AMC Mall of Georgia, Regal Atlantic Station, etc. — derived by `programming_style IS NULL AND venue_formats IS NOT EMPTY`):

Per designer feedback, Tier 2 **gets one line of editorial voice at the venue level** — not per film. A single italic sentence sits under the theater name describing what the venue is for:

> **Regal Atlantic Station** · IMAX · 4DX · RPX · ScreenX
> *"Atlanta's most format-stacked multiplex. Four ways to see anything."*

> **AMC Mall of Georgia 20** · TRUE IMAX · 70mm
> *"The only real IMAX in metro Atlanta — dual 4K laser, 1.43:1 aspect."*

Film rows are compressed (no per-film editorial blurb, no press quote):
- Left: 64×96 still (smaller than editorial program)
- Right: title + director/runtime/rating mono meta + showtime chips carrying per-screening format tag: `7:30 · IMAX`, `8:00 · 4DX`

**Additional block** (opt-in, Phase 3c):
- Hidden by default
- Appears below Premium block as a quiet separator + CTA card:
  - Kicker: `OPTIONAL`
  - Title: *"Additional theaters"* (italic softened)
  - Body: *"Add theaters near you. Saves to your account so you see the same set every visit."*
  - Button: `Browse theaters →` in vibe-tinted pill
- When user has opted in: compressed blocks below (identical visual to Premium block, but without the per-venue editorial line)

### 7.4 By Film — cut from v1

Designer and architect aligned on cutting: it functionally duplicated By Theater with the axes swapped. The one genuinely novel case — comparing formats for a single blockbuster (*"IMAX vs Dolby Cinema for Dune?"*) — is better served as a film-detail-page feature or a late-stage filter view.

**Deferred to post-v1 revisit:** "Compare formats" mode that surfaces only when a film has 3+ distinct format variants across 2+ venues. Not built in Phase 3.

### 7.5 View B — Schedule (Phase 3b)

Same shell, same This Week hero. Main content = print-style time × theater grid (desktop) / time-grouped list (mobile).

#### Desktop (≥ 768px): grid

- **X-axis:** time, 11am → 1am, in 30min ticks (major at hour, minor at half-hour)
- **Y-axis:** theaters, ~72px per row. Order: editorial programs first, `── PREMIUM FORMATS ──` divider, premium format venues, `── ADDITIONAL ──` divider, opted-in venues
- **Cells:** each screening anchored at its showtime, width proportional to runtime (a 108-min film = 108 minutes wide on the grid)

Cell content:
```
┌─────────────────────┐
│ Bunnylovr           │
│ 1h 41m · R · IMAX   │
└─────────────────────┘
```
- Bg: `surface/dusk`, 1px border colored by significance (gold = premiere, vibe = regular, coral = closing)
- Format tag visible when applicable
- Tap → action sheet (§6.5)

Grid overlays:
- Vertical hour gridlines in twilight (major/minor)
- Horizontal theater row dividers (thicker at classification boundaries)
- **Current-time red line** with pinned `NOW 6:15 PM` label top
- **Sunset marker** on Starlight row only — small vertical gold dashed line with `sunset 8:04` label; sunset computed server-side from lat/lng + date (see §8, it's a function not a field)
- True IMAX row gets subtle gold tint on its row label to distinguish from digital IMAX

Filter effect: filters don't reflow the grid — they fade non-matching cells to 0.2 opacity and highlight matching cells with a gold halo.

**Runtime data gap (data specialist #3):** `runtime_minutes` is sparse for chain blockbusters (TMDB matching not wired into chain crawler pipeline). When runtime is missing, cell defaults to a 110-minute nominal width with a `?` in the runtime slot. Not a blocker; Phase 1 notes TMDB lookup extension as desirable-but-deferred crawler work.

#### Mobile (< 768px): time-grouped list

Grid transpose fails at 375px (architect's concern: 15-column theater axis at 25px/column is unreadable). Replaced with a **time-grouped list**:

```
6:00 PM ─────────────────────────────────
  Bunnylovr · Plaza Theatre · IMAX
  Faces · Tara · 35MM
6:15 PM ─────────────────────────────────
  Normal · Plaza Theatre
  [NOW line inserts here]
7:00 PM ─────────────────────────────────
  Lorne · Tara Theatre
  Exit 8 · Plaza Theatre
7:30 PM ─────────────────────────────────
  Normal · Plaza Theatre
  Palestine '36 · Tara
…
```

- Sticky hour headers as user scrolls
- Each item = compact row: film title + theater + format tag, tappable (opens action sheet)
- `NOW` pill inserts between hour groups at current time
- Sunset marker inserts on Starlight items only (*"Starlight · show starts at full dark — sunset 8:04"* as a subtle italic note)
- Filters fade non-matching rows, same principle as grid

**Empty state (both desktop and mobile):** *"Quiet day — see what's showing this week →"* linking to This Week.

## 8. Data requirements + state rules

### 8.1 Fields on `places` (Phase 1)

| Field | Type | Nullable | Purpose |
|---|---|---|---|
| `programming_style` | enum (`repertory`, `indie`, `arthouse`, `drive_in`, `festival`) | yes | Editorial program treatment signal. NULL = not an editorial programmer. |
| `venue_formats` | text[] | default `'{}'` | Format capability. Examples: `{true_imax, 70mm}`, `{imax, 4dx, rpx, screenx}`, `{}` |
| `founding_year` | int | yes | Displayed as gold accent on editorial program cards |

**Naming collision avoided:** this spec does NOT use a field named `venue_tier`. Display classification (editorial / premium / additional) is derived at query time from the two fields above.

### 8.2 Fields on `series` / `screening_titles` (Phase 1 — film-level)

| Field | Type | Purpose |
|---|---|---|
| `editorial_blurb` | text | One-line CM-written description. Reused across screenings of this film. |
| `film_press_quote` | text | Optional press quote. **Named `film_*` to distinguish from the existing `editorial_mentions` pattern on `places`** which serves restaurant reviews. |
| `film_press_source` | text | Attribution for the quote (e.g., `Little White Lies`) |
| `is_premiere` | boolean | True for ATL-premiere films |
| `premiere_scope` | enum (`atl`, `us`, `world`) | Scope of the premiere. Mostly `atl` in practice. |

**CM-only fields.** No crawler source. Seed via editing surface or JSON override in Phase 1.

### 8.3 Fields on `screening_runs` (Phase 1 — run-level)

| Field | Type | Purpose |
|---|---|---|
| `is_curator_pick` | boolean | CM-editable weekly (or add a dated `curator_pick_week` date field). Primary editorial signal for the hero cascade. |

### 8.4 Fields on `screening_times` (Phase 1 — screening-level)

| Field | Type | Status |
|---|---|---|
| `format_labels` | text[] | **Already exists in schema** (see `602_screening_storage.sql`) but **empty** — Phase 1 crawler work populates this. Examples: `{imax}`, `{4dx}`, `{70mm}`, `{standard}` |
| `screen_name` | text | Already exists, populated for Starlight. AMC/Regal crawler work extends this where per-auditorium mapping is extractable (medium-difficulty; not blocking). |

### 8.5 Derived (never stored)

- **Display classification** (editorial program / premium format / additional) — from `programming_style` and `venue_formats`
- `first_date` / `last_date` — min/max of `screening_times.start_time` for a run (already computed in the current API)
- `is_one_night_only` — derived: `screening_run` where `end_date == start_date` AND `screening_times` count = 1
- `is_35mm_repertory` — derived: `format_labels` contains `35mm` AND `is_special_event = true`
- `sunset_time` (per date, per lat/lng) — **server-side function**, not a field. Use a sunrise-sunset library cached per-date. Only relevant for Starlight row.

### 8.6 State persistence rules

| State | Storage | Rationale |
|---|---|---|
| View toggle preference (By Theater / Schedule) | Profile (logged-in) + localStorage (guest). **Merge** on login (don't overwrite). | Device/account preference |
| Opt-in additional theaters | Profile scoped per `(portal, user)` — **not global**. localStorage for guests; merge on login. | Per-city list; Atlanta add doesn't pollute Nashville later |
| Selected date | URL params (`?date=2026-04-20`) | Shareable links. Do not persist across sessions — re-keying on stale date is a bug |
| Active filters | URL params (`?formats=70mm,imax&premieres=1`) | Shareable links; filter state is per-browse-session, not per-user |
| This Week hero zone | Server-rendered; no client state | It's the week, not the day |

## 9. Cross-view rules

1. Date strip re-keys the main content across both views
2. This Week re-keys only when the user moves to a future week (see §7.2)
3. View preference + opt-in list merge on login (don't overwrite)
4. Date + filters live in URL params for shareability
5. Every tappable showtime/cell opens the action sheet — no one-tap plan creation anywhere

## 10. Integration with existing surfaces

- **Route:** `/{portal}/explore/film` — a track under the existing Explore surface pattern. Do not create an app-root route.
- **Manifest-driven shell:** Feed widget must register as a server component in the feed manifest (see recent commits `c5f60561`, `9c033416`).
- **Entity URLs:** Film detail "Details →" links use `buildSeriesUrl(slug, portal, 'film')` from `web/lib/entity-urls.ts` — do not invent new URL shapes.
- **Search:** this page is browse-by-editorial, not search. Film-specific server loaders; do not route through `search_unified()`. But: `format_labels` must be exposed as a filter facet in `search_unified()` so film search results inherit format filtering when this work completes.
- **Existing `editorial_mentions` on places:** a separate concept (restaurant/venue reviews). Don't unify with `film_press_quote` — different subject, different editorial workflow, different CM authoring surface.

## 11. Open questions (flagged; not blocking)

1. **True IMAX tooltip copy.** We distinguish `TRUE IMAX` (gold fill) from `IMAX` (outline). Film nerds get it; casual users might not. Offer a tooltip on hover/long-press explaining the distinction, or ship without?
2. **Curator pick authoring workflow.** CM editing surface vs committed JSON override for v1. Decision: start with JSON override (faster to ship), migrate to CM when Phase 2 is live.
3. **TMDB runtime backfill for chain films.** Not in Phase 1 scope. Grid cells with missing runtime fall back to 110-min nominal. Revisit after launch.
4. **Past-screenings-today treatment.** In By Theater, do we show screenings that already started/ended with a faded `ENDED` label, or drop them entirely? My lean: faded with `ENDED` label, to preserve "today at a glance" integrity.
5. **Tiny Doors ATL hard constraint.** Doesn't apply to this spec but flagged per MEMORY.md hard-constraint rule — no references to Tiny Doors anywhere in copy or fixtures.

## 12. Risks (from expert reviews)

Ranked by likelihood × impact:

1. **Editorial data absent at launch (architect risk #1).** Without `is_curator_pick` seeded and a CM workflow, the hero strip renders empty or only shows festival/opens-this-week cascade fallback. Mitigation: Phase 1 includes seeded JSON override with 4 curator picks and 10 editorial blurbs committed. Phase 2 cannot ship until populated.
2. **Crawler format extraction cost underestimated.** Regal API has the data; AMC requires DOM parsing; Plaza/Tara require strip-to-capture refactor. Medium effort each. Phase 1 must audit real output before claiming done.
3. **AMC Mall of Georgia crawl not currently running.** True IMAX is the spec's most distinctive single signal. Not in `amc_atlanta.py` LOCATIONS today. 10-line addition; must be verified end-to-end before Phase 2 ships.
4. **`venue_formats` maintenance burden.** When AMC drops a format or Regal opens a new IMAX, no crawler handles it. Mitigation: flag as quarterly audit task; assign ownership; build a health check that compares our seeded list against IMAX/Dolby public venue directories.
5. **Per-auditorium `screen_name` at chain venues.** Current crawlers don't map films to named auditoriums. Affects the "7:30 · IMAX / 8:00 · 4DX at same theater" promise. Medium-difficulty crawler work. If not delivered in Phase 1, the chip shows format only without auditorium name — degraded but not broken.

## 13. Related files

- Feed comp: `docs/design-system.pen` wrapper `INLem` (render-stalled — primary reference is this spec)
- Programmer's Board (rendered): `docs/design-system.pen` node `Mek4k`
- Explore page shell + This Week (rendered): `docs/explore-film.pen` node `i2XB5`
- Current component (to be replaced in Phase 2): `web/components/feed/sections/NowShowingSection.tsx`
- Current API: `web/lib/explore-platform/server/shows.ts`
- Format schema (existing, unpopulated): `database/migrations/602_screening_storage.sql`
- Crawler files to edit in Phase 1: `crawlers/sources/regal_atlanta.py`, `amc_atlanta.py`, `plaza_theatre.py`, `tara_theatre.py`, `chain_cinema_base.py`
- Portal isolation ADR: `docs/decisions/2026-02-14-portal-data-isolation.md`
- PRD-040 (naming-collision source — different `venue_tier` concept): `prds/040-venue-enrichment-tier-contract.md`
- Entity URL builder: `web/lib/entity-urls.ts`
- Design system tokens: `web/CLAUDE.md`

## 14. Success criteria

This design succeeds if, at launch:

1. A first-time visitor on the feed understands *"significant film events are happening this week in Atlanta"* at a single glance, without mentally translating another carousel of cards.
2. A cinephile opening `/{portal}/explore/film` finds *"True IMAX vs LieMAX"* respected in the UI — the distinction is legible, not flattened.
3. A user planning an evening can find every showtime for a given film (via By Theater film search/filter) OR see what's playing at their favorite theater tonight (By Theater) OR plan a double feature across theaters (Schedule) — without leaving the page or losing their date context.
4. The feed widget fits the feed rhythm (220–320 tall) and doesn't read as "another carousel."
5. No user creates a plan by accident — every chip tap confirms via action sheet.
6. The Explore page is coherent, not a grab-bag of modes — each view has a clear job, and the shell + This Week zone tie them together.
