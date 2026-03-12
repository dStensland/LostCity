# PRD 031: Museum & Gallery Crawler Coverage Fix

**Status**: Ready for execution
**Priority**: P0-P3 (batched)
**Estimated effort**: 25-35 agent hours, ~12-15 calendar hours with 3 parallel agents

## Problem

Our museum and gallery coverage in Atlanta has major gaps. The High Museum was just fixed (11 → 65 events), but across the rest of the tier we have venues with zero events, broken crawlers that report success while producing nothing, and silent write-path bugs that eat events before they reach the database.

The worst event-feed gap is now College Football Hall of Fame. SCAD FASH is still blocked for live event scraping from this runtime, but it now has an official SCAD catalog PDF fallback for destination intelligence rather than reading as a dead venue. World of Coca-Cola is still a downtown tourist anchor that hotel guests ask about immediately, but site reconnaissance now shows it behaves as a destination-first venue with no live first-party events feed, so it should be judged on destination intelligence rather than future event count.

## Current State

### Good (no action needed)

| Venue | Events | Exhibits | Notes |
|---|---|---|---|
| High Museum of Art (id:95) | 42 | 21 | Just fixed |
| Center for Puppetry Arts (id:196) | 118 | 16 | |
| Children's Museum of Atlanta (id:215) | 71 | 1 | |
| MODA (id:1105) | 9 | 28 | Has venue dedup issue (P3) |
| National Center for Civil/Human Rights (id:557) | 8 | 15 | |
| Atlanta History Center (id:211) | 7 | 10 | |
| Fernbank Museum (id:212) | 9 | 30 | Has cross-source dupes (P1) |

### Broken or Missing

| # | Venue | Venue ID | Source ID | Events | Issue | Priority |
|---|---|---|---|---|---|---|
| 1 | World of Coca-Cola | 209 | deactivated | 0 | Legacy `/events` endpoint now 404; reclassify as destination-first venue, not event-gap P0 | Track B |
| 2 | College Football Hall of Fame | 214 | deactivated | 0 | Localist-powered calendar, extractor can't parse | P0 |
| 3 | SCAD FASH Museum | 1247 | deactivated | 0 | Live pages are Cloudflare-blocked; official catalog PDF fallback now hydrates destination metadata, but there is still no fetchable calendar | Track B |
| 4 | Atlanta Contemporary | 233 | 157 | 4 | Playwright timeout at 30s; page loads slowly | P1 |
| 5 | Delta Flight Museum | 213 | none | 0 | No crawler ever built | P1 |
| 6 | Marcia Wood Gallery | 236 | 237 | 0 | Crawl finds 1 event but nothing persists — silent write-path bug | P1 |
| 7 | Clark Atlanta Univ Art Museum | 304 | 1071 | 0 | Same silent write failure as #6 | P1 |
| 8 | Hammonds House Museum | 218 | 431 | 0 events / 7 exhibits | Source erroring `[Errno 35]`; events mis-tagged as exhibits | P1 |
| 9 | Fernbank Science Center | 225 | 1074 | 4 | Crawler only hits one sub-page of programs | P1 |
| 10 | Fernbank Museum (dedup) | 212 | 104 + 627 | 7 dupes | Same events from Fernbank crawler + Atlanta Science Festival crawler | P1 |
| 11 | Whitespace Gallery | 234 | deactivated | 0 | 17 zero-event runs; Squarespace site | P2 |
| 12 | Sandler Hudson Gallery | 237 | deactivated | 0 | Same gallery boilerplate failure | P2 |
| 13 | Mason Fine Art | 236 | deactivated | 0 | 17 zero-event runs; same pattern | P2 |
| 14 | Poem 88 | 241 | deactivated | 0 | 4 zero-event runs; may be Instagram-only | P2 |
| 15 | APEX Museum | 216 | deactivated | 0 | First-party `events-2026` page is currently a destination shell and Eventbrite is contradictory; move to destination track until a real feed returns | Track B |
| 16 | Trap Music Museum | 4073 | deactivated | 0 | Permanent attraction, events via external promoters | P2 |
| 17 | MODA (venue dedup) | 219, 726, 1105 | — | — | 3 venue records for same address | P3 |
| 18 | Spelman College Museum | 852 | 261 (broad) | 1 | Needs dedicated source at spelmanmuseum.org | P3 |
| 19 | Zuckerman Museum of Art | 851 | via KSU | 5 | Verify KSU crawler covers it properly | P3 |
| 20 | Castleberry Hill galleries | various | none | 0 | Research if district calendar exists | P3 |

