# Data Quality Fixes - Priority List

## Immediate Fixes (25 minutes total)

### 1. Fix 'soup' NameError (5 crawlers)
**Time:** 5 min per file = 25 min total  
**Impact:** Eliminates 100% error rate on 5 sources

**Files to edit:**
- `/Users/coach/Projects/LostCity/crawlers/sources/bookish_atlanta.py:133`
- `/Users/coach/Projects/LostCity/crawlers/sources/atlanta_cultural_affairs.py:115`
- `/Users/coach/Projects/LostCity/crawlers/sources/wild_aster_books.py` (find line with soup)
- `/Users/coach/Projects/LostCity/crawlers/sources/sun_dial_restaurant.py` (find line with soup)
- `/Users/coach/Projects/LostCity/crawlers/sources/kats_cafe.py` (find line with soup)

**Change:**
```python
# OLD:
"image_url": extract_image_url(soup) if soup else None,

# NEW:
"image_url": None,
```

**Verification:**
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python main.py -s bookish-atlanta
python main.py -s atlanta-cultural-affairs
# Should complete without NameError
```

---

## High Priority Fixes (2 hours total)

### 2. Create Virtual Venue System (30 min)
**Impact:** Fixes 357 events missing venue_id (36% of database)

**Step 1:** Add function to `/Users/coach/Projects/LostCity/crawlers/db.py`
```python
def get_or_create_virtual_venue() -> int:
    """Get or create the standard 'Online/Virtual' venue for remote events."""
    client = get_client()
    
    result = client.table("venues").select("id").eq("slug", "online-virtual").execute()
    if result.data and len(result.data) > 0:
        return result.data[0]["id"]
    
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

### 3. Update Eventbrite Crawler (30 min)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py:226-241`

Add fallback to virtual venue:
```python
if venue_info and venue_info.get("name"):
    venue_record = {...}
    try:
        venue_id = get_or_create_venue(venue_record)
    except Exception as e:
        logger.warning(f"Failed to create venue {venue_info['name']}: {e}")
        venue_id = get_or_create_virtual_venue()  # ADD THIS
else:
    venue_id = get_or_create_virtual_venue()  # ADD THIS
```

### 4. Update Meetup Crawler (30 min)
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/meetup.py`

Apply same pattern as Eventbrite above.

### 5. Run Geocoding for 20 Venues (15 min)
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python geocode_venues.py
```

**Verification:**
```sql
-- Should return 0
SELECT COUNT(*) FROM events WHERE venue_id IS NULL;

-- Should return 0
SELECT COUNT(*) FROM venues WHERE (lat IS NULL OR lng IS NULL) 
AND EXISTS (SELECT 1 FROM events WHERE venue_id = venues.id);
```

---

## Medium Priority (Next Week)

### 6. Fix 404 Sources
Investigate and update URLs for:
- Oglethorpe University
- Sports Social  
- Midway Pub

Or mark as inactive:
```sql
UPDATE sources SET is_active = false 
WHERE slug IN ('oglethorpe-university', 'sports-social', 'midway-pub');
```

### 7. Handle Georgia State Athletics Away Games
Parse venue from title or use virtual venue.

### 8. Fix Access Atlanta Midnight Times
Set `is_all_day=true` for exhibitions without specific times.

---

## Verification Checklist

After applying fixes, run:
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate
python data_quality_audit.py
```

**Expected results:**
- Events missing critical fields: **0** (down from 357)
- Recent crawl errors: **0** soup errors (down from 5 sources)
- Venues without coordinates: **0** with active events (down from 20)
- 404 errors: **0** (sources marked inactive or URLs fixed)

---

## Files Reference

**Key Files:**
- Data quality audit: `/Users/coach/Projects/LostCity/crawlers/data_quality_audit.py`
- Full report: `/Users/coach/Projects/LostCity/DATA_QUALITY_REPORT.md`
- Database ops: `/Users/coach/Projects/LostCity/crawlers/db.py`
- Eventbrite crawler: `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py`
- Meetup crawler: `/Users/coach/Projects/LostCity/crawlers/sources/meetup.py`
- Schema: `/Users/coach/Projects/LostCity/database/schema.sql`
