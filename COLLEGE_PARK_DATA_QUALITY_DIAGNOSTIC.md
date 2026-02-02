## Data Quality Diagnostic: College Park / Airport District

**Date:** 2026-01-31  
**Auditor:** data-quality-specialist  
**Severity:** CRITICAL  
**Area:** College Park, East Point, Hapeville (Airport District)

---

### Issue Summary

The Airport District has **95% missing coverage** compared to expected content for a 60,000+ resident area. All curator-identified signature destinations are missing from the database. Zero dedicated crawlers exist for the area.

---

### Affected Records

**Coverage:**
- 14 venues (expected: 80+)
- 22 upcoming events (expected: 150+)
- 0 dedicated sources (expected: 8+)

**Date Range:** 2026-02-01 to 2027-01-20 (current events)

**Missing Curator Venues:**
- Virgil's Gullah Kitchen & Bar (NOT FOUND)
- The Breakfast Boys (NOT FOUND)
- Brake Pad (NOT FOUND)

---

### Data Patterns Observed

#### Pattern 1: Zero Systematic Crawling
**Observation:** No dedicated crawlers for College Park, East Point, or Hapeville city calendars.

**Evidence:**
```sql
-- No sources found for Airport District cities
SELECT * FROM sources 
WHERE name ILIKE '%college park%' 
   OR name ILIKE '%east point%' 
   OR name ILIKE '%hapeville%'
   OR url ILIKE '%collegeparkga.com%'
   OR url ILIKE '%eastpointcity.org%'
   OR url ILIKE '%hapeville.org%';
-- Result: 0 rows
```

**Impact:**
- Events appear to come from aggregators or manual submissions
- No systematic capture of city programming
- Missing Parks & Rec events, library recurring programs

#### Pattern 2: Duplicate Venue Records
**Observation:** ArtsXchange exists as two separate venues (ID 780 and 83).

**Evidence:**
```
ID: 780 | ArtsXchange | gallery | No spot_types
ID: 83  | ArtsXchange - Southeast Community Cultural Center | community_center | spot_types: ['gallery', 'park']
```

**Root Cause:**
- Different sources may have submitted same venue
- Deduplication logic didn't catch different name variations
- Manual entry vs crawler-generated entries

**Impact:**
- Events may be split across two venue records
- Venue metrics artificially inflated
- User confusion (which ArtsXchange is correct?)

#### Pattern 3: Missing Venue Metadata
**Observation:** 13 of 14 venues lack spot_types, most lack vibes, hours, descriptions.

**Evidence:**
```
Venues with spot_types: 1 of 14 (7%)
Venues with vibes: 6 of 14 (43%)
Venues with website: 4 of 14 (29%)
Venues with hours: 0 of 14 (0%)
Venues with description: 0 of 14 (0%)
```

**Root Cause:**
- Venues added via basic import without enrichment
- No Foursquare/Google Places hydration for these venues
- Manual entries incomplete

