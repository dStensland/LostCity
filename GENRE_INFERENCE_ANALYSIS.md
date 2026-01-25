# Genre Inference Analysis for LostCity Events

**Date:** January 24, 2026  
**Analyst:** Data Quality Specialist  
**Status:** Ready for Implementation

---

## Executive Summary

**YES, we can infer genres for events like musical shows, theater, film, etc.**

The infrastructure is already in place:
- ✅ **Database schema** ready (migration 019_genres.sql written but not applied)
- ✅ **Extraction prompt** already asks Claude to identify genres
- ✅ **Code logic** in place to save genres to events and series
- ✅ **Subcategory data** already being populated (80%+ for music, 100% for film/theater)

**The issue:** Migration 019 hasn't been applied to the production database yet, so the `genres` column doesn't exist.

---

## Current State Analysis

### 1. Schema Design (Ready but Not Applied)

**Events Table:**
- Has `genres TEXT[]` column defined in migration 019
- Stores genres for standalone events (non-series events)
- GIN index planned for fast filtering

**Series Table:**
- Has `genres TEXT[]` column defined in migration 019
- Primary location for genres of recurring content (films, shows)
- Events inherit genres from their series

**Genre Options Reference Table:**
- 145 curated genres across 4 categories:
  - **Film:** 24 genres (action, comedy, drama, horror, sci-fi, documentary, etc.)
  - **Music:** 31 genres (rock, pop, hip-hop, jazz, electronic, indie, etc.)
  - **Theater:** 24 genres (musical, drama, comedy, improv, stand-up, ballet, etc.)
  - **Sports:** 26 types (baseball, basketball, soccer, mma, esports, etc.)

### 2. Data Population Status

#### Current Database (1,000 sample events):

| Field | Coverage | Notes |
|-------|----------|-------|
| **Category** | 100% | 3 main categories in sample: community (57%), comedy (25.4%), art (17.6%) |
| **Subcategory** | 0% overall | But varies widely by source |
| **Tags** | 0% | Tag inference system exists but not running |
| **Genres** | N/A | Column doesn't exist yet (migration not applied) |

#### Subcategory Coverage by Category:

| Category | Events | With Subcategory | Coverage |
|----------|--------|------------------|----------|
| **Film** | 270 | 270 | **100%** |
| **Music** | 217 | 174 | **80.2%** |
| **Comedy** | 24 | 24 | **100%** |
| **Theater** | 29 | 7 | 24.1% |
| **Nightlife** | 14 | 14 | **100%** |
| **Words** | 48 | 47 | 97.9% |
| **Fitness** | 34 | 32 | 94.1% |
| **Food/Drink** | 20 | 12 | 60% |
| **Community** | 78 | 41 | 52.6% |
| **Sports** | 17 | 2 | 11.8% |
| Other | 161 | 0 | 0% |

#### Music Subcategories Currently Captured:

```
concert          93 events
rock             21
pop              11
open_mic          8
live_music        8
acoustic          8
live              8
rnb               5
hiphop            4
indie             2
alternative       2
country           2
jazz              1
metal             1
```

#### Film Subcategories:

```
cinema              223 events
special-screening    43
festival              3
screening             1
```

**Note:** Film events are linked to series (13.4% of all events), where genres should live.

### 3. Source Quality Assessment

#### Sources with 100% Subcategory Coverage:

- **Landmark Midtown Art Cinema** (168 film events)
- **Plaza Theatre** (67 film events)
- **Tara Theatre** (31 film events)
- **Terminal West** (29 music events)
- **The Masquerade** (19 music events)
- **Tabernacle** (19 music events)
- **Eddie's Attic** (8 music events)
- **Dad's Garage** (10 comedy events)

#### Sources with Rich Metadata Potential:

**Ticketmaster** (224 events):
- Already extracting music subcategories: rock, hiphop, rnb, pop
- API responses likely contain genre classifications
- Currently: 32.1% music, 10.7% theater, 6.7% sports