## Architecture Context

### Crawler conventions
- Every crawler lives in `crawlers/sources/<slug>.py`
- Exports `crawl(source: dict) -> tuple[int, int, int]` returning `(events_found, events_new, events_updated)`
- Read `crawlers/CLAUDE.md` for full patterns, venue data requirements, and series grouping
- Playwright for JS-rendered sites, BeautifulSoup/httpx for static
- `db.py:insert_event()` handles validation, category normalization, dedup, and exhibit detection

### Key files
- `crawlers/db.py` — write path with all validation. `insert_event()` is ~700 lines. Category normalization maps `"museums"` → `"art"` silently
- `crawlers/sources/high_museum.py` — gold standard museum crawler: Playwright + pagination + separate `/exhibitions/` crawl + `content_kind: "exhibit"` handling
- `crawlers/sources/ticketmaster.py` — API aggregator; `fetch_events()` supports keyword/venue queries
- `crawlers/sources/agnes_scott.py` — Localist API pattern (`{BASE_URL}/api/2/events`)
- `crawlers/sources/marcia_wood_gallery.py` — representative broken gallery crawler
- `crawlers/dedupe.py` — `generate_content_hash(title, venue_name, date)` for dedup

### Database schema
- Events table: `content_kind` field with values `'event'`, `'exhibit'`, `'special'`
- Exhibits use `is_all_day: true`, `start_time: null`, `start_date` / `end_date` for the run
- `VALID_CATEGORIES` in db.py: `art`, `music`, `nightlife`, `food_drink`, `community`, `sports`, `film`, `family`, `comedy`, `theatre`, `festival`, `fitness`
- `"museums"` is NOT a valid category — it gets normalized to `"art"` by `normalize_category()`

### Shared root causes
1. **Gallery boilerplate failure** (issues 11-14): All use the same generic text-scanning regex that doesn't match exhibition date formats on Squarespace sites. A shared Squarespace exhibition parser (`/exhibitions?format=json`) would fix all four.
2. **Silent write-path rejection** (issues 6, 7): `insert_event()` catches exceptions generically. Events are "found" by the crawler but rejected by validation (likely title validation or contradictory `is_all_day: true` + explicit `start_time`). Run with `--verbose` to see the actual rejection reason.
3. **Site structure drift** (issues 2, 3): Crawlers that worked initially but stopped because the sites changed their DOM.
4. **Destination-vs-event misclassification** (issue 1): Some museum-adjacent venues are permanent attractions with strong planning value but no current first-party events feed.

## Execution Plan

### Batch 1: Diagnosis Sprint

**Goal**: Identify root causes before writing code. All three agents run in parallel.

#### Agent A: Silent Write Failures (Issues 6, 7)

Run both crawlers with verbose logging and trace the write path:

```bash
python main.py --source marcia-wood-gallery --verbose --dry-run
python main.py --source clark-atlanta-art-museum --verbose --dry-run
```

Check for:
1. `validate_event_title()` rejecting exhibition titles (gallery titles like "Susan Harbage Page: Fieldwork")
2. Contradictory fields: Marcia Wood sets `is_all_day: True` with `start_time: "11:00"` — may cause a DB constraint failure
3. Long date spans triggering `content_kind = "exhibit"` + some visibility gate marking them inactive
4. Venue ID resolution failure (event found but venue not matched)

**Deliverable**: Root cause identified for each, with the specific validation step that rejects the event.

#### Agent B: Connection Errors + Fernbank (Issues 8, 9, 10)

