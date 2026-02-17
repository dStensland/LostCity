# Nightlife Data Diagnostic Report
**Date:** February 14, 2026  
**Prepared for:** Data Quality Review

---

## Executive Summary

The LostCity database has **348 future events** with `category='nightlife'`, with strong coverage of karaoke (96), drag (41), DJ (32), trivia (22), and burlesque (15) subcategories. However, **9 out of 16 new nightlife subcategories have ZERO events**, representing significant discovery gaps for users seeking bar games, poker, bingo, pub crawls, specials, latin nights, line dancing, strip clubs, lifestyle events, and variety shows.

The nightlife_mode compound filter (music/comedy/dance/gaming at nightlife venues OR after 7pm) captures **2,766 events**, indicating the platform has strong nightlife-adjacent content that could be better surfaced through genre tagging.

---

## 1. Current Nightlife Event Coverage

### Events with `category='nightlife'`
- **Total future nightlife events:** 348
- **Events with genres assigned:** 221
- **Events without genres:** 127 (36.5% — data quality gap)

### Genre/Subcategory Breakdown

| Genre | Event Count | Status |
|-------|-------------|--------|
| karaoke | 96 | ✅ Good coverage |
| drag | 41 | ✅ Good coverage |
| dj | 32 | ✅ Adequate |
| trivia | 22 | ✅ Adequate |
| burlesque | 15 | ⚠️ Low but present |
| game-night | 22 | ✅ Adequate |
| wine-night | 12 | ⚠️ Low |
| dance-party | 14 | ⚠️ Low |
| cocktail-night | 2 | ⚠️ Very low |
| electronic | 1 | ⚠️ Very low |
| **bar-games** | **0** | ❌ GAP |
| **poker** | **0** | ❌ GAP |
| **party** | **0** | ❌ GAP |
| **bingo** | **0** | ❌ GAP |
| **pub-crawl** | **0** | ❌ GAP |
| **specials** | **0** | ❌ GAP |
| **latin-night** | **0** | ❌ GAP |
| **line-dancing** | **0** | ❌ GAP |
| **strip** | **0** | ❌ GAP |
| **lifestyle** | **0** | ❌ GAP |
| **revue** | **0** | ❌ GAP |

---

## 2. Nightlife Mode Compound Filter Analysis

The `nightlife_mode` filter captures events at nightlife venues OR starting after 7pm:

- **Total events captured:** 2,766
- **Nightlife venues in database:** 417

### Venue Type Distribution
| Type | Count |
|------|-------|
| bar | 305 |
| nightclub | 61 |
| brewery | 43 |
| club | 7 |
| rooftop | 1 |
| **Total** | **417** |

### Category Breakdown of Compound Filter Events
| Category | Events | Notes |
|----------|--------|-------|
| music | 2,212 | Late-night concerts at nightlife venues |
| nightlife | 335 | Core nightlife category |
| comedy | 219 | Comedy shows at bars/clubs |

**Insight:** The compound filter is working well — music/comedy events at bars are correctly captured as nightlife-adjacent content.

---

## 3. Active Nightlife Sources

**24 active sources** are currently producing nightlife events. Top contributors:

1. **Eventbrite** — General aggregator
2. **Boggs Social & Supply**
3. **The S.O.S. Tiki Bar**
4. **Hotel Clermont**
5. **Block & Drum**
6. **The Heretic**
7. **Mary's**
8. **Lore Atlanta**
9. **Blake's on the Park**
10. **District Atlanta**
11. **Atlanta Eagle**
12. **MJQ Concourse**
13. **Star Community Bar**

### Crawler Availability Check

✅ **Sources with active crawlers:**
- Sister Louisa's (venue-only, no events)
- The Painted Duck (venue-only, no events)
- Joystick Gamebar (events crawler EXISTS, category='nightlife')
- Freeroll Atlanta (events crawler EXISTS, but category='community' — MISCATEGORIZED)
- MJQ Concourse (events crawler EXISTS, category='nightlife', genres include 'dj')
- Havana Club (crawler exists)
- Opera Nightclub (crawler exists)
- Tongue & Groove (crawler exists)
- Clermont Lounge (crawler exists)
- Highland Tap (crawler exists)
- Ormsby's (crawler exists)

❌ **Missing crawlers for recommended venues:**
- Wild Bill's (line dancing)
- Cowboys Concert Hall (line dancing)
- Buckhead Saloon (line dancing)
- Trapeze Atlanta (lifestyle)
- The Chamber (lifestyle)
- Atlanta Pub Crawl (pub crawls)
- Various venues with recurring specials

---

## 4. Root Cause Analysis

### Issue 1: Freeroll Atlanta Miscategorization
**Problem:** The `freeroll_atlanta.py` crawler sets `category='community'` and `subcategory='gaming'` for poker events.  
**Impact:** Poker nights are NOT being tagged with the new `poker` genre, and are not appearing in nightlife feeds.  
**Fix:** Update crawler to use `category='nightlife'`, add `genres=['poker']`.

