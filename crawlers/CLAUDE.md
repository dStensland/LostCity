# CLAUDE.md - Crawlers

This file provides guidance to Claude Code when working with the crawlers pipeline.

## Multi-Agent Coordination

When multiple Claude Code sessions work in parallel, check `ACTIVE_WORK.md` in the repo root before starting. It tracks which agent is working on what and which files/directories are claimed. Don't modify files claimed by another agent — tell the user if you need to.

See `DEV_PLAN.md` for the active execution status. `BACKLOG.md` at the repo root is being wound down — do not add new items there.

## Core Philosophy

**We capture DESTINATIONS, not just events.** Every crawler should ensure the venue/spot it crawls is fully represented in our database as a place people would want to visit, regardless of whether it currently has scheduled events.

This means:
- **Restaurants, bars, coffee shops, breweries, entertainment venues, parks, galleries, theaters, music venues, nightclubs, sports bars, food halls, bookstores, trails, campgrounds, rec centers** — any place people would want to go out to in the city
- Organizations that throw events (arts orgs, community groups, sports teams, etc.)
- Programs and structured activities (swim lessons, summer camps, rec leagues, pottery classes)
- The venue record itself is valuable data — name, address, neighborhood, hours, vibe tags, type, lat/lng
- Events are additional value on top of the destination, not the only reason to have it

When building a new crawler or importing data, always ask: "Would someone visiting this city want to know about this place?" If yes, it belongs in our database as a venue/spot even if it has zero upcoming events.

### CRITICAL: Capture Everything On The First Pass

**This is the single most violated rule in the codebase. We have built 20+ enrichment scripts to backfill data that crawlers should have captured originally. Every enrichment script is a failure of the crawler that made it necessary.**

**Do not build a crawler that only grabs events and ignores everything else on the page.** Every time we touch a venue's website, we should extract ALL available signal in one pass. Going back later for enrichment is expensive, error-prone, and creates a maintenance burden that grows with every source.

When a crawler visits a venue page, look for and capture:

1. **Events** — the obvious one, but not the only one
2. **Programs** — structured activities with sessions, age ranges, registration (swim lessons, camps, classes, leagues). These are NOT events — they go in the `programs` table if it exists, or as events with `age_min`/`age_max` and appropriate series grouping.
3. **Recurring programming** — weekly trivia, DJ nights, open mic, karaoke, brunch, yoga. These are `series` with `is_recurring: True`. If the page has a "Weekly Events" or "Regular Programming" section, grab it.
4. **Specials & deals** — happy hours, daily food/drink specials, brunch deals, industry nights. These go in `place_specials` (formerly `venue_specials`), NOT events. Look for "Specials", "Happy Hour", "Daily Deals" sections on venue websites.
5. **Hours of operation** — opening/closing times by day. Store in `places.hours` as structured JSON.
6. **Venue metadata** — description, hero image (og:image), vibe tags, cuisine type, price range, parking info, reservation links, social media handles.
7. **Menu highlights** — not the full menu, but categories that inform vibes (craft cocktails, natural wine, vegan-friendly, etc.)

The goal: after a single crawl, the venue record should be complete enough that someone could decide whether to visit without ever going to the venue's own website. Don't leave fields empty that are sitting right there on the page.

### First-Pass Validation Checklist

Before submitting a new crawler, verify it captures everything available:

- [ ] `PLACE_DATA` has all fields filled (name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, website, vibes)
- [ ] `image_url` set from og:image or hero image on the page
- [ ] `description` set from meta description or about section
- [ ] Hours captured if visible on the page
- [ ] Recurring events grouped into series (not individual events for each occurrence)
- [ ] Specials captured in `place_specials` if the page has a specials/happy hour section
- [ ] Programs captured with age ranges if the source has structured classes/lessons
- [ ] No fields left empty that are available on the page

**If you're building an enrichment script, stop and ask: why didn't the crawler capture this?** The answer is almost always "it should have." Fix the crawler instead.

