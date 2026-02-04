# City Onboarding Playbook

A step-by-step operational guide to launching comprehensive event coverage in a new city.

---

## Overview

**Timeline:** 4-6 weeks to full coverage
**Goal:** 1000+ events across 15+ categories with 50+ unique venues

### Success Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Total Events | 1000+ | Events in DB with future dates |
| Category Coverage | 15+ categories | Distinct categories represented |
| Venue Count | 50+ | Unique venues in system |
| Days Forward | 30+ | Events scheduled 30+ days out |
| Data Quality | 75%+ | Average completeness score |
| Crawl Success | 95%+ | Successful crawl rate |

---

## Phase 0: Research & Discovery (Days 1-3)

### Step 0.1: Geographic Definition

**Action:** Define the metro area boundaries

```
Inputs needed:
- City center coordinates (lat/lng)
- Metro radius (typically 25-50 miles)
- Key neighborhoods/districts to include
- Suburban areas with venues
```

**Deliverable:** Geographic config
```python
CITY_CONFIG = {
    "name": "Nashville",
    "state": "TN",
    "center_lat": 36.1627,
    "center_lng": -86.7816,
    "radius_miles": 30,
    "neighborhoods": [
        "Downtown", "East Nashville", "The Gulch", "Germantown",
        "12 South", "Hillsboro Village", "Music Row", "Midtown",
        "Berry Hill", "Marathon Village", "Wedgewood-Houston"
    ],
    "timezone": "America/Chicago"
}
```

### Step 0.2: Source Discovery Research

**Action:** Systematic research to identify all event sources

#### 0.2.1: Aggregator Discovery
Search queries to run:
- "[City] events calendar"
- "[City] things to do this week"
- "[City] alternative weekly newspaper"
- "[City] events guide"
- "what's happening in [City]"

**Document each aggregator found:**
| Source | URL | Type | Est. Events | Notes |
|--------|-----|------|-------------|-------|
| Nashville Scene | nashvillescene.com | Alt weekly | 100-200 | Local trusted source |
| Visit Nashville | visitmusiccity.com | Tourism | 50-100 | Tourist-focused |
| Nashville Guru | nashvilleguru.com | Blog | 50-100 | Local blog |

#### 0.2.2: Venue Discovery by Category

**Use this research template for each category:**

```
CATEGORY: Live Music
Search queries:
- "[City] live music venues"
- "[City] concert halls"
- "best [City] music clubs"
- "[City] where to see live music"
- "r/[City] live music" (Reddit)

Sources to check:
- Google Maps search for "live music" in area
- Yelp "Music Venues" category
- TripAdvisor "Concerts & Shows"
- Local subreddit recommendations
- "Best of [City]" awards lists
```

**Repeat for all categories:**
- [ ] Live Music - Large (arenas, amphitheaters)
- [ ] Live Music - Medium (clubs, theaters)
- [ ] Live Music - Small (bars, lounges)
- [ ] Comedy Clubs
- [ ] Theaters (Broadway, regional, community)
- [ ] Independent Cinemas
- [ ] Art Museums & Galleries
- [ ] Comedy & Improv
- [ ] Nightclubs & DJ Venues
- [ ] LGBTQ+ Venues
- [ ] Sports (pro, college, minor league)
- [ ] Convention/Event Centers
- [ ] Food Halls & Markets
- [ ] Breweries & Distilleries
- [ ] Bookstores with Events
- [ ] Libraries
- [ ] Universities & Colleges
- [ ] Outdoor/Parks
- [ ] Dance Studios
- [ ] Fitness (running clubs, yoga, etc.)
- [ ] Cultural Centers
- [ ] Religious/Spiritual Venues

#### 0.2.3: Technical Reconnaissance

**For each discovered source, document:**

```
SOURCE: Ryman Auditorium
URL: ryman.com
Calendar URL: ryman.com/calendar

Technical Analysis:
- [ ] Check for API (Network tab in DevTools)
- [ ] Check for JSON-LD (View source, search "application/ld+json")
- [ ] Test if JS-rendered (disable JS, see if events load)
- [ ] Identify CMS (WordPress, Squarespace, custom)
- [ ] Check robots.txt for restrictions
- [ ] Identify ticketing platform (Ticketmaster, AXS, etc.)

Result:
- Approach: Playwright (JS-rendered calendar)
- Confidence: 0.85
- Est. Events: 150-200/year
- Priority: High (iconic venue)
```

### Step 0.3: Create Source Inventory

**Deliverable:** Complete source spreadsheet

| Priority | Source Name | URL | Category | Type | Tech Approach | Est. Events | Status |
|----------|-------------|-----|----------|------|---------------|-------------|--------|
| 1 | Ticketmaster | API | All | API | ticketmaster.py | 500+ | Template exists |
| 1 | Eventbrite | API | All | API | eventbrite.py | 200+ | Template exists |
| 1 | Nashville Scene | nashvillescene.com | All | Aggregator | Playwright | 100-200 | Need to build |
| 2 | Ryman Auditorium | ryman.com | Music | Venue | Playwright | 150-200 | Need to build |
| 2 | Bridgestone Arena | bridgestonearena.com | Music/Sports | Venue | Playwright | 100-150 | Need to build |
| ... | ... | ... | ... | ... | ... | ... | ... |

---

## Phase 1: Foundation Setup (Days 4-7)

### Step 1.1: Database Configuration

**Action:** Add city to database

```sql
-- Add city record (if using city table)
INSERT INTO cities (name, state, slug, center_lat, center_lng, radius_miles, timezone)
VALUES ('Nashville', 'TN', 'nashville', 36.1627, -86.7816, 30, 'America/Chicago');

-- Add neighborhood records
INSERT INTO neighborhoods (city_id, name, slug) VALUES
(city_id, 'Downtown', 'downtown'),
(city_id, 'East Nashville', 'east-nashville'),
(city_id, 'The Gulch', 'the-gulch'),
-- ... etc
```

### Step 1.2: Configure API Sources

**Action:** Set up high-volume API crawlers

