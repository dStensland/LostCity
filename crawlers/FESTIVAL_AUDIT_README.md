# Festival Data Audit Tools

This directory contains comprehensive diagnostic tools for auditing festival data integrity in the LostCity database.

## Quick Start

### Run Health Check (2 minutes)
```bash
python3 check_festival_health.py
```
Checks for:
- Calendar absorption (festivals with 8+ venues)
- Festival fragmentation (sources creating 10+ series)
- Classes incorrectly linked to festivals

**Expected output:**
```
✅ PASSED - No calendar absorption detected
❌ FAILED - 4 sources with 10+ festival_program series
✅ PASSED - No classes in festivals
```

---

## Available Tools

### 1. Quick Health Check
**File:** `check_festival_health.py`  
**Runtime:** ~2 minutes  
**Purpose:** Pass/fail check for common issues

```bash
python3 check_festival_health.py
```

**Exit codes:**
- `0` - All checks passed
- `1` - One or more checks failed

---

### 2. Fast Audit (Optimized)
**File:** `festival_audit_fast.py`  
**Runtime:** ~1 minute  
**Purpose:** Comprehensive audit with all data loaded in memory

```bash
python3 festival_audit_fast.py
```

**Output:**
- Issue 1: Event absorption by festivals
- Issue 2: Aggregator contamination
- Issue 3: Classes in festivals
- Issue 4: Decatur contamination

---

### 3. Deep Dive Investigation
**File:** `festival_deep_dive.py`  
**Runtime:** ~2 minutes  
**Purpose:** Source-level analysis of festival linking patterns

```bash
python3 festival_deep_dive.py
```

**Output:**
- Decatur source breakdown
- Festival series venue diversity
- Source series creation patterns

---

### 4. SQL Cleanup Generator
**File:** `festival_cleanup_sql.py`  
**Runtime:** ~1 minute  
**Purpose:** Generate SQL scripts to consolidate fragmented series

```bash
python3 festival_cleanup_sql.py > cleanup.sql
```

**Output:** Transaction-safe SQL for:
1. Creating consolidated series
2. Relinking events
3. Deleting fragmented series
4. Verification queries

---

## Reports

### Executive Summary
**File:** `FESTIVAL_AUDIT_SUMMARY.md`  
**Audience:** Product/engineering leads  
**Contents:**
- TL;DR status
- Detailed findings
- Prioritized action items
- Effort estimates

### Technical Diagnostic
**File:** `FESTIVAL_DATA_DIAGNOSTIC.md`  
**Audience:** crawler-dev  
**Contents:**
- Root cause analysis
- Crawler-specific fixes
- SQL cleanup queries
- Validation checks

---

## Workflow for Fixing Issues

### 1. Run health check
```bash
python3 check_festival_health.py
```

### 2. If failures, run deep dive
```bash
python3 festival_deep_dive.py > investigation.txt
```

### 3. Generate SQL cleanup
```bash
python3 festival_cleanup_sql.py > cleanup.sql
```

### 4. Review SQL, then execute
```bash
# Review first!
less cleanup.sql

# Execute in Supabase SQL editor (use transactions)
```

### 5. Fix crawler source code
Example for `atlanta-supercross`:
```python
# BEFORE (creates 22 series):
series_hint = {
    "series_type": "festival_program",
    "series_title": event_title,  # "Round 6", "Round 7"...
}

# AFTER (creates 1 series):
series_hint = {
    "series_type": "recurring_show",
    "series_title": "Monster Energy AMA Supercross",
}
```

### 6. Re-run crawler
```bash
python main.py --source atlanta-supercross
```

### 7. Verify fix
```bash
python3 check_festival_health.py
```

---

## Common Issues

### Issue: atlanta-supercross (22 fragmented series)

**Problem:** Each race round creates a separate `festival_program` series

**Fix:**
1. Update `/Users/coach/Projects/LostCity/crawlers/sources/atlanta-supercross.py`
2. Change `series_type` from `festival_program` to `recurring_show`
3. Use source name as `series_title`, not event title
4. Run SQL consolidation from `festival_cleanup_sql.py`

**SQL:**
```sql
-- Consolidate 22 series into 1
UPDATE events SET series_id = '<new-series-id>'
WHERE source_id = 713;

DELETE FROM series WHERE id IN (...);
```

---

### Issue: pigs-and-peaches-bbq (12 fragmented series)

**Problem:** Each music act creates a separate `festival_program` series

