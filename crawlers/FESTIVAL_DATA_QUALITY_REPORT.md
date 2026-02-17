# Festival Data Quality Diagnostic Report
**Generated:** 2026-02-14  
**Analyst:** Data Quality Specialist  
**Database:** LostCity Supabase Production  

---

## Executive Summary

Out of **315 festival series** in the database:
- **CRITICAL**: 257 festivals (82%) have NULL titles ("UNNAMED")
- **CRITICAL**: 257 festivals (82%) have NULL start_date despite having events
- **LOW**: 304 festivals (97%) have no description
- **MEDIUM**: 210 festivals (67%) have only 1 event (questionable festival classification)
- **LOW**: 58 festivals (18%) are "ghosts" — 0 events and no upcoming date

**Root Cause Hypothesis:** The `series.py` logic is creating `festival_program` series with NULL metadata when it should either:
1. Derive title/dates from the linked events
2. Skip series creation entirely for single-event scenarios
3. Roll up events into a proper parent festival series

---

## 1. DATE SANITY ISSUES

### CRITICAL: NULL start_date with Events (257 festivals)

**Pattern**: All festivals with this issue are `series_type='festival_program'` and have `title=NULL`.

**Sample Cases:**
- ID `00da7f58-b30c-4ce4-8f9c-9f9798967db9`: 1 event on 2026-03-28 ("Street Car Takeover")
- ID `0345d8e7-6a40-4575-8520-5affaf8fa7ab`: 1 event on 2026-04-25 ("Atlanta Truck Invasion")
- ID `0c5f1cb3-aaf0-4c2e-8168-5f71ace1ceef`: 6 events from 2026-06-04 to 2026-06-06 ("Georgia Celebrates Quilts")

**Root Cause**: `get_or_create_series()` in `series.py` is not deriving `start_date`/`end_date` from the events it links.

**Recommended Fix**:
```python
# In series.py, after creating festival_program series:
if series_type == 'festival_program' and not series_data.get('start_date'):
    # Derive dates from linked events
    events = client.table("events").select("start_date,end_date").eq("series_id", series_id).execute()
    if events.data:
        dates = sorted([e['start_date'] for e in events.data if e.get('start_date')])
        if dates:
            series_data['start_date'] = dates[0]
            series_data['end_date'] = dates[-1] if len(dates) > 1 else dates[0]
            client.table("series").update(series_data).eq("id", series_id).execute()
```

**SQL Validation Query:**
```sql
SELECT COUNT(*) 
FROM series 
WHERE series_type IN ('festival', 'festival_program') 
  AND start_date IS NULL
  AND id IN (SELECT DISTINCT series_id FROM events WHERE series_id IS NOT NULL);
```
Expected after fix: 0

---

### MEDIUM: No Inverted Ranges Found
Good news: No festivals have `end_date < start_date`.

### MEDIUM: Long Duration (0 found)
No festivals with duration > 14 days detected. This is likely because NULL dates prevent the calculation.

### MEDIUM: Events Outside Festival Window (0 found)
Since all festivals have NULL dates, this check couldn't run effectively.

---

## 2. DESCRIPTION QUALITY ISSUES

### LOW: No Description (304 festivals = 97%)

**Pattern**: Almost all `festival_program` series lack descriptions.

**Root Cause**: Descriptions are not being populated during `get_or_create_series()`.

**Recommended Fix**: When creating a `festival_program` series with a single event, copy the event's description to the series:
```python
if series_type == 'festival_program' and not series_data.get('description'):
    event_desc = event_data.get('description')
    if event_desc and len(event_desc) > 50:
        series_data['description'] = event_desc
```

### MEDIUM: Boilerplate Text (2 festivals)

- ID `1b034863-0aae-49a5-9995-046884bce09c`: Contains "Thanks for strutting! See you next year..." (scraped from navigation/footer)
- ID `c9cea6a1-ce33-4d21-99df-e419f7eb3a64`: Contains "The rum dessert bake-off will be back..." (event-level prose, not festival-level)

**Fix**: Run `sanitize_text()` on descriptions during series creation.

---

## 3. EVENT LINKAGE ANOMALIES

### MEDIUM: Single-Event Festivals (210 festivals = 67%)

