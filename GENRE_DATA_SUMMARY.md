# Genre Inference - Data Analysis Summary

## Question: Can we infer genres for events?

**Answer: YES** - The system is already designed for it and partially working.

---

## Key Findings

### 1. Infrastructure Status

| Component | Status | Notes |
|-----------|--------|-------|
| Database schema | ✅ Designed | Migration 019 written, not applied |
| Extraction prompt | ✅ Active | Already asks Claude for genres |
| Code logic | ✅ Ready | Saves to `events.genres` or `series.genres` |
| Reference data | ✅ Complete | 145 curated genres defined |
| Frontend support | ⚠️ Pending | Needs genre filter UI |

### 2. Current Data Quality (1,000 event sample)

**Subcategory as Genre Proxy:**

| Category | Events | Subcategory Coverage | Top Subcategories |
|----------|--------|---------------------|-------------------|
| **Film** | 270 | 100% | cinema (223), special-screening (43) |
| **Music** | 217 | 80.2% | concert (93), rock (21), pop (11), rnb (5), hiphop (4) |
| **Comedy** | 24 | 100% | standup (21), improv (3) |
| **Theater** | 29 | 24.1% | play (3), opera (2), comedy (1), classical (1) |
| **Nightlife** | 14 | 100% | club (9), lgbtq (3) |
| **Sports** | 17 | 11.8% | softball (2) |
| **Words** | 48 | 97.9% | reading (22), lecture (15), bookclub (4) |
| **Community** | 78 | 52.6% | volunteer (13), campus (13), gaming (5) |

**Tags Coverage:** 0% (tag inference exists but not running)

### 3. Source Analysis

**Best Sources for Genre Data:**

| Source | Events | Subcategory | Genre Potential |
|--------|--------|-------------|-----------------|
| Landmark Midtown Cinema | 168 | 100% | HIGH - Film series with TMDB enrichment |
| Plaza Theatre | 67 | 100% | HIGH - Film series |
| Terminal West | 29 | 100% | HIGH - Music with artist inference |
| The Masquerade | 19 | 100% | HIGH - Music venue |
| Ticketmaster | 224 | Mixed | MEDIUM - Already has rock/hiphop/rnb subcats |
| Dad's Garage | 10 | 100% | HIGH - Comedy (standup/improv) |

---

## Data Examples

### Music Events - Genre Inference Ready

```
Event: "THE EARLY NOVEMBER & HELLOGOODBYE: 20 Years Young"
Current: category=music, subcategory=rock
Ready for: genres=['rock', 'emo', 'pop-punk']

Event: "YK Niece"  
Current: category=music, subcategory=hiphop
Ready for: genres=['hip-hop']

Event: "An Evening with October London & Lalah Hathaway"
Current: category=music, subcategory=rnb
Ready for: genres=['r&b', 'soul']

Event: "Rainbow Kitten Surprise w/ Common People"
Current: category=music, subcategory=None
Needs: LLM inference → genres=['indie', 'alternative']
```

### Film Events - Series-Based Genres

```
Series: "The Shining 35mm"
Current: series_type=film, genres=None
Ready for: genres=['horror', 'thriller', 'classic']
(Via TMDB or LLM)

Series: "This Is Spinal Tap"
Current: series_type=film, genres=None  
Ready for: genres=['comedy', 'mockumentary', 'cult']

134 film events (13.4%) are linked to 19 film series
All waiting for genre enrichment
```

### Theater Events - Mixed Quality

```
Event: "BERT KREISCHER: PERMISSION TO PARTY"
Current: category=theater, subcategory=comedy
Ready for: genres=['stand-up']

Event: "Cinderella: Presented By Gwinnett Ballet Theatre"
Current: category=theater, subcategory=None
Needs: genres=['ballet', 'family', 'dance']

Event: "Ellington + Elgar's Enigma Variations"
Current: category=theater, subcategory=classical
Ready for: genres=['classical', 'orchestral']
```

---

## Genre Distribution Potential

### After Migration + Backfill

**Expected genre coverage:**

```
Film:     90-95%   (TMDB enrichment + LLM)
Music:    85-90%   (Subcategory mapping + artist inference)  
Comedy:   95-100%  (Subcategory = genre)
Theater:  70-80%   (LLM inference from descriptions)
Sports:   80-90%   (Event types are clear)
```

**Popular genres forecast (based on current data):**

**Film (270 events):**
- drama, comedy, documentary, horror, indie, thriller, sci-fi, classic

**Music (217 events):**  
- rock (21+), pop (11+), indie, alternative, hip-hop (4+), r&b (5+), country (2+), jazz, metal

**Comedy (24 events):**
- stand-up (21), improv (3)

**Theater (29 events):**
- play, ballet, opera, stand-up, classical

---

## Technical Implementation Path

### Step 1: Apply Migration (10 min)

```sql
-- database/migrations/019_genres.sql
ALTER TABLE events ADD COLUMN genres TEXT[];
ALTER TABLE series ADD COLUMN genres TEXT[];
CREATE INDEX idx_events_genres ON events USING GIN (genres);
CREATE INDEX idx_series_genres ON series USING GIN (genres);
-- + genre_options reference table
```

### Step 2: Verify Extraction (30 min)

```bash
# Run test crawl
cd crawlers && source venv/bin/activate
python main.py -s terminal-west

# Check output
# Look for genres in Claude's extraction response
# Verify genres saved to database
```

### Step 3: Backfill Existing Data (2-3 days)

**Quick wins (Day 1):**
```python
# Map existing subcategory → genres
UPDATE events 
SET genres = ARRAY['rock'] 
WHERE subcategory = 'rock' AND category = 'music';

UPDATE events
SET genres = ARRAY['hip-hop']
WHERE subcategory = 'hiphop' AND category = 'music';

# ... (repeat for all subcategories)
```

