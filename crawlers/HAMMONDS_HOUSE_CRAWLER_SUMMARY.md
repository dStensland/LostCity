# Hammonds House Museum Crawler

## Summary

Successfully created a crawler for Hammonds House Museum that extracts exhibitions and events from their Squarespace website.

## Files Created/Modified

1. **`/Users/coach/Projects/LostCity/crawlers/sources/hammonds_house.py`**
   - Full Playwright-based crawler for Hammonds House Museum
   - Handles Squarespace JavaScript rendering
   - Extracts exhibitions from `/current-exhibit` page
   - Extracts events from `/events` page
   - 421 lines of code

2. **`/Users/coach/Projects/LostCity/crawlers/add_hammonds_house_source.py`**
   - Helper script to add source to database
   - Note: Source ID 431 already existed, so this created a duplicate (ID 1077) which was deactivated

## Venue Details

- **Name**: Hammonds House Museum
- **Slug**: `hammonds-house-museum` (venue), `hammonds-house` (source)
- **ID**: 218 (venue), 431 (source)
- **Address**: 503 Peeples St SW, Atlanta, GA 30310
- **Neighborhood**: West End
- **Type**: museum
- **Website**: https://www.hammondshousemuseum.org/

## Crawler Features

### Exhibition Detection
- Searches for h1/h2/h3 headings in main content area
- Parses date ranges in multiple formats:
  - "February 13 - June 28, 2026"
  - "Month day, year - Month day, year"
  - "Month year - Month year"
- Filters out navigation/boilerplate headings
- Extracts descriptions from following paragraphs
- Sets `is_all_day=True` for exhibitions
- Sets `is_free=False` (museum charges admission)

### Event Detection
- Searches for Squarespace event/calendar items
- Parses single event dates and times
- Extracts descriptions and images
- Handles various Squarespace calendar structures

### Categorization
- Exhibitions → `art` category, `exhibition` subcategory
- Music events → `music` category, `concert` subcategory
- Workshops → `art` category, `workshop` subcategory
- Lectures → `learning` category, `lecture` subcategory
- Family events → `family` category, `kids` subcategory
- Community programs → `community` category, `cultural` subcategory

### Tags
All events tagged with:
- `museum`
- `art`
- `african-american`
- `west-end`
- `hammonds-house`

Plus category-specific tags.

## Test Results

**First successful run (2026-02-16)**:
- Found: 1 exhibition
- New: 1 event created
- Updated: 0
- Warnings: 1 (past_date - start date Feb 13 is in the past)

**Second run (deduplication test)**:
- Found: 1 exhibition
- New: 0
- Updated: 1 (correctly recognized duplicate)

**Exhibition found**:
- Title: "Beau McCall: Divas, Blues, and Memories"
- Dates: February 13 - June 28, 2026
- Category: art / exhibition
- Description: Auto-extracted from page

## Technical Notes

### Squarespace Challenges
1. Site uses heavy JavaScript rendering - requires Playwright
2. Google Translate widget creates language selector menu at top of page
   - Solution: Scroll and use main content selector
3. Exhibition titles in h1 elements (not typical h2/h3)
   - Solution: Query for h1, h2, h3

### Date Parsing
- Multiple regex patterns to handle different formats
- Handles both "Month day - Month day, year" and "Month day, year - Month day, year"
- Gracefully skips past exhibitions

### Content Filtering
Skips boilerplate headings containing:
- "hammonds house", "history", "exhibition history"
- "discover our", "experience", "learn more"
- "creative pulse", "from hands-on", "public engagement"
- "calendar is packed", "museum event"

## Category Corrections Made

Changed from invalid categories to valid ones:
- ~~`museums`~~ → `art` (exhibitions, workshops, general museum events)
- ~~`museums`~~ → `learning` (lectures, talks)

Valid category list: music, film, comedy, theater, art, sports, food_drink, nightlife, community, fitness, family, learning, dance, tours, meetup, words, religious, markets, wellness, support_group, gaming, outdoors, other

## Database Source Configuration

- **Source ID**: 431
- **Slug**: `hammonds-house`
- **Type**: `scrape`
- **Integration**: `playwright`
- **Crawl Frequency**: `weekly`
- **Active**: True
- **Owner Portal**: None (default Atlanta portal)

## Future Improvements

1. **Event page**: Currently finds 0 events - may need better selectors for Squarespace calendar
2. **Image extraction**: Could be improved to find exhibition images more reliably
3. **Description enrichment**: Could extract more detailed exhibition descriptions
4. **Past exhibition archive**: Could optionally crawl `/exhibition-history` page

## Maintenance

- Source is set to crawl weekly
- Deduplication works correctly via content hashing
- Handles Squarespace site changes via flexible selectors
- Logs are comprehensive for debugging