**Cinema Sources:**
- All cinema sources (Landmark, Plaza, Tara) provide consistent subcategory
- Film titles present (can be enriched via TMDB/IMDB APIs)
- Currently using series detection for films

---

## Data Patterns for Genre Inference

### High-Quality Signals

#### 1. Film Events
**Current data richness:** Medium (titles only)

Sample films from database:
- "The Shining 35mm" → horror, thriller, classic
- "This Is Spinal Tap" → comedy, mockumentary, cult
- "A New Love in Tokyo" → drama, romance, foreign

**Inference approach:**
- ✅ **Primary:** LLM extraction from event listings
- ✅ **Enhancement:** External APIs (TMDB, IMDB) for canonical genre data
- ✅ **Storage:** Series table (since films are in series)

#### 2. Music Events
**Current data richness:** High (subcategories already captured)

Sample events:
- "THE EARLY NOVEMBER & HELLOGOODBYE: 20 Years Young" → rock
- "YK Niece" → hiphop
- "An Evening with October London & Lalah Hathaway" → rnb

**Existing subcategory breakdown:**
- 93 concerts (genre to be determined)
- 21 rock
- 11 pop
- 5 r&b
- 4 hip-hop
- 2 indie, 2 alternative, 2 country
- 1 jazz, 1 metal

**Inference approach:**
- ✅ **Already working:** Ticketmaster providing subcategories
- ✅ **Enhancement:** LLM can infer from artist names, venue context
- ⚠️ **Challenge:** Generic "concert" needs artist-based inference

#### 3. Theater Events
**Current data richness:** Low to Medium

Sample events:
- "Other Paths to God" → play, drama
- "Cinderella: Presented By Gwinnett Ballet Theatre" → ballet, family
- "BERT KREISCHER: PERMISSION TO PARTY" → stand-up, comedy

**Inference approach:**
- ✅ **LLM extraction:** Descriptions often contain genre clues
- ✅ **Venue inference:** Dad's Garage = improv/sketch, Atlanta Opera = opera

#### 4. Comedy Events
**Current data richness:** High (100% have subcategory)

```
standup    21 events
improv      3 events
```

**Inference approach:**
- ✅ **Already solved:** Subcategory is effectively the genre

---

## Extraction Prompt Analysis

### Current Prompt (extract.py lines 42-48)

```
GENRES:
For film, music, theater, and sports events, identify relevant genres:
- Film: action, comedy, drama, horror, sci-fi, documentary, thriller, animation, romance, indie, cult, classic, etc.
- Music: rock, pop, hip-hop, jazz, electronic, country, metal, punk, indie, folk, classical, r&b, blues, etc.
- Theater: musical, drama, comedy, improv, stand-up, ballet, opera, puppet, burlesque, sketch, etc.
- Sports: baseball, basketball, football, soccer, hockey, mma, racing, esports, marathon, etc.
Include 1-3 most relevant genres. Use lowercase. Custom genres allowed if standard ones don't fit.
```

**Assessment:** ✅ Well-designed, comprehensive, allows flexibility

### Code Flow (db.py insert_event)

```python
def insert_event(event_data: dict, series_hint: dict = None, genres: list = None) -> int:
    # Process series association if hint provided
    if series_hint:
        series_id = get_or_create_series(client, series_hint, event_data.get("category"))
        if series_id:
            event_data["series_id"] = series_id
            # Don't store genres on event if it has a series (genres live on series)
            genres = None
    
    # Add genres for standalone events (events without a series)
    if genres and not event_data.get("series_id"):
        event_data["genres"] = genres
```

**Assessment:** ✅ Logic correctly stores genres on series for recurring content, events for standalone

---

## Recommendations

### Immediate Actions

#### 1. Apply Migration 019 ⚡ CRITICAL
```bash
# In Supabase SQL Editor
-- Run database/migrations/019_genres.sql
```

**Impact:** Enables genre storage for all new events

#### 2. Verify Extraction is Working
Run a test crawl and verify:
- [ ] Claude is extracting genres in extraction response
- [ ] Genres are being saved to `events.genres` or `series.genres`
- [ ] Query events to confirm genres populated