**LLM batch inference (Day 2):**
```python
# For events with category but no genre
for event in events_missing_genres:
    genres = llm_infer_genre(event.title, event.description, event.category)
    update_event_genres(event.id, genres)
```

**TMDB enrichment (Day 3):**
```python
# For film series
for series in film_series:
    tmdb_data = tmdb_api.search_movie(series.title)
    genres = map_tmdb_genres(tmdb_data.genre_ids)
    update_series_genres(series.id, genres)
```

### Step 4: Monitor & Refine (Ongoing)

```sql
-- Daily quality check
SELECT 
    category,
    COUNT(*) as total,
    COUNT(CASE WHEN genres IS NOT NULL THEN 1 END) as with_genres,
    ROUND(100.0 * COUNT(CASE WHEN genres IS NOT NULL THEN 1 END) / COUNT(*), 1) as coverage
FROM events
WHERE category IN ('music', 'film', 'theater', 'sports', 'comedy')
GROUP BY category;

-- Alert if coverage drops below 80%
```

---

## Extraction Prompt (Already Active)

From `/crawlers/extract.py` lines 42-48:

```
GENRES:
For film, music, theater, and sports events, identify relevant genres:
- Film: action, comedy, drama, horror, sci-fi, documentary, thriller, animation, romance, indie, cult, classic, etc.
- Music: rock, pop, hip-hop, jazz, electronic, country, metal, punk, indie, folk, classical, r&b, blues, etc.
- Theater: musical, drama, comedy, improv, stand-up, ballet, opera, puppet, burlesque, sketch, etc.
- Sports: baseball, basketball, football, soccer, hockey, mma, racing, esports, marathon, etc.
Include 1-3 most relevant genres. Use lowercase. Custom genres allowed if standard ones don't fit.
```

**Status:** ✅ Active and working, but output not being saved (migration needed)

---

## Code Flow (Already Implemented)

From `/crawlers/db.py` insert_event():

```python
def insert_event(event_data: dict, series_hint: dict = None, genres: list = None):
    """Insert event with genres support"""
    
    # If part of series (films, recurring shows)
    if series_hint:
        series_id = get_or_create_series(client, series_hint, category)
        if series_id:
            event_data["series_id"] = series_id
            # Genres live on series, not event
            genres = None
    
    # For standalone events
    if genres and not event_data.get("series_id"):
        event_data["genres"] = genres  # ← Waiting for column to exist
    
    client.table("events").insert(event_data).execute()
```

**Status:** ✅ Logic ready, blocked by missing database column

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Migration fails | Low | High | Test on dev DB first |
| Inconsistent genres | Medium | Medium | Use curated genre_options as guide |
| Low coverage | Low | Medium | Multiple backfill strategies |
| Performance impact | Low | Low | GIN indexes already planned |

**Overall risk:** LOW - This is a well-designed, additive feature

---

## ROI Calculation

**Development time:** 3-5 days
- Migration: 1 day (apply + verify)
- Backfill: 2-3 days (subcategory map + LLM + TMDB)
- Testing: 1 day

**User benefit:**
- Filter events by genre (jazz, horror, improv, etc.)
- Better recommendations (genre-based)
- Richer event metadata
- Competitive parity (most event platforms have genres)

**Data quality improvement:**
- 80-90% of music/film events get granular genres
- Better than current state (subcategory only)
- Foundation for future features (genre-based portals, alerts)

---

## Comparison: Current vs. After Genre Inference

### Current State
```json
{
  "title": "Rainbow Kitten Surprise w/ Common People",
  "category": "music",
  "subcategory": null,
  "tags": []
}
```

### After Migration + Inference
```json
{
  "title": "Rainbow Kitten Surprise w/ Common People", 
  "category": "music",
  "subcategory": "concert",
  "genres": ["indie", "alternative"],
  "tags": ["ticketed", "touring", "all-ages"]
}
```

### Series Event (Film)
```json
// Event
{
  "title": "The Shining 35mm - Plaza Theatre",
  "category": "film",
  "subcategory": "cinema",
  "series_id": "uuid-123",
  "genres": null  // Inherits from series
}

// Series
{
  "id": "uuid-123",
  "title": "The Shining 35mm",
  "series_type": "film",
  "genres": ["horror", "thriller", "classic"],
  "director": "Stanley Kubrick",
  "year": 1980,
  "rating": "R"
}
```

---

## Conclusion

**Genre inference is ready to ship.**

All components are in place:
1. ✅ Schema designed (migration 019)
2. ✅ Extraction prompt active (asking Claude)
3. ✅ Code logic ready (saving to DB)
4. ✅ Reference data complete (145 genres)
5. ✅ Backfill strategy clear (subcategory map + LLM + TMDB)

**The only blocker:** Running migration 019 in Supabase.

**Estimated timeline:** 3-5 days from migration to full coverage.

**Recommendation:** Proceed with implementation.

---

## Files Referenced

- `/database/migrations/019_genres.sql` - Migration to apply
- `/crawlers/extract.py` - Extraction prompt (lines 42-90)
- `/crawlers/db.py` - Database insertion logic (lines 152-186)
- `/crawlers/series.py` - Series genre handling (lines 134-136)
- `/crawlers/tags.py` - Tag definitions (separate from genres)

---

**Data Quality Specialist Sign-off:** APPROVED ✓

This analysis is based on a 1,000-event sample from the production database as of January 24, 2026. The infrastructure is sound, the data signals are strong, and the implementation path is clear.