**Hammonds House** (`[Errno 35]`):
- This is macOS `EAGAIN` — connection reset by server
- Try with different User-Agent header
- Check if site now requires JS (switch to Playwright if so)
- Inspect the 7 existing "exhibits" — are some actually events? The `determine_category()` function is tagging everything as exhibits

**Fernbank Science Center**:
- Crawler only looks at `section id="gallery3-rn"` — if the site restructured, this hardcoded ID won't match
- Inspect `fernbank.edu/fsc-events.html` and sub-pages for current HTML structure
- They have planetarium shows, telescope nights, and school programs — 4 events means most are missed

**Fernbank cross-source dedup**:
- Query: `SELECT title, source_id, COUNT(*) FROM events WHERE venue_id = 212 AND start_date >= CURRENT_DATE GROUP BY title, source_id, start_date HAVING COUNT(*) > 1`
- Check if both sources (104, 627) use the same `venue_id` — if not, that's why dedup fails
- Fix: ensure venue mapping is consistent

**Deliverable**: Fix plan for each, including whether Hammonds needs a Playwright migration.

#### Agent C: P0 Site Reconnaissance (Issues 1, 2, 3)

Use browser automation or `curl` + inspection to determine:

**World of Coca-Cola** (`worldofcoca-cola.com` / `/plan-your-visit`):
- Confirm whether `/events` still exists; as of March 9, 2026 it returns `404`
- Inspect ticketing, accessibility, and planning pages for destination-intelligence hydration opportunities
- Only pursue Ticketmaster/Eventbrite if a real first-party event feed reappears
- Goal: decide whether this source belongs on the event track or only on the destination track

**College Football Hall of Fame** (`cfbhall.com/happenings/`):
- The existing crawler at `crawlers/sources/college_football_hof.py` looks for `.event.card-zoom` selector
- Check if that selector still exists in the DOM
- Check if the site uses a Localist calendar (look for `/api/2/events` endpoint)
- Check Ticketmaster/Eventbrite as fallback

**SCAD FASH** (`scadfash.org/events` and `scadfash.org/exhibitions`):
- Check if the site is JS-rendered (requires Playwright)
- Check if `scad_atlanta.py` already maps any events to SCAD FASH venue
- Inspect DOM structure for event cards / exhibition listings

**Deliverable**: For each venue, the recommended approach (TM API, Localist API, Playwright rewrite, or selector update) with specific selectors/IDs.

---

### Batch 2: Quick Wins

Sequential, ~1 hour total. Can start immediately without waiting for Batch 1.

#### Issue 4: Atlanta Contemporary Timeout
- File: `crawlers/sources/atlanta_contemporary.py`
- Change `timeout=30000` to `timeout=60000` in the `page.goto()` call
- Expected improvement: 4 → ~15 events

#### Issue 17: MODA Venue Deduplication
- Write a Supabase migration to merge venue IDs 219 and 726 into 1105
- `UPDATE events SET venue_id = 1105 WHERE venue_id IN (219, 726);`
- `UPDATE venues SET is_active = false WHERE id IN (219, 726);`

#### Issue 19: Zuckerman Museum Verification
- `crawlers/sources/kennesaw_state.py` has a `VENUE_MAP` with Zuckerman entry
- Verify: `SELECT COUNT(*) FROM events WHERE venue_id = 851 AND start_date >= CURRENT_DATE;`
- If events exist, this is already resolved. If not, check if Ovation Tix scraper is picking up Zuckerman-specific events.

---

### Batch 3: P0 Crawler Fixes

Based on Batch 1 / Agent C findings. 2-3 parallel agents, ~4 hours each.

#### Issue 1: World of Coca-Cola

**Updated approach**: Treat as destination-first unless a real event feed is discovered.
- The first-party `/events` endpoint currently returns `404`
- Keep the source profile for `images`, `tickets`, `venue_hours`, `planning`, and `accessibility`
- Do not force Ticketmaster/Eventbrite ingestion just to manufacture feed health
- If a real upcoming-events surface appears later, reopen this as an event-track source