#### 1.2.1: Ticketmaster Setup
```python
# In config or .env
TICKETMASTER_MARKETS = {
    "nashville": {
        "market_id": "222",  # Nashville DMA
        "lat": 36.1627,
        "lng": -86.7816,
        "radius": 30
    }
}
```

**Validation:** Run Ticketmaster crawler, expect 300-500 events

#### 1.2.2: Eventbrite Setup
```python
# Configure Eventbrite search
EVENTBRITE_CITIES = {
    "nashville": {
        "location.address": "Nashville, TN",
        "location.within": "30mi"
    }
}
```

**Validation:** Run Eventbrite crawler, expect 100-300 events

#### 1.2.3: Meetup Setup
```python
# Configure Meetup search
MEETUP_LOCATIONS = {
    "nashville": {
        "lat": 36.1627,
        "lon": -86.7816,
        "radius": 30
    }
}
```

**Validation:** Run Meetup crawler, expect 50-100 events

### Step 1.3: Build Local Aggregator Crawler

**Action:** Create crawler for the city's primary event calendar

Every major city has a "Creative Loafing equivalent" - find it and build a comprehensive crawler:

**Research pattern:**
1. Identify the local alt-weekly or event guide
2. Map all category/filter URLs
3. Build Playwright crawler with:
   - Main events page
   - All category subpages
   - Date filter variations (this week, weekend, this month)
   - Pagination/infinite scroll handling

**Template structure:**
```python
CATEGORY_URLS = [
    f"{BASE_URL}/events",
    f"{BASE_URL}/events?category=music",
    f"{BASE_URL}/events?category=comedy",
    f"{BASE_URL}/events?category=arts",
    f"{BASE_URL}/events?category=food",
    f"{BASE_URL}/events?category=nightlife",
    f"{BASE_URL}/events?category=sports",
    f"{BASE_URL}/events?category=community",
]

TIME_FILTERS = [
    f"{BASE_URL}/events?when=today",
    f"{BASE_URL}/events?when=this-week",
    f"{BASE_URL}/events?when=this-weekend",
    f"{BASE_URL}/events?when=this-month",
]
```

**Validation:** Expect 100-200 events from a good local aggregator

### Step 1.4: Phase 1 Checkpoint

**Run all Phase 1 crawlers and validate:**

```bash
python main.py --source ticketmaster-nashville
python main.py --source eventbrite-nashville
python main.py --source meetup-nashville
python main.py --source nashville-scene
```

**Expected results:**
| Source | Expected | Actual | Status |
|--------|----------|--------|--------|
| Ticketmaster | 300-500 | ___ | ✓/✗ |
| Eventbrite | 100-300 | ___ | ✓/✗ |
| Meetup | 50-100 | ___ | ✓/✗ |
| Local Aggregator | 100-200 | ___ | ✓/✗ |
| **Total** | **550-1100** | ___ | |

---

## Phase 2: Major Venue Crawlers (Days 8-14)

### Step 2.1: Identify "Top 10" Venues

**Action:** Select the most important venue in each major category

Selection criteria:
1. Event volume (more events = higher priority)
2. Cultural significance (iconic venues)
3. Ticketing platform (already covered by Ticketmaster? Lower priority)
4. Data quality opportunity (direct source = better data)

**Example Top 10 for Nashville:**
| Rank | Venue | Category | Covered by TM? | Priority |
|------|-------|----------|----------------|----------|
| 1 | Ryman Auditorium | Music | Yes, but direct is better | High |
| 2 | Grand Ole Opry | Music | Yes | Medium |
| 3 | Bridgestone Arena | Arena | Yes | Medium |
| 4 | Ascend Amphitheater | Amphitheater | Yes | Medium |
| 5 | TPAC | Theater | Partial | High |
| 6 | Marathon Music Works | Music | Partial | High |
| 7 | Exit/In | Music | No | High |
| 8 | The Basement East | Music | No | High |
| 9 | Zanies Comedy | Comedy | No | High |
| 10 | Belcourt Theatre | Film | No | High |

### Step 2.2: Build Venue Crawlers

**Action:** Create crawlers for each major venue

#### Crawler Development Workflow:

**For each venue:**

1. **Analyze the site (30 min)**
   ```
   - Visit the events/calendar page
   - Open DevTools Network tab
   - Check for API calls
   - View page source for JSON-LD
   - Test with JS disabled
   - Identify date navigation patterns
   ```

2. **Choose template (5 min)**
   - Theater/Cinema with showtimes → `plaza_theatre.py` pattern
   - Music venue with event list → `terminal_west.py` pattern
   - JS-rendered calendar → Playwright base
   - Static HTML → BeautifulSoup base

3. **Build crawler (1-2 hours)**
   ```python
   # Standard structure:

   VENUE_DATA = {
       "name": "Venue Name",
       "slug": "venue-slug",
       "address": "123 Main St",
       "neighborhood": "Downtown",
       "city": "Nashville",
       "state": "TN",
       "zip": "37201",
       "venue_type": "music_venue",
       "website": BASE_URL,
   }

   def crawl(source: dict) -> tuple[int, int, int]:
       # Implementation
   ```

4. **Test crawler (30 min)**
   ```bash
   python main.py --source venue-slug --dry-run
   ```

5. **Validate data quality (15 min)**
   - Check event titles make sense
   - Verify dates are correct
   - Confirm times are parsed properly
   - Review category assignments

6. **Register in main.py (5 min)**
   ```python
   SOURCE_MODULES = {
       # ...
       "venue-slug": "sources.venue_name",
   }
   ```

### Step 2.3: Venue Crawler Patterns

**Pattern A: Theater/Cinema with Showtimes**
```python
# Key features:
# - Date picker navigation (click through days)
# - Multiple showtimes per film/show
# - Coming Soon / Now Playing sections
# - Unique hash per showtime: title|date|time

# Example flow:
1. Load main calendar page
2. Extract today's shows
3. Click each future day (7-14 days)
4. Extract shows for each day
5. Load "Coming Soon" page
6. Extract upcoming releases
```

**Pattern B: Music Venue Event List**
```python
# Key features:
# - Chronological event listing
# - One event per date (usually)
# - Doors time vs show time
# - Ticket links
# - Support acts

# Example flow:
1. Load events page
2. Find event cards/rows
3. Extract: title, date, time, price, ticket URL
4. Handle pagination if present
```

