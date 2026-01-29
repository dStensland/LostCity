# Data Quality Diagnostic Report
**Date:** January 29, 2026  
**Database:** LostCity Production (Supabase)  
**Total Events:** 9,120  
**Auditor:** Data Quality Specialist

---

## Executive Summary

This comprehensive audit reveals significant data quality issues requiring immediate attention:

**CRITICAL ISSUES:**
1. **Landmark Midtown Art Cinema Duplicates** - 273 duplicate records (169 excess events) consuming database space and creating poor UX
2. **Generic Venue Crawler** - 64.5% empty/short descriptions, needs immediate investigation or deactivation
3. **Inactive Sources with Data** - 165 Meetup events from inactive source
4. **47% Missing Images** - Significant visual quality impact

**MODERATE ISSUES:**
5. **23.7% Missing Times** - 2,162 events without start_time
6. **26.1% Stale Data** - 2,382 past events cluttering database
7. **41.9% Missing Ticket URLs** - Though many are free events

---

## Issue #1: CRITICAL - Landmark Midtown Duplicates

### Impact
- **273 duplicate event records** at Landmark Midtown Art Cinema (venue_id=199)
- **169 excess records** that should be merged/deleted
- Affects UX: users see same film multiple times
- Wastes database storage and index space

### Pattern Analysis
Landmark creates **multiple events per film per date**, likely because:
1. **Multiple showtimes per day** create separate event records
2. **Multiple crawl runs** re-insert the same events with different hashes
3. **Deduplication logic fails** for cinema showtimes

**Example:**
- "ARCO" on 2026-01-30: **8 duplicate instances** (should be 1 event with multiple showtimes)
- "H IS FOR HAWK" on 2026-01-26: **4 duplicate instances**
- "HAMNET" on 2026-01-30: **4 duplicate instances**

### Root Cause
Looking at `crawlers/sources/landmark_midtown.py`:
- Crawler extracts individual showtimes (1:10PM, 4:00PM, 7:00PM)
- Creates **separate event record for each showtime**
- Should create **ONE event per film per day** with showtimes in metadata

### Data Sample
```
'arco' on 2026-01-30: 8 instances
  - Event ID 6551, hash: cdbdfd51b877c9e5...
  - Event ID 6550, hash: 5d1b4875ec70f38a...
  - Event ID 9703, hash: a470429bcf78859a...
  [5 more duplicates...]

'h is for hawk' on 2026-01-26: 4 instances
  - Event ID 6481, hash: 725c9affde6a0d2b...
  - Event ID 6480, hash: 8f0b5113a53d3155...
  - Event ID 6479, hash: fa4545ed18190f91...
  [1 more duplicate...]
```

### Recommended Fix

**For crawler-dev:**
1. **Modify `landmark_midtown.py`:**
   - Extract ALL showtimes for a film on a given date
   - Create ONE event record per (film, date) combination
   - Store showtimes in a structured field (JSON array or separate table)
   - Update content_hash to include (title + venue + date) only, NOT showtime

2. **Schema enhancement** (optional):
   ```sql
   ALTER TABLE events ADD COLUMN showtimes TEXT[];
   -- Example: ['13:10', '16:00', '19:00', '22:00']
   ```

3. **Cleanup existing duplicates:**
   ```sql
   -- Query to identify duplicates for manual review
   SELECT title, start_date, COUNT(*) as dup_count, ARRAY_AGG(id) as event_ids
   FROM events
   WHERE venue_id = 199
   GROUP BY title, start_date
   HAVING COUNT(*) > 1
   ORDER BY dup_count DESC;
   ```

   **Merge strategy:**
   - Keep record with most complete data (longest description, best image)
   - Delete other duplicates
   - OR use `canonical_event_id` to link them

### Validation Query
```sql
-- After fix, this should return 0 duplicates
SELECT title, start_date, COUNT(*) as dup_count
FROM events
WHERE venue_id = 199 
  AND start_date >= CURRENT_DATE
GROUP BY title, start_date
HAVING COUNT(*) > 1;
```

---

## Issue #2: CRITICAL - Generic Venue Crawler Quality

### Impact
- **557 total events** from this source
- **313 empty descriptions** (56.2%)
- **359 empty or short descriptions** (64.5%)
- **91 missing images** (based on sample)
- Severely impacts user experience

