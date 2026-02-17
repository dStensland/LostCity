# Hardcoded Dates - Pre-2027 TODO List

19 crawler files have hardcoded year values that will need updates before/in 2027.

---

## High Priority (Will Break in 2027)

### 1. inman_park_festival.py
**Lines:** 46-48, 59-61
**Issue:** Hardcoded festival dates
```python
if year == 2026:
    start_date = datetime(2026, 4, 24)
    end_date = datetime(2026, 4, 26)
```

**Fix:**
```python
FESTIVAL_DATES = {
    2026: ("2026-04-24", "2026-04-26"),
    2027: ("2027-04-23", "2027-04-25"),  # Last full weekend in April
}
if year in FESTIVAL_DATES:
    start_date, end_date = FESTIVAL_DATES[year]
else:
    # Calculate: Last full weekend in April
    pass
```

---

### 2. render_atl.py
**Lines:** 46-48, 61-63
**Issue:** Same pattern as Inman Park - hardcoded festival dates
```python
if year == 2026:
    start_date = datetime(2026, 6, 10)
    end_date = datetime(2026, 6, 12)
```

**Fix:** Use dictionary pattern like above, or scrape from website

---

### 3. spelman_college.py
**Line:** 106
**Issue:** Function default parameter
```python
def parse_html_date(date_text: str, current_year: int = 2026) -> tuple[str, str]:
```

**Fix:**
```python
def parse_html_date(date_text: str, current_year: int = None) -> tuple[str, str]:
    if current_year is None:
        current_year = datetime.now().year
```

---

## Medium Priority (Static Data)

### 4. strand_theatre.py
**Line:** 39
**Issue:** Static list of known events
```python
KNOWN_EVENTS_2026 = [...]
```

**Fix:** Either scrape dynamically or convert to year-keyed dict:
```python
KNOWN_EVENTS = {
    2026: [...],
    2027: [...]  # Update annually
}
```

---

### 5. theatre_in_the_square.py
**Lines:** 45, 177
**Issue:** Static list of known shows
```python
KNOWN_SHOWS_2026 = [...]
shows = KNOWN_SHOWS_2026
```

**Fix:** Same as Strand Theatre - use dict or scrape

---

### 6. dice_and_diversions.py
**Line:** 26
**Issue:** CSV filename includes year
```python
CSV_PATH = "dice-diversions-2026-schedule.csv"
```

**Fix:**
```python
year = datetime.now().year
CSV_PATH = f"dice-diversions-{year}-schedule.csv"
# or: CSV_PATH = "dice-diversions-schedule.csv" (no year)
```

---

## Low Priority (Cosmetic)

### 7. buried_alive.py
**Line:** 88
**Issue:** Year in title
```python
title = "Buried Alive Film Festival 2026"
```

**Fix:**
```python
year = datetime.now().year
title = f"Buried Alive Film Festival {year}"
```

---

### 8. puppetry_arts.py
**Line:** 88
**Issue:** URL pattern with year
```python
"text=/March 2026 >|February 2026 >/"
```

**Fix:** Check if URL pattern changes by year, update as needed

---

## Other Files (395 matches)

The remaining 395+ matches are **docstring examples** showing date format patterns. These are documentation, not code, and don't need fixes. Examples:

```python
"""Parse date from format like 'Wednesday, January 14, 2026' or 'January 14, 2026'."""
```

These are fine to leave as-is.

---

## Testing After Updates

After updating any crawler:

```bash
# 1. Test the specific crawler
python main.py --source <crawler-name> --dry-run

# 2. Run audit
python3 audit_crawlers.py

# 3. Run tests
python3 -m pytest tests/

# 4. Import test
python3 -c "from sources import <module_name>"
```

---

## Recommended Timeline

| Quarter | Action |
|---------|--------|
| Q4 2026 | Review festival websites for 2027 dates |
| Q4 2026 | Update all hardcoded dates for 2027 |
| Q4 2026 | Test updated crawlers with new dates |
| Q1 2027 | Verify all crawlers working with 2027 data |

---

## Quick Fix Script (Future)

Could create `fix_hardcoded_dates_2027.py` to automate some of these updates:

```python
#!/usr/bin/env python3
"""Update hardcoded 2026 dates to 2027."""

# Replace specific patterns:
# - "2026" → "2027" in specific contexts
# - datetime(2026, ...) → datetime(2027, ...)
# - KNOWN_*_2026 → KNOWN_*_2027
```

---

**Last Updated:** 2026-02-16
**Files to Update:** 19
**Priority:** Medium (can wait until Q4 2026)