### Issue 2: Venue-Only Crawlers Not Capturing Events
**Problem:** Many nightlife venues have crawlers that only create venue records (Sister Louisa's, The Painted Duck, Ormsby's, etc.) but don't scrape their event calendars.  
**Impact:** Drag bingo at Sister Louisa's, bar games at The Painted Duck/Ormsby's are NOT in the database.  
**Fix:** Upgrade venue-only crawlers to scrape events from their websites/social media.

### Issue 3: Genre Inference Not Detecting New Subcategories
**Problem:** The `tag_inference.py` logic doesn't automatically detect "bingo", "poker", "pub crawl", "specials", etc. from event titles/descriptions.  
**Impact:** Even if events are crawled, they won't get proper genre tags unless manually specified.  
**Fix:** Add genre inference rules to `infer_genres()` in `tag_inference.py`.

### Issue 4: Recurring Specials Are Not Eventized
**Problem:** "Taco Tuesday", "Happy Hour 4-7pm", "Wing Night" are ongoing operations, not scheduled events.  
**Impact:** The `specials` genre may need to be venue metadata rather than event-level data.  
**Discussion:** Should we create recurring events for weekly specials, or store them as venue attributes?

### Issue 5: No Strip Club / Lifestyle Crawlers
**Problem:** Adult entertainment venues have no crawler coverage (sensitivity/appropriateness concerns?).  
**Impact:** Zero events with `strip` or `lifestyle` genres.  
**Discussion:** Do we want this content? If yes, needs `is_sensitive=true` flag and user opt-in.

---

## 5. Specific Recommendations

### IMMEDIATE (Fix Existing Crawlers)

#### 5.1. Fix Freeroll Atlanta Categorization
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/freeroll_atlanta.py`

**Current code (lines 198-207):**
```python
"category": "community",
"subcategory": "gaming",
"tags": [
    "poker",
    "free",
    "texas-holdem",
    "tournament",
    "freeroll",
    neighborhood.lower().replace(" ", "-"),
],
```

**Recommended fix:**
```python
"category": "nightlife",
"genres": ["poker"],  # Use new genres field
"tags": [
    "free",
    "texas-holdem",
    "tournament",
    "freeroll",
    neighborhood.lower().replace(" ", "-"),
],
```

**Impact:** 60+ poker events per 6-week cycle will now appear in nightlife feeds with proper genre tagging.

---

#### 5.2. Add Genre Inference Rules
**File:** `/Users/coach/Projects/LostCity/crawlers/tag_inference.py`

Add to `infer_genres()` function:

```python
# Nightlife subcategory inference
nightlife_patterns = {
    "bingo": r"\bbingo\b",
    "poker": r"\b(poker|texas hold.?em|hold.?em)\b",
    "trivia": r"\b(trivia|quiz night)\b",
    "karaoke": r"\bkaraoke\b",
    "bar-games": r"\b(pool tournament|darts|cornhole|skee.?ball|bocce|foosball)\b",
    "pub-crawl": r"\b(pub crawl|bar crawl|bar hop)\b",
    "specials": r"\b(taco tuesday|wing night|happy hour|drink special|crab night)\b",
    "latin-night": r"\b(salsa night|bachata|latin night|reggaeton|cumbia)\b",
    "line-dancing": r"\b(line dancing|country night|honky.?tonk)\b",
    "burlesque": r"\bburlesque\b",
    "drag": r"\b(drag show|drag queen|drag king|drag brunch)\b",
    "dj": r"\b(dj|disc jockey|dance party|edm night|house music)\b",
}

for genre, pattern in nightlife_patterns.items():
    if re.search(pattern, combined_text, re.IGNORECASE):
        inferred.append(genre)
```

**Impact:** Events with these keywords in titles/descriptions will automatically get proper genres.

---

### SHORT-TERM (Upgrade Venue Crawlers)

#### 5.3. Upgrade Sister Louisa's to Scrape Events
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/sister_louisas.py`

**Current:** Venue-only (returns 0, 0, 0)  
**Recommended:** Scrape Instagram/Facebook for weekly drag bingo nights  
**Expected yield:** 4-8 events/month with `genres=['bingo', 'drag']`

#### 5.4. Upgrade The Painted Duck to Scrape Events
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/the_painted_duck.py`

**Current:** Venue-only  
**Recommended:** Scrape website events calendar for leagues, tournaments  
**Expected yield:** 10-15 events/month with `genres=['bar-games']`

#### 5.5. Upgrade Ormsby's to Scrape Events
**File:** `/Users/coach/Projects/LostCity/crawlers/sources/ormsbys.py`

**Current:** Venue-only  
**Recommended:** Scrape website for bocce league, skee-ball nights  
**Expected yield:** 8-12 events/month with `genres=['bar-games']`

---

### MEDIUM-TERM (New Crawlers)

#### 5.6. Create Havana Club Events Crawler
**Priority:** HIGH (fills latin-night gap)  
**Target URL:** `https://havanaclubatlanta.com/events`  
**Expected yield:** 12-20 salsa/bachata nights per month  
**Genres:** `['latin-night', 'dance-party']`

