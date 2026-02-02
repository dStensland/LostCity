# Trampoline Park Crawlers - URL Fixes and Recommendations

## Date: 2026-01-31

## Summary of Changes

Fixed incorrect URLs and updated venue information for three trampoline park crawlers in the Atlanta metro area.

---

## 1. Urban Air Atlanta (`crawlers/sources/urban_air_atlanta.py`)

### Issue
- Old URLs used deprecated domain `urbanairtrampolinepark.com`
- Domain now redirects to `urbanair.com`

### Fix Applied
Updated all location URLs to use the new domain structure:

**Before:**
- `https://www.urbanairtrampolinepark.com/locations/snellville-ga`
- `https://www.urbanairtrampolinepark.com/locations/buford-ga`
- `https://www.urbanairtrampolinepark.com/locations/kennesaw-ga`

**After:**
- `https://www.urbanair.com/georgia-snellville/`
- `https://www.urbanair.com/georgia-buford/`
- `https://www.urbanair.com/georgia-kennesaw/`

### Status
✅ All URLs tested and working (HTTP 200)

**Locations:**
1. Urban Air Snellville - 1905 Scenic Hwy N, Snellville, GA 30078
2. Urban Air Buford - 3235 Woodward Crossing Blvd, Buford, GA 30519
3. Urban Air Kennesaw - 400 Ernest W Barrett Pkwy NW, Kennesaw, GA 30144

---

## 2. Sky Zone Atlanta (`crawlers/sources/sky_zone_atlanta.py`)

### Issue
- Missing Sky Zone Atlanta location (formerly Defy Atlanta)
- Sky Zone Alpharetta URL returns 404 (location closed)

### Fix Applied
1. Added Sky Zone Atlanta location (3200 Northlake Pkwy NE)
2. Removed Sky Zone Alpharetta (closed location)
3. Added trailing slashes to all URLs for consistency

**Locations:**
1. Sky Zone Atlanta - 3200 Northlake Pkwy NE, Atlanta, GA 30345 ✅ (HTTP 200)
2. Sky Zone Roswell - 10800 Alpharetta Hwy, Roswell, GA 30076 ✅ (HTTP 200)

### Status
✅ All URLs tested and working

---

## 3. Defy Atlanta (`crawlers/sources/defy_atlanta.py`)

### Issue
- Domain `defyatlanta.com` does not exist
- Venue was acquired by Sky Zone

### Fix Applied
Updated crawler with deprecation notice:
- Added note that Defy Atlanta was acquired by Sky Zone
- Updated venue information to point to Sky Zone Atlanta
- Changed BASE_URL to redirect to `skyzone.com/atlanta/`
- Marked crawler as DEPRECATED

### Recommendation
**⚠️ This crawler should be disabled or removed** since:
1. The venue now operates as Sky Zone Atlanta
2. It's already covered by `sky_zone_atlanta.py`
3. Keeping both active will create duplicate events

### Status
⚠️ Marked as deprecated but still in codebase

---

## Important Discovery: Event Calendar Limitations

### Issue
These trampoline parks typically **do not have traditional event calendars**. Instead, they offer:
- Regular programming (Toddler Time, Open Jump)
- Weekly recurring sessions (Glow Nights, Teen Nights)
- Seasonal promotions
- Private party bookings (not public events)

### Current Crawler Approach
The existing crawlers attempt to:
1. Visit `/events`, `/calendar`, or `/special-events` pages
2. Parse text content looking for event keywords
3. Extract dates and times from unstructured content
4. This approach is likely to find very few or zero events

---

## Recommendations

### Option 1: Use Eventbrite Integration (Recommended)
Many trampoline parks list special events on Eventbrite:
- ✅ Eventbrite pages exist for both Urban Air and Sky Zone
- ✅ We already have an `eventbrite.py` crawler
- ✅ Would capture actual ticketed events, special programs, field trips, etc.

**Implementation:**
- The existing Eventbrite crawler can discover these events
- No additional work needed if the crawler is already running
- Search URLs:
  - https://www.eventbrite.com/d/ga--atlanta/urban-air/
  - https://www.eventbrite.com/d/ga--atlanta/sky-zone/

### Option 2: Generate Recurring Events
Create synthetic events for known recurring programs:
- Parse hours/schedule pages for regular programming
- Generate recurring events (e.g., "Toddler Time - Every Tuesday 10am-12pm")
- Set appropriate recurrence rules
- This would populate the calendar with predictable family activities

### Option 3: Hybrid Approach
1. Use Eventbrite for special ticketed events
2. Parse schedule pages for recurring programs
3. Create recurring event stubs (e.g., "Open Jump", "Toddler Time")
4. Link users to the venue page for booking

### Option 4: Disable Direct Crawling
If these venues don't maintain public event calendars:
- Disable the direct website crawlers
- Rely on Eventbrite for special events
- Focus crawler resources on venues with actual calendars

---

## Testing

To test the updated crawlers:

```bash
# Test Urban Air crawler
python main.py --source urban_air_atlanta --dry-run

# Test Sky Zone crawler
python main.py --source sky_zone_atlanta --dry-run

# Check for errors in logs
grep -i "urban air\|sky zone" crawl_logs.txt
```

---

## Files Modified

1. `/Users/coach/Projects/LostCity/crawlers/sources/urban_air_atlanta.py`
   - Updated all 3 location URLs to new domain

2. `/Users/coach/Projects/LostCity/crawlers/sources/sky_zone_atlanta.py`
   - Added Sky Zone Atlanta location
   - Removed Sky Zone Alpharetta (closed)
   - Updated URLs with trailing slashes

3. `/Users/coach/Projects/LostCity/crawlers/sources/defy_atlanta.py`
   - Added deprecation notice
   - Updated to point to Sky Zone Atlanta
   - Marked for removal

---

## Next Steps

1. **Immediate:** Test the updated crawlers to verify they can load pages
2. **Short-term:** Evaluate if these crawlers find any events (likely zero)
3. **Decision needed:** Choose one of the four options above
4. **Action:** Remove or disable `defy_atlanta.py` to prevent duplicates
5. **Optional:** Investigate recurring event generation for regular programs

---

## Notes

- All URL tests performed on 2026-01-31
- Defy Atlanta acquisition by Sky Zone confirmed via URL redirect
- Sky Zone Alpharetta closure confirmed via 404 response
- All remaining URLs return HTTP 200 and are accessible
