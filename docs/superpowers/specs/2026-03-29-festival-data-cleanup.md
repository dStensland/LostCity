# Festival Data Cleanup Spec

**Date:** 2026-03-29
**Purpose:** Audit and reclassify ~48 entities in the `festivals` table that aren't actually festivals. Clean the data before redesigning FestivalDetailView.

## Context

The `festivals` table has 148 rows. Analysis shows:
- **19 "ghosts"** — almost no data (0-1 fields), no events, no programs. Just names.
- **26 expos/cons** — single-venue hobby expos and pop culture conventions that should be events.
- **2 recurring series** — sporting events with 12-14 dates. Should be series.
- **1 venue** — Georgia International Convention Center is a place, not a festival.
- **9 single-day** — judgment calls, addressed below.

After cleanup, ~100 true festivals remain.

## Operations

### 1. Delete Ghosts (19 rows)

These have ≤1 data field, zero events, zero meaningful content. Some have orphaned programs (series rows with `festival_id` pointing here) — delete those too.

```
festivals to DELETE:
- repticon-atlanta
- african-film-festival-atlanta
- atlanta-toy-model-train-show
- atlantacon
- bellpoint-gem-show
- blade-show
- conjuration
- critical-materials-minerals-expo
- explore-newnan-coweta
- georgia-renaissance-festival
- greater-atlanta-coin-show
- lenox-square-fourth-of-july-fireworks
- shaky-knees-festival (yes — ghost record, 0 events, no desc, no img, no dates)
- southern-fried-queer-pride
- stamp-scrapbook-expo
- west-end-comedy-fest
- atl-blues-festival
- atl-doc-film-fest
- atlanta-holi
```

