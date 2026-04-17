# Seasonal Attractions — Design Spec

**Date**: 2026-04-17 (revised after expert review)
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

**New column: `series.exhibition_id`** — nullable FK to `exhibitions(id)`. Enables shape B (recurring rituals under a seasonal exhibition).

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

### Why no new `place_type`

- Place identity is preserved: Ren Fest grounds stay `place_type: "festival_grounds"` (or `"fairgrounds"` — already exists); Southern Belle stays `"farm"`; Netherworld stays whatever haunted-attraction type it has.
- "Is this place seasonal right now?" is derivable: does it have an exhibition with `exhibition_type = 'seasonal' AND opening_date <= today AND closing_date >= today`? Yes → seasonal. Off-season / no exhibition → not surfaced.
- No collision with `genre_normalize.py` mappings. No conflict with search filters.

### `exhibitions.exhibition_type = 'seasonal'`

Already in the check constraint as of `20260410010002_exhibitions_expansion.sql`. No migration needed for the type itself.

## Section 2 — Helper functions and feed surfacing

### New helper: `getActiveSeasonalExhibition(place_id, date)`

Server-side TypeScript helper. Returns the single active `exhibition_type = 'seasonal'` row for a place on a given date, or null. Centralizes the date-range logic so it's not reimplemented in 5 places.

Location: `web/lib/places/seasonal.ts`.

```ts
export async function getActiveSeasonalExhibition(
  placeId: number,
  date: Date,
): Promise<SeasonalExhibition | null>;

export function isPlaceInSeason(
  place: Place,
  exhibition: SeasonalExhibition | null,
  date: Date,
): { status: "active" | "pre-open" | "grace" | "off-season"; daysToOpen: number | null };
```

Consumers: Places to Go filter, detail page status strip, search_unified season guard, feed pipeline.

### Places to Go: new "This Season" category

Add to `web/lib/places-to-go/constants.ts`:

```ts
{
  key: "seasonal",
  label: "This Season",
  placeTypes: [],                                    // type-agnostic
  filter: "has_active_seasonal_exhibition",          // new filter primitive
  accentColor: "#FFD93D",                             // gold
  iconType: "calendar",
}
```

The `placeTypes` array is empty — this category filters by exhibition state, not place_type. This is a new filter primitive for Places to Go (existing categories filter by `place_type` only). Implementation: the places-to-go query joins `exhibitions` and filters where an active seasonal exhibition exists OR is within 28 days of opening.

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
| `today > closing_date - 7 days` | `"Final week"` (or `"Final weekend"` for Ren Fest) |
| `today BETWEEN opening_date AND closing_date` | `"Running through <month> <day>"` |
| `opening_date > today` | `"Opens <month> <day>"` |
| Always (append) | `"<Cadence display> <hours>"` — e.g. `"Sat–Sun 10:30–6"`, `"Nightly 5:30–9:30"` |

Cadence display derived from `exhibitions.operating_schedule.days` — days with non-null entries are open days, collapsed to short form.

### `is_open` logic

For cards in the seasonal category, `is_open` is true when:
1. `getActiveSeasonalExhibition(place_id, today)` returns a row (today is in season)
2. Today's day-of-week has non-null hours in `operating_schedule.days` (or `default_hours` is set)
3. Current time is within that day's open/close window

Otherwise false. Off-season, the card never appears in the category anyway.

### Festivals rail cleanup

`FestivalsSection` reads from `/api/festivals/upcoming` which queries the `festivals` table. Migration:

1. Identify rows in `festivals` table that are actually seasonal attractions (Ren Fest, state fairs, any that have been misclassified).
2. Decide: remove these rows entirely OR add a `festivals.is_seasonal` column and filter them out.
3. Reviewers didn't verify, so we'll inspect during implementation. **Simplest path**: hard-delete the Ren Fest row from `festivals` after migrating its data to an exhibition. Same for state fairs if present.

### `/api/festivals/upcoming` audit

