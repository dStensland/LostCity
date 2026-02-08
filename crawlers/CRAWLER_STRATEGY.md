# Crawler Creation Strategy

A systematic approach to building comprehensive event coverage for any city.

---

## Table of Contents
1. [Source Tier System](#source-tier-system)
2. [Technical Approach Decision Tree](#technical-approach-decision-tree)
3. [Category Coverage Matrix](#category-coverage-matrix)
4. [City Launch Playbook](#city-launch-playbook)
5. [Quality Scoring Framework](#quality-scoring-framework)
6. [Crawler Templates](#crawler-templates)

---

## Source Tier System

### Source Rule: Original Sources Over Curators

**Always prefer crawling the original venue/organization over a curator or editorial aggregator.**

Curators (ArtsATL, Nashville Scene, Discover Atlanta, Visit Music City, etc.) duplicate events that should come from the original source. This causes:
- Duplicate events in the database
- Lower data quality (curators often strip times, prices, descriptions)
- Fragile dependencies on editorial sites that change format frequently

**Allowed aggregators** (fill gaps we can't get from direct sources):
- Ticketmaster / AXS -- structured ticketing APIs, cover venues without their own calendars
- Eventbrite -- community events from small orgs that don't have websites

Exception: if a venue/org has no first-party API and is well covered by Ticketmaster or Eventbrite, prefer the aggregator API over scraping the venue site.

**Do not use** as sources:
- Editorial calendars (ArtsATL, Creative Loafing, Nashville Scene, AccessATlanta)
- Tourism boards (Discover Atlanta, Visit Music City, Visit Franklin)
- City guides (Do615, Nashville.com)

If an event appears in a curator but not in our database, add a crawler for the original venue instead.

### Strategy Priority Order (Per Source)
1. First-party org/venue API.
2. Aggregator APIs (Ticketmaster/Eventbrite) when the venue has no API or the aggregator data is materially better.
3. Structured feeds (ICS/RSS/ical).
4. Schema.org-only ingestion (JSON-LD Event required; skip pages without it).
5. Deterministic HTML crawlers (selectors + JSON-LD + microdata).
6. LLM-powered crawler (LLM drives discovery + extraction) for sources that cannot be parsed deterministically.
7. LLM extraction (HTML -> structured) as fallback inside deterministic crawlers.
8. Browser automation (Playwright) when content requires JS or interaction.
9. User submissions.

Schema.org-only is enforced via `detail.jsonld_only: true` in the source profile.

### Source Audit CLI
Use the audit tool when investigating a new source to recommend an integration method:
```
python scripts/source_audit.py --url https://example.org/events
```
It reports signals (feeds, JSON-LD, JS rendering) and a recommended method based on the priority order.

### Tier 1: High-Volume Aggregators (Priority: First)
**Goal:** Establish baseline coverage quickly

| Source Type | Example | Expected Events | Confidence | Notes |
|-------------|---------|-----------------|------------|-------|
| Ticketing APIs | Ticketmaster, AXS | 500-1000+ | 0.95 | Best structured data, covers major venues |
| Event Aggregators | Eventbrite | 100-500 | 0.85 | Community events, varied quality |
| Meetup API | Meetup.com | 50-100 | 0.80 | Community/tech/hobby events |

**Why First:** These provide immediate broad coverage while you build venue-specific crawlers.

### Tier 2: Major Venues (Priority: Second)
**Goal:** High-quality data for anchor venues

| Venue Type | Event Volume | Confidence | Technical Approach |
|------------|--------------|------------|-------------------|
| Arenas/Stadiums | 50-200/year | 0.95 | API or Playwright |
| Convention Centers | 100-300/year | 0.90 | Playwright |
| Major Theaters | 100-500/year | 0.90 | Playwright (showtimes) |
| Large Music Venues | 200-400/year | 0.85 | BeautifulSoup or Playwright |

**Key Insight:** Theaters/cinemas with multiple daily showtimes generate high event counts (Plaza Theatre: 60-117 events/crawl).

### Tier 3: Category Leaders (Priority: Third)
**Goal:** Deep coverage in each category

For each category, identify 3-5 "anchor" venues that define that scene:

| Category | Anchor Venue Types | Typical Count |
|----------|-------------------|---------------|
| Music | Iconic clubs, listening rooms | 30-60 events |
| Comedy | Comedy clubs, improv theaters | 30-80 events |
| Theater | Regional theaters, playhouses | 20-50 events |
| Art | Contemporary art centers, galleries | 10-30 events |
| Film | Independent cinemas, film societies | 20-100 events |
| Food/Drink | Food halls, breweries with events | 10-30 events |

### Tier 4: Niche & Community (Priority: Fourth)
**Goal:** Comprehensive coverage, community authenticity

| Source Type | Examples | Value |
|-------------|----------|-------|
| Bookstores with events | Independent bookshops | Literary community |
| Libraries | Public library systems | Free community events |
| Dance studios | Salsa, swing, ballroom | Recurring classes & socials |
| Running/outdoor clubs | Track clubs, hiking groups | Fitness community |
| LGBTQ+ venues/orgs | Pride orgs, queer spaces | Inclusive coverage |
| Cultural centers | JCCs, cultural orgs | Community events |
| Universities | Campus venues, arts centers | Student/academic events |

---

## Technical Approach Decision Tree

```
START: Analyzing a new source
│
├─► Does it have a public API?
│   ├─► YES → Use API approach (highest quality)
│   │         • First-party org/venue API
│   │         • Structured JSON, pagination support
│   │         • Confidence: 0.90-0.95
│   │
│   └─► NO → Continue...
│
├─► Is it covered by Ticketmaster/Eventbrite?
│   ├─► YES → Use aggregator API
│   │         • Confidence: 0.85-0.95
│   │
│   └─► NO → Continue...
│
├─► Does it have a structured feed (ICS/RSS)?
│   ├─► YES → Use feed ingestion
│   │         • Low maintenance, high precision
│   │         • Confidence: 0.85-0.95
│   │
│   └─► NO → Continue...
│
├─► Does the site publish JSON-LD Event?
│   ├─► YES → If complete, use schema.org-only
│   │         • Otherwise parse JSON-LD + HTML selectors
│   │         • Confidence: 0.85-0.90
│   │
│   └─► NO → Continue...
│
├─► Can we parse deterministically from HTML?
│   ├─► YES → Use selectors + microdata
│   │         • Confidence: 0.70-0.85
│   │
│   └─► NO → Continue...
│
├─► Is the content JS-driven or requires interaction?
│   ├─► YES → Use Playwright
│   │         • Wait for content to load
│   │         • Handle infinite scroll
│   │         • Click through date pickers
│   │         • Confidence: 0.80-0.90
│   │
│   └─► NO → Continue...
│
└─► SPECIAL CASES:
    • Use LLM-powered crawler for sources that cannot be parsed deterministically
    • Use LLM extraction as fallback for missing fields or non-standard pages
    • Theaters/Cinemas: Always use Playwright for date navigation
    • Calendars with filters: Playwright to interact with dropdowns
    • Infinite scroll: Playwright with scroll handling
```

Note: if static HTML is available, prefer LLM extraction over Playwright. Use Playwright only when content is JS-only or requires interaction to render events.

### When to Use Each Approach

**Playwright (34 crawlers currently):**
- Modern React/Vue/Angular sites
- Sites with date pickers or filters
- Theaters with showtime calendars
- Any site where content loads after page load
- Higher resource cost, but necessary for JS sites

**BeautifulSoup (157 crawlers currently):**
- Traditional HTML sites
- WordPress event plugins
- Simple event listings
- API responses that return HTML
- Lower resource cost, faster execution

**API-based:**
- Ticketmaster, Eventbrite, Meetup
- Venues using known ticketing platforms
- Any site exposing a REST/GraphQL API
- Best structured data, most reliable

---

## Category Coverage Matrix

For comprehensive city coverage, ensure sources in each category:

### Entertainment

| Category | Must-Have Sources | Nice-to-Have |
|----------|-------------------|--------------|
| **Music - Large** | Arena, amphitheater, large clubs | Casino venues |
| **Music - Medium** | 3-5 mid-size venues (300-1500 cap) | Listening rooms |
| **Music - Small** | 5-10 dive bars, small clubs | House venue networks |
| **Comedy** | 2-3 comedy clubs, improv theaters | Open mic venues |
| **Theater** | Regional theater, Broadway touring, community theaters | University theaters |
| **Film** | Independent cinemas, film festivals, film societies | Drive-ins, pop-ups |
| **Nightlife** | Major clubs, LGBTQ+ venues, late-night spots | Speakeasies |

### Arts & Culture

| Category | Must-Have Sources | Nice-to-Have |
|----------|-------------------|--------------|
| **Museums** | Major art museum, history museum, science center | Niche museums |
| **Galleries** | 3-5 contemporary galleries | Co-op galleries |
| **Cultural** | Cultural centers, heritage orgs | Consulate events |

### Community & Lifestyle

| Category | Must-Have Sources | Nice-to-Have |
|----------|-------------------|--------------|
| **Food/Drink** | Food halls, major breweries, food festivals | Supper clubs |
| **Fitness** | Running clubs, yoga studios, climbing gyms | CrossFit, martial arts |
| **Outdoor** | Parks dept, hiking clubs, nature centers | Kayak/bike groups |
| **Family** | Children's museums, zoos, aquariums | Libraries, rec centers |
| **Community** | Volunteer orgs, neighborhood festivals | Faith-based |
| **Tech/Professional** | Tech meetups, coworking spaces | Industry associations |

### Sports

| Category | Must-Have Sources | Nice-to-Have |
|----------|-------------------|--------------|
| **Pro Sports** | All major league teams | Minor league |
| **College** | Major university athletics | D2/D3 schools |
| **Motorsports** | Speedways, drag strips | Karting |
| **Niche** | Rugby, soccer clubs, running races | Disc golf, pickleball |

---

## City Launch Playbook

### Phase 1: Foundation (Week 1)
**Goal:** 500+ events from aggregators

1. **Set up Ticketmaster API** for the metro area
   - Configure geo search for city center + 50 mile radius
   - Expected: 300-500 events

2. **Set up Eventbrite API**
   - Search by city/metro
   - Expected: 100-300 events

3. **Identify local event calendar**
   - Every city has one (Creative Loafing, Do512, etc.)
   - Build Playwright crawler
   - Expected: 50-150 events

4. **Set up Meetup API**
   - Filter by metro area
   - Expected: 50-100 events

### Phase 2: Major Venues (Week 2)
**Goal:** High-quality coverage of anchor venues

1. **Identify the "big 10" venues:**
   - Largest arena
   - Primary concert amphitheater
   - Convention center
   - 2-3 major theaters
   - 2-3 iconic music clubs
   - Primary comedy club

2. **Build crawlers for each** using appropriate technical approach

3. **Validate against Ticketmaster** - you should see overlap

### Phase 3: Category Deep-Dive (Weeks 3-4)
**Goal:** Category leaders in each vertical

For each category in the matrix:
1. Research top 3-5 venues/sources
2. Prioritize by event volume
3. Build crawlers
4. Tag appropriately for filtering

### Phase 4: Community & Niche (Ongoing)
**Goal:** Authentic local coverage

1. **Local favorites** - venues loved by locals but not tourists
2. **Community organizations** - cultural centers, LGBTQ+ orgs, etc.
3. **Recurring events** - weekly trivia, open mics, dance nights
4. **Seasonal** - festivals, holiday events, outdoor series

---

## Quality Scoring Framework

### Event Data Quality Score

Each event should be scored on data completeness:

| Field | Weight | Score if Present |
|-------|--------|------------------|
| title | Required | - |
| start_date | Required | - |
| venue_name | 15% | 0.15 |
| start_time | 15% | 0.15 |
| description | 10% | 0.10 |
| category | 10% | 0.10 |
| price_info | 10% | 0.10 |
| image_url | 10% | 0.10 |
| ticket_url | 10% | 0.10 |
| end_time | 5% | 0.05 |
| tags | 5% | 0.05 |
| address | 10% | 0.10 |

**Quality Tiers:**
- **A (0.85+):** Complete event with all key fields
- **B (0.70-0.84):** Good event, missing some details
- **C (0.50-0.69):** Basic event, needs enrichment
- **D (<0.50):** Minimal data, consider filtering

### Source Reliability Score

Track per-source:
- **Success rate:** % of crawls that succeed
- **Event yield:** Average events per crawl
- **Freshness:** How often new events appear
- **Accuracy:** Manual spot-check accuracy

---

## Crawler Templates

### Template 1: Playwright Theater/Cinema
Best for: Venues with date pickers and multiple showtimes

```python
Key patterns:
- extract_movies_for_date(page, date) - per-date extraction
- Click through day buttons for 7-14 days
- Handle "Coming Soon" and "Now Playing" sections
- Generate unique hash per showtime: title|date|time
```

See: `plaza_theatre.py`, `tara_theatre.py`

### Template 2: BeautifulSoup Music Venue
Best for: Traditional HTML event listings

```python
Key patterns:
- Parse event cards with CSS selectors
- Extract date from various formats
- Handle "doors" vs "show" times
- Category inference from title keywords
```

See: `terminal_west.py`, `the_earl.py`

### Template 3: API Aggregator
Best for: Ticketmaster, Eventbrite, etc.

```python
Key patterns:
- Paginated API calls
- Rate limiting
- Venue matching/creation
- Higher confidence scores
```

See: `eventbrite.py`, `ticketmaster.py`

### Template 4: Multi-Page Aggregator
Best for: Local calendars with category pages

```python
Key patterns:
- List of category URLs to scrape
- Deduplication across pages
- Playwright for JS-rendered content
- Venue extraction from event text
```

See: `creative_loafing.py`

### Template 5: Recurring Event Source
Best for: Dance studios, weekly events

```python
Key patterns:
- get_next_weekday() for recurring dates
- is_recurring flag
- Weekly schedule parsing
- Class vs social event distinction
```

See: `salsa_atlanta.py`, `pasofino_dance.py`

---

## Research Checklist for New City

Before building crawlers, research:

### Discovery Phase
- [ ] What's the local alternative weekly? (Creative Loafing equivalent)
- [ ] What are the "must-see" venues locals recommend?
- [ ] What's the primary arena/stadium complex?
- [ ] What convention center hosts events?
- [ ] What are the iconic music clubs?
- [ ] What's the comedy scene like?
- [ ] What independent cinemas exist?
- [ ] What's the LGBTQ+ nightlife center?
- [ ] What food halls/markets have events?
- [ ] What outdoor recreation is popular?

### Technical Recon
- [ ] Does Ticketmaster cover the market?
- [ ] Is there Eventbrite activity?
- [ ] Do major venues have APIs?
- [ ] What CMS do venue sites use? (WordPress, Squarespace, custom)
- [ ] Are there city-specific ticketing platforms?

### Community Research
- [ ] What Facebook groups discuss local events?
- [ ] What subreddits cover the city?
- [ ] What local blogs/publications cover events?
- [ ] Are there neighborhood-specific calendars?

---

## Metrics to Track

### Coverage Metrics
- Events per category (target: balanced distribution)
- Events per neighborhood/area
- Days ahead with events (target: 30+ days)
- Unique venues in system

### Quality Metrics
- Average data completeness score
- Duplicate rate
- Crawl success rate
- Events per crawl by source

### Freshness Metrics
- Time since last crawl per source
- New events per day
- Event update frequency

---

## Event Enrichment Pipeline

Every event inserted through `insert_event()` in `db.py` passes through a 7-step enrichment chain:

### 1. Title Validation (`validate_event_title`)
- **Rejects junk patterns:** Navigation elements ("Learn More"), day-only ("Monday"), date-only ("Thursday, February 5")
- **Length checks:** 3-200 characters
- **Exact match blacklist:** 40+ known UI scraping artifacts ("see details", "buy tickets", "rsvp")
- **Result:** `ValueError` raised for invalid titles before DB insert

### 2. Venue Context Loading
- **Purpose:** Inherit tags and enable venue-type-based inference
- **Data fetched:** `vibes` array and `venue_type` from venues table
- **Used by:** Tag inference and genre delegation (step 5-6)

### 3. Film Metadata Fetch (`posters.py`)
- **Triggered when:** `category == "film"` and `image_url` is missing
- **API:** OMDB (Open Movie Database) with free "trilogy" API key
- **Title extraction patterns:** Removes prefixes ("WeWatchStuff:", "Plaza Theatre:"), format indicators ("4K", "35MM"), extracts year from parentheses
- **Process:** `extract_film_info()` → `fetch_film_metadata(title, year)` → cache result
- **Data returned:** `FilmMetadata` with `poster_url`, `plot`, `director`, `runtime`, `year`, `imdb_id`, `genres`
- **Description fallback:** If existing description is missing or < 80 characters, backfills from OMDB `plot` field (truncated to 500 chars). This ensures cinema events always have meaningful descriptions even when the source provides stub text like "Buy Tickets" or "Rated PG-13"
- **Blocking:** Yes (inline during insert)
- **Cache:** In-memory dict `_poster_cache` by `title|year`

### 4. Music Artist Info (`artist_images.py`)
- **Triggered when:** `category == "music"`
- **API:** Deezer (no key required) — 3-step chain:
  1. Search artist by name
  2. Fetch artist's top track to get album ID
  3. Fetch album to extract genre data
- **Headliner extraction:** Removes "w/", "featuring", tour names, year markers, "SOLD OUT" prefix
- **Data returned:** Artist image URL + genres list
- **Blocking:** Yes (inline during insert)
- **Genre handling:** Only stored if event has no `series_id` (standalone events)
- **Cache:** In-memory dict `_artist_cache` by artist name

### 5. Tag Inference (`tag_inference.py`)
- **Rule engine:** 250+ inference patterns across 77 valid tags
- **Inputs:** Event title/description, venue vibes, venue type, category, structured fields (is_free, price_min)
- **Venue inheritance:** Inherits tags from `INHERITABLE_VIBES` ("intimate", "all-ages", "family-friendly", "outdoor-seating")
- **Venue type rules:** 21+ for bars/nightclubs, outdoor for parks/gardens, family-friendly for libraries/museums
- **Text patterns:** Album release, touring, debuts, sold-out, RSVP required, limited seating, holiday detection
- **Result:** Sorted list of valid tags merged with existing tags

### 6. Series Linking (`series.py`)
- **Triggered when:** `series_hint` dict provided with `series_type` and `series_title`
- **Lookup:** Finds existing series by normalized title or slug, or by IMDB ID for films
- **Create:** Auto-creates series if not found, stores director/runtime/year for films, frequency for recurring shows
- **Genre delegation:** If event linked to series, genres stored on series record instead of event
- **Series types:** `film`, `recurring_show`, `residency`, `festival`

### 7. Genre Assignment
- **Standalone events:** Stores genres directly on event record (music, film)
- **Series events:** Genres stored on series record, omitted from event
- **Source:** Passed as `genres` parameter or fetched from Deezer for music events

### Performance Characteristics
- **Poster fetch:** ~200-500ms per API call, cached for session
- **Artist info:** ~600-900ms (3 API calls), cached for session
- **Tag inference:** <10ms (local rule engine)
- **Series lookup:** ~50-100ms (database query)
- **Total overhead:** ~0-1.5 seconds per event depending on cache hits

---

## Detail Enrichment Pipeline

After discovery (feed, list, or LLM), each event with a `detail_url` passes through a multi-layer detail enrichment stack in `pipeline/detail_enrich.py`. This fills gaps in description, image, ticket URL, start_time, and pricing that the discovery step couldn't provide.

### Extraction Stack (executed in order)

Each layer runs and merges results. Later layers only fill fields still missing — they never overwrite data from earlier layers.

#### Layer 1: JSON-LD (`extractors/json_ld.py`)
- **Parse:** `<script type="application/ld+json">` blocks
- **Fields:** title, description, image_url, start_time, end_time, ticket_url, price_min/max, is_free, location
- **Strengths:** Structured data, highly reliable when present. Best source of start_time
- **Coverage:** ~30-40% of venue sites include JSON-LD

#### Layer 2: Open Graph (`extractors/opengraph.py`)
- **Parse:** `<meta property="og:*">` tags
- **Fields:** description (og:description), image_url (og:image)
- **Strengths:** Nearly universal, good fallback for images and short descriptions
- **Limitation:** No time/price data

#### Layer 3: CSS Selectors (`pipeline/detail_enrich.py`)
- **Parse:** Profile-defined CSS selectors from `detail_selectors` config
- **Fields:** Any field the profile maps a selector to
- **Strengths:** Precise, venue-specific extraction
- **Limitation:** Requires per-source configuration

#### Layer 4: Heuristic (`extractors/heuristic.py`)
- **Parse:** DOM structure + regex patterns
- **Fields:** description, image_url, ticket_url, start_time, end_time, price_note, is_free, artists
- **Time extraction patterns:**
  - "Doors: 7pm / Show: 8pm" — prefers show time as start_time
  - "7:00 PM - 10:00 PM" — time range with start and end
  - CSS class selectors: `.event-time`, `[class*='showtime']`, `[class*='door-time']`, `time` element
  - Supports 12h ("7pm", "7:30 PM") and 24h ("19:00") formats
- **Strengths:** Works on any HTML without configuration. Good at finding ticket links and times

#### Layer 5: LLM Detail Extraction (`extractors/llm_detail.py`)
- **Parse:** Sends trimmed HTML to LLM with structured extraction prompt
- **Fields:** description, image_url, ticket_url, start_time, end_time, price_min/max, price_note, is_free, artists
- **Gating:** Only invoked when prior layers left gaps — specifically when any of description (< 50 chars), image, ticket_url, or start_time is still missing
- **Cost:** ~$0.003 per call, ~2-5 seconds latency
- **Strengths:** Handles unusual/complex page layouts that structured extractors miss

### LLM Gating Logic

The LLM is expensive and slow, so it only fires when needed:

```python
has_good_desc = len(str(desc)) > 50
has_image = bool(enriched.get("image_url") or image_order)
has_ticket = bool(enriched.get("ticket_url"))
has_time = bool(enriched.get("start_time"))
if not (has_good_desc and has_image and has_ticket and has_time):
    # Invoke LLM extraction
```

### Hydration Techniques (Post-Crawl Gap Filling)

When the standard enrichment stack leaves gaps (especially for start_time), two additional hydration techniques can recover data from existing records:

#### Technique 1: Description Text Mining
- **Target:** Events with missing start_time but existing description text
- **Method:** Regex extraction of time patterns from description field
- **Patterns matched:**
  - `at 8:00 pm`, `at 7pm` — explicit time markers
  - `Doors open at 6:30 PM` — door/show time phrases
  - `7:00 PM - 10:00 PM` — time ranges
  - `starts at 8pm`, `begins at 7:30 PM` — start markers
- **Implementation:** SQL query finds candidates, Python regex extracts and updates
- **Success rate:** ~12-15% of missing-time events have times buried in descriptions
- **Cost:** Zero (no API calls, operates on existing data)

#### Technique 2: Page Re-fetch with Playwright
- **Target:** Events with `detail_url` but missing start_time after standard extraction
- **Method:** Re-fetch the detail page using Playwright (JS rendering), then run JSON-LD + heuristic extractors
- **Why separate:** Many venue sites render event times via JavaScript that plain HTTP fetch misses
- **Implementation:** `render_js: true` fetch → parse JSON-LD → parse heuristic → update if time found
- **URL dedup:** Cache fetched URLs to avoid re-fetching the same page for multiple events at same venue
- **Success rate:** ~25-30% of remaining missing-time events yield times via JS rendering
- **Cost:** ~30 seconds per page (Playwright startup + render), no API cost
- **When to use:** As a targeted backfill after the standard crawl, not during the main pipeline (too slow)

### Category Inference for Enrichment Triggers

Film poster/metadata fetch and music artist lookup depend on correct `category`. Category is inferred in this priority order:

1. **Explicit from source:** Crawler or feed provides category directly
2. **Profile defaults:** `defaults.category` in YAML profile (e.g., cinema profiles set `film`)
3. **Venue-type inference:** `_infer_category()` maps venue_type → category (e.g., `music_venue` → `music`, `comedy_club` → `comedy`, `cinema` → `film`)
4. **Title keyword matching:** Fallback regex patterns in event titles

**Critical:** Cinema profiles MUST have `defaults.category: film` set, otherwise OMDB metadata fetch never triggers and film events lack posters and descriptions.

---

## Deduplication Architecture

The dedup system in `dedupe.py` prevents duplicate events from multiple sources using a two-tier approach:

### Content Hash Generation
- **Algorithm:** MD5 hash of `normalize_text(title) + normalize_venue_for_dedup(venue_name) + date`
- **Normalization:** Lowercase, remove extra whitespace, strip "the/a/an" prefix, remove punctuation
- **Venue-aware:** Special handling for multi-room venues via `MULTI_ROOM_VENUES` dict

### Multi-Room Venue Normalization
- **Problem:** "The Masquerade - Hell" vs "The Masquerade - Heaven" should be treated as same venue for dedup
- **Solution:** `MULTI_ROOM_VENUES` map defines base names + room suffix regex patterns
- **Example:** `"the masquerade": [r"\s*-\s*(hell|heaven|purgatory|altar|music\s*park)$"]`
- **Result:** "The Masquerade - Hell" → "the masquerade" for hashing

### Fuzzy Matching (Fallback)
- **Library:** rapidfuzz with `fuzz.ratio()`
- **Threshold:** 85% similarity required to declare duplicate
- **Weighting:** Title 60%, venue 40%
- **Venue family search:** Uses `get_sibling_venue_ids()` to search across all rooms (e.g., all Masquerade venues)
- **Process:** If content hash misses, fuzzy match candidates from same date + venue family

### Merge Strategy (`merge_event_data`)
When duplicate detected, merge logic:
- **Description:** Prefer longer description
- **Times:** Fill missing start_time/end_time
- **Confidence:** Keep lower score (more conservative)
- **Tags:** Union of both tag sets
- **Prices:** Fill missing price_min/price_max/price_note
- **Image/tickets:** Fill missing URLs

### Venue Family Concept
- **Pattern:** `get_sibling_venue_ids(venue_id)` returns list of related venue IDs
- **Use case:** Multi-room venues like The Masquerade (Hell, Heaven, Purgatory, Altar, Music Park)
- **Lookup:** Queries venues table with `ILIKE "%masquerade%"` pattern
- **Extensible:** Can add more multi-room patterns (Terminal West, others)

### Known Limitation
- **Portal-aware dedup:** System does NOT consider portal_id in deduplication
- **Cross-city collision risk:** Same event title + date in different cities could incorrectly dedup
- **Mitigation:** Venue name in hash provides some protection, but same-named venues in different cities could collide
- **Future fix:** Include portal_id or city in content hash generation

### Dedup Flow in Practice
1. Crawler returns raw event dict
2. `generate_content_hash(title, venue_name, date)` creates hash
3. `find_event_by_hash(hash)` checks database
4. If hash match → return existing event ID (skip insert)
5. If no hash match → fuzzy search via `find_events_by_date_and_venue_family()`
6. If fuzzy match ≥85% → merge data and update existing event
7. If no match → insert as new event

---

## Portal Isolation (Multi-City)

When crawling for non-default portals (e.g., Nashville), crawlers MUST explicitly set `portal_id` on every event. Without this, events leak into all portals.

### Required Pattern for Non-Default City Crawlers

```python
from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug

PORTAL_SLUG = "nashville"

def crawl(source: dict) -> tuple[int, int, int]:
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)
    # ... include portal_id in every event_record
    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "portal_id": portal_id,  # REQUIRED
        # ...
    }
```

### Defense in Depth

- **Layer 1 (Crawler):** Explicitly set `portal_id` on event records
- **Layer 2 (Database):** Trigger inherits portal_id from `sources.owner_portal_id` if NULL
- **Layer 3 (API):** All event queries filter by portal_id

All three layers are required. See CITY_ONBOARDING_PLAYBOOK.md Appendix E for full details.

---

## Resilience Architecture

Two complementary systems protect against crawler failures:

### Circuit Breaker (`circuit_breaker.py`)
- **Purpose:** Prevent wasted resources on consistently failing sources
- **Threshold:** 3 consecutive failures opens circuit
- **Cooldown:** 6 hours before retry allowed
- **Lookback window:** 24 hours of crawl history
- **CLI bypass:** `--force` flag skips circuit breaker check
- **Data source:** PostgreSQL `crawl_logs` table
- **States:**
  - **Closed (healthy):** Source runs normally
  - **Open (blocking):** Source skipped with reason logged
  - **Degraded (warning):** 1-2 failures, still runs but logged
- **Status check:** `python main.py --circuit-status` shows all circuit states

### Health Tracker (`crawler_health.py`)
- **Storage:** Local SQLite (`crawler_health.db`) — survives network/DB instability
- **Why SQLite:** Circuit breaker uses PostgreSQL (crawl_logs), health uses SQLite for redundancy
- **7 Error Types:**
  1. `network` — DNS, timeouts, connection refused (transient, 60s retry)
  2. `rate_limit` — 429 errors, throttling (transient, 300s retry)
  3. `auth` — 401/403 failures (non-transient, 24hr retry)
  4. `parse` — HTML/JSON structure changed (non-transient, 24hr retry)
  5. `socket` — Errno 35 (macOS), Errno 11 (Linux), resource exhaustion (transient, 30s retry)
  6. `timeout` — Operation timeout (transient, 120s retry)
  7. `captcha` — Bot detection (transient, 1hr retry)

### Health Scoring (0-100)
- **Start:** 100 (healthy)
- **Success:** +5 (capped at 100)
- **Transient failure:** -5
- **Non-transient failure:** -15
- **Thresholds:**
  - **<10:** Source skipped (critically unhealthy)
  - **<50:** Degraded, increased delay
  - **80-100:** Healthy

### Adaptive Parallelism
- **Function:** `get_recommended_workers()` in `crawler_health.py`
- **Default:** 2 workers (MAX_WORKERS in main.py, reduced from higher to avoid macOS socket limits)
- **Socket error detection:** If >20% of recent crawls have socket errors → 1 worker (sequential)
- **System health:** Avg health <50 → 2 workers, <70 → 3 workers, ≥70 → 4 workers
- **Override:** `--no-adaptive` flag uses fixed worker count

### Adaptive Delays
- **Function:** `get_recommended_delay(source_slug)` returns delay in seconds
- **Base:** 1 second
- **Scaling:** 5+ failures → 10s, 3-4 failures → 5s, 1-2 failures → 2s
- **Applied:** Before each source crawl with random jitter (0-0.5s)

### Network Retry Decorator (`@retry_on_network_error`)
- **Location:** `db.py`
- **Applied to:** `get_or_create_venue()`, `get_venue_by_id()`, `validate_event_title()`, `find_event_by_hash()`
- **Max retries:** 3
- **Backoff:** Exponential (0.5s, 1s, 2s)
- **Errors handled:** Errno 35/11 (resource unavailable), "Connection reset", "Resource temporarily unavailable"

### CLI Health Tools
- `python main.py --health` — Full health report (today's stats, error breakdown, unhealthy sources)
- `python main.py --circuit-status` — Circuit breaker states for all sources
- `python main.py --force` — Bypass circuit breaker for single source

### Health Report Output
- **Today's crawls:** Total, success rate, events found, error breakdown by type
- **Source distribution:** Healthy (80-100), Degraded (50-79), Unhealthy (<50)
- **Recommended workers:** Current adaptive parallelism setting
- **Unhealthy sources:** Top 10 with consecutive failures, health score, last error type

---

## Post-Crawl Lifecycle

After `run_all_sources()` completes, six automated tasks run in sequence:

### 1. Filter Refresh
- **Function:** `refresh_available_filters()` in `db.py`
- **Mechanism:** Calls PostgreSQL stored procedure via `client.rpc("refresh_available_filters")`
- **Purpose:** Update `available_filters` table for UI dropdowns
- **Data refreshed:** Available tags, categories, neighborhoods, venue types for upcoming events
- **Timing:** Immediate after crawl completion

### 2. Logo Fetching (`fetch_logos.py`)
- **Target:** `event_producers` table rows where `logo_url IS NULL`
- **Process:** Fetch producer website, extract logo from meta tags or common DOM patterns
- **Result:** Updates `logo_url` field for branding in UI
- **Stats logged:** `{success: X, failed: Y, skipped: Z}`

### 3. Event Cleanup (`event_cleanup.py` via `run_full_cleanup`)
- **Purpose:** Remove stale/invalid events
- **Targets:**
  - Past events (start_date < today)
  - Duplicate events (same content_hash)
  - Invalid records (missing required fields)
- **Parameter:** `days_to_keep=0` (removes all past events)
- **Dry run:** `--cleanup-dry-run` flag previews deletions
- **Stats logged:** Total events removed

### 4. Tag Backfill (`backfill_tags.py`)
- **Target:** Existing events missing venue-type-based tags
- **Process:** Re-runs `infer_tags()` on events in batches
- **Batch size:** 200 events per batch
- **Purpose:** Apply new tag inference rules to old events
- **Stats logged:** Number of events updated

### 5. Analytics Snapshot (`analytics.py` via `record_daily_snapshot`)
- **Target:** `analytics_snapshots` table
- **Data recorded:** Daily counts (total_upcoming_events, events_by_category, events_by_portal)
- **Purpose:** Historical trend tracking for dashboards
- **Timing:** Once per day (idempotent if run multiple times)
- **Stats logged:** Total upcoming events count

### 6. HTML Report Generation (`post_crawl_report.py` via `save_html_report`)
- **Output:** `crawlers/reports/post-crawl-YYYY-MM-DD.html`
- **Contents:**
  - Crawl summary (sources run, success/failure counts)
  - Event distribution by category/portal
  - Top venues by event count
  - Data quality metrics
  - Source health summary
- **Format:** Standalone HTML with embedded CSS
- **Use case:** Email/Slack automated reporting

### Task Failure Handling
- **Philosophy:** Post-crawl tasks are non-critical — failures logged as warnings, don't block pipeline
- **Error messages:** Prefixed with task name (e.g., "Logo fetch failed: ...", "Cleanup failed: ...")
- **Continuation:** Each task wrapped in try/except, subsequent tasks still run if one fails

### Timing Summary
Typical execution order (for ~300 sources):
1. Parallel crawl: 5-15 minutes (depends on workers, source count)
2. Filter refresh: 2-5 seconds
3. Logo fetch: 10-30 seconds
4. Event cleanup: 5-15 seconds
5. Tag backfill: 10-60 seconds (depends on event count)
6. Analytics snapshot: 2-5 seconds
7. HTML report: 3-10 seconds
**Total overhead:** ~30-120 seconds post-crawl

---

## Nashville Example Application

Applying this framework to Nashville:

### Phase 1 Sources
1. Ticketmaster API (Bridgestone Arena, Ryman, Ascend)
2. Eventbrite API
3. Nashville Scene (local alternative weekly)
4. Meetup API

### Phase 2 Major Venues
1. Bridgestone Arena
2. Ryman Auditorium
3. Grand Ole Opry
4. Ascend Amphitheater
5. Marathon Music Works
6. Brooklyn Bowl Nashville
7. Exit/In
8. The Basement East
9. Zanies Comedy Club
10. Belcourt Theatre

### Phase 3 Category Leaders
- **Music:** 3rd & Lindsley, Station Inn, The Bluebird Cafe
- **Comedy:** Zanies, Third Coast Comedy
- **Theater:** TPAC, Nashville Rep
- **Art:** Frist Art Museum, Cheekwood
- **Film:** Belcourt Theatre
- **Food:** Assembly Food Hall, Nashville Farmers' Market

### Phase 4 Niche
- Honky tonks on Broadway
- Bluegrass jams
- Songwriter rounds
- Hot chicken festivals
- Running clubs (Nashville Striders)

---

## Data Health Criteria

All entity types have defined health criteria. Every crawler, enrichment script, and import should target these standards. Run `python data_health.py` to check current health scores.

### Overall Health Score

Each entity type gets a weighted health score (0-100). System-wide health is the weighted average across all types.

| Score Range | Rating | Action |
|-------------|--------|--------|
| 90-100 | Excellent | Maintain |
| 80-89 | Good | Minor gaps to fill |
| 65-79 | Needs Attention | Prioritize enrichment |
| 50-64 | Poor | Dedicated sprint needed |
| < 50 | Critical | Blocking core features |

---

### Venues (Destinations)

Venues are the core entity — every destination a user might want to visit.

#### Field Requirements

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| name | Required | - | 100% | Must be real venue name, not address |
| slug | Required | - | 100% | Auto-generated from name |
| address | Critical | 15% | > 95% | Full street address for geocoding |
| lat/lng | Critical | 20% | > 95% | Required for map placement |
| neighborhood | Critical | 15% | > 90% | Required for neighborhood filtering |
| city | Critical | 10% | > 98% | |
| state | Critical | 5% | > 98% | |
| venue_type | Critical | 15% | > 98% | From valid taxonomy (see CLAUDE.md) |
| website | Important | 5% | > 70% | Enables image scraping, description extraction |
| image_url | Important | 10% | > 80% | Hero image for cards, sourced from website or Google |
| description | Important | 5% | > 50% | Short blurb about what the venue is |
| vibes | Nice-to-have | - | > 40% | Discovery tags from website analysis |
| hours | Nice-to-have | - | > 30% | From Google Places |
| zip | Nice-to-have | - | > 70% | |

#### Venue Quality Rules

- **No address-only names**: Venue name like "123 Main St" means we failed to find the real name
- **Coordinates must be paired**: Both lat AND lng set, or both null — never one without the other
- **Neighborhood from coordinates**: Use `determine_neighborhood()` in `venue_enrich.py` after setting lat/lng
- **venue_type from taxonomy**: Must match one of the valid types (see CLAUDE.md). Run `classify_venues.py` for cleanup
- **Image sources (priority)**: 1) Website og:image, 2) Google Places photo, 3) null (never use placeholder)

#### Enrichment Tools

| Gap | Tool | Command |
|-----|------|---------|
| Missing lat/lng, neighborhood | `venue_enrich.py` | `python3 venue_enrich.py --limit 200` |
| Address-like names | `venue_enrich.py` | `python3 venue_enrich.py --addresses --limit 50` |
| Missing vibes/price/type | `venue_enrich.py` | `python3 venue_enrich.py --website-enrich --limit 50` |
| Missing images | `scrape_venue_images.py` | `python3 scrape_venue_images.py --venue-type bar` |
| Missing images (no website) | `fetch_venue_photos_google.py` | `python3 fetch_venue_photos_google.py --limit 200` |
| Untyped/junk venues | `classify_venues.py` | `python3 classify_venues.py --dry-run` |
| Manual edge cases | `manual_classify.py` | `python3 manual_classify.py --dry-run` |

---

### Events

Events are time-bound occurrences at venues — concerts, shows, classes, festivals.

#### Field Requirements

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| title | Required | - | 100% | Validated by `validate_event_title()` |
| start_date | Required | - | 100% | |
| source_url | Required | - | 100% | Link back to original source |
| venue_id | Critical | 20% | > 98% | Links event to a venue for location |
| category | Critical | 15% | > 99% | From valid category list |
| start_time | Important | 15% | > 98% | Never infer is_all_day from missing time. Use detail enrichment stack + hydration techniques |
| description | Important | 10% | > 80% | From source, LLM extraction, or OMDB plot (film, < 80 char fallback) |
| image_url | Important | 10% | > 75% | From source, OMDB (film), or Deezer (music) |
| is_free | Important | 10% | > 95% | Boolean, inferred from price data |
| price_min | Nice-to-have | 5% | > 30% | Numeric dollar amount |
| tags | Nice-to-have | 5% | > 60% | Auto-inferred by `tag_inference.py` |
| ticket_url | Nice-to-have | 5% | > 40% | Direct link to purchase |
| end_time | Nice-to-have | 5% | > 20% | |

#### Event Quality Rules

- **No permanent attractions as events**: "Play at the Museum", "Mini Golf" are not events
- **is_all_day = true only for genuinely all-day events**: Festivals, conventions, outdoor markets. NOT for missing start_time
- **content_hash required**: Every event gets `generate_content_hash(title, venue_name, date)` for dedup
- **Future events only**: Past events are cleaned up by `event_cleanup.py`
- **Category from valid list**: music, comedy, theater, film, art, food-drink, sports, community, nightlife, fitness, family, literary, tech, outdoor, holiday, lgbtq, wellness

#### Crawler Output Requirements

Every `crawl()` function must provide at minimum:
```python
{
    "title": str,           # Required
    "start_date": str,      # Required (YYYY-MM-DD)
    "source_url": str,      # Required
    "venue_id": int,        # From get_or_create_venue()
    "category": str,        # From valid list
}
```

---

### Classes

Classes are events with `is_class = true`. They represent structured learning/fitness sessions.

#### Field Requirements (in addition to Event fields)

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| is_class | Required | - | 100% | Must be True |
| class_category | Important | 15% | > 80% | yoga, dance, art, cooking, fitness, etc. |
| price_min | Important | 15% | > 90% | Classes almost always have a price |
| image_url | Important | 10% | > 90% | |
| description | Important | 15% | > 50% | What the class covers |
| instructor | Nice-to-have | 5% | > 30% | |
| skill_level | Nice-to-have | 5% | > 20% | beginner, intermediate, advanced, all-levels |

---

### Series

Series group related recurring events (weekly shows, film series, residencies).

#### Field Requirements

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| title | Required | - | 100% | |
| series_type | Required | - | 100% | film, recurring_show, residency, festival |
| category | Critical | 15% | > 99% | |
| description | Important | 20% | > 50% | What the series is about |
| image_url | Important | 20% | > 50% | Representative image |
| genres | Important | 15% | > 30% | From Deezer (music) or OMDB (film) |
| frequency | Nice-to-have | 10% | > 40% | weekly, monthly, etc. |

#### Series Quality Rules

- **Genres on series, not events**: When an event belongs to a series, genres go on the series record
- **Auto-created via series_hint**: Crawlers provide `series_hint` dict to `insert_event()`, series created automatically
- **Film series**: Should have director, runtime, year from OMDB

---

### Festivals

Festivals are annual/recurring large-scale events with their own identity.

#### Field Requirements

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| name | Required | - | 100% | |
| slug | Required | - | 100% | |
| website | Critical | 20% | > 95% | |
| description | Critical | 20% | > 90% | What the festival is, why attend |
| image_url | Critical | 20% | > 90% | Hero/promotional image |
| typical_month | Important | 10% | > 80% | When it usually happens |
| location | Important | 10% | > 80% | Where it takes place |
| categories | Important | 10% | > 80% | music, food, art, etc. |
| festival_type | Nice-to-have | 5% | > 60% | |
| organization_id | Nice-to-have | 5% | > 50% | Link to organizing body |

#### Festival Quality Rules

- **Festivals should be showcase content**: These are high-visibility entities — descriptions and images are mandatory for good UX
- **Dates**: Track both last year's dates and announced upcoming dates
- **Not just event listings**: A festival record represents the festival itself, not individual events within it

---

### Organizations

Organizations are entities that host events but aren't destinations themselves.

#### Field Requirements

| Field | Priority | Weight | Target | Notes |
|-------|----------|--------|--------|-------|
| name | Required | - | 100% | |
| slug | Required | - | 100% | |
| org_type | Critical | 15% | > 98% | arts, community, sports, government, etc. |
| city | Critical | 10% | > 95% | |
| description | Important | 20% | > 85% | What the org does |
| website | Important | 15% | > 80% | |
| logo_url | Important | 15% | > 60% | From website scraping or meta tags |
| neighborhood | Nice-to-have | 10% | > 50% | |
| email | Nice-to-have | 5% | > 30% | |
| categories | Nice-to-have | 10% | > 60% | |

#### Organization Quality Rules

- **Not a venue**: If people go there as a destination, it's a venue, not an organization
- **org_type taxonomy**: arts, community, sports, government, education, media, advocacy, religious, professional
- **Logo from website**: Use `fetch_logos.py` post-crawl task to fill logo_url from website meta tags

---

### Data Quality Monitoring (Events)

#### Health Thresholds

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `missing_description` | < 15% | 15-25% | > 25% |
| `missing_image` | < 20% | 20-30% | > 30% |
| `missing_start_time` | < 2% | 2-5% | > 5% |
| `missing_category` | 0% | > 0% | > 0% |
| `categorized_other` | < 2% | 2-5% | > 5% |
| `avg_extraction_confidence` | > 0.75 | 0.65-0.75 | < 0.65 |
| `missing_genres` (music/film) | < 25% | 25-40% | > 40% |
| `duplicate_rate` | < 5% | 5-20% | > 20% |

### Weekly Health Queries

**Category distribution** — watch for imbalances:
```sql
SELECT category, COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM events WHERE start_date >= CURRENT_DATE
GROUP BY category ORDER BY count DESC;
```

**Duplicate detection:**
```sql
SELECT title, start_date, v.name as venue, COUNT(*) as dupes,
  ARRAY_AGG(e.id ORDER BY e.id) as event_ids
FROM events e JOIN venues v ON v.id = e.venue_id
WHERE e.start_date >= CURRENT_DATE
GROUP BY title, start_date, v.name
HAVING COUNT(*) > 1 ORDER BY COUNT(*) DESC;
```

**Missing data by source** — find crawlers producing incomplete events:
```sql
SELECT s.name as source, COUNT(*) as missing_count
FROM events e JOIN sources s ON s.id = e.source_id
WHERE e.start_date >= CURRENT_DATE
  AND (e.description IS NULL OR LENGTH(e.description) < 50)
GROUP BY s.name ORDER BY missing_count DESC LIMIT 10;
```

**Source health** — find broken or underperforming crawlers:
```sql
SELECT s.name, COUNT(cl.id) as crawl_count,
  AVG(cl.events_found) as avg_events,
  SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
  MAX(cl.started_at) as last_crawl
FROM sources s LEFT JOIN crawl_logs cl ON s.id = cl.source_id
GROUP BY s.id, s.name ORDER BY success_rate, avg_events DESC;
```

**Flag sources with:** success rate < 90%, zero events on recent crawls, or last crawl > 7 days ago.

### Red Flags

1. **Sudden duplicate spike** — content_hash logic may be broken in a crawler
2. **Category constraint violations** — crawler producing non-standard categories
3. **Extraction confidence drop** — LLM extraction failing, check API keys/limits
4. **Missing data trending up** — new sources lacking complete data or image/poster APIs broken
5. **Missing start_time > 2%** — detail enrichment stack may be broken, check heuristic/LLM extractors. Run description text mining and Playwright re-fetch hydration as backfill
6. **Cinema events missing descriptions** — check that cinema profiles have `defaults.category: film` set, otherwise OMDB enrichment won't trigger

### When to Run Full Audit

Trigger a comprehensive audit after:
- Adding a new crawler
- Modifying extraction prompts
- Changing category definitions
- Database migrations affecting events table
- Switching LLM models
- Major changes to deduplication logic

---

## Common Pipeline Failure Patterns

### Pattern 1: NameError on `soup` (Hardcoded Crawlers)

Crawlers that generate events from hardcoded data (book clubs, recurring events) but
still reference `soup` from a copy-pasted template. The crawler crashes before inserting
any events. **Fix:** Remove `extract_image_url(soup)` or set image_url to None.

### Pattern 2: Missing venue_id

Online events, away games, or poorly-extracted venue data result in `venue_id=None`.
Events exist in DB but are unfilterable by location. **Fix:** Use `get_or_create_virtual_venue()`
as fallback for online/virtual events. Ensure venue extraction always provides at minimum a name.

### Pattern 3: 404 / Site Restructured

Website drops its `/events` page or restructures URLs. Crawler errors on every run.
**Fix:** Visit base URL, find new events page, update `EVENTS_URL`. If no public events
page exists, mark source as inactive.

### Pattern 4: Missing Coordinates

Venue created with vague address ("Atlanta, GA") or geocoding not run. Events at this
venue are invisible on the map. **Fix:** Run geocoding script, or manually add lat/lng.
Both lat and lng should be set or both null — never one without the other.

### Recommended Guards

```python
# Validate before inserting any event
def validate_event(event: dict) -> list[str]:
    errors = []
    if not event.get("title"): errors.append("Missing title")
    if not event.get("start_date"): errors.append("Missing start_date")
    if not event.get("venue_id"): errors.append("Missing venue_id")
    if event.get("price_min") and event.get("price_max"):
        if event["price_min"] > event["price_max"]:
            errors.append("price_min > price_max")
    return errors
```

---

## Coverage Analysis Methodology

### Per-Capita Coverage

Use venues per 10,000 population to compare areas fairly:

| Region | Population | Venues | Venues/10k | Index |
|--------|-----------|--------|------------|-------|
| ITP | ~800k | 721 | 9.0 | 100 (baseline) |
| OTP | ~5.2M | 178 | 0.3 | 3.7 |
| Decatur | ~50k | 39 | 7.8 | 87 |

**Key insight from Atlanta:** OTP had 27x less coverage per capita than ITP despite 85% of metro population. OTP venues were actually *more active* per venue (33% of events from 18% of venues).

### Coverage Bias Indicators

Watch for these signs of geographic bias:
- More than 70% of venues in one region
- Any city with 50k+ population having < 5 venues
- Source crawler distribution heavily skewed to one area

### Source Activity Analysis

In Atlanta, only 14% of sources produced events in a 30-day window. This is normal —
many sources are seasonal, inactive between events, or covering venues with infrequent
programming. Focus energy on high-volume, year-round sources.

### Crawler Success Rates by Type

From Atlanta expansion data:

| Crawler Type | Success Rate | Common Issues |
|--------------|-------------|---------------|
| City calendars | 90% | Cloudflare protection |
| Eventbrite orgs | 95% | API changes |
| Venue websites | 80% | JS rendering, varied formats |
| Arts organizations | 85% | Small sites, inconsistent |
| Bars/restaurants | 75% | Events often on social media only |
