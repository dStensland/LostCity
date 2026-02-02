# Barnes & Noble Atlanta Crawler

## Overview

Crawler for Barnes & Noble bookstore events across 6 Atlanta-area locations. Targets family-friendly events including:
- Saturday morning storytimes
- Author events and signings
- Book club meetings
- Character appearances
- Holiday and special events

## Locations Covered

1. **Buckhead** - 2900 Peachtree Rd NW, Atlanta
2. **Perimeter** - 1275 Ashford Dunwoody Rd, Dunwoody
3. **Atlantic Station** - 201 19th St NW, Atlanta
4. **Alpharetta** - 10905 State Bridge Rd, Alpharetta
5. **Marietta** - 1660 Cobb Pkwy SE, Marietta
6. **Kennesaw** - 800 Cobb Place Blvd NW, Kennesaw

## Implementation Status

### Created
- ✅ Crawler module: `/crawlers/sources/barnes_noble_atlanta.py`
- ✅ Source registered in database (ID: 413)
- ✅ Added to `SOURCE_MODULES` in `main.py`
- ✅ All 6 venue records created

### Current Limitations

**Events Not Currently Being Found**

The crawler is operational but not finding events. This could be due to:

1. **URL Structure**: Barnes & Noble may not use `/events` suffix on store pages
2. **Dynamic Content**: Events may be loaded via separate API calls
3. **Calendar System**: B&N may use a centralized event system rather than per-store pages
4. **Event Availability**: Stores may not currently have scheduled events listed

### Next Steps for Full Implementation

1. **Manual Verification**
   - Visit actual B&N store pages to inspect event listing structure
   - Check if events are listed on main barnesandnoble.com/events page
   - Determine if events are filtered by location

2. **Update Extraction Logic**
   Based on actual site structure, update one of:
   - Event page URL pattern
   - DOM selectors for event extraction
   - API endpoint if events are loaded dynamically

3. **Alternative Approach**
   If B&N doesn't maintain online event calendars consistently:
   - Consider phone-based verification
   - Partner with stores for event feeds
   - Use social media monitoring (Facebook events, Instagram)

## Testing

```bash
# Test crawler (dry-run)
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source barnes-noble-atlanta --dry-run

# Run actual crawl
python3 main.py --source barnes-noble-atlanta
```

## Event Categorization

When events are found, they will be tagged as:

**Categories**
- `family` - Storytimes and kids events
- `words` - Author events and book clubs

**Tags**
- `books`, `bookstore`
- `family`, `kids`, `family-friendly` (for kids events)
- `storytime` (for Saturday storytimes)
- `free` (for free events)
- `educational`

**Typical Event Types**
- **Storytime**: Free, Saturday mornings, ages 2-5
- **Author Events**: Usually free admission
- **Book Clubs**: Monthly meetings
- **Character Visits**: Holiday events, photo opportunities

## Files

- `/crawlers/sources/barnes_noble_atlanta.py` - Main crawler
- `/crawlers/add_barnes_noble_source.py` - Database setup script
- `/crawlers/test_barnes_noble.py` - Testing/debugging script

## Contact & Social

Most B&N stores maintain:
- Store Facebook pages with event announcements
- Instagram accounts
- In-store event calendars

Consider monitoring these channels for event data if web crawling proves insufficient.