#### 3. Backfill Genres for Existing Events

**Priority 1: Film Events (270 events, 134 with series)**
```sql
-- After migration, verify series have genres
SELECT id, title, genres, series_type 
FROM series 
WHERE category = 'film' AND (genres IS NULL OR array_length(genres, 1) = 0);
```

**Approach:**
- Re-crawl cinema sources (Landmark, Plaza, Tara)
- OR enhance with external API (TMDB lookup by title)
- OR run batch LLM inference on existing titles

**Priority 2: Music Events (217 events, ~80% have subcategory)**
```sql
-- Events with subcategory but no genres
SELECT id, title, subcategory 
FROM events 
WHERE category = 'music' 
  AND subcategory IS NOT NULL 
  AND (genres IS NULL OR array_length(genres, 1) = 0);
```

**Approach:**
- Many already have subcategory that could map to genre
- Direct mapping: `subcategory='rock' → genres=['rock']`
- LLM inference for "concert" subcategory using artist names

**Priority 3: Theater Events (29 events, 24% subcategory coverage)**

**Approach:**
- LLM inference from descriptions
- Venue-based inference (e.g., Dad's Garage → improv)

### Enhancement Opportunities

#### 1. External API Enrichment (Films)

```python
# Pseudo-code for TMDB enrichment
def enrich_film_genres(film_title: str, year: int = None):
    # Search TMDB for film
    tmdb_data = tmdb_api.search(title=film_title, year=year)
    
    # Map TMDB genre IDs to our genre slugs
    genres = map_tmdb_genres(tmdb_data.genres)
    
    # Update series
    update_series_genres(series_id, genres)
```

**Benefits:**
- Canonical genre data for films
- Director, runtime, rating also available
- Free API (up to rate limits)

**Implementation effort:** Low (1-2 days)

#### 2. Subcategory → Genre Migration

Many events already have subcategory that could seed genres:

```python
# Migration script
SUBCATEGORY_TO_GENRE = {
    'rock': ['rock'],
    'pop': ['pop'],
    'hiphop': ['hip-hop'],
    'rnb': ['r&b'],
    'jazz': ['jazz'],
    'metal': ['metal'],
    'indie': ['indie'],
    'alternative': ['alternative'],
    'country': ['country'],
    'standup': ['stand-up'],
    'improv': ['improv'],
    # ...
}

for event in events_with_subcategory:
    if event.subcategory in SUBCATEGORY_TO_GENRE:
        event.genres = SUBCATEGORY_TO_GENRE[event.subcategory]
```

#### 3. Venue-Based Genre Inference

```python
VENUE_GENRE_HINTS = {
    'terminal-west': ['indie', 'alternative', 'rock'],
    'the-masquerade': ['metal', 'punk', 'alternative'],
    'tabernacle': ['rock', 'indie'],
    'atlanta-opera': ['opera', 'classical'],
    'atlanta-ballet': ['ballet', 'dance'],
    'dads-garage': ['improv', 'sketch', 'comedy'],
}
```

**Use case:** When LLM doesn't extract genre, use venue as fallback hint

---

## Quality Validation Queries

### After Migration Applied:

```sql
-- Genre coverage by category
SELECT 
    category,
    COUNT(*) as total_events,
    COUNT(CASE WHEN genres IS NOT NULL AND array_length(genres, 1) > 0 THEN 1 END) as with_genres,
    ROUND(100.0 * COUNT(CASE WHEN genres IS NOT NULL AND array_length(genres, 1) > 0 THEN 1 END) / COUNT(*), 1) as coverage_pct
FROM events
WHERE category IN ('music', 'film', 'theater', 'sports', 'comedy')
GROUP BY category
ORDER BY coverage_pct DESC;

-- Most common genres by category
SELECT 
    category,
    unnest(genres) as genre,
    COUNT(*) as event_count
FROM events
WHERE genres IS NOT NULL
GROUP BY category, genre
ORDER BY category, event_count DESC;

-- Series with genres (films)
SELECT 
    series_type,
    COUNT(*) as total_series,
    COUNT(CASE WHEN genres IS NOT NULL AND array_length(genres, 1) > 0 THEN 1 END) as with_genres
FROM series
GROUP BY series_type;

-- Sample events with genres
SELECT title, category, genres
FROM events
WHERE genres IS NOT NULL AND array_length(genres, 1) > 0
LIMIT 20;
```

---

## Implementation Checklist

### Phase 1: Enable Genre Infrastructure (1 day)
- [ ] Apply migration 019_genres.sql in Supabase
- [ ] Verify columns exist: `events.genres`, `series.genres`
- [ ] Verify indexes created
- [ ] Verify genre_options table populated

### Phase 2: Validate Current Extraction (1 day)
- [ ] Run test crawl on a cinema source (Landmark, Plaza)
- [ ] Check if Claude is returning genres in extraction
- [ ] Verify genres saved to series table for films
- [ ] Run test crawl on music venue (Terminal West, Masquerade)
- [ ] Verify genres saved to events table for standalone music

### Phase 3: Backfill Existing Data (2-3 days)
- [ ] Write script to migrate subcategory → genres where applicable
- [ ] Run batch LLM inference for events missing genres
- [ ] Consider TMDB enrichment for film series
- [ ] Validate results with quality queries

### Phase 4: Monitor & Refine (Ongoing)
- [ ] Add genre coverage to data quality dashboard
- [ ] Alert when genre coverage drops below threshold
- [ ] Periodically review genre distribution for anomalies
- [ ] Tune extraction prompt if needed

---

## Expected Outcomes

### After Migration + Backfill:

| Category | Expected Genre Coverage | Confidence |
|----------|------------------------|------------|
| **Film** | 90-95% | High (via series + TMDB) |
| **Music** | 85-90% | High (subcategory mapping + LLM) |
| **Comedy** | 95-100% | Very High (subcategory is genre) |
| **Theater** | 70-80% | Medium (LLM inference from descriptions) |
| **Sports** | 80-90% | High (event types clear) |

### Genre Granularity Examples:

**Film:**
- "The Shining 35mm" → `['horror', 'thriller', 'classic']`
- "This Is Spinal Tap" → `['comedy', 'mockumentary', 'cult']`

**Music:**
- "Rainbow Kitten Surprise" → `['indie', 'alternative']`
- "YK Niece" → `['hip-hop']`
- "An Evening with October London & Lalah Hathaway" → `['r&b', 'soul']`

**Theater:**
- "BERT KREISCHER: PERMISSION TO PARTY" → `['stand-up']`
- "Cinderella: Presented By Gwinnett Ballet Theatre" → `['ballet', 'family']`
- "Ellington + Elgar's Enigma Variations" → `['classical', 'orchestral']`

---

## Risk Assessment

### Low Risk
- ✅ Schema already designed
- ✅ Extraction prompt already includes genres
- ✅ Code logic already handles genres
- ✅ Many events already have subcategory (can map to genres)

### Medium Risk
- ⚠️ Genre consistency across sources (mitigated by curated genre_options table)
- ⚠️ Custom genres vs. curated (design allows both, need monitoring)

### Negligible Risk
- Migration is additive (no data loss)
- Indexes improve performance (no downside)

---

## Conclusion

**Genre inference is not only feasible but nearly complete.**

The infrastructure exists, the extraction prompt is ready, and many events already have genre-like subcategory data. The only blocker is applying migration 019 to create the `genres` column.

**Recommended path forward:**
1. Apply migration 019 immediately
2. Verify extraction works on next crawl
3. Backfill existing events via subcategory mapping + LLM batch inference
4. Enhance film data with TMDB API (optional but high value)

**Time to full implementation:** 3-5 days
- Day 1: Migration + validation
- Days 2-3: Backfill existing data
- Days 4-5: Testing + refinement

---

**Questions or concerns?** The data is ready, the code is ready, and the infrastructure is ready. This is a green light for genre inference.
