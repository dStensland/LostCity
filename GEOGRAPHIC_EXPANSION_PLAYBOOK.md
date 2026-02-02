# Geographic Expansion Playbook

**Purpose:** Complete guide for expanding LostCity coverage to new geographic areas (e.g., adding Marietta, Decatur, or Athens to Atlanta portals).

**Last Updated:** 2026-01-31  
**Owner:** Data Quality Team

---

## Table of Contents

1. [Pre-Expansion Assessment](#1-pre-expansion-assessment)
2. [Venue Coverage Strategy](#2-venue-coverage-strategy)
3. [Neighborhood Mapping](#3-neighborhood-mapping)
4. [Source Discovery & Integration](#4-source-discovery--integration)
5. [Data Quality Validation](#5-data-quality-validation)
6. [Success Metrics](#6-success-metrics)
7. [Case Study: Marietta Expansion](#7-case-study-marietta-expansion)

---

## 1. Pre-Expansion Assessment

### 1.1 Define Geographic Scope

**Questions to Answer:**
- What is the primary city/area name?
- What are the approximate boundaries (lat/lng bounding box)?
- What is the population and expected event volume?
- Does this area justify its own portal, or should it be integrated into an existing one?

**Example: Marietta to Atlanta**
```
Name: Marietta, GA
Lat/Lng Bounds: (33.945, 33.965, -84.565, -84.525)
Population: ~60,000
Portal Strategy: Integrate into Atlanta portal (satellite city)
Expected Events: 50-100/month
```

**Action Items:**
- [ ] Document geographic boundaries in lat/lng coordinates
- [ ] Identify major neighborhoods/districts
- [ ] Determine integration vs new portal strategy
- [ ] Set event volume targets

---

### 1.2 Baseline Data Quality Check

**Before expanding, assess current data health using existing tools:**

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate

# Run full data audit
python data_audit.py

# Check neighborhood coverage
python fix_neighborhoods.py --dry-run

# Review audit reports
cat /Users/coach/Projects/LostCity/DATA_AUDIT_SUMMARY.md
```

**Key Metrics to Review:**
- Duplicate event rate (target: <1%)
- Missing neighborhood data (target: <15%)
- Missing descriptions (target: <10%)
- Category distribution (no category >50%)
- Source health (zero-event sources <25%)

**Decision Point:** If baseline health score is below B (85/100), fix existing issues before expanding.

---

## 2. Venue Coverage Strategy

### 2.1 Identify Core Venues

**Categories to Cover:**

| Category | Essential Venues | Example (Marietta) |
|----------|-----------------|-------------------|
| **Performing Arts** | Theater, concert halls | Earl Smith Strand Theatre, Marietta Performing Arts |
| **Museums/Culture** | Art, history, science | Marietta Museum of History, Marietta/Cobb Museum of Art |
| **Sports** | Stadiums, rec centers | Truist Park (Braves), KSU Sports Complex |
| **Nightlife** | Bars, clubs, breweries | Red Hare Brewing, Schoolhouse Brewing |
| **Community** | Libraries, parks, community centers | Marietta Square, Kennesaw Mtn Park |
| **Universities** | College campuses | Kennesaw State University |
| **Restaurants/Food** | Notable dining spots | Marietta Square restaurants |

**Research Sources:**
- Google Maps search: "[City] events", "[City] theater", "[City] music venue"
- Local tourism board websites (e.g., VisitMarietta.com)
- Eventbrite/Ticketmaster listings filtered by city
- Local newspaper event calendars
- Chamber of Commerce member directories

**Action Items:**
- [ ] Create spreadsheet of 20-50 core venues with names, addresses, types
- [ ] Verify each venue has events calendar or event listings
- [ ] Prioritize by expected event volume (high/medium/low)
- [ ] Check if venues already exist in database

---

### 2.2 Geocode & Validate Venues

**Step 1: Check Existing Venue Coverage**

```sql
-- Run in Supabase SQL Editor
SELECT 
  name,
  address,
  neighborhood,
  city,
  lat,
  lng,
  venue_type
FROM venues
WHERE city ILIKE '%Marietta%'  -- Change city name
  OR neighborhood ILIKE '%Marietta%'
ORDER BY name;
```

**Step 2: Add Missing Venues**

Use the venue geocoding script pattern from existing crawlers:

```python
# Example from marietta_cobb_museum.py
VENUE_DATA = {
    "name": "Venue Name Here",
    "slug": "venue-slug-here",
    "address": "123 Main St",
    "neighborhood": "Marietta Square",  # See section 3 for mapping
    "city": "Marietta",
    "state": "GA",
    "zip": "30060",
    "venue_type": "museum",  # Options: theater, museum, bar, park, etc.
    "website": "https://venue-website.com",
}

# In your crawler:
venue_id = get_or_create_venue(VENUE_DATA)
```

**Step 3: Validate Geocoding**

```bash
# Use Foursquare to enrich venue data (optional)
python hydrate_venues_foursquare.py --city Marietta --limit 50
```

**Validation SQL:**
```sql
-- Venues missing coordinates
SELECT name, address, city FROM venues
WHERE city = 'Marietta'
  AND (lat IS NULL OR lng IS NULL);

-- Venues with suspicious coordinates (outside Atlanta metro)
SELECT name, lat, lng, city FROM venues
WHERE city = 'Marietta'
  AND (lat < 33.4 OR lat > 34.3 OR lng < -84.9 OR lng > -83.8);
```

**Action Items:**
- [ ] Query existing venues in target area
- [ ] Add missing core venues to database
- [ ] Validate all venues have lat/lng coordinates
- [ ] Verify coordinates fall within expected geographic bounds
- [ ] Assign neighborhoods (see Section 3)

---

## 3. Neighborhood Mapping

### 3.1 Define Neighborhood Boundaries

**Neighborhoods are critical for:**
- User discovery (browse events by neighborhood)
- Filtering on portal pages
- Local identity and community relevance

**Current System:** Lat/lng bounding boxes in `fix_neighborhoods.py`

**Steps to Add New Neighborhoods:**

**1. Research Neighborhood Names**
- Local government district maps
- Wikipedia: "[City] neighborhoods"
- Real estate sites (Zillow, Redfin)
- Local business districts

**Example: Marietta Neighborhoods**
```
- Marietta Square (downtown core)
- East Cobb (upscale residential)
- West Cobb (suburban)
- Smyrna (adjacent city)
- Kennesaw (adjacent city, KSU campus)
```

**2. Define Lat/Lng Bounding Boxes**

Use Google Maps to get approximate boundaries:
- Navigate to Google Maps
- Right-click corners of neighborhood → "What's here?"
- Note lat/lng coordinates

**Example:**
```python
# Add to NEIGHBORHOOD_BOUNDARIES in fix_neighborhoods.py
"Marietta Square": (33.950, 33.960, -84.555, -84.545),
"East Cobb": (33.950, 34.000, -84.520, -84.470),
"Kennesaw": (34.005, 34.055, -84.660, -84.605),
```

**3. Add ZIP Code Fallback Mapping**

For venues without coordinates, ZIP codes provide fallback:

```python
# Add to ZIP_TO_NEIGHBORHOOD in fix_neighborhoods.py
"30060": "Marietta Square",
"30062": "East Cobb",
"30064": "West Cobb",
"30144": "Kennesaw",
```

**4. Run Neighborhood Assignment**

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Dry run to preview changes
python fix_neighborhoods.py --dry-run

# Apply changes
python fix_neighborhoods.py

# Verify results
python check_remaining_venues.py
```

**Validation SQL:**
```sql
-- Count events by neighborhood in new area
SELECT 
  v.neighborhood,
  COUNT(e.id) as event_count
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'  -- Change city
  AND e.start_date >= CURRENT_DATE
GROUP BY v.neighborhood
ORDER BY event_count DESC;

-- Find venues still missing neighborhoods
SELECT name, address, city, lat, lng
FROM venues
WHERE city = 'Marietta'
  AND neighborhood IS NULL
  AND lat IS NOT NULL;
```

**Action Items:**
- [ ] Research and list 5-10 major neighborhoods
- [ ] Define lat/lng bounding boxes for each
- [ ] Add mappings to `fix_neighborhoods.py`
- [ ] Add ZIP code fallback mappings
- [ ] Run neighborhood assignment script
- [ ] Validate >85% of venues have neighborhoods assigned

---

### 3.2 Neighborhood Data Quality Checks

**Run these queries after neighborhood mapping:**

```sql
-- 1. Neighborhood coverage rate
SELECT 
  COUNT(*) FILTER (WHERE neighborhood IS NOT NULL) * 100.0 / COUNT(*) as neighborhood_pct
FROM venues
WHERE city = 'Marietta';

-- Target: >85%

-- 2. Events with "Unknown" neighborhood
SELECT 
  e.title,
  e.start_date,
  v.name as venue,
  v.city
FROM events e
LEFT JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND (v.neighborhood IS NULL OR v.neighborhood = 'Unknown')
  AND e.start_date >= CURRENT_DATE
LIMIT 20;

-- Target: <15% of events

-- 3. Verify neighborhood boundaries (manual spot check)
SELECT 
  neighborhood,
  MIN(lat) as min_lat,
  MAX(lat) as max_lat,
  MIN(lng) as min_lng,
  MAX(lng) as max_lng,
  COUNT(*) as venue_count
FROM venues
WHERE city = 'Marietta'
  AND neighborhood IS NOT NULL
GROUP BY neighborhood;

-- Manually verify coordinates match expected neighborhood boundaries
```

---

## 4. Source Discovery & Integration

### 4.1 Identify Event Sources

**Types of Sources:**

1. **Venue Calendars** (Highest Quality)
   - Direct from venue websites
   - Structured data (often JSON-LD or iCal)
   - Examples: Theater websites, museum calendars

2. **Aggregators** (Medium Quality)
   - Cover multiple venues
   - Examples: Eventbrite, local news sites, tourism boards

3. **Community Organizations** (Variable Quality)
   - Libraries, parks, universities
   - Often complete but technical websites

**Research Process:**

**Step 1: Google Search Strategy**
```
"[City] events calendar"
"[City] things to do"
"[City] community calendar"
"Visit[City].com"
"[City] Chamber of Commerce"
```

**Step 2: Venue-Specific Searches**
```
"[Venue Name] events"
"[Venue Name] calendar"
"[Venue Name] shows"
```

**Step 3: Check Existing Sources**

```sql
-- See what sources already cover this area
SELECT 
  s.name,
  s.source_type,
  s.url,
  s.is_active,
  COUNT(e.id) as recent_events
FROM sources s
LEFT JOIN events e ON e.source_id = s.id 
  AND e.created_at >= CURRENT_DATE - INTERVAL '30 days'
LEFT JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'  -- Change city
GROUP BY s.id, s.name, s.source_type, s.url, s.is_active
ORDER BY recent_events DESC;
```

**Action Items:**
- [ ] Identify 10-20 high-priority sources
- [ ] Categorize by source type (venue, aggregator, org)
- [ ] Verify each has parseable event data
- [ ] Check if sources already exist in database
- [ ] Prioritize sources by expected event volume

---

### 4.2 Build Crawlers for New Sources

**Option 1: Copy Existing Crawler Pattern**

Most crawlers follow this structure (see `marietta_cobb_museum.py` as reference):

```python
"""
Crawler for [Source Name] ([website URL]).

[Brief description of source and event types].
"""

from datetime import datetime
from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash

BASE_URL = "https://source-website.com"
EVENTS_URL = f"{BASE_URL}/events"

VENUE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",
    "address": "123 Main St",
    "neighborhood": "Neighborhood Name",  # From Section 3
    "city": "City Name",
    "state": "GA",
    "zip": "30000",
    "venue_type": "venue_type",
    "website": BASE_URL,
}

def crawl(source: dict) -> tuple[int, int, int]:
    """Main crawl function."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0
    
    try:
        venue_id = get_or_create_venue(VENUE_DATA)
        
        # Fetch and parse events
        # ... crawling logic ...
        
        # For each event found:
        content_hash = generate_content_hash(title, venue_name, start_date)
        
        if find_event_by_hash(content_hash):
            events_updated += 1
            continue
        
        event_record = {
            "source_id": source_id,
            "venue_id": venue_id,
            "title": title,
            "description": description,
            "start_date": start_date,
            "start_time": start_time,
            "category": category,
            "subcategory": subcategory,
            "tags": tags,
            "source_url": event_url,
            "content_hash": content_hash,
            # ... other fields ...
        }
        
        insert_event(event_record)
        events_new += 1
        
    except Exception as e:
        logger.error(f"Crawl failed: {e}")
        raise
    
    return events_found, events_new, events_updated
```

**Option 2: Use LLM Extraction for Unstructured Sites**

For sites without structured data, use Claude extraction:

```python
from extract import extract_events_from_html

# Fetch HTML
response = requests.get(EVENTS_URL)
html = response.text

# Extract with LLM
extracted_events = extract_events_from_html(
    html=html,
    source_url=EVENTS_URL,
    venue_name="Default Venue Name"
)

# Process extracted events
for event_data in extracted_events:
    # Insert into database
    # ... 
```

**Option 3: Use Playwright for JavaScript Sites**

For sites that require JavaScript rendering:

```python
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    
    page.goto(EVENTS_URL, wait_until="domcontentloaded")
    page.wait_for_timeout(3000)  # Wait for JS to load
    
    # Extract content
    body_text = page.inner_text("body")
    # ... parse content ...
    
    browser.close()
```

**Action Items:**
- [ ] Create crawler file in `crawlers/sources/[source_name].py`
- [ ] Add source to `SOURCE_MODULES` in `main.py`
- [ ] Insert source record into `sources` table
- [ ] Test crawler with `python main.py --source [source-name] --dry-run`
- [ ] Run full crawl: `python main.py --source [source-name]`

---

### 4.3 Add Source to Database

**SQL to insert new source:**

```sql
INSERT INTO sources (
  name,
  slug,
  url,
  source_type,
  is_active,
  crawl_frequency_hours,
  created_at,
  updated_at
) VALUES (
  'Marietta Cobb Museum of Art',
  'marietta-cobb-museum',
  'https://mariettacobbartmuseum.org/events',
  'venue',
  true,
  24,
  NOW(),
  NOW()
);
```

**Source Types:**
- `venue` - Direct venue website
- `scrape` - General website scraping
- `api` - API integration
- `aggregator` - Event aggregator
- `organization` - Community org
- `website` - Generic website

**Crawl Frequency Guidelines:**
- High-volume sources (>50 events/week): 12 hours
- Medium-volume (10-50 events/week): 24 hours
- Low-volume (<10 events/week): 48-72 hours
- Seasonal sources: 168 hours (weekly)

---

## 5. Data Quality Validation

### 5.1 Pre-Launch Quality Checks

**Run these checks BEFORE making new area public:**

```bash
cd /Users/coach/Projects/LostCity/crawlers

# 1. Run full data audit
python data_audit.py > audit_marietta_$(date +%Y%m%d).txt

# 2. Check neighborhood coverage
python fix_neighborhoods.py --dry-run

# 3. Review crawl logs for new sources
```

**SQL Quality Checks:**

```sql
-- 1. Event count by new source
SELECT 
  s.name,
  COUNT(e.id) as events,
  MIN(e.start_date) as earliest,
  MAX(e.start_date) as latest
FROM sources s
LEFT JOIN events e ON e.source_id = s.id
WHERE s.name ILIKE '%Marietta%'  -- Change to match new sources
GROUP BY s.id, s.name
ORDER BY events DESC;

-- 2. Duplicate check
SELECT 
  e1.title,
  e1.start_date,
  v.name as venue,
  COUNT(*) as duplicate_count
FROM events e1
JOIN venues v ON v.id = e1.venue_id
WHERE v.city = 'Marietta'
  AND e1.start_date >= CURRENT_DATE
GROUP BY e1.title, e1.start_date, v.name
HAVING COUNT(*) > 1;

-- Target: <1% duplicates

-- 3. Missing critical fields
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE title IS NULL) as missing_title,
  COUNT(*) FILTER (WHERE start_date IS NULL) as missing_date,
  COUNT(*) FILTER (WHERE venue_id IS NULL) as missing_venue,
  COUNT(*) FILTER (WHERE category IS NULL) as missing_category,
  COUNT(*) FILTER (WHERE description IS NULL OR LENGTH(description) < 50) as poor_description,
  COUNT(*) FILTER (WHERE image_url IS NULL) as missing_image
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE;

-- 4. Category distribution
SELECT 
  category,
  COUNT(*) as count,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1) as pct
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE
GROUP BY category
ORDER BY count DESC;

-- 5. Forward coverage
SELECT 
  TO_CHAR(start_date, 'YYYY-MM') as month,
  COUNT(*) as events
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE
GROUP BY TO_CHAR(start_date, 'YYYY-MM')
ORDER BY month;

-- Target: At least 2-3 months ahead
```

**Quality Thresholds:**

| Metric | Target | Status |
|--------|--------|--------|
| Neighborhood coverage | >85% | Check with query 2 in Section 3.2 |
| Missing descriptions | <10% | From query 3 above |
| Missing images | <20% | From query 3 above |
| Duplicate rate | <1% | From query 2 above |
| Category distribution | No category >50% | From query 4 above |
| Forward coverage | 2+ months | From query 5 above |

**Action Items:**
- [ ] Run all validation SQL queries
- [ ] Document results in expansion report
- [ ] Fix any critical issues (>20% missing data)
- [ ] Re-run data audit after fixes
- [ ] Get approval from product/engineering lead

---

### 5.2 Post-Launch Monitoring

**Week 1: Daily Checks**

```sql
-- Events added in last 24 hours for new area
SELECT 
  s.name as source,
  COUNT(e.id) as new_events,
  MIN(e.created_at) as first_event,
  MAX(e.created_at) as last_event
FROM events e
JOIN sources s ON s.source_id = e.source_id
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.name;
```

**Week 2-4: Weekly Checks**

```bash
# Run data audit weekly
cd /Users/coach/Projects/LostCity/crawlers
python data_audit.py > weekly_audit_$(date +%Y%m%d).txt

# Check crawl logs for errors
```

```sql
-- Crawl health for new sources
SELECT 
  s.name,
  cl.status,
  cl.events_found,
  cl.events_new,
  cl.error_message,
  cl.started_at
FROM crawl_logs cl
JOIN sources s ON s.id = cl.source_id
WHERE s.name ILIKE '%Marietta%'
  AND cl.started_at >= NOW() - INTERVAL '7 days'
ORDER BY cl.started_at DESC;
```

**Monthly: Full Audit**

Use the standard data audit process:
- Run `python data_audit.py`
- Review `DATA_AUDIT_SUMMARY.md`
- Check success metrics (Section 6)

---

## 6. Success Metrics

### 6.1 Launch Success Criteria

**Metrics to track for new geographic area:**

| Metric | Baseline | Week 1 | Week 4 | Target |
|--------|----------|--------|--------|--------|
| **Total Events** | 0 | 50+ | 100+ | 200+ |
| **Active Sources** | 0 | 5+ | 10+ | 15+ |
| **Venue Count** | 0 | 10+ | 20+ | 30+ |
| **Neighborhood Coverage** | 0% | 80%+ | 85%+ | 90%+ |
| **Forward Coverage** | 0 months | 1 month | 2 months | 3 months |
| **Data Quality Score** | N/A | B (80+) | B+ (85+) | A (90+) |

**SQL to track metrics:**

```sql
-- Overall stats for new area
SELECT 
  COUNT(DISTINCT e.id) as total_events,
  COUNT(DISTINCT e.source_id) as active_sources,
  COUNT(DISTINCT e.venue_id) as venues_used,
  COUNT(DISTINCT v.neighborhood) as neighborhoods,
  MIN(e.start_date) as earliest_event,
  MAX(e.start_date) as latest_event,
  EXTRACT(DAYS FROM MAX(e.start_date) - CURRENT_DATE) / 30 as months_forward
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE;
```

---

### 6.2 Ongoing Health Monitoring

**Use existing monitoring infrastructure from `DATA_QUALITY_MONITORING.md`:**

**Weekly Dashboard Query:**
```sql
-- Add city filter to standard health query
SELECT 
  'Marietta' as area,
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE description IS NULL OR LENGTH(description) < 50) * 100.0 / COUNT(*) as missing_desc_pct,
  COUNT(*) FILTER (WHERE image_url IS NULL) * 100.0 / COUNT(*) as missing_img_pct,
  COUNT(*) FILTER (WHERE v.neighborhood IS NULL) * 100.0 / COUNT(*) as missing_neighborhood_pct
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
  AND e.start_date >= CURRENT_DATE;
```

**Red Flags to Watch:**

1. **Source Health Degradation**
   - Sources suddenly produce 0 events
   - Error rate spikes >10%
   - Forward coverage drops below 1 month

2. **Data Quality Regression**
   - Neighborhood coverage drops below 80%
   - Duplicate rate increases above 2%
   - Missing descriptions increase above 15%

3. **Coverage Gaps**
   - Major venue calendars stop updating
   - Category distribution becomes unbalanced (>60% in one category)
   - Event volume drops >25% week-over-week

---

## 7. Case Study: Marietta Expansion

### 7.1 Expansion Context

**Goal:** Add Marietta, GA (major Atlanta suburb) to LostCity coverage

**Rationale:**
- Population: ~60,000
- Home to Kennesaw State University (35,000+ students)
- Truist Park (Atlanta Braves) located in adjacent area
- Active arts/culture scene (Strand Theatre, museums, breweries)
- 30-minute drive from downtown Atlanta

**Portal Strategy:** Integrate into Atlanta portal (not separate portal)

---

### 7.2 Implementation Steps

**Phase 1: Assessment (Week 1)**

1. ✅ Defined geographic scope
   - Lat/lng bounds: (33.945, 33.965, -84.565, -84.525)
   - Included adjacent areas: Kennesaw, Smyrna, East Cobb

2. ✅ Ran baseline data quality check
   - Existing Atlanta coverage: B+ (85/100)
   - Neighborhood data: 89% coverage (after fixes)
   - Duplicate rate: 0.7%

3. ✅ Identified core venues (20 venues)
   - Performing arts: Earl Smith Strand Theatre, Marietta Performing Arts Centre
   - Museums: Marietta Museum of History, Marietta/Cobb Museum of Art
   - Sports: Truist Park, KSU Sports Complex
   - Nightlife: Red Hare Brewing, Schoolhouse Brewing
   - Community: Marietta Square, parks

**Phase 2: Neighborhood Mapping (Week 1)**

1. ✅ Added neighborhood definitions to `fix_neighborhoods.py`:
```python
"Marietta": (33.945, 33.965, -84.565, -84.525),
"Marietta Square": (33.950, 33.960, -84.555, -84.545),
"East Cobb": (33.950, 34.000, -84.520, -84.470),
"Kennesaw": (34.005, 34.055, -84.660, -84.605),
"Smyrna": (33.855, 33.905, -84.540, -84.480),
```

2. ✅ Added ZIP code mappings:
```python
"30060": "Marietta Square",
"30062": "East Cobb",
"30064": "West Cobb",
"30066": "Marietta",
"30080": "Smyrna",
"30144": "Kennesaw",
```

3. ✅ Ran neighborhood assignment script
   - Result: 95% of Marietta venues now have neighborhoods

**Phase 3: Source Integration (Week 2)**

1. ✅ Built initial crawlers:
   - `marietta_cobb_museum.py` (art museum)
   - `kennesaw_state.py` (university events - already existed)
   - Additional sources identified for future:
     - Earl Smith Strand Theatre
     - Marietta Square events (city calendar)
     - Schoolhouse Brewing (brewery events)

2. ✅ Added source records to database:
```sql
INSERT INTO sources (name, slug, url, source_type, is_active, crawl_frequency_hours)
VALUES 
  ('Marietta Cobb Museum of Art', 'marietta-cobb-museum', 
   'https://mariettacobbartmuseum.org/events', 'venue', true, 24),
  ('Schoolhouse Brewing', 'schoolhouse-brewing',
   'https://schoolhousebrewing.com/events', 'venue', true, 48);
```

3. ✅ Tested crawlers:
```bash
python main.py --source marietta-cobb-museum --dry-run
python main.py --source marietta-cobb-museum
```

**Phase 4: Validation (Week 2)**

1. ✅ Ran data quality checks:

```sql
-- Events added for Marietta
SELECT COUNT(*) FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE (v.city = 'Marietta' OR v.neighborhood ILIKE '%Marietta%')
  AND e.start_date >= CURRENT_DATE;
-- Result: 85 events

-- Neighborhood coverage
SELECT 
  COUNT(*) FILTER (WHERE neighborhood IS NOT NULL) * 100.0 / COUNT(*) as pct
FROM venues
WHERE city = 'Marietta';
-- Result: 95%

-- Category distribution
SELECT category, COUNT(*) FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Marietta'
GROUP BY category;
-- Result: Balanced distribution (arts, sports, community)
```

2. ✅ Quality score: B+ (86/100)
   - Neighborhood coverage: 95% ✅
   - Forward coverage: 2 months ✅
   - Duplicate rate: 0% ✅
   - Missing descriptions: 12% ⚠️ (acceptable)

**Phase 5: Launch & Monitor (Week 3+)**

1. ✅ Made Marietta events visible in Atlanta portal
2. ✅ Added "Marietta" to neighborhood filter options
3. 🔄 Monitoring ongoing:
   - Weekly data audits
   - Crawl health checks
   - User engagement metrics (if available)

---

### 7.3 Lessons Learned

**What Went Well:**
- Existing neighborhood mapping system scaled easily to new area
- Venue geocoding infrastructure worked out-of-box
- Marietta Cobb Museum crawler built in <2 hours using existing patterns

**Challenges:**
- Some venues (Strand Theatre) had no events calendar on website
- KSU overlap (already covered, but needed to attribute to Marietta area)
- Forward coverage limited (many sources only publish 1-2 months ahead)

**Improvements for Next Expansion:**
- Pre-build venue list before starting (speeds up Phase 2)
- Check for existing coverage earlier (avoid duplicate work)
- Consider seasonal sources (festivals, outdoor events)

---

### 7.4 Next Areas to Expand

**High Priority (Within Atlanta Metro):**
- Athens, GA (UGA campus, music scene)
- Roswell/Alpharetta (North Fulton suburbs)
- Decatur (already partially covered, needs formalization)

**Medium Priority:**
- Gwinnett County (Lawrenceville, Duluth, Buford)
- South Metro (Fayetteville, Peachtree City, Newnan)

**Expansion Readiness Assessment:**

| Area | Population | Expected Events | Venue Count | Readiness |
|------|-----------|----------------|-------------|-----------|
| Athens | 127k | 200-300/month | 40+ | High |
| Roswell/Alpharetta | 180k | 100-150/month | 30+ | High |
| Decatur | 25k | 50-100/month | 20+ | High |
| Gwinnett | 930k | 300-400/month | 60+ | Medium |
| South Metro | 200k | 100-150/month | 40+ | Medium |

---

## 8. Quick Reference Checklist

### New Area Expansion Checklist

**Assessment Phase:**
- [ ] Define geographic boundaries (lat/lng)
- [ ] Set event volume targets
- [ ] Run baseline data quality audit
- [ ] Identify 20-50 core venues

**Venue & Neighborhood Setup:**
- [ ] Add neighborhood boundaries to `fix_neighborhoods.py`
- [ ] Add ZIP code mappings
- [ ] Run neighborhood assignment script
- [ ] Validate >85% neighborhood coverage
- [ ] Add core venues to database with geocoding

**Source Integration:**
- [ ] Identify 10-15 high-priority event sources
- [ ] Build crawlers using existing patterns
- [ ] Add source records to database
- [ ] Test crawlers with dry-run mode
- [ ] Run initial full crawl

**Validation:**
- [ ] Run data audit: `python data_audit.py`
- [ ] Check duplicate rate (<1%)
- [ ] Check neighborhood coverage (>85%)
- [ ] Check category distribution (balanced)
- [ ] Verify 2+ months forward coverage
- [ ] Document results in expansion report

**Launch & Monitor:**
- [ ] Enable new area in portal
- [ ] Add to neighborhood filter
- [ ] Daily checks for week 1
- [ ] Weekly audits for month 1
- [ ] Monthly ongoing monitoring

---

## 9. Tools & Scripts Reference

### Data Quality Scripts
- **`data_audit.py`** - Comprehensive data quality analysis
  - Usage: `python data_audit.py [limit]`
  - Outputs: Console summary + `data_audit_detailed.txt`

- **`fix_neighborhoods.py`** - Assign neighborhoods to venues
  - Usage: `python fix_neighborhoods.py [--dry-run]`
  - Requires: Neighborhood boundaries defined in script

- **`check_remaining_venues.py`** - List venues missing neighborhoods
  - Usage: `python check_remaining_venues.py`

- **`hydrate_venues_foursquare.py`** - Enrich venue data from Foursquare
  - Usage: `python hydrate_venues_foursquare.py --city [City] --limit 50`
  - Requires: `FOURSQUARE_API_KEY` in `.env`

### Crawler Scripts
- **`main.py`** - Run crawlers
  - List sources: `python main.py --list`
  - Run specific: `python main.py --source [slug]`
  - Dry run: `python main.py --source [slug] --dry-run`

### Database Queries
See Section 5 for comprehensive validation SQL queries.

---

## 10. Support & Troubleshooting

### Common Issues

**Issue: Venues missing neighborhoods after running fix_neighborhoods.py**

**Diagnosis:**
```sql
SELECT name, lat, lng, zip FROM venues
WHERE city = 'NewCity'
  AND neighborhood IS NULL;
```

**Solutions:**
1. Check if lat/lng is within defined boundaries
2. Add neighborhood boundary definition
3. Add ZIP code fallback mapping
4. Manually geocode venues missing coordinates

---

**Issue: Crawler produces 0 events**

**Diagnosis:**
```bash
python main.py --source [source-slug] --dry-run
# Check console output for parsing errors
```

**Solutions:**
1. Verify source URL is accessible
2. Check if website structure changed
3. Use Playwright if site requires JavaScript
4. Add better error logging to crawler

---

**Issue: High duplicate rate (>5%)**

**Diagnosis:**
```sql
SELECT title, start_date, COUNT(*) as dupe_count
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'NewCity'
GROUP BY title, start_date
HAVING COUNT(*) > 1;
```

**Solutions:**
1. Review `content_hash` generation in crawlers
2. Check if multiple sources cover same venue
3. Improve title normalization in `dedupe.py`
4. Manually merge obvious duplicates

---

**Issue: Forward coverage drops below 1 month**

**Solutions:**
1. Increase crawl frequency for high-volume sources
2. Add sources with longer event horizons (festivals, performing arts)
3. Check if seasonal gap (summer, holidays)
4. Add seasonal event sources

---

### Getting Help

**Documentation:**
- `DATA_AUDIT_README.md` - Data audit system overview
- `DATA_QUALITY_MONITORING.md` - Ongoing monitoring guide
- `SOURCES_EXPANSION.md` - Source discovery guide
- `NEIGHBORHOOD_FIX_SUMMARY.md` - Neighborhood mapping details

**Key Scripts:**
- `/Users/coach/Projects/LostCity/crawlers/data_audit.py`
- `/Users/coach/Projects/LostCity/crawlers/fix_neighborhoods.py`
- `/Users/coach/Projects/LostCity/crawlers/main.py`

**Sample Crawlers:**
- `/Users/coach/Projects/LostCity/crawlers/sources/marietta_cobb_museum.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/the_earl.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/spivey_hall.py`

---

**Last Updated:** 2026-01-31  
**Next Review:** After first expansion using this playbook  
**Owner:** Data Quality Team

---

## Appendix A: Database Schema Reference

### Core Tables

**venues**
```sql
CREATE TABLE venues (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  address TEXT,
  neighborhood TEXT,  -- Critical for filtering
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DECIMAL(10, 7),  -- Required for geocoding
  lng DECIMAL(10, 7),  -- Required for geocoding
  venue_type TEXT,
  website TEXT,
  phone TEXT,
  google_place_id TEXT,
  location GEOGRAPHY(POINT, 4326),  -- PostGIS geography
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**events**
```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  source_id INT REFERENCES sources(id),
  venue_id INT REFERENCES venues(id),
  title TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  category TEXT NOT NULL,  -- See VALID_CATEGORIES in data_audit.py
  subcategory TEXT,
  tags TEXT[],
  neighborhood TEXT,  -- Denormalized from venue
  source_url TEXT,
  image_url TEXT,
  content_hash TEXT UNIQUE,  -- For deduplication
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**sources**
```sql
CREATE TABLE sources (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  url TEXT,
  source_type TEXT,  -- 'venue', 'scrape', 'api', 'aggregator', 'organization'
  is_active BOOLEAN DEFAULT true,
  crawl_frequency_hours INT DEFAULT 24,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## Appendix B: Valid Categories & Subcategories

**Categories** (from `data_audit.py`):
```python
VALID_CATEGORIES = [
    'music', 'art', 'comedy', 'theater', 'film', 'sports',
    'food_drink', 'nightlife', 'community', 'fitness', 'family',
    'learning', 'dance', 'tours', 'meetup', 'words', 'religious',
    'markets', 'wellness', 'gaming', 'outdoors', 'activism', 'other'
]
```

**Common Subcategories by Category:**
- `music`: live, concert, dj, open-mic, karaoke, festival
- `art`: exhibition, gallery-opening, workshop, artist-talk
- `comedy`: standup, improv, sketch
- `theater`: play, musical, dance, opera
- `film`: screening, premiere, festival
- `sports`: game, tournament, race
- `community`: volunteer, meetup, networking, fundraiser

---

## Appendix C: Sample SQL Queries

### Geographic Coverage Analysis
```sql
-- Events by city
SELECT 
  v.city,
  COUNT(e.id) as events,
  COUNT(DISTINCT v.id) as venues,
  COUNT(DISTINCT e.source_id) as sources
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.start_date >= CURRENT_DATE
GROUP BY v.city
ORDER BY events DESC;

-- Neighborhood distribution
SELECT 
  v.neighborhood,
  v.city,
  COUNT(e.id) as events
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE e.start_date >= CURRENT_DATE
  AND v.city = 'YourCity'
GROUP BY v.neighborhood, v.city
ORDER BY events DESC;
```

### Source Health by Geography
```sql
-- Active sources by city
SELECT 
  v.city,
  s.name as source,
  s.source_type,
  COUNT(e.id) as events_last_30d
FROM sources s
LEFT JOIN events e ON e.source_id = s.id 
  AND e.created_at >= NOW() - INTERVAL '30 days'
LEFT JOIN venues v ON v.id = e.venue_id
WHERE s.is_active = true
  AND v.city = 'YourCity'
GROUP BY v.city, s.name, s.source_type
ORDER BY events_last_30d DESC;
```

### Geocoding Validation
```sql
-- Venues with coordinates outside expected bounds
-- (Example: Atlanta metro area)
SELECT name, city, lat, lng
FROM venues
WHERE lat < 33.4 OR lat > 34.3 
   OR lng < -84.9 OR lng > -83.8;

-- Venues missing critical location data
SELECT 
  name,
  city,
  CASE 
    WHEN lat IS NULL OR lng IS NULL THEN 'Missing coordinates'
    WHEN neighborhood IS NULL THEN 'Missing neighborhood'
    WHEN zip IS NULL THEN 'Missing ZIP'
    ELSE 'OK'
  END as issue
FROM venues
WHERE city = 'YourCity'
  AND (lat IS NULL OR lng IS NULL OR neighborhood IS NULL);
```

---

**End of Playbook**