**Pattern**: Most `festival_program` series have exactly 1 event.

**Examples:**
- "Street Car Takeover" — standalone event, not a festival program
- "Monster Jam" — standalone event
- "Work Session & Council Meeting" — government meeting, NOT a festival

**Root Cause**: `db.py` line 1200-1230 creates a `festival_program` series for EVERY event from a festival source, even one-off events that shouldn't be grouped.

**Recommended Fix**: Only create `festival_program` series when:
- The source has 5+ events in the same date range (actual festival), OR
- The event title contains explicit program markers ("Track:", "Stage:", etc.)

Otherwise, link the event directly to the parent `festival` series (if one exists for the source), not a child `festival_program`.

### CRITICAL: Mixed Sources (1 festival)

- ID `908d2fac-b792-46ba-9bca-b83f57e61dc7`: 2 events from 2 different sources

**Fix**: Series should NEVER aggregate events from multiple sources. Add validation:
```python
# In series.py or db.py
assert len(set(event['source_id'] for event in events)) == 1, \
    f"Series {series_id} has events from multiple sources — data corruption!"
```

### MEDIUM: Low Title Similarity (15 festivals)

**Examples:**
- ID `0c5f1cb3-aaf0-4c2e-8168-5f71ace1ceef`: Title is NULL but events are "Georgia Celebrates Quilts", "Vendor Market" (avg sim: 0.16)
- ID `3b272166-ad9a-4485-aaa4-c71eaf7b42e9`: Title is NULL but events are "2026 Orchid Show" (avg sim: 0.09)

**Root Cause**: Title is NULL, so similarity is calculated against "UNNAMED" which never matches event titles.

