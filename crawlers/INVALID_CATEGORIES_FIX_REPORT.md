# Invalid Categories Fix Report

**Date:** 2026-02-16
**Issue:** 333 events in the database had invalid categories that don't match the VALID_CATEGORIES list.

## Summary

Fixed all 333 events with invalid categories by:
1. Updating the database to correct invalid values
2. Fixing crawler source files that were producing invalid categories
3. Fixing tag_inference.py category checks
4. Verifying validate_event_title() blocks "Calendar" junk titles

## Database Fixes (Completed)

```sql
-- outdoor (314 events) → outdoors
UPDATE events SET category = 'outdoors' WHERE category = 'outdoor';

-- museums (17 events) → art
UPDATE events SET category = 'art' WHERE category = 'museums';

-- shopping (2 events) → community
UPDATE events SET category = 'community' WHERE category = 'shopping';

-- Delete 2 garbage "Calendar" events
DELETE FROM events WHERE title = 'Calendar';
```

**Result:** 333 events fixed (314 + 17 + 2) and 2 garbage events deleted.

## Crawler Source Files Fixed

### 1. sources/spelman_college.py
- **Line 176:** Changed `return "museums", "exhibition", VENUES["museum"]` to `return "art", "exhibition", VENUES["museum"]`
- **Line 349:** Changed `"category": "museums"` to `"category": "art"` (exhibitions)

### 2. sources/high_museum.py
- **Line 140:** Changed `return "museums", "tour"` to `return "art", "tour"`
- **Line 142:** Changed `return "museums", "workshop"` to `return "art", "workshop"`
- **Line 150:** Changed `return "museums", "museum", tags` to `return "art", "museum", tags`
- **Line 356:** Changed `"category": "museums"` to `"category": "art"` (exhibitions)

### 3. sources/college_football_hof.py
- **Line 223:** Changed `"category": "museums"` to `"category": "art"`

### 4. sources/civil_rights_center.py
- **Line 176:** Changed `"category": "museums"` to `"category": "art"`

## Tag Inference Fixed

### tag_inference.py
- **Line 1132:** Changed `elif category == "museums":` to `elif category == "art":`
- **Line 1332:** Changed `elif category == "outdoor":` to `elif category == "outdoors":`

**Note:** No references to "shopping" category found in tag_inference.py (correct).

## Title Validation

### db.py validate_event_title()
- **Line 1025:** "calendar" already present in junk_exact set (catches "Calendar" titles)
- This prevents future garbage "Calendar" events from being inserted

## Valid Categories Reference

The complete list of valid categories (from `tags.py`):
```python
VALID_CATEGORIES = {
    "music",
    "nightlife",
    "art",
    "performance",
    "food_drink",
    "sports",
    "community",
    "family",
    "film",
    "outdoors",
}
```

## Verification

Ran the following checks:
- ✅ No crawler files contain `"category": "outdoor"`
- ✅ No crawler files contain `"category": "museums"`
- ✅ No crawler files contain `"category": "shopping"`
- ✅ tag_inference.py has no invalid category checks
- ✅ Database has 0 events with invalid categories

## Future Prevention

1. **Crawler authors:** Always reference VALID_CATEGORIES from `tags.py` when setting categories
2. **Code review:** Check that category values match the valid list before merging
3. **Testing:** Run `python3 data_health.py` to catch category issues before they accumulate
4. **Title validation:** The junk_exact set in validate_event_title() will reject common garbage like "Calendar", "Schedule", etc.

## Files Changed

- `/Users/coach/Projects/LostCity/crawlers/fix_invalid_categories.py` (created)
- `/Users/coach/Projects/LostCity/crawlers/sources/spelman_college.py` (modified)
- `/Users/coach/Projects/LostCity/crawlers/sources/high_museum.py` (modified)
- `/Users/coach/Projects/LostCity/crawlers/sources/college_football_hof.py` (modified)
- `/Users/coach/Projects/LostCity/crawlers/sources/civil_rights_center.py` (modified)
- `/Users/coach/Projects/LostCity/crawlers/tag_inference.py` (modified)
- `/Users/coach/Projects/LostCity/crawlers/db.py` (verified "calendar" in blocklist)