Before migration, GET `/api/festivals/upcoming?portal_id=<atlanta>` to see what's in there today. Compare to the seasonal-destination list. Hard-delete confirmed seasonal attractions.

## Section 3 — Crawler conversions

The single crawler pattern:

1. Upsert the place (using real place_type — `farm`, `fairgrounds`, `festival_grounds`, etc.).
2. Upsert one `exhibitions` row per season with `exhibition_type = 'seasonal'`, `opening_date`, `closing_date`, `operating_schedule` JSON.
3. For shape A: no child events. Done.
4. For shape B: create `series` rows for recurring rituals, setting `series.exhibition_id`.
5. For shape C/D: create events with `events.exhibition_id` pointing to the seasonal exhibition.
6. For shape E: repeat step 2 per season. Each gets its own exhibition row.
7. Never emit a season-window pseudo-event in the `events` table.

### Crawlers to convert

| Crawler | Shape | Effort |
|---|---|---|
| `georgia_ren_fest.py` | C | Drop `scrape_season_event()`, create seasonal exhibition, link 8 themed weekends via `exhibition_id`. ~2h. |
| `netherworld.py` | A | Collapse 47 per-night events to 1 seasonal exhibition with `operating_schedule`. ~3h. |
| `stone_mountain_park.py` (Christmas portion only) | B + E | One seasonal exhibition for Christmas overlay, series for parade/fireworks/light-show. Other seasonal events (Yellow Daisy, Pumpkin) get their own exhibitions. ~4h. |
| `southern_belle_farm.py` | E | Replace 4 season-window events with 4 seasonal exhibitions. Link Donut Breakfast/Sunflower sub-events via `exhibition_id`. ~3h. |
| `annual_tentpoles.py` | Various | Remove Ren Fest entry (`ga-renaissance-festival-grounds`) entirely — main Ren Fest crawler owns it. Audit other entries for seasonal shapes. ~2h. |

### New crawlers (not required for this spec, documented pattern)

| Destination | Shape | Status |
|---|---|---|
| Lake Lanier Magical Nights of Lights | A | No crawler yet. Add pattern doc in `crawlers/CLAUDE.md`. |
| Callaway Fantasy in Lights | A | No crawler yet. |
| North Georgia State Fair | D | No crawler yet. |
| Georgia National Fair | D | No crawler yet. |
| Burt's Pumpkin Farm | A | No crawler yet. |
| Buford Corn Maze | C | No crawler yet. |
| Yule Forest | E | No crawler yet. |

These are follow-on, not blocking. The pattern is documented; crawlers ship as time permits.

### Normalization / taxonomy updates

- `crawlers/genre_normalize.py` — audit the `fair → festival`, `carnival → festival`, `hayride → festival` mappings. They should no longer auto-classify as `festival` place_type; the place gets a type based on what the venue actually is (farm, fairgrounds, etc.), and seasonal-ness comes from the exhibition.
- `crawlers/tags.py` — `VALID_FESTIVAL_TYPES` gets reviewed. No longer the authority on seasonal-ness.

### Enrichment pipeline guards

- `crawlers/hydrate_hours_google.py` and `crawlers/hydrate_venues_foursquare.py` — add a guard: skip places that have an active `exhibition_type = 'seasonal'` row. Prevents silent NULL overwrites of seasonal hours (the hours live on the exhibition, not the place).

## Section 4 — Propagation to other surfaces

### `search_unified()` RPC

Off-season events at seasonal places should not leak into search. Option A: filter in the RPC itself — if an event's place has an active seasonal exhibition window, only include the event if its `start_date` falls within that window. Option B: filter at the caller. Prefer A so all consumers benefit.

Scope gate: only apply this filter when the place has at least one `exhibition_type = 'seasonal'` row. Persistent places with occasional exhibitions (museums) are unaffected.

### `fetch-destinations.ts`, `fetch-enrichments.ts`

Consumers that select places for display should join `exhibitions` when filtering for "actively open" places. The helper `isPlaceInSeason()` is the canonical check.

