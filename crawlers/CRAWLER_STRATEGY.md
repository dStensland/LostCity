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

### Tier 1: High-Volume Aggregators (Priority: First)
**Goal:** Establish baseline coverage quickly

| Source Type | Example | Expected Events | Confidence | Notes |
|-------------|---------|-----------------|------------|-------|
| Ticketing APIs | Ticketmaster, AXS | 500-1000+ | 0.95 | Best structured data, covers major venues |
| Event Aggregators | Eventbrite | 100-500 | 0.85 | Community events, varied quality |
| Local Calendars | Creative Loafing, Do512 | 50-200 | 0.75 | City-specific aggregators |
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
│   │         • Ticketmaster, Eventbrite, Meetup patterns
│   │         • Structured JSON, pagination support
│   │         • Confidence: 0.90-0.95
│   │
│   └─► NO → Continue...
│
├─► Does the site use JavaScript to load events?
│   ├─► YES → Use Playwright
│   │         • Wait for content to load
│   │         • Handle infinite scroll
│   │         • Click through date pickers
│   │         • Confidence: 0.80-0.90
│   │
│   └─► NO → Continue...
│
├─► Does the site have JSON-LD structured data?
│   ├─► YES → Parse JSON-LD first, fall back to HTML
│   │         • Look for <script type="application/ld+json">
│   │         • Schema.org Event format
│   │         • Confidence: 0.85-0.90
│   │
│   └─► NO → Use BeautifulSoup
│             • Static HTML parsing
│             • CSS selectors for event cards
│             • Confidence: 0.70-0.85
│
└─► SPECIAL CASES:
    • Theaters/Cinemas: Always use Playwright for date navigation
    • Calendars with filters: Playwright to interact with dropdowns
    • Infinite scroll: Playwright with scroll handling
```

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
