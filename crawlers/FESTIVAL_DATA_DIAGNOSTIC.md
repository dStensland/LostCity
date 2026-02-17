# Festival Data Integrity Diagnostic Report
**Date:** 2026-02-14  
**Database:** LostCity Production Supabase  
**Scope:** All festival and festival_program series  

---

## Executive Summary

After deep audit of festival data integrity, the system is in **better shape than expected**. The suspected "calendar absorption" issue (Decatur festivals absorbing all Decatur events) is **NOT occurring** in production.

**Key Findings:**
- ✅ No festival series with 8+ venues (calendar absorption indicator)
- ✅ Decatur sources show clean separation (City of Decatur has 10 events, NONE linked to festival series)
- ✅ No aggregator contamination (Ticketmaster/Eventbrite not linking to festivals)
- ✅ No classes incorrectly linked to festival series
- ⚠️  6 film festivals flagged for low title overlap (FALSE POSITIVE - expected behavior)
- ⚠️  13 sources creating multiple festival_program series (needs review)

---

## Issue Analysis

### Issue 1: Film Festival Title Overlap (FALSE POSITIVE)

**Status:** Not a bug, expected behavior  
**Count:** 6 series flagged

These are film festivals where individual screening titles naturally don't match the festival name:

1. **Devnexus 2026** - 94 tech conference sessions (1.17% title overlap)
2. **Atlanta Horror Film Festival** - 36 film screenings (4.16% overlap)
3. **2026 Atlanta Underground Film Festival** - 32 screenings (3.12% overlap)
4. **Love Y'all Book Fest - General Program** - 25 author sessions (0% overlap)
5. **17th Annual Atlanta Short Film Festival** - 20 screenings (5% overlap)
6. **Smoke on the Lake BBQ Festival** - 12 vendor/activity listings (8.33% overlap)

**Recommendation:** These are correctly structured. A film festival showing "The Godfather" shouldn't have "Atlanta Film Festival" in the movie title. No action needed.

---

### Issue 2: Sources Creating Multiple Festival Programs

**Status:** NEEDS REVIEW  
**Count:** 13 sources

Some sources are creating many `festival_program` series when they should be creating a single festival with multiple programs:

#### High Priority (10+ programs):

1. **atlanta-supercross** - 22 festival programs
   - Series: "Playoff 1", "Round 24", "Playoff 2", "Round 6", "Round 7"...
   - **Issue:** Each race/round is a separate series instead of events under one "Monster Energy AMA Supercross" series
   - **Fix:** Create single recurring_show series, link all races as events

2. **pigs-and-peaches-bbq** - 12 festival programs
   - Series: "Sons-N-Britches", "George Pippen", "Jessie Lane"... (music acts)
   - **Issue:** Each performer is a separate festival_program
   - **Fix:** These should be events under one "Pigs & Peaches BBQ Festival" series

3. **nascar-atlanta** - 10 festival programs
   - Series: "Autotrader 400", "Sports Car Club of America Peachstate Autocross"...
   - **Issue:** Each race is a separate series
   - **Fix:** Group by event type (NASCAR races, autocross, etc.)

4. **rk-gun-show-atlanta** - 10 festival programs
   - Series: "Marietta, GA – Gun Show", "Waycross, GA – Gun Show"...
   - **Issue:** Each location is a separate series
   - **Fix:** These are recurring shows at different venues, should be individual recurring_show series per venue

#### Medium Priority (3-5 programs):

5. **atlanta-rare-book-fair** - 5 programs (different days/times of same festival)
6. **johns-creek-arts-fest** - 4 programs (classes at festival - should be class_series)
7. **east-atlanta-strut** - 4 programs (festival activities)
8. **l5p-halloween** - 4 programs (festival activities)
9. **juneteenth-atlanta** - 4 programs (parade + 5K + related events)
10. **snellville-days** - 4 programs (government meetings, NOT festival programs)
11. **blue-ridge-blues-bbq** - 3 programs (different festivals, correctly separated)
12. **monsterama-con** - 3 programs (hours/registration - should be events)
13. **conyers-cherry-blossom** - 3 programs (duplicate series for same festival)