**Always crawl original sources, never curators.** If an event exists at Alliance Theatre, crawl alliancetheatre.org -- not ArtsATL or Creative Loafing. Editorial aggregators (ArtsATL, Nashville Scene, Discover Atlanta, AccessAtlanta, tourism boards) duplicate data with lower quality. Treat them as discovery-only research inputs for gap finding; they are not canonical event sources. The only allowed aggregators are ticketing platforms (Ticketmaster, Eventbrite) that cover venues without their own calendars.

**Never create events for permanent attractions or daily operations.** "Play at the Museum", "Summit Skyride", "Mini Golf" are not events -- they mean the place is open. Only crawl actual programmed events (workshops, performances, festivals, special exhibitions with dates).

**`is_all_day` should only be `True` when the event is genuinely all-day** (festivals, multi-day conventions, outdoor markets). Never infer it from a missing start_time -- a missing time just means we couldn't parse it.

## Seasonal-only Destinations

Destinations that exist **only during their season** (haunted houses, pumpkin patches, state fairs, seasonal light shows, Ren Fest) use the exhibitions-as-season-carrier pattern. The place persists year-round as a searchable record; the **exhibition** carries the season window.

1. **Place**: real `place_type` (`festival_grounds`, `farm`, `fairgrounds`, `haunted_attraction`, `garden`). Set `is_seasonal_only: True` when the place literally only exists during the season (Ren Fest grounds, Netherworld). Leave `is_seasonal_only: False` (default) for year-round places with seasonal overlays (Atlanta Botanical Garden + Garden Lights).
2. **Exhibition**: one row per season with `exhibition_type: "seasonal"`, `opening_date`/`closing_date` from the source site, `operating_schedule` JSON with per-day hours, year-scoped slug: `<place-slug>-seasonal-<year>` or `<place-slug>-<season-name>-<year>`.
3. **Events**: themed dated programming (themed weekends, concerts, special nights) linked via `events.exhibition_id` → the seasonal exhibition.
4. **Series** (Shape B only): recurring rituals within the season (nightly parade, fireworks) use `series.exhibition_id`.

**Never** emit a season-window pseudo-event in the `events` table. The exhibition carries the window.

### Shape taxonomy

| Shape | Examples | Structure |
|---|---|---|
| A. Continuous nightly, no sub-programming | Netherworld, Lake Lanier Lights, Callaway Lights, Burt's Pumpkin | 1 exhibition, 0 events |
| B. Season + recurring rituals | Stone Mountain Christmas | 1 exhibition + N series (via `series.exhibition_id`) |
| C. Themed dated weekends | Ren Fest, Buford Corn Maze | 1 exhibition + N events (via `events.exhibition_id`) |
| D. Fairgrounds | NG State Fair, Georgia National Fair | 1 exhibition + 50-150 events |
| E. Multi-season single place | Southern Belle, Yule Forest | N exhibitions (one per season), possibly overlapping |
| F. Persistent place + seasonal overlay | ABG + Garden Lights | `is_seasonal_only=False`, year-round place + seasonal exhibition(s) |

### Lifecycle rules

- **Year rollover**: next year's data creates a NEW exhibition row (year-scoped slug). Never overwrite last year's — historical rows are features.
- **`is_active` trap**: use `closing_date` to truncate a cancelled season mid-run; never `is_active = FALSE`. `is_active` is for "this row is data junk," not "the season ended early."
- **Series invariant**: when `series.exhibition_id` is set, `series.place_id` must equal `exhibitions.place_id` for the referenced exhibition.
- **Slug uniqueness**: `exhibitions.slug` is UNIQUE — year-scope all seasonal slugs.
- **Enrichment skip**: seasonal-only places should be excluded by `hydrate_hours_google.py` and `hydrate_venues_foursquare.py` to prevent silent NULL overwrites of season-hours-on-exhibition.

Reference implementations:
- Shape A (continuous nightly): `crawlers/sources/netherworld.py`, `folklore_haunted.py`, `paranoia_haunted.py`, `nightmares_gate.py`
- Shape C (themed weekends): `crawlers/sources/georgia_ren_fest.py`

