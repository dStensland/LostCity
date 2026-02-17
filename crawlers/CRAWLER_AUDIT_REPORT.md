# Comprehensive Crawler Audit Report
**Date:** 2026-02-16
**Total Crawlers Checked:** 771
**Pytest Status:** ✓ All 207 tests passed

---

## Executive Summary

Comprehensive audit of all 771 crawler source files identified **456 issues** across 6 categories. Most issues are minor (docstring examples showing date formats), but several require immediate attention before next crawl run.

### Critical Issues (19 files)
- 9 crawlers use invalid category values
- 5 crawlers infer `is_all_day` from missing time
- 3 crawlers create events for permanent attractions
- 19 crawlers have hardcoded dates that will break after 2026

### Warnings (25+ files)
- 25+ files reference "permanent attraction" patterns but most are handled correctly
- 3 helper modules missing `crawl()` function (expected, not errors)

---

## 1. Import Test Results

**Status:** ✓ PASS (with 3 expected warnings)

- **Total crawlers:** 771
- **Successfully imported:** 768 (99.6%)
- **Import failures:** 0
- **Missing crawl() function:** 3 (expected)

### Missing crawl() Function (Expected)
These are helper modules, not actual crawlers:
- `chain_cinema_base.py` - Base class for chain cinemas
- `nashville_example.py` - Template/example file
- `plaza_letterboxd.py` - Helper module

**Action Required:** None

---

## 2. Invalid Category Assignments

**Status:** ✗ FAIL - 9 issues found

### Issues Found

| File | Line | Invalid Category | Should Be |
|------|------|------------------|-----------|
| `aclu_georgia.py` | 241 | activism | community |
| `atlanta_liberation_center.py` | 258, 364 | activism | community |
| `georgia_equality.py` | 233 | activism | community |
| `glahr.py` | 243 | activism | community |
| `home_depot_backyard.py` | 117, 124 | food | food_drink |
| `home_depot_backyard.py` | 169 | arts | art |
| `indivisible_atl.py` | 256 | activism | community |

### Valid Categories
```python
VALID_CATEGORIES = {
    'music', 'film', 'comedy', 'theater', 'art', 'sports', 'food_drink',
    'nightlife', 'community', 'fitness', 'family', 'learning', 'dance',
    'tours', 'meetup', 'words', 'religious', 'markets', 'wellness',
    'support_group', 'gaming', 'outdoors', 'other'
}
```

**Action Required:**
1. Update all instances of `"category": "activism"` to `"category": "community"`
2. Update `"food"` to `"food_drink"`
3. Update `"arts"` to `"art"`

---

## 3. is_all_day Inference from Missing Time

**Status:** ✗ FAIL - 5 issues found

Per CLAUDE.md: *"`is_all_day` should only be `True` when the event is genuinely all-day (festivals, multi-day conventions, outdoor markets). Never infer it from a missing start_time."*

### Issues Found

| File | Line | Pattern |
|------|------|---------|
| `advancing_justice_atlanta.py` | 230 | `"is_all_day": start_time is None` |
| `hammonds_house.py` | 505 | `"is_all_day": start_time is None` |
| `keep_atlanta_beautiful.py` | 272 | `"is_all_day": start_time is None` |
| `second_helpings_atlanta.py` | 289 | `"is_all_day": start_time is None` |
| `spelman_college.py` | 524 | `is_all_day = ... or not start_time` |

**Action Required:**
1. Change all instances to `"is_all_day": False`
2. If the event is genuinely all-day (e.g., volunteer shifts with no specific time), set `True` explicitly based on event type, not missing data

---

## 4. Permanent Attraction Events

**Status:** ⚠️ WARNING - 3 crawlers create permanent attraction events

### Critical Issues

| File | Issue | Action Required |
|------|-------|-----------------|
| `apex_museum.py` | Lines 108-124: Creates "permanent exhibition" events with 365-day duration | Remove permanent exhibition creation. Only crawl temporary exhibitions with actual dates. |
| `fernbank_science_center.py` | Line 143-144: Comments reference filtering permanent exhibits and daily operations | Review to ensure these are actually filtered (not just commented) |
| `stone_mountain_park.py` | Lines 40-47: Has SKIP_TITLES list for permanent attractions | ✓ Correctly implemented - this is the right pattern |

### Other References (Likely Safe)
25+ other files reference "permanent attraction" patterns, but most are:
- Comments explaining what NOT to do (correct)
- Skip lists like Stone Mountain (correct)
- Documentation strings (safe)

**Action Required:**
1. **APEX Museum:** Remove lines 108-177 that create permanent exhibition events. Only crawl Eventbrite for time-specific events.
2. **Fernbank Science Center:** Verify that permanent exhibits are actually filtered, not just documented as needing filtering.

---

## 5. Missing Dedup Checks

**Status:** ✓ PASS - 0 issues found

All crawlers that call `insert_event()` also call `find_event_by_hash()` or `generate_content_hash()` for deduplication.

