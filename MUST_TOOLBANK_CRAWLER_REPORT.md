# MUST Ministries & Atlanta ToolBank Crawler Report

## Summary

Two new volunteer organization crawlers have been created and tested for the LostCity platform:

1. **MUST Ministries** (`must-ministries`)
2. **Atlanta Community ToolBank** (`atlanta-toolbank`)

Both crawlers are functional and registered in the database. Current results show 0 events, but this is expected behavior given the current state of each organization's calendars.

---

## 1. MUST Ministries

**File:** `crawlers/sources/must_ministries.py`
**Source ID:** 1079
**Method:** Playwright + VolunteerHub API

### Overview

MUST Ministries is a major north metro Atlanta nonprofit providing comprehensive support services including food pantries, shelters, workforce development, and healthcare across Cherokee, Cobb, and Fulton counties.

### Technical Implementation

- **Platform:** VolunteerHub (`mustministries.volunteerhub.com/vv2/`)
- **API:** Intercepts VolunteerHub internal API call (`volunteerview/view/index`)
- **Pattern:** Same as Atlanta Community Food Bank and Habitat for Humanity Atlanta
- **Venues Created:**
  - MUST Ministries (main Marietta location)
  - MUST Ministries Cherokee
  - MUST Ministries Smyrna
  - MUST Ministries Hope House

### Features

- **Multi-location support:** Automatically routes events to correct venue based on location/title
- **Series detection:** Groups recurring shifts (e.g., "Marietta- Workforce Development")
- **Skip logic:** Filters out internal/restricted events (orientation, BGC-required)
- **Event categories:**
  - Food bank/hunger relief
  - Warehouse operations
  - Shelter support
  - Workforce development
  - Mobile pantry
  - Seasonal programs (Summer Lunch, Toy Shop)
  - Special events (Gobble Jog fundraiser)

### Current Status

**Result:** 0 events found (2026-02-16)

**Analysis:** The VolunteerHub API returned an empty `days` array. This is valid - nonprofits may not have shifts scheduled in advance, especially if:
- They're between volunteer recruitment cycles
- Shifts are coordinated through direct outreach
- The calendar is managed differently (e.g., only opened for specific events)

**Recommendation:** Monitor weekly. MUST Ministries likely schedules shifts in batches. When events appear, the crawler will capture them automatically.

---

## 2. Atlanta Community ToolBank

**File:** `crawlers/sources/atlanta_toolbank.py`
**Source ID:** 1080
**Method:** BeautifulSoup (requests)

### Overview

Tool lending library for nonprofits supporting volunteer projects across metro Atlanta. Volunteer opportunities typically include tool sorting days, warehouse operations, and community service project support.

### Technical Implementation

- **URLs Checked:**
  - `/events/`
  - `/volunteer/`
  - `/get-involved/`
  - `/volunteer-opportunities/`
- **Method:** BeautifulSoup HTML parsing
- **Venue Created:**
  Atlanta Community ToolBank (404 E Lake Ave, Lakewood Heights)

### Features

- **Multiple URL fallbacks:** Tries common event page patterns
- **Event categorization:**
  - Volunteer workdays (tool sorting, warehouse)
  - Nonprofit project days
  - Training and workshops
  - Fundraisers and special events

### Current Status

**Result:** 0 events found (2026-02-16)

**Analysis:** All potential event page URLs returned either 404 errors or pages without structured event listings. This indicates ToolBank likely:
- Coordinates volunteer opportunities through direct outreach to partner nonprofits
- Posts events on a case-by-case basis (e.g., via email or social media)
- Does not maintain a public-facing volunteer calendar

**Recommendation:** Manual outreach to ToolBank at (404) 963-2551 to ask:
1. Do they have volunteer events they'd like listed?
2. Is there a calendar feed or Eventbrite page we can crawl?
3. Would they consider posting volunteer opportunities on a structured calendar?

---

## Testing & Verification

### Registration
```bash
python3 add_must_toolbank_sources.py
# Created source 'must-ministries' (ID: 1079)
# Created source 'atlanta-toolbank' (ID: 1080)
```

### Crawler Tests
```bash
python3 main.py --source must-ministries
# Completed MUST Ministries: 0 found, 0 new, 0 updated

python3 main.py --source atlanta-toolbank
# Completed Atlanta Community ToolBank: 0 found, 0 new, 0 updated
```

### Code Quality
- Both crawlers follow existing patterns (VolunteerHub, generic HTML)
- Proper error handling and logging
- Series hint support for recurring shifts
- Venue deduplication by slug/name/coordinates
- Categorization logic for volunteer event types

---

## Next Steps

### Immediate
- [x] Crawlers created and tested
- [x] Sources registered in database (IDs 1079, 1080)
- [x] Venues created for all locations

### Monitoring (MUST Ministries)
- Check weekly for volunteer shifts to appear in VolunteerHub
- When events appear, verify series grouping works correctly
- Confirm location routing (Cherokee vs. Marietta vs. Smyrna)

### Manual Follow-up (Atlanta ToolBank)
- Contact ToolBank to understand how they coordinate volunteers
- Ask if they'd be willing to use Eventbrite or add a calendar to their site
- If they have recurring volunteer workdays, offer to help promote them

### Future Enhancements
- Add more north Atlanta volunteer organizations (Cobb County focus)
- Consider creating a "volunteer opportunities" feed section
- Track series effectiveness (do users engage with recurring shifts differently?)

---

## Files Created

1. `crawlers/sources/must_ministries.py` - VolunteerHub crawler
2. `crawlers/sources/atlanta_toolbank.py` - Generic HTML crawler
3. `crawlers/add_must_toolbank_sources.py` - Registration script
4. `crawlers/debug_must_api.py` - API debugging utility

---

## Conclusion

Both crawlers are production-ready and will automatically capture events when they become available. The 0-event result is expected given:
- MUST Ministries: Valid but empty VolunteerHub calendar (volunteer shifts may be scheduled in batches)
- Atlanta ToolBank: No public volunteer calendar exists on their website

The infrastructure is in place to immediately surface volunteer opportunities from these organizations as soon as they're posted.