**Impact:**
- Destinations lack discoverability (can't filter by vibes/features)
- Users can't see hours, descriptions, key details
- Search quality degraded (no spot_types to match)

#### Pattern 4: Venue Location Data Error
**Observation:** For Keeps Bookstore (ID 280) listed in "Downtown" neighborhood but has College Park in query results.

**Evidence:**
```
ID: 280
Name: For Keeps Bookstore
Address: 171 Auburn Ave NE, Atlanta, GA 30303, USA
City: (not shown but appears in College Park query)
Neighborhood: Downtown
```

**Root Cause:**
- Address is clearly Downtown Atlanta (Auburn Ave)
- Should NOT appear in College Park query
- Database query logic issue OR incorrect city field value

**Impact:**
- User sees bookstore when browsing College Park (wrong)
- Metrics for College Park artificially inflated
- Data integrity concern

#### Pattern 5: Event-less Destination Venues
**Observation:** 6 of 14 venues have zero upcoming events despite being active destinations.

**Evidence:**
```
For Keeps Bookstore (bookstore) - 0 events
ArtsXchange (gallery) - 0 events
Dave's Sports Bar & Grill (bar) - 0 events
Waffle House x3 (restaurant) - 0 events each
```

**Root Cause:**
- No individual venue crawlers
- These venues likely DO have events (ArtsXchange definitely does)
- Events not captured because no source is crawling them

**Impact:**
- Venues look "dead" to users
- No discovery for cultural programming (ArtsXchange)
- No nightlife/bar events captured

---

### Root Cause Analysis

**Primary Cause:** **Geographic expansion without systematic source coverage**

The Airport District venues appear to have been added through:
1. General Atlanta aggregator sources (Gateway Center, GICC)
2. Library system-wide crawler (3 library branches)
3. Manual submissions or one-off imports (Waffle Houses, Dave's Sports Bar)

**But NO dedicated crawlers exist for:**
- City of College Park official calendar
- City of East Point official calendar
- City of Hapeville official calendar
- Dick Lane Velodrome (world-class venue)
- ArtsXchange programming
- Individual restaurant/bar events

**Secondary Issues:**
- Venue enrichment process not run (missing metadata)
- Deduplication logic gaps (ArtsXchange duplicate)
- Location data quality issues (For Keeps Bookstore)

---

### Recommended Fixes

#### Fix 1: Create Dedicated City Crawlers (HIGH PRIORITY)
**Action:** Build 3 new crawlers for city calendars.

**Files to Create:**
```
/Users/coach/Projects/LostCity/crawlers/sources/college_park_city.py
/Users/coach/Projects/LostCity/crawlers/sources/east_point_city.py
/Users/coach/Projects/LostCity/crawlers/sources/hapeville_city.py
```

**Expected Impact:**
- Add 50-100 new events from Parks & Rec, city programming
- Capture recurring programs (weekly classes, monthly events)
- Fill event diversity gaps (fitness, family, community)

**Validation:**
```sql
-- After fix, should see events from city sources
SELECT s.name, COUNT(e.id) as events
FROM sources s
JOIN events e ON e.source_id = s.id
WHERE s.slug IN ('college-park-city', 'east-point-city', 'hapeville-city')
GROUP BY s.name;
```

#### Fix 2: Add Dick Lane Velodrome (HIGH PRIORITY)
**Action:** Create crawler for world-class cycling venue.

**File to Create:**
```
/Users/coach/Projects/LostCity/crawlers/sources/dick_lane_velodrome.py
```

**Venue Record to Add:**
```json
{
  "name": "Dick Lane Velodrome",
  "slug": "dick-lane-velodrome",
  "address": "1889 Lakewood Way SE, East Point, GA 30344",
  "city": "East Point",
  "neighborhood": "East Point",
  "venue_type": "sports_venue",
  "spot_types": ["cycling", "velodrome", "sports"],
  "vibes": ["high-energy", "world-class", "competitive"],
  "description": "World-class outdoor velodrome hosting international cycling events",
  "website": "https://dicklanevelodrome.com"
}
```

**Expected Impact:**
- Add 20-30 cycling events per year
- International sporting event representation
- Unique Atlanta destination captured

#### Fix 3: Consolidate ArtsXchange Duplicate (MEDIUM PRIORITY)
**Action:** Merge venue records, preserve event associations.

**SQL Fix:**
```sql
-- Step 1: Move all events from ID 780 to ID 83
UPDATE events SET venue_id = 83 WHERE venue_id = 780;

-- Step 2: Update ID 83 with complete metadata
UPDATE venues 
SET 
  venue_type = 'community_center',
  spot_types = ARRAY['gallery', 'theater', 'community_center'],
  vibes = ARRAY['artsy', 'family-friendly', 'community-focused'],
  website = 'https://artsxchange.org'
WHERE id = 83;

-- Step 3: Soft delete or remove ID 780
UPDATE venues SET active = false WHERE id = 780;
-- OR
DELETE FROM venues WHERE id = 780;
```

**Validation:**
```sql
SELECT * FROM venues WHERE name ILIKE '%artsxchange%';
-- Should return only 1 record (ID 83)
```

#### Fix 4: Fix For Keeps Bookstore Location (LOW PRIORITY)
**Action:** Verify actual location and update city field.

**Investigation:**
```sql
SELECT id, name, address, city, neighborhood 
FROM venues 
WHERE id = 280;
```

**Expected Fix:**
- If address is Auburn Ave (Downtown Atlanta), set city = 'Atlanta', neighborhood = 'Downtown'
- Remove from College Park queries
- OR if there's a College Park location, create separate venue record

#### Fix 5: Enrich Existing Venues with Metadata (MEDIUM PRIORITY)
**Action:** Run venue enrichment script for 14 Airport District venues.

**Script to Run:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 hydrate_venues_foursquare.py --city "College Park" --city "East Point" --city "Hapeville"
```

**Expected Impact:**
- Add spot_types to 13 venues
- Add hours to all venues
- Add descriptions
- Add vibes where missing

**Validation:**
```sql
SELECT 
  COUNT(*) FILTER (WHERE spot_types IS NOT NULL) as has_spot_types,
  COUNT(*) FILTER (WHERE hours IS NOT NULL) as has_hours,
  COUNT(*) FILTER (WHERE description IS NOT NULL) as has_description,
  COUNT(*) as total
FROM venues 
WHERE city IN ('College Park', 'East Point', 'Hapeville');
```

#### Fix 6: Research and Add Curator Venues (HIGH PRIORITY)
**Action:** Locate and add 3 missing signature destinations.

**Research Tasks:**
1. Google/Yelp search for "Virgil's Gullah Kitchen Atlanta"
2. Google/Yelp search for "The Breakfast Boys Atlanta"
3. Google/Yelp search for "Brake Pad Atlanta"

**For each found venue:**
- Add venue record with full metadata
- Create individual crawler if they have events calendar
- Tag with appropriate spot_types and vibes

**Expected Impact:**
- Add 3 high-value destinations
- Fill food/drink coverage gap
- Capture Gullah/Geechee cultural heritage

---

### Validation Queries

#### Query 1: Verify College Park Coverage After Fixes
```sql
-- Should show 80+ venues
SELECT COUNT(*) as venue_count
FROM venues 
WHERE city IN ('College Park', 'East Point', 'Hapeville');

-- Should show distribution across types
SELECT venue_type, COUNT(*) as count
FROM venues 
WHERE city IN ('College Park', 'East Point', 'Hapeville')
GROUP BY venue_type
ORDER BY count DESC;
```

#### Query 2: Verify Event Volume After Crawler Additions
```sql
-- Should show 150+ upcoming events
SELECT COUNT(*) as upcoming_events
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city IN ('College Park', 'East Point', 'Hapeville')
  AND e.start_date >= CURRENT_DATE;

-- Should show diversity of categories
SELECT e.category, COUNT(*) as count
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city IN ('College Park', 'East Point', 'Hapeville')
  AND e.start_date >= CURRENT_DATE
GROUP BY e.category
ORDER BY count DESC;
```

#### Query 3: Verify Source Coverage
```sql
-- Should show 8+ active sources
SELECT id, name, slug, is_active
FROM sources
WHERE url ILIKE '%college%park%'
   OR url ILIKE '%eastpoint%'
   OR url ILIKE '%hapeville%'
   OR url ILIKE '%dicklanevelodrome%'
   OR url ILIKE '%artsxchange%';
```

#### Query 4: Verify Metadata Enrichment
```sql
-- Should show >80% coverage
SELECT 
  COUNT(*) FILTER (WHERE spot_types IS NOT NULL) * 100.0 / COUNT(*) as pct_spot_types,
  COUNT(*) FILTER (WHERE vibes IS NOT NULL) * 100.0 / COUNT(*) as pct_vibes,
  COUNT(*) FILTER (WHERE hours IS NOT NULL) * 100.0 / COUNT(*) as pct_hours,
  COUNT(*) FILTER (WHERE website IS NOT NULL) * 100.0 / COUNT(*) as pct_website
FROM venues 
WHERE city IN ('College Park', 'East Point', 'Hapeville');
```

---

### Success Criteria

**6-Month Goals:**
- Venues: 14 → 80+ (5.7x increase)
- Upcoming Events: 22 → 150+ (6.8x increase)
- Active Sources: 0 → 8+ (new coverage)
- Metadata Coverage: <30% → 80%+ (enrichment)
- Curator Venues: 0/3 → 3/3 (100% found and added)

---

### Related Documents

- **Full Gap Analysis:** `/Users/coach/Projects/LostCity/COLLEGE_PARK_AIRPORT_DISTRICT_GAP_ANALYSIS.md`
- **Coverage Summary:** `/Users/coach/Projects/LostCity/COLLEGE_PARK_COVERAGE_SUMMARY.md`
- **Decatur Comparison:** `/Users/coach/Projects/LostCity/DECATUR_COVERAGE_GAP_ANALYSIS.md`

---

### Next Steps for crawler-dev

1. Review this diagnostic
2. Prioritize crawler builds (College Park city → East Point → Hapeville → Dick Lane)
3. Fix ArtsXchange duplicate (quick SQL fix)
4. Run venue enrichment script
5. Research curator venues (coordinate with content team)
6. Monitor validation queries after each fix

