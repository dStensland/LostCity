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