### Detail page (`PlaceDetailShell`)

Status strip at the top of the place detail page:

- Active seasonal exhibition: `"Running through June 8 · Sat–Sun 10:30–6"` with gold accent.
- Pre-open: `"Opens April 11 · Sat–Sun 10:30–6"`.
- Off-season: `"Closed for the season — reopens next spring"` (if the latest exhibition closed <180 days ago and no newer opens) OR `"Dates TBD"` if stale.
- Multi-season place (Southern Belle): show the next upcoming season, plus a "See all seasons" collapsible list.

The existing place detail infrastructure renders exhibitions as a block. For seasonal exhibitions specifically, the status strip is more prominent than the exhibition body.

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

### Order of operations

1. **Schema migrations** — `series.exhibition_id` FK + `exhibitions.operating_schedule` JSONB. Parity: both `database/migrations/` and `supabase/migrations/`.
2. **Helper library** — `web/lib/places/seasonal.ts` with `getActiveSeasonalExhibition`, `isPlaceInSeason`, cadence-display formatter.
3. **Places to Go wire-up** — add `seasonal` category with new `has_active_seasonal_exhibition` filter primitive. Callout rules.
4. **Feed pipeline** — `fetch-destinations.ts` uses the helper. `/api/places-to-go` returns the new category.
5. **Festivals table audit + cleanup** — hard-delete rows for confirmed seasonal attractions. Verify `FestivalsSection` no longer renders them.
6. **`search_unified()` guard** — filter off-season events at seasonal places.
7. **Enrichment pipeline guards** — `hydrate_hours_google.py` + `hydrate_venues_foursquare.py` skip places with active seasonal exhibitions.
8. **Crawler conversions (parallel)** — Ren Fest, Netherworld, Stone Mountain Christmas, Southern Belle. `annual_tentpoles.py` cleanup.
9. **Normalization / taxonomy audit** — `genre_normalize.py`, `VALID_FESTIVAL_TYPES`.
10. **Pattern documentation** — `crawlers/CLAUDE.md` seasonal-destinations section.
11. **Detail page updates** — status strip for seasonal exhibitions; multi-season place handling.

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

- Ren Fest no longer appears in "The Big Stuff" festivals rail. Verified by querying the festivals table.
- Ren Fest appears in the "This Season" Places to Go category during its active window + 28d pre-open, with accurate callouts ("Running through June 8 · Sat–Sun 10:30–6").
- Netherworld collapses from 47 per-night event rows to 1 exhibition row; still surfaces correctly in the feed during its window.
- Southern Belle Farm's 4 seasons each have their own exhibition, non-overlapping, cycling correctly through the year.
- `annual_tentpoles.py` no longer emits a duplicate Ren Fest entry.
- Year rollover creates a new exhibition row, preserves history.
- `search_unified()` no longer leaks off-season events at seasonal places.
- Pattern documented so crawlers for Lake Lanier Lights, Callaway, state fairs, Burt's, Yule Forest can follow the same shape.

## Implementation parallelization

The following workstreams can proceed in parallel:
- Schema migration + helper library (foundational, blocks downstream)
- Places to Go wire-up (blocks on helper)
- Crawler conversions (each crawler is independent — Ren Fest, Netherworld, Stone Mountain, Southern Belle can run in parallel once schema is in)
- Normalization audit + enrichment guards (independent of above)
- `search_unified()` filter (independent)

Realistic sequencing: schema first, then helper + Places to Go + crawler conversions in parallel, then search_unified and polish.

## Out of scope

- Building new crawlers for Lake Lanier, Callaway, state fairs, Burt's, Buford Corn Maze, Yule Forest. Pattern is documented; these ship as time permits.
- Per-exhibition `promo_window_days` tuning (deferred until second consumer ships).
- Weather-aware seasonal recommendations (outside scope of this spec; Places to Go already handles weather).
- Multi-city cross-portal seasonal rollups.
- Feed-level contextual card during active windows (documented as follow-on).
