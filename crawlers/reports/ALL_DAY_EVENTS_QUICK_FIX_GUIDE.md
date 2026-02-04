# All-Day Events Quick Fix Guide

**Problem:** 1,541 events (17.5%) are missing start times  
**Report Date:** 2026-02-03

## Top 5 Crawler Fixes (Ordered by Impact)

### 1. Eddie's Attic (46 events affected)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/eddies_attic.py`

**Issue:** Times exist in raw text ("7pm", "9:15pm") but aren't extracted.

**Fix:** Add fallback regex in `parse_time_text()`:
```python
# Current regex only matches "7:00 PM" format
# Add this fallback for "7pm" format:
if not match:
    match = re.search(r'(\d{1,2})\s*([ap]m)', time_text, re.IGNORECASE)
    if match:
        hour = int(match.group(1))
        period = match.group(2).lower()
        minute = "00"
        # ... convert to 24-hour format
```

**Test:** `python main.py --source eddies-attic --verbose`

---

### 2. Basement East (88 events affected)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/basement_east.py`

**Issue:** `.tw-calendar-event-time` selector returns None for all events.

**Fix:** Debug the actual DOM structure:
```python
# Add after line 101 (in event loop):
logger.debug(f"Container HTML: {container.prettify()[:500]}")

# Check if time is in a different element
time_elem = container.find(["div", "span"], string=re.compile(r'\d{1,2}:\d{2}'))
```

**Alternative:** Scrape event detail pages for times instead of calendar listing.

**Test:** `python main.py --source basement-east --verbose`

---

### 3. Brooklyn Bowl Nashville (67 events affected)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/brooklyn_bowl_nashville.py`

**Issue:** Same as Basement East — 100% all-day rate.

**Fix:** Review selectors, likely similar to Basement East fix.

**Test:** `python main.py --source brooklyn-bowl-nashville --verbose`

---

### 4. Exit/In (49 events affected)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/exit_in.py`

**Issue:** Nashville venue with 100% all-day events.

**Fix:** Similar Playwright selector debugging needed.

**Test:** `python main.py --source exit-in --verbose`

---

### 5. Plaza Theatre Film Filter (19 events affected)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/plaza_theatre.py`

**Issue:** Non-screening events (courses, donations) imported as films.

**Fix:** Add blacklist in `extract_special_events()` around line 460:
```python
SKIP_KEYWORDS = ["donate", "field trip", "membership", "course", "workshop"]
if any(kw in title.lower() for kw in SKIP_KEYWORDS):
    logger.debug(f"Skipping non-screening event: {title}")
    continue
```

**Test:** `python main.py --source plaza-theatre --verbose`

---

## General Fixes (Applies to Multiple Sources)

### A. LLM Extraction Prompt Enhancement
**File:** `/Users/coach/Projects/LostCity/crawlers/extract.py`

**Fix:** Explicitly request times in the extraction prompt:
```python
# In the prompt template:
"Extract the following fields:
- start_time: Event start time in HH:MM format (24-hour). 
  Look for: 'doors at', 'show time', 'starts at', '7pm', '7:00 PM', etc.
  ⚠️ CRITICAL: Always extract time if visible on the page."
```

---

### B. Film Event Validation
**File:** `/Users/coach/Projects/LostCity/crawlers/db.py`

**Fix:** Add validation in `insert_event()` around line 259:
```python
# After line 284 (before auto-fetching metadata):
if event_data.get("category") == "film" and not event_data.get("start_time"):
    # Allow all-day for festivals/special events
    tags = event_data.get("tags", [])
    if not any(tag in ["festival", "special-event", "workshop"] for tag in tags):
        logger.warning(f"Rejecting film event without time: {event_data.get('title')}")
        raise ValueError("Film events must have specific showtime")
```

---

## Quick Test Commands

```bash
# Test all affected music venues
python main.py --source eddies-attic --verbose
python main.py --source basement-east --verbose
python main.py --source brooklyn-bowl-nashville --verbose
python main.py --source exit-in --verbose

# Test cinema
python main.py --source plaza-theatre --verbose

# Check results
python analyze_all_day_events.py
```

---

## Validation Query

After fixes, run this to check improvement:

```sql
SELECT 
    s.slug,
    COUNT(*) as total,
    SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) as all_day,
    ROUND(100.0 * SUM(CASE WHEN e.is_all_day THEN 1 ELSE 0 END) / COUNT(*), 1) as pct
FROM events e
JOIN sources s ON s.id = e.source_id
WHERE e.start_date >= CURRENT_DATE
  AND s.slug IN (
      'eddies-attic', 'basement-east', 'brooklyn-bowl-nashville',
      'exit-in', 'plaza-theatre'
  )
GROUP BY s.slug
ORDER BY pct DESC;
```

**Target:** All music venues should have <10% all-day rate, cinemas should have <3%.

---

## Priority Order

1. **Eddie's Attic** — easiest fix (just add regex fallback)
2. **Basement East, Brooklyn Bowl, Exit/In** — requires DOM debugging
3. **Plaza Theatre** — add keyword filter
4. **LLM prompt** — affects all LLM-extracted events
5. **Film validation** — prevents future bad data

**Estimated Total Time:** 4-6 hours for all fixes + testing
