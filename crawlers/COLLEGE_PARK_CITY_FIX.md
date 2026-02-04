# College Park City Crawler Fix

## Problem
The College Park City crawler at `/Users/coach/Projects/LostCity/crawlers/sources/college_park_city.py` was finding 25 elements but extracting 0 events due to a date parsing issue.

## Root Cause Analysis

### Issue 1: Wrong Element Selector
The crawler was using a broad selector that captured 25 `.widgetItem` elements, which were actually social media link buttons, not calendar events:
```python
event_elements = page.query_selector_all(
    ".widgetItem, .calendar-list-item, .event-item, .calendar-event, "
    "[class*='calendar-list'] li, [class*='event-list'] li, "
    ".moduleContentNew .event, .calendarEvent"
)
```

The actual event structure on the CivicPlus calendar is:
- Events are contained in `<li>` elements
- Each event has an `<h3>` title element
- Each event has a `.date` element with the date/time text

### Issue 2: Non-Breaking Spaces in Date Text
The date text from the page contained Unicode non-breaking spaces and thin spaces instead of regular spaces:
- `\xa0` (non-breaking space, U+00A0) instead of regular space
- `\u2009` (thin space) around the time range dash
- Example: `'February\xa011,\xa02026,\xa06:30 PM\u2009-\u200910:00 PM'`

The existing `parse_date()` function used regex patterns with regular spaces, so it failed to match these date strings.

### Issue 3: Structured Data Available But Unused
The page includes structured data with `itemprop="startDate"` containing clean ISO format dates like `2026-02-11T18:30:00`, which would be more reliable than text parsing.

## Solution

### 1. Fixed Event Selector
Changed the selector to specifically find `<li>` elements that contain both `<h3>` and `.date`:
```python
all_li_elements = page.query_selector_all("li")
event_elements = []
for li in all_li_elements:
    h3 = li.query_selector("h3")
    date_elem = li.query_selector(".date")
    if h3 and date_elem:
        event_elements.append(li)
```

### 2. Prioritized Structured Data
The fix now prioritizes the structured data ISO format:
```python
structured_date = element.query_selector('[itemprop="startDate"]')
if structured_date:
    iso_date = structured_date.inner_text().strip()
    dt = datetime.fromisoformat(iso_date)
    start_date = dt.strftime("%Y-%m-%d")
    start_time = dt.strftime("%H:%M")
```

### 3. Normalized Text as Fallback
If structured data is unavailable, the text date is normalized by replacing Unicode spaces with regular spaces:
```python
date_text = date_elem.inner_text().strip()
date_text = date_text.replace('\xa0', ' ').replace('\u2009', ' ')
start_date = parse_date(date_text)
```

## Results

### Before Fix
- Elements found: 25 (wrong elements - social media links)
- Events extracted: 0

### After Fix
- Elements found: 8 (correct event `<li>` elements)
- Events extracted: 8
- All events have correct dates, times, categories, and tags

### Sample Events Extracted
1. **BIDA Meeting 2026** - 2026-02-11 at 18:30:00
2. **Council Meeting Workshop Session** - 2026-02-16 at 18:00:00
3. **Council Meeting Regular Session** - 2026-02-16 at 19:30:00
4. **Charter Review Commission Meeting** - 2026-02-24 at 18:00:00
5. **Community Giveback: Together We Thrive** - 2026-02-06 at 12:00:00
6. **Business Connect: Networking Event** - 2026-02-12 at 18:00:00
7. **College Park Annual Senior Valentine's Social** - 2026-02-14 at 18:00:00
8. **State of the Ward Address** - 2026-02-23 at 18:30:00

## Key Learnings

1. **Always inspect the actual DOM structure** - Don't rely on assumptions about selectors
2. **Unicode characters matter** - `\xa0` is not the same as a regular space for regex matching
3. **Prefer structured data** - When available, ISO dates from schema.org markup are more reliable than text parsing
4. **Validate selectors early** - Test that your selector is finding the right elements before worrying about parsing

## Files Modified
- `/Users/coach/Projects/LostCity/crawlers/sources/college_park_city.py`

## Testing
```bash
# Run the crawler
python3 main.py --source college-park-city

# Verify events in database
python3 -c "
from db import get_client
client = get_client()
result = client.table('events').select('title, start_date, start_time').eq('venue_id', 1349).order('start_date').limit(10).execute()
for event in result.data:
    print(f\"{event['title']}: {event['start_date']} at {event.get('start_time', 'N/A')}\")
"
```