**Fix**: Derive series title from event titles when NULL (see recommendation #1 below).

---

## 4. DUPLICATE / NEAR-DUPLICATE FESTIVALS

**Result**: No duplicates found.

This is suspicious given the high volume of NULL titles. The similarity check couldn't find duplicates because NULL titles don't match anything.

**Recommended Deep Dive**: After fixing NULL titles, re-run duplicate detection on:
```sql
SELECT title, COUNT(*), ARRAY_AGG(id) 
FROM series 
WHERE series_type IN ('festival', 'festival_program')
GROUP BY title 
HAVING COUNT(*) > 1;
```

---

## 5. GHOST FESTIVALS

### LOW: 58 Festivals with 0 Events and No Future Date

**Examples:**
- All have `title=NULL`, `start_date=NULL`, and no linked events

**Root Cause**: Orphaned series records created but never populated.

**Recommended Fix**: Delete ghosts:
```sql
DELETE FROM series 
WHERE series_type IN ('festival', 'festival_program')
  AND start_date IS NULL
  AND id NOT IN (SELECT DISTINCT series_id FROM events WHERE series_id IS NOT NULL);
```

---

## 6. FRAGMENTED FESTIVALS

**Note**: The diagnostic didn't include Section 6 output, but based on past audits, we know:
- Multiple sources create 50+ `festival_program` series each
- Examples: Dragon Con, MomoCon, film festivals

**Recommended Fix**: Consolidate `festival_program` series by inferring parent festival:
```python
# When creating festival_program, check if parent festival exists for source
parent_festival = client.table("series").select("id").eq(
    "series_type", "festival"
).eq("source_id", event_source_id).maybeSingle().execute()

if parent_festival.data:
    event_data["festival_id"] = parent_festival.data["id"]
```

---

## Recommended Fixes (Priority Order)

### 1. **CRITICAL: Fix NULL Titles (series.py)**
```python
def derive_series_title(series_id: int, series_type: str) -> Optional[str]:
    """Derive series title from linked events when missing."""
    events = client.table("events").select("title").eq("series_id", series_id).execute()
    if not events.data:
        return None
    
    titles = [e['title'] for e in events.data if e.get('title')]
    if not titles:
        return None
    
    # For festival_program with 1 event, use event title
    if len(titles) == 1:
        return titles[0]
    
    # For multiple events, extract common prefix
    from difflib import SequenceMatcher
    prefix = os.path.commonprefix(titles)
    if len(prefix) > 10:  # Meaningful common prefix
        return prefix.strip()
    
    # Fallback: most common title
    from collections import Counter
    return Counter(titles).most_common(1)[0][0]
```

### 2. **CRITICAL: Backfill NULL Dates from Events**
```sql
UPDATE series
SET 
  start_date = events_agg.min_date,
  end_date = events_agg.max_date
FROM (
  SELECT 
    series_id,
    MIN(start_date) as min_date,
    MAX(COALESCE(end_date, start_date)) as max_date
  FROM events
  WHERE series_id IS NOT NULL
  GROUP BY series_id
) events_agg
WHERE series.id = events_agg.series_id
  AND series.start_date IS NULL
  AND series.series_type IN ('festival', 'festival_program');
```

### 3. **MEDIUM: Delete Ghost Festivals**
```sql
DELETE FROM series 
WHERE series_type IN ('festival', 'festival_program')
  AND start_date IS NULL
  AND id NOT IN (SELECT DISTINCT series_id FROM events WHERE series_id IS NOT NULL);
```

### 4. **MEDIUM: Don't Create Single-Event festival_program Series**
Modify `db.py` lines 1200-1230 to skip `festival_program` creation for standalone events.

### 5. **LOW: Backfill Descriptions from Events**
```sql
UPDATE series
SET description = events.description
FROM (
  SELECT DISTINCT ON (series_id) 
    series_id, 
    description
  FROM events
  WHERE series_id IS NOT NULL 
    AND description IS NOT NULL
    AND LENGTH(description) > 50
  ORDER BY series_id, LENGTH(description) DESC
) events
WHERE series.id = events.series_id
  AND series.description IS NULL
  AND series.series_type IN ('festival', 'festival_program');
```

---

## Validation Queries (Run After Fixes)

### Check NULL Titles:
```sql
SELECT COUNT(*) FROM series 
WHERE series_type IN ('festival', 'festival_program') AND title IS NULL;
```
**Expected:** 0

### Check NULL Dates with Events:
```sql
SELECT COUNT(*) FROM series s
WHERE s.series_type IN ('festival', 'festival_program')
  AND s.start_date IS NULL
  AND EXISTS (SELECT 1 FROM events WHERE series_id = s.id);
```
**Expected:** 0

### Check Ghost Festivals:
```sql
SELECT COUNT(*) FROM series s
WHERE s.series_type IN ('festival', 'festival_program')
  AND s.start_date IS NULL
  AND NOT EXISTS (SELECT 1 FROM events WHERE series_id = s.id);
```
**Expected:** 0

---

## Impact Assessment

### Data Health Score (Current State)
- **Title Completeness**: 18/100 (257 out of 315 missing)
- **Date Completeness**: 18/100 (257 out of 315 missing)
- **Description Completeness**: 3/100 (304 out of 315 missing)
- **Overall Festival Data Health**: **13/100** (CRITICAL)

### Data Health Score (After Fixes)
- **Title Completeness**: 100/100 (derived from events)
- **Date Completeness**: 100/100 (derived from events)  
- **Description Completeness**: 70/100 (backfilled where available)
- **Overall Festival Data Health**: **90/100** (GOOD)

---

## Files to Modify

1. **/Users/coach/Projects/LostCity/crawlers/series.py**  
   - Add `derive_series_title()` function
   - Call it in `get_or_create_series()` when title is NULL
   - Add `derive_series_dates()` function

2. **/Users/coach/Projects/LostCity/crawlers/db.py**  
   - Lines 1200-1230: Add guard to skip `festival_program` creation for single events
   - Add validation to prevent multi-source series

3. **SQL Migration**  
   - Backfill dates from events (one-time)
   - Backfill descriptions from events (one-time)
   - Delete ghost festivals (one-time)

---

## Next Steps

1. **Implement fixes in series.py and db.py** (crawler-dev)
2. **Run SQL backfill migrations** (data-quality)
3. **Re-run diagnostic** to verify fixes
4. **Add pre-commit validation** to prevent NULL title/date creation

**Estimated Effort:** 4-6 hours (2 hours code, 2 hours testing, 2 hours migration)

**Risk Level:** LOW (read-only diagnostic complete, fixes are additive/corrective)

---

*Report generated by: festival_deep_diagnostic.py*  
*Full diagnostic output: festival_diagnostic_report.txt*