---

## 6. Hardcoded Date Values

**Status:** ⚠️ WARNING - 19 real issues, 414 total matches

Most matches (395) are in docstrings/comments showing date format examples. Only 19 are actual hardcoded logic.

### Real Issues Requiring Fixes

| File | Lines | Issue |
|------|-------|-------|
| `buried_alive.py` | 88 | Hardcoded "2026" in title string |
| `dice_and_diversions.py` | 26 | CSV filename hardcoded to "2026" |
| `inman_park_festival.py` | 46-48, 59-61 | Hardcoded `if year == 2026` logic with specific dates |
| `puppetry_arts.py` | 88 | URL pattern with "2026" |
| `render_atl.py` | 46-48, 61-63 | Hardcoded `if year == 2026` logic with specific dates |
| `spelman_college.py` | 106 | Function default `current_year: int = 2026` |
| `strand_theatre.py` | 39 | Constant `KNOWN_EVENTS_2026` |
| `theatre_in_the_square.py` | 45, 177 | Constant `KNOWN_SHOWS_2026` |

### Recommended Fixes

**Pattern 1: Festival Dates (inman_park_festival, render_atl)**
```python
# BAD
if year == 2026:
    start_date = datetime(2026, 4, 24)

# GOOD
FESTIVAL_DATES = {
    2026: ("2026-04-24", "2026-04-26"),
    2027: ("2027-04-23", "2027-04-25"),  # Last weekend in April
}
if year in FESTIVAL_DATES:
    start_date, end_date = FESTIVAL_DATES[year]
```

**Pattern 2: Function Defaults**
```python
# BAD
def parse_html_date(date_text: str, current_year: int = 2026) -> tuple[str, str]:

# GOOD
def parse_html_date(date_text: str, current_year: int = None) -> tuple[str, str]:
    if current_year is None:
        current_year = datetime.now().year
```

**Pattern 3: Known Shows Lists**
```python
# BAD
KNOWN_SHOWS_2026 = [...]

# GOOD
KNOWN_SHOWS = {
    2026: [...],
    2027: [...]  # Update annually or scrape from source
}
```

**Action Required:**
1. Fix all 19 files with hardcoded date logic
2. Add TODO comments for files that will need updates in 2027
3. Consider switching from hardcoded festival dates to web scraping where possible

---

## 7. Additional Observations

### Files to Monitor
- **chain_cinema_base.py, nashville_example.py, plaza_letterboxd.py** - Helper modules without crawl() function (expected)
- **access_atlanta.py** - Should be deactivated per CLAUDE.md (editorial aggregator, not original source)

### Test Suite Health
✓ All 207 tests passing
- 15 deprecation warnings (external dependencies, not critical)
- No test failures
- Good coverage of utils, date parsing, validation

---

## Action Items Summary

### HIGH PRIORITY (Before Next Crawl Run)

1. **Fix Invalid Categories (9 files)**
   - Replace `"activism"` → `"community"`
   - Replace `"food"` → `"food_drink"`
   - Replace `"arts"` → `"art"`

2. **Fix is_all_day Inference (5 files)**
   - Remove `start_time is None` logic
   - Set explicit `False` or `True` based on event type

3. **Remove Permanent Attraction Events (1 file)**
   - `apex_museum.py`: Delete permanent exhibition creation code

### MEDIUM PRIORITY (Before 2027)

4. **Fix Hardcoded Dates (19 files)**
   - Update festival date logic to use dictionaries or datetime.now()
   - Remove hardcoded year values from function defaults
   - Document which festivals need annual updates

5. **Review Fernbank Science Center**
   - Verify permanent exhibits are filtered, not just documented

### LOW PRIORITY

6. **Deactivate Editorial Aggregators**
   - Consider deactivating `access_atlanta.py` per CLAUDE.md policy

---

## Files Referenced

### Crawlers Requiring Immediate Fixes
```
sources/aclu_georgia.py
sources/atlanta_liberation_center.py
sources/georgia_equality.py
sources/glahr.py
sources/home_depot_backyard.py
sources/indivisible_atl.py
sources/advancing_justice_atlanta.py
sources/hammonds_house.py
sources/keep_atlanta_beautiful.py
sources/second_helpings_atlanta.py
sources/spelman_college.py
sources/apex_museum.py
```

### Crawlers Requiring Pre-2027 Updates
```
sources/buried_alive.py
sources/dice_and_diversions.py
sources/inman_park_festival.py
sources/puppetry_arts.py
sources/render_atl.py
sources/strand_theatre.py
sources/theatre_in_the_square.py
```

---

## Conclusion

The crawler codebase is in **good overall health** with 99.6% import success and all tests passing. However, **31 crawlers require updates** before the next full crawl run to prevent data quality issues. The most critical fixes are category corrections and removing permanent attraction events.

Estimated fix time: 2-3 hours for all priority items.