**Before deleting each:**
1. Check for orphaned `series` rows where `festival_id` = this ID. Delete those first (or nullify `festival_id`).
2. Check for orphaned `events` rows where `festival_id` = this ID. Nullify `festival_id` on those events (don't delete the events — they may be valid standalone).

**Note on Shaky Knees:** The current record has no description, no image, no dates, 0 events. It's a ghost. When we eventually crawl Shaky Knees properly, we'll create a real record. Don't preserve this stub.

### 2. Reclassify Expos/Cons → Events (26 rows)

These are single-venue, short-duration expos and conventions. They should exist as events in the `events` table, not as festivals.

**Migration per row:**
1. Create a new event from the festival metadata:
   - `title` = festival `name`
   - `description` = festival `description`
   - `image_url` = festival `image_url`
   - `start_date` = festival `announced_start` (if available)
   - `end_date` = festival `announced_end` (if available)
   - `category_id` = map from `primary_type` (see mapping table below)
   - `subcategory` = infer from `primary_type`
   - `ticket_url` = festival `ticket_url`
   - `website` = festival `website`
   - Set `portal_id` based on city (Atlanta portal for Atlanta events)
   - Set `is_active` = true
2. If the festival has existing events (`events.festival_id` = this ID), nullify their `festival_id` — they become standalone events.
3. If the festival has series/programs, nullify their `festival_id`.
4. Delete the festival row.

**If the festival has no `announced_start`**, create the event without dates (it'll be a stub until a crawler fills in dates). Set `start_date` = NULL or a far-future placeholder.

```
festivals to RECLASSIFY AS EVENTS:
- 50-shades-of-black-anime          (pop_culture_con → recreation)
- atlanta-bead-show                  (hobby_expo → recreation)
- atlanta-comic-convention           (pop_culture_con → recreation)
- atlanta-home-show-spring           (hobby_expo → recreation)
- atlanta-international-auto-show    (hobby_expo → recreation)
- atlanta-model-train-show           (hobby_expo → recreation, SINGLE-DAY)
- atlanta-motoring-festival          (hobby_expo → recreation)
- atlanta-orchid-show                (hobby_expo → recreation)
- atlanta-pen-show                   (hobby_expo → recreation)
- atlanta-sci-fi-fantasy-expo        (convention → recreation)
- collect-a-con-atlanta-fall         (hobby_expo → recreation)
- collect-a-con-atlanta-spring       (hobby_expo → recreation)
- conyers-kennel-club-dog-show       (hobby_expo → recreation)
- daggercon                          (pop_culture_con → recreation)
- furry-weekend-atlanta              (pop_culture_con → recreation)
- georgia-mineral-society-show       (hobby_expo → recreation)
- georgia-vegfest                    (hobby_expo → food_drink)
- healing-psychic-fair-atlanta       (hobby_expo → recreation)
- intergalactic-bead-show-atlanta    (hobby_expo → recreation)
- international-woodworking-fair     (hobby_expo → recreation)
- momocon                            (pop_culture_con → recreation)
- original-sewing-quilt-expo         (hobby_expo → recreation)
- southeast-reptile-expo             (hobby_expo → recreation)
- southeastern-stamp-expo            (hobby_expo → recreation)
- world-oddities-expo-atlanta        (hobby_expo → recreation)
- wreckcon                           (pop_culture_con → recreation)
```

### 3. Reclassify Recurring Series → Series (2 rows)

These have many events that are recurring dates of the same thing (race weekends), not sub-events of a festival.

```
festivals to RECLASSIFY AS SERIES:
- monster-energy-ama-supercross      (14 events → series with 14 dates)
- nascar-at-atlanta-motor-speedway   (12 events → series with 12 dates)
```

**Migration per row:**
1. Create a `series` row:
   - `title` = festival `name`
   - `slug` = festival `slug`
   - `description` = festival `description`
   - `image_url` = festival `image_url`
   - `series_type` = 'recurring'
   - `is_active` = true
2. Update all `events` where `festival_id` = this ID: set `series_id` = new series ID, nullify `festival_id`.
3. Delete orphaned festival programs (series with `festival_id` = this ID).
4. Delete the festival row.

### 4. Delete Venue Record (1 row)

```
festivals to DELETE (venue):
- georgia-international-convention-center
```

Check if this place already exists in `places` table. If not, create it. Then delete the festival row (handle orphaned programs/events first).

### 5. Single-Day Judgment Calls (9 rows)

These are flagged as single-day (`announced_start` == `announced_end`). Review each:

**Keep as festivals** (community/cultural events with festival identity):
- `cherry-blossom-festival` — annual cultural festival, 2 events. Keep.
- `east-atlanta-strut` — annual community festival, 3 events. Keep.
- `big-shanty-festival` — annual community festival, 7 events. Keep.
- `panda-fest-atlanta` — cultural festival, 4 events, 4 programs. Keep.
- `norcross-irish-fest` — community festival, 2 programs. Keep.
- `atlanta-ice-cream-festival` — food festival, 2 events. Keep.
- `pigs-and-peaches-bbq-festival` — food festival, 2 events. Keep.

**Reclassify as events:**
- `atlanta-model-train-show` — already in the expo list above.
- `georgia-technology-summit` — single-day conference, 0 events. → Event.
- `render-atl` — tech conference, 11 events. **Keep as festival** despite single-day flag (the date data is likely wrong — a tech conference with 11 events is multi-day).

**Action:** Fix `render-atl` dates if wrong (likely multi-day). Reclassify `georgia-technology-summit` as event.

```
festivals to RECLASSIFY AS EVENTS (from single-day):
- georgia-technology-summit          (conference → recreation)
```

```
festivals to FIX DATES:
- render-atl                         (verify actual dates — likely multi-day)
```

## Category Mapping

When creating events from festivals, map `primary_type` to event `category_id`:

| Festival `primary_type` | Event `category_id` | Notes |
|------------------------|---------------------|-------|
| `hobby_expo` | `recreation` | |
| `pop_culture_con` | `recreation` | |
| `convention` | `recreation` | |
| `trade_show` | `recreation` | |
| `conference` | `recreation` | |
| `athletic_event` | `sports` | For Supercross/NASCAR series |

## Cleanup Checklist

For the executing agent:

- [ ] Back up the `festivals` table before making changes
- [ ] Delete ghosts (19) — handle orphaned series/events first
- [ ] Reclassify expos/cons as events (26 + 1 from single-day = 27)
- [ ] Reclassify recurring series (2) — create series, reassign events
- [ ] Delete venue record (1) — verify places table
- [ ] Fix Render ATL dates if incorrect
- [ ] Verify no orphaned `series.festival_id` or `events.festival_id` references remain
- [ ] Run `SELECT count(*) FROM festivals` — should be ~100 (148 - 19 ghosts - 27 expos - 2 series - 1 venue = 99)
- [ ] Verify festival detail pages still load for remaining festivals
- [ ] Write all changes as a Supabase migration file

## Post-Cleanup

After this migration runs, the festival data will be clean enough to inform the FestivalDetailView redesign. The design conversation will resume with accurate data about what true festivals look like.

Expected post-cleanup distribution:
- ~100 true festivals
- ~39 with 1+ events (mostly 1-5, max ~33)
- ~52 with 0 events (metadata-only — future or no crawled schedule)
- Max programs per festival: 4
- The detail page must work beautifully for the 0-event case