**Fix:**
1. Update `/Users/coach/Projects/LostCity/crawlers/sources/pigs-and-peaches-bbq.py`
2. Change `series_type` to `festival`
3. Extract performer names as event titles, not series titles
4. Run SQL consolidation

**SQL:**
```sql
-- Consolidate 12 series into 1
UPDATE events SET series_id = '<new-series-id>'
WHERE source_id = 668;

DELETE FROM series WHERE id IN (...);
```

---

### Issue: nascar-atlanta (10 fragmented series)

**Problem:** Mixed event types all treated as `festival_program`

**Fix:**
1. Update `/Users/coach/Projects/LostCity/crawlers/sources/nascar-atlanta.py`
2. Classify events:
   - NASCAR races → `recurring_show`
   - Autocross → `recurring_show` (separate series)
   - One-off festivals → `festival`
3. Run SQL consolidation

---

### Issue: rk-gun-show-atlanta (10 fragmented series)

**Problem:** Each location is `festival_program` instead of `recurring_show`

**Fix:**
1. Update `/Users/coach/Projects/LostCity/crawlers/sources/rk-gun-show-atlanta.py`
2. Change `series_type` to `recurring_show`
3. Keep location-specific series (Marietta, Waycross, etc.)
4. No SQL consolidation needed (each location should be separate series)

---

## Validation Queries

### After fixes, verify no fragmentation:
```sql
SELECT so.slug, COUNT(DISTINCT se.id) as program_count
FROM sources so
JOIN events e ON e.source_id = so.id
JOIN series se ON e.series_id = se.id
WHERE se.series_type = 'festival_program'
GROUP BY so.id, so.slug
HAVING COUNT(DISTINCT se.id) >= 10;
```
**Expected:** 0 rows

### Verify no calendar absorption:
```sql
SELECT s.title, COUNT(DISTINCT e.venue_id) as venue_count
FROM series s
JOIN events e ON e.series_id = s.id
WHERE s.series_type IN ('festival', 'festival_program')
GROUP BY s.id, s.title
HAVING COUNT(DISTINCT e.venue_id) >= 8;
```
**Expected:** 0 rows

---

## Integration with data_health.py

Add to `/Users/coach/Projects/LostCity/crawlers/data_health.py`:

```python
def check_festival_health():
    """Check for festival data integrity issues."""
    import subprocess
    result = subprocess.run(
        ["python3", "check_festival_health.py"],
        capture_output=True,
        text=True
    )
    print(result.stdout)
    return result.returncode == 0
```

Then call from main health check:
```python
if not check_festival_health():
    health_issues.append("Festival data fragmentation detected")
```

---

## Monitoring

Run health check:
- **After each crawl run** (for sources that create festivals)
- **Weekly** (as part of data health report)
- **Before major releases**

Alert thresholds:
- **Critical:** Any source creating 20+ `festival_program` series
- **Warning:** Any source creating 10+ `festival_program` series
- **Info:** Any source creating 5+ `festival_program` series

---

## Files Reference

**Audit tools:**
- `check_festival_health.py` - Quick health check
- `festival_audit_fast.py` - Full audit (optimized)
- `festival_deep_dive.py` - Deep investigation
- `festival_cleanup_sql.py` - SQL generator

**Documentation:**
- `FESTIVAL_AUDIT_SUMMARY.md` - Executive summary
- `FESTIVAL_DATA_DIAGNOSTIC.md` - Technical report
- `FESTIVAL_AUDIT_README.md` - This file

**Core logic:**
- `db.py` (lines 299-440) - Festival hint extraction
- `series.py` (lines 208-286) - Series creation

**Problematic crawlers:**
- `sources/atlanta-supercross.py`
- `sources/pigs-and-peaches-bbq.py`
- `sources/nascar-atlanta.py`
- `sources/rk-gun-show-atlanta.py`
- + 9 more (see FESTIVAL_AUDIT_SUMMARY.md)

---

## Audit Results (2026-02-14)

**System Status:** CLEAN ✅

- ✅ No calendar absorption
- ✅ No aggregator contamination
- ✅ No classes in festivals
- ⚠️  4 sources with 10+ fragmented series (needs crawler fixes)

**Total issues:** 13 sources need crawler updates  
**Estimated fix time:** 8-10 hours  
**Impact:** Low (events captured correctly, just over-organized)

---

## Questions?

See:
- `FESTIVAL_AUDIT_SUMMARY.md` for business context
- `FESTIVAL_DATA_DIAGNOSTIC.md` for technical details
- Run `python3 check_festival_health.py` for current status
