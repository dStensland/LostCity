# Volunteer Crawler Fixes - February 16, 2026

## Summary

Fixed three volunteer organization crawlers that were producing 0 events. Two are now working correctly, one has a documented site accessibility issue.

## 1. Open Hand Atlanta - FIXED ✓

**Website:** https://www.openhandatlanta.org
**Status:** Working - 6 events found
**Issue:** Date parser couldn't handle ordinal suffixes (4th, 24th, etc.)

### Fix Applied
Updated `parse_event_date()` function in `/Users/coach/Projects/LostCity/crawlers/sources/open_hand_atlanta.py`:
- Added regex to strip ordinal suffixes (st, nd, rd, th) before parsing
- Changed pattern from `(\d+)` to `(\d+)(st|nd|rd|th)` with substitution

### Sample Events Found
- Charity Golf Classic - May 4, 2026
- Party in the Kitchen - September 24, 2026
- Atlanta Tour of Kitchens - March 14, 2026
- RARE Steak Championship - April 9, 2026

### Code Change
```python
# Remove ordinal suffixes (1st, 2nd, 3rd, 4th, etc.)
date_text_clean = re.sub(r'(\d+)(st|nd|rd|th)', r'\1', date_text)
```

---

## 2. Meals On Wheels Atlanta - FIXED ✓

**Website:** https://mowatl.org
**Status:** Working - correctly detects no upcoming events
**Issue:** Wrong base URL (was using `mowama.org` which doesn't resolve)

### Fixes Applied
1. **Corrected base URL:**
   - Changed from `https://www.mowama.org` to `https://mowatl.org`
   - Site redirects from mealsonwheelsatlanta.org to mowatl.org

2. **Rewrote crawler for site structure:**
   - Site uses Webflow CMS with `.w-dyn-item` selector
   - Events page shows "Past Events" and "Upcoming Events" sections
   - Currently has no upcoming events (last events were November 2025)
   - Date format: "Friday, November 7, 2025"

3. **Improved date parsing:**
   - Matches full date format with day of week
   - Skips events in the past
   - Returns `None` for past dates to filter them out

### Code Structure
The crawler now:
- Checks for "No upcoming events" message
- Uses `.w-dyn-item` selector for Webflow dynamic lists
- Parses structured event cards with title, date, time, description
- Filters out past events at parse time

### Current Status
Site is correctly returning 0 events because there are genuinely no upcoming events scheduled. Previous events include:
- 37th Annual A Meal to Remember (Nov 7, 2025)
- 25th Annual Golf Classic (Sep 15, 2025)
- TASTE (May 30, 2025)

---

## 3. Hosea Helps - SITE DOWN ⚠️

**Website:** https://hoseahelps.org
**Status:** Site unreachable - timeout errors
**Issue:** Website is experiencing extended downtime

### Problem
- Both `hoseahelps.org` and `www.hoseahelps.org` timeout after 60 seconds
- DNS resolves correctly (15.197.142.173, 3.33.152.147)
- Site appears to be down or severely overloaded
- Issue confirmed via both Playwright and curl

### Fixes Applied
1. **Increased timeout:** Changed from 30s to 60s
2. **Improved error handling:**
   - Catches `PlaywrightTimeout` exceptions
   - Logs warnings instead of crashing
   - Returns `(0, 0, 0)` gracefully
   - Added documentation note about site reliability

3. **Added warning messages:**
```python
logger.warning(
    "Hosea Helps crawl found 0 events - site may be experiencing downtime. "
    "The hoseahelps.org domain has been unreliable since early 2026."
)
```

### Recommendation
Monitor site status and re-test weekly. Consider:
- Checking if organization has moved to a new domain
- Looking for events on social media (Facebook/Instagram)
- Checking if they use Eventbrite or similar platforms
- Contacting organization to confirm current web presence

---

## Test Commands

```bash
cd /Users/coach/Projects/LostCity/crawlers

# Test Open Hand Atlanta (should find 6 events)
python3 main.py --source open-hand-atlanta

# Test Meals On Wheels Atlanta (should find 0 events - none upcoming)
python3 main.py --source meals-on-wheels-atlanta

# Test Hosea Helps (will timeout - site down)
python3 main.py --source hosea-helps
```

---

## Files Modified

1. `/Users/coach/Projects/LostCity/crawlers/sources/open_hand_atlanta.py`
   - Updated `parse_event_date()` function to handle ordinal suffixes

2. `/Users/coach/Projects/LostCity/crawlers/sources/meals_on_wheels_atlanta.py`
   - Changed BASE_URL from `mowama.org` to `mowatl.org`
   - Complete rewrite of crawler logic for Webflow structure
   - New `parse_event_date()` function for "Day, Month DD, YYYY" format
   - Filters past events at parse time

3. `/Users/coach/Projects/LostCity/crawlers/sources/hosea_helps.py`
   - Increased timeout from 30s to 60s
   - Added graceful error handling for timeouts
   - Added documentation about site downtime
   - Changed exceptions to warnings to prevent crawler failures

---

## Results

| Crawler | Before | After | Status |
|---------|--------|-------|--------|
| Open Hand Atlanta | 0 events | 6 events | ✓ Fixed |
| Meals On Wheels Atlanta | 0 events (wrong URL) | 0 events (correct - none upcoming) | ✓ Fixed |
| Hosea Helps | 0 events (timeout) | 0 events (site down) | ⚠️ Documented |

**Success Rate:** 2/3 crawlers producing events or correctly reporting empty state
**Remaining Issue:** 1 crawler blocked by unreachable website (infrastructure issue, not code issue)