**Pattern C: Multi-Purpose Venue**
```python
# Key features:
# - Multiple event types
# - Category-based filtering
# - Different pages for different event types

# Example flow:
1. Load main events page
2. Extract events from each category tab
3. Combine and deduplicate
```

### Step 2.4: Phase 2 Checkpoint

**After building Top 10 venue crawlers:**

| Venue | Expected | Actual | Quality Score |
|-------|----------|--------|---------------|
| Venue 1 | 50-100 | ___ | ___% |
| Venue 2 | 30-60 | ___ | ___% |
| ... | ... | ... | ... |
| **Total Phase 2** | **200-400** | ___ | |

**Cumulative:** Should now have 750-1500 events

---

## Phase 3: Category Deep-Dive (Days 15-25)

### Step 3.1: Category Gap Analysis

**Action:** Identify categories with insufficient coverage

```python
# Query to check category distribution
SELECT category, COUNT(*) as event_count
FROM events
WHERE city = 'nashville' AND start_date >= CURRENT_DATE
GROUP BY category
ORDER BY event_count DESC;
```

**Target distribution:**
| Category | Target % | Target Count | Actual | Gap |
|----------|----------|--------------|--------|-----|
| music | 25-30% | 250-300 | ___ | ___ |
| theater | 10-15% | 100-150 | ___ | ___ |
| comedy | 5-8% | 50-80 | ___ | ___ |
| film | 5-8% | 50-80 | ___ | ___ |
| art | 5-8% | 50-80 | ___ | ___ |
| food_drink | 8-12% | 80-120 | ___ | ___ |
| nightlife | 8-12% | 80-120 | ___ | ___ |
| sports | 5-10% | 50-100 | ___ | ___ |
| community | 10-15% | 100-150 | ___ | ___ |
| fitness | 3-5% | 30-50 | ___ | ___ |
| family | 5-8% | 50-80 | ___ | ___ |

### Step 3.2: Fill Category Gaps

**For each under-represented category:**

1. **Identify 3-5 additional sources**
2. **Prioritize by event volume**
3. **Build crawlers**
4. **Validate coverage improvement**

**Category-specific source patterns:**

| Category | Source Types to Target |
|----------|----------------------|
| music | Additional venues, promoter calendars, radio station events |
| comedy | Open mic venues, improv theaters, comedy festivals |
| theater | Community theaters, university theaters, dinner theaters |
| film | Film festivals, outdoor screenings, film societies |
| art | Gallery collectives, art walks, artist studios |
| food_drink | Food festivals, brewery tours, cooking classes |
| nightlife | DJ collectives, club promoters, late-night venues |
| sports | Minor league teams, college athletics, running clubs |
| community | Libraries, community centers, volunteer orgs |
| fitness | Yoga studios, climbing gyms, dance studios |
| family | Children's museums, zoos, family entertainment centers |

### Step 3.3: Build Supplementary Crawlers

**Aim for 3-5 sources per category that needs more coverage**

Each crawler should follow the standard pattern:
1. VENUE_DATA with complete address
2. Appropriate technical approach
3. Category and tag assignment
4. Quality validation

### Step 3.4: Phase 3 Checkpoint

**Category coverage should now be balanced:**

```sql
-- Check distribution
SELECT category,
       COUNT(*) as count,
       ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
FROM events
WHERE city = 'nashville' AND start_date >= CURRENT_DATE
GROUP BY category
ORDER BY count DESC;
```

---

## Phase 4: Community & Niche Sources (Days 26-35)

### Step 4.1: Community Authenticity Layer

**Action:** Add sources that provide local authenticity

These sources may not have high event volumes but are important for:
- Representing the real local scene
- Capturing recurring community events
- Including underrepresented communities
- Finding hidden gems

**Source types to include:**

#### 4.1.1: Recurring Weekly Events
```
Search for:
- "[City] weekly trivia"
- "[City] open mic nights"
- "[City] karaoke nights"
- "[City] dance nights"
- "[City] game nights"

These often aren't on aggregators but are community staples.
```

#### 4.1.2: Cultural & Community Organizations
```
Research:
- Cultural centers (Hispanic, Asian, African, etc.)
- LGBTQ+ organizations and venues
- Religious/spiritual venues with public events
- Immigrant community organizations
- Senior centers with programming
```

#### 4.1.3: Hobby & Interest Groups
```
Find:
- Running clubs
- Cycling groups
- Book clubs with public events
- Gaming communities
- Maker spaces
- Photography groups
```

#### 4.1.4: Outdoor & Recreation
```
Identify:
- Parks department event calendar
- Nature centers
- Hiking/outdoor clubs
- Kayak/paddle groups
- Urban farming/gardens
```

### Step 4.2: Neighborhood-Level Sources

**Action:** Ensure coverage across all neighborhoods

For each major neighborhood:
- Is there a neighborhood association with events?
- Are there neighborhood-specific venues covered?
- Are community events captured?

### Step 4.3: Seasonal & Festival Sources

**Action:** Identify annual events that need special handling

```
Document:
- Major festivals (dates, websites)
- Seasonal event series (summer concerts, holiday markets)
- Annual fundraisers/galas
- Cultural celebrations
- Sports seasons
```

Some of these may need:
- Manual entry
- Annual crawler activation
- Special crawl scheduling

---

## Phase 5: Quality Assurance (Days 36-40)

### Step 5.1: Data Quality Audit

**Action:** Systematic review of event data quality

#### 5.1.1: Completeness Check
```sql
SELECT
    source_name,
    COUNT(*) as total_events,
    AVG(CASE WHEN start_time IS NOT NULL THEN 1 ELSE 0 END) as has_time_pct,
    AVG(CASE WHEN description IS NOT NULL THEN 1 ELSE 0 END) as has_desc_pct,
    AVG(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) as has_image_pct,
    AVG(CASE WHEN price_min IS NOT NULL OR is_free = true THEN 1 ELSE 0 END) as has_price_pct
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE city = 'nashville'
GROUP BY source_name
ORDER BY total_events DESC;
```

