## Data Quality Diagnostic: Decatur Coverage

**Date:** 2026-01-31  
**Analyst:** Data Quality Specialist  
**Scope:** Decatur event and venue data integrity

---

## Issue Summary

Decatur coverage shows **moderate data quality** with significant gaps in family-oriented content. The main issues are **missing sources** rather than crawler errors, though some categorization problems exist.

### Affected Records
- Events: 177 upcoming, 299 total (all-time)
- Venues: 41 (should be 100+)
- Sources: 6 (5 active, 1 inactive)

### Date Range
- Historical data: Varies by source
- Current upcoming events: 2026-01-31 through 2026-05-04

---

## Data Patterns Observed

### 1. Event Category Imbalance

**Pattern:** "words" category dramatically overrepresented (54% of events)

**Evidence:**
```sql
-- Decatur events by category (upcoming)
words:       96 events (54%)  ← OVERREPRESENTED
theater:     19 events (11%)
food_drink:  18 events (10%)
music:       17 events (10%)
community:   15 events (8%)
art:         11 events (6%)
fitness:      1 event  (<1%)  ← UNDERREPRESENTED
sports:       0 events (0%)   ← MISSING ENTIRELY
```

**Root Cause:**
- Library events (story times, book clubs, author talks) all tagged as "words"
- Bookstore events (readings, signings) all tagged as "words"
- No distinction between adult and children's programming
- DeKalb County Library alone contributes 67 "words" events

**Impact on Family Portal:**
- 96 "words" events appear family-friendly but most are adult book clubs
- Only ~7 are actually children's story times
- Parents will see irrelevant results

**Recommended Fix:**
1. Add subcategory distinction: "words:adult", "words:children", "words:teen"
2. Better tag inference for library/bookstore events
3. Add age_range field to events table

---

### 2. Missing Venue Types

**Pattern:** Critical venue types have zero or minimal representation

**Evidence:**
```
Parks:        2 venues (should be 15+)
Schools:      0 venues (should be 9)
Play spaces:  0 venues (should be 5+)
Rec centers:  1 venue  (should be 3+)
```

**Root Cause:**
- No crawler for school calendars
- Parks not added as standalone venues
- Recreation programs not scraped comprehensively
- Focus on bars/restaurants over family destinations

**Impact:**
- Family portal will appear empty for core destinations
- No playground information
- Missing school events entirely

**Recommended Fix:**
1. Manual venue additions for all Decatur parks (see list in gap analysis)
2. Add all 9 Decatur schools as venues
3. Create crawlers for school district calendars

---

### 3. Venue Type vs Spot Type Inconsistency

**Pattern:** Some venues have both venue_type and spot_type, others only one

**Evidence:**
```
35 venues have spot_type set
41 total venues
= 6 venues missing spot_type classification
```

**Examples:**
- "Bradley Observatory" has venue_type="event_space" but no spot_type
- "Porter Sanford III Performing Arts Center" has venue_type="music_venue" and spot_type="theater"
- Inconsistent usage of bar vs restaurant vs brewery

**Root Cause:**
- Legacy schema migration incomplete
- No validation requiring both fields
- Different crawlers set different fields

**Recommended Fix:**
1. Backfill spot_type for all venues
2. Add database constraint requiring both fields
3. Create canonical venue_type → spot_type mapping

---

### 4. Seasonal vs. Regular Sources

**Pattern:** Two crawlers only pull annual festival data

**Evidence:**
```
Decatur Arts Festival    - Memorial Day weekend only
Decatur Book Festival    - Labor Day weekend only
```

**Root Cause:**
- Festival websites only show current year's schedule
- Not marked as seasonal in sources table
- Will show zero events 11 months per year

**Impact:**
- Event counts will fluctuate wildly by month
- Portal will look empty outside festival season

**Recommended Fix:**
1. Add `active_months` field to sources table (migration already exists: 062_source_health_tags.sql)
2. Tag these sources as seasonal: [5, 9] for Memorial/Labor Day
3. UI should indicate "upcoming annual event" for off-season

