# College Park / Airport District Coverage Summary

**Date:** 2026-01-31  
**Status:** CRITICAL GAPS - 95% of destinations missing

---

## TL;DR

The Airport District (College Park, East Point, Hapeville) is severely underrepresented in LostCity:
- Only **14 venues** vs 60,000+ residents
- Only **22 upcoming events** (9 are basketball games, 7 are library crafts)
- **ZERO dedicated crawlers** for the area
- **ALL curator-identified venues are missing** (Virgil's Gullah Kitchen, The Breakfast Boys, Brake Pad)
- **8x worse coverage** than Decatur despite larger population

---

## What We Have

### Venues (14 total):
**Event Venues with Activity:**
- Gateway Center Arena - 9 events (Skyhawks basketball)
- Georgia International Convention Center - 3 events (conventions)
- College Park Library - 3 events (kids crafts)
- East Point Library - 3 events (crafts, classes)
- Hapeville Library - 1 event (exercise)
- Central Station ATL - 1 event (nightclub)
- The Crown Room - 2 events (dinners)

**Destinations (No Events):**
- 3 Waffle Houses
- 1 ArtsXchange (duplicate entries - needs fixing)
- 1 Dave's Sports Bar
- 1 For Keeps Bookstore (wrong location?)

### What's Missing (ALL of these):
- Virgil's Gullah Kitchen & Bar
- The Breakfast Boys
- Brake Pad
- ~30 restaurants
- ~15 bars/breweries
- ~12 parks (including Dick Lane Velodrome - world-class cycling venue)
- ~8 cultural venues
- ~20 community centers/churches
- ~15 shopping/retail destinations

---

## Critical Data Quality Issues

1. **ArtsXchange duplicate** - Two venue entries (ID 780 and 83) for same place
2. **For Keeps Bookstore location error** - Listed as "Downtown" but address is Auburn Ave
3. **Zero dedicated crawlers** - All events from aggregators or manual entry
4. **Missing metadata** - Most venues lack spot_types, vibes, hours, descriptions
5. **No recurring events** - Library programs and sports games not recognized as series

---

## Immediate Actions Required

### Week 1:
1. Research and add 3 curator venues (Virgil's, Breakfast Boys, Brake Pad)
2. Fix ArtsXchange duplicate (consolidate to one record)
3. Verify For Keeps Bookstore actual location
4. Create City of College Park crawler
5. Add Dick Lane Velodrome (world-class venue)

### Week 2-4:
6. Add 12 major parks
7. Add 15 essential restaurants
8. Create East Point and Hapeville city crawlers
9. Add spot_types/vibes to existing venues
10. Expand library event capture (recurring programs)

---

## Why This Matters

**Demographics:** 60,000 residents + airport workers/visitors  
**Cultural Significance:** Gullah/Geechee heritage, historic African American communities  
**Tourist Draw:** World's busiest airport, Gateway Center Arena, GICC conventions  
**Current Gap:** Southside Atlanta severely underrepresented on all portals

---

## Comparison: Airport District vs Decatur

| What | Airport District | Decatur | Gap |
|------|------------------|---------|-----|
| Population | ~60,000 | ~25,000 | 2.4x larger |
| Venues | 14 | 41 | -66% |
| Upcoming Events | 22 | 177 | -88% |
| Crawlers | 0 | 5 | Missing all |
| Food/Drink Venues | 3 | 18 | -83% |

**Verdict:** Airport District is **severely underrepresented** despite being 2.4x larger than Decatur.

---

## Success Targets (6 months)

- Venues: 14 → **80+** (add 65)
- Events: 22 → **150+** (add 130)
- Crawlers: 0 → **8+** (add 8)
- Food/Drink: 3 → **35+** (add 32)
- Parks: 0 → **12+** (add 12)

---

## Files

**Full Analysis:** `/Users/coach/Projects/LostCity/COLLEGE_PARK_AIRPORT_DISTRICT_GAP_ANALYSIS.md`  
**This Summary:** `/Users/coach/Projects/LostCity/COLLEGE_PARK_COVERAGE_SUMMARY.md`

**Crawlers to Build:**
- `crawlers/sources/college_park_city.py`
- `crawlers/sources/east_point_city.py`
- `crawlers/sources/hapeville_city.py`
- `crawlers/sources/dick_lane_velodrome.py`

**Data Fixes Needed:**
- Consolidate ArtsXchange duplicate venues
- Fix For Keeps Bookstore location
- Add metadata to 14 existing venues