#### 5.1.2: Accuracy Spot Check
For each source, manually verify 5 random events:
- [ ] Title is correct
- [ ] Date is correct
- [ ] Time is correct
- [ ] Venue is correct
- [ ] Category makes sense

#### 5.1.3: Duplicate Analysis
```sql
-- Check for potential duplicates
SELECT title, start_date, COUNT(*) as count
FROM events
WHERE city = 'nashville'
GROUP BY title, start_date
HAVING COUNT(*) > 1
ORDER BY count DESC;
```

### Step 5.2: Crawler Health Check

**Action:** Verify all crawlers are working reliably

```sql
SELECT
    s.name,
    COUNT(cl.id) as crawl_count,
    AVG(cl.events_found) as avg_events,
    SUM(CASE WHEN cl.status = 'success' THEN 1 ELSE 0 END)::float / COUNT(*) as success_rate,
    MAX(cl.started_at) as last_crawl
FROM sources s
LEFT JOIN crawl_logs cl ON s.id = cl.source_id
WHERE s.city = 'nashville'
GROUP BY s.id, s.name
ORDER BY success_rate, avg_events DESC;
```

**Flag sources with:**
- Success rate < 90%
- Zero events on recent crawls
- Last crawl > 7 days ago

### Step 5.3: Coverage Validation

**Final coverage checklist:**

| Check | Target | Actual | Status |
|-------|--------|--------|--------|
| Total future events | 1000+ | ___ | ✓/✗ |
| Events in next 7 days | 200+ | ___ | ✓/✗ |
| Events in next 30 days | 800+ | ___ | ✓/✗ |
| Unique venues | 50+ | ___ | ✓/✗ |
| Categories covered | 12+ | ___ | ✓/✗ |
| Neighborhoods covered | 10+ | ___ | ✓/✗ |
| Free events | 100+ | ___ | ✓/✗ |
| Recurring events | 50+ | ___ | ✓/✗ |

---

## Phase 6: Launch & Operations (Day 41+)

### Step 6.1: Crawl Scheduling

**Action:** Set up automated crawl schedule

**Recommended frequency by source type:**

| Source Type | Frequency | Rationale |
|-------------|-----------|-----------|
| APIs (TM, EB) | Every 6 hours | High volume, changes frequently |
| Major venues | Every 12 hours | Moderate changes |
| Local aggregators | Every 12 hours | Daily updates |
| Small venues | Daily | Fewer changes |
| Community orgs | Every 2-3 days | Infrequent updates |
| Seasonal sources | Weekly | Limited events |

### Step 6.2: Monitoring Setup

**Action:** Configure alerts and dashboards

**Key metrics to monitor:**

```python
ALERTS = {
    "crawler_failure": {
        "condition": "3 consecutive failures",
        "action": "notify"
    },
    "zero_events": {
        "condition": "expected > 10, actual = 0",
        "action": "investigate"
    },
    "low_coverage": {
        "condition": "events_next_7_days < 100",
        "action": "alert"
    },
    "duplicate_spike": {
        "condition": "duplicate_rate > 20%",
        "action": "review"
    }
}
```

### Step 6.3: Maintenance Procedures

**Weekly tasks:**
- [ ] Review crawler success rates
- [ ] Check for new venues to add
- [ ] Verify category distribution
- [ ] Spot check data quality

**Monthly tasks:**
- [ ] Audit venue data (address, hours, etc.)
- [ ] Review and update neighborhood mappings
- [ ] Analyze user engagement by source (if applicable)
- [ ] Identify underperforming crawlers

**Quarterly tasks:**
- [ ] Comprehensive source inventory review
- [ ] Add new sources discovered
- [ ] Retire defunct sources
- [ ] Update crawler patterns for site changes

---

## Appendix A: Source Research Templates

### Template: Venue Research Card

```
VENUE: _______________
Website: _______________
Events URL: _______________

BASIC INFO:
- Address: _______________
- Neighborhood: _______________
- Capacity: _______________
- Venue Type: _______________

TECHNICAL ANALYSIS:
- [ ] Has API?
- [ ] JSON-LD present?
- [ ] JS-rendered?
- [ ] Ticketing platform: _______________
- [ ] CMS: _______________

CONTENT ANALYSIS:
- Event volume estimate: ___/month
- Categories: _______________
- Has prices: Y/N
- Has images: Y/N
- Has descriptions: Y/N

CRAWLER PLAN:
- Technical approach: _______________
- Template to use: _______________
- Estimated dev time: _______________
- Priority: High/Medium/Low
```

### Template: Aggregator Research Card

```
AGGREGATOR: _______________
Website: _______________

COVERAGE:
- Geographic scope: _______________
- Categories covered: _______________
- Venue types: _______________

URL MAPPING:
- Main events: _______________
- Music: _______________
- Arts: _______________
- Comedy: _______________
- Food: _______________
- Nightlife: _______________
- Sports: _______________
- Community: _______________

TECHNICAL:
- [ ] JS-rendered?
- [ ] Infinite scroll?
- [ ] Pagination type: _______________
- [ ] Filters available: _______________

CRAWLER PLAN:
- URLs to scrape: _______________
- Pagination strategy: _______________
- Estimated events: _______________
```

---

## Appendix B: Quality Checklists

### Crawler Code Review Checklist

- [ ] VENUE_DATA has complete address
- [ ] parse_date handles all date formats on site
- [ ] parse_time handles all time formats
- [ ] Category assignment is appropriate
- [ ] Tags are relevant and consistent
- [ ] Content hash is unique per distinct event
- [ ] Error handling is robust
- [ ] Logging is informative
- [ ] Timeout values are reasonable
- [ ] Rate limiting is respectful

### Event Data Quality Checklist

- [ ] Title is readable and meaningful
- [ ] Date is in the future
- [ ] Time is properly formatted (HH:MM)
- [ ] Venue exists and is correct
- [ ] Category matches event type
- [ ] No duplicate detection issues
- [ ] Source URL is valid
- [ ] Image URL (if present) loads

---

## Appendix C: Common Issues & Solutions

