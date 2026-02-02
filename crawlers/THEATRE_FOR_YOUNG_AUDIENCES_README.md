# Theatre for Young Audiences Crawler

## Overview

Dedicated crawler for Alliance Theatre's family and children's programming, including:
- **Theatre for Young Audiences** (Goizueta Stage) - Family-friendly shows for ages 6+
- **Bernhardt Theatre for the Very Young** - Shows for toddlers and preschoolers (ages 0-5)
- **The Underground Rep** - Teen-focused programming

This crawler complements the existing `alliance_theatre.py` crawler by focusing specifically on family programming pages and ensuring comprehensive coverage of children's theater events.

## Created Files

1. **Crawler Module**: `/Users/coach/Projects/LostCity/crawlers/sources/theatre_for_young_audiences.py`
   - Main crawler implementation
   - Uses Playwright for JavaScript-rendered content
   - Parses multiple family programming pages
   - Tags events with family-friendly, kids, teen, and age-specific tags

2. **Main Registry**: `/Users/coach/Projects/LostCity/crawlers/main.py`
   - Added `"theatre-for-young-audiences": "sources.theatre_for_young_audiences"` to SOURCE_MODULES (line 94)

3. **Database Migration**: `/Users/coach/Projects/LostCity/database/migrations/099_theatre_for_young_audiences.sql`
   - SQL insert statement for sources table
   - Source slug: `theatre-for-young-audiences`
   - Crawl frequency: weekly

4. **Documentation**: This file

## Technical Details

### Pages Crawled

1. **Theatre for Young Audiences**: `https://www.alliancetheatre.org/family-programming/theatre-young-audiences/`
   - Main family shows (ages 6+)
   - Goizueta Stage performances

2. **Bernhardt Theatre for the Very Young**: `https://www.alliancetheatre.org/family-programming/bernhardt-theatre-the-very-young/`
   - Shows for toddlers and preschoolers
   - Ages 0-5

3. **The Underground Rep**: `https://www.alliancetheatre.org/family-programming/underground-rep/`
   - Teen programming
   - High school age audiences

4. **Family Programming Overview**: `https://www.alliancetheatre.org/family-programming/`
   - General family programming page
   - May include additional family events

### Event Categories and Tags

**Category**: `theater`

**Subcategories**:
- `play` - Standard theatrical productions
- `musical` - Musicals with music and songs
- `puppet-show` - Puppet theater performances

**Tags** (automatically applied):
- `theater` - All events
- `family-friendly` - All events
- `alliance-theatre` - All events
- `woodruff-arts-center` - All events
- `kids` - Children's programming
- `teen` - Teen programming (Underground Rep)
- `theatre-for-young-audiences` - TYA shows
- `very-young-audiences` - Bernhardt Theatre
- `toddler` - Ages 0-3
- `preschool` - Ages 3-5
- `elementary` - Ages 6-10
- `musical` - Musical productions
- `puppets` - Puppet shows
- `underground-rep` - Teen programming

### Date Parsing

The crawler handles multiple date formats:
- `MM/DD/YYYY - MM/DD/YYYY` (date ranges)
- `MM/DD/YYYY` (single dates)
- `Month DD, YYYY` (e.g., "January 15, 2026")

### Price Extraction

- Detects free shows
- Extracts dollar amounts from text
- Returns price_min, price_max, and price_note

### Image Extraction

- Uses `extract_images_from_page()` utility
- Fallback to structured `<img>` tags
- Associates images with show titles

## Venue Information

**Alliance Theatre**
- Address: 1280 Peachtree St NE, Midtown, Atlanta, GA 30309
- Venue Type: theater
- Part of Woodruff Arts Center
- Multiple stages:
  - Goizueta Stage (Theatre for Young Audiences)
  - Bernhardt Theatre for the Very Young
  - Additional stages for general programming

## Usage

### Run the crawler

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate

# Run Theatre for Young Audiences crawler
python main.py --source theatre-for-young-audiences

# Dry run (fetch but don't save)
python main.py --source theatre-for-young-audiences --dry-run

# List all sources
python main.py --list
```

### Database Setup

Run the migration to add the source:

```bash
# In Supabase SQL Editor, run:
/Users/coach/Projects/LostCity/database/migrations/099_theatre_for_young_audiences.sql
```

Or manually insert:

```sql
INSERT INTO sources (slug, name, url, source_type, is_active, crawl_frequency)
VALUES (
    'theatre-for-young-audiences',
    'Theatre for Young Audiences (Alliance Theatre)',
    'https://www.alliancetheatre.org/family-programming/',
    'website',
    true,
    'weekly'
) ON CONFLICT (slug) DO NOTHING;
```

## Expected Event Volume

- **10-20 events per season**
- Theatre for Young Audiences: 3-5 shows/year
- Bernhardt Theatre for the Very Young: 3-5 shows/year
- The Underground Rep: 2-3 productions/year
- Additional family programming: varies

## Relationship to alliance_theatre.py

This crawler is complementary to the existing `alliance_theatre.py` crawler:

- **alliance_theatre.py**: Crawls main shows page, captures all Alliance Theatre productions
- **theatre_for_young_audiences.py**: Focuses on family programming pages, ensures detailed capture of children's shows

Both crawlers use the same Alliance Theatre venue record. Events are deduplicated via `content_hash` to prevent duplicates.

## Error Handling

- Playwright timeout handling (30 second timeout)
- Graceful failure for individual pages
- Logging of all errors to `crawl_logs` table
- Continues crawling other pages even if one fails

## Dependencies

- `playwright` - For JavaScript-rendered pages
- `beautifulsoup4` - HTML parsing (via utilities)
- Standard crawler dependencies (`db.py`, `dedupe.py`, `utils.py`)

## Testing Notes

The crawler has been successfully imported and tested for:
- ✅ Module import
- ✅ Function signature (crawl function exists)
- ✅ Main.py registration

Additional testing recommended:
- Live crawl test with `--dry-run`
- Verify event extraction from current season
- Check date parsing for various formats
- Validate tag application

## Future Enhancements

Potential improvements:
1. Extract show ages/age ranges from descriptions
2. Parse specific performance times for matinees
3. Identify sensory-friendly performances
4. Extract educator resources and field trip information
5. Capture class/workshop offerings alongside performances

## Related Sources

Other Atlanta children's theater sources to consider:
- **Georgia Ensemble Theatre** - Family shows
- **Aurora Theatre** - Children's programming
- **Horizon Theatre** - Family-friendly productions
- **Children's Museum of Atlanta** - Theater performances at museum

## Contact

For questions about this crawler:
- Check `crawl_logs` table for recent crawl results
- Review Alliance Theatre website structure for changes
- Verify Playwright is working correctly if errors occur

## Changelog

### 2026-01-31 - Initial Creation
- Created dedicated Theatre for Young Audiences crawler
- Added to SOURCE_MODULES registry
- Created database migration
- Comprehensive tagging for family-friendly events
- Multi-page crawling for all family programming sections
