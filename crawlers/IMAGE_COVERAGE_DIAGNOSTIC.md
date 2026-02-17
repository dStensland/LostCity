# Image Coverage Diagnostic Report
**Generated:** 2026-02-14  
**Scope:** Upcoming events (start_date >= 2026-02-14)

## Executive Summary

**Overall Image Coverage: 55.2%** (2,570 of 4,655 upcoming events)

- **Sources analyzed:** 129 sources with 5+ upcoming events
- **Critical gap:** 2,085 events missing images
- **Biggest opportunities:** 
  - 25 sources with 0% coverage (1,752 events)
  - 14 additional sources with <25% coverage (333 events)
  - 5 high-traffic venues with images available for fallback (1,023 events)

---

## Critical Issues by Category

### 1. Support Group Events (No Images Expected)
**Status:** Working as designed  
**Volume:** ~991+ events (AA, NA support groups)

**Sources:**
- Alcoholics Anonymous - Atlanta: 745 events
- Narcotics Anonymous - Georgia: 246 events
- GriefShare Atlanta: 13 events
- DivorceCare Atlanta: 12 events

**Recommendation:** These are `is_sensitive=true` events; no image is correct behavior.

---

### 2. High-Volume Venues Missing Crawler Image Extraction

**Issue:** Major cultural venues with 0% image coverage  
**Root Cause:** Crawlers not extracting event images from source pages

#### 2a. Callanwolde Fine Arts Center
- **Volume:** 315 events (0% coverage)
- **Venue has image:** YES ✓
- **Fix:** Update `sources/callanwolde_fine_arts_center.py` to extract event images from class/event pages
- **Fallback:** Can immediately use venue image for 606 imageless events at this venue

#### 2b. Marcus Jewish Community Center (MJCCA)
- **Volume:** 187 events (0% coverage)
- **Venue has image:** YES ✓
- **Fix:** Update `sources/mjcca.py` to extract program images
- **Fallback:** Can immediately use venue image for 278 imageless events at this venue

#### 2c. Emory Healthcare Community Events
- **Volume:** 58 events (0% coverage)
- **Venue has image:** Emory University has image ✓
- **Fix:** Add image extraction to `sources/emory_community_events.py`
- **Fallback:** Use Emory University venue image for 37 imageless events

#### 2d. Georgia World Congress Center
- **Volume:** 38 events (0% coverage)
- **Venue has image:** YES ✓
- **Fix:** Investigate event pages for og:image or hero images
- **Fallback:** Use venue image for 59 imageless events at GWCC

---

### 3. Cooking/Education Sources Missing Images

#### Cook's Warehouse
- **Volume:** 51 events (0% coverage)
- **Venue has image:** NO ✗
- **Issue:** Cooking class source with no image extraction
- **Fix:** 
  1. Scrape venue image from cookswarehouse.com
  2. Extract class images from individual class pages
  3. Consider using generic cooking/class placeholder if unavailable

---

### 4. Veteran & Community Support Sources

#### ATLVets (Advancing The Line)
- **Volume:** 48 events (0% coverage)
- **Venue has image:** NO ✗
- **Fix:** 
  1. Fetch venue image for ATLVets location
  2. Use org logo/branding as fallback
  3. Extract program-specific images if available

#### The Warrior Alliance
- **Volume:** 20 events (0% coverage)
- **Venue has image:** NO ✗
- **Fix:** Same as ATLVets

---

### 5. Religious/Community Event Sources

#### Central Presbyterian Church
- **Volume:** 19 events (0% coverage)
- **Venue has image:** YES ✓
- **Fix:** Use venue image as fallback immediately (43 imageless events)

---

### 6. Meetup Aggregator Issues

**Source:** Meetup  
**Volume:** 23 events (17.4% coverage — 19 missing)  
**Issue:** Only extracting images for some events  

**Fix:** Debug Meetup crawler image extraction logic — likely failing on certain event types or when images are behind authentication.

---

### 7. Mid-Coverage Sources Needing Improvement

#### Factory at Franklin (46.2%)
- 14 missing images out of 26 events
- Nashville music venue — likely missing artist images

#### Tabernacle (53.3%)
- 14 missing images out of 30 events
- Atlanta music venue — check Spotify integration