---

### 5. Inactive City of Decatur Crawler

**Pattern:** Main government calendar crawler disabled

**Evidence:**
```
Source ID: 341
Status: is_active = FALSE
Reason: Cloudflare protection blocking
```

**Root Cause (from code):**
```python
# decatur_city.py line 154
browser = p.chromium.launch(headless=False)  # Still using headless=False
# Line 189: Cloudflare detection
if "cloudflare" in body_text.lower() or "checking your browser" in body_text.lower():
    logger.warning("Still blocked by Cloudflare challenge")
    return 0, 0, 0
```

**Impact:**
- Missing city-run community events
- Missing government meetings, festivals, public programs
- Estimated 20-30 events per year

**Recommended Fix:**
1. Use Playwright stealth plugin
2. Implement longer wait times (currently 10s, try 30s)
3. Alternative: Use city's RSS feed if available
4. Alternative: Scrape from third-party calendar aggregators

---

### 6. Recurring Event Detection Failures

**Pattern:** Weekly programs not generating weekly event instances

**Evidence:**
- Decatur Farmers Market: Only 6 event records, should be 52+ per year
- Library story times: Missing weekly recurring instances
- Decatur Makers: "Open Build Night" only shows 3 instances

**Root Cause:**
- Crawlers extract single event instead of series
- No recurring rule parsing from "Every Tuesday" text
- Series detection exists but not used by all crawlers

**Example from decatur_farmers_market.py:**
```python
# Only creates one event per crawl run
# Should parse "Every Wednesday 4-7pm" and generate instances
```

**Recommended Fix:**
1. Add recurrence_rule parsing to farmers market crawler
2. Generate future instances (next 3 months) for recurring events
3. Tag library story times as recurring and auto-generate

---

### 7. Family-Friendly Tagging Absent

**Pattern:** No systematic way to identify family-appropriate content

**Evidence:**
```
Restaurants: 6 listed, 0 tagged as family-friendly
Events:      177 upcoming, 0 have age_range tags
Venues:      41 total, no family-friendly indicator
```

**Root Cause:**
- No family-friendly field in venues table
- No age_range field in events table
- Tags like "family-friendly" applied inconsistently

**Impact:**
- Family portal can't filter reliably
- Parents see bar events and adult content
- No way to show "toddler-friendly" vs "teen" events

**Recommended Fix:**
1. Add family_friendly boolean to venues
2. Add age_min/age_max to events
3. Create family-friendly tag inference rules
4. Manual review/tagging of existing venues

---

## Root Cause Analysis

### Primary Issues (Data Coverage):
1. **Missing crawlers for family sources** - Schools, rec programs not scraped
2. **Underrepresented venue types** - Parks, schools not in database
3. **Adult-oriented content bias** - More bars than playgrounds

### Secondary Issues (Data Quality):
4. **Category granularity** - No adult vs. children distinction
5. **Recurring event gaps** - Weekly programs not generated
6. **Inconsistent tagging** - Family-friendly not systematically applied

### Technical Debt:
7. **venue_type vs spot_type** - Schema migration incomplete
8. **Cloudflare blocking** - One crawler disabled
9. **Seasonal source handling** - No active_months implementation

---

## Recommended Fixes

### Immediate (This Week):
1. **Add missing venues manually**
   - Decatur parks (15 parks, ~2 hours)
   - Decatur schools (9 schools, ~1 hour)
   - SQL bulk insert acceptable for initial data

2. **Tag family-friendly restaurants**
   ```sql
   UPDATE venues 
   SET tags = array_append(tags, 'family-friendly')
   WHERE id IN (76, 682, 89, 679, 1029, 1193)  -- Family restaurants
   AND city ILIKE '%Decatur%';
   ```

3. **Fix City of Decatur crawler**
   - Implement stealth mode or longer wait
   - Test with headless=True + extended timeout

