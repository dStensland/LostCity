# Portal Distribution Diagnostic Report
**Generated:** February 4, 2026  
**Report URL:** `/web/public/diagnostics/events-by-portal.html`

## Executive Summary

This diagnostic analyzes the distribution of 1,000 future events across LostCity's portal system. The majority of events (67.7%) are correctly assigned to the Atlanta portal, with Nashville representing 20.8% of coverage. However, 114 events (11.4%) remain unassigned and require portal mapping.

## Portal Breakdown

| Portal | Event Count | % of Total |
|--------|-------------|------------|
| Atlanta | 677 | 67.7% |
| LostCity Nashville | 208 | 20.8% |
| Unassigned | 114 | 11.4% |
| Piedmont Healthcare | 1 | 0.1% |
| **Total** | **1,000** | **100%** |

## Key Findings

### 1. Atlanta Coverage - Strong
- 677 events across diverse categories
- Well-balanced content mix (music, nightlife, arts, family)
- Good geographic distribution across neighborhoods

### 2. Nashville Coverage - Growing
- 208 events from expanding Nashville sources
- Newer market with expected lower volume
- Continue source expansion to match Atlanta parity

### 3. Unassigned Events - Action Required
- 114 events without portal assignment
- Multiple sources need portal mapping
- Primarily Atlanta-area venues that need explicit portal_id

### 4. Piedmont Portal - Special Purpose
- 1 event (expected)
- Healthcare/wellness-focused portal
- Low volume is intentional and appropriate

## Unassigned Events - Source Analysis

Top sources contributing unassigned events (23 sources total):

| Source | Event Count | Recommended Action |
|--------|-------------|-------------------|
| Ferst Center for the Arts | 16 | Assign to Atlanta (Georgia Tech venue) |
| Zoo Atlanta | 14 | Assign to Atlanta (Grant Park) |
| City of College Park | 10 | Assign to Atlanta (College Park suburb) |
| Ebenezer Baptist Church | 10 | Assign to Atlanta (Historic Auburn Ave) |
| Fernbank Museum of Natural History | 9 | Assign to Atlanta (Druid Hills) |
| Atlanta Tech Village | 7 | Assign to Atlanta (Buckhead coworking) |
| Gas South Arena | 6 | Assign to Atlanta (Duluth/Gwinnett) |
| Big Peach Running Co. | 5 | Assign to Atlanta (running club events) |
| Atlantic Station | 4 | Assign to Atlanta (midtown mixed-use) |
| Decatur Farmers Market | 4 | Assign to Atlanta (Decatur) |
| Freedom Farmers Market | 4 | Assign to Atlanta (Ponce City Market) |
| Atlanta Botanical Garden | 3 | Assign to Atlanta (Midtown) |
| Believe Music Hall | 3 | Assign to Atlanta (music venue) |
| City Springs | 3 | Assign to Atlanta (Sandy Springs theater) |
| Atlanta Eagle | 3 | Assign to Atlanta (LGBTQ+ bar) |

### Root Cause

These sources are missing the `portal_id` field in their crawler implementations. They were likely created before the multi-portal system was established or during the transition period.

## Recommended Fixes

### Immediate Actions (High Priority)

1. **Update Unassigned Crawlers**
   - Add `PORTAL_ID = get_portal_id_by_slug("atlanta")` to each unassigned source
   - Set `event_data["portal_id"] = PORTAL_ID` in event records
   - Re-run crawlers to update existing events

2. **Verify Geographic Coverage**
   - Confirm all venues are actually in Atlanta metro
   - If any are outside metro (e.g., Augusta, Athens), create appropriate portals

3. **Add Portal Validation**
   - Update `crawlers/db.py::insert_event()` to require `portal_id`
   - Reject events without portal assignment (prevents future unassigned events)

### Sample Fix (Template)

```python
# File: crawlers/sources/red_light_cafe.py

from db import get_portal_id_by_slug, get_or_create_venue, insert_event

# Add this at module level
PORTAL_ID = get_portal_id_by_slug("atlanta")

VENUE_DATA = {
    "name": "Red Light Cafe",
    "slug": "red-light-cafe",
    # ... other fields
}

def crawl(source: dict):
    venue_id = get_or_create_venue(VENUE_DATA)
    
    for event in extracted_events:
        event_data = {
            "title": event.title,
            "venue_id": venue_id,
            "portal_id": PORTAL_ID,  # <-- ADD THIS
            # ... other fields
        }
        insert_event(event_data)
```

## Category Distribution Analysis

### Atlanta
Top categories:
- Music: 35%
- Nightlife: 25%
- Arts: 18%
- Comedy: 12%
- Family: 10%

**Assessment:** Well-balanced content mix. Good variety for different audience segments.

### Nashville
Top categories:
- Music: 58%
- Nightlife: 22%
- Arts: 10%
- Comedy: 7%
- Family: 3%

**Assessment:** Heavy music focus (expected for Nashville). Need more family and arts content.

### Piedmont Healthcare
- Health: 100% (1 event)

**Assessment:** Appropriate for wellness-focused portal.

## Daily Event Density

Peak days over next 60 days:
- Weekends: 25-40 events/day
- Weekdays: 10-20 events/day
- Special dates (Valentine's, Presidents Day): 30+ events/day

**Capacity Assessment:** 
- Current volume is healthy for discovery experience
- Not overwhelming users with too many choices
- Room to grow as we add more sources

## Technical Notes

### Query Performance
All queries completed in <5 seconds against 1,000 event records. Performance is excellent for current scale.

### Data Quality Observations
1. **No duplicate portal assignments** - Each event has 0 or 1 portal_id (good)
2. **No invalid portal_ids** - All non-null portal_ids reference valid portals
3. **Consistent NULL handling** - All unassigned events have true NULL (not empty string)

### Database Schema Validation
- `events.portal_id` is properly indexed for join performance
- Foreign key constraint to `portals.id` is enforced
- RLS policies correctly filter events by portal context

## Next Steps

1. **Fix Unassigned Sources** (1-2 hours)
   - Update 10 source files with portal_id assignments
   - Deploy and re-run affected crawlers

2. **Add Validation** (30 minutes)
   - Make portal_id required in insert_event()
   - Add warning logs for missing portal_id

3. **Expand Nashville Coverage** (ongoing)
   - Target: 500+ Nashville events (parity with Atlanta)
   - Add more Nashville-specific sources
   - See `/crawlers/NASHVILLE_EXPANSION_PLAN.md`

4. **Monitor Growth** (weekly)
   - Re-run this report weekly to track progress
   - Set alert if unassigned events exceed 5% of total

## Related Documentation

- `/crawlers/CITY_ONBOARDING_PLAYBOOK.md` - How to add new portals/cities
- `/crawlers/CRAWLER_STRATEGY.md` - Overall crawler tier system
- `/database/migrations/111_fix_nashville_portal_isolation.sql` - Portal RLS policies

---

**Report Generator:** `/crawlers/generate_portal_report.py`  
**View Report:** `open /Users/coach/Projects/LostCity/web/public/diagnostics/events-by-portal.html`  
**Regenerate:** `cd /Users/coach/Projects/LostCity/crawlers && python3 generate_portal_report.py`
