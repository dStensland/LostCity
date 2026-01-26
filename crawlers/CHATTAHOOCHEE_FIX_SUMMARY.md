# Chattahoochee Nature Center Crawler Fix

## Problem
The crawler was only finding 2 events instead of all available events on the page.

## Root Cause Analysis

### Original Crawler Issues
1. **Fragile text parsing**: The old crawler used line-by-line text parsing to find events, looking for date patterns in raw text
2. **Incorrect selectors**: Looking for `.mec-event-time` instead of `.mec-start-time`
3. **No deduplication**: Events appear multiple times (once per occurrence date) and weren't being deduplicated properly

### Site Structure
- Uses **Modern Events Calendar (MEC)** WordPress plugin
- Events are in `<article class="mec-event-article">` elements
- Each event has:
  - Title in `<h3 class="mec-event-title"><a data-event-id="...">`
  - Description in `.mec-event-description`
  - Date from URL parameter `?occurrence=YYYY-MM-DD`
  - Time in `.mec-start-time` (may say "All Day")
  - Image in `img.mec-event-image`

### Current Event Count
As of January 2026, the site has **5 unique events**:
1. Winter Gallery (ID: 18825)
2. Enchanted Woodland Trail (ID: 18827)
3. Weekend Activities (ID: 19430)
4. Sixth Annual "Double Vision for Kids" Winners (ID: 20377)
5. The Chattahoochee: Re-Imagine our River – Film Showings (ID: 20683)

Each event appears multiple times on the page (once for each date it occurs).

## Solution Implemented

### Complete Rewrite
Replaced text parsing with proper HTML element selection using Playwright's query selectors:

```python
# Find all event articles
event_articles = page.query_selector_all("article.mec-event-article")

# Track seen event IDs to avoid duplicates
seen_event_ids = set()

for article in event_articles:
    # Get title and event ID
    title_link = article.query_selector("h3.mec-event-title a")
    event_id_attr = title_link.get_attribute("data-event-id")

    # Skip duplicates
    if event_id_attr in seen_event_ids:
        continue
    seen_event_ids.add(event_id_attr)

    # Extract date from URL occurrence parameter
    start_date = parse_date_from_occurrence(event_url)

    # Get time from correct selector
    time_elem = article.query_selector(".mec-start-time")
```

### Key Improvements
1. **Proper HTML parsing**: Uses CSS selectors to target specific elements
2. **Deduplication**: Tracks `data-event-id` to avoid processing same event multiple times
3. **Date extraction**: Parses `occurrence` URL parameter instead of brittle text parsing
4. **Correct selectors**: Uses `.mec-start-time` instead of `.mec-event-time`
5. **Better categorization**: Analyzes title/description to add relevant tags (hiking, wildlife, family-friendly, etc.)

## Files Modified

1. `/Users/coach/Projects/LostCity/crawlers/sources/chattahoochee_nature.py`
   - Complete rewrite with proper HTML parsing
   - Added `parse_date_from_occurrence()` helper
   - Improved event deduplication
   - Better category/tag detection

2. `/Users/coach/Projects/LostCity/crawlers/test_chattahoochee.py` (NEW)
   - Standalone test script for debugging
   - Runs without database dependencies
   - Shows all events found with details

## Testing

Run the crawler:
```bash
cd /Users/coach/Projects/LostCity/crawlers
python main.py -s chattahoochee-nature
```

Run the test script:
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 test_chattahoochee.py
```

## Expected Results

The crawler should now find **5 unique events** (as of Jan 2026):
- Winter Gallery
- Enchanted Woodland Trail
- Weekend Activities
- Sixth Annual "Double Vision for Kids" Winners
- The Chattahoochee: Re-Imagine our River – Film Showings

## Notes

- The site legitimately has fewer events than expected - they don't list individual nature walks/programs on the `/events/` page
- Those activities are listed on their calendar or registration pages which use different systems
- The `/events/` page mainly shows ongoing exhibitions and recurring weekend activities
- For more specific programs (nature walks, kayaking, etc.), would need to scrape additional pages like `/programs-activities/` or `/calendar/`

## Future Enhancements

To get more events, could expand crawler to:
1. Parse `/programs-activities/` page for scheduled programs
2. Check `/special-events/` for seasonal events
3. Look for registration links that lead to specific class/program pages
4. Monitor their calendar view for day-specific activities
