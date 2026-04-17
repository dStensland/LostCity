# Live Music (Feed) + /{portal}/explore/music — Design Spec

**Status:** design approved, pre-implementation
**Date:** 2026-04-17
**Sibling spec:** `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md`
**Supersedes:** `docs/superpowers/specs/2026-04-13-music-tab-redesign.md` (tab-inside-VenuesSection approach retired)

---

## 1. Overview

Two surfaces, one subject. Mirrors the film pattern so film and music read as sibling products in the portal.

| Surface | Job | Posture |
|---|---|---|
| **Feed — Live Tonight widget** | Tease the week's significant shows + tonight's city-wide playbill | Opinionated, editorial, ~220–320px tall |
| **`/{portal}/explore/music`** | Everything live in Atlanta: by venue, by show, residencies, festivals on the horizon, on-sale | Comprehensive, filterable, two view modes + one planned future mode |

The feed widget is a teaser into `/explore/music`. They share editorial DNA and differ in density and commitment. Cut ruthlessly from the feed widget; carry everything on the explore page.

## 2. Phase decomposition

Three phases with explicit dependencies. Each ships independently after Phase 1.

### Phase 1 — Data model + data hygiene + APIs

Blocks everything else.

**Schema additions:**
- `places`: `music_programming_style` (enum, nullable), `music_venue_formats` (text[]), `capacity` (int, nullable)
- `events`: `is_curator_pick` (boolean), weekly CM-editable
- `series`: ensure `series_type='residency'` value is usable; existing schema supports it
- `events.editorial_blurb` — one-line CM-written description (if not already present; check migrations)

**Naming rules (no collisions):**
- We add `music_programming_style` (not shared with film). A future film rename would switch its column to `film_programming_style`; track as a follow-up. `music_venue_formats` parallels film's `venue_formats`.
- We do **not** add `music_press_quote` / `music_press_source`. Press quotes are cut from v1 (see §12 risk log, data review).

**Data hygiene work (non-optional — the Explore page embarrasses itself without this):**

- **Dedupe place records.** `terminal-west` vs `terminal-west-test`; `Fox Theatre` vs `Fox Theatre - Atlanta`; scan for other music-venue duplicates. Merge events, pick canonical slug, redirect stale.
- **Resolve ghost venues** with inactive or missing sources:
  - `Blind Willie's` — reactivate source or exclude from seeded tier list (famous blues room; embarrassing if empty)
  - `Knock Music House` — reactivate or exclude
  - `Apache Cafe / XLR` — reactivate or exclude
  - `REVERB Downtown Atlanta` — add source or exclude
  - Policy: any seeded venue in the tier list MUST produce events within the last 14 days or it doesn't ship in the seed.
- **Genre filter contamination.** Music queries use `category_id='music'` as the primary filter, not `is_show=true`. Scope rule documented in data layer.
- **Doors_time crawler work** (medium effort). Current coverage: 1% (40 of 2,231). Extend extraction from Ticketmaster / Aisle 5 / Star Community patterns to the Tier-1 rooms: Terminal West, Variety Playhouse, Tabernacle, The Eastern, Center Stage, City Winery, Eddie's Attic, Red Light Café, 529, The EARL, Masquerade. Target 40%+ fill on those venues before Phase 2 ships.