### Issue: Site structure changed
**Symptoms:** Zero events, parsing errors
**Solution:** Review site, update selectors, test

### Issue: Rate limiting
**Symptoms:** 429 errors, blocked requests
**Solution:** Add delays, reduce frequency, rotate user agents

### Issue: JavaScript timing
**Symptoms:** Missing events, partial data
**Solution:** Increase wait times, add explicit waits for elements

### Issue: Date parsing failures
**Symptoms:** Events with wrong dates, skipped events
**Solution:** Add new date format to parse_date function

### Issue: Duplicate events
**Symptoms:** Same event multiple times
**Solution:** Review content hash logic, check deduplication

### Issue: Category misassignment
**Symptoms:** Events in wrong categories
**Solution:** Improve determine_category keywords, use source hints

---

## Appendix D: Expansion Learnings from Atlanta

Real-world lessons from 12 expansion sessions covering 28 ITP neighborhoods and 7 OTP cities.

### Lesson 1: Unify Neighborhood Data First

Before expanding, we discovered 5 different neighborhood lists with inconsistent data
(e.g., "Virginia Highland" vs "Virginia-Highland", "Westside" vs "West Midtown"). This
caused silent mismatches during crawling and filtering.

**Fix:** Create a single source of truth (`web/config/neighborhoods.ts`) with:
- Canonical neighborhood list with metadata (lat/lng, tier, description)
- Derived exports for different consumers (full list, preferences-only, submission form)
- Alias map for common abbreviations (VaHi, EAV, O4W, L5P)
- `normalizeNeighborhoodName()` function — always normalize before comparing or storing

**Rule:** Do this infrastructure work *before* building neighborhood crawlers for a new city.

### Lesson 2: Neighborhood Types Need Different Approaches

| Neighborhood Type | Primary Sources | Example |
|-------------------|----------------|---------|
| Affluent residential | Civic associations, tour of homes, annual festivals | Virginia-Highland, Morningside, Ansley Park |
| Nightlife/commercial | Individual venue crawlers (already exist) | Cheshire Bridge, Edgewood |
| Historic/cultural | Museums, heritage orgs, cultural centers | Sweet Auburn, West End, Castleberry Hill |
| Underserved residential | NPU meetings, community organizations | Peoplestown, Pittsburgh, Mechanicsville |
| Commercial districts | Seasonal programming (summer concerts, holiday markets) | Atlantic Station, Lindbergh |
| Suburban cities | City calendars, downtown associations, annual festivals | Alpharetta, Roswell, Kennesaw |

**Key insight:** Underserved neighborhoods often lack commercial venues with scrapable
calendars. NPU (Neighborhood Planning Unit) meetings provide baseline coverage. Civic
associations and annual festivals are the most reliable sources for these areas.

### Lesson 3: Check Existing Coverage Before Building

Historic/cultural areas (Sweet Auburn, West End) often already had 10-20 crawlers from
individual venue builds. The expansion session only needed 3 gap-filling crawlers.
Always audit existing coverage before assuming a neighborhood needs new crawlers.

### Lesson 4: Predictable Recurring Events Are Gold

The most reliable sources for suburban/OTP expansion are events with predictable schedules:

| Pattern | Example | How to Implement |
|---------|---------|-----------------|
| Monthly art walks | 2nd Friday (Duluth), 1st Friday (Castleberry Hill) | `get_second_friday()`, `get_first_friday()` helpers |
| Monthly meetings | NPU-V 1st Monday, OPCA 2nd Thursday | Hardcoded recurring dates |
| Seasonal concerts | 1st Friday May-Oct, 1st Saturday Jun-Aug | Generate dates for active months |
| Annual festivals | Big Shanty (April), Snellville Days (May) | Manual or calendar-based |
| Farmers markets | Saturday mornings, seasonal windows | Recurring with active_months |

### Lesson 5: OTP Anchors Are Different from ITP

ITP anchors are typically music venues, theaters, and bars. OTP anchors are:

| OTP Anchor Type | Example | Attendance |
|-----------------|---------|------------|
| Car shows | Caffeine and Octane (Kennesaw) | 30,000+/month |
| City festivals | Snellville Days, Big Shanty | 20,000-30,000 |
| Food festivals | Taste of Acworth, Taste of Kennesaw | 10,000-18,000 |
| Seasonal markets | Roswell Farmers Market (year-round) | Weekly |
| Downtown associations | Canton Street Alive After 5 | Monthly |

### Lesson 6: Cultural Identity Drives Portal Design

Each expansion revealed distinct cultural identities that should inform portal branding:

| Identity Type | Example City | Visual Style | Key Signal |
|---------------|-------------|-------------|------------|
| Historic/Traditional | Marietta | Blue/purple, clean, corporate | Downtown square, history museums |
| Artsy/Walkable | Decatur | Orange/amber, warm, creative | Galleries, walkable streets |
| Cultural Heritage | College Park | Red/gold, warm, soulful | Soul food, Gullah-Geechee heritage |
| Diverse Suburban | Duluth | Multicultural | Korean community, Lunar New Year |
| Lake/Outdoor | Acworth | Nature-oriented | Beach, trails, outdoor concerts |

The "Curators-First" approach — researching what local food/culture writers say about
a place before building crawlers — consistently surfaced the right cultural narrative.

### Lesson 7: Expansion Session Metrics

From 12 Atlanta sessions:

| Metric | Average | Range |
|--------|---------|-------|
| Crawlers per session | 3.5 | 3-4 |
| Existing crawlers found | 3.5 | 0-20+ |
| Neighborhoods covered | 3 | 2-4 |

Total: 42 new crawlers covering 28 ITP neighborhoods + 7 OTP cities, built on top of
~100 existing crawlers discovered during audit phases.

### Lesson 8: Curator Value Rankings

| Curator Source | Value | Why |
|----------------|-------|-----|
| Eater (city) | Very High | Pre-organized by category, quality vetted |
| City Magazine | Very High | Cultural narrative, "Best of" awards |
| The Infatuation | High | Good descriptions, personality |
| Local food blogs | Medium | Hit or miss quality |
| TripAdvisor | Medium | Volume but less curation |
| Tourism boards | Medium | Official but sometimes generic |

