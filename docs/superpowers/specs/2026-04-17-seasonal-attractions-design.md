# Seasonal Attractions — Design Spec

**Date**: 2026-04-17 (third revision — absorbed 11 must-fixes from second expert review round)
**Status**: Design
**Author**: Claude + coach

## Problem

"Festival" in the current data model and feed implies a concentrated, time-bounded program — a weekend, maybe a week. Countdown language ("Starts in 3 days") assumes that shape. But a growing class of Atlanta destinations does not behave that way:

- **Georgia Renaissance Festival** — 8 weekends over April–June
- **Netherworld Haunted House** — nightly, September–November
- **Stone Mountain Christmas** — nightly overlay, Nov–Jan
- **Lake Lanier Magical Nights of Lights** — nightly, Nov–Jan
- **Callaway Fantasy in Lights** — nightly, Nov–Jan
- **Atlanta Botanical Garden — Garden Lights** — nightly overlay, Nov–Jan
- **North Georgia State Fair** / **Georgia National Fair** — ~11 days, daily
- **Burt's Pumpkin Farm** — daily, Sept–Nov
- **Buford Corn Maze** — varies, Sept–Nov, with sub-attractions
- **Southern Belle Farm** — 4 non-overlapping seasons (Spring Strawberry, Summer Blueberry, Fall Pumpkin, Christmas)
- **Yule Forest** — multiple seasonal overlays (Tulip, Pumpkin, Haunted, Christmas tree)

Shared shape: multi-week run, recurring hours within the window, same core experience throughout. User mental model is "go once during the season, pick a good weather day" — not "don't miss this weekend."

The current model handles these inconsistently:
- Ren Fest: `place_type: "festival"` + invented "season-window" pseudo-event spanning April–June, plus 8 themed weekend events. Appears in `festivals` table, surfaces in "The Big Stuff" festivals rail with countdown urgency.
- Netherworld: `place_type: "haunted_attraction"` + 47 per-night event rows (one per open night). No season container.
- Stone Mountain Christmas: per-night event rows that should be a series under a season.
- Southern Belle Farm: 4 season-window pseudo-events on `events` against one place.
- `annual_tentpoles.py` has a **duplicate** Ren Fest entry (`"ga-renaissance-festival-grounds"`) with hardcoded dates.

Four patterns, all wrong in different ways. The goal of this spec is one pattern that fits all of them.

## Goal

Model seasonal-only destinations (and persistent places with seasonal overlays) using the existing **`exhibitions`** infrastructure as the season carrier. One pattern, consistent across 11+ real destinations.

## What changed from the original draft

The original draft added `season_start`/`season_end` columns to `places` with a destructive-overwrite year-rollover story and a new `place_type: "seasonal_attraction"`. Four expert reviewers found failure modes:

1. **Data-specialist** — destructive overwrite loses year history; year-rollover race condition can falsify `is_open` mid-season; `seasonal_attraction` as a type collides with `genre_normalize.py` mappings (`fair → festival`) and loses place identity for search filters; enrichment pipelines would silently null season hours.
2. **Architect** — run dates belong on exhibitions (mirrors museum model), not places. Adding date columns to places scopes season-awareness to one row but leaves `search_unified()`, `fetch-destinations.ts`, and enrichment pipelines season-blind.
3. **Crawler-dev** — `annual_tentpoles.py` has its own Ren Fest entry the spec missed; `southern_belle_farm.py` uses the same pseudo-event pattern under a different place_type; cleanup is not automatic because `FestivalsSection` reads from the `festivals` table, not `place_type`.
4. **Product-designer** — "Only Here For Now" label fails grid context; "This Season" is the right noun phrase alongside "Parks & Gardens" etc.

Key finding from follow-up research across 11 real destinations: the **exhibitions-as-season-carrier** model holds for every shape encountered. The `exhibitions` table already supports `exhibition_type = 'seasonal'` (added 2026-04-10) and `events.exhibition_id` FK (landed 2026-04-13). The infrastructure is ready; no crawler uses it yet.

### Third revision — absorbed from round 2 reviews

Round 2 expert review surfaced 11 must-fixes, all absorbed into this spec:

1. **Year-scoped slug convention** for seasonal exhibitions (data-specialist) — prevents UNIQUE collision on year rollover.
2. **`_EXHIBITION_COLUMNS` update** in `crawlers/db/exhibitions.py` (crawler-dev) — prevents silent `operating_schedule` data loss.
3. **Overlap handling** — helper returns array, not single row (architect + data-specialist). Yule Forest Pumpkin + Christmas tree handoff is real.
4. **Shape A scoring story** (architect) — `web/lib/city-pulse/scoring.ts` must rank exhibition-only places, not score them as zero.
5. **Festivals cleanup sequencing** — NULL `series.festival_id` before delete (data-specialist); MUST precede "This Season" launch (architect).
6. **`annual_tentpoles.py` cleanup sequencing** — MUST precede Ren Fest crawler conversion (architect) to avoid race upsert.
7. **Color change** from `--gold` to `--neon-cyan` (product-designer) — resolves collision with historic_sites.
8. **TypeScript type path** — add `filter?`, `seeAllHrefStrategy?` to `PlacesToGoCategoryConfig` (product-designer) — avoids portal-specific `if`-check pattern.
9. **Detail page duplication guard** (product-designer) — suppress seasonal exhibition from general Exhibitions block when rendered as status strip.
10. **Haunted house trio** added to scope: `folklore_haunted.py`, `paranoia_haunted.py`, `nightmares_gate.py` (crawler-dev).
11. **`north_georgia_state_fair.py`** moved from "new crawlers" to "in-scope conversions" (crawler-dev) — existing crawler uses pseudo-event pattern.

