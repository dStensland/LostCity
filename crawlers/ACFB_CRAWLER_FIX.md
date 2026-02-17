# Atlanta Community Food Bank Crawler Fix

## Problem
The Atlanta Community Food Bank crawler at `crawlers/sources/atlanta_community_food_bank.py` was active but returning 0 events.

## Root Cause
The crawler was trying to scrape volunteer opportunities from the main website (`https://www.acfb.org/volunteer/`) using EventON WordPress plugin selectors. However, the actual volunteer calendar is hosted on **VolunteerHub**, a third-party volunteer management platform, embedded in iframes on the ACFB website.

The volunteer calendar lives at: `https://acfb.volunteerhub.com/vv2/`

## Solution
Rewrote the crawler to:

1. **Load the VolunteerHub calendar page** using Playwright
2. **Intercept the API response** from `https://acfb.volunteerhub.com/internalapi/volunteerview/view/index`
3. **Parse the JSON API response** which contains structured event data including:
   - Event ID, GUID, name
   - Start and end times (ISO 8601 format)
   - Location (address)
   - Short and long descriptions (HTML)
   - Slots remaining
4. **Create venue records** for three ACFB locations:
   - Atlanta Community Food Bank (main warehouse) - 3400 N Desert Dr, East Point
   - ACFB Stone Mountain Community Food Center - 1979 Parker Ct Suite D, Stone Mountain
   - ACFB Marietta Community Food Center - 1760 Mulkey Rd, Marietta
5. **Filter events** to skip court-mandated orientations and internal meetings
6. **Insert events** with proper categorization (community/volunteer) and tags

## Results
- **56 volunteer opportunities** successfully crawled
- Events span 10 days into the future
- Includes warehouse shifts, community distributions, and special programs
- All events properly tagged as volunteer opportunities, free, family-friendly
- Multiple venues correctly attributed based on event location

## Event Types Captured
- Hunger Action Center (Morning/Afternoon) - Main Atlanta warehouse
- Stone Mtn Community Food Center shifts
- Marietta Community Food Center distributions
- Various community service opportunities across metro Atlanta

## Technical Details
- Uses Playwright to load the page and capture API responses via `page.on("response")` handler
- Parses ISO 8601 datetime strings from API
- Strips HTML from description fields using BeautifulSoup
- Maps events to appropriate venues based on location text
- Generates content hashes for deduplication
- Extraction confidence: 0.95 (high-quality structured API data)

## Files Modified
- `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_community_food_bank.py` (complete rewrite)

## Test Command
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source atlanta-community-food-bank
```

## Example Output
```
INFO:sources.atlanta_community_food_bank:Fetching Atlanta Community Food Bank: https://acfb.volunteerhub.com/vv2/
INFO:sources.atlanta_community_food_bank:Captured VolunteerHub API data
INFO:sources.atlanta_community_food_bank:Found 10 days with events
INFO:sources.atlanta_community_food_bank:Atlanta Community Food Bank crawl complete: 56 found, 0 new, 56 updated
```

## Notes
- The Atlanta Community Food Bank is the largest hunger relief organization in Georgia
- They rely on over 40,000 volunteer visits per year
- This is one of the most popular volunteer opportunities in Atlanta
- The crawler now provides comprehensive coverage of all their volunteer shifts across metro Atlanta
