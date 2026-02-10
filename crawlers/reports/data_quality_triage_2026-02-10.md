# Data Quality Triage Report

Generated: 2026-02-10 14:32:15

## Executive Summary

- **Broken Sources**: 2 active sources with <50% success rate
- **Zero-Event Sources**: 5 active sources finding no events
- **Low-Yield Sources**: 88 sources averaging <2 events
- **Venue Issues**: 208 missing coords, 787 missing images

## Broken Sources (Fix or Disable)

| Source Slug | Runs | Success Rate | Total Events | Errors |
|-------------|------|--------------|--------------|--------|
| community-foundation-atl | 11 | 27.3% | 3 | 3 |
| bold-monk-brewing | 11 | 36.4% | 60 | 3 |

## Zero-Event Sources

| Source Slug | Runs | Success Rate | Status |
|-------------|------|--------------|--------|
| sandy-springs-pac | 11 | 90.9% | Active |
| candler-park-fest | 9 | 88.9% | Active |
| atlanta-greek-festival | 3 | 66.7% | Active |
| blade-show | 3 | 100.0% | Active |
| afropunk-atlanta | 3 | 100.0% | Active |

## Recommended Actions

### Immediate (This Week)
1. Run `python3 scripts/disable_broken_sources.py` to disable permanently broken sources
2. Investigate top 10 broken sources for extraction issues
3. Review zero-event sources to identify seasonal vs broken

### Short-term (This Month)
1. Run venue enrichment scripts for missing coordinates/images
2. Fix category inference for sources with high NULL rates
3. Improve extraction prompts for sources missing descriptions/times


---

## Detailed Source Diagnostics

### Broken Sources - Root Cause Analysis

#### 1. community-foundation-atl (27.3% success)
**Symptoms**: 11 runs, only 3 successful, found 3 total events

**Root Cause Hypothesis**: 
- Uses brittle HTML parsing with `parse_events_html()` that looks for specific keywords ("facts & acts", "neil asks", "forum", "symposium", "gathering")
- Fragile date parsing with regex on free-form text
- HTML structure likely changed or is inconsistent

**Recommended Fixes**:
1. Switch to LLM-based extraction (`extract.py`) for unstructured HTML
2. Add better error handling and logging to identify which step is failing
3. Check if site structure changed - inspect recent crawl error messages
4. Consider if this is truly an event calendar or just a news/blog section

**Validation Query**:
```sql
SELECT started_at, status, error_message, events_found
FROM crawl_logs
WHERE source_id = (SELECT id FROM sources WHERE slug = 'community-foundation-atl')
ORDER BY started_at DESC
LIMIT 10;
```

---

#### 2. bold-monk-brewing (36.4% success)
**Symptoms**: 11 runs, 4 successful, found 60 total events (good yield when it works)

**Root Cause Hypothesis**:
- Uses Playwright but has fragile line-by-line text parsing
- Regex date matching `r"(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)?,?\s*(January|February|March..."`
- Likely timing issues with JS rendering (3s wait may not be enough)
- Title extraction logic brittle (looks at offsets from date line)

**Recommended Fixes**:
1. Increase wait time from 3s to 5s or use `page.wait_for_selector()` on event elements
2. Add retry logic for Playwright timeouts
3. Improve title extraction - use CSS selectors instead of line offsets
4. Add validation that events have valid titles before attempting insert

**Validation Query**:
```sql
SELECT started_at, status, error_message, events_found
FROM crawl_logs
WHERE source_id = (SELECT id FROM sources WHERE slug = 'bold-monk-brewing')
ORDER BY started_at DESC
LIMIT 10;
```

---

### Zero-Event Sources - Seasonal vs Broken

#### sandy-springs-pac (11 runs, 0 events, 90.9% success)
**Status**: Likely extraction issue, not seasonal (PAC should have year-round programming)

**Recommended Action**: Inspect crawler code for extraction logic failure

---

#### candler-park-fest (9 runs, 0 events, 88.9% success)
**Status**: SEASONAL - festival typically occurs in September

**Recommended Action**: 
1. Add `active_months: [8, 9, 10]` to source record
2. Adjust crawler schedule to only run August-October

---

#### atlanta-greek-festival, blade-show, afropunk-atlanta
**Status**: All SEASONAL - single annual events

**Recommended Action**: Set `active_months` for each:
- atlanta-greek-festival: [9, 10] (September/October)
- blade-show: [6] (June)
- afropunk-atlanta: [8, 9] (August/September)

---

### High Missing Field Rates - Extraction Improvements

#### gwcc (92.7% missing time, 87.8% missing desc, 95.1% missing img)
**Issue**: Convention center crawler sets `is_all_day=True` for all events and lacks descriptions