### Lesson 9: Portal Data Isolation

When expanding to a new city portal, ensure source `owner_portal_id` is set correctly.
Events inherit portal_id from their source via a database trigger. If a Nashville source
gets assigned the Atlanta portal_id, those events leak into the Atlanta feed. This
happened with 4 Nashville sources (311 events).

**Rule:** Always verify `owner_portal_id` on new sources matches the correct city portal.

---

## Appendix E: Portal Isolation Model

LostCity uses a multi-city architecture where each city has its own "portal" with isolated event data. Portal isolation must be enforced at **three layers**: crawler, database, and API.

### Three-Layer Isolation

```
LAYER 1 - CRAWLER: Set portal_id explicitly on every event_record
    ↓
LAYER 2 - DATABASE: Trigger inherits portal_id from source (backup)
    ↓
LAYER 3 - API: Every query that returns events MUST filter by portal_id
```

**All three layers are required.** Relying on any single layer alone will lead to data leakage.

### Layer 1: Crawler-Side Portal Assignment

Every crawler for a non-default city MUST:

1. Import `get_portal_id_by_slug` from `db`
2. Define `PORTAL_SLUG` constant
3. Lookup portal_id at the start of `crawl()`
4. Include `portal_id` in every event_record

```python
from db import get_or_create_venue, insert_event, find_event_by_hash, get_portal_id_by_slug

PORTAL_SLUG = "nashville"  # Must match portals.slug in database

def crawl(source: dict) -> tuple[int, int, int]:
    source_id = source["id"]
    portal_id = get_portal_id_by_slug(PORTAL_SLUG)

    # ... crawl logic ...

    event_record = {
        "source_id": source_id,
        "venue_id": venue_id,
        "portal_id": portal_id,  # REQUIRED for non-default portals
        "title": title,
        # ... rest of fields
    }
```

### Layer 2: Database Trigger (Backup)

Migration 107 creates a trigger that auto-populates `events.portal_id` from `sources.owner_portal_id` when an event is inserted with NULL portal_id. This is a safety net, not a primary mechanism.

```
portals table (id, slug, name, city, state)
    ↓ owner_portal_id
sources table (id, slug, name, owner_portal_id)
    ↓ source_id + TRIGGER (set_event_portal)
events table (id, title, source_id, portal_id)
```

Sources also have a constraint: `sources_active_must_have_portal` — active sources must have `owner_portal_id` set.

### Layer 3: API-Side Portal Filtering

**Every API route that queries events MUST filter by portal_id.** The standard pattern:

```typescript
// For portal-scoped requests: show portal events + public (null) events
if (portalId) {
  query = query.or(`portal_id.eq.${portalId},portal_id.is.null`);
} else {
  // No portal specified: only show public events
  query = query.is("portal_id", null);
}
```

API routes that MUST apply this filter:
- `/api/events/live` — Live events (accepts `?portal=<slug>`)
- `/api/feed` — Personalized feed (accepts `?portal=<slug>`)
- `/api/portals/[slug]/happening-now` — Portal happening now
- `/api/portals/[slug]/feed` — Portal feed
- `/api/around-me` — Nearby events (accepts `?portal=<slug>`)
- `/api/events/search` — Event search (accepts `?portal_id=<uuid>`)
- `/api/venues/[id]/events` — Venue events (accepts `?portal_id=<uuid>`)
- `/api/activities/popular` — Activity counts (accepts `?portal_id=<uuid>`)
- `/api/series/[slug]` — Series events (accepts `?portal_id=<uuid>`)
- `/api/events` — Main events endpoint (already uses search lib with portal filter)

**Secondary queries matter too.** The feed API has secondary queries for followed venues, organizations, neighborhoods, and categories. ALL of these must also filter by portal_id.

### Multi-City Aggregator Sources

Some sources cover multiple cities (Ticketmaster, Eventbrite, Meetup). Handle these with:
- Separate source records per city (e.g., "ticketmaster-nashville", "ticketmaster-atlanta")
- Each has its own `owner_portal_id`
- Geographic filtering in the crawler (lat/lng radius, market ID)

### Cross-Portal Concerns

**Venues CAN exist in multiple portals.** A touring venue or chain location might legitimately appear in multiple cities. The venues table has no portal_id constraint—venues are global entities referenced by events.

### Known Bugs (Remaining)

1. **VIRTUAL_VENUE_SLUG hardcoded to Atlanta** (db.py line ~67)
   Workaround: Virtual events currently default to Atlanta. Needs portal-aware virtual venue creation.

2. **Deduplication doesn't consider portal_id** (find_event_by_hash in db.py)
   Events with identical titles/dates/venues across cities will collide. Risk is low for city-specific crawlers, but affects national aggregators.

### Historical Issues (Resolved)

**Nashville Portal Leak (Feb 2026):** Nashville crawler files didn't set `portal_id` on event records, and the database trigger wasn't catching all cases. Events leaked into Atlanta. Fixed by:
1. Adding `PORTAL_SLUG` + `get_portal_id_by_slug()` to all 5 Nashville crawlers
2. Adding portal_id filtering to 8+ API routes (live events, feed, around-me, search, etc.)
3. Migration 111 to backfill portal_id on existing Nashville events
4. Migration 107 trigger provides defense-in-depth

### Verification Queries

```sql
-- Find events with NULL portal_id (should be zero for Nashville sources)
SELECT COUNT(*) as orphaned_events
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE s.slug LIKE '%nashville%' AND e.portal_id IS NULL;

-- List all sources for a city portal
SELECT s.slug, s.name, COUNT(e.id) as events
FROM sources s
JOIN portals p ON p.id = s.owner_portal_id
LEFT JOIN events e ON e.source_id = s.id
WHERE p.slug = 'nashville'
GROUP BY s.slug, s.name;

-- Find events in wrong portal
SELECT e.id, e.title, s.slug as source_slug,
       sp.slug as source_portal, ep.slug as event_portal
FROM events e
JOIN sources s ON s.id = e.source_id
JOIN portals sp ON sp.id = s.owner_portal_id
JOIN portals ep ON ep.id = e.portal_id
WHERE sp.id != ep.id;

-- Comprehensive portal health check
SELECT p.slug as portal,
       COUNT(DISTINCT s.id) as sources,
       COUNT(DISTINCT e.id) as events,
       COUNT(DISTINCT CASE WHEN e.portal_id IS NULL THEN e.id END) as null_portal_events
FROM portals p
LEFT JOIN sources s ON s.owner_portal_id = p.id
LEFT JOIN events e ON e.source_id = s.id
GROUP BY p.slug;
```

