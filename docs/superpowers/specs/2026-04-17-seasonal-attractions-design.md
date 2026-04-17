# Seasonal Attractions — Design Spec

**Date**: 2026-04-17
**Status**: Design
**Author**: Claude + coach

## Problem

"Festival" in the current data model and feed implies a concentrated, time-bounded program — a weekend, maybe a week. Countdown language ("Starts in 3 days") assumes that shape. But a growing class of Atlanta destinations does not behave that way:

- **Georgia Renaissance Festival** — 8 weekends over April–June
- **Netherworld Haunted House** — nightly, September–November
- **North Georgia State Fair** — ~2 weeks
- **Pumpkin patches / corn mazes** — October weekends
- **Lake Lanier Magical Nights of Lights** — Nov–Jan, nightly

These are seasonal-only destinations. The place and the season are inseparable — the Ren Fest grounds are a field that only exists as the festival during April–June. Netherworld is a haunted attraction that only operates in fall. A pumpkin patch is a farm that opens as a patch in October.

The current model forces these into `place_type: "festival"` and into the "The Big Stuff" festivals rail with countdown urgency. The user's mental model is "go any weekend this spring, pick a good weather day" — not "don't miss this weekend." The festivals rail is the wrong home.

This is distinct from **persistent destinations with seasonal programming** (e.g., Atlanta Botanical Garden running Garden Lights in winter). Those are already handled well via the exhibitions model — the place is always open, the exhibition has run dates.

## Goal

Introduce **seasonal attractions** as a first-class concept: destinations whose existence is bounded by a season. Model them accurately, surface them where users expect to find destinations, and stop forcing festival urgency onto multi-week seasonal runs.

## Non-goals

- Reclassifying every `place_type: "festival"` row. Scope is seasonal-only destinations; one-off festival venues can stay as-is.
- Building a new feed section. The existing Places to Go infrastructure is the right home.
- Handling persistent places with seasonal programming (Botanical Garden + Garden Lights). Those are exhibitions at a persistent place — already handled.
- Shipping other seasonal crawlers (Netherworld, state fair, pumpkin patches). Pattern is documented; those crawlers land when someone builds them.

## Architecture: tri-level model

The design rests on a clean three-tier split that falls naturally out of the existing schema:

1. **Place** (`place_type: "seasonal_attraction"`) — the seasonal venue, with run-window metadata.
2. **Exhibitions** — persistent attractions *at* the place that run throughout the season (jousting, artisan market, haunted trails, light installations, hayrides, corn maze). No run dates — they're there every open day.
3. **Events** — dated programming inside the season (themed weekends, special nights, special shows).

This mirrors the existing museum model — Place (High Museum) + Exhibition (a show with run dates) + Event (opening night). For seasonal attractions, the place itself carries the run window; exhibitions inside it are "there every open day"; events are the dated programming.

## Section 1 — Data model

Add to `places`:

| Column | Type | Purpose |
|---|---|---|
| `season_start` | `date` | First day the attraction opens this season (nullable — only set for seasonal_attraction) |
| `season_end` | `date` | Last day it's open (nullable) |

Add to `place_type` allowed values:
- `"seasonal_attraction"`

**Reuse existing `places.hours_json`** — the per-day operating hours during the season. For seasonal_attractions, "hours" unambiguously means "hours when in season." Open days (cadence) are derived at render time from which days in `hours_json` have non-null entries. No separate `season_cadence` or `season_hours` column.

**`place_type: "festival"` is not removed** — left as-is for actual multi-use festival venues (if any). A separate cleanup pass can audit. Scope here is only adding the new type and migrating known seasonal-only destinations.

**Year rollover**: the crawler writes `season_start`/`season_end` each run. When one season closes and source-site data for next season appears, the crawler overwrites with next year's dates. Self-healing, no `next_season_*` fields needed.

## Section 2 — Crawler signal

### Ren Fest crawler (`crawlers/sources/georgia_ren_fest.py`)

**`PLACE_DATA` changes:**

```python
"place_type": "seasonal_attraction",          # was "festival"
"spot_type": "seasonal_attraction",            # was "festival"
"season_start": <parsed from /themed-weekends <p class="dates">>,
"season_end":   <parsed from same>,
"hours_json": {                                # existing field — season hours
    "saturday": {"open": "10:30", "close": "18:00"},
    "sunday":   {"open": "10:30", "close": "18:00"},
    # Memorial Day Monday handled via per-weekend event; base cadence is Sat-Sun
},
```

