# ADAM ATL Crawler

## Summary

Successfully built and deployed a crawler for the African Diaspora Art Museum of Atlanta (ADAM ATL).

**Status**: ✅ Operational
**Source ID**: 1075
**Venue ID**: 2433
**First Run**: 2026-02-16
**Events Captured**: 31 events found, 28 new events added

## Implementation Details

### Files Created

1. **`/Users/coach/Projects/LostCity/crawlers/sources/adam_atl.py`**
   - Main crawler module
   - Uses `requests` + `BeautifulSoup` (no Playwright needed)
   - Scrapes Squarespace events list at https://www.adamatl.org/events

2. **`/Users/coach/Projects/LostCity/crawlers/register_adam_source.py`**
   - Registration script (one-time use, already run)
   - Created source ID 1075 in database

### Crawler Pattern

The crawler follows the standard LostCity pattern:

```python
async def crawl(source: dict) -> tuple[int, int, int]:
    # Returns (events_found, events_new, events_updated)
```

### Data Structure

**Venue Details:**
- Name: African Diaspora Art Museum of Atlanta
- Slug: `adama-atlanta` (matches venue ID 2433)
- Address: 535 Means St NW, Suite C, Atlanta, GA 30318
- Neighborhood: Westside
- Type: museum

**Event Parsing:**
- Extracts from Squarespace `article.eventlist-event` structure
- Date from `<time datetime="YYYY-MM-DD">` attribute
- Time from meta list (format: "2:00 PM3:00 PM")
- Title from `h1.eventlist-title`
- Description from `.eventlist-description`
- Image from `.eventlist-column-thumbnail-image`

**Categorization Logic:**
- Artist salons/talks → `art` / `talk` subcategory
- Exhibitions/openings → `art` / `exhibition` subcategory
- Workshops/classes → `art` / `workshop` subcategory
- Film screenings → `film` category
- Music/performance → `music` / `performance` subcategory
- Default → `art` category

**Tags Applied:**
All events get base tags: `adam`, `adam-atl`, `museum`, `african-diaspora`, `african-american`, `westside`, `art`

Additional tags based on event type (talk, salon, exhibition, opening, workshop, etc.)

**Pricing:**
- `is_free`: False
- `price_note`: "Suggested donation: $10 adults, $5 students/seniors"

### Sample Event Output

```
Title: ADAMA Arts Salon Special Edition
Date: 2025-02-02 at 14:00:00
Category: art / None
Description: EP #58 | Sunday, February 2nd ADAMA Arts Salon is a series of conversations featuring contemporary artists, curators, scholars, and more from across the African Diaspora...
Tags: ['all-ages', 'black-history-month', 'debut', 'educational', 'family-friendly', ...]
Price note: Suggested donation: $10 adults, $5 students/seniors
Free: False
Source URL: https://www.adamatl.org/events/adma-arts-salon-special-addition
```

## Running the Crawler

```bash
# From /Users/coach/Projects/LostCity/crawlers/
python3 main.py --source adam-atl
```

## Data Quality Notes

**✅ Strengths:**
- Clean, structured Squarespace event data
- Reliable date/time parsing
- Good event descriptions from source
- Images available for most events
- URLs to individual event pages

**⚠️ Warnings:**
- Some past events in calendar (30 past_date warnings) - normal
- Description sanitization needed (12 events) - HTML entities cleaned
- Missing start times on 1 event

**Potential Enhancements:**
- Could add exhibitions scraping from `/exhibits` page (more complex Squarespace layout)
- Could fetch detailed descriptions from individual event pages
- Series detection for recurring "ADAMA Arts Salon" episodes

## Source Configuration

```
Source ID: 1075
Name: ADAM ATL
Slug: adam-atl
URL: https://www.adamatl.org/events
Type: scrape
Active: Yes
Crawl Frequency: daily
Owner Portal: Atlanta (74c2f211-ee11-453d-8386-ac2861705695)
```

## Architecture Notes

**Why not Playwright?**
The Squarespace events page renders server-side HTML with all event data present in the initial response. No JavaScript execution needed, so `requests` + `BeautifulSoup` is sufficient and faster.

**Exhibition Handling:**
The `/exhibits` page exists but has a more complex Squarespace grid layout. Exhibitions are typically long-running (months) and would be `is_all_day=True` with `end_date` set. Could be added as `_crawl_exhibitions()` helper similar to `atlanta_contemporary.py` pattern if needed.

## Next Steps

1. ✅ Crawler operational and tested
2. ✅ Source registered and active
3. ✅ First crawl completed successfully (28 events added)
4. Monitor for data quality in production
5. Consider adding exhibitions parsing if requested

## Contact

Venue verified as existing in database (ID 2433).
All events associated with correct venue.
Portal attribution: Atlanta (correct).