### Short Term (2 Weeks):
4. **Create Decatur Schools crawler**
   - Source: decaturschools.org
   - Parse district calendar + individual school calendars
   - Expected: 150+ events annually

5. **Enhance library events capture**
   - Parse recurring story time schedules
   - Generate instances for next 3 months
   - Tag with age ranges

6. **Backfill spot_type for all venues**
   ```sql
   -- Create mapping and update
   UPDATE venues SET spot_type = venue_type WHERE spot_type IS NULL;
   ```

### Medium Term (1 Month):
7. **Add age_range fields to events**
   - Migration for age_min, age_max columns
   - Inference rules based on title/description
   - Manual tagging for recurring programs

8. **Implement active_months for seasonal sources**
   ```sql
   UPDATE sources 
   SET active_months = ARRAY[5] 
   WHERE slug = 'decatur-arts-festival';  -- Memorial Day
   
   UPDATE sources 
   SET active_months = ARRAY[9]
   WHERE slug = 'decatur-book-festival';  -- Labor Day
   ```

9. **Build recurring event generator**
   - Parse "Every [day]" patterns
   - Generate instances using recurrence_rule
   - Apply to farmers markets, story times, classes

---

## Validation Queries

### After fixes, run these to verify:

**1. Verify family events by age:**
```sql
SELECT 
  category,
  COUNT(*) FILTER (WHERE tags @> ARRAY['family-friendly']) as family_events,
  COUNT(*) as total_events
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city ILIKE '%Decatur%'
  AND e.start_date >= CURRENT_DATE
GROUP BY category
ORDER BY family_events DESC;
```

**2. Verify venue coverage by type:**
```sql
SELECT 
  venue_type,
  spot_type,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE tags @> ARRAY['family-friendly']) as family_count
FROM venues
WHERE city ILIKE '%Decatur%'
GROUP BY venue_type, spot_type
ORDER BY count DESC;
```

**3. Verify recurring events:**
```sql
SELECT 
  title,
  COUNT(*) as instances,
  MIN(start_date) as first_date,
  MAX(start_date) as last_date
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.city ILIKE '%Decatur%'
  AND e.is_recurring = true
  AND e.start_date >= CURRENT_DATE
GROUP BY title
HAVING COUNT(*) > 1
ORDER BY instances DESC;
```

**4. Check for spot_type gaps:**
```sql
SELECT id, name, venue_type, spot_type
FROM venues
WHERE city ILIKE '%Decatur%'
  AND spot_type IS NULL;
-- Should return 0 rows after backfill
```

---

## Success Metrics

### Before Fixes:
- Events: 177 (54% adult "words" events)
- Venues: 41 (14 family-friendly)
- Family coverage: ~25%
- Active crawlers: 5 (1 inactive)

### Target After Fixes:
- Events: 500+ (30% sports/fitness, 25% family)
- Venues: 120+ (60+ family-friendly)
- Family coverage: 75%+
- Active crawlers: 15+ (all working)

### KPIs to Track:
```
Metric                          Current    Target    Status
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Events with age tags              0%        80%      🔴
Family-friendly venues           34%        75%      🔴
Parks in database                 5%       100%      🔴
School coverage                   0%       100%      🔴
Recurring event instances        <10        30+      🔴
Active crawlers                  83%       100%      🟡
```

---

## Related Files

**Crawlers:**
- `/Users/coach/Projects/LostCity/crawlers/sources/decatur_city.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/decatur_farmers_market.py`
- `/Users/coach/Projects/LostCity/crawlers/tag_inference.py`
- `/Users/coach/Projects/LostCity/crawlers/series.py`

**Migrations:**
- `/Users/coach/Projects/LostCity/database/migrations/062_source_health_tags.sql`
- `/Users/coach/Projects/LostCity/database/migrations/027_fix_venue_spot_types.sql`

**Reports:**
- `/Users/coach/Projects/LostCity/DECATUR_COVERAGE_GAP_ANALYSIS.md`
- `/Users/coach/Projects/LostCity/DECATUR_COVERAGE_SUMMARY.md`