Plus important/polish items folded in: series invariant, `is_active` trap, search filter scope gate (exclude Shape F), enrichment guard scope, mobile truncation via discrete callouts, see-all link strategy, Stone Mountain per-slug triage, single-item suppression, Southern Belle wording ("active first, else next upcoming"), Shape F cross-category documented as correct.

## Non-goals

- Reclassifying every `place_type: "festival"` row. Actual festivals (Atlanta Film Festival, AJFF, Caribbean Carnival, Atlanta Fringe) stay as they are.
- Building a new feed section. The existing Places to Go infrastructure is the right home.
- Modeling persistent year-round venues. Places that are open year-round stay modeled as places; their seasonal programming lives in exhibitions (shape F below).
- Deprecating the `festivals` table. Real festivals still use it — we just stop putting seasonal attractions in it.
- Rebuilding the enrichment pipelines. Just adding a guard so they skip places with active seasonal exhibitions.

## Architecture: use existing exhibitions infrastructure

```
┌─────────────┐        ┌─────────────────────┐        ┌─────────────────┐
│   places    │ 1 ──── │     exhibitions     │ ──── N │     events      │
│             │        │ type='seasonal'     │        │ exhibition_id   │
│ place_type: │        │ opening_date        │        │ start_date      │
│   retained  │        │ closing_date        │        │                 │
│             │        │ operating_schedule  │        └─────────────────┘
└─────────────┘        └─────────────────────┘
                                  │                   ┌─────────────────┐
                                  └──────────────── N │     series      │
                                                      │ exhibition_id   │
                                                      └─────────────────┘
```

- **Place** keeps its real identity (`farm`, `fairgrounds`, `festival_grounds`, `haunted_attraction`, `garden`). No new `place_type`. No seasonal-attribute boolean on places. "Is this place currently seasonal?" is derived from whether it has an active `exhibition_type = 'seasonal'` row.
- **Exhibition** (with `exhibition_type = 'seasonal'`) carries the season window via `opening_date`/`closing_date`. One exhibition per season per place. Year history preserved — 2027's Ren Fest gets a new row, 2026's stays.
- **Events** link to the seasonal exhibition via `events.exhibition_id` for dated programming inside the season (themed weekends, fair concerts, special nights).
- **Series** link to the seasonal exhibition via new `series.exhibition_id` FK for recurring-nightly rituals (Stone Mountain Christmas parade, fireworks).

This mirrors the existing museum model — place persists, exhibition carries dates — with one twist: for seasonal-only destinations, the exhibition's lifespan equals the operational lifespan of the attraction itself, but the place row persists year-round as a searchable record.

## Shape taxonomy (five archetypes, all fit)

| Shape | Destinations | Structure |
|---|---|---|
| **A. Continuous nightly, no sub-programming** | Netherworld, Lake Lanier MNOL, Callaway Fantasy in Lights, Burt's Pumpkin Farm | 1 place + 1 seasonal exhibition. Zero child events. Hours per night in `exhibitions.operating_schedule`. |
| **B. Season + recurring nightly rituals** | Stone Mountain Christmas (parade/light show/fireworks every open night) | 1 place + 1 seasonal exhibition + N series via `series.exhibition_id` for recurring rituals. Zero one-off events unless a special night (e.g., NYE). |
| **C. Themed dated weekends under a season** | Ren Fest (8 themed weekends), Buford Corn Maze (Scream Zone, Haunted Forest) | 1 place + 1 seasonal exhibition + N child events via `events.exhibition_id`. |
| **D. Fairgrounds: short window + dense dated programming** | North Georgia State Fair, Georgia National Fair | 1 place + 1 seasonal exhibition + 50-150 child events via `events.exhibition_id`. Shape C at higher density. |
| **E. Multi-season single place** | Southern Belle Farm (4 seasons), Yule Forest (Tulip + Pumpkin + Haunted + Christmas tree), Stone Mountain Park (Dino Fest + Yellow Daisy + Pumpkin + Christmas) | 1 place + N seasonal exhibitions, each with distinct opening/closing dates. Overlap permitted (Pumpkin + Christmas handoff week). |
| **F. Persistent place + seasonal overlay** | Atlanta Botanical Garden + Garden Lights, Stone Mountain Park + its seasonal overlays | Same as E, but the place is a destination year-round independent of the overlays. |

All 11 destinations fit without schema gymnastics.

## Section 1 — Data model

### Schema deltas (minimal — 2 columns)

**New column: `series.exhibition_id`** — nullable FK to `exhibitions(id)`. Enables shape B (recurring rituals under a seasonal exhibition). When NULL, the series is persistent-venue programming; when set, it's a ritual scoped to the exhibition's run window. This IS the discriminator — document in `crawlers/CLAUDE.md` and in the helper module.

**New column: `exhibitions.operating_schedule`** — `jsonb`, nullable. Per-exhibition operating schedule with variable per-day/per-night hours. Structure:

```json
{
  "default_hours": {"open": "17:30", "close": "21:30"},
  "days": {
    "monday": null,
    "tuesday": null,
    "wednesday": null,
    "thursday": {"open": "17:30", "close": "21:30"},
    "friday": {"open": "17:30", "close": "22:00"},
    "saturday": {"open": "17:00", "close": "22:00"},
    "sunday": {"open": "17:30", "close": "21:30"}
  },
  "overrides": {
    "2025-12-24": {"open": "17:30", "close": "20:00"},
    "2025-12-25": null
  }
}
```

For simple cases (Ren Fest: same hours Sat/Sun), only `days` is populated. For continuous-nightly with no weekly variation (Netherworld), just set `default_hours` and leave most of `days` null. `overrides` handles holidays and special closures.

This is scoped to `exhibitions` — `places.hours_json` remains the place's default (off-season = the place is unscheduled; in-season = the active exhibition's schedule wins). No change to `places`.

### Crawler-side schema dependency — `_EXHIBITION_COLUMNS` update

`crawlers/db/exhibitions.py` maintains an explicit `_EXHIBITION_COLUMNS` set (around line 94) that filters incoming data dicts before insert/update. Adding `operating_schedule` to the DB is **not sufficient** — the column name must also be added to `_EXHIBITION_COLUMNS`, or the field is silently stripped. This is load-bearing and must land in the same PR as the schema migration.

### Slug convention (year-scoped)

`exhibitions.slug` has a `UNIQUE` constraint. A year-agnostic slug (e.g. `georgia-renaissance-festival-seasonal`) would collide on second-year upsert. Convention for `exhibition_type = 'seasonal'` rows:

```
<place-slug>-seasonal-<year>
```

Examples:
- `georgia-renaissance-festival-seasonal-2026`
- `netherworld-haunted-house-seasonal-2025`
- `southern-belle-farm-strawberry-season-2026` (multi-season place: include season identifier)

The content-hash dedup in `insert_exhibition()` already keys on `(title, venue_id, opening_date)`, so re-runs during the same season find and update the existing row. Only the slug needs explicit year-scoping to avoid the UNIQUE collision on year rollover.

### Exhibition lifecycle — `is_active` trap

Do **not** set `is_active = FALSE` on a seasonal exhibition to signal mid-season closure (weather cancellation, health emergency). Update `closing_date` to the early date instead. `is_active = FALSE` silences the row without creating a truthful historical record. This must be explicit in `crawlers/CLAUDE.md`.

### Series invariant

When `series.exhibition_id` is set, `series.place_id` MUST equal `exhibitions.place_id` for the referenced exhibition. Both fields address "where is this series?" — drift creates conflicting attribution. Enforce in crawler write logic; consider a DB trigger as a later hardening step.

### Why no new `place_type`

- Place identity is preserved: Ren Fest grounds stay `place_type: "festival_grounds"` (or `"fairgrounds"` — already exists); Southern Belle stays `"farm"`; Netherworld stays whatever haunted-attraction type it has.
- "Is this place seasonal right now?" is derivable: does it have an exhibition with `exhibition_type = 'seasonal' AND opening_date <= today AND closing_date >= today`? Yes → seasonal. Off-season / no exhibition → not surfaced.
- No collision with `genre_normalize.py` mappings. No conflict with search filters.

### `exhibitions.exhibition_type = 'seasonal'`

Already in the check constraint as of `20260410010002_exhibitions_expansion.sql`. No migration needed for the type itself.

## Section 2 — Helper functions and feed surfacing

### New helpers in `web/lib/places/seasonal.ts`

**Returns an array** (not a single row) — a place can have overlapping seasonal exhibitions (Yule Forest: Pumpkin Oct–Nov + Christmas tree Nov–Dec; Southern Belle adjacent handoffs).

```ts
export async function getActiveSeasonalExhibitions(
  placeId: number,
  date: Date,
): Promise<SeasonalExhibition[]>;  // empty array if none active

export function getPrimarySeasonalExhibition(
  exhibitions: SeasonalExhibition[],
  date: Date,
): SeasonalExhibition | null;
  // Tiebreaker rule: prefer the exhibition with the LATEST opening_date
  // (transition-forward — "what's new right now"). Ties broken by
  // earliest closing_date (most urgent).

export function isPlaceInSeason(
  place: Place,
  exhibitions: SeasonalExhibition[],
  date: Date,
): {
  status: "active" | "pre-open" | "grace" | "off-season";
  daysToOpen: number | null;
  activeCount: number;  // for "2 seasons running" UX signaling
};
```

Consumers: Places to Go filter, detail page status strip, search_unified season guard, feed pipeline. **Lint rule**: ban direct reads of `exhibition_type = 'seasonal'` outside `web/lib/places/seasonal.ts` (custom ESLint rule or search-based pre-commit check). Drift prevention.

Optional second file: `isPlaceInSeason()` may fit better in `web/lib/places/state.ts` alongside other place-state predicates (`is_open`, `hours_today`). Decide at implementation time — non-blocking.

### Places to Go: new "This Season" category

Add to `web/lib/places-to-go/constants.ts`:

```ts
{
  key: "seasonal",
  label: "This Season",
  placeTypes: [],                                    // type-agnostic
  filter: "has_active_seasonal_exhibition",          // new filter primitive
  accentColor: "#00D4E8",                             // --neon-cyan
  iconType: "calendar",
  seeAllHrefStrategy: "none",                         // phase 1: no see-all link
}
```

**Color rationale**: the previous draft used `--gold` (`#FFD93D`). Product-designer review identified a collision with `historic_sites` (`#FBBF24`, Tailwind amber-400) — both warm yellows, visually indistinguishable at card-badge size. Switching to `--neon-cyan` (`#00D4E8`) — "now" semantics, non-colliding, and cyan is under-used in the Places to Go palette.

### TypeScript type updates

`PlacesToGoCategoryConfig` in `web/lib/places-to-go/types.ts` does not currently have a `filter` field. Add:

```ts
export interface PlacesToGoCategoryConfig {
  key: string;
  label: string;
  placeTypes: readonly string[];
  accentColor: string;
  iconType: string;
  seeAllTab?: string;
  filter?: "has_active_seasonal_exhibition";   // new, extensible
  seeAllHrefStrategy?: "placeTypes" | "seasonal" | "none";   // routes the see-all URL
}
```

Without this, the query-path implementation has to special-case `category.key === "seasonal"`, which is the portal-specific `if`-check pattern the design system rules explicitly forbid.

### Query-path implementation

The places-to-go query detects `filter === "has_active_seasonal_exhibition"` and joins `exhibitions`:

```
LEFT JOIN exhibitions e
  ON e.venue_id = places.id
  AND e.exhibition_type = 'seasonal'
  AND (
    CURRENT_DATE BETWEEN e.opening_date AND e.closing_date
    OR CURRENT_DATE BETWEEN e.opening_date - INTERVAL '28 days' AND e.opening_date - INTERVAL '1 day'
  )
WHERE e.id IS NOT NULL
```

Empty-category suppression: if fewer than 2 places match, hide the category entirely. A single-card category reads as a mistake. Implementation: gate in the API layer before returning the category block.

### Single-item suppression

If the "This Season" query returns fewer than 2 places, suppress the category from the response. Rationale: a single-card category in a grid of 12+ looks like a bug, not a feature. During sparse stretches (Feb/early-March Atlanta), "This Season" simply disappears. The 28-day pre-open window increases the chance of clearing the 2-item floor during transitional weeks.

### See-all link strategy

Phase 1: **no see-all link** (`seeAllHrefStrategy: "none"`). Rationale: the existing Places view filter has no `?seasonal=true` primitive. Wiring one up is real work (query params, filter UI, state handling). Phase 2 follow-on can wire `/{portal}/explore/places?seasonal=true`. Shipping a broken see-all link is smoke-and-mirrors; omitting it is honest.

### Filter logic

A place appears in "This Season" if it has at least one `exhibitions` row where:

```
exhibition_type = 'seasonal'
AND (
  today BETWEEN opening_date AND closing_date                  -- active
  OR today BETWEEN opening_date - 28 AND opening_date - 1      -- pre-open, ≤28d
)
```

Grace period (1–7 days post-close) is naturally hidden — neither branch above is true once `today > closing_date`. Detail page still renders.

### Callout rules for the seasonal category

Add to `web/lib/places-to-go/callouts.ts`:

| Condition | Callout |
|---|---|
| `today > closing_date - 7 days` | `"Final week"` (or `"Final weekend"` for weekend-only cadences) |
| `today BETWEEN opening_date AND closing_date` | `"Running through <month> <day>"` |
| `opening_date > today` | `"Opens <month> <day>"` |
| Always (second discrete callout) | `"<Cadence display> <hours>"` — e.g. `"Sat–Sun 10:30–6"`, `"Nightly 5:30–9:30"` |

**Discrete callouts, not concatenated**: the callout system renders via `callouts.join(" · ")` and truncates the full string. At 375px mobile, "Sat–Sun 10:30–6 · Running through June 8" (~240px) exceeds available space (~160–180px) and truncates mid-string. Emit the two callouts as separate array entries so mobile truncation kills only the less-critical trailing one (keep cadence as `callouts[0]`, status as `callouts[1]`).

Cadence display derived from `exhibitions.operating_schedule.days` — days with non-null entries are open days, collapsed to short form.

### Event-count badge for high-density shapes

Shape D (fairgrounds with 50-150 child events via `exhibition_id`) — the existing `PlacesToGoCard.event_count` badge renders the full count, which reads as confusing rather than informative at 3-digit values. For places with a seasonal exhibition, cap the badge at `event_count >= 10` → show `"10+"` or suppress entirely. Decision at implementation time.

### `is_open` logic

For cards in the seasonal category, `is_open` is true when:
1. `getActiveSeasonalExhibition(place_id, today)` returns a row (today is in season)
2. Today's day-of-week has non-null hours in `operating_schedule.days` (or `default_hours` is set)
3. Current time is within that day's open/close window

Otherwise false. Off-season, the card never appears in the category anyway.

### Festivals rail cleanup

`FestivalsSection` reads from `/api/festivals/upcoming` which queries the `festivals` table. **Cleanup has required sequencing (do not skip — FK violation otherwise):**

