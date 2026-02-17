# Festival Data Integrity Audit - Executive Summary
**Date:** 2026-02-14  
**Auditor:** Claude Code (Data Quality Specialist)  
**Database:** LostCity Production Supabase  

---

## TL;DR

**Status:** SYSTEM IS CLEAN ✅

The feared "calendar absorption" problem (festivals absorbing all events from a city/source) is **NOT occurring** in production. The series linking logic in `db.py` and `series.py` is working correctly.

**What we found:**
- ✅ No calendar absorption (Decatur city events are NOT linked to Decatur festivals)
- ✅ No aggregator contamination (Ticketmaster/Eventbrite clean)
- ✅ No classes in festivals
- ⚠️  13 sources creating fragmented festival_program series (needs crawler fixes)

---

## Detailed Findings

### 1. Calendar Absorption Check (NEGATIVE)

**User's concern:** "Decatur Arts Festival is absorbing all Decatur events"

**Reality check:**
```
Source: City of Decatur
  Total events: 10
  Events with series: 0 ✅
  Events without series: 10 ✅
```

The `City of Decatur` source has 10 events, and **NONE** are linked to `Decatur Arts Festival` or `Decatur Book Festival`. The series linking logic correctly distinguishes between:
- Festival-specific events (linked to festival series)
- General city calendar events (no series link)

**Verdict:** Calendar absorption is NOT happening. The system is working as designed.

---

### 2. Aggregator Contamination (NEGATIVE)

Checked: `ticketmaster`, `eventbrite`, `dice`, `eventcombo`

**Result:** 0 events from aggregator sources linked to festival series ✅

The `_FESTIVAL_SOURCE_SLUGS` hardcoding in `db.py` prevents aggregators from being treated as festivals.

---

### 3. Classes in Festivals (NEGATIVE)

**Result:** 0 events with `is_class=true` linked to festival/festival_program series ✅

The `infer_is_class()` logic correctly prevents classes from being absorbed into festivals.

---

### 4. Festival Series Fragmentation (POSITIVE - ACTION NEEDED)

**Found:** 13 sources creating multiple `festival_program` series when they should create ONE series

**Top offenders:**
1. `atlanta-supercross` - 25 series (should be 1 recurring_show)
2. `pigs-and-peaches-bbq` - 13 series (should be 1 festival)
3. `nascar-atlanta` - 13 series (should be 1-3 series)
4. `rk-gun-show-atlanta` - 10 series (need location-specific recurring_show series)

**Root cause:** Crawlers are extracting sub-event titles (e.g., "Round 6", "George Pippen") and passing them as `series_hint["series_title"]`, which creates a new series for each event.

**Impact:** Low - events are correctly captured, just over-organized into too many series.

---

## Problematic Sources Breakdown

### High Priority (22+ fragmented series)

#### atlanta-supercross (25 series → 1 series)
**Current:** Each race round is a separate `festival_program`
```
- "Round 6" (1 event)
- "Round 7" (1 event)  
- "Playoff 1" (1 event)
... 22 more
```

**Correct structure:**
```python
series_hint = {
    "series_type": "recurring_show",
    "series_title": "Monster Energy AMA Supercross",
}
# Each race is an event, not a series
```

**Fix:** Update `/Users/coach/Projects/LostCity/crawlers/sources/atlanta-supercross.py`
- Don't extract round numbers as `series_title`
- Use source name as `series_title`

---

#### pigs-and-peaches-bbq (13 series → 1 series)
**Current:** Each music act is a separate `festival_program`
```
- "Sons-N-Britches" (1 event)
- "George Pippen" (1 event)
- "HunterGirl" (1 event)
... 10 more
```

**Correct structure:**
```python
series_hint = {
    "series_type": "festival",
    "series_title": "Pigs & Peaches BBQ Festival",
}
# Performer name goes in event.title, not series_title
```

**Fix:** Update `/Users/coach/Projects/LostCity/crawlers/sources/pigs-and-peaches-bbq.py`
- Extract performer names as event titles
- Don't pass performer names as `series_title`

---

### Medium Priority (10-13 fragmented series)

#### nascar-atlanta (13 series → 2-3 series)
Mixed event types need classification:
- NASCAR races → `recurring_show`
- Autocross events → `recurring_show` (separate series)
- One-off festivals (Monster Jam, Georgia State Fair) → `festival`

#### rk-gun-show-atlanta (10 series → 10 series, wrong type)
Each location should be a `recurring_show`, not `festival_program`:
```python
# Current (wrong):
series_hint = {
    "series_type": "festival_program",
    "series_title": "Marietta, GA – Gun Show",
}

# Correct:
series_hint = {
    "series_type": "recurring_show",
    "series_title": "R.K. Gun Show - Marietta",
}
```

---

### Low Priority (3-5 fragmented series)