---

### Issue 3: Decatur Calendar Absorption (RESOLVED)

**Status:** NOT OCCURRING  
**Original concern:** Decatur festivals absorbing all Decatur events from shared calendar

**Actual state:**
- **City of Decatur source:** 10 events, 0 linked to festival series ✅
- **Decatur Makers:** 12 events, only 1 linked to series (class_series, not festival) ✅
- **Decatur Book Festival:** 2 events, both correctly linked to festival_program ✅
- **Decatur Farmers Market:** 4 events, correctly linked to recurring_show (not festival) ✅

The series.py logic is working correctly - it's NOT creating false festival linkages.

---

### Issue 4: Aggregator Contamination (NOT FOUND)

**Status:** CLEAN  
**Checked sources:** ticketmaster, eventbrite, dice, eventcombo  
**Result:** 0 aggregator events linked to festival series ✅

The festival linking logic correctly avoids linking aggregator events to festivals.

---

### Issue 5: Classes in Festivals (NOT FOUND)

**Status:** CLEAN  
**Result:** 0 events with `is_class=true` linked to festival/festival_program series ✅

---

## Root Cause Analysis

The 13 sources creating multiple festival_program series have a common pattern:

**Crawler-level issue:** These sources have ONE calendar/schedule page with MANY sub-events, and the crawler is:
1. Detecting the page as a festival source (correctly)
2. Creating a festival_program series for EACH event title variation (incorrectly)
3. Not recognizing these should be events under a SINGLE series

**Example:** Pigs & Peaches BBQ Festival has a lineup page. The crawler sees:
- "Sons-N-Britches at Pigs & Peaches"
- "George Pippen at Pigs & Peaches"

And creates TWO festival_program series instead of TWO events under ONE "Pigs & Peaches BBQ Festival" series.

---

## Recommended Fixes

### Fix 1: Atlanta Supercross (22 series → 1 series)

**Current behavior:**
- 22 festival_program series: "Playoff 1", "Round 24", etc.

**Correct structure:**
```python
series_hint = {
    "series_type": "recurring_show",  # Not festival_program
    "series_title": "Monster Energy AMA Supercross",
}
# Each race is an event, not a series
```

**Crawler change:** Update `sources/atlanta-supercross.py` to NOT extract individual race names as festival_program titles.

---

### Fix 2: Pigs & Peaches BBQ (12 series → 1 series)

**Current behavior:**
- 12 festival_program series (one per performer)

**Correct structure:**
```python
series_hint = {
    "series_type": "festival",  # The festival itself
    "series_title": "Pigs & Peaches BBQ Festival",
}
# Each performer is an event with artist name in title
```

**Crawler change:** Update `sources/pigs-and-peaches-bbq.py` to extract performer names as event titles, not program titles.

---

### Fix 3: NASCAR Atlanta (10 series → 3-4 series)

**Current behavior:**
- 10 festival_program series (mixed race types)

**Correct structure:**
- "NASCAR Cup Series at Atlanta" (recurring_show)
- "SCCA Autocross at Atlanta" (recurring_show)
- "Georgia State Fair" (festival)
- "Atlanta Truck Invasion" (festival)

**Crawler change:** Classify event types correctly, don't treat every event as a festival_program.

---

### Fix 4: R.K. Gun Shows (10 series → 10 series, but wrong type)

**Current behavior:**
- 10 festival_program series (one per location)

**Correct structure:**
```python
series_hint = {
    "series_type": "recurring_show",  # Not festival_program
    "series_title": f"R.K. Gun Show - {location}",
}
```

**Crawler change:** These are recurring monthly shows, not festival programs.

---

### Fix 5-13: Remaining sources

Similar patterns - need crawler-level fixes to:
1. Detect when a source is a SINGLE festival (not multiple)
2. Create ONE series for the festival
3. Extract sub-events as EVENTS, not as separate festival_program series

---

## Data Cleanup Queries

### Query 1: Find all events under problematic series

```sql
-- Atlanta Supercross events
SELECT e.id, e.title, e.start_date, s.title as series_title
FROM events e
JOIN series s ON e.series_id = s.id
WHERE e.source_id = (SELECT id FROM sources WHERE slug = 'atlanta-supercross')
ORDER BY e.start_date;
```