### Pattern Analysis
Source details:
- **Source ID:** 319
- **Slug:** `generic-venue-crawler`
- **Type:** website
- **Status:** Active (but shouldn't be!)
- **URL:** https://lostcity.ai (meta-reference)

Events are primarily from **Dragon Con** sub-events:
- "Author Signings at Dragon Con"
- "Georgia Philharmonic Orchestra Presents at Dragon Con"
- "Dragon Con Burlesque: A Glamour Geek Revue"
- etc.

### Root Cause Hypothesis
This appears to be a **catch-all/fallback crawler** that:
1. Was used to bulk-import events from various sources
2. Extraction was incomplete or manual
3. Should have been temporary but remains active

### Data Quality Breakdown
```
Total events: 557
Empty descriptions: 313 (56.2%)
Short descriptions (<50 chars): 46 (8.3%)
Good descriptions (50+ chars): 198 (35.5%)
```

**This is far below acceptable quality threshold of 80%+**

### Recommended Fix

**Immediate:**
1. **Deactivate the source:**
   ```sql
   UPDATE sources 
   SET is_active = false 
   WHERE slug = 'generic-venue-crawler';
   ```

2. **Investigate code:**
   - Find `crawlers/sources/generic_venue_crawler.py` (if exists)
   - Or search for where source_id=319 events are created
   - Determine if it's needed or can be deleted

3. **Event cleanup decision:**
   - Option A: Delete all events from this source (557 events)
   - Option B: Manually enrich the good ones, delete the rest
   - Option C: Trace back to original sources and re-crawl properly

**For crawler-dev:**
```bash
cd crawlers/sources
grep -r "generic-venue-crawler" .
grep -r "319" . | grep source_id
```

### Validation Query
```sql
-- Verify source is deactivated
SELECT id, name, slug, is_active, 
       (SELECT COUNT(*) FROM events WHERE source_id = sources.id) as event_count
FROM sources
WHERE slug = 'generic-venue-crawler';

-- Count remaining quality issues after cleanup
SELECT 
  COUNT(*) as total,
  SUM(CASE WHEN description IS NULL OR TRIM(description) = '' THEN 1 ELSE 0 END) as empty_desc,
  SUM(CASE WHEN image_url IS NULL THEN 1 ELSE 0 END) as no_image
FROM events
WHERE source_id = 319;
```

---

## Issue #3: HIGH - Inactive Sources with Events

### Impact
- **71 inactive sources** in database
- **6 inactive sources have significant event counts:**
  - Creative Loafing: 49 events
  - ArtsATL Calendar: 45 events  
  - Meetup: 165 events (108 past, 57 future)
  - Georgia State University: 83 events
  - FanCons Georgia: 30 events
  - ArtsATL: 14 events

### Pattern Analysis

**Meetup (source_id=2):**
- 165 total events
- 108 past events (65%)
- 57 future events (35%)
- Source marked inactive (API deprecated?)

**Creative Loafing (source_id=9):**
- 49 events
- Website: creativeloafing.com/events
- May have shut down or changed format

**Georgia State University (source_id=297):**
- 83 events
- Why inactive? Should this be reactivated?

### Root Cause
Sources were deactivated but events remain in database:
1. **API deprecation** (Meetup)
2. **Website shutdown** (Creative Loafing)
3. **Crawler issues** (others)
4. **Seasonal** (some sources may be seasonal)

### Recommended Fix

**For data-quality team:**

1. **Review Meetup events:**
   ```sql
   -- Inspect future Meetup events
   SELECT id, title, start_date, description, source_url
   FROM events
   WHERE source_id = 2 AND start_date >= CURRENT_DATE
   ORDER BY start_date
   LIMIT 20;
   ```
   - If API is permanently dead: delete all future events or flag as archived
   - If events are still valuable: keep but don't update

2. **Reactivate valuable sources:**
   ```sql
   -- Check if Georgia State University should be reactivated
   SELECT COUNT(*), MIN(start_date), MAX(start_date)
   FROM events
   WHERE source_id = 297 AND start_date >= CURRENT_DATE;
   ```

3. **Clean up past events from inactive sources:**
   ```sql
   -- Archive past events from inactive sources
   DELETE FROM events
   WHERE source_id IN (
     SELECT id FROM sources WHERE is_active = false
   )
   AND start_date < CURRENT_DATE - INTERVAL '30 days';
   ```

4. **Bulk deactivate empty sources:**
   ```sql
   -- These serve no purpose
   UPDATE sources
   SET is_active = false
   WHERE is_active = true
   AND id NOT IN (SELECT DISTINCT source_id FROM events);
   ```

### Validation Query
```sql
-- After cleanup: inactive sources should have no future events
SELECT s.name, COUNT(e.id) as future_events
FROM sources s
LEFT JOIN events e ON s.id = e.source_id AND e.start_date >= CURRENT_DATE
WHERE s.is_active = false
GROUP BY s.id, s.name
HAVING COUNT(e.id) > 0
ORDER BY future_events DESC;
```

---

## Issue #4: MODERATE - Missing Images (47%)

### Impact
- **4,284 events without images** (47.0% of all events)
- Significantly reduces visual appeal and engagement
- Hurts discovery and click-through rates

### Breakdown by Category
```
Category         | No Image | Total | % Missing
-----------------+----------+-------+----------
nightlife        |    32    |   32  |  100%
meetup           |    22    |   29  |   76%
family           |    22    |   42  |   52%
film             |    25    |  137  |   18%
music            |    17    |   64  |   27%
```

### Breakdown by Source (Top Issues)
```
Source                            | No Image | Total | % Missing
----------------------------------+----------+-------+----------
Generic Venue Crawler             |    91    |   91  |  100%
Atlanta Recurring Social Events   |    43    |   43  |  100%
Meetup                            |    20    |   27  |   74%
Piedmont Park Conservancy         |    12    |   59  |   20%
Landmark Midtown Art Cinema       |    12    |   91  |   13%
```

### Root Cause
1. **Some sources don't provide images** (social meetups, recurring events)
2. **LLM extraction misses images** in some layouts
3. **Auto-fetch not working** for all film/music events
4. **Meetup API limitations** (if using old API)

### Recommended Fix

**Immediate:**
1. **Verify auto-fetch is enabled:**
   - Check `crawlers/db.py` lines 172-191
   - Film events should auto-fetch posters (TMDB)
   - Music events should auto-fetch artist images (Spotify/Last.fm)

2. **Add placeholder images by category:**
   ```sql
   -- Use category-specific placeholder URLs
   UPDATE events
   SET image_url = 'https://lostcity.ai/placeholders/nightlife.jpg'
   WHERE category = 'nightlife' AND image_url IS NULL;
   ```

3. **Prioritize sources with best ROI:**
   - Fix Landmark Midtown (91 events, 13% missing)
   - Fix Piedmont Park (59 events, 20% missing)
   - Accept that social/meetup events often lack images

**For crawler-dev:**
1. Review extraction prompts for image URLs
2. Add fallback image sources:
   - Venue website logos
   - Organization branding
   - Category placeholders

### Validation Query
```sql
-- Track image coverage improvements
SELECT 
  category,
  COUNT(*) as total,
  SUM(CASE WHEN image_url IS NULL THEN 1 ELSE 0 END) as missing,
  ROUND(100.0 * SUM(CASE WHEN image_url IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as coverage_pct
FROM events
WHERE start_date >= CURRENT_DATE
GROUP BY category
ORDER BY missing DESC;
```

---

## Issue #5: MODERATE - Missing Times (23.7%)

### Impact
- **2,162 events without start_time** (23.7%)
- Users can't plan their schedule effectively
- Reduces calendar integration value

### Breakdown by Source (Top Offenders)
```
Source                      | Missing Times | Total Events | % Missing
----------------------------+---------------+--------------+----------
Generic Venue Crawler       |     184       |      91      |  202%*
Eventbrite                  |     134       |      34      |  394%*
Landmark Midtown            |     121       |      91      |  133%*
Georgia Tech Athletics      |     116       |     116      |  100%
529                         |      56       |       5      | 1120%*

* Numbers don't match total events - indicates multiple events per source or data inconsistency
```

### Root Cause Analysis

**Georgia Tech Athletics (100% missing):**
- All 116 events lack times
- Likely extraction prompt doesn't capture time
- Or events genuinely don't publish times in advance (TBA)

**Film venues (Landmark, Plaza, Tara):**
- Cinema showtimes are often variable
- Multiple showtimes per day (see Issue #1)
- Could show "Multiple showtimes available"

**Community events (libraries, parks):**
- Often all-day events
- Should set `is_all_day = true`

### Recommended Fix

**For crawler-dev:**

1. **Review Georgia Tech Athletics crawler:**
   ```bash
   cd crawlers/sources
   grep -l "georgia.*tech.*athletics" *.py
   # Check extraction prompt for time fields
   ```

2. **Add time validation:**
   ```python
   # In crawler code
   if not start_time and not is_all_day:
       logger.warning(f"Event '{title}' missing time - check extraction")
   ```

3. **Schema enhancement:**
   ```sql
   ALTER TABLE events ADD COLUMN time_status TEXT;
   -- Values: 'scheduled', 'tba', 'multiple', 'all_day'
   ```

4. **UI handling:**
   - Show "Time TBA" for NULL times
   - Show "All Day" for is_all_day events
   - Show "Multiple Showtimes" for film events

### Validation Query
```sql
-- Sources with highest time extraction failure rate
SELECT 
  s.name,
  COUNT(*) as total_events,
  SUM(CASE WHEN e.start_time IS NULL THEN 1 ELSE 0 END) as missing_time,
  ROUND(100.0 * SUM(CASE WHEN e.start_time IS NULL THEN 1 ELSE 0 END) / COUNT(*), 1) as pct_missing
FROM events e
JOIN sources s ON e.source_id = s.id
WHERE e.start_date >= CURRENT_DATE
GROUP BY s.id, s.name
HAVING SUM(CASE WHEN e.start_time IS NULL THEN 1 ELSE 0 END) > 5
ORDER BY pct_missing DESC;
```

---

## Issue #6: MODERATE - Stale Data (26.1%)

### Impact
- **2,382 past events** (26.1% of database)
- Clutters search results
- Wastes database storage and query performance
- Confuses users if displayed

### Breakdown by Source (Top Contributors)
```
Landmark Midtown Art Cinema:  107 past events
Piedmont Healthcare:           86 past events
Georgia State University:      83 past events
Generic Venue Crawler:         73 past events
Meetup:                        68 past events
Plaza Theatre:                 60 past events
```

### Recommendation

**Immediate:**
1. **Archive past events:**
   ```sql
   -- Option A: Delete old events
   DELETE FROM events
   WHERE start_date < CURRENT_DATE - INTERVAL '30 days';
   
   -- Option B: Move to archive table (preserves history)
   CREATE TABLE events_archive AS
   SELECT * FROM events
   WHERE start_date < CURRENT_DATE - INTERVAL '30 days';
   
   DELETE FROM events
   WHERE start_date < CURRENT_DATE - INTERVAL '30 days';
   ```

2. **Automated cleanup job:**
   - Set up weekly cron job
   - Archive events older than 30 days
   - Keep recent past events for "What I Missed" feature

### Validation Query
```sql
-- Monitor stale data over time
SELECT 
  CASE 
    WHEN start_date < CURRENT_DATE - INTERVAL '90 days' THEN '90+ days old'
    WHEN start_date < CURRENT_DATE - INTERVAL '60 days' THEN '60-90 days old'
    WHEN start_date < CURRENT_DATE - INTERVAL '30 days' THEN '30-60 days old'
    WHEN start_date < CURRENT_DATE THEN '0-30 days old'
    ELSE 'Future'
  END as age_range,
  COUNT(*) as event_count
FROM events
GROUP BY age_range
ORDER BY 
  CASE age_range
    WHEN '90+ days old' THEN 1
    WHEN '60-90 days old' THEN 2
    WHEN '30-60 days old' THEN 3
    WHEN '0-30 days old' THEN 4
    ELSE 5
  END;
```

---

## Summary of Recommendations

### IMMEDIATE ACTIONS (This Week)

1. **Fix Landmark Midtown duplicates** - Modify crawler to create one event per film per day
2. **Deactivate Generic Venue Crawler** - Investigate and clean up 557 low-quality events
3. **Archive past events** - Remove events older than 30 days
4. **Review Meetup data** - Decide whether to keep 57 future events from inactive source

### SHORT TERM (This Month)

5. **Improve image coverage** - Target nightlife, family, meetup categories
6. **Fix time extraction** - Focus on Georgia Tech Athletics (100% missing)
7. **Clean up inactive sources** - Reactivate valuable ones, delete empty ones

### LONG TERM (Next Quarter)

8. **Automated monitoring** - Run this audit weekly, alert on quality threshold breaches
9. **Schema enhancements** - Add showtimes[], time_status fields
10. **Deduplication improvements** - Better handling of multi-showtime events

---

## Monitoring & Next Steps

**Weekly Audit:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python audit_data_quality.py > reports/audit-$(date +%Y-%m-%d).txt
```

**Key Metrics to Track:**
- Duplicate event count (target: <1%)
- Empty description rate (target: <5%)
- Missing image rate (target: <30%)
- Stale data percentage (target: <5%)
- Missing time rate (target: <15% excluding film/all-day)

**Success Criteria:**
- Landmark duplicates reduced from 273 to <20
- Generic Venue Crawler deactivated
- Past events <10% of database
- Description quality >90%
- Image coverage >60%

---

**Report Generated:** 2026-01-29  
**Tools:** `audit_data_quality.py`, `data_quality_queries.sql`  
**Next Audit:** 2026-02-05 (weekly)
