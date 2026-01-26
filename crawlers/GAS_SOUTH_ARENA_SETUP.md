# Gas South Arena Crawler Setup

**Status**: Complete and Ready for Testing
**Date**: 2026-01-26
**Venue**: Gas South Arena (formerly Infinite Energy Arena)

## Overview

Gas South Arena is a major entertainment venue in Gwinnett County hosting concerts, hockey (Atlanta Gladiators), and other large events. This crawler extracts events from their public calendar.

## Files Created/Updated

### 1. Crawler Module
**File**: `/Users/coach/Projects/LostCity/crawlers/sources/gas_south.py`

- ✅ Uses Playwright for JavaScript-rendered content
- ✅ Venue data configured:
  - Name: Gas South Arena
  - Address: 6400 Sugarloaf Pkwy, Duluth, GA 30097
  - Coordinates: 33.9618, -84.0965
  - Type: arena
  - Spot Type: stadium
- ✅ Parses events from: https://www.gassouthdistrict.com/events
- ✅ Extracts: title, date, time from page text
- ✅ Handles image extraction via utils
- ✅ Implements deduplication via content hash

### 2. Database Migration
**File**: `/Users/coach/Projects/LostCity/database/migrations/058_gas_south_arena.sql`

SQL to add source to database:
```sql
INSERT INTO sources (name, slug, url, source_type, crawl_frequency, is_active)
VALUES
    ('Gas South Arena', 'gas-south', 'https://www.gassouthdistrict.com/events', 'scrape', 'daily', true)
ON CONFLICT (slug) DO UPDATE SET ...
```

### 3. Source Registry
**File**: `/Users/coach/Projects/LostCity/crawlers/main.py` (line 102)

Already registered:
```python
"gas-south": "sources.gas_south",
```

## Setup Instructions

### 1. Apply Database Migration

Run the migration in Supabase SQL Editor:
```bash
# Copy contents of database/migrations/058_gas_south_arena.sql
# Paste into Supabase SQL Editor and execute
```

Or use psql:
```bash
psql $DATABASE_URL -f database/migrations/058_gas_south_arena.sql
```

### 2. Install Dependencies (if needed)

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate  # Activate virtual environment
pip install -r requirements.txt
playwright install chromium  # Install browser for Playwright
```

### 3. Test the Crawler

Run with dry-run mode first:
```bash
cd /Users/coach/Projects/LostCity/crawlers
python main.py --source gas-south --dry-run
```

Run for real:
```bash
python main.py --source gas-south
```

Or test all sources:
```bash
python main.py
```

## Crawler Behavior

### Scraping Method
- Uses Playwright (headless Chrome) to render JavaScript
- Scrolls page 5 times to load lazy-loaded content
- Extracts text content line-by-line
- Pattern matches dates and event titles

### Event Extraction
- Date format: Matches "Month Day, Year" patterns
- Time format: Parses "HH:MM AM/PM" format
- Title: Extracted from lines near date
- Images: Mapped via `extract_images_from_page()`

### Data Fields
- `title`: Event name
- `start_date`: ISO format (YYYY-MM-DD)
- `start_time`: 24-hour format (HH:MM)
- `venue_id`: Links to Gas South Arena venue record
- `source_url`: Event calendar page
- `category`: "community" (default)
- `tags`: ["event"]

## Expected Results

The Gas South District website hosts events for:
- **Gas South Arena** (main arena) - Concerts, hockey, family shows
- **Gas South Convention Center** - Conferences, conventions
- **Gas South Theater** - Theater performances

The crawler will capture all events from their unified calendar. You may want to filter or categorize based on event location/venue within the district.

## Verification Checklist

- [x] Python syntax validated
- [x] Venue data complete and accurate
- [x] Source registered in main.py
- [x] Database migration created
- [ ] Migration applied to database
- [ ] Crawler tested with --dry-run
- [ ] Events successfully inserted
- [ ] Images extracted correctly
- [ ] Dates parsed accurately

## Notes

1. **Venue Clarification**: The crawler is named "gas_south" but specifically creates venue "Gas South Arena". The website covers the entire Gas South District (arena, convention center, theater). Consider if you want separate venue records for each facility.

2. **Event Categorization**: Currently defaults to "community" category. Consider using Claude extraction to better categorize events (concerts → music, hockey → sports, etc.).

3. **Time Parsing**: If no time is found, events are marked as `is_all_day = True`.

4. **Rate Limiting**: Uses 3-second initial wait + 1-second waits during scrolling. Adjust if needed.

## Troubleshooting

### "No module named 'playwright'"
```bash
pip install playwright
playwright install chromium
```

### "Module not found: supabase"
```bash
pip install -r requirements.txt
```

### No events found
- Check if site structure changed
- Add debug logging to see parsed lines
- Test URL manually: https://www.gassouthdistrict.com/events

### Events missing times
- Normal for some listings
- They'll be marked as all-day events
- Can enhance parser if pattern is consistent

## Future Enhancements

1. **Venue Splitting**: Create separate venue records for:
   - Gas South Arena (main venue)
   - Gas South Convention Center
   - Gas South Theater

2. **Better Categorization**: Use Claude LLM extraction instead of text parsing for:
   - More accurate event titles
   - Better descriptions
   - Proper category/subcategory assignment
   - Price extraction

3. **Event Detail Pages**: Currently scrapes calendar only. Could fetch individual event pages for:
   - Full descriptions
   - Ticket links
   - Better images
   - Venue-specific details

4. **Pagination**: Check if calendar uses pagination for distant future dates.

## Contact

For questions or issues with this crawler, check:
- Crawl logs: `crawl_logs` table in database
- Main documentation: `/Users/coach/Projects/LostCity/crawlers/README.md`
- Claude context: `/Users/coach/Projects/LostCity/database/CLAUDE.md`
