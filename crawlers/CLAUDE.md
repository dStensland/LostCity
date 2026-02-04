# CLAUDE.md - Crawlers

This file provides guidance to Claude Code when working with the crawlers pipeline.

## Core Philosophy

**We capture DESTINATIONS, not just events.** Every crawler should ensure the venue/spot it crawls is fully represented in our database as a place people would want to visit, regardless of whether it currently has scheduled events.

This means:
- **Restaurants, bars, coffee shops, breweries, entertainment venues, parks, galleries, theaters, music venues, nightclubs, sports bars, food halls, bookstores** — any place people would want to go out to in the city
- Organizations that throw events (arts orgs, community groups, sports teams, etc.)
- The venue record itself is valuable data — name, address, neighborhood, hours, vibe tags, type, lat/lng
- Events are additional value on top of the destination, not the only reason to have it

When building a new crawler or importing data, always ask: "Would someone visiting this city want to know about this place?" If yes, it belongs in our database as a venue/spot even if it has zero upcoming events.

**Always crawl original sources, never curators.** If an event exists at Alliance Theatre, crawl alliancetheatre.org -- not ArtsATL or Creative Loafing. Editorial aggregators (ArtsATL, Nashville Scene, Discover Atlanta, AccessAtlanta, tourism boards) duplicate data with lower quality. The only allowed aggregators are ticketing platforms (Ticketmaster, Eventbrite) that cover venues without their own calendars.

**Never create events for permanent attractions or daily operations.** "Play at the Museum", "Summit Skyride", "Mini Golf" are not events -- they mean the place is open. Only crawl actual programmed events (workshops, performances, festivals, special exhibitions with dates).

**`is_all_day` should only be `True` when the event is genuinely all-day** (festivals, multi-day conventions, outdoor markets). Never infer it from a missing start_time -- a missing time just means we couldn't parse it.

## Project Structure

```
crawlers/
├── main.py                # Orchestration — source registry, parallel execution
├── db.py                  # All Supabase operations (venues, events, sources, logs)
├── dedupe.py              # Content hash deduplication
├── config.py              # Environment config (Supabase keys, API keys)
├── tag_inference.py       # Auto-tagging from event/venue data
├── extract.py             # AI-powered extraction for unstructured sources
├── series.py              # Event series linking (recurring shows, residencies)
├── posters.py             # TMDB poster fetching for film events
├── artist_images.py       # Spotify artist image + genre fetching for music events
├── sources/               # One file per source (~500+ crawlers)
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
python main.py --source marys-bar

# Run all active sources
python main.py

# Run with verbose logging
python main.py --source marys-bar --verbose
```

## Key Database Operations (db.py)

- `get_or_create_venue(venue_data)` — Finds by slug or name, creates if missing. Returns venue ID.
- `insert_event(event_data)` — Inserts event with auto-tagging, poster fetching, genre inference.
- `find_event_by_hash(content_hash)` — Dedup check before inserting.
- `generate_content_hash(title, venue_name, date)` — From dedupe.py, creates MD5 hash.

## Crawler Pattern

Every crawler exports a `crawl(source: dict) -> tuple[int, int, int]` function returning `(events_found, events_new, events_updated)`.

### Venue Data (CRITICAL — always complete)

```python
VENUE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",              # Unique, used for dedup
    "address": "123 Main St",
    "neighborhood": "Midtown",         # Important for filtering
    "city": "Atlanta",
    "state": "GA",
    "zip": "30308",
    "lat": 33.7834,                    # Required for map placement
    "lng": -84.3831,
    "venue_type": "bar",               # bar, restaurant, music_venue, etc.
    "spot_type": "bar",                # Used for spot filtering in the app
    "website": "https://venue.com",
    "vibes": ["dive-bar", "live-music", "late-night"],  # Discovery tags
}
```

### Venue Types

bar, restaurant, music_venue, nightclub, comedy_club, gallery, museum, brewery,
coffee_shop, bookstore, library, arena, cinema, park, garden, food_hall,
farmers_market, convention_center, venue, organization, festival, church,
event_space, sports_bar, distillery, winery, hotel, rooftop, coworking,
record_store, studio, fitness_center, community_center, college, university

## Source Activation

Sources must exist in the `sources` database table with `is_active = true` to run. The `main.py` auto-discovers crawler files and maps them to source slugs. To activate a new crawler:

1. Create the file in `sources/`
2. Register/activate in the sources table
3. Run with `python main.py --source <slug>`

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
