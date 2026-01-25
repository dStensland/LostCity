# Lost City Data Quality Audit Report
**Generated:** 2026-01-24  
**Total Events in Database:** 1,000  
**Total Issues Found:** 357 critical, 20 venues, 50+ crawler errors

---

## Executive Summary

The audit identified **four priority issues** affecting data quality:

1. **Missing venue_id** (357 events) - Venues failing to link properly, causing NULL venue_id
2. **Undefined variable 'soup'** (5 crawlers) - Copy-paste error in hardcoded event generators
3. **404 errors** (3 sources) - Dead URLs needing updates
4. **Missing venue coordinates** (20 venues) - Blocking map display

---

## Priority 1: Missing venue_id (357 events - 36% of database)

### Issue Summary
357 events (36% of all events) have NULL venue_id, making them undiscoverable via map/location filters. Top offenders:
- **Georgia State Athletics**: 147 events
- **Meetup**: 130 events  
- **Eventbrite**: 31 events
- **Discover Atlanta**: 30 events

### Data Patterns Observed

**Pattern 1: Online/Virtual Events Without Physical Venues**
```
Event ID: 5635 - Eventbrite
Title: "Emotional Stem: A Kyoko Takeuchi Exhibition"
Venue: None (likely online or TBA)

Event ID: 4534 - Meetup  
Title: "Low B level sand volleyball Friday morning"
Venue: None (location specified in description)
```

**Pattern 2: Away Games/External Venues**
```
Event ID: 5064 - Georgia State Athletics
Title: "GSU Panthers Softball: At Georgia Tech"
Raw: {"name": " At Georgia Tech", "homeTeam": {"name": ""}, "awayTeam": {"name": ""}}
```
The JSON-LD has empty venue data for away games.

**Pattern 3: Venue Extraction Failures**
Eventbrite and Meetup crawlers attempt to create venues but fail silently when:
- Venue name is missing/empty from source JSON-LD
- Online events have no physical location
- Venue address is incomplete/invalid

### Root Cause Analysis

**Eventbrite** (`/crawlers/sources/eventbrite.py:227-241`):
```python
venue_id = None
venue_info = event_data.get("venue")
if venue_info and venue_info.get("name"):
    venue_record = {...}
    try:
        venue_id = get_or_create_venue(venue_record)
    except Exception as e:
        logger.warning(f"Failed to create venue {venue_info['name']}: {e}")
# venue_id remains None if no name or exception occurs
```

**Meetup** - Similar pattern, plus many virtual events

**Georgia State Athletics** - JSON-LD for away games lacks venue data

### Recommended Fixes

#### Fix 1: Create "Online/Virtual" Venue for Remote Events
**File:** `/crawlers/db.py`

Add function to get virtual venue:
```python
def get_or_create_virtual_venue() -> int:
    """Get or create the standard 'Online/Virtual' venue for remote events."""
    client = get_client()
    
    # Try to find existing virtual venue
    result = client.table("venues").select("id").eq("slug", "online-virtual").execute()
    if result.data and len(result.data) > 0:
        return result.data[0]["id"]
    
    # Create it
    venue_data = {
        "name": "Online/Virtual",
        "slug": "online-virtual", 
        "address": None,
        "city": "Atlanta",
        "state": "GA",
        "venue_type": "virtual",
        "lat": None,
        "lng": None,
    }
    result = client.table("venues").insert(venue_data).execute()
    return result.data[0]["id"]
```

#### Fix 2: Update Eventbrite Crawler to Handle Missing Venues
**File:** `/crawlers/sources/eventbrite.py:226-241`

```python
# Get or create venue
venue_id = None
venue_info = event_data.get("venue")

if venue_info and venue_info.get("name"):
    # Has venue data - try to create it
    venue_record = {
        "name": venue_info["name"],
        "slug": slugify(venue_info["name"]),
        "address": venue_info.get("address"),
        "city": venue_info.get("city", "Atlanta"),
        "state": venue_info.get("state", "GA"),
        "zip": venue_info.get("zip"),
    }
    try:
        venue_id = get_or_create_venue(venue_record)
    except Exception as e:
        logger.warning(f"Failed to create venue {venue_info['name']}: {e}")
        venue_id = get_or_create_virtual_venue()  # NEW: Fallback
else:
    # No venue data - likely online/virtual event
    venue_id = get_or_create_virtual_venue()  # NEW: Default for online events
```

#### Fix 3: Update Meetup Crawler
**File:** `/crawlers/sources/meetup.py` (similar changes)

Same pattern - use `get_or_create_virtual_venue()` as fallback.