1. **Audit**: GET `/api/festivals/upcoming?portal_id=<atlanta>` to list what's in there. Compare to the seasonal-destination list (Ren Fest, state fairs, any misclassified).
2. **NULL the series FKs first**: `series.festival_id` does not have a declared `ON DELETE` behavior. Precedent from migration `20260328300004_festival_data_cleanup.sql`: `UPDATE series SET festival_id = NULL WHERE festival_id = <target>`.
3. **Check events**: `events.festival_id` has `ON DELETE SET NULL` — safe, auto-clears.
4. **Hard-delete**: `DELETE FROM festivals WHERE id = <target>`.
5. **Verify**: re-call `/api/festivals/upcoming` to confirm the row no longer surfaces.

### Festivals-cleanup sequencing gate

The `festivals` cleanup MUST complete **before** the `seasonal` Places to Go category ships to users. Otherwise, Ren Fest appears in both "The Big Stuff" festivals rail AND "This Season" — a dedup bug at launch. Document as a launch-blocker in the implementation plan.

## Section 3 — Crawler conversions

The single crawler pattern:

1. Upsert the place (using real place_type — `farm`, `fairgrounds`, `festival_grounds`, etc.).
2. Upsert one `exhibitions` row per season with `exhibition_type = 'seasonal'`, `opening_date`, `closing_date`, `operating_schedule` JSON.
3. For shape A: no child events. Done.
4. For shape B: create `series` rows for recurring rituals, setting `series.exhibition_id`.
5. For shape C/D: create events with `events.exhibition_id` pointing to the seasonal exhibition.
6. For shape E: repeat step 2 per season. Each gets its own exhibition row.
7. Never emit a season-window pseudo-event in the `events` table.

### Crawlers to convert (in scope)

| Crawler | Shape | Effort |
|---|---|---|
| `georgia_ren_fest.py` | C | Drop `scrape_season_event()`, create seasonal exhibition, link 8 themed weekends via `exhibition_id`. ~2h. |
| `netherworld.py` | A | Collapse per-night event rows to 1 seasonal exhibition with `operating_schedule`. Reduces crawler from ~160 lines of fragile text parsing to ~20 lines. ~3h. Also handle Netherworld special nights (opening, closing, "Lights On" kid-friendly) as events linked via `exhibition_id` — shape A with Shape C sprinkles. |
| `folklore_haunted.py` | A | Same conversion as Netherworld (Shape A). ~2h. |
| `paranoia_haunted.py` | A | Same conversion as Netherworld (Shape A). ~2h. |
| `nightmares_gate.py` | A | Same conversion as Netherworld (Shape A). ~2h. |
| `stone_mountain_park.py` | B + E (complex triage) | See per-slug triage below. ~4h + 30min decision time. |
| `southern_belle_farm.py` | E | Replace 4 season-window events with 4 seasonal exhibitions. Link Donut Breakfast/Sunflower sub-events via `exhibition_id`. ~3h. |
| `north_georgia_state_fair.py` | D | **Existing crawler** (not greenfield): convert season-window pseudo-event + dated daily programming to 1 seasonal exhibition + N child events via `exhibition_id`. ~4h. |
| `annual_tentpoles.py` | Cleanup | **Remove Ren Fest entry** (`ga-renaissance-festival-grounds`) entirely — main Ren Fest crawler owns it. Audit `_KNOWN_WINDOWS_BY_SLUG` for other seasonal-shape entries. ~2h. |

### Stone Mountain per-slug triage

The current `stone_mountain_park.py` crawler emits 10 seasonal events from `_FESTIVAL_META`. Per-slug decision matrix:

| Slug | Current | Target | Reason |
|---|---|---|---|
| `stone-mountain-christmas` | Event | Seasonal exhibition + series for nightly parade/fireworks/light-show | Shape B — long seasonal run with recurring rituals |
| `stone-mountain-yellow-daisy` | Event | Seasonal exhibition | Shape E — multi-day seasonal festival, no dated sub-programming visible |
| `stone-mountain-pumpkin` | Event | Seasonal exhibition | Shape E |
| `stone-mountain-dino-fest` | Event | Seasonal exhibition | Shape E |
| `stone-mountain-summer-at-the-rock` | Event | Seasonal exhibition | Shape E — summer overlay |
| `stone-mountain-easter-sunrise` | Event | **Stay as event** | Single-day, not seasonal |
| `stone-mountain-memorial-day-weekend` | Event | **Stay as event** | 3-day weekend, not seasonal |
| `stone-mountain-fantastic-fourth` | Event | **Stay as event** | Single-day |
| `stone-mountain-labor-day-weekend` | Event | **Stay as event** | 3-day weekend, not seasonal |
| `stone-mountain-kids-early-nye` | Event | **Stay as event** | Single-day |

### New crawlers (follow-on, documented pattern, not blocking)

| Destination | Shape | Status |
|---|---|---|
| Lake Lanier Magical Nights of Lights | A | No crawler yet. |
| Callaway Fantasy in Lights | A | No crawler yet. |
| Georgia National Fair (Perry) | D | No crawler yet. |
| Burt's Pumpkin Farm | A | No crawler yet. |
| Buford Corn Maze | C | No crawler yet. |
| Yule Forest | E | No crawler yet. |
| Six Flags (Fright Fest, Holiday in the Park) | F | Defer — lower impact. |

The pattern is documented; these crawlers ship as time permits.

### Normalization / taxonomy updates