Reference spec: `docs/superpowers/specs/2026-04-17-seasonal-attractions-design.md`.

## Project Structure

```
crawlers/
├── main.py                # Orchestration — source registry, parallel execution
├── db/                    # Supabase operations package (places, events, exhibitions, place_specials, programs, sources, etc.)
├── dedupe.py              # Content hash deduplication
├── config.py              # Environment config (Supabase keys, API keys)
├── tag_inference.py       # Auto-tagging from event/venue data
├── extract.py             # AI-powered extraction for unstructured sources
├── series.py              # Event series linking (recurring shows, residencies)
├── posters.py             # TMDB poster fetching for film events
├── artist_images.py       # Spotify artist image + genre fetching for music events
├── sources/               # One file per source (~1,000+ crawlers)
│   ├── marys_bar.py       # Single-venue bar (Playwright pattern)
│   ├── terminal_west.py   # Music venue (BeautifulSoup pattern)
│   ├── ticketmaster.py    # API aggregator pattern
│   ├── eventbrite.py      # API aggregator pattern
│   └── ...
└── CRAWLER_STRATEGY.md    # Tier system and city launch playbook
```

## Commands

```bash
# Run a single crawler
python3 main.py --source marys-bar --dry-run

# Run all active sources
python3 main.py --dry-run

# Run with debug logging
LOG_LEVEL=DEBUG python3 main.py --source marys-bar --dry-run

# Intentional production write run
python3 main.py --allow-production-writes
```

## Key Database Operations (`crawlers/db/` package)

- `get_or_create_place(venue_data)` — Finds by slug or name, creates if missing. Returns place ID.
- `insert_event(event_data, series_hint=None)` — Inserts event with auto-tagging, poster fetching, genre inference. Pass `series_hint` dict to link into a series (see Series Grouping section).
- `find_event_by_hash(content_hash)` — Dedup check before inserting.
- `generate_content_hash(title, venue_name, date)` — From dedupe.py, creates MD5 hash.

## Crawler Pattern

Every crawler exports a `crawl(source: dict) -> tuple[int, int, int]` function returning `(events_found, events_new, events_updated)`.

### Place Data (CRITICAL — always complete)

```python
PLACE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",              # Unique, used for dedup
    "address": "123 Main St",
    "neighborhood": "Midtown",         # Important for filtering
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,                    # Required — auto-populates places.location (PostGIS)
    "lng": -84.3831,
    "place_type": "bar",               # bar, restaurant, music_venue, etc. (renamed from venue_type)
    "spot_type": "bar",                # Used for spot filtering in the app
    "website": "https://venue.com",
    "vibes": ["dive-bar", "live-music", "late-night"],  # Discovery tags
}

# Note: as of 2026-03 the `venues` table was renamed to `places` and `venue_type`
# to `place_type`. Use `db.get_or_create_place(PLACE_DATA)`. Older crawlers may
# still pass the variable as `VENUE_DATA` — both work, but new code should use
# the new names.
```

### Place Types (the `place_type` taxonomy)

bar, restaurant, music_venue, nightclub, comedy_club, gallery, museum, brewery,
coffee_shop, bookstore, library, arena, cinema, park, garden, food_hall,
farmers_market, convention_center, venue, organization, festival, church,
event_space, sports_bar, distillery, winery, hotel, rooftop, coworking,
record_store, studio, fitness_center, community_center, college, university

## Data Health Requirements

Every crawler and import should produce data that meets our health targets. See `CRAWLER_STRATEGY.md` for full criteria. Run `python3 data_health.py` to check current scores.

### Minimum Place Data (when creating via `get_or_create_place`)