**Venue data**:
```python
VENUE_DATA = {
    "name": "World of Coca-Cola",
    "slug": "world-of-coca-cola",
    "address": "121 Baker St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "venue_type": "museum",
    "website": "https://www.worldofcoca-cola.com",
}
```

#### Issue 2: College Football Hall of Fame

If Localist-powered: switch to Localist API pattern.
- Reference: `crawlers/sources/agnes_scott.py` for `{BASE_URL}/api/2/events` pattern
- This is a clean JSON API that returns structured event data — much more reliable than DOM scraping

If not Localist: update CSS selectors in the existing `college_football_hof.py` crawler based on Agent C recon.

**Venue data**:
```python
VENUE_DATA = {
    "name": "College Football Hall of Fame",
    "slug": "college-football-hall-of-fame",
    "address": "250 Marietta St NW",
    "neighborhood": "Downtown",
    "city": "Atlanta",
    "state": "GA",
    "zip": "30313",
    "venue_type": "museum",
    "website": "https://www.cfbhall.com",
}
```

#### Issue 3: SCAD FASH Museum

Updated approach based on recon:
1. Keep the Playwright path in place for future retries if SCAD relaxes blocking
2. Treat the venue as destination-first for now; official catalog PDF fallback now hydrates website, description, and planning notes
3. Do not create synthetic active exhibit rows from the catalog's "recent exhibitions" list
4. Reopen event-feed work only if SCAD exposes a fetchable first-party calendar or structured partner feed

---

### Batch 4: Bug Fixes

Based on Batch 1 diagnosis results. 1-2 agents, ~2 hours each.

#### Issues 6, 7: Silent Write-Path Fixes (Marcia Wood + Clark Atlanta)

Based on diagnosis, the fix is likely one of:
- Remove contradictory `is_all_day: True` + `start_time` combination
- Fix title validation (exhibition titles may hit a rejection rule)
- Ensure `category` value passes normalization correctly
- Add better error logging to `insert_event()` so these failures surface

#### Issue 8: Hammonds House Museum

- If site needs JS: migrate crawler to Playwright
- Fix `[Errno 35]`: add retry logic with exponential backoff, or switch transport
- Fix content_kind mis-tagging: audit `determine_category()` — "Community Day" and "HHM Night Out" should be `content_kind: 'event'`, not `'exhibit'`

#### Issue 9: Fernbank Science Center

- Add crawling of additional sub-pages (planetarium shows, observatory events, telescope nights)
- Reference: High Museum crawler crawls both `/events/` and `/exhibitions/` in the same run
- Update the hardcoded `section id="gallery3-rn"` selector if site restructured

#### Issue 10: Fernbank Cross-Source Dedup

- Ensure both the Fernbank crawler (source 104) and Atlanta Science Festival crawler (source 627) use the same `venue_id` for Fernbank Museum events
- If venue IDs differ, that's why `find_cross_source_canonical_for_insert()` doesn't catch them
- Fix the venue mapping in whichever source has the wrong ID

---

### Batch 5: Gallery Tier Rewrites

2-3 parallel agents, ~6 hours total.

#### Shared Squarespace Exhibition Parser (Issues 11-13)

Whitespace, Sandler Hudson, and Mason Fine Art are all Squarespace gallery sites. Build a shared parser:

```python
# crawlers/exhibition_parser.py
def parse_squarespace_exhibitions(base_url, venue_data, source_id):
    """Generic Squarespace exhibition parser using JSON API.

    Squarespace sites expose /exhibitions?format=json which returns
    structured data including title, date ranges, and images.
    """
```

Then each gallery crawler becomes a thin wrapper:
```python
from exhibition_parser import parse_squarespace_exhibitions

def crawl(source):
    return parse_squarespace_exhibitions(
        "https://whitespace814.com",
        VENUE_DATA,
        source["id"],
    )
```

#### Issue 14: Poem 88
- Check if `poem88.net` has any parseable event/exhibition content
- If Instagram-only, mark source as `has_no_events_page=true` and deprioritize
- Small gallery — may not warrant crawler effort

