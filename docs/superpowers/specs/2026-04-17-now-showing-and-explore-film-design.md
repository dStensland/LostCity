# Now Showing (Feed) + /explore/film — Design Spec

**Status:** design approved, pre-implementation
**Date:** 2026-04-17
**Pencil comps:** `docs/design-system.pen` (Round 2 Programmer's Board — node `Mek4k`) + `docs/explore-film.pen` (page shell + This Week triptych + By Theater main view)

---

## 1. Overview

Two surfaces, one subject:

| Surface | Job | Posture |
|---|---|---|
| **Feed — Now Showing widget** | Tease the significant screenings this week + give a compact glance at tonight's city-wide schedule | Opinionated, editorial, ~220–320px tall |
| **Explore — /film page** | Everything showing in Atlanta, browsable by theater or by film, with forward dates | Comprehensive, filterable, three view modes |

The feed is a teaser into /explore/film. They share editorial DNA (Programmer's Board voice) but differ in density and commitment.

## 2. Language rules

**Drop "indie" as a framing term throughout.** The product serves anyone going to a movie. Indie and rep theaters *lead editorially* because they program interestingly — but the framing is inclusive.

- Feed section title: `Now Showing`
- Feed section meta: `14 films showing in Atlanta tonight` (not "across 3 indies")
- Explore page title: `Films Showing in Atlanta.`
- Editorial voice speaks to the city, not a niche:
  > *"This week — Bunnylovr opens at Plaza, Dune: Part Three lights up the true IMAX at Mall of Georgia, Cassavetes on 35mm at Tara."*

## 3. Theater tiering (Explore)

Three tiers. First two are default-visible; third is opt-in.

| Tier | Shown by default? | Editorial treatment |
|---|---|---|
| **1. Independent & Repertory** | ✅ | Full Programmer's Board (editorial blurbs, press quotes, premiere badges, founding-year gold accent) |
| **2. Premium format screens** | ✅ | **Compressed**. The format *is* the voice. Venue leads with format capability badge(s); films list with per-screening format tags. No editorial blurbs per film. |
| **3. Additional theaters** (proximity/convenience picks) | ⛔ opt-in | Same compressed treatment as Tier 2. Appears after user adds via "Browse theaters →". Saves to profile when logged in. |

### Canonical Atlanta venue list

Populated in CM. These are the canonical premium-format screens as of 2026-04 (research-verified). Indie/Rep list still CM-editable.

**Tier 1 — Independent & Repertory (default-visible)**
- Plaza Theatre · Poncey-Highland · est. 1939 · 70mm + 35mm capable
- Tara Theatre · Cheshire Bridge · est. 1968 · 70mm + 35mm capable
- Starlight Six Drive-In · Moreland Ave · est. 1949 · outdoor drive-in
- Landmark Midtown Art Cinema · Midtown · arthouse
- Springs Cinema & Taphouse · Sandy Springs · luxury indie
- (CM adds: festivals, micro-cinemas, popup series)

**Tier 2 — Premium format (default-visible)**
- AMC Mall of Georgia 20 · Buford · **True IMAX (1.43:1 Laser GT + 15/70 film)** — only one in metro Atlanta
- Regal Atlantic Station · Midtown · IMAX + 4DX + RPX + ScreenX — premium format stacking venue
- AMC North Point Mall 12 · Alpharetta · Dolby Cinema
- AMC Avenue Forsyth 12 · Cumming · Dolby Cinema
- AMC Southlake Pavilion 24 · Morrow · Dolby Cinema + Digital IMAX
- AMC Phipps Plaza 14 · Buckhead · Digital IMAX
- AMC Barrett Commons 24 · Kennesaw · Digital IMAX
- AMC Colonial 18 · Lawrenceville · Digital IMAX
- Regal Avalon · Alpharetta · Digital IMAX + RPX
- AMC Parkway Pointe 15 · Cumberland · Prime at AMC (Atmos)
- AMC Madison Yards 8 · Reynoldstown · Dolby Atmos house

**Tier 3 — Additional theaters (opt-in)**
Everything else — standard Regal/AMC/Cinemark locations that don't offer a distinctive screening format. Users opt them in for proximity/convenience.

## 4. Format visual language

Formats are first-class signals with a consistent visual treatment.

| Format | Badge style | Notes |
|---|---|---|
| `TRUE IMAX` | Gold fill, bold mono caps | 1.43:1 Laser or 15/70 film only — Mall of Georgia today |
| `IMAX` | Outline mono caps on vibe tint | Digital IMAX (1.90:1). Clearly distinct from True IMAX. |
| `DOLBY CINEMA` | Outline mono caps | Purpose-built auditorium w/ Dolby Vision + Atmos |
| `4DX` | Coral fill mono caps | Motion + environmental — novelty signal |
| `SCREENX` | Outline mono caps | 270° three-wall |
| `RPX` | Outline muted | Regal's premium; weaker signal than the above |
| `70MM` | Gold outline | Archival film format (big signal for rep houses) |
| `35MM` | Gold outline | Archival film format (big signal for rep houses) |
| `ATMOS` | Small dot indicator, not a full badge | Sound spec only — informational, not premium by itself |

**Rule:** on any single film screening at a multi-format venue (like Regal Atlantic Station), the showtime chip carries the format tag for *that specific auditorium*:
`Oppenheimer · 7:30 · IMAX` vs `Oppenheimer · 8:00 · 4DX` (same theater, different rooms)

## 5. Feed — Now Showing widget

### Structure

Two-tier compressed section. Total height target 220–320px depending on state.

**Top zone — "This Week" headline strip.** Up to 3 landscape tiles for significant screenings this week, in a single horizontal row (adaptive 1/2/3 items — see §5.3). Each tile is a full-bleed film still with a format/editorial badge and a bottom content overlay.

**Bottom zone — "Today" typographic playbill.** One row per theater (indies + premium format screens that have something playing tonight). Films listed horizontally with next showtimes; fills available horizontal space, only truncates at true overflow. No images.

### 5.1 Section header

```
◎ Now Showing ·  14 films showing in Atlanta tonight          See all →
```

- `◎` icon in vibe-purple
- "Now Showing" in italic display type
- Meta in muted
- "See all →" routes to `/explore/film`

### 5.2 This Week label

`THIS WEEK · 4 SIGNIFICANT SCREENINGS` in gold mono caps, tight kicker. Optional italic sub: `"Not to miss."`

### 5.3 Headline strip (adaptive)

- **0 items** → hide the strip entirely (empty state falls through to playbill only)
- **1 item** → single full-width tile
- **2 items** → 60/40 split (significance-ranked)
- **3 items** → equal thirds (comped primary state)

Each tile layout (at 1/3 width as baseline):
- Full-bleed landscape still, 200–300px tall
- Top-left: gold editorial tag pill (`ATL PREMIERE · OPENS THURSDAY` / `35MM · SATURDAY ONLY` / `DRIVE-IN PREMIERE` / `TRUE IMAX EXCLUSIVE`)
- Bottom overlay with gradient fade:
  - Press quote (optional, only when CM has one) — small italic cream
  - Film title — Outfit 36–40 bold, cream
  - Meta line — mono, 11pt, cream at 80% alpha: `Plaza Theatre · tonight 7:45 PM · also Fri, Sat, Sun`
- 1px black divider between tiles (never gap)

### 5.4 Hero-selection cascade

A film earns a headline tile if it matches any of the following, ranked:

1. **Editorial flag** (CM-curated `is_curator_pick`)
2. **Opens this week** (`first_date` within the current week)
3. **Festival programmed** (`festival_id` present)
4. **Special format exclusive** (`is_true_imax` / `is_70mm` / `is_drive_in_premiere` / `is_one_night_only` / `is_35mm_repertory`)
5. **Closes this week** (`last_date` within current week)

Cap the strip at 3 items. If more qualify, rank by editorial flag first, then order above.

### 5.5 Today playbill

Label: `TODAY · Oct 23 · 14 screenings` in small mono caps, with hairline divider below.

Each theater row (Outfit/JetBrains Mono mix):
```
PLAZA       Bunnylovr 7:45 · Exit 8 5:15 · Normal 7:30 · Daaaaaalí! 9:30      →
TARA        Faces 2:30 · Lorne 5:30 · Palestine '36 3:15 · Sweet East 7:00     →
STARLIGHT   Normal 8:30 · drive-in premiere                                    →
```

- Theater name: Outfit 13pt, tracked caps (letter-spacing 2.2), 110px fixed-width column
- Film title: Outfit 13pt semibold, cream
- Time: JetBrains Mono 11pt, vibe-purple
- Separators: middot in twilight-muted
- `drive-in premiere` (or similar note): italic, gold
- Right-anchored arrow: vibe-purple, 14pt

**Overflow behavior:** rows fill available horizontal space. Only when content would wrap to a second line do trailing items collapse to `+N more`. Don't truncate prematurely.

**Empty state** (very rare in Atlanta): render playbill with zero-state message *"Quiet night — see what's opening this week →"* linking to Explore.

### 5.6 Section footer

No footer. The `See all →` in the header is the only exit. Playbill row arrows open that theater's Programmer's Board in Explore.

## 6. Explore — /film page

### 6.1 Page shell (persistent, all views)

**Breadcrumb:** `EXPLORE  /  FILM` mono caps, vibe-purple

**Title block:**
- Title: `Films Showing in Atlanta.` — Outfit italic 52pt bold, cream
- Editorial subtitle (CM-written weekly, one line): *"This week — Bunnylovr opens at Plaza, Cassavetes on 35mm at Tara, Dune: Part Three in true IMAX at Mall of Georgia."*
- Right-align: `CURATED BY / Lost City Film`

**Date strip** (14 days visible, unlimited via picker):
- Label row: `THE NEXT TWO WEEKS` left, `Pick a date ↗` right
- 14 pills in horizontal row, each ~88 wide × 86 tall, `fill_container` distribution:
  - Top: day-of-week mono caps (muted) OR `TODAY` (gold)
  - Middle: date number Outfit 24pt
  - Bottom: film count or event marker (`14 films` / `★ premiere` / `6 films`)
- Active state: vibe-tinted fill, gold `TODAY` label, vibe border
- Today state (when not active): still a pill, date number bright cream
- Past dates: hidden (don't show yesterday)
- Days with low activity (Mon/Tue quiet nights): count in muted text
- Days with premieres: replace count with `★ premiere` in gold
- Overflow 15+ days: `Pick a date ↗` custom picker

**View toggle** (segmented control):
- `[By Theater]  [By Film]  [Schedule]`
- Active option: vibe-tinted bg, cream text, gold dot
- Inactive: transparent, muted text
- Container: `surface/night` bg, rounded, 1px twilight border
- Persists per user (localStorage for guests, profile for logged-in)

**Filter chips** (inline, right of view toggle):
- Label: `Filter:`
- Chips: `35mm` · `70mm` · `True IMAX` · `IMAX` · `Dolby Cinema` · `4DX` · `drive-in` · `premieres only` · `one-night-only` · `festival`
- Active chip: gold-tinted bg, gold border, gold text
- Inactive: neutral pill, `surface/night` bg, muted text
- Filters are global — apply across all three views
- Multi-select OR (for formats) / AND (for attributes)

### 6.2 This Week hero zone

Identical pattern to the feed's headline strip but **larger**: 300px tall, more breathing room, optional 4th tile if the week warrants it (curator's pick slot).

Press quotes visible on all tiles. Meta line expands to include additional screening dates: `Tara Theatre · Saturday 2:30 PM · Cassavetes, 1968`.

**Does not re-key on date selection.** It's the week, not the day.

Right-align link under strip: `Coming next week →`

### 6.3 View A — By Theater (default)

Zone label: `BY THEATER · TODAY · THU OCT 23` mono caps + `Atlanta's programs tonight.` italic subhead. Right: `3 indies + 4 premium screens · 22 screenings`.

**Tier 1 block** (repeating — Plaza, Tara, Starlight, Landmark, Springs, etc.):

- Header row: theater name (Outfit 36pt) + founding year (gold mono caps, e.g., `1939`) + meta line (neighborhood · rating · film count · `See the week →`)
- Hairline divider below header
- Film rows (repeating per film):
  - Left: 96×144 portrait still (AI-generated/CM-uploaded)
  - Right growing: title (Outfit 26pt) + director/year/runtime spec (JetBrains Mono 11pt muted) + optional gold badge (`ATL PREMIERE` / `35MM · SATURDAY ONLY` / etc.) + editorial line (Outfit 14pt italic, soft) + showtime chips row (vibe-purple pills, mono 12pt)
  - Showtime chips are **actionable — tap creates a plan**
- `+ N more films tonight (Title — time, Title — time) →` at bottom

**Tier 2 block** (repeating — AMC Mall of Georgia, Regal Atlantic Station, AMC North Point, etc.):

- Compressed. No editorial blurbs per film. Same outer card chrome + visual weight as Tier 1, just less vertical density inside.
- Header row: theater name + **format capability badges** (`TRUE IMAX · 70MM FILM` or `IMAX · 4DX · RPX · SCREENX`) + neighborhood + film count
- Film rows (compact):
  - Left: 64×96 still (smaller than Tier 1)
  - Right: title + spec meta + showtime chips where each chip carries its per-screening format tag: `7:30 · IMAX`, `8:00 · 4DX`, `10:00 · standard`
- No press quote, no editorial line — the format is the voice.

**Tier 3 block** (opt-in):
- Hidden by default. Below Starlight (or last Tier 2) appears a quiet separator + CTA card:
  - Kicker: `OPTIONAL`
  - Title: *"Additional theaters"* (italic, softened)
  - Body: *"Add theaters near you. Saves to your account so you see the same set every visit."*
  - Button: `Browse theaters →` in vibe-tinted pill
- When user has opted in: compressed blocks below (identical to Tier 2 visual treatment).

### 6.4 View B — By Film

Same shell, same This Week hero. Main content zone swaps.

**Zone header:** `BY FILM · TODAY · THU OCT 23 · 9 FILMS` mono caps + *"Every film showing in Atlanta, tonight."* italic subhead.

**Editorial grouping** (each group = mono caps kicker + hairline divider filling remaining width):
1. `OPENS THIS WEEK` (gold)
2. `NOW PLAYING` (vibe)
3. `CLOSES THIS WEEK` (coral)

Empty groups collapse.

**Film card** (one per film, full content width):

```
┌──────────────┬──────────────────────────────────────────────────────────┐
│              │  Title (Outfit 32 bold)     Dir. · 2025 · 1h 48m · R     │
│   STILL      │  Editorial line — italic soft                             │
│ 320×180 land │  "Press quote here."  — Source (gold attribution)        │
│   scape      │                                                            │
│              │  ─────────────────── Playing at ───────────────────────── │
│              │  AMC MALL OF GEORGIA  7:30 TRUE IMAX                      │
│              │  REGAL ATLANTIC ST.   8:00 IMAX  ·  10:45 4DX             │
│              │  AMC NORTH POINT      6:15 DOLBY  ·  9:45 DOLBY           │
│              │  [standard showings — Details →]                          │
│              │                                                            │
│              │  [Details →]                                               │
└──────────────┴──────────────────────────────────────────────────────────┘
```

Rules:
- Still is **landscape** 320×180 (cinematographer's frame, not poster)
- Playing-at matrix is the decision tool. Each row = one theater. Theater name small-caps mono. Showtimes as actionable chips. Format tag attached to chip when applicable.
- Each chip = plan creation on tap. Title = detail page.
- If a film has many standard (non-premium) screenings at chain theaters, collapse them into `[standard showings — Details →]` line to avoid drowning the premium signal.

### 6.5 View C — Schedule (grid)

Same shell, same This Week hero. Main content = print-style time × theater grid.

**Grid structure:**
- **X-axis:** time, 11am → 1am, in 30min ticks. Hour labels major, half-hour minor. Responsive horizontal scroll on mobile.
- **Y-axis:** theaters, ~72px per row. Order: Tier 1 (indie/rep) first, Tier 2 (premium format) below a `── PREMIUM FORMATS ──` divider, Tier 3 (opted-in) below an `── ADDITIONAL ──` divider.
- **Cells:** each screening is anchored at its showtime with width proportional to runtime. A 108-min film = 108 minutes wide on the grid.

**Cell content:**
```
┌────────────────────┐
│ Bunnylovr          │
│ 1h 41m · R · IMAX  │
└────────────────────┘
```
- Background: `surface/dusk`
- Border: 1px, color by significance (gold = premiere, vibe = regular, coral = closing)
- Format tag visible when applicable
- Tap = plan creation
- Long-press / `(i)` glyph = film detail

**Grid overlays:**
- Vertical hour gridlines in twilight (major at hour, minor at half)
- Horizontal theater dividers (thicker at tier boundaries)
- **Current-time red line** (`NOW 6:15 PM`) spanning all rows, pinned label top
- **Sunset marker** on Starlight row only: vertical gold dashed line + small `sunset 8:04` label
- **True IMAX row** gets a subtle gold tint on its row label to distinguish from LieMAX IMAX

**Filter effect:** filters don't reflow the grid — they fade non-matching cells to 0.2 opacity and highlight matching cells with a gold halo. Density becomes contrast.

**Empty state:** if selected date has zero activity across all visible tiers, show *"Quiet day — see what's showing this week →"* routing to This Week.

## 7. Cross-view rules

1. **This Week never re-keys.** View toggle + date strip don't affect it.
2. **Date strip re-keys all three main views.**
3. **View preference persists** (localStorage for guests, saved to profile on login).
4. **Filters are page-global** and apply uniformly across all views.
5. **Click-to-plan everywhere:** any showtime chip or grid cell = plan creation. Titles = film detail page. Theater names/blocks = theater detail. Two total click targets per film: the film or a specific screening.

## 8. Data requirements (for implementation)

The design assumes these signals exist. Many don't yet; implementation will need to add them:

### New fields (films / screenings)

- `is_curator_pick` (boolean, CM-editable per film per week) — top editorial signal
- `is_premiere` + `premiere_scope` (`atl` / `us` / `world`) — for `ATL PREMIERE` badge
- `first_date` / `last_date` (dates) — drives "opens this week" and "closes this week" grouping
- `format` per screening (enum: `true_imax` / `imax` / `dolby_cinema` / `4dx` / `screenx` / `rpx` / `70mm` / `35mm` / `atmos` / `standard`)
- `is_one_night_only` (boolean)
- `is_35mm_repertory` (boolean)
- `editorial_blurb` (short one-line, CM-written per film)
- `press_quote` + `press_source` (optional, CM-editable)

### New fields (venues)

- `venue_tier` (enum: `indie_rep` / `premium_format` / `standard`)
- `venue_formats` (array, e.g., `["true_imax", "70mm"]` for Mall of Georgia; `["imax", "4dx", "rpx", "screenx"]` for Atlantic Station)
- `founding_year` (int, Tier 1 only)
- `sunset_time` (per-date, drives the drive-in marker)

### Cascade inputs

Hero-selection ordering (§5.4) is a pure function of the above fields. Tier assignment (§3) is the `venue_tier` field.

## 9. Open questions (flagged for implementation or comp round)

1. **Mobile Schedule grid** — horizontal scroll vs vertical transpose (theaters as columns). My lean: vertical transpose on mobile, sticky time-of-day rows.
2. **By Film playing-at matrix typography** — small-caps mono or serif for theater names? Comp both on next iteration.
3. **A-Z jump-nav in By Film** — skip for v1; editorial grouping is enough.
4. **True IMAX distinction in UI copy** — we say `TRUE IMAX` vs `IMAX`. Film-community-correct but may confuse casual users. Tooltip on hover explaining the distinction? Or just ship and let the enthusiasts nod?
5. **Chain opt-in scope** — does adding a chain save across city/portal, or per-city? Atlanta-only for now.
6. **Past screenings today** — in By Theater, do we show screenings that have already started/ended with a faded treatment, or collapse them entirely? Lean: faded with `ENDED` label, to preserve "today at a glance" integrity.
7. **Editorial quote sourcing** — do we cite Little White Lies, IndieWire, etc. live, or only use quotes CM has manually entered for the rare case?

## 10. Related files

- Feed comp (triptych + playbill): `docs/design-system.pen` wrapper `INLem` (render-stalled; nodes exist — primary reference is the verbal spec above)
- Round 2 Programmer's Board comp: `docs/design-system.pen` node `Mek4k` (rendered successfully)
- Explore page shell + This Week + By Theater: `docs/explore-film.pen` node `i2XB5`
- Current NowShowing component (to be replaced): `web/components/feed/sections/NowShowingSection.tsx`
- Design system tokens + recipes: `web/CLAUDE.md`, `web/.claude/rules/figma-design-system.md`

## 11. Success criteria

This design succeeds if, at launch:

1. A first-time visitor on the feed understands *"there are significant film events in Atlanta this week"* in a single glance, without mentally translating a carousel of cards.
2. A cinephile opening `/explore/film` finds *"true IMAX vs LieMAX"* respected in the UI — the distinction is legible, not flattened.
3. A user planning an evening can find every showtime for a given film (By Film) OR see what's playing at their favorite theater tonight (By Theater) OR plan a double feature across theaters (Schedule) — without leaving the page or losing their date context.
4. The feed widget fits cleanly in the feed rhythm (220–320 tall) and doesn't read as "another carousel."
5. The Explore page is coherent, not a grab-bag of modes — each view has a clear job, and the shell + This Week zone tie them together.