---

## Appendix F: Source Health Tags & Seasonal Sources

The crawler system includes a health diagnostic layer to identify problematic sources and skip seasonal sources when they're inactive.

### Health Tags Vocabulary

Defined in `database/migrations/062_source_health_tags.sql`:

| Tag | Meaning | When to Use |
|-----|---------|-------------|
| `no-events` | Source consistently returns zero events | After 3+ crawls with zero events |
| `instagram-only` | Venue only posts events on Instagram | Manual curation, no scrapable calendar |
| `facebook-events` | Events only on Facebook | Manual curation, no public calendar |
| `seasonal` | Source only active certain months | Combine with `active_months` |
| `timeout` | Crawler consistently times out | After repeated timeout errors |
| `dns-error` | Domain name resolution fails | Site moved or offline |
| `ssl-error` | SSL certificate issues | Site misconfigured |
| `parse-error` | HTML structure changed, parser broken | After parser failures |

### Active Months Schema

```python
active_months: list[int] | None  # [1, 2, 3, 10, 11, 12] for Jan-Mar, Oct-Dec
# NULL means year-round
```

Seasonal sources (haunted houses Oct-Nov, summer festivals May-Sep, holiday markets Nov-Dec) should set `health_tags = ['seasonal']` and `active_months = [10, 11]` or similar.

### Setting Health Tags

**In crawler code** (when a crawler detects its own failure):
```python
from db import update_source_health_tags

# In crawl() function after detecting issue
if events_found == 0 and previous_crawls_also_zero:
    update_source_health_tags(source['id'], ['no-events'])
```

**Manual curation** (via SQL or admin interface):
```sql
UPDATE sources
SET health_tags = ARRAY['instagram-only', 'seasonal'],
    active_months = ARRAY[10, 11]
WHERE slug = 'netherworld-haunted-house';
```

### Orchestrator Behavior

The `main.py` crawler orchestrator uses health tags and active_months to skip sources:

1. **Circuit breaker** (`circuit_breaker.py`) - Skips sources with repeated failures
2. **Health check** (`crawler_health.py`) - Uses `should_skip_crawl()` to check:
   - If current month not in `active_months`, skip
   - If `timeout` tag and recent timeout history, skip
   - If `no-events` tag and no recent success, skip (but retry occasionally)

### Database Functions

From `db.py`:

```python
def update_source_health_tags(
    source_id: int,
    health_tags: list[str],
    active_months: Optional[list[int]] = None
) -> bool:
    """Update health_tags and optionally active_months for a source."""

def get_source_health_tags(source_id: int) -> tuple[list[str], Optional[list[int]]]:
    """Get current health_tags and active_months for a source."""
```

### Finding Problem Sources

```sql
-- Sources with no events found
SELECT slug, name, health_tags, last_crawled_at
FROM sources
WHERE 'no-events' = ANY(health_tags);

-- Seasonal sources to skip this month
SELECT slug, name, active_months
FROM sources
WHERE active_months IS NOT NULL
  AND NOT (EXTRACT(MONTH FROM CURRENT_DATE)::int = ANY(active_months));

-- Sources with recent errors
SELECT slug, name, health_tags
FROM sources
WHERE health_tags && ARRAY['timeout', 'dns-error', 'ssl-error', 'parse-error'];
```

### When to Retire vs Tag

- **Tag with health_tags:** Temporary issues, seasonal patterns, awaiting fix
- **Set is_active=false:** Source permanently offline, redirects to unrelated content, legal takedown

---

## Appendix G: Venue Hours Hydration

Many venues don't publish structured hours data on their event pages, but Google Places has excellent coverage (~90%). The `hydrate_hours_google.py` script backfills missing hours.

### What It Does

Queries Google Places API for venues missing `hours` data, matches by name similarity, and updates the database with structured hours.

**Result:** Coverage went from 61% to 85% (134 of 225 Atlanta venues hydrated).

### How It Works

1. **Query venues needing hours:**
   ```python
   # Get venues with active=true, has lat/lng, but hours is NULL or empty
   venues = get_venues_needing_hours(venue_type="restaurant", limit=50)
   ```

2. **Search Google Places API:**
   ```python
   # Uses Google Places API v1 Text Search
   # Field mask: places.displayName, places.regularOpeningHours
   google = search_google_places(f"{venue['name']}, Atlanta, GA", lat, lng)
   ```

3. **Name matching with similarity scoring:**
   ```python
   def name_similarity(name1: str, name2: str) -> float:
       # Normalizes: strips "The" prefix, location suffixes, ®™© symbols
       # Returns 1.0 for exact match, 0.9 for substring, 0.8 for word overlap
       # Rejects matches < 0.6 similarity
   ```

4. **Parse regularOpeningHours into our format:**
   ```python
   # Google format:
   {
       "periods": [{"open": {"day": 1, "hour": 11, "minute": 0}, "close": {...}}],
       "weekdayDescriptions": ["Monday: 11:00 AM – 10:00 PM", ...]
   }

   # Our format:
   {
       "mon": {"open": "11:00", "close": "22:00"},
       "tue": {"open": "11:00", "close": "22:00"},
       ...
   }
   ```

5. **Update database:**
   ```python
   update_venue_hours(venue_id, hours_json, hours_display)
   ```

### Usage Flags

```bash
# Hydrate 50 destination venues (bars, restaurants, breweries, etc.)
python hydrate_hours_google.py --destinations --limit 50

# Hydrate specific venue type
python hydrate_hours_google.py --venue-type restaurant --limit 100

# Dry run (preview without updating)
python hydrate_hours_google.py --dry-run --limit 10
```

