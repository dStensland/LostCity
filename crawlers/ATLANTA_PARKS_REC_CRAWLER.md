# Atlanta Parks & Recreation Crawler

Created: 2026-01-25

## Summary

New crawler for Atlanta Department of Parks and Recreation events from the city calendar system.

## Files Created/Modified

1. **Crawler**: `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_parks_rec.py`
   - Fetches events from Atlanta city calendar
   - Filters for parks/recreation-related events
   - Parses dates, times, and locations
   - Creates venue entries for major parks

2. **Main Registry**: `/Users/coach/Projects/LostCity/crawlers/main.py`
   - Added `"atlanta-parks-rec": "sources.atlanta_parks_rec"` to SOURCE_MODULES

3. **Database Migration**: `/Users/coach/Projects/LostCity/database/migrations/053_parks_family_sources.sql`
   - Added Atlanta Parks & Recreation source entry
   - SQL insert statement for sources table

## How It Works

The crawler:

1. **Fetches** the Atlanta city calendar page at `https://www.atlantaga.gov/Home/Components/Calendar/Event/Index`
2. **Finds** all event links on the calendar
3. **Filters** for parks/recreation events using keyword detection:
   - Includes: park, recreation, fitness, yoga, sports, community center, youth program, etc.
   - Excludes: city council, zoning, permit hearings, budget meetings
4. **Parses** each event page for:
   - Title and description
   - Date and time (various formats)
   - Location/venue
5. **Categorizes** events:
   - Sports (fitness, team sports, swimming)
   - Community (family, seniors, outdoor)
6. **Maps** to venues:
   - Piedmont Park
   - Grant Park
   - Chastain Park
   - Generic "Atlanta Recreation Center" for unknown locations
7. **Tags** with: parks, recreation, community, family-friendly, fitness, sports, free (when applicable)

## Installation

### Step 1: Run Database Migration

Run the SQL in Supabase SQL Editor:

```sql
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Atlanta Parks & Recreation', 'atlanta-parks-rec', 'https://www.atlantaga.gov/Home/Components/Calendar/Event/Index', 'scrape', 'weekly', true)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    url = EXCLUDED.url,
    source_type = EXCLUDED.source_type,
    crawl_frequency = EXCLUDED.crawl_frequency,
    is_active = EXCLUDED.is_active;
```

Or run the full migration file:
```
database/migrations/053_parks_family_sources.sql
```

### Step 2: Test the Crawler

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python main.py -s atlanta-parks-rec
```

## Expected Output

The crawler will:
- Fetch the Atlanta city calendar
- Find all event links (typically 20-50 events)
- Filter for parks/recreation events (estimated 5-15 events)
- Parse and insert new events into the database
- Report: "X events found, Y new, Z updated"

## Event Types

Expected event categories:
- **Fitness Classes**: Yoga, aerobics, boot camps
- **Youth Programs**: Sports leagues, after-school programs
- **Senior Activities**: Fitness classes, social events
- **Sports**: Basketball, tennis, swimming, team sports
- **Community Events**: Park festivals, outdoor activities
- **Nature Programs**: Trail walks, gardening workshops

## Venues

Major parks that will be created as venues:
- Piedmont Park (Midtown)
- Grant Park (Grant Park neighborhood)
- Chastain Park (North Atlanta)
- Generic Atlanta Recreation Center (fallback)

## Notes

### Technical Details
- Uses `requests` library (not Playwright)
- The calendar page allows standard HTTP requests
- Individual event pages are scraped for details
- Date/time parsing handles multiple formats
- Deduplication via content hash (title + venue + date)

### Limitations
- City calendar blocks automated browsers (Playwright/Selenium)
- Must use standard HTTP requests with proper User-Agent
- Some events may not have complete location information
- Event descriptions may be minimal

### Maintenance
- Weekly crawl frequency recommended
- Calendar structure may change (monitor for 404s or parse errors)
- May need to adjust keyword filters as event types evolve
- Consider adding more specific recreation centers as venues

## Testing

To test without database:
1. Check that calendar page is accessible
2. Verify event link parsing
3. Test keyword filtering logic
4. Validate date/time parsing

```python
import requests
from bs4 import BeautifulSoup

url = "https://www.atlantaga.gov/Home/Components/Calendar/Event/Index"
response = requests.get(url, headers={"User-Agent": "Mozilla/5.0"})
soup = BeautifulSoup(response.text, "html.parser")
events = soup.find_all("a", href=lambda x: x and "/Home/Components/Calendar/Event/" in x)
print(f"Found {len(events)} events")
```

## Future Enhancements

1. **More Venues**: Add specific recreation centers as venues
2. **Recurring Events**: Detect and mark recurring programs
3. **Registration Links**: Extract registration/ticket URLs when available
4. **Age Groups**: Parse age restrictions from descriptions
5. **Capacity**: Extract participant limits if available
6. **Direct API**: Investigate if Atlanta has a public events API
