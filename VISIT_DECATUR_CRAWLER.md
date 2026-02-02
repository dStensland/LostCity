# Visit Decatur Georgia Crawler

## Overview
Crawler for Visit Decatur Georgia (visitdecaturga.com/events), the official tourism website for Decatur, Georgia.

**Created:** 2026-01-31
**Source URL:** https://visitdecaturga.com/events/
**Type:** Tourism/CVB (Convention & Visitors Bureau)

## Implementation Details

### Files Created
1. **Crawler Module**: `/Users/coach/Projects/LostCity/crawlers/sources/visit_decatur.py`
2. **Database Migration**: `/Users/coach/Projects/LostCity/database/migrations/096_visit_decatur_source.sql`
3. **Registry Entry**: Added to `SOURCE_MODULES` in `/Users/coach/Projects/LostCity/crawlers/main.py`

### Technical Approach

**Method:** Playwright (JavaScript-rendered content)

The Visit Decatur events page uses a WordPress-based events calendar plugin (likely The Events Calendar/Tribe Events) that renders via JavaScript. The crawler:

1. Uses Playwright to render the page with a 5-second wait for JS execution
2. Scrolls 3 times to trigger lazy-loading of additional events
3. Attempts multiple CSS selectors to find event cards:
   - `.tribe-events-calendar-list__event-row` (Tribe Events)
   - Generic event selectors (`article.event`, `.event-item`)
   - Fallback to `article` elements

### Data Extraction

**Fields Extracted:**
- **Title**: From h1-h4 or first line of card text
- **Date**: Supports multiple formats (M/D/YYYY, Month D, YYYY, date ranges)
- **Time**: Optional time parsing (7:00 PM, 7pm format)
- **Venue**: Extracted from text patterns or defaults to "Downtown Decatur"
- **Category**: Auto-determined from event content using keyword mapping
- **Description**: From excerpt/description elements
- **Image**: From img tags with fallback to data-src
- **URL**: Event detail pages

**Category Mapping:**
- Music: concerts, bands, live music
- Art: galleries, exhibits
- Theater: performances, plays
- Comedy: standup, comedy shows
- Food/Drink: dining, wine/beer events
- Family: kids, children's events
- Community: festivals, markets, outdoor events
- Film: movies

### Venue Handling

**Dynamic Venue Assignment:**
The crawler intelligently extracts venue names from event text using patterns like:
- "at [Venue Name]"
- "@ [Venue Name]"
- "location: [Venue Name]"

**Default Location:**
- Neighborhood: "Downtown Decatur"
- City: "Decatur"
- State: "GA"

All venues are created/matched dynamically during crawl.

### Configuration

**Source Settings:**
```sql
slug: visit-decatur
source_type: tourism
crawl_frequency: daily
priority: 60 (medium-high)
requires_playwright: true
extraction_method: playwright
```

**Tags Applied:**
- "visit-decatur"
- "decatur"

## Usage

### Run the Crawler

```bash
cd crawlers
source venv/bin/activate

# Run Visit Decatur crawler
python main.py --source visit-decatur

# Dry run (fetch but don't save)
python main.py --source visit-decatur --dry-run
```

### Apply Database Migration

Run the migration in Supabase SQL Editor:
```bash
# Migration file
database/migrations/096_visit_decatur_source.sql
```

Or via psql:
```bash
psql $DATABASE_URL -f database/migrations/096_visit_decatur_source.sql
```

## Expected Coverage

**Event Types:**
- Downtown Decatur festivals and community events
- Arts & culture events
- Live music performances at local venues
- Family-friendly activities
- Food & drink events (restaurant weeks, tastings)
- Farmers markets
- Holiday celebrations
- Guided tours and historical walks

**Geographic Coverage:**
- Downtown Decatur
- Decatur Square
- Oakhurst
- Other Decatur neighborhoods

## Integration with Decatur Portal

This crawler complements the Decatur city portal (created in migration 094):
- Events automatically appear in the Decatur portal feed
- Neighborhood filtering aligns with portal structure
- Supports the "walkable Decatur" theme

## Monitoring

**Crawl Logs:**
Check `crawl_logs` table for run history:
```sql
SELECT * FROM crawl_logs
WHERE source_id = (SELECT id FROM sources WHERE slug = 'visit-decatur')
ORDER BY started_at DESC
LIMIT 10;
```

**Event Counts:**
```sql
SELECT COUNT(*) FROM events
WHERE source_id = (SELECT id FROM sources WHERE slug = 'visit-decatur');
```

## Similar Crawlers

**Reference Implementations:**
- `discover_atlanta.py` - Similar tourism/CVB crawler for Atlanta
- `shakespeare_tavern.py` - Similar Playwright-based text extraction
- `decatur_city.py` - Official Decatur city government events

## Notes

- The site uses WordPress with an embedded events calendar widget
- Events may be sparse depending on the season
- Some events may reference venues outside Decatur (handled dynamically)
- The crawler is resilient to page structure changes via multiple selector fallbacks
- Extraction confidence: 0.80 (good quality but not API-based)

## Troubleshooting

**Common Issues:**

1. **No events found**: Check if the calendar widget loaded
   - Increase wait time in `page.wait_for_timeout()`
   - Verify CSS selectors are still valid

2. **Venue extraction failing**:
   - Review venue extraction patterns in code
   - Check if venue names follow expected formats

3. **Date parsing errors**:
   - Add new date format patterns to `parse_date()` function
   - Check logs for specific date string formats

## Future Enhancements

- [ ] Add event detail page scraping for full descriptions
- [ ] Extract ticket pricing information
- [ ] Capture event organizer/sponsor information
- [ ] Add support for recurring event detection
- [ ] Improve venue geocoding for non-standard locations