### API Requirements

- **API Key:** Set `GOOGLE_PLACES_API_KEY` in `.env` or `web/.env.local`
- **API:** Google Places API (New) - Text Search endpoint
- **Quota:** ~10 requests per second, rate-limited with 0.3s delay in script

### Multi-City Considerations

Currently hardcoded to Atlanta coordinates (line 37-39):
```python
ATLANTA_LAT = 33.749
ATLANTA_LNG = -84.388
```

**To adapt for new city:**
1. Add city-specific coordinates to `CITY_CONFIG`
2. Pass lat/lng to `search_google_places()` based on venue city
3. Adjust search query from "Atlanta, GA" to venue's actual city

### Field Mask

The script requests minimal fields to reduce API costs:
```python
FIELD_MASK = "places.id,places.displayName,places.formattedAddress,places.regularOpeningHours"
```

Only request `regularOpeningHours`—other hours types (secondaryOpeningHours, specialDays) not yet supported.

---

## Appendix H: AI Extraction System

For sources with unstructured HTML or complex layouts, the system uses Claude (Anthropic LLM) to extract structured event data instead of writing brittle parsers.

### Module: crawlers/extract.py

The extraction system provides two main functions:
- `extract_events(raw_content, source_url, source_name)` - Single-page extraction
- `extract_events_batch(items, source_name)` - Multi-page batch extraction

### LLM Configuration

```python
# From config.py
llm:
    model: "claude-3-5-sonnet-20241022"
    max_tokens: 8000
    temperature: 0.0  # Deterministic extraction
```

Each extraction call costs ~$0.01-0.05 depending on content length. Use manual parsing when data is already structured.

### Input Truncation

Raw content is truncated to **50,000 characters** (line 195 of extract.py) to fit within Claude's context window and control costs. For multi-page sources, use batch mode to extract from each page separately.

### Output Schema (Pydantic Models)

```python
class VenueData(BaseModel):
    name: str
    address: Optional[str] = None
    neighborhood: Optional[str] = None

class SeriesHint(BaseModel):
    series_type: Optional[str] = None  # film, recurring_show, class_series, etc.
    series_title: Optional[str] = None
    director: Optional[str] = None     # For films
    runtime_minutes: Optional[int] = None
    year: Optional[int] = None
    genres: list[str] = []

class EventData(BaseModel):
    title: str
    description: Optional[str] = None
    start_date: str  # ISO 8601 (YYYY-MM-DD)
    start_time: Optional[str] = None  # 24-hour (HH:MM)
    end_date: Optional[str] = None
    end_time: Optional[str] = None
    is_all_day: bool = False
    venue: VenueData
    category: str
    subcategory: Optional[str] = None
    tags: list[str] = []
    price_min: Optional[float] = None
    price_max: Optional[float] = None
    is_free: bool = False
    ticket_url: Optional[str] = None
    image_url: Optional[str] = None
    confidence: float  # 0.0-1.0
    genres: list[str] = []  # Event-level genres
    series_hint: Optional[SeriesHint] = None
```

### Event Categories (23 Total)

From the extraction system prompt (line 28):

```
music, art, comedy, theater, film, sports, food_drink, nightlife, community,
fitness, family, learning, dance, tours, meetup, words, religious, markets,
wellness, gaming, outdoors, activism, other
```

Plus subcategories for nightlife:
- `nightlife.dj` - DJ sets, dance nights
- `nightlife.drag` - Drag shows, drag brunch
- `nightlife.strip` - Strip clubs (Clermont Lounge, Magic City)
- `nightlife.burlesque` - Burlesque shows
- `nightlife.lifestyle` - Swingers clubs (Trapeze)
- `nightlife.revue` - Male revues (Swinging Richards)

### Malformed JSON Handling

Claude sometimes returns JSON with trailing commas or unquoted keys. The extraction system handles this (line 220-224):
```python
try:
    data = json.loads(json_str)
except json.JSONDecodeError:
    # Fix trailing commas before } or ]
    fixed = re.sub(r',\s*([}\]])', r'\1', json_str)
    data = json.loads(fixed)
```

### When to Use LLM Extraction vs Manual Parsing

| Source Type | Approach | Reason |
|-------------|----------|--------|
| JSON API response | Manual parsing | Structured data, no LLM needed |
| Ticketmaster API | Manual parsing | Schema is stable, cost-effective |
| JSON-LD microdata | Manual parsing | Already structured |
| Event listing with consistent HTML | BeautifulSoup | Reliable selectors, fast |
| Unstructured blog posts | LLM extraction | No consistent structure |
| Mixed event types/formats | LLM extraction | LLM handles variability |
| JS-rendered calendar with no API | Playwright + LLM | Content not in clean format |

**Cost consideration:** Each LLM call costs money. If 100 events can be parsed with BeautifulSoup selectors, that's better than 100 LLM calls.

### Batch Mode Example

```python
from extract import extract_events_batch

# Crawl multiple pages
pages = [
    (fetch_page("https://venue.com/events?page=1"), "https://venue.com/events?page=1"),
    (fetch_page("https://venue.com/events?page=2"), "https://venue.com/events?page=2"),
    (fetch_page("https://venue.com/events?page=3"), "https://venue.com/events?page=3"),
]

# Extract from all pages
events = extract_events_batch(pages, source_name="Venue Name")
# Returns combined list of EventData objects
```

### Series Detection

The LLM identifies events that are part of a series:
- **Films** at theaters (same movie, multiple showtimes)
- **Recurring shows** ("Tuesday Night Trivia", "Open Mic Monday")
- **Touring acts** (same band at multiple venues)
- **Festival programs** (DragonCon panels, film fest screenings)

When detected, the `series_hint` field helps `series.py` deduplicate and link related events.

### Extraction Quality

The extraction prompt (lines 15-107) includes strict rules:
- Never invent information
- Validate AM/PM (1-5 AM is rare except nightlife)
- Distinguish all-day events from events with unknown times
- Infer year as 2026 for dateless listings (current crawl year)
- Set confidence score based on data completeness