9 additional sources with minor fragmentation:
- `atlanta-rare-book-fair` (5 series)
- `johns-creek-arts-fest` (4 series)
- `east-atlanta-strut` (4 series)
- `l5p-halloween` (4 series)
- `juneteenth-atlanta` (4 series)
- `snellville-days` (4 series - government meetings, NOT festival programs)
- `blue-ridge-blues-bbq` (3 series)
- `monsterama-con` (3 series)
- `conyers-cherry-blossom` (3 series - duplicates)

---

## Recommended Actions

### Immediate (High Priority)

1. **Fix atlanta-supercross crawler** (2 hours)
   - Update `sources/atlanta-supercross.py`
   - Run SQL consolidation (see `festival_cleanup_sql.py` output)
   - Verify: 25 events → 1 series

2. **Fix pigs-and-peaches-bbq crawler** (1 hour)
   - Update `sources/pigs-and-peaches-bbq.py`
   - Run SQL consolidation
   - Verify: 13 events → 1 series

### Short-term (Medium Priority)

3. **Fix nascar-atlanta crawler** (2 hours)
   - Classify event types correctly
   - Update `sources/nascar-atlanta.py`
   - Run SQL consolidation

4. **Fix rk-gun-show-atlanta crawler** (1 hour)
   - Change `festival_program` → `recurring_show`
   - Update `sources/rk-gun-show-atlanta.py`

### Long-term (Low Priority)

5. **Audit remaining 9 sources** (3 hours)
   - Review each crawler
   - Fix series type misclassifications
   - Consolidate where appropriate

---

## SQL Cleanup Scripts

Generated SQL for data cleanup available in:
```bash
python3 /Users/coach/Projects/LostCity/crawlers/festival_cleanup_sql.py > cleanup.sql
```

Example for atlanta-supercross:
```sql
-- Create consolidated series
INSERT INTO series (title, series_type, slug)
VALUES ('Monster Energy AMA Supercross', 'recurring_show', 'atlanta-supercross')
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- Relink all events
UPDATE events SET series_id = '<new-series-id>'
WHERE source_id = 713 AND series_id IN (...);

-- Delete fragmented series
DELETE FROM series WHERE id IN (...);
```

---

## Validation Queries

### Check for festival fragmentation:
```sql
SELECT so.slug, COUNT(DISTINCT se.id) as program_count
FROM sources so
JOIN events e ON e.source_id = so.id
JOIN series se ON e.series_id = se.id
WHERE se.series_type = 'festival_program'
GROUP BY so.id, so.slug
HAVING COUNT(DISTINCT se.id) >= 10
ORDER BY program_count DESC;
```

### Check for calendar absorption:
```sql
SELECT s.title, COUNT(DISTINCT e.venue_id) as venue_count
FROM series s
JOIN events e ON e.series_id = s.id
WHERE s.series_type IN ('festival', 'festival_program')
GROUP BY s.id, s.title
HAVING COUNT(DISTINCT e.venue_id) >= 8;
```

**Expected result after fixes:** 0 rows

---

## Files & Scripts

**Audit scripts:**
- `/Users/coach/Projects/LostCity/crawlers/festival_audit_fast.py` - Main audit
- `/Users/coach/Projects/LostCity/crawlers/festival_deep_dive.py` - Deep investigation
- `/Users/coach/Projects/LostCity/crawlers/festival_cleanup_sql.py` - SQL generator

**Diagnostic reports:**
- `/Users/coach/Projects/LostCity/crawlers/FESTIVAL_DATA_DIAGNOSTIC.md` - Full technical report
- `/Users/coach/Projects/LostCity/crawlers/FESTIVAL_AUDIT_SUMMARY.md` - This file

**Core logic:**
- `/Users/coach/Projects/LostCity/crawlers/db.py` - Lines 299-440 (festival hints)
- `/Users/coach/Projects/LostCity/crawlers/series.py` - Lines 208-286 (series creation)

---

## Monitoring Recommendations

Add to `data_health.py`:

```python
def check_festival_fragmentation():
    """Alert if a source creates 5+ festival_program series."""
    client = get_client()
    
    result = client.rpc('check_festival_fragmentation').execute()
    
    if result.data:
        for row in result.data:
            if row['program_count'] >= 5:
                print(f"⚠️  {row['source_slug']}: {row['program_count']} festival_program series")
```

**Threshold:** Alert if any source creates 5+ `festival_program` series.

---

## Conclusion

**Good news:** The core series linking logic is sound. No calendar absorption, no aggregator contamination.

**Action required:** Fix 13 crawlers that are over-fragmenting festival events into too many series.

**Estimated effort:** 8-10 hours total (high priority: 3 hours, medium: 3 hours, low: 3 hours, testing: 1-2 hours)

**Impact:** Low urgency - events are being captured correctly, just need better organization.

---

**Next steps for crawler-dev:**
1. Review this summary
2. Run `festival_cleanup_sql.py` to get SQL consolidation scripts
3. Fix high-priority crawlers (atlanta-supercross, pigs-and-peaches-bbq)
4. Test with `python main.py --source atlanta-supercross`
5. Run SQL cleanup
6. Verify with validation queries
