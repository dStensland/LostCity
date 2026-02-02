# Theatre for Young Audiences Crawler - Setup Instructions

## Summary

Created a dedicated crawler for Alliance Theatre's Theatre for Young Audiences and family programming.

**Organization**: Alliance Theatre - Theatre for Young Audiences
**Website**: https://www.alliancetheatre.org/family-programming/
**Type**: Children's and Family Theater
**Programming Includes**:
- Theatre for Young Audiences (ages 6+)
- Bernhardt Theatre for the Very Young (ages 0-5)
- The Underground Rep (teen programming)

## Files Created

### 1. Crawler Module
**Location**: `/Users/coach/Projects/LostCity/crawlers/sources/theatre_for_young_audiences.py`

**Features**:
- Crawls 4 Alliance Theatre family programming pages
- Uses Playwright for JavaScript-rendered content
- Comprehensive tagging: family-friendly, kids, teen, age-specific
- Parses dates in multiple formats (MM/DD/YYYY, Month DD YYYY)
- Extracts prices, images, show descriptions
- Determines subcategory (play, musical, puppet-show)
- Error handling with graceful failures

**Key Functions**:
- `crawl(source)` - Main entry point
- `extract_shows_from_page()` - Parses shows from each page
- `determine_show_type()` - Auto-categorizes shows
- `parse_date_range()` - Handles multiple date formats

### 2. Main Registry Update
**Location**: `/Users/coach/Projects/LostCity/crawlers/main.py` (line 94)

**Change**:
```python
"alliance-theatre": "sources.alliance_theatre",
"theatre-for-young-audiences": "sources.theatre_for_young_audiences",  # NEW
"creative-loafing": "sources.creative_loafing",
```

### 3. Database Migration
**Location**: `/Users/coach/Projects/LostCity/database/migrations/099_theatre_for_young_audiences.sql`

**SQL**:
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

### 4. Documentation
- `/Users/coach/Projects/LostCity/crawlers/THEATRE_FOR_YOUNG_AUDIENCES_README.md` - Comprehensive documentation
- This setup file

## Setup Steps

### Step 1: Database Migration (REQUIRED)

Run the migration in Supabase SQL Editor:

```sql
-- Navigate to Supabase SQL Editor
-- Run: /Users/coach/Projects/LostCity/database/migrations/099_theatre_for_young_audiences.sql

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

### Step 2: Test the Crawler

```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate

# Test import (already verified ✅)
python3 -c "from sources.theatre_for_young_audiences import crawl; print('✅ Import successful')"

# Dry run (fetch but don't save)
python3 main.py --source theatre-for-young-audiences --dry-run

# Full crawl
python3 main.py --source theatre-for-young-audiences
```

### Step 3: Verify Results

After running the crawler:

```bash
# Check crawl logs
python3 -c "from db import get_client; client = get_client(); logs = client.table('crawl_logs').select('*').eq('source_slug', 'theatre-for-young-audiences').order('started_at', desc=True).limit(1).execute(); print(logs.data)"

# Check events created
python3 -c "from db import get_client; client = get_client(); events = client.table('events').select('title, start_date, category, tags').in_('tags', [['family-friendly']]).limit(10).execute(); print(events.data)"
```

## Event Tagging

All events will be tagged with:

**Base tags** (all events):
- `theater`
- `family-friendly`
- `alliance-theatre`
- `woodruff-arts-center`

**Page-specific tags**:
- `theatre-for-young-audiences` - TYA shows
- `very-young-audiences` - Bernhardt Theatre
- `underground-rep` - Teen programming

**Age-specific tags** (auto-detected):
- `toddler` - Ages 0-3
- `preschool` - Ages 3-5
- `elementary` - Ages 6-10
- `teen` - Teen programming

**Content tags** (auto-detected):
- `musical` - Musical productions
- `puppets` - Puppet shows
- `kids` - Children's programming

## Expected Results

**Events per Season**: 10-20 shows
- Theatre for Young Audiences: 3-5 shows/year
- Bernhardt Theatre for the Very Young: 3-5 shows/year
- The Underground Rep: 2-3 productions/year

**Crawl Frequency**: Weekly (configurable in sources table)

**Venue**: All events link to Alliance Theatre venue (slug: `alliance-theatre`)

## Verification Checklist

- [x] Crawler file created
- [x] Added to SOURCE_MODULES registry
- [x] Database migration created
- [x] Documentation created
- [x] Import test successful
- [ ] Database migration run (PENDING - requires Supabase access)
- [ ] Dry run test (PENDING - requires database setup)
- [ ] Full crawl test (PENDING - requires database setup)
- [ ] Events verified in database (PENDING)

## Troubleshooting

### Issue: Source not found in `--list`
**Solution**: Run the database migration first. The source must exist in the `sources` table.

### Issue: Playwright timeout
**Solution**:
- Check internet connection
- Verify Alliance Theatre website is accessible
- Increase timeout in crawler (currently 30 seconds)

### Issue: No events found
**Possible causes**:
- No current season shows listed
- Website structure changed
- JavaScript not rendering properly

**Debug steps**:
```bash
# Enable debug logging
python3 main.py --source theatre-for-young-audiences --dry-run --verbose

# Check page content
python3 -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); browser = p.chromium.launch(); page = browser.new_page(); page.goto('https://www.alliancetheatre.org/family-programming/'); print(page.content())"
```

### Issue: Duplicate events with alliance_theatre.py
**Expected behavior**: Some duplication is normal. Events are deduplicated via `content_hash`.

**Verification**:
```sql
-- Check for duplicates
SELECT title, start_date, COUNT(*) as count
FROM events
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'alliance-theatre')
GROUP BY title, start_date
HAVING COUNT(*) > 1;
```

## Related Documentation

- Main README: `/Users/coach/Projects/LostCity/crawlers/THEATRE_FOR_YOUNG_AUDIENCES_README.md`
- Alliance Theatre crawler: `/Users/coach/Projects/LostCity/crawlers/sources/alliance_theatre.py`
- Database schema: `/Users/coach/Projects/LostCity/database/schema.sql`
- Crawler architecture: `/Users/coach/Projects/LostCity/database/CLAUDE.md`

## Next Steps

1. **Run database migration** (required before testing)
2. **Test dry run** to verify page parsing
3. **Run full crawl** to populate events
4. **Monitor crawl_logs** for any errors
5. **Consider related sources**:
   - Other Atlanta children's theater companies
   - Children's Museum theater performances
   - Family-friendly shows at other venues

## Notes

- This crawler is **complementary** to `alliance_theatre.py`, not a replacement
- Both crawlers use the same Alliance Theatre venue record
- Events are automatically deduplicated via content hashing
- Focus on family programming ensures comprehensive coverage of children's shows
- All pages use Playwright due to JavaScript rendering

## Contact

For questions or issues:
- Check `crawl_logs` table for error details
- Review Alliance Theatre website for structure changes
- Consult main crawler documentation in `/Users/coach/Projects/LostCity/database/CLAUDE.md`