#### Issue 15: APEX Museum
- Current status as of March 9, 2026: first-party `events-2026` page is a marketing shell with calendar chrome but no event records or detail links
- Eventbrite pages expose contradictory state (`nextAvailableSession` alongside `messageCode="event_cancelled"`), so the crawler should fail closed
- Keep APEX on the destination-intelligence track for planning/accessibility/hours until a real event feed reappears

#### Issue 16: Trap Music Museum
- Primarily a permanent attraction (immersive experience)
- Events are hosted by external promoters, often on Eventbrite
- Check if Eventbrite search by venue returns results
- May also appear on Ticketmaster

---

### Batch 6: New Builds + Cleanup

Sequential, lowest priority.

#### Issue 5: Delta Flight Museum

New crawler from scratch:
- URL: `deltamuseum.org/events`
- Inspect site to determine if static (BS4) or JS-rendered (Playwright)
- Venue: 1060 Delta Blvd, Hapeville, GA 30354
- Reference: similar museum crawlers like `cdc_museum.py`

#### Issue 18: Spelman College Museum

- Check if `crawlers/sources/spelman_college.py` already creates events for the museum
- If so, ensure venue mapping assigns them to venue id:852
- If not, either add a URL filter for `museum.spelman.edu` events, or create a dedicated `spelman_museum.py`

#### Issue 20: Castleberry Hill Galleries

- Research only: check if a Castleberry Hill Art Stroll or district calendar exists
- If a shared calendar exists (website, Facebook events page), build one aggregator crawler
- If not, individual gallery crawlers are the right approach (handled by Batch 5)

---

## Validation

After all batches are complete, run a full audit:

```sql
-- Museum/gallery event coverage
SELECT
  v.name,
  v.id as venue_id,
  COUNT(e.id) FILTER (WHERE e.content_kind = 'event' AND e.start_date >= CURRENT_DATE) as upcoming_events,
  COUNT(e.id) FILTER (WHERE e.content_kind = 'exhibit' AND (e.end_date >= CURRENT_DATE OR e.start_date >= CURRENT_DATE)) as upcoming_exhibits,
  COUNT(e.id) as total
FROM venues v
LEFT JOIN events e ON e.venue_id = v.id AND e.is_active = true
WHERE v.venue_type IN ('museum', 'gallery')
  AND v.city = 'Atlanta'
GROUP BY v.id, v.name
ORDER BY total DESC;
```

### Target coverage (post-fix)

| Venue | Current | Target |
|---|---|---|
| World of Coca-Cola | destination-only | complete planning + accessibility + hours + ticket metadata |
| College Football Hall of Fame | 0 | 5-10 |
| SCAD FASH | 0 | 10-20 |
| Atlanta Contemporary | 4 | 12-18 |
| Delta Flight Museum | 0 | 5-10 |
| Marcia Wood Gallery | 0 | 2-5 |
| Clark Atlanta Art Museum | 0 | 3-8 |
| Hammonds House | 0/7 | 5-10 events + exhibits |
| Fernbank Science Center | 4 | 10-15 |
| Gallery tier (4 venues) | 0 | 2-5 each |

## Notes for Executing Agent

- Always read `crawlers/CLAUDE.md` before writing any crawler code
- Run `python main.py --source <slug> --dry-run` to test without DB writes
- Run `python main.py --source <slug> --verbose --dry-run` to debug write-path issues
- Production writes require `--allow-production-writes` flag
- The High Museum crawler (`crawlers/sources/high_museum.py`) is the gold standard reference for museum Playwright crawlers with pagination and exhibition support
- Category `"museums"` gets normalized to `"art"` — this is correct behavior, not a bug
- Exhibits use `content_kind: 'exhibit'`, `is_all_day: true`, `start_time: null`
- Always verify syntax: `python -c "import ast; ast.parse(open('sources/<file>.py').read())"`
- Do NOT create events for permanent attractions or daily operations (this place is open ≠ event)
- Opt-out venue: Tiny Doors ATL — never reference them