- `crawlers/genre_normalize.py` — audit the `fair → festival`, `carnival → festival`, `hayride → festival` mappings. They should no longer auto-classify as `festival` place_type; the place gets a type based on what the venue actually is (farm, fairgrounds, etc.), and seasonal-ness comes from the exhibition.
- `crawlers/tags.py` — `VALID_FESTIVAL_TYPES` gets reviewed. No longer the authority on seasonal-ness.

### Enrichment pipeline guards

- `crawlers/hydrate_hours_google.py` and `crawlers/hydrate_venues_foursquare.py` — add a guard: skip places that have **any** `exhibition_type = 'seasonal'` row (past, current, or future), not just active. Rationale: off-season enrichment would silently NULL the place's `hours_json`; next season the place would render "Closed" even during its run. The enrichment pipeline simply leaves seasonal-only places alone — their schedules live on the exhibition.

## Section 4 — Propagation to other surfaces

### `search_unified()` RPC

Off-season events at seasonal-only places should not leak into search. Filter in the RPC itself: if an event's place has an `exhibition_type = 'seasonal'` exhibition AND the place is flagged as seasonal-only, only include the event if its `start_date` falls within a seasonal exhibition's window.

**Critical scope gate — exclude Shape F places**: Atlanta Botanical Garden is a year-round persistent destination that also runs Garden Lights seasonally. The Garden has off-season events (summer concerts, member nights in January) that MUST NOT be suppressed. The filter has to distinguish:

- Shape A-E (seasonal-only): place primarily exists as the seasonal attraction. Off-season events suppressed.
- Shape F (persistent + overlay): place is year-round. Off-season events flow through.

Implementation options:
- (a) A new `places.is_seasonal_only` boolean, set by crawlers. Explicit signal.
- (b) Derived: if place has zero events outside any seasonal-exhibition window, treat as seasonal-only. Implicit.

Prefer (a) — explicit signals beat derivation. Document in the crawler pattern: set `is_seasonal_only = true` for Shape A-E crawlers, leave false/default for Shape F.

### Shape A scoring (places with exhibitions but no events)