#### Zoo Atlanta (33.3%)
- 12 missing images out of 18 events
- Educational programs missing images

#### FanCons Georgia (45.5%)
- 6 missing images out of 11 events
- Convention events — check for guest/panel images

---

## Quick Wins: Venue Image Fallback

**Immediate Impact:** Add venue image fallback logic to `db.py::insert_event()`

Currently, 5 venues have images available that could serve as fallback for **1,023 imageless events**:

| Venue | Imageless Events | Has Venue Image |
|-------|------------------|-----------------|
| Callanwolde Fine Arts Center | 606 | ✓ |
| MJCCA | 278 | ✓ |
| Georgia World Congress Center | 59 | ✓ |
| Central Presbyterian Church | 43 | ✓ |
| Emory University | 37 | ✓ |

**Implementation:**
```python
# In db.py::insert_event(), before final insert:
if not event_data.get("image_url") and event_data.get("venue_id"):
    venue = get_venue_by_id_cached(event_data["venue_id"])
    if venue and venue.get("image_url"):
        event_data["image_url"] = venue["image_url"]
        event_data["image_source"] = "venue_fallback"
```

---

## Venues Missing Images (Need Enrichment)

**25 venues** with 3+ imageless events each have **NO venue image**. Total impact: ~1,300 events.

Most are recovery/support group meeting locations (clubs, churches) where images may not be appropriate or available. Consider:

1. Skip image enrichment for AA/NA club venues (expected to have no images)
2. For legitimate event venues (Cook's Warehouse, ATLVets, Roswell UMC), run:
   - `scrape_venue_images.py` for venues with websites
   - `fetch_venue_photos_google.py` for others

---

## Priority Action Items

### Immediate (This Week)
1. **Add venue image fallback** to `db.py::insert_event()` — fixes 1,023 events instantly
2. **Fix Callanwolde crawler** (`sources/callanwolde_fine_arts_center.py`) — 315 events
3. **Fix MJCCA crawler** (`sources/mjcca.py`) — 187 events

### Short-Term (Next Sprint)
4. **Emory Healthcare crawler** — add image extraction (58 events)
5. **Cook's Warehouse** — scrape venue image + extract class images (51 events)
6. **Meetup crawler** — debug image extraction (19 missing)
7. **Zoo Atlanta** — extract program images (12 missing)

### Medium-Term (Q1 2026)
8. **Music venue coverage** (Factory, Tabernacle) — verify Spotify integration
9. **Veteran org venues** — fetch venue images for ATLVets, Warrior Alliance
10. **Religious venues** — scrape images for Central Presbyterian, other churches

---

## Crawler Image Extraction Checklist

When updating a crawler for image support:

- [ ] Check for `og:image` meta tag
- [ ] Check for `twitter:image` meta tag
- [ ] Look for event/class-specific hero images
- [ ] For film events: OMDB integration (already working)
- [ ] For music events: Spotify/Deezer integration (already working)
- [ ] For classes: instructor photos or program imagery
- [ ] Fallback: use venue image if available
- [ ] Store `image_source` field for debugging

---

## Data Quality Metrics

**Sources by Coverage Tier:**
- **100% coverage:** 54 sources (Ticketmaster, Eventbrite, most music venues)
- **90-99% coverage:** 11 sources
- **50-89% coverage:** 25 sources
- **25-49% coverage:** 14 sources
- **1-24% coverage:** 0 sources
- **0% coverage:** 25 sources (mostly support groups + 5 fixable sources)

**Overall Health:** 
- 65 of 129 sources (50.4%) have 100% image coverage ✓
- 39 sources (30.2%) have <50% coverage (needs attention)
- 25 sources (19.4%) have 0% coverage (mostly support groups, expected)

---

## Next Steps

1. Review this diagnostic with crawler-dev team
2. Prioritize fixes based on event volume impact
3. Implement venue fallback immediately (1-day task)
4. Update Callanwolde + MJCCA crawlers (2-day task each)
5. Schedule venue image enrichment run for non-support venues
6. Re-run `image_coverage_audit.py` after fixes to measure improvement

---

**Generated by:** `python3 crawlers/image_coverage_audit.py`  
**Full report:** `crawlers/IMAGE_COVERAGE_REPORT.txt`