**Drop `scrape_season_event()`** — the pseudo-event spanning the full season is redundant once `season_start/end` live on the place. Removes a source of duplication from the festivals rail.

**Keep `scrape_themed_weekends()`** — the 8 themed weekends are real dated programming and belong as events.

### Pattern documentation (`crawlers/CLAUDE.md`)

Add a section "Seasonal-only destinations." Covers:
- Use `place_type: "seasonal_attraction"` for haunted houses, pumpkin patches, state fairs, seasonal light shows, seasonal-only festival grounds.
- Set `season_start`/`season_end` + populate `hours_json` with per-day operating hours, parsed from source site.
- Create exhibitions for persistent attractions within the season (hayrides, corn maze, jousting, artisan market, haunted trails, light installations).
- Create events only for *dated* programming inside the season (themed nights, special shows, opening/closing events).
- **Never** emit a season-window pseudo-event. The place carries the season.

### Exhibition capture follow-on

Separate workstream (not blocking this design): the Ren Fest crawler currently doesn't capture Jousting, Artisan Market, 15 Stages, Costume Contests as exhibitions. Per the first-pass rule, it should. Handle after the place model lands.

## Section 3 — Feed surfacing

**Do not build a new feed section.** Extend the existing Places to Go section instead.

### New Places to Go category

Add to `web/lib/places-to-go/constants.ts`:

```ts
{
  key: "seasonal",
  label: "Only Here For Now",        // final label TBD during implementation
  placeTypes: ["seasonal_attraction"],
  accentColor: "#FFD93D",             // gold — signals time-bounded
  iconType: "calendar",
}
```

### Filter logic

At the query layer (`/api/places-to-go` or the equivalent scoring/fetch path), seasonal_attraction places are filtered to those where:

```
season_start IS NOT NULL
AND season_end IS NOT NULL
AND (
  today BETWEEN season_start AND season_end            -- active
  OR (season_start - today) BETWEEN 0 AND 28           -- pre-open, ≤28d
  OR (today - season_end) BETWEEN 1 AND 7              -- grace, skip: hidden
)
```

Off-season attractions are not surfaced in the feed. They remain searchable via place detail / spots pages.

### Callout rules (seasonal category)

Add to `web/lib/places-to-go/callouts.ts`:

| Condition | Callout |
|---|---|
| `today > season_end - 7 days` | `"Final weekend"` |
| `today BETWEEN season_start AND season_end` | `"Running through <month> <day>"` |
| `season_start > today` | `"Opens <month> <day>"` |
| Always (append) | `"<Cadence display> <hours>"` — e.g. `"Sat–Sun 10:30–6"` |

The `<Cadence display>` is derived at render time from `hours_json`:
- Days with non-null hours = open days.
- Contiguous day ranges collapse to short form: `{sat, sun}` → `"Sat–Sun"`, `{fri, sat, sun}` → `"Fri–Sun"`, all 7 days → `"Every day"`, all non-weekday rows identical → `"Nightly"` or `"Every day"` depending on content.
- Common hours collapse to single range: `"10:30–6"`. Mixed hours per day → just `"Sat–Sun"` without hours suffix (defer to detail page).

### `is_open` logic

For seasonal_attraction cards, `is_open` is true when:
- Today is within `season_start`..`season_end`
- Today's day-of-week has non-null hours in `hours_json`
- Current time is within that day's open/close window

Otherwise false. Note: the base `is_open` logic for non-seasonal places already uses `hours_json` — this just adds the season_start/end gate on top.

### Card shape

No changes to `PlacesToGoCard`. Image, name, neighborhood, callouts, is_open, event_count — all existing fields cover the need. `event_count` = count of upcoming themed-weekend events during the season (signals programmatic depth).

### Festivals rail cleanup

`FestivalsSection` ("The Big Stuff") stops showing Ren Fest and class automatically — they're no longer `place_type: "festival"`, so the festivals query drops them. No code changes in the festivals rail; verify the cut is clean during implementation.

## Section 4 — Lifecycle / transition states

Timeline for one seasonal_attraction (Ren Fest example, 2026 season Apr 11–Jun 8):