#### Fix 4: Handle Georgia State Athletics Away Games
**File:** `/crawlers/sources/georgia_state_athletics.py`

For away games, either:
- Parse opponent venue from title ("At Georgia Tech" -> create Georgia Tech venue)
- Or use virtual venue as placeholder
- Add `tags: ["away-game"]` to make them filterable

### Validation Query
```sql
-- Before fix: Should show 357 events
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;

-- After fix: Should show 0 events  
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;

-- Verify virtual venue is being used appropriately
SELECT COUNT(*) FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.slug = 'online-virtual';
```

---

## Priority 2: Undefined Variable 'soup' (5 crawlers - 100% error rate)

### Issue Summary
5 crawlers fail on every run with `NameError: name 'soup' is not defined`. These crawlers generate hardcoded recurring events and don't actually scrape pages, but copy-pasted code from scraping crawlers.

**Affected Sources:**
- Bookish Atlanta
- Wild Aster Books  
- Atlanta Cultural Affairs
- The Sun Dial Restaurant
- Kat's Cafe

### Data Patterns Observed

**File:** `/crawlers/sources/bookish_atlanta.py:133`
```python
"image_url": extract_image_url(soup) if soup else None,
```

**File:** `/crawlers/sources/atlanta_cultural_affairs.py:115`
```python
"image_url": extract_image_url(soup) if soup else None,
```

The variable `soup` is referenced but never defined in these functions. These crawlers generate events from hardcoded data (recurring book clubs, annual festivals) and don't parse HTML.

### Root Cause Analysis

These crawlers were created by copying template code from scrapers like `the_earl.py` which DO fetch and parse HTML. The `soup` variable and `extract_image_url(soup)` line was left in by mistake.

### Recommended Fixes

#### Fix 1: Remove soup References from Hardcoded Event Generators
**Files:** All 5 affected crawlers

**bookish_atlanta.py** - Line 133:
```python
# REMOVE THIS LINE:
"image_url": extract_image_url(soup) if soup else None,

# REPLACE WITH:
"image_url": None,  # Book club events don't have dynamic images
```

**atlanta_cultural_affairs.py** - Line 115:
```python
# REMOVE:
"image_url": extract_image_url(soup) if soup else None,

# REPLACE WITH:
"image_url": "https://atlantafestivals.com/wp-content/uploads/jazz-fest-hero.jpg",  # Static festival image
```

#### Fix 2: Add Image URLs Where Appropriate
For sources with static branding, add hardcoded image URLs:
- Bookish Atlanta: Could use store logo URL
- Jazz Festival: Festival marketing image
- Restaurant recurring events: Could pull from website once and hardcode

### Validation Query
```sql
-- Check crawl logs for these sources after fix
SELECT s.name, cl.status, cl.error_message, cl.started_at
FROM crawl_logs cl
JOIN sources s ON cl.source_id = s.id
WHERE s.slug IN (
    'bookish-atlanta',
    'wild-aster-books', 
    'atlanta-cultural-affairs',
    'sun-dial-restaurant',
    'kats-cafe'
)
AND cl.started_at > NOW() - INTERVAL '1 day'
ORDER BY cl.started_at DESC;
```

**Expected:** All should show `status='success'` with no error_message.

---

## Priority 3: 404 Errors (3 sources - dead URLs)

### Issue Summary
3 sources consistently fail with 404 errors, indicating website changes or incorrect URLs.

**Affected Sources:**
- **Oglethorpe University** (3 errors) - `https://oglethorpe.edu/events`
- **Sports Social** (3 errors) - `https://www.sportssocial.com`  
- **Midway Pub** (3 errors) - `https://www.midwaypub.com`

### Root Cause Analysis

**Oglethorpe University**: `/events` endpoint may have moved to `/calendar` or behind auth
**Sports Social**: Website may have been redesigned or shut down  
**Midway Pub**: Event listing page may have changed URLs

### Recommended Fixes

#### Manual Investigation Required
For each source:
1. Visit the base URL in a browser
2. Find the current events page (may require clicking through navigation)
3. Update the `url` field in the `sources` table
4. Update the crawler's `BASE_URL` or `EVENTS_URL` constant

#### Example Fix for Oglethorpe
```python
# /crawlers/sources/oglethorpe_university.py
# OLD:
EVENTS_URL = "https://oglethorpe.edu/events"

# Try these alternatives:
EVENTS_URL = "https://oglethorpe.edu/calendar"
EVENTS_URL = "https://oglethorpe.edu/student-life/events"
```

#### Fallback: Mark as Inactive
If the events page no longer exists or requires authentication:
```sql
UPDATE sources 
SET is_active = false, 
    notes = 'Website changed - events page not publicly accessible'
WHERE slug IN ('oglethorpe-university', 'sports-social', 'midway-pub');
```