| Field | Required? | Notes |
|-------|-----------|-------|
| name | Yes | Real venue name, never an address |
| slug | Yes | Auto-generated from name |
| address | Yes | Full street address |
| city, state | Yes | |
| lat, lng | Yes | Both or neither. Critical for maps |
| neighborhood | Yes | From coordinates or manual |
| place_type | Yes | From valid taxonomy above (renamed from venue_type) |
| website | Strongly preferred | Enables image/description enrichment |
| image_url | Preferred | From og:image or Google Places |

### Minimum Event Data (when creating via `insert_event`)

| Field | Required? | Notes |
|-------|-----------|-------|
| title | Yes | Validated by `validate_event_title()` |
| start_date | Yes | YYYY-MM-DD format |
| source_url | Yes | Link to original source |
| place_id | Yes | From `get_or_create_place()` |
| category | Yes | From valid category list |
| start_time | Strongly preferred | Never infer is_all_day from missing time |
| description | Preferred | From source page or LLM extraction |
| image_url | Preferred | From source, OMDB (film), or Deezer (music) |

### Enrichment Scripts

| Script | Purpose |
|--------|---------|
| `venue_enrich.py` | Fill coordinates, neighborhoods, vibes via Google Places |
| `scrape_venue_images.py` | Scrape hero images from venue websites |
| `fetch_venue_photos_google.py` | Google Places photos for venues without websites |
| `classify_venues.py` | Rules-based venue type classification and junk cleanup |
| `data_health.py` | Run full health diagnostic across all entity types |

## Series Grouping (Recurring Events)

**When to use series:** Any time a source produces multiple events that are instances of the same recurring activity, group them into a series. This prevents feed spam (56 individual volunteer shifts → 8 series cards with "See all dates").

### Identifying Series Candidates

Look for these patterns when building or reviewing a crawler:
- **Volunteer shifts** — Same shift type repeating daily/weekly (e.g., "Morning Warehouse Sort" every weekday)
- **Recurring shows** — Weekly trivia, karaoke, open mic, DJ nights
- **Class series** — Yoga, cooking, art classes that repeat on a schedule
- **Festival programming** — Multiple events under one festival umbrella

### Using `series_hint`

Pass a `series_hint` dict to `insert_event()` to auto-link events into a series:

```python
series_hint = {
    "series_type": "recurring_show",   # recurring_show, class_series, festival_program, film, other
    "series_title": "Tuesday Trivia",  # Shared across all instances — this is the series name
    "frequency": "weekly",             # daily, weekly, biweekly, monthly, irregular
    "day_of_week": "tuesday",          # Optional — for weekly/biweekly series
}

insert_event(event_record, series_hint=series_hint)
```

### Series Types

| Type | Use For |
|------|---------|
| `recurring_show` | Weekly/daily recurring events (trivia, karaoke, volunteer shifts, open mic) |
| `class_series` | Classes and workshops that repeat (yoga, cooking, art) |
| `festival_program` | Events under a festival umbrella (auto-detected by `get_festival_source_hint`) |
| `film` | Film screenings (auto-linked by TMDB poster fetcher) |
| `other` | Anything else that repeats |

### Key Rules

- **`series_title` must be the SAME across all instances.** "Tuesday Trivia" not "Tuesday Trivia - Feb 18" — the date is already on the event.
- **Never use the event title as series_title for festival programs** — that creates one series per event. Use the festival/program name.
- **Each unique shift/show at each unique venue = its own series.** "Morning Sort at East Point" and "Morning Sort at Marietta" are separate series.
- **Set `is_recurring: True`** on the event record when it's part of a series with a predictable schedule.
- **Auto-detection fallback:** If `is_recurring=True` but no `series_hint` is passed, `db.insert_event` auto-creates a series using the event title. Explicit hints are better.

### VolunteerHub Pattern

Multiple nonprofits use VolunteerHub (`volunteerhub.com/internalapi/volunteerview/view/index`) for volunteer scheduling. When you see a VolunteerHub-powered calendar:

1. Hit the API directly instead of scraping HTML
2. Group repeating shifts into series by shift-type + location
3. Each shift instance keeps its own VolunteerHub registration URL as `ticket_url`

## Source Activation