### Query 2: Unlink and consolidate

```sql
-- Step 1: Create consolidated series
INSERT INTO series (title, series_type, slug)
VALUES ('Monster Energy AMA Supercross', 'recurring_show', 'monster-energy-ama-supercross')
RETURNING id;

-- Step 2: Relink events to consolidated series
UPDATE events
SET series_id = '<new-series-id>'
WHERE source_id = (SELECT id FROM sources WHERE slug = 'atlanta-supercross');

-- Step 3: Delete old fragmented series
DELETE FROM series
WHERE id IN (
  SELECT DISTINCT series_id FROM events
  WHERE source_id = (SELECT id FROM sources WHERE slug = 'atlanta-supercross')
  AND series_id != '<new-series-id>'
);
```

---

## Validation Checks

After fixes, run these checks:

### Check 1: No source should create 10+ festival_program series
```sql
SELECT s.slug, s.name, COUNT(DISTINCT se.id) as program_count
FROM sources so
JOIN events e ON e.source_id = so.id
JOIN series se ON e.series_id = se.id
WHERE se.series_type = 'festival_program'
GROUP BY so.id, so.slug, so.name
HAVING COUNT(DISTINCT se.id) > 10
ORDER BY program_count DESC;
```

### Check 2: No festival series should span 8+ venues
```sql
SELECT s.title, s.series_type, COUNT(DISTINCT e.venue_id) as venue_count
FROM series s
JOIN events e ON e.series_id = s.id
WHERE s.series_type IN ('festival', 'festival_program')
GROUP BY s.id, s.title, s.series_type
HAVING COUNT(DISTINCT e.venue_id) >= 8
ORDER BY venue_count DESC;
```

### Check 3: Festival title overlap quality
```sql
-- Events where title shares NO words with series title (red flag for absorption)
SELECT s.title as series_title, e.title as event_title, e.id
FROM events e
JOIN series s ON e.series_id = s.id
WHERE s.series_type IN ('festival', 'festival_program')
AND NOT EXISTS (
  SELECT 1 FROM unnest(string_to_array(lower(s.title), ' ')) festival_word
  WHERE EXISTS (
    SELECT 1 FROM unnest(string_to_array(lower(e.title), ' ')) event_word
    WHERE festival_word = event_word
  )
)
LIMIT 100;
```

---

## Ongoing Monitoring

Add to `data_health.py`:

```python
def check_festival_fragmentation():
    """Alert if a source creates 5+ festival_program series."""
    client = get_client()
    
    query = """
    SELECT s.slug, COUNT(DISTINCT se.id) as program_count
    FROM sources s
    JOIN events e ON e.source_id = s.id
    JOIN series se ON e.series_id = se.id
    WHERE se.series_type = 'festival_program'
    GROUP BY s.id, s.slug
    HAVING COUNT(DISTINCT se.id) >= 5
    ORDER BY program_count DESC;
    """
    
    # Execute and report
```

---

## Conclusion

**Good news:** The festival data is cleaner than expected. No calendar absorption, no aggregator contamination, no class contamination.

**Action needed:** Fix 13 sources that are creating fragmented festival_program series instead of consolidating events under a single festival/recurring_show series.

**Priority:**
1. **HIGH:** atlanta-supercross (22 series), pigs-and-peaches-bbq (12 series)
2. **MEDIUM:** nascar-atlanta, rk-gun-show-atlanta (10 series each)
3. **LOW:** Remaining 9 sources (3-5 series each)

**Estimated effort:** 2-3 hours to fix all 13 crawler sources + verify data cleanup.

---

## Files Referenced

- `/Users/coach/Projects/LostCity/crawlers/db.py` - Festival hint logic (lines 299-440)
- `/Users/coach/Projects/LostCity/crawlers/series.py` - Series creation (lines 208-286)
- `/Users/coach/Projects/LostCity/crawlers/festival_audit_fast.py` - Audit script
- `/Users/coach/Projects/LostCity/crawlers/festival_deep_dive.py` - Deep investigation

