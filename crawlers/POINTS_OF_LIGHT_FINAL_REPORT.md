# Points of Light - Final Crawler Report

**Date**: 2026-02-16
**Status**: NO CRAWLER NEEDED
**Action Taken**: Created reference venue record only

---

## Executive Summary

Points of Light does **not** require a dedicated crawler. Their national/corporate events are not relevant to Atlanta users, and their local volunteer work is already comprehensively covered by our existing **Hands On Atlanta** crawler (Source ID 13).

---

## Research Findings

### Points of Light Organization

- **Type**: National/international volunteer coordination organization
- **HQ**: 101 Marietta Street NW, Suite 3100, Atlanta, GA 30303
- **Website**: https://www.pointsoflight.org
- **Venue Record**: Created as reference (Venue ID 4288)

### Event Inventory

Analyzed https://www.pointsoflight.org/events/ and found:

1. **National Conferences** (Washington, D.C.)
   - The George H.W. Bush Points of Light Awards (October)
   - Points of Light Conference (June)

2. **Virtual Webinars** (Online only)
   - "Building AI Confidence Across the Social Impact Sector" (Feb 25)
   - Corporate training and nonprofit professional development

3. **Awareness Campaigns** (Not physical events)
   - National Volunteer Week (April)
   - Global Volunteer Month
   - Days of Service

**Result**: Zero Atlanta-specific public events found.

### Checked Platforms

- **Website Events Page**: No local Atlanta events
- **Eventbrite**: No organizer page found
- **Engage Platform** (engage.pointsoflight.org): National volunteer search, not Atlanta-specific

---

## Hands On Atlanta Coverage

We already have comprehensive Atlanta volunteer coverage via:

**Source**: hands-on-atlanta (ID 13)
**Status**: Active, daily crawl frequency
**Crawler**: `/Users/coach/Projects/LostCity/crawlers/sources/hands_on_atlanta.py`

### Recent Test Results (2026-02-16)

```
✓ Crawler ran successfully
✓ 25 opportunities found
✓ 12 new events inserted
✓ 13 existing events updated
```

### Sample Events Captured

- Volunteer: Meal Delivery to Seniors
- Volunteer: Food Pantry Volunteer
- Volunteer: Mentorship & Homework Helpers
- Volunteer: Art Scholars Camp for Title I Students
- Volunteer: Hawk Hollow Garden
- Volunteer: The Shop of Hope - Donation sorting for refugees
- Volunteer: Canaan Farms workday
- And many more...

All categorized as `category: community` with `subcategory: volunteer` tags.

---

## Organizational Relationship

**Points of Light** is the national parent organization.
**Hands On Atlanta** is their local affiliate handling ground-level volunteer coordination.

All volunteer opportunities that would appear on a hypothetical Points of Light Atlanta calendar are instead published through Hands On Atlanta's volunteer.handsonatlanta.org platform, which we already crawl.

---

## Decision Rationale

### Why No Crawler Needed

1. **No crawlable event feed** - Points of Light website has no Atlanta-specific events
2. **No API** - No public API for local events
3. **No Eventbrite** - Not using Eventbrite for event publishing
4. **Work flows through affiliate** - All local volunteer work goes through Hands On Atlanta
5. **Existing coverage is comprehensive** - hands-on-atlanta crawler captures everything

### Why We Created a Venue Record

- Points of Light HQ is a legitimate Atlanta organization
- Provides reference point for the national organization
- May host occasional corporate events in the future
- Venue type: "organization" (not crawlable, reference only)

---

## Recommendations

### Immediate Actions

- **Do NOT create** a points-of-light crawler
- **Keep active** hands-on-atlanta crawler (already running daily)
- **Monitor** Hands On Atlanta data quality in monthly reviews

### Future Monitoring

If Points of Light ever launches an Atlanta-specific public event series:
1. Check their website quarterly for new local programming
2. Set up a lightweight monitoring script
3. Consider adding crawler if they publish 10+ local events/month

### Related Sources

Consider these other Atlanta volunteer platforms if not already crawled:
- **VolunteerMatch** (volunteerMatch.org) - Has Atlanta opportunities
- **Serve.Atlanta** (city of Atlanta volunteer portal)
- **United Way of Greater Atlanta** - Volunteer opportunities

---

## Files Created

1. **Venue Record**: Points of Light (ID 4288)
   - `/Users/coach/Projects/LostCity/crawlers/db.py` (via get_or_create_venue)

2. **Documentation**:
   - `/Users/coach/Projects/LostCity/crawlers/POINTS_OF_LIGHT_ANALYSIS.md`
   - `/Users/coach/Projects/LostCity/crawlers/POINTS_OF_LIGHT_FINAL_REPORT.md`

---

## Verification Commands

### Test Hands On Atlanta Crawler
```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source hands-on-atlanta
```

### Check Recent Volunteer Events
```python
from db import get_client

sb = get_client()
result = sb.table('events').select('*').eq('source_id', 13).gte('start_date', '2026-02-16').order('start_date').limit(20).execute()

for event in result.data:
    print(f"{event['start_date']} - {event['title']}")
```

### View Points of Light Venue
```python
from db import get_client

sb = get_client()
result = sb.table('venues').select('*').eq('id', 4288).execute()
print(result.data[0])
```

---

## Conclusion

**No action required.** The LostCity crawlers already have comprehensive coverage of Atlanta volunteer opportunities through the Hands On Atlanta crawler. Points of Light's national/corporate programming does not warrant a dedicated crawler. Venue record created for reference purposes.