**Residency seeding** (v1 human-seeded, crawler-automated later):
- Reclassify ~20 music `series_type='recurring_show'` rows to `series_type='residency'` via CM override or migration.
- Seed editorial blurbs on the top 10 (Songwriter Round at Eddie's Attic; Yacht Rock Revue at Park Tavern; Sunday Jazz at Churchill Grounds; etc.).
- Follow-up: crawler heuristic detects weekly recurring patterns at same venue + same artist/series name and proposes residency classification for CM approval.

**CM editorial seeding** (committed JSON override for v1; CM surface follow-up):
- `is_curator_pick` on 4–6 events per week
- Per-venue italic editorial line on the 15 seeded editorial/marquee rooms (see §3)
- Per-residency blurb on the 10 seeded residencies

**Venue tiering seed** (15 venues; all must produce events — see ghost-venue rule above):

*Editorial* (`music_programming_style` set):
- Eddie's Attic · Decatur · `listening_room` · capacity 200 · formats `{listening_room, seated}`
- Red Light Café · Amsterdam Walk · `listening_room` · capacity 100 · formats `{listening_room, seated}`
- City Winery · Ponce City Market · `listening_room` · capacity 300 · formats `{listening_room, seated}`
- Smith's Olde Bar · Morningside · `curated_indie` · capacity 300 · formats `{standing_room, seated}`
- Terminal West · West Midtown · `curated_indie` · capacity 600 · formats `{standing_room}`
- Variety Playhouse · Little Five Points · `curated_indie` · capacity 1050 · formats `{seated, standing_room}`
- The EARL · East Atlanta · `curated_indie` · capacity 300 · formats `{standing_room}`
- 529 · East Atlanta · `curated_indie` · capacity 150 · formats `{standing_room}`
- Star Community Bar · Little Five Points · `curated_indie` · capacity 200 · formats `{standing_room}`
- Aisle 5 · Little Five Points · `curated_indie` · capacity 400 · formats `{standing_room}`
- The Masquerade (Heaven/Hell/Purgatory) · Underground · `curated_indie` · capacities vary · formats `{standing_room}`
- MJQ Concourse · Ponce · `dj_electronic` · capacity 300 · formats `{dj_booth, standing_room}`
- The Bakery · West End · `dj_electronic` · capacity 400 · formats `{dj_booth, standing_room}`

*Marquee* (no `music_programming_style`, `capacity >= 1000`):
- Tabernacle · Downtown · capacity 2600 · formats `{standing_room, seated}`
- The Eastern · Reynoldstown · capacity 2200 · formats `{standing_room, seated}`
- Buckhead Theatre · Buckhead · capacity 1800 · formats `{standing_room, seated}`
- Coca-Cola Roxy · The Battery · capacity 3600 · formats `{standing_room, seated}`
- Center Stage · Midtown · capacity 1050 · formats `{seated, standing_room}`
- Fox Theatre · Midtown · capacity 4665 · formats `{seated}`
- State Farm Arena · Downtown · capacity 21000 · formats `{arena, seated}`
- Cadence Bank Amphitheatre · Lakewood · capacity 19000 · formats `{outdoor, seated, lawn}`
- Ameris Bank Amphitheatre · Alpharetta · capacity 12000 · formats `{outdoor, seated, lawn}`
- Believe Music Hall · Downtown · capacity 2400 · formats `{standing_room}`

*Additional* (opt-in, compressed): every other music venue.

**APIs:**
- `GET /api/music/this-week?portal=<slug>` — curator picks + significant shows cascade
- `GET /api/music/tonight?portal=<slug>&date=<iso>` — venue-rowed playbill shape, split into `tonight` and `late_night` buckets
- `GET /api/music/by-venue?portal=<slug>&date=<iso>&genres=<csv>` — editorial + marquee + opted-in venue blocks
- `GET /api/music/by-show?portal=<slug>&date=<iso>&genres=<csv>` — chronological list
- `GET /api/music/residencies?portal=<slug>` — weekly-recurring series with `series_type='residency'`
- `GET /api/music/festivals-horizon?portal=<slug>` — any festival within 90 days
- `GET /api/music/on-sale?portal=<slug>` — newly-announced shows 2–6 months out (v1: sort by `created_at` DESC on events with `start_time` in that window; v2: dedicated `on_sale_date` crawler field)

All APIs enforce `p_portal_id` per `docs/decisions/2026-02-14-portal-data-isolation.md`. Hero cascade query extends `getCardTier()` in `lib/city-pulse/tier-assignment.ts` — `is_curator_pick=true` becomes a hero-tier input. Widget then reads `card_tier='hero' AND category='music'` for the This Week strip. No new ranking system.

### Phase 2 — Feed widget

Replaces `web/components/feed/sections/MusicTabContent.tsx` and related venue-tab music rendering inside `VenuesSection`. Height-bounded. Server-rendered with minimal client state. Registered in the feed manifest.

Depends on Phase 1. Does not depend on Phase 3.

### Phase 3 — /{portal}/explore/music page

Depends on Phase 1; independent of Phase 2. Ships incrementally:

- **Phase 3a** — Page shell + This Week hero + By Venue main view (default) + **Residencies section** + By Show view toggle
- **Phase 3b** — Festivals on the horizon section
- **Phase 3c** — Just announced / on-sale section

Timeline/Schedule view is spec'd as a **defined future mode** (see §7.6). Not v1.

---

## 3. Venue tiering — derived, not stored

Three display treatments, derived at query time from stored fields. Same architectural pattern as film.

| Display treatment | Derivation | Examples |
|---|---|---|
| **Editorial** | `music_programming_style IS NOT NULL` | Eddie's Attic, Red Light, Smith's, Terminal West, Variety, 529, MJQ |
| **Marquee** | `music_programming_style IS NULL AND capacity >= 1000` | Tabernacle, The Eastern, Fox Theatre, Cadence Bank Amphitheatre |
| **Additional** | everything else (opt-in) | every other bar/restaurant/brewery booking music |

**Personalization ordering** in By Venue view, top to bottom:

1. **My Venues** (user-pinned favorites; stored as `(portal_id, place_id)` tuples — never bare `place_id`, otherwise Atlanta pins leak into Arts portal)
2. Editorial
3. Marquee
4. Additional (collapsed; expands on opt-in)

Storage: profile-scoped `user_venue_pins` with `(user_id, portal_id, place_id, pinned_at)`. localStorage mirror for guests; merge on login.

**Why derived, not stored:** avoids drift. The two fields that drive behavior are stored; the display tier is query-time computation.

## 4. Language rules

- Feed section title: `Live Tonight`
- Feed section meta: `9 shows in Atlanta tonight`
- Explore page title: `Live Music in Atlanta.`
- Editorial voice speaks to the city, not a niche:
  > *"This week — Kishi Bashi returns to Terminal West, the Songwriter Round at Eddie's runs Monday, and Shaky Knees drops its full weekend lineup Friday."*

Section headers on explore page:
- `THIS WEEK · N SIGNIFICANT SHOWS`
- `BY VENUE · TONIGHT · THU OCT 23` / `BY SHOW · TONIGHT · THU OCT 23`
- `RESIDENCIES · WEEKLY AT ATLANTA ROOMS`
- `FESTIVALS ON THE HORIZON`
- `JUST ANNOUNCED · ON SALE NOW`

## 5. Signal vocabulary on cards

| Signal | Treatment | Computable today? |
|---|---|---|
| `CURATOR PICK` | Gold mono caps chip, top-left of hero tile | New field in Phase 1 |
| `TOUR OPENER` / `ATL STOP` | Gold outline chip | CM-flagged v1 |
| `RESIDENCY` | Gold mono caps chip, small | Needs residency reclassification in Phase 1 |
| `SOLD OUT` | Coral chip, strike-through time | ✓ from `ticket_status='sold-out'` (86% fill) |
| `LAST TIX` | Gold chip | ✓ from `ticket_status='low-tickets'` |
| `FREE` | Neon-green outline | ✓ from `is_free` (11% fill) |
| `21+` / `18+` / `ALL AGES` | Muted outline, mono caps | ✓ from `age_policy` (42% fill) |
| `FESTIVAL` | Coral chip | ✓ from `festival_id` |
| Support act line | Italic cream, secondary row: `w/ Psychic Love` | ✓ from `event_artists` non-headliner rows |
| Genre tags | Small chips in card body | ✓ from `tags` / `genres` (83% fill) |

**Doors + show times** — when both present, stacked:

```
DOORS 7 · SHOW 9
```

When only one present, label explicitly: `SHOW 9PM`. Never bare `9PM` — music users need to know which number they got. Today's 1% doors_time fill means most cards render as `SHOW 9PM` until Phase 1 crawler work catches up.

## 6. Feed — Live Tonight widget

Two-tier compressed section. Total height 220–320px depending on state.

### 6.1 Section header

```
◉ Live Tonight · 9 shows in Atlanta tonight           See all →
```

- Icon: `MusicNotes` duotone from Phosphor (matches design system conventions)
- Accent: `--vibe` (A78BFA — same as film uses for cinema)
- `See all →` routes to `/{portal}/explore/music`

### 6.2 This Week headline strip

Label: `THIS WEEK · N SIGNIFICANT SHOWS` gold mono caps + italic sub *"Not to miss."*

**Adaptive layout:**
- 0 items → hide strip (playbill-only state)
- 1 item → full-width tile
- 2 items → 60/40 split (significance-ranked)
- 3 items → equal thirds

**Tile — dual state:**

**State A: image present.** Full-bleed artist/venue/album image, ~200–300px tall, gradient overlay:
- Top-left: gold editorial chip (`CURATOR PICK · TONIGHT` / `TOUR OPENER · SOLD OUT` / `RESIDENCY FINALE` / `FESTIVAL HEADLINER`)
- Bottom overlay:
  - Editorial one-liner from `editorial-templates.ts` (template-driven; never CM-entered free text at scale)
  - Artist name — Outfit 32–40 bold, cream
  - Meta line — mono, 11pt, cream@80%: `Terminal West · tonight · DOORS 7 · SHOW 9`
  - Support line when present — italic: `w/ Psychic Love`
- 1px black divider between tiles (no gap)

**State B: image absent** (the typographic fallback, first-class):
- Dark surface (`--night`), genre-accent left border (4px)
- Same layout geometry but replace image with:
  - Large Outfit display of artist name (cream)
  - Genre label mono caps above, gold (`INDIE FOLK` / `SHOEGAZE` / `DJ · HOUSE`)
  - Venue name secondary below
- Same editorial chip treatment
- Looks deliberate, not broken. Music has long-tail artist-image gaps; design for this as a real state.

### 6.3 Hero-selection cascade

Ranked; cap at 3; fills top-down:

1. `is_curator_pick = true` for current week
2. `importance IN ('flagship', 'major')` OR `is_tentpole = true` (music-calibrated — flagship alone fires 0.09%; major adds ~1.7%, the effective hero tier)
3. `festival_id` present
4. `series_type='residency'` with residency-level editorial flag (finale, milestone, seasonal)
5. One-night-only — title pattern matches `release party|farewell|finale|residency finale|one night|feat\.` (LLM classifier pass; cheap post-ingest). V1 seeds CM overrides for the 2–3 most-obvious cases per week. A dedicated `is_one_night_exclusive` flag is deferred — not worth a new column for a derived signal.

**Implementation:** extend `getCardTier()` in `lib/city-pulse/tier-assignment.ts` — curator_pick becomes a hero-forcing input. The widget queries events with `card_tier='hero' AND category='music'` rather than re-implementing ranking.

**Realistic fill rate at launch** (per data review): 2 true flagship music events in a 30-day window today; 38 at `importance='major'`. Curator picks carry the week. Cascade rarely drops below 1 item; usually lands at 2–3. Adaptive strip accommodates low fill.

### 6.4 Tonight playbill — split into TONIGHT and LATE NIGHT

**Music-specific temporal split** (film doesn't have this). Derived from `doors_time` (when present) or `start_time` (fallback):

- **`TONIGHT`** — doors/start before 21:00
- **`LATE NIGHT`** — doors/start at or after 21:00

If no late shows exist, the `LATE NIGHT` band hides entirely.

Row shape per venue:

```
TERMINAL W.  Kishi Bashi DOORS 7 · SHOW 9  w/ Psychic Love              →
VARIETY      Built To Spill DOORS 8 · SHOW 9                            →
EDDIE'S      Songwriter Round DOORS 6:30 · SHOW 7 · RESIDENCY           →
```

Late band:

```
LATE NIGHT ──────
529          Psychic Love 10pm                                          →
MJQ          DJ Shlomi 11pm · DJ · HOUSE                                →
THE BAKERY   Late Set 12am · DJ · HOUSE                                 →
```

Typography:
- Venue name: Outfit 13pt tracked caps, 110px fixed column desktop; truncates with `…` at 375px
- Artist name: Outfit 13pt semibold, cream
- Time (stacked or inline): JetBrains Mono 11pt, vibe-purple
- Support act: mono 10pt italic cream@70%
- Chip states (`SOLD OUT`, `FREE`, `21+`, `RESIDENCY`) right-justified within the row
- Arrow: vibe-purple, 14pt

**Overflow:** rows fill available width; trailing items collapse to `+N more` only when content would wrap. Don't truncate prematurely.

**Mobile (<640px):** single-column list; venue name moves to its own line above artist if row tight.

**Empty state** (rare in Atlanta): *"Quiet night — see residencies and what's coming up →"* linking to explore.

### 6.5 Chip interaction — action sheet

Tap on showtime chip opens compact bottom-anchored sheet (150–180px mobile, centered dialog desktop):

```
┌────────────────────────────────────────┐
│  Kishi Bashi · DOORS 7 · SHOW 9        │
│  Terminal West · West Midtown           │
│  w/ Psychic Love · indie-folk · $28     │
│                                         │
│  [ Add to Plans ]  [ Get Tickets → ]    │
│  [ Open Event →                       ] │
└────────────────────────────────────────┘
```

- `Add to Plans` — primary, coral, auto-focused on desktop
- `Get Tickets →` — secondary coral outline, only when `ticket_url` present
- `Open Event →` — tertiary ghost, routes to event detail page (replaces `Dismiss` — the user tapped deliberately; they want an action, not an out)
- Backdrop click / Esc dismisses

Same sheet pattern applies wherever chips are tappable (explore playbill, By Venue rows, By Show rows, residencies).

## 7. Explore — `/{portal}/explore/music`

### 7.1 Page shell (persistent, all views)

**Route:** `/{portal}/explore/music` — new track under the existing Explore surface pattern. Uses `ExploreSurface` registration; does NOT create an app-root route.

**Breadcrumb:** `EXPLORE  /  MUSIC` mono caps, vibe-purple.

**Title block:**
- Title: `Live Music in Atlanta.` — Outfit italic 52pt bold, cream
- Editorial subtitle (CM-written weekly): *"This week — Kishi Bashi returns to Terminal West, the Songwriter Round at Eddie's runs Monday, and Shaky Knees drops its full lineup Friday."*
- Right-align: `CURATED BY / Lost City Music`

**Date strip** (14 days visible, picker for further):
- Each pill: day-of-week mono caps OR `TONIGHT` (gold), date number Outfit 24pt, show count or event marker (`9 shows` / `★ festival` / `residency night`)
- Active: vibe-tinted fill, gold `TONIGHT` label
- Past dates hidden

**View toggle:**
- `[ By Venue ]  [ By Show ]`
- (Timeline reserved for future — spec'd in §7.6 but not v1)
- Persists per user

**Filter chips** (right of view toggle):
- Label: `Filter:`
- Chips: `Rock` · `Hip-Hop/R&B` · `Electronic` · `Jazz/Blues` · `Country` · `Latin` · `Pop/Singer-Songwriter` · `All Ages` · `Free` · `Under $25` · `Late Night`
- Single-select for genre (broad buckets derived from `tags`/`genres` array via static `GENRE_MAP`); multi-select for the utility chips (all-ages, free, etc.)
- **Horizontal scroll at all viewports** (long labels like `Hip-Hop/R&B`, `Pop/Singer-Songwriter` — too wide for wrap on tablet)
- **No mask-fade** per `feedback_no_carousel_mask_fades.md`

**Genre bucket map** lives in shared utility (`web/lib/music-genres.ts`); used by server filter and client display. Carries forward the 2026-04-13 spec's map.

### 7.2 This Week hero zone

Same shape as feed strip, larger: 300px tall, more breathing room. Editorial one-liner visible on all tiles. Meta line expands: `Terminal West · Thursday · DOORS 7 · SHOW 9 · w/ Psychic Love`.

**Re-key behavior:**
- Tap date pill within current ISO week → This Week does not re-key
- Tap into future ISO week → This Week re-keys to that week's significant shows

Right-align under strip: `Coming next week →` (hidden when already navigated forward).

### 7.3 View A — By Venue (default, Phase 3a)

Zone label: `BY VENUE · TONIGHT · THU OCT 23` mono caps + *"Atlanta's rooms tonight."* italic subhead. Right: `4 my venues · 8 editorial + 6 marquee · 22 shows`.

**My Venues block** (repeating — only if user has pinned any):
- Header: `MY VENUES · PINNED` gold mono caps
- Rows: identical to editorial rows below; no duplicate listing if a pinned room is also editorial
- Unpinnable inline

**Editorial block** (repeating — Eddie's, Red Light, Smith's, Terminal West, 529, etc. — derived by `music_programming_style IS NOT NULL`):

- Header: venue name (Outfit 36pt) + programming label in gold mono caps (`LISTENING ROOM` / `CURATED INDIE` / `DJ · HOUSE`) + meta (neighborhood · capacity · show count · `See the week →`)
- Italic subhead: one CM-written line per venue
  > *"Eddie's Attic — Atlanta's listening room. Songwriters in the round, audience quiet."*
- Hairline divider
- Show rows (repeating):
  - Left: 96×144 artist photo when available; typographic fallback (same as hero State B) when not
  - Right: artist name (Outfit 26pt) + genre/age/price mono meta + optional gold chip (`CURATOR PICK` / `RESIDENCY` / `SOLD OUT`) + support-act line (`w/ Psychic Love`) + editorial blurb (when CM-written) + stacked doors/show time chips
  - Showtime chips tap → action sheet (§6.5)
- Footer: `+ N more this week (Artist — day, Artist — day) →`

**Marquee block** (repeating — Tabernacle, Eastern, Fox, Cadence Bank, etc.):

Single italic venue-level line, no per-show blurbs:

> **Tabernacle** · 2,600 cap · 1911 church turned rock room
> *"Atlanta's most iconic club-scale room."*

> **Cadence Bank Amphitheatre** · 19,000 cap outdoor
> *"Summer concert season south of Downtown."*

Show rows compressed:
- Left: 64×96 artist image or typographic
- Right: artist name + genre/price meta + support line + stacked time chips

**Additional block** (opt-in, Phase 3a with empty default):
- Hidden by default
- Appears below Marquee as:
  - Kicker: `OPTIONAL`
  - Title: *"Additional rooms"* (italic)
  - Body: *"Add venues near you. Saves to your account so you see the same set every visit."*
  - Button: `Browse rooms →` vibe-tinted
- When opted in: compressed rows, no per-venue editorial line

### 7.4 View B — By Show (chronological, Phase 3a)

Same shell, same This Week hero. Main content = time-sorted list.

**Grouping + sort:**
- Group by day (`TONIGHT`, `FRIDAY OCT 24`, `SATURDAY OCT 25`, …)
- Within day, sort by show time ascending
- Sticky day-group headers

Row shape per show:
- Left rail: 96×96 artist image or typographic
- Right: artist name (Outfit 20pt) + venue · neighborhood (Outfit 14pt, cream) + genre chips + editorial blurb (when CM) + stacked time chips + support line + chip states (`SOLD OUT`, `FREE`, `RESIDENCY`)

Filter behavior: genre chip selection fades non-matching rows to 0.2 opacity; utility chips (Free, Late Night, All Ages) filter the visible set.

**Empty state:** *"Quiet day — see residencies and what's coming up →"*

### 7.5 Residencies section (Phase 3a)

**New component:** `MusicResidencyStrip` (fork of `RecurringStrip` — artist-keyed, not activity-typed; do not overload existing component).

Zone label: `RESIDENCIES · WEEKLY AT ATLANTA ROOMS` gold mono caps + *"Regulars worth building into the week."* italic sub.

Compact horizontal-scroll strip of residency cards. Each card (~260px):
- Top strip: gold `RESIDENCY` chip + day-of-week mono caps (`MONDAYS`, `THURSDAYS`)
- Image: artist image, venue interior, or typographic fallback
- Body: series name (Outfit 18pt) + venue · neighborhood (mono 11pt) + genre + editorial blurb (*"Songwriter-in-the-round since 1993. Audience quiet. Signing up is an honor."*) + "Next: THU OCT 23 · DOORS 6:30 · SHOW 7" (mono)

Data source: `series` where `series_type='residency' AND category='music'` scoped to `p_portal_id`.

Sort: by next upcoming instance ascending; ties broken by curator weight.

### 7.6 Timeline view — planned future mode

Not v1. Spec preserves the structural slot so when added it isn't an afterthought:

- X-axis: time, 7pm → 2am (narrower than film's 11am–1am)
- Y-axis: venues (same tier ordering as By Venue)
- Cells: each show anchored at showtime, width proportional to stated duration (fallback 90-min nominal when absent)
- Current-time red line
- Tap → action sheet (§6.5)
- Mobile fallback: time-grouped list (same pattern film uses)

Ship when real user demand surfaces OR when a second vertical (music + something) justifies the engineering.

### 7.7 Festivals on the horizon (Phase 3b)

Zone label: `FESTIVALS ON THE HORIZON` gold mono caps + *"Within 90 days."* italic.

Small cards (~220px wide, horizontal scroll). Each card leads with the date gap, not the name:

```
┌──────────────────────────────┐
│  47 DAYS                      │
│  OutKast Fest                 │
│  May 4–6 · Piedmont Park     │
│  Hip-Hop · Atlanta legends    │
└──────────────────────────────┘
```

- `XX DAYS` mono caps gold, large
- Festival name Outfit 20pt
- Date range + venue
- Genre tag or headliner teaser line

Data source: `festivals` table entries with `start_date` within 90 days, scoped to portal.

### 7.8 Just announced / on sale (Phase 3c)

Zone label: `JUST ANNOUNCED · ON SALE NOW` gold mono caps + *"Plan ahead."*.

Compressed horizontal carousel of shows with `start_time` 2–6 months out, sorted by `created_at` DESC (v1). V2 adds dedicated `on_sale_date` crawler field for proper "just announced" semantics.

Card: 180×240 poster/artist image + artist name + venue + date + `ON SALE` chip.

## 8. Data requirements + state rules

### 8.1 Fields on `places` (Phase 1)

| Field | Type | Nullable | Purpose |
|---|---|---|---|
| `music_programming_style` | enum (`listening_room`, `curated_indie`, `jazz_club`, `dj_electronic`, `drive_in_amph`) | yes | Editorial tier signal. NULL = not an editorial music programmer. |
| `music_venue_formats` | text[] | default `'{}'` | Posture: `{listening_room}`, `{standing_room, seated}`, `{dj_booth, outdoor}` |
| `capacity` | int | yes | Raw number. Capacity band derived in TS for display. |

**Naming collision avoided:** `music_programming_style` is intentionally separate from any future `film_programming_style`. Multi-role venues (Star Community Bar, Eddie's) can set both.

### 8.2 Fields on `events` (Phase 1)

| Field | Type | Purpose |
|---|---|---|
| `is_curator_pick` | boolean | CM weekly. Primary editorial signal; input to `getCardTier()`. |
| `editorial_blurb` | text | One-line CM copy (check existing migrations for field presence; add if absent) |

**Not added:** `music_press_quote`, `music_press_source`. Data review confirmed 0% meaningful press-quote source for music events. Cut from v1. If a future LLM extraction pipeline lights up press mentions from source descriptions at meaningful volume, revisit.

### 8.3 Fields on `series` (Phase 1)

No new columns. Use existing `series_type` enum value `residency`. Phase 1 work: reclassify ~20 `recurring_show` rows to `residency` via migration + CM review.

### 8.4 Derived (never stored)

- **Display tier** (editorial / marquee / additional) — from `music_programming_style` + `capacity`
- **Capacity band** — `<300 → 'intimate'`, `300–1000 → 'club'`, `1000–3000 → 'theater'`, `>3000 → 'arena'` (TS helper)
- **Tonight / Late Night** — from `doors_time` (when present) or `start_time`, threshold 21:00 local
- **Support act list** — `event_artists` where `is_headliner=false`, ordered by `billing_order`
- **On-sale recent** — `created_at` DESC on events in the 2–6-month window (v1); dedicated field (v2)

### 8.5 State persistence rules

| State | Storage | Rationale |
|---|---|---|
| View toggle (By Venue / By Show) | Profile + localStorage, merge on login | Device/account preference |
| My Venues pins | Profile `user_venue_pins (user_id, portal_id, place_id, pinned_at)` | **Per-portal** — Atlanta pins never leak into Arts |
| Opt-in additional venues | Profile scoped per `(portal, user)`; localStorage for guests | Per-city list |
| Selected date | URL params `?date=2026-04-20` | Shareable |
| Active filters | URL params `?genres=indie-rock&free=1` | Shareable |
| This Week hero | Server-rendered; no client state | Weekly, not daily |

## 9. Cross-view rules

1. Date strip re-keys main content across By Venue + By Show
2. This Week re-keys only when user moves to a future week
3. View + pin + opt-in state merges on login (never overwrites)
4. Date + filters live in URL params for shareability
5. Every tappable showtime/row opens the action sheet — no one-tap plan creation anywhere
6. Genre filter is single-select (broad bucket); utility chips are multi-select; both apply to all views simultaneously

## 10. Integration with existing surfaces

- **Route:** `/{portal}/explore/music` — new track under ExploreSurface. Not an app-root route.
- **Manifest-driven shell:** feed widget registers as a server component in the feed manifest.
- **Entity URLs:** artist links use `buildArtistUrl(slug, portal)`; venue links use `buildSpotUrl(slug, portal, context)`; event links via `buildEventUrl(id, portal, context)` (`context='feed'` inside feed/explore for overlay, `'page'` for standalone).
- **Existing `/artists/[slug]` pages:** headliner names on cards link to these. No redesign in this spec.
- **Existing residency rendering:** current `RecurringStrip` is activity-typed (trivia/karaoke/open-mic scene). Music residencies fork into `MusicResidencyStrip` — artist-keyed, editorial blurbs, series-series continuity. Do not overload.
- **Feed tier system:** `is_curator_pick` extends `getCardTier()` as a hero-forcing input. Widget reads `card_tier='hero' AND category='music'`.
- **Search:** this page is browse-by-editorial, not search. Music-specific server loaders; do not route through `search_unified()`. But: genre bucket must be exposed as a filter facet in `search_unified()` so music search results inherit genre filtering when this work completes.
- **Portal isolation** — every query path enumerated:
  - `places` tier-list queries: `.eq('owner_portal_id', portalId)`
  - `events.is_curator_pick` queries: `.eq('owner_portal_id', portalId)` (editorial is per-portal)
  - `series` residency queries: `.eq('owner_portal_id', portalId)`
  - Hero cascade via `getCardTier()`: portal-scoped in pipeline
  - My Venues pins: stored as `(user_id, portal_id, place_id)` tuples
  - Support-act `event_artists` joins: inherit event portal scope

## 11. Open questions (flagged; not blocking)

1. **Residency auto-detection heuristic.** v1 is human-seeded. Crawler logic to detect weekly recurring patterns at same venue + same artist/series name would scale this, but needs taste-calibration (avoid promoting generic trivia/karaoke nights). Defer to post-v1.
2. **Artist popularity metric for "intimate room" signal.** Requires `artists.popularity_score` or Wikipedia-backed enrichment. Not in scope; tracked for a later cascade addition.
3. **Festival lineups inside festival cards.** When a festival is seeded with a lineup (Shaky Knees day-by-day), should the festival card expand to show headliners? Out of v1; deeper festival-detail work.
4. **Sold-out signal freshness.** `ticket_status` is crawler-set; could be hours stale. Acceptable for badges but not for real-time "buy now" flow. Tickets always link out.
5. **Tour opener / ATL-stop flag.** Cannot derive reliably; requires CM flag or Bandsintown-class API. Tracked for v1.5.
6. **Tiny Doors ATL hard constraint.** Doesn't apply but flagged per MEMORY.md — no references anywhere in copy or fixtures.

## 12. Risks (from expert reviews)

Ranked by likelihood × impact:

1. **Press quote absence at launch.** Addressed by cutting press quotes entirely from v1; editorial blurb (template-driven via `editorial-templates.ts`) replaces them.
2. **Doors_time 1% fill.** Card design handles gracefully (label `SHOW 9PM` when only one time) but card loses a signal music users value. Phase 1 crawler work must raise this on Tier-1 rooms before Phase 2 ships. Target 40% fill on the 11 seeded Tier-1 venues.
3. **Ghost venues in tier list.** Blind Willie's, Knock Music House, Apache, REVERB have inactive/missing sources. Phase 1 either reactivates sources or excludes from seeded tier list. Hard rule: no seed venue with 0 events in past 14 days.
4. **Duplicate place records.** Terminal West × 2, Fox Theatre × 2. Dedupe in Phase 1 before By Venue ships.
5. **Importance signal calibration for music.** Current `importance='flagship'` fires 0.09% for music — too sparse. Cascade uses `IN ('flagship', 'major')` until scoring is retuned. Follow-up: music-specific `importance` scoring.
6. **Residency data is seeded, not grown.** If CM doesn't keep up, residencies section staleness becomes visible. Quarterly audit cadence required; crawler-assisted detection (Q11.1) is the real fix.
7. **Artist image coverage.** Estimated <50% of events have reliable artist image URL. Typographic fallback state is first-class in design, not an afterthought — but still sets a visual expectation that will feel uneven until image enrichment lands.
8. **Genre contamination on `is_show=true`.** Queries must use `category_id='music'` as primary filter. Code-level rule documented in the data layer.

## 13. Related files

- Sibling spec: `docs/superpowers/specs/2026-04-17-now-showing-and-explore-film-design.md`
- Superseded: `docs/superpowers/specs/2026-04-13-music-tab-redesign.md`
- Current music tab (to be replaced in Phase 2): `web/components/feed/sections/MusicTabContent.tsx`
- Current tonight card (adapting): `web/components/feed/venues/TonightShowCard.tsx`
- Existing recurring component (do NOT overload): `web/components/feed/lineup/RecurringStrip.tsx`
- Show-signal extraction: `web/lib/show-signals.ts`
- Artist join pattern: `web/lib/artists.ts`
- Tier assignment to extend: `web/lib/city-pulse/tier-assignment.ts`
- Editorial copy pattern: `web/lib/editorial-templates.ts`
- Entity URL builders: `web/lib/entity-urls.ts`
- Portal isolation ADR: `docs/decisions/2026-02-14-portal-data-isolation.md`
- Design tokens: `web/CLAUDE.md`
- Existing explore track pattern: `web/app/[portal]/explore/[track]/page.tsx`, `web/app/[portal]/explore/_components/ExploreSurface.tsx`

## 14. Success criteria

This design succeeds if, at launch:

1. A first-time visitor on the feed immediately sees *"significant live music is happening this week in Atlanta"* — not another carousel of interchangeable cards.
2. A regular at Eddie's Attic opens `/{portal}/explore/music`, pins Eddie's, and sees their room at the top of every visit.
3. A user scanning at 11pm sees `LATE NIGHT` shows cleanly separated from 7pm dinner-hour shows — the temporal split is legible.
4. Residencies surface as curated programming, not generic recurring events — Songwriter Round at Eddie's reads as "the scene," not "that trivia night."
5. Doors vs show time ambiguity disappears — every chip answers "what time should I show up?" unambiguously.
6. No user creates a plan by accident — every chip tap confirms via action sheet.
7. The cascade fires reliably week over week — never a "this week has no significant shows" state once curator picks + residencies are seeded.
8. The feed widget stays under 320px and doesn't turn into a quadrant-of-everything.