### Validation Query
```bash
# Test each URL manually
curl -I https://oglethorpe.edu/events
curl -I https://www.sportssocial.com  
curl -I https://www.midwaypub.com
```

---

## Priority 4: Missing Venue Coordinates (20 venues)

### Issue Summary
20 venues lack lat/lng coordinates, preventing them from appearing on the map view. Some have partial addresses, others have "Atlanta, GA" only.

### Affected Venues (Sample)

| ID  | Name | Address | Events |
|-----|------|---------|--------|
| 209 | World of Coca-Cola | 121 Baker St NW | 0 |
| 381 | Wylde Center | Atlanta, GA | 2 |
| 419 | Atlanta Pride | 1530 DeKalb Ave NE | 5 |
| 459 | Bicycle Tours of Atlanta | 659 Auburn Ave NE | 0 |

### Root Cause Analysis

These venues were created without geocoding. The `geocode_venues.py` script exists but may not have been run recently, or these addresses failed geocoding (too vague, invalid format).

### Recommended Fixes

#### Fix 1: Run Geocoding Script
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python geocode_venues.py
```

This should fill in missing coordinates using Google Maps Geocoding API.

#### Fix 2: Manual Correction for Vague Addresses
Some venues like "Wylde Center - Atlanta, GA" need address enrichment:

```sql
-- Fix vague addresses manually
UPDATE venues 
SET address = '1150 Alder Dr SE', zip = '30317'
WHERE id = 381;  -- Wylde Center

UPDATE venues
SET address = 'Various Locations'  -- For mobile/multi-location organizations
WHERE name LIKE '%Tours%' OR name LIKE '%Pride%';
```

#### Fix 3: Delete Unused Venues
Venues with 0 events may be obsolete:
```sql
DELETE FROM venues 
WHERE id IN (209, 459)  -- World of Coca-Cola, Bicycle Tours
AND NOT EXISTS (SELECT 1 FROM events WHERE venue_id = venues.id);
```

### Validation Query
```sql
-- Check remaining venues without coordinates
SELECT v.id, v.name, v.address, COUNT(e.id) as event_count
FROM venues v
LEFT JOIN events e ON v.id = e.venue_id
WHERE v.lat IS NULL OR v.lng IS NULL
GROUP BY v.id, v.name, v.address
ORDER BY event_count DESC;
```

**Expected:** 0 rows after fixes.

---

## Additional Observations

### Good News
✅ No price inconsistencies (price_min > price_max)  
✅ All events have categories  
✅ No low-confidence extractions (<0.7)  
✅ Minimal suspicious midnight times (only 3 events)

### Suspicious Midnight Times
Only 3 events show midnight start times for non-nightlife categories (art exhibitions from Access Atlanta). These may be:
- All-day exhibitions that should have `is_all_day=true`
- Missing time data from source

**Recommended Fix:** Update Access Atlanta crawler to set `is_all_day=true` for exhibitions/gallery shows.

---

## Implementation Priority

1. **Immediate (Today):**
   - Fix 'soup' variable errors (5 min per file = 25 min total)
   - Mark 404 sources as inactive (prevents error spam)

2. **High Priority (This Week):**
   - Implement virtual venue for online events (30 min)
   - Update Eventbrite + Meetup crawlers to use virtual venue (1 hour)
   - Run geocoding script for missing coordinates (15 min)

3. **Medium Priority (Next Week):**
   - Investigate and fix 404 sources (find new URLs)
   - Handle Georgia State Athletics away games properly
   - Clean up unused venues

---

## Monitoring & Prevention

### Add Data Quality Checks to CI/CD
```bash
# Run after each crawl
python data_quality_audit.py > audit_$(date +%Y%m%d).txt

# Alert if critical issues exceed threshold
if [ $(grep "missing critical fields" audit.txt | grep -oE '[0-9]+' | head -1) -gt 50 ]; then
    echo "ALERT: >50 events missing critical fields"
fi
```

### Crawler Template Checklist
When creating new crawlers:
- [ ] Don't reference `soup` if not actually parsing HTML
- [ ] Always provide `venue_id` (use virtual venue if needed)
- [ ] Include `extraction_confidence` appropriate to source
- [ ] Test URL accessibility before committing

---

## Contact & Next Steps

**Data Quality Specialist:** Available for fix implementation  
**Crawler Dev:** Coordinate on venue handling strategy  
**DevOps:** Schedule geocoding script to run weekly

**Next Audit:** Run again after fixes applied to verify 0 critical issues remain.