`web/lib/city-pulse/scoring.ts` and downstream section builders key on event counts and next-event proximity. Shape A places (Netherworld, Lake Lanier Lights, Callaway, Burt's Pumpkin Farm) have an active exhibition and **zero child events**. Without explicit handling, they score zero and get ranked below trivially-active venues.

Add to the scoring pipeline: when a place has an active seasonal exhibition, synthesize a pseudo-event-signal from the exhibition — `next_event_date = today` during active window (recency-equivalent), category from place_type. Alternative: add an explicit `has_active_seasonal_exhibition` signal that scoring weights highly. Pick one at implementation time; both work. The point is that the scoring layer must not treat exhibition-only places as dead.

Detail-page "upcoming at this place" rails must also render the exhibition status, not an empty state.

### `fetch-destinations.ts`, `fetch-enrichments.ts`

Consumers that select places for display should join `exhibitions` when filtering for "actively open" places. The helper `isPlaceInSeason()` is the canonical check. Don't inline the date math in the fetch modules.

### Detail page (`PlaceDetailShell`)

Status strip at the top of the place detail page:

- Active seasonal exhibition: `"Running through June 8 · Sat–Sun 10:30–6"` with cyan accent.
- Pre-open: `"Opens April 11 · Sat–Sun 10:30–6"`.
- Off-season: `"Closed for the season — reopens next spring"` (if the latest exhibition closed <180 days ago and no newer opens) OR `"Dates TBD"` if stale.
- **Multi-season place** (Southern Belle): show the **currently active** season if one exists; if between seasons, show the next upcoming. Plus a "See all seasons" collapsible list. Precedence (active-first) prevents the bug where a place mid-Fall-Pumpkin renders "Next: Christmas" because the crawler already wrote December's exhibition.
- **Overlap** (Yule Forest, Pumpkin + Christmas tree in handoff week): show the primary exhibition (per `getPrimarySeasonalExhibition()` tiebreaker) plus an inline "+1 more season running" signal. Full list in the collapsible.

**Duplication guard**: the existing `PlaceDetailShell` renders an Exhibitions content block. When a seasonal exhibition is rendered as the status strip at the top, **suppress it from the general Exhibitions block** — otherwise it appears twice on the page. Implementation: filter `exhibitions` in the render pipeline to exclude `exhibition_type = 'seasonal'` rows when a status strip is active.

### Shape F cross-category behavior (documented as correct, not a bug)

Atlanta Botanical Garden is `place_type: "garden"`. During Garden Lights (Nov–Jan), ABG appears in:
1. "Parks & Gardens" category — persistent identity.
2. "This Season" category — active seasonal exhibition.

This is **correct behavior**. Different user intents ("I want a garden this weekend" vs "what's running right now?") surface through different categories. The card callout makes the difference obvious in the seasonal case ("Nightly 5:30–9:30 · Running through Jan 4"), and in the Parks & Gardens card the normal open/closed treatment applies.

Follow-on polish (not in scope): add a seasonal-overlay callout to Shape F cards in their persistent category ("Garden Lights running · Nov 15–Jan 11") so the ABG card in Parks & Gardens signals the overlay. Documented as known gap.

## Section 5 — Lifecycle / transition states

Timeline for one seasonal exhibition (Ren Fest 2026, Apr 11 – Jun 8):

| Window | Feed presence | Card language | `is_open` |
|---|---|---|---|
| Jul 2025 – Mar 13 2026 (off-season, >28d pre-open) | Hidden | — | false |
| Mar 14 – Apr 10 (pre-open, ≤28d) | "This Season" category | "Opens April 11 · Sat–Sun 10:30–6" | false |
| Apr 11 – Jun 1 (active) | "This Season" category | "Running through June 8 · Sat–Sun 10:30–6" | true on Sat/Sun 10:30–6 |
| Jun 2 – Jun 8 (final week) | Urgency accent | "Final weekend · Sat–Sun 10:30–6" | true Sat/Sun |
| Jun 9 – Jun 15 (grace) | Hidden | — | false |
| Jun 16+ (off-season) | Hidden until next crawl creates a 2027 exhibition | — | false |

**Year rollover (safe model)**: when the 2027 Ren Fest season is published on the source site, the crawler creates a **new** exhibition row (not overwrites 2026). 2026 row is retained as history. The Places to Go filter picks up the 2027 exhibition as soon as it enters the 28-day pre-open window. No race condition: the filter uses `today BETWEEN opening_date AND closing_date`, so a 2026 row with `closing_date = 2026-06-08` correctly tests false in Oct 2026 regardless of when the 2027 row is written.

**Multi-season rollover**: Southern Belle has Spring, Summer, Fall, Christmas. Each is its own exhibition row. As Spring closes on May 31, Summer's exhibition (opening_date = Jun 10) picks up. Zero collision.

## Section 6 — Migration and rollout

### Sequencing gates (hard blockers)

- **`annual_tentpoles.py` Ren Fest removal MUST land before `georgia_ren_fest.py` conversion.** Otherwise both crawlers race-upsert against different slugs for the same destination, producing dedup artifacts.
- **Festivals table cleanup MUST land before the `seasonal` Places to Go category ships to users.** Otherwise Ren Fest appears in both "The Big Stuff" festivals rail AND "This Season" — launch-day dedup bug.
- **`_EXHIBITION_COLUMNS` update MUST land in the same PR as the `operating_schedule` migration.** Otherwise every seasonal exhibition silently drops hours on insert.

### Order of operations

**Phase 1 — Foundation (sequential, blocks everything)**
1. **Schema migrations** — `series.exhibition_id` FK + `exhibitions.operating_schedule` JSONB + `places.is_seasonal_only` boolean. Parity: both `database/migrations/` and `supabase/migrations/`.
2. **`_EXHIBITION_COLUMNS` update** — add `operating_schedule` to `crawlers/db/exhibitions.py`. Same PR as (1).
3. **Helper library** — `web/lib/places/seasonal.ts` with `getActiveSeasonalExhibitions`, `getPrimarySeasonalExhibition`, `isPlaceInSeason`, cadence-display formatter. Plus lint rule banning direct reads of `exhibition_type = 'seasonal'` outside the module.
4. **TypeScript type update** — add `filter?`, `seeAllHrefStrategy?` to `PlacesToGoCategoryConfig`.

**Phase 2 — Cleanup (sequenced)**
5. **`annual_tentpoles.py` Ren Fest removal** — delete the `ga-renaissance-festival-grounds` entry and any other confirmed seasonal entries.
6. **Festivals table cleanup** — audit `/api/festivals/upcoming`, NULL `series.festival_id` for targets, delete rows, verify.

**Phase 3 — Crawler conversions (parallel after Phase 1)**
7. `georgia_ren_fest.py` — requires (5) to land first.
8. `netherworld.py`, `folklore_haunted.py`, `paranoia_haunted.py`, `nightmares_gate.py` — 4 parallel, all Shape A.
9. `stone_mountain_park.py` — per-slug triage, shape B + E.
10. `southern_belle_farm.py` — shape E.
11. `north_georgia_state_fair.py` — shape D.

**Phase 4 — Propagation (parallel after Phase 1)**
12. **Places to Go wire-up** — `seasonal` category config, callout rules, single-item suppression logic. Join exhibitions in the query.
13. **Feed pipeline** — `fetch-destinations.ts` uses helpers.
14. **Shape A scoring fix** — `web/lib/city-pulse/scoring.ts` handles exhibition-only places.
15. **`search_unified()` guard** — filter off-season events at `is_seasonal_only` places.
16. **Enrichment pipeline guards** — `hydrate_hours_google.py` + `hydrate_venues_foursquare.py` skip any place with a seasonal exhibition (past/future, not just active).
17. **Detail page updates** — status strip + duplication guard + multi-season handling.

**Phase 5 — Normalization + docs**
18. **Normalization / taxonomy audit** — `crawlers/genre_normalize.py` (`fair/hayride/carnival → festival` mappings review), `crawlers/tags.py` (`VALID_FESTIVAL_TYPES`).
19. **Pattern documentation** — `crawlers/CLAUDE.md` seasonal-destinations section with the slug convention, `is_active` trap note, series invariant, and shape taxonomy.

**Phase 6 — Launch gate**
20. **Launch readiness**: Phase 2 (festivals cleanup) AND Phase 3 Ren Fest conversion AND Phase 4 Places to Go category all complete. THEN flip "This Season" category visible.

### Data migration

No destructive data changes. New rows in `exhibitions`; old season-window events can be left in `events` (they'll naturally roll off as past events) or opportunistically deleted per crawler conversion.

Ren Fest's row in the `festivals` table gets hard-deleted after migrating to an exhibition.

## Section 7 — UX polish

### Label

**"This Season"**. Noun phrase, fits grid context alongside "Parks & Gardens" / "Museums" / "Restaurants". Works when only one item is active; works when the category is empty and hidden.

### One contextual feed-level touchpoint (optional, flagged for later)

The product-designer reviewer noted that active seasonal attractions during their window deserve more than browse-only visibility. A single feed-level card (not a section) in the Lineup or Destinations area during active weeks — e.g., "Ren Fest is running this weekend · Sat–Sun 10:30–6" — would bridge users who don't filter to "This Season."

Not in scope for this spec. Flag as follow-on after shipping the base pattern and observing behavior.

### Pre-open window

28 days default. Right for Netherworld (Halloween hype), too long for Ren Fest (users don't plan 4 weeks ahead for spring). Ship 28 days; plan `exhibitions.promo_window_days` column for per-exhibition tuning when Netherworld ships. Not in this spec.

## Open questions

1. **How many rows in `festivals` table are actually seasonal attractions?** Unknown until audit. Informs scope of cleanup step.
2. **Exhibition linkage for recurring rituals** (Stone Mountain Christmas parade) — does `series.exhibition_id` capture everything, or do we need `series.operating_schedule` similarly? Likely fine with just the FK, since series already carries frequency/cadence.
3. **Feed rank of "This Season" category** — where does it sit among the 12 existing Places to Go categories? During active windows, it probably deserves top placement. During empty windows, it's hidden. Implementation-time decision.

## Success criteria

- Ren Fest no longer appears in "The Big Stuff" festivals rail. Verified by querying the festivals table (row deleted) and by browser-testing the rail during active season.
- Ren Fest appears in the "This Season" Places to Go category during its active window + 28d pre-open, with accurate callouts (`callouts[0]` = cadence, `callouts[1]` = status).
- Netherworld + 3 haunted house crawlers collapse from per-night event rows to 1 exhibition row each; still surface correctly in the feed during their Sep–Nov windows.
- Southern Belle Farm's 4 seasons each have their own exhibition, cycling correctly; detail page shows active-first, next-upcoming if between.
- North Georgia State Fair's 11-day window renders as 1 exhibition with dated child events; `event_count` badge reads sanely.
- `annual_tentpoles.py` no longer emits a duplicate Ren Fest entry.
- Year rollover creates a new exhibition row with year-scoped slug, preserves history. Query `SELECT * FROM exhibitions WHERE venue_id = <ren_fest> AND exhibition_type = 'seasonal'` returns multiple rows after two seasons.
- `search_unified()` no longer leaks off-season events at `is_seasonal_only` places. Shape F (Botanical Garden) events unaffected year-round.
- Enrichment pipelines skip places with any seasonal exhibition row; no silent NULL overwrites of seasonal hours.
- Post-launch audit: "This Season" Places to Go category click-through tracked. If it ranks below three other categories in engagement during active seasonal windows, the deferred feed-level contextual card ships as follow-on.
- Pattern documented in `crawlers/CLAUDE.md` so crawlers for Lake Lanier Lights, Callaway, Georgia National Fair, Burt's, Yule Forest, and others can follow the same shape.

## Implementation parallelization

Refer to the Phase structure in Section 6. Key parallelizable workstreams:

- **After Phase 1 (foundation) lands**: Phase 3 (crawler conversions — 8 crawlers including haunted house trio), Phase 4 (propagation — Places to Go, feed pipeline, Shape A scoring, search_unified, enrichment guards), and Phase 5 (normalization + docs) can all proceed in parallel.
- **Sequencing caveats**: `georgia_ren_fest.py` blocks on `annual_tentpoles.py` cleanup. "This Season" category user-visible ship blocks on festivals table cleanup.

Estimated effort (crawler-dev review):
- 1 week sprint: minimum viable — Ren Fest + Netherworld + Places to Go + festivals cleanup (~8h)
- 2–3 weeks: core scope (5 named crawlers, Places to Go, festivals, scoring fix, search guard)
- 3 weeks: + haunted house trio (this spec's target)
- 4 weeks: + `genre_normalize.py` audit, enrichment guards, detail page polish, Shape F cross-category callouts

Target: **full scope, ~4 weeks**.

## Out of scope

- Building new crawlers for Lake Lanier, Callaway, Georgia National Fair, Burt's, Buford Corn Maze, Yule Forest, Six Flags. Pattern is documented; these ship as time permits.
- Per-exhibition `promo_window_days` tuning (deferred until second consumer case observed).
- Weather-aware seasonal recommendations (outside scope of this spec; Places to Go already handles weather).
- Multi-city cross-portal seasonal rollups.
- Feed-level contextual card during active windows (documented as follow-on; ships if post-launch audit shows Places to Go under-surfacing).
- Cross-category callouts for Shape F persistent places (e.g. "Garden Lights running" badge on ABG in Parks & Gardens).
- `?seasonal=true` URL param on Places view + see-all link for the "This Season" category (phase 2 follow-on).
- DB-enforced series invariant (crawler-side enforcement only in phase 1).