#### 5.7. Create Wild Bill's Crawler
**Priority:** MEDIUM (fills line-dancing gap)  
**Location:** Duluth (Gwinnett County)  
**Expected yield:** 8-12 country nights per month  
**Genres:** `['line-dancing']`

#### 5.8. Create Atlanta Pub Crawl Crawler
**Priority:** LOW (niche audience)  
**Challenge:** Events may be gated behind tickets/registration  
**Expected yield:** 2-4 crawls per month  
**Genres:** `['pub-crawl']`

---

### DISCUSSION ITEMS

#### 5.9. Recurring Specials Strategy
**Question:** Should "Taco Tuesday" be an event or venue metadata?

**Option A (Events):**
- Create recurring events for weekly specials
- Pros: Searchable, shows up in feeds
- Cons: Clutter, not really "events"

**Option B (Venue Metadata):**
- Add `specials` field to venues table: `{"tuesday": "Taco Tuesday 5-10pm", "wednesday": "Wing Night $0.50/wing"}`
- Pros: Cleaner data model
- Cons: Harder to discover, doesn't show in event feeds

**Recommendation:** Start with Option A (events) for high-value specials (drag bingo, trivia), use Option B for generic happy hours.

---

#### 5.10. Adult Entertainment Coverage
**Question:** Do we crawl strip clubs?

**Considerations:**
- Clermont Lounge is iconic Atlanta destination (already has venue record)
- Adult content needs `is_sensitive=true` flag
- User opt-in required (profile setting: `show_adult_content`)
- Legal/brand risk?

**Recommendation:** Create crawlers for mainstream strip clubs (Clermont, Pink Pony) with sensitivity flags, exclude explicit adult/lifestyle venues until user demand is proven.

---

## 6. Success Metrics

After implementing fixes, we should see:

| Metric | Current | Target |
|--------|---------|--------|
| Events with genres | 221 (64%) | 330+ (95%) |
| `poker` genre events | 0 | 60+ |
| `bingo` genre events | 0 | 15+ |
| `bar-games` genre events | 0 | 30+ |
| `latin-night` genre events | 0 | 15+ |
| `line-dancing` genre events | 0 | 10+ |
| Active nightlife sources | 24 | 35+ |

---

## 7. Validation Queries

### Check poker event migration
```sql
SELECT COUNT(*) as poker_events
FROM events
WHERE 'poker' = ANY(genres)
AND start_date >= CURRENT_DATE;
```

### Check events without genres
```sql
SELECT COUNT(*) as missing_genres, 
       COUNT(*) FILTER (WHERE category='nightlife') as nightlife_missing
FROM events
WHERE genres IS NULL 
  AND start_date >= CURRENT_DATE;
```

### Check subcategory coverage
```sql
SELECT 
  unnest(genres) as genre,
  COUNT(*) as event_count
FROM events
WHERE category = 'nightlife'
  AND start_date >= CURRENT_DATE
GROUP BY genre
ORDER BY event_count DESC;
```

---

## Appendix: Atlanta Nightlife Venue Recommendations

### Drag/LGBTQ
- ✅ Sister Louisa's — drag bingo (crawler exists, needs event scraping)
- ✅ Blake's on the Park — drag shows (crawler active)
- ✅ Atlanta Eagle — leather/bear events (crawler active)
- ✅ My Sister's Room — lesbian bar (crawler exists)
- ⚠️ Woofs — gay sports bar (venue-only crawler)

### Bar Games
- ✅ The Painted Duck — bocce, darts (crawler exists, needs events)
- ✅ Ormsby's — bocce, skee-ball (crawler exists, needs events)
- ✅ Joystick Gamebar — arcade (crawler active with events)
- ⚠️ Highland Tap — pool, darts (crawler exists, check event coverage)
- ❌ The Highlander — pool hall (no crawler)

### Latin Nights
- ⚠️ Havana Club — salsa nights (crawler exists, check event coverage)
- ⚠️ Opera Nightclub — reggaeton (crawler exists, check event coverage)
- ⚠️ MJQ Concourse — occasional latin nights (crawler active)
- ⚠️ Tongue & Groove — latin saturdays (crawler exists, check events)

### Line Dancing
- ❌ Wild Bill's (Duluth) — country bar (no crawler)
- ❌ Cowboys Concert Hall — country dancing (no crawler)
- ❌ Buckhead Saloon — country nights (no crawler)

### Poker
- ✅ Freeroll Atlanta — free poker league (crawler active, needs recategorization)

### Strip Clubs
- ⚠️ Clermont Lounge — iconic dive strip club (venue crawler only, no events)
- ❌ Pink Pony — upscale strip club (no crawler)
- ❌ Tattletale Lounge — (no crawler)

---

**End of Diagnostic**
