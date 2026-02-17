# LostCity Production Audit Report
**Date:** 2026-02-16  
**Auditor:** Data Quality Agent  
**Scope:** Complete database integrity check before production crawl  
**Health Score:** 90.4/100

---

## Executive Summary

The LostCity database contains **18,358 events** from **547 active sources** across **3,905 venues**. Overall data health is **READY WITH MINOR ISSUES** (90.4/100 score). While relationship integrity is solid (no orphaned records), there are **3 blocking issues** that must be addressed before production deployment.

### Status: ⚠️ READY WITH MINOR ISSUES

**Strengths:**
- Zero duplicate events (deduplication working perfectly)
- Zero orphaned references (referential integrity intact)
- Good category distribution (18 categories well-represented)
- 95.2% of events have descriptions
- 99.6% of events have tags

**Critical Issues:**
- 343 venues missing coordinates (can't show on maps)
- 420 events with ALL CAPS short titles (poor UX)
- 194 dead sources (35% of active sources produce no events)

---

## Issues by Severity

### 🔴 CRITICAL: 406 Issues

#### 1. Venues Missing Coordinates (343 venues)
**Impact:** These venues have future events but can't appear on map views, severely degrading the core discovery experience.

**Details:**
- 343 venues with future events missing lat/lng
- 33 venues with invalid venue_type (not in taxonomy)
- 30 venues missing city/state

**Top 5 Affected Venues:**
- MODEx Studio (ID 4005) - event_space
- Roundhouse Kickboxing Buckhead (ID 4006) - event_space
- 269 Buckhead Ave NE (ID 4009) - event_space
- 6317 Roswell Rd NE (ID 4016) - event_space
- 3063 Bolling Way NE (ID 4007) - event_space

**Fix:**
```bash
# Run venue enrichment with Google Places API
python3 venue_enrich.py --missing-coords-only
```

---

### 🟠 HIGH: 585 Issues

#### 2. Title Quality (585 events)
**Impact:** Poor titles degrade UX, harm SEO, confuse users, and make events unshareable.

**Breakdown:**
- **420 events** - ALL CAPS short titles (likely nav text)
- **105 events** - Start with date pattern
- **34 events** - Title equals venue name (junk "place is open" events)
- **13 events** - Contain "TBD" or "placeholder" text
- **6 events** - Excessive punctuation
- **4 events** - Contain "test" or "sample"
- **3 events** - HTML entities (&amp;, &lt;, etc)

**Top Offending Sources:**
1. `the-eastern` - COMMON PEOPLE, MONALEO, etc.
2. `the-masquerade` - THE WONDER YEARS, SZN4, etc.
3. `terminal-west` - CJ BRINSON & FAMILY
4. `ebenezer-church` - "February 18: Ash Wednesday"
5. `farmers-markets` - Title = venue name

**Sample Issues:**
```
- [the-eastern] 'COMMON PEOPLE' at The Eastern (2026-03-17)
- [ebenezer-church] 'February 18: Ash Wednesday' at Ebenezer Baptist Church (2026-02-18)
- [farmers-markets] 'Piedmont Park Green Market' at Piedmont Park Green Market (2026-03-21)
- [ticketmaster-nashville] 'In The Round with TBA' at The Bluebird Cafe (2026-02-18)
```

**Fix:**
1. Add title normalization in `db.py` `insert_event()`:
   ```python
   # Strip date prefixes
   title = re.sub(r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+:\s*', '', title)
   title = re.sub(r'^\d{4}-\d{2}-\d{2}\s+@\s+', '', title)
   
   # Normalize ALL CAPS titles under 20 chars
   if title.isupper() and len(title) < 20:
       title = title.title()  # or use smarter case normalization
   
   # Decode HTML entities
   import html
   title = html.unescape(title)
   ```

2. Fix specific crawlers:
   - `sources/the_eastern.py` - Extract proper case titles
   - `sources/the_masquerade.py` - Fix title extraction
   - `sources/terminal_west.py` - Fix title extraction
   - `sources/farmers_markets.py` - Use event name, not market name

---

### 🟡 MEDIUM: 2,568 Issues

#### 3. Tag/Genre Health (1,200 events)
**Impact:** Events without genres can't be filtered/discovered by music taste or nightlife preference.

**Details:**
- **971 music events** missing genres (38% of music category)
- **159 nightlife events** missing genres (31% of nightlife category)
- **70 events** with null/empty tags (0.4%)

**Top Sources Missing Genres:**
1. `ticketmaster` - 215 music events
2. `the-earl` - 87 music events
3. `eventbrite` - 64 music events
4. `pigs-and-peaches-bbq` - 39 music events

**Fix:**
1. Run `artist_images.py` to fetch Spotify genres for music events with artist names
2. Enhance `tag_inference.py` with better genre extraction rules:
   - Parse genre keywords from titles/descriptions
   - Use venue type (e.g., jazz club → jazz genre)
   - Add nightlife genre patterns (DJ, drag, trivia, karaoke, etc.)

---

#### 4. Description Quality (1,044 events)
**Impact:** Missing/poor descriptions reduce click-through rates and time-on-site.

**Details:**
- **882 events** with NULL description (4.8%)
- **104 events** with synthetic "Event at X" descriptions
- **35 events** with overly long descriptions (>2000 chars, likely scraped junk)
- **23 events** with too-short descriptions (<10 chars)

**Top Sources with Null Descriptions:**
1. `ticketmaster` - 118 events
2. `meetup` - 95 events
3. `eventbrite` - 87 events

**Fix:**
1. Enable LLM extraction for high-volume sources missing descriptions
2. Add fallback description generation in `db.py`:
   ```python
   if not description:
       category_label = category.replace('_', ' ').title()
       description = f"{category_label} event at {venue_name}. Check the event page for details."
   ```

---

#### 5. Source Health (194 sources)
**Impact:** 35% of active sources produce no future events, wasting crawler time and skewing reliability metrics.

**Details:**
- 194 sources with `is_active = true` but no events after 2026-02-16
- These may be broken crawlers, venues that closed, or incorrectly activated sources

**Top Dead Sources:**
- `basement-atlanta` (Basement Atlanta)
- `keep-atlanta-beautiful` (Keep Atlanta Beautiful)
- `vista-yoga` (Vista Yoga)
- `flux-projects` (Flux Projects)
- `my-parents-basement` (My Parents' Basement)
- `tongue-and-groove` (Tongue & Groove)
- `cdc-museum` (David J. Sencer CDC Museum)

**Fix:**
```sql
-- Run this query to identify all dead sources
-- Then manually review and deactivate
SELECT 
    s.id, s.slug, s.name, MAX(e.start_date) as last_event
FROM sources s
LEFT JOIN events e ON e.source_id = s.id
WHERE s.is_active = true
GROUP BY s.id
HAVING MAX(e.start_date) < CURRENT_DATE OR MAX(e.start_date) IS NULL;

-- Deactivate confirmed dead sources
UPDATE sources SET is_active = false 
WHERE slug IN ('basement-atlanta', 'keep-atlanta-beautiful', ...);
```

---

#### 6. Event Consistency (130 events)
**Impact:** Time logic errors confuse users and break time-based filters.

**Details:**
- **119 events** with `end_time < start_time` (cross-midnight bug)
- **11 events** with `is_all_day = true` but have `start_time` (contradictory)

**Cross-Midnight Bug:**
All 119 events are from `ten-atlanta` (Friday nights 22:00-03:00). Nightclub closes at 3am, but database interprets this as 3am same day, not next day.

**Sample:**
```
[ten-atlanta] 'Friday Night at Ten Atlanta' 
  Start: 22:00:00, End: 03:00:00  <- WRONG (end should be next day)
```

**Fix:**
In `sources/ten_atlanta.py`:
```python
# If end_time < start_time, it crosses midnight
if end_time and start_time and end_time < start_time:
    # Either:
    # 1. Set end_time = None (unknown end)
    end_time = None
    # OR
    # 2. Set end_date = start_date + 1 day
    end_date = (datetime.strptime(start_date, '%Y-%m-%d') + timedelta(days=1)).strftime('%Y-%m-%d')
```

**All-Day with Time:**
Fix crawler logic: if `is_all_day = true`, always set `start_time = None`.

---

### 🔵 LOW: 23 Issues

#### 7. Content Hash Integrity (21 duplicates)
**Impact:** Minimal - these are legitimate same-event-different-venue cases (Masquerade room variants).

**Details:**
21 hash groups with 2 events each. All involve "The Masquerade" and "The Masquerade - Hell/Heaven/Purgatory".

**Sample:**
```
Hash: 3a24a88a06ceef7e
  - Event 6236 [ticketmaster] 'redveil' at The Masquerade (2026-02-16)
  - Event 712 [ticketmaster] 'redveil' at The Masquerade - Purgatory (2026-02-16)
```

**Fix:**
Improve venue slug normalization in `get_or_create_venue()`:
```python
# Normalize multi-room venue names
venue_slug = venue_slug.replace('-hell', '').replace('-heaven', '').replace('-purgatory', '')
```

---

#### 8. Category Distribution (2 categories)
**Impact:** Negligible - just underdeveloped categories.

**Details:**
- `religious` - 3 events (low but expected)
- `dance` - 1 event (very low, may need more crawler coverage)

---

### ✅ PASS: 2 Checks

#### 9. Duplicate Events
**Status:** PASS  
Zero duplicate events found (same title, venue, date).

#### 10. Relationship Integrity
**Status:** PASS  
All events reference valid venues and sources. No orphaned records.

---

## Recommended Action Plan

### Phase 1: CRITICAL FIXES (2-3 hours)
**Must complete before production crawl**

- [ ] Run `venue_enrich.py` for 343 venues missing coordinates
  ```bash
  python3 venue_enrich.py --missing-coords-only
  ```
- [ ] Add title normalization to `db.py` `insert_event()`:
  - Strip date prefixes
  - Normalize ALL CAPS short titles
  - Decode HTML entities
- [ ] Audit 194 dead sources, set `is_active = false` for broken ones
  ```sql
  UPDATE sources SET is_active = false WHERE slug IN (...);
  ```

### Phase 2: HIGH PRIORITY (4-6 hours)
**Should fix before public launch**

- [ ] Enhance genre extraction in `tag_inference.py`:
  - Add music genre keyword patterns
  - Add nightlife subgenre patterns
- [ ] Run `artist_images.py` to fetch Spotify genres for music events
- [ ] Fix cross-midnight time logic in `ten-atlanta.py` and similar nightclub crawlers
- [ ] Fix `the-eastern.py`, `the-masquerade.py`, `terminal-west.py` title extraction

### Phase 3: MEDIUM PRIORITY (2-4 hours)
**Polish for better UX**

- [ ] Add fallback descriptions for events with null descriptions
- [ ] Fix all-day + time contradictions in affected crawlers
- [ ] Normalize Masquerade venue variants in dedupe logic
- [ ] Enable LLM extraction for sources with high null description rates

---

## Validation Queries

Use the queries in `PRODUCTION_AUDIT_QUERIES.sql` to:
1. Identify specific problematic records
2. Verify fixes after implementation
3. Monitor ongoing data quality

**Quick health check:**
```sql
SELECT 
    'Total Events' as metric,
    COUNT(*) as count
FROM events
WHERE start_date >= CURRENT_DATE;

-- Should be ~10k-15k future events
```

---

## Re-Audit After Fixes

After completing Phase 1 fixes, re-run this audit to verify:
- Health score > 95/100
- Venues with coords > 99%
- Title issues < 50
- Dead sources < 20

**Re-audit command:**
```bash
python3 -c "from db import get_client; supabase = get_client(); ..."
```

---

## Notes for Crawler-Dev

### Common Patterns to Watch

1. **ALL CAPS Titles:** Many music venue APIs return artist names in ALL CAPS. Add title case normalization.

2. **Date in Title:** Some sources include event date in the title field. Strip these prefixes.

3. **Cross-Midnight Events:** Nightclub end times often cross midnight. Check if `end_time < start_time` and handle accordingly.

4. **Venue = Title:** If scraping recurring venue operations (farmers markets, open mics), ensure you're capturing the EVENT name, not just the venue name.

5. **Null Descriptions:** If a source provides minimal description, use LLM extraction from the page HTML to generate a useful description.

### Title Normalization Rules

```python
def normalize_title(title: str, venue_name: str) -> str:
    """Normalize event title for consistent UX."""
    import html
    import re
    
    # Decode HTML entities
    title = html.unescape(title)
    
    # Strip date prefixes
    title = re.sub(r'^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d+:\s*', '', title)
    title = re.sub(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)\s+\d+:\s*', '', title)
    title = re.sub(r'^\d{4}-\d{2}-\d{2}\s+@\s+', '', title)
    
    # Normalize ALL CAPS short titles
    if title.isupper() and len(title) < 20 and any(c.isalpha() for c in title):
        # Use title case but preserve acronyms
        words = title.split()
        title = ' '.join(
            word if len(word) <= 3 else word.title()
            for word in words
        )
    
    # Strip excessive whitespace
    title = ' '.join(title.split())
    
    # Reject if title equals venue name (junk event)
    if title.lower().strip() == venue_name.lower().strip():
        return None  # Signal to skip this event
    
    return title
```

---

## Files Generated

- `/Users/coach/Projects/LostCity/PRODUCTION_AUDIT_REPORT.md` (this file)
- `/Users/coach/Projects/LostCity/PRODUCTION_AUDIT_QUERIES.sql` (diagnostic SQL)

---

**End of Report**
