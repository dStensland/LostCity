# Tara Theatre Crawler - TBA Events Fix

## Issue
The Tara Theatre crawler was creating events with placeholder titles like "TBA", "TBD", "To Be Announced" instead of filtering them out. These placeholder events were cluttering the database with non-actionable content.

## Root Cause
The `extract_movies_for_date()` function in `/Users/coach/Projects/LostCity/crawlers/sources/tara_theatre.py` was using a regex pattern that would match any text starting with a capital letter followed by a duration pattern. This meant "TBA 2 hr 0 min" would be extracted as a valid movie title.

While the `extract_upcoming_movies()` function (for the Coming Soon page) already had "TBA" in its skip patterns, the main extraction function did not.

## Solution
Added comprehensive TBA/placeholder filtering to the `extract_movies_for_date()` function with three layers of defense:

### 1. Skip Words List (Line 146)
Added placeholder keywords to the existing skip_words list:
- "TBA"
- "To Be Announced"
- "Coming Soon"
- "Upcoming"

### 2. Regex Pattern Match (Lines 155-157)
Added a specific regex check to catch standalone placeholder titles:
```python
if re.match(r'^(TBA|TBD|TBC|To Be Announced|To Be Determined)(\s*\([^)]+\))?$', title, re.IGNORECASE):
    continue
```
This catches patterns like:
- "TBA"
- "TBD (2024)"
- "To Be Announced"

### 3. Short Placeholder Check (Lines 158-160)
Added a check for very short titles that are common placeholders:
```python
if len(title) <= 5 and title.upper() in ['TBA', 'TBD', 'TBC', 'N/A']:
    continue
```

## Changes Made

**File:** `/Users/coach/Projects/LostCity/crawlers/sources/tara_theatre.py`

**Lines Modified:** 146-160

```diff
         skip_words = [
             "NOW PLAYING", "COMING SOON", "STORE", "ABOUT", "DONATE",
             "RENTALS", "THE TARA", "Plaza Theatre", "Today", "Select",
             "Showtimes", "Subscribe", "Mailing List", "Email", "Facebook",
             "Instagram", "Copyright", "All rights", "Father Mother",
             "Get Tickets", "Join", "searchTitle", "My Movies",
+            "TBA", "To Be Announced", "Coming Soon", "Upcoming",
         ]
         if any(skip.lower() in title.lower() for skip in skip_words):
             continue
         if len(title) < 3 or len(title) > 100:
             continue
         # Skip if title starts with lowercase (likely description)
         if title[0].islower():
             continue
+        # Skip placeholder titles (TBA, TBD, etc.)
+        if re.match(r'^(TBA|TBD|TBC|To Be Announced|To Be Determined)(\s*\([^)]+\))?$', title, re.IGNORECASE):
+            continue
+        # Skip if title is too short and looks like a placeholder
+        if len(title) <= 5 and title.upper() in ['TBA', 'TBD', 'TBC', 'N/A']:
+            continue
```

## Testing
Verified the fix with test cases covering:
- ✅ "TBA 2 hr 0 min" → FILTERED
- ✅ "TBD (2024) 1 hr 30 min" → FILTERED
- ✅ "To Be Announced 1 hr 0 min" → FILTERED
- ✅ "The Matrix (1999) 2 hr 16 min" → ACCEPTED
- ✅ "Nosferatu (2024) 2 hr 12 min" → ACCEPTED
- ✅ "Misery (1990) 1 hr 47 min" → ACCEPTED

## Impact
- Prevents TBA/placeholder events from being created in the database
- Maintains extraction of all legitimate movie titles
- Follows the same pattern already implemented in the Coming Soon section
- Consistent with filtering approaches in similar crawlers (e.g., plaza_theatre.py)

## Next Steps
1. Run the crawler to verify it works correctly with the live website
2. Monitor crawl logs to ensure no legitimate movies are being filtered
3. Consider adding similar checks to other cinema crawlers if they have the same issue

## Related Files
- `/Users/coach/Projects/LostCity/crawlers/sources/tara_theatre.py` - Main crawler file (modified)
- `/Users/coach/Projects/LostCity/crawlers/sources/plaza_theatre.py` - Reference implementation for cinema crawlers