**Recommended Fix**:
1. Add time extraction from event detail pages (currently only parses calendar view)
2. Scrape event descriptions from individual event URLs
3. Improve image extraction (currently tries but fails 95% of time)
4. Update extraction to follow event links and get full details

**Code Location**: `/Users/coach/Projects/LostCity/crawlers/sources/gwcc.py:257-258`

---

#### zoo-atlanta (100% missing time, 54.5% missing desc)
**Issue**: Likely uses generic descriptions, no time parsing

**Recommended Fix**:
1. Check if times are available on source page
2. If not, mark events as `is_all_day=True` intentionally
3. Improve description extraction from event pages

---

#### atlanta-supercross, coca-cola-roxy, fox-theatre (100% missing time)
**Issue**: These are ticketing/venue pages that likely have times in detail views

**Recommended Fix**:
1. Follow event detail links to get start times
2. Parse time from Ticketmaster/AXS/venue detail pages
3. If times are in JavaScript data, extract from script tags

---

## Tag Health Improvements

Current tag coverage (from data_health.py):
- 96.0% of events have any tags (GOOD)
- 46.2% have 3+ tags (NEEDS IMPROVEMENT - target 70%)
- 43.6% have experiential tags (NEEDS IMPROVEMENT - target 60%)
- 15.0% have genres (NEEDS IMPROVEMENT - target 40% for music/film)

**Recommended Actions**:
1. Enhance `tag_inference.py` rules for experiential tags:
   - Map venue types to experiential tags (dive-bar → "rowdy", rooftop → "chill")
   - Infer from event titles ("Open Mic" → "intimate", "Dance Party" → "high-energy")

2. Improve genre coverage:
   - Run `scripts/backfill_genres.py` for existing music events
   - Enhance Spotify/Deezer genre fetching in `artist_images.py`
   - Add manual genre mapping for common artist name patterns

3. Add more contextual tags:
   - Time-based: "late-night" for events after 10pm
   - Price-based: "affordable" for events under $20
   - Format-based: "outdoor" detection from venue type

---

## Venue Enrichment Priority

**Immediate Actions (Run These Scripts)**:

1. Fill missing coordinates (208 venues, 8.9%):
```bash
python3 venue_enrich.py --only-missing-coords
```

2. Fill missing neighborhoods (514 venues, 22.0%):
```bash
python3 venue_enrich.py --only-missing-neighborhoods
```

3. Scrape missing images (787 venues, 33.7%):
```bash
python3 scrape_venue_images.py
```

4. Classify missing venue_types (226 venues, 9.7%):
```bash
python3 classify_venues.py
```

**Expected Impact**:
- Coordinates: Critical for map view, all venues should have them
- Neighborhoods: Important for filtering, target 95% coverage
- Images: Improves UX, target 80% coverage
- Venue types: Required for spot filtering, target 100%

---

## Crawler Coverage Analysis

**Strong Categories** (>400 events):
- Music: 1,029 events
- Community: 731 events
- Art: 631 events
- Sports: 402 events

**Weak Categories** (<100 events):
- Fitness: 115 events
- Food & Drink: 92 events
- Comedy: 78 events
- Outdoor: 63 events

**Coverage Gaps to Address**:
1. Add more comedy club crawlers (Laughing Skull, Village Theatre, Dad's Garage)
2. Add yoga studio/gym class sources for fitness
3. Add food festival/tasting event sources
4. Add outdoor recreation (BeltLine events, hiking groups, outdoor concerts)

---

## Next Sprint Actions

### Week 1: Fix Broken Sources
- [ ] Debug community-foundation-atl crawler, fix or disable
- [ ] Fix bold-monk-brewing Playwright timing issues
- [ ] Set active_months for seasonal sources (candler-park, blade-show, etc.)

### Week 2: Fill Data Gaps
- [ ] Run venue enrichment scripts (coords, neighborhoods, images, types)
- [ ] Backfill genres for music events
- [ ] Fix GWCC, Zoo, Fox Theatre time/description extraction

### Week 3: Improve Tag Coverage
- [ ] Enhance tag_inference.py with experiential tag rules
- [ ] Add venue-type → tag mappings
- [ ] Run backfill script on existing events

### Week 4: Coverage Expansion
- [ ] Add 5+ comedy venue crawlers
- [ ] Add 3+ fitness studio crawlers
- [ ] Add 2+ food festival crawlers

---

*Report generated by Phase B: Data Quality Triage*
*See /Users/coach/Projects/LostCity/crawlers/scripts/data_quality_triage.py for source code*