Sources must exist in the `sources` database table with `is_active = true` to run. The `main.py` auto-discovers crawler files and maps them to source slugs. To activate a new crawler:

1. Create the file in `sources/`
2. Register/activate in the sources table
3. Validate with `python3 main.py --source <slug> --dry-run`, then use `--allow-production-writes` only for an intentional write run

## Atlanta Focus Areas for Bars/Nightlife

Priority neighborhoods for coverage:
- **Little Five Points** — The Porter, Elmyr, Vortex, The EARL
- **East Atlanta Village** — Mary's, The Glenwood, Flatiron
- **Edgewood Ave** — Church, Mother, Noni's, Sound Table
- **Virginia-Highland** — Atkins Park, Dark Horse, Moe's & Joe's
- **Midtown** — Blake's, Ten, Woofs
- **Old Fourth Ward / Poncey-Highland** — Sister Louisa's, Ladybird, Bookhouse Pub
- **Buckhead** — Havana Club, Johnny's Hideaway
- **Decatur** — Brick Store Pub, Leon's Full Service, Square Pub, Victory Sandwich Bar
- **West Midtown / Westside** — Ormsby's, Painted Duck, Monday Night Brewing
- **Inman Park** — Barcelona, Wrecking Bar
- **Downtown** — Max Lager's, Sidebar, Der Biergarten

## Recent Architectural Shifts (as of 2026-04-14)

When building or updating crawlers, be aware these landed recently:

- **`venues` → `places` rename.** The destination table is now `places`. `venue_type` → `place_type`. `active` → `is_active`. Use `db.get_or_create_place(venue_data)` — the function name was renamed but its parameter is still named `venue_data` internally for backward compatibility. Other helpers in `crawlers/db/places.py` also retain `venue_` prefixes (e.g., `_normalize_venue_name`, `get_venue_by_id`, `upsert_venue_feature`). **Do not refactor these as drive-by work** — they are intentionally preserved to keep the internal callsite churn small. Only use the new names in new call sites. New crawlers should use `PLACE_DATA` as the dict variable name, but `VENUE_DATA` still works. **Note:** `venue_specials` was renamed to `place_specials` in the same 2026-03 refactor (migration `20260328200001_places_final_rename.sql`), and its `venue_id` column became `place_id`. All crawler code is already on the new name.
  - **FK renames on related tables.** All FKs on events and related tables were also renamed: `events.venue_id` → `events.place_id`, `series.venue_id` → `series.place_id`, `venue_specials.venue_id` → `place_specials.place_id`. New crawler code that writes events must use `place_id`, not `venue_id`.
- **Exhibitions are first-class and cross-vertical — create them in the `exhibitions` table, never as events.** If you crawl a museum, gallery, aquarium, zoo, historic site, interpretive center, or any other destination with persistent or run-dated experiences, use `exhibition_utils.py` to create exhibitions. This is NOT an Arts-portal-only pattern — the Family portal crawling the Georgia Aquarium should be creating exhibition records for `Cold Water Quest`, the Adventure portal crawling a state park should be creating exhibition records for interpretive center displays, and so on. Events related to an exhibition (opening nights, artist talks, guided tours, feedings, walkthroughs) should set `events.exhibition_id` to link back to the parent exhibition — the FK landed in commit `838b9052` and is live. **Do not set `content_kind='exhibit'` on new events** — it's deprecated (see `crawlers/ARCHITECTURE.md` and commit `89026d9b`); the feed filter on it remains only for legacy rows pending migration.
- **First-pass capture rule still applies.** Capture specials, hours, programs, and venue metadata in the same pass. The places refactor did not change this — every enrichment script is still a crawler failure.
- **Portal attribution is mandatory.** `sources.owner_portal_id` must be set; events inherit `portal_id` via trigger. Don't bypass this when seeding test data.
- **Programs are a real entity.** If a venue offers structured classes/lessons/camps with sessions and registration, those are programs (or events with `series_hint`), not loose events. See the Series Grouping section above.
