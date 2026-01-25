# Data Quality Issues - Pipeline Visualization

## Normal Data Flow (Working Sources)

```
┌─────────────────┐
│  Source Website │
│  (HTML/JSON)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Crawler Fetch  │  ✅ URL accessible, HTML parsed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  LLM Extract    │  ✅ Claude extracts structured data
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Venue Create   │  ✅ venue_id assigned
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Insert   │  ✅ All required fields present
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │  ✅ Event queryable by location/date/category
└─────────────────┘
```

---

## Issue 1: 'soup' NameError (5 sources)

```
┌─────────────────┐
│  Hardcoded Data │  ✅ Book club dates generated
│  (No scraping)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Event Build    │  ❌ CRASH: name 'soup' is not defined
│  Dict           │     Line: "image_url": extract_image_url(soup)
└────────┬────────┘
         │
         X  Process terminates
         │
         ▼
┌─────────────────┐
│  crawl_logs     │  ❌ status='error'
│                 │     error_message='name soup is not defined'
└─────────────────┘

AFFECTED SOURCES:
- bookish_atlanta
- wild_aster_books
- atlanta_cultural_affairs
- sun_dial_restaurant  
- kats_cafe

FIX: Remove line referencing 'soup' or set to None
```

---

## Issue 2: Missing venue_id (357 events)

```
┌─────────────────┐
│  Source Data    │  ⚠️  Online event OR venue data empty
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Venue Extract  │  ⚠️  venue_info = None or {}
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  get_or_create  │  ❌ Returns None (no fallback)
│  _venue()       │     if not venue_info.get("name"):
└────────┬────────┘         return None
         │
         ▼
┌─────────────────┐
│  Event Record   │  ❌ venue_id=None (violates FK constraint)
│                 │     OR passes NULL to database
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Database       │  ❌ Event exists but unfilterable
│  events table   │     WHERE venue_id IS NULL
└─────────────────┘

AFFECTED EVENTS:
- Eventbrite: 31 events (online/TBA)
- Meetup: 130 events (virtual meetups)
- Georgia State: 147 events (away games)
- Others: 49 events

FIX: Create "Online/Virtual" venue, use as fallback
     venue_id = get_or_create_virtual_venue()
```

---

## Issue 3: 404 Errors (3 sources)

```
┌─────────────────┐
│  Source URL     │  ❌ https://oglethorpe.edu/events
│  Dead/Moved     │     Website restructured, /events removed
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  HTTP Request   │  ❌ 404 Not Found
│  GET /events    │     Response: Page does not exist
└────────┬────────┘
         │
         X  No HTML to parse
         │
         ▼
┌─────────────────┐
│  crawl_logs     │  ❌ status='error'
│                 │     error_message='404 Client Error'
└─────────────────┘

AFFECTED SOURCES:
- oglethorpe-university (3 consecutive failures)
- sports-social (3 consecutive failures)
- midway-pub (3 consecutive failures)

FIX: 
1. Visit base URL, find new events page
2. Update sources.url and crawler EVENTS_URL
3. OR mark as inactive if no public events page exists
```

---

## Issue 4: Missing Coordinates (20 venues)

```
┌─────────────────┐
│  Venue Created  │  ⚠️  Address vague: "Atlanta, GA"
│                 │      OR geocoding not run
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  venues table   │  ❌ lat=NULL, lng=NULL
│                 │     Cannot place on map
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Map View (UI)  │  ❌ Events at this venue invisible
│  Filter: bounds │     ST_Within() fails with NULL coords
└─────────────────┘

AFFECTED VENUES:
- Wylde Center (2 events) - "Atlanta, GA" 
- Atlanta Pride (5 events) - partial address
- World of Coca-Cola (0 events) - unused
- 17 others

FIX:
1. Run geocode_venues.py script
2. Manually enrich vague addresses
3. Delete unused venues (0 events)
```

---

## Data Quality Bottlenecks

### Crawler Stage
- ❌ No validation for required fields before insert
- ❌ Silent failures when venue creation fails
- ❌ No health checks for source URLs

### Database Stage  
- ❌ NULL venue_id allowed (should be NOT NULL)
- ❌ No CHECK constraint for lat/lng pairs (both NULL or both set)
- ❌ No automated geocoding on insert

### Monitoring Stage
- ❌ Errors logged but not alerted
- ❌ No dashboard for data quality metrics
- ❌ Manual audit required to find issues

---

## Recommended Guards

### 1. Crawler Validation (Before Insert)
```python
def validate_event_record(event: dict) -> list[str]:
    """Return list of validation errors."""
    errors = []
    
    if not event.get("title"):
        errors.append("Missing title")
    
    if not event.get("start_date"):
        errors.append("Missing start_date")
    
    if not event.get("venue_id"):
        errors.append("Missing venue_id")
    
    if event.get("price_min") and event.get("price_max"):
        if event["price_min"] > event["price_max"]:
            errors.append("price_min > price_max")
    
    return errors
```

### 2. Database Constraints
```sql
-- Make venue_id required
ALTER TABLE events 
ALTER COLUMN venue_id SET NOT NULL;

-- Ensure lat/lng are both set or both null
ALTER TABLE venues
ADD CONSTRAINT check_coordinates 
CHECK ((lat IS NULL AND lng IS NULL) OR (lat IS NOT NULL AND lng IS NOT NULL));
```

### 3. Automated Monitoring
```bash
# Cron job: Daily at 6am
0 6 * * * cd /path/to/crawlers && python data_quality_audit.py | mail -s "Daily Data Quality Report" team@lostcity.com
```

---

## Files & Scripts Reference

**Audit Tools:**
- `/Users/coach/Projects/LostCity/crawlers/data_quality_audit.py` - Main audit script
- `/Users/coach/Projects/LostCity/crawlers/detailed_diagnostics.py` - Deep dive analysis

**Reports:**
- `/Users/coach/Projects/LostCity/DATA_QUALITY_REPORT.md` - Full diagnostic report
- `/Users/coach/Projects/LostCity/FIXES_PRIORITY_LIST.md` - Ordered fix checklist
- `/Users/coach/Projects/LostCity/DATA_QUALITY_SUMMARY.md` - Executive summary

**Code to Fix:**
- `/Users/coach/Projects/LostCity/crawlers/db.py` - Add virtual venue function
- `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py` - Fix venue fallback
- `/Users/coach/Projects/LostCity/crawlers/sources/meetup.py` - Fix venue fallback
- `/Users/coach/Projects/LostCity/crawlers/sources/bookish_atlanta.py` - Remove soup ref
- `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_cultural_affairs.py` - Remove soup ref
- (+ 3 more soup fixes)

**Utilities:**
- `/Users/coach/Projects/LostCity/crawlers/geocode_venues.py` - Add coordinates