| Window | Feed presence | Card language | `is_open` |
|---|---|---|---|
| Jul 2025 – Mar 13 2026 (off-season, >28d pre-open) | Hidden | — | false |
| Mar 14 – Apr 10 (pre-open, ≤28d) | Seasonal category | "Opens April 11 · Sat–Sun 10:30–6" | false |
| Apr 11 – Jun 1 (active) | Primary seasonal slot | "Running through June 8 · Sat–Sun 10:30–6" | true on Sat/Sun 10:30–6 |
| Jun 2 – Jun 8 (final week) | Urgency accent | "Final weekend · Sat–Sun 10:30–6" | true Sat/Sun 10:30–6 |
| Jun 9 – Jun 15 (grace) | Hidden | — | false |
| Jun 16+ (off-season) | Hidden until next crawl writes 2027 dates | — | false |

**Year rollover**: when the Ren Fest source site publishes 2027 season dates (typically late fall 2026), the next crawl overwrites `season_start`/`season_end` with 2027 values. Attraction reappears ~28d before 2027 opening. Self-healing.

## Section 5 — Place detail page

No new components. `PlaceDetailShell` already exists at `/{portal}/spots/[slug]`. Adjustments:

- **Status strip / hero badge** (gold accent for seasonal_attraction):
  - In season: `"Running through June 8 · Sat–Sun 10:30–6"`
  - Pre-season: `"Opens April 11, 2026 · Sat–Sun 10:30–6"`
  - Off-season: `"Closed for the season — reopens next spring"` (or `"reopens April 2027"` if next dates known)
- **Hours display**: season-aware. Not "Open now / Closed" at the top-level — "Running this weekend" or "Closed — reopens April 11."
- **Exhibitions section**: uses existing exhibition infrastructure. Once captured, Jousting / Artisan Market / 15 Stages / Costume Contests render as "What's at the festival."
- **Events section**: themed weekends, existing treatment.

## Section 6 — Migration and rollout

Order of operations:

1. **Schema migration** — add `season_start` (date) and `season_end` (date) to `places`. Extend place_type check constraint / allowed list to include `"seasonal_attraction"`. Parity: both `database/migrations/` and `supabase/migrations/`.
2. **Ren Fest crawler conversion** — `PLACE_DATA` update, drop `scrape_season_event()`. End-to-end proof.
3. **One-time reclassification SQL** — update the Ren Fest place row: `place_type = 'seasonal_attraction'`, seed `season_start/end` + `hours_json`. Other `place_type = 'festival'` rows left untouched (out of scope).
4. **Places to Go wire-up** — add the `seasonal` category config, callout rules, and in-season/pre-open filter logic.
5. **Festivals API verification** — confirm `/api/festivals/upcoming` no longer returns Ren Fest (should be automatic via place_type change).
6. **Place detail page** — status strip + hours + badge treatment for seasonal_attraction.
7. **Pattern documentation** — `crawlers/CLAUDE.md` update for future seasonal crawlers.
8. **Exhibition backfill** (follow-on, separate PR) — Ren Fest crawler captures jousting/market/stages as exhibitions.

## Out of scope

- Netherworld, state fair, pumpkin patch crawlers (build separately, reuse the pattern).
- Auditing and reclassifying other `place_type: "festival"` rows.
- Weather-aware or calendar-integrated season recommendations ("Garden Lights on Saturday? Good weather!"). The callouts system already handles weather match — extensions are incremental.
- Multi-city seasonal clusters (e.g., cross-portal rollup of "fall in the South"). Portal-scoped for now.

## Open questions

1. **Label for the seasonal category**: "Only Here For Now" is evocative but wordy. "Seasonal" is bland. "This Season" reads well during clusters but awkward when only one item is active. Pick during implementation — minor.
2. **Grace period length**: 7 days post-close, currently. Too long? Too short? Check behavior with first real season end.
3. **Pre-open window**: 28 days currently. For seasonal clusters with hype cycles (Oct haunted houses), a longer pre-open window may be warranted. Start conservative.

## Success criteria

- Ren Fest no longer appears in "The Big Stuff" festivals rail during April–June.
- Ren Fest appears in the seasonal Places to Go category during the active window + 28d pre-open, with accurate callouts ("Running through June 8 · Sat–Sun 10:30–6").
- Ren Fest place detail page shows seasonal status, not misleading "Open now / Closed" language.
- Crawler runs cleanly without emitting a season-window pseudo-event.
- Pattern documented so the next seasonal crawler (whoever builds it) follows the same model.
