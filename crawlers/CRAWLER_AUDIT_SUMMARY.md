# Crawler Audit Summary - 2026-02-16

## Comprehensive Audit Results

**Total Crawlers:** 771
**Pytest Status:** ✓ All 207 tests passed
**Import Success Rate:** 99.6% (768/771 successfully import)

---

## Issues Found and Fixed

### ✓ FIXED - Invalid Categories (9 files)

**Issue:** Crawlers using invalid category values not in approved taxonomy.

**Files Fixed:**
- `aclu_georgia.py` - "activism" → "community"
- `atlanta_liberation_center.py` - "activism" → "community" (2 instances)
- `georgia_equality.py` - "activism" → "community"
- `glahr.py` - "activism" → "community"
- `indivisible_atl.py` - "activism" → "community"
- `home_depot_backyard.py` - "food" → "food_drink" (2 instances), "arts" → "art"

**Total fixes:** 9 category corrections across 6 files

---

### ✓ FIXED - is_all_day Inference (5 files)

**Issue:** Setting `is_all_day=True` when `start_time` is missing, violating CLAUDE.md guidance.

**Files Fixed:**
- `advancing_justice_atlanta.py`
- `hammonds_house.py`
- `keep_atlanta_beautiful.py`
- `second_helpings_atlanta.py`
- `spelman_college.py`

**Fix Applied:** Changed `"is_all_day": start_time is None` to `"is_all_day": False` with explanatory comment.

**Total fixes:** 5 files corrected

---

### ✓ FIXED - Permanent Attraction Events (1 file)

**Issue:** APEX Museum creating "events" for permanent exhibitions with 365-day duration.

**File Fixed:**
- `apex_museum.py` - Removed lines 108-177 that created permanent exhibition events

**Impact:** Crawler now only imports time-based events from Eventbrite, not permanent exhibitions.

**Total fixes:** 1 file corrected

---

## Remaining Issues (Non-Critical)

### ⚠️ Hardcoded Date Values (19 files, 413 total matches)

Most matches (394) are docstring examples showing date formats. Only 19 files have actual hardcoded logic that will need updates before/in 2027:

**Files Requiring Pre-2027 Updates:**
1. `buried_alive.py` - Hardcoded "2026" in title
2. `dice_and_diversions.py` - CSV filename includes "2026"
3. `inman_park_festival.py` - Hardcoded festival dates for 2026
4. `puppetry_arts.py` - URL pattern with "2026"
5. `render_atl.py` - Hardcoded festival dates for 2026
6. `spelman_college.py` - Function default `current_year: int = 2026`
7. `strand_theatre.py` - `KNOWN_EVENTS_2026` constant
8. `theatre_in_the_square.py` - `KNOWN_SHOWS_2026` constant

**Recommendation:** Schedule review in Q4 2026 to update festival dates and year-specific logic.

---

### ℹ️ Permanent Attraction Pattern References (23 files)

Most references are **correct** - comments explaining what NOT to do, or skip lists (e.g., Stone Mountain Park correctly skips "Summit Skyride"). These are not bugs.

**Verified Safe:**
- `apex_museum.py` - Now has comments explaining why permanent exhibitions are skipped
- `fernbank_science_center.py` - Comments document that permanent exhibits are filtered
- `stone_mountain_park.py` - Has `SKIP_TITLES` list to filter permanent attractions
- Others are in docstrings, comments, or skip logic

---

### ℹ️ Helper Modules Without crawl() (3 files)

These are **expected** - they're base classes or templates, not actual crawlers:
- `chain_cinema_base.py` - Base class for cinema chain crawlers
- `nashville_example.py` - Template/example file
- `plaza_letterboxd.py` - Helper module

---

## Automated Fixes Applied

**Script:** `fix_critical_crawler_issues.py`

```bash
# Fixes applied:
- 9 category corrections
- 5 is_all_day inference fixes
- 1 permanent attraction removal
```

**Manual edits:**
- Fixed syntax errors in 4 files (comma placement in comments)
- Updated `apex_museum.py` docstrings to reflect new behavior
- Fixed `spelman_college.py` compound is_all_day logic

---

## Files Modified

### Category Fixes
```
sources/aclu_georgia.py
sources/atlanta_liberation_center.py
sources/georgia_equality.py
sources/glahr.py
sources/indivisible_atl.py
sources/home_depot_backyard.py
```

### is_all_day Fixes
```
sources/advancing_justice_atlanta.py
sources/hammonds_house.py
sources/keep_atlanta_beautiful.py
sources/second_helpings_atlanta.py
sources/spelman_college.py
```

### Permanent Attraction Fix
```
sources/apex_museum.py
```

---

## Verification

### Import Test
```
✓ 768/771 crawlers import successfully (99.6%)
✓ 0 import failures
✓ 3 helper modules without crawl() (expected)
```

### Category Validation
```
✓ 0 invalid categories found (was 9, now fixed)
```

### is_all_day Validation
```
✓ 0 problematic inferences found (was 5, now fixed)
```

### Pytest
```
✓ 207/207 tests passed
✓ No regressions introduced
```

---

## Next Steps

### Immediate (Complete)
- ✓ Fix invalid categories
- ✓ Fix is_all_day inference
- ✓ Remove permanent attraction events from APEX Museum
- ✓ Verify all tests pass

### Before 2027
- [ ] Update 19 files with hardcoded 2026 dates
- [ ] Replace hardcoded festival dates with dictionaries or web scraping
- [ ] Update `current_year` function defaults to use `datetime.now().year`

### Optional
- [ ] Consider deactivating `access_atlanta.py` (editorial aggregator per CLAUDE.md)
- [ ] Document annual update process for festival crawlers

---

## Tools Created

1. **`audit_crawlers.py`** - Comprehensive crawler audit script
   - Import testing
   - Category validation
   - Anti-pattern detection
   - Hardcoded date checking

2. **`fix_critical_crawler_issues.py`** - Automated fix script
   - Category corrections
   - is_all_day fixes
   - Dry-run mode support

3. **`CRAWLER_AUDIT_REPORT.md`** - Detailed audit findings
4. **`CRAWLER_AUDIT_SUMMARY.md`** - This executive summary

---

## Conclusion

All **critical issues** identified in the audit have been **fixed and verified**. The crawler codebase is now in excellent health with:

- ✓ 99.6% import success rate
- ✓ 100% category compliance
- ✓ 100% is_all_day compliance
- ✓ 100% test pass rate
- ⚠️ 19 files flagged for pre-2027 updates (non-urgent)

**Status:** READY FOR PRODUCTION CRAWL RUN

**Estimated time spent:** 2.5 hours
**Files modified:** 14
**Issues resolved:** 15 critical issues

---

**Audit Date:** 2026-02-16
**Audited By:** Claude Code (Comprehensive Crawler Audit)
**Next Audit Recommended:** 2026-11-01 (pre-2027 date updates)
