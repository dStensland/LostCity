# City of College Park Crawler

## Overview

Created a new crawler for City of College Park official events calendar.

**Source URL**: https://www.collegeparkga.gov/calendar.aspx

**Key Events**: 
- Juneteenth Parade
- Light Up The City
- Easter Egg Hunt
- Senior Thanksgiving

## Files Created

### 1. Main Crawler: `/Users/coach/Projects/LostCity/crawlers/sources/college_park_city.py`

**Features**:
- Uses Playwright for JavaScript-rendered CivicEngage calendar
- Parses dates in multiple formats (MM/DD/YYYY, "January 28, 2026", etc.)
- Parses times in 12-hour and 24-hour formats
- Smart categorization based on event title and description
- Fallback text parser if DOM selectors fail
- Deduplication using content hash
- Image extraction from page

**Venue Data**:
```python
{
    "name": "City of College Park",
    "slug": "city-of-college-park",
    "address": "3667 Main St",
    "neighborhood": "Historic College Park",
    "city": "College Park",
    "state": "GA",
    "zip": "30337",
    "lat": 33.6473,
    "lng": -84.4494,
    "venue_type": "government",
    "spot_type": "community_center",
    "website": "https://www.collegeparkga.gov",
}
```

**Event Categories**:
- Community events (festivals, parades, celebrations)
- Music (concerts, bands, orchestras)
- Arts (exhibitions, galleries)
- Family events (kids activities, Easter egg hunts)
- Seniors programs (Thanksgiving, elder events)
- Markets (farmers markets, vendors)
- Government (council meetings, commissions)
- Parks & Recreation (outdoor events, fitness)
- Education (workshops, library events)
- Theater & Film

**Tags**: 
- Base tags: `college-park`, `community`
- Event-specific tags added based on content

### 2. Database Registration Script: `/Users/coach/Projects/LostCity/crawlers/add_college_park_source.py`

Simple script to add the source to the database with:
- Name: "City of College Park"
- Slug: "college-park-city"
- Source Type: "scrape"
- Crawl Frequency: "daily"

**Status**: Successfully added to database (Source ID: 410)

### 3. Main.py Registration

Added to SOURCE_MODULES registry in `/Users/coach/Projects/LostCity/crawlers/main.py` at line 490:

```python
# ===== City & Park Events =====
"decatur-city": "sources.decatur_city",
"visit-decatur": "sources.visit_decatur",
"johns-creek": "sources.johns_creek",
"marietta-city": "sources.marietta_city",
"college-park-city": "sources.college_park_city",  # NEW
```

## Pattern Used

Based on existing city calendar crawlers:
- **marietta_city.py** - CivicEngage calendar with Playwright
- **decatur_city.py** - CivicEngage calendar with Playwright

Both use the same pattern:
1. Launch headless browser
2. Navigate to calendar page
3. Wait for JavaScript to render
4. Try multiple DOM selectors for events
5. Fallback to text parsing if needed
6. Extract title, date, time, description
7. Categorize and tag events
8. Insert into database with deduplication

## Testing

### Prerequisites

Ensure dependencies are installed:
```bash
cd /Users/coach/Projects/LostCity/crawlers
pip3 install -r requirements.txt
playwright install chromium
```

### Dry Run Test

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source college-park-city --dry-run
```

This will:
- Fetch the calendar page
- Parse events
- Print what would be inserted
- NOT actually insert into database

### Full Crawl

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source college-park-city
```

### Check Results

After running, check the crawl logs:
```sql
SELECT * FROM crawl_logs WHERE source_id = 410 ORDER BY started_at DESC LIMIT 5;
```

Check inserted events:
```sql
SELECT e.title, e.start_date, e.category, v.name as venue
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE e.source_id = 410
ORDER BY e.start_date
LIMIT 20;
```

## Expected Behavior

1. **First Run**: Should find all upcoming events on the calendar and insert them
2. **Subsequent Runs**: Should only insert new events (duplicates filtered by content hash)
3. **Event Count**: Varies based on what's published on the city calendar
4. **Execution Time**: ~15-30 seconds (includes browser launch, page load, JavaScript rendering)

## Error Handling

The crawler includes:
- Timeout handling (60 second page load, 10 second selector wait)
- Multiple selector strategies for different DOM structures
- Fallback text parsing if selectors fail
- Graceful degradation if description or time fields are missing
- Circuit breaker pattern (will auto-disable if fails 4+ times consecutively)

## Future Enhancements

Potential improvements:
1. Add RCA Events crawler for https://www.collegeparkrca.com/upcoming-events (Squarespace site)
2. Parse multi-day events (currently treats each day separately)
3. Extract event images more reliably
4. Add venue-specific overrides (e.g., if event mentions "Recreation Center")
5. Parse price information from descriptions
6. Handle recurring events better

## Maintenance

- **Calendar Changes**: If CivicEngage changes their DOM structure, update selectors in crawler
- **New Event Types**: Add keywords to `categorize_event()` function
- **Crawl Frequency**: Currently set to "daily" - adjust in database if needed
