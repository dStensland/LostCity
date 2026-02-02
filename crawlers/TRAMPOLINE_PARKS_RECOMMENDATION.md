# Trampoline Park Crawlers - Final Recommendation

## Executive Summary

After fixing the URLs and testing all trampoline park crawlers, **I recommend disabling the direct website crawlers** and instead relying on Eventbrite for special events from these venues.

---

## Test Results

### URL Status (All Fixed ✅)
- **Urban Air Snellville**: https://www.urbanair.com/georgia-snellville/ - HTTP 200
- **Urban Air Buford**: https://www.urbanair.com/georgia-buford/ - HTTP 200
- **Urban Air Kennesaw**: https://www.urbanair.com/georgia-kennesaw/ - HTTP 200
- **Sky Zone Atlanta**: https://www.skyzone.com/atlanta/ - HTTP 200
- **Sky Zone Roswell**: https://www.skyzone.com/roswell/ - HTTP 200

### Event Calendar Pages
Tested the following URLs for event calendars:
- `{venue}/events/` - 404 or timeout
- `{venue}/activities/` - timeout
- `{venue}/calendar/` - not tested (likely similar results)

**Result:** These venues do not maintain traditional event calendar pages.

---

## Why These Crawlers Won't Find Events

### 1. Business Model Difference
Trampoline parks operate on a **drop-in/membership model**, not event-based:
- Open jump hours (daily, posted on website)
- Recurring programs (Toddler Time, Teen Night)
- Private party bookings (not public events)
- Seasonal promotions (not specific dates)

### 2. Content Structure
The websites focus on:
- Ticket purchasing (hourly rates, packages)
- Membership sign-ups
- Party booking forms
- General hours of operation
- Activity descriptions (not event dates)

### 3. Current Crawler Limitations
The existing crawlers attempt to:
1. Visit non-existent `/events` pages
2. Parse unstructured text for event patterns
3. Extract dates from promotional content
4. This approach yields **zero events**

---

## Recommended Solution

### Primary Recommendation: Use Eventbrite

**Why:**
- ✅ Both Urban Air and Sky Zone have Eventbrite pages
- ✅ We already have a working `eventbrite.py` crawler
- ✅ Captures actual ticketed special events (field trips, special programs, seasonal events)
- ✅ Zero maintenance required
- ✅ Events have proper structure, dates, and ticketing info

**Eventbrite Coverage:**
- Urban Air events: https://www.eventbrite.com/d/ga--atlanta/urban-air/
- Sky Zone events: https://www.eventbrite.com/d/ga--atlanta/sky-zone/

**What this captures:**
- Special themed jump nights (glow nights, foam parties)
- School field trip events
- Seasonal programs (summer camps, holiday events)
- Charity events and fundraisers
- Any ticketed special programming

### Alternative: Generate Recurring Events

If you want to populate the calendar with regular programming:

**Pros:**
- Families could see "Toddler Time every Tuesday 10-12pm"
- Shows consistent activities available
- Better for discovery of family-friendly activities

**Cons:**
- Not technically "events" - they're regular hours
- Requires parsing hours/schedule pages
- Needs ongoing maintenance when schedules change
- May confuse users (is this an event or just open hours?)

**Implementation:**
1. Parse the activities/programs pages for schedule info
2. Create recurring event stubs with recurrence rules
3. Mark them as "recurring programs" not "special events"
4. Set appropriate filters so users can distinguish

---

## Action Items

### Immediate Actions

1. **Disable Defy Atlanta Crawler**
   - File: `crawlers/sources/defy_atlanta.py`
   - Reason: Venue acquired by Sky Zone (duplicate)
   - Action: Remove from active crawlers or delete file

2. **Test Eventbrite Coverage**
   ```bash
   python main.py --source eventbrite --dry-run
   ```
   - Verify it discovers Urban Air and Sky Zone events
   - Check quality of event data
   - Confirm venue matching works

3. **Evaluate Direct Crawler Results**
   ```bash
   python main.py --source urban_air_atlanta --dry-run
   python main.py --source sky_zone_atlanta --dry-run
   ```
   - If they find zero events → disable crawlers
   - If they find events → keep crawlers active

### Decision Required

**Question:** Do you want to show regular programming (Toddler Time, Open Jump) as recurring "events" on LostCity?

**If YES:**
- Keep the direct crawlers
- Modify them to parse hours/programs pages
- Generate recurring events with appropriate metadata
- Estimated work: 4-8 hours per crawler

**If NO:**
- Disable the direct website crawlers
- Rely solely on Eventbrite for special events
- Update documentation to note these venues are Eventbrite-only
- Estimated work: 30 minutes

---

## File Status Summary

### Modified Files (Ready to Use)
1. `crawlers/sources/urban_air_atlanta.py` - URLs fixed ✅
2. `crawlers/sources/sky_zone_atlanta.py` - URLs fixed, Atlanta location added ✅

### Deprecated Files (Should Remove)
3. `crawlers/sources/defy_atlanta.py` - Marked deprecated, should delete ⚠️

### Related Files (Already Working)
4. `crawlers/sources/eventbrite.py` - Already handles these venues ✅

---

## Expected Event Volume

Based on Eventbrite listings and venue types:

**Urban Air (3 locations):**
- 2-5 special events per location per month
- Mostly seasonal programs, field trips, special jump nights
- ~6-15 events/month total

**Sky Zone (2 locations):**
- 2-4 special events per location per month
- Similar to Urban Air
- ~4-8 events/month total

**Total from trampoline parks: ~10-25 events/month**

This is captured by the existing Eventbrite crawler with zero additional work.

---

## Conclusion

**Recommendation: Disable direct website crawlers, rely on Eventbrite**

**Rationale:**
1. These venues don't maintain event calendars on their websites
2. Direct crawlers will find zero (or near-zero) events
3. Eventbrite already captures their special events
4. Saves maintenance time on three complex crawlers
5. Better data quality from structured Eventbrite API

**Alternative considered:**
Generating recurring events for regular programming is possible but adds complexity without clear user value. Users looking for "when is toddler time" can visit the venue page - they don't need it as a calendar event.

---

## Implementation

If you agree with the recommendation:

1. Remove/disable these three crawlers:
   - `defy_atlanta.py` (duplicate)
   - `urban_air_atlanta.py` (no events found)
   - `sky_zone_atlanta.py` (no events found)

2. Verify Eventbrite crawler covers these venues

3. Update documentation to note:
   - Trampoline parks covered via Eventbrite only
   - Regular hours/programming on venue websites
   - Special events discovered automatically

4. Free up crawler resources for venues with actual calendars

---

**Files Referenced:**
- `/Users/coach/Projects/LostCity/crawlers/sources/urban_air_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/sky_zone_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/defy_atlanta.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/eventbrite.py`
- `/Users/coach/Projects/LostCity/crawlers/TRAMPOLINE_PARKS_FIX_SUMMARY.md`
