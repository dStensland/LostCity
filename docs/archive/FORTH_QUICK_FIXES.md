# FORTH Portal - Quick Fixes (Priority Actions)

## Fix #1: Remove Nashville Events (5 min)

```sql
-- Step 1: Identify Nashville venues contaminating Atlanta feed
SELECT DISTINCT v.id, v.name, v.city, v.neighborhood 
FROM events e 
JOIN venues v ON e.venue_id = v.id 
WHERE e.start_date >= CURRENT_DATE 
  AND v.neighborhood IN ('Downtown Nashville', 'Green Hills', 'SoBro')
LIMIT 50;

-- Step 2: Fix venue cities if NULL
UPDATE venues 
SET city = 'Nashville', state = 'TN'
WHERE neighborhood IN ('Downtown Nashville', 'Green Hills', 'SoBro', 'The Gulch')
  AND (city IS NULL OR city != 'Nashville');

-- Step 3: Verify fix
SELECT COUNT(*), v.city 
FROM events e 
JOIN venues v ON e.venue_id = v.id 
WHERE e.start_date >= CURRENT_DATE 
  AND e.start_date <= CURRENT_DATE + INTERVAL '7 days'
GROUP BY v.city 
ORDER BY COUNT(*) DESC;
```

**Impact:** Removes 81 irrelevant Nashville events from FORTH feed  
**Expected Result:** Only Atlanta events shown

---

## Fix #2: Enrich Walkable Venue Images (30 min)

```bash
# From crawlers directory
cd /Users/coach/Projects/LostCity/crawlers

# Scrape images from venue websites
python3 scrape_venue_images.py --neighborhood "Midtown"
python3 scrape_venue_images.py --neighborhood "Downtown"
python3 scrape_venue_images.py --neighborhood "Old Fourth Ward"

# Fallback to Google Places for venues without websites
python3 fetch_venue_photos_google.py --neighborhood "Midtown" --limit 100
python3 fetch_venue_photos_google.py --neighborhood "Downtown" --limit 100
```

**Impact:** +40-50 venue images for walkable destinations  
**Priority Venues:**
- Politan Row (food hall, 0.05mi from FORTH)
- Bar Margot (bar, 0.17mi)
- Pandora's Box (bar, 0.19mi)
- 8Arm (bar)
- The Plaza Theatre (cinema)

---

## Fix #3: Fix Tara Theatre Poster Integration (15 min)

```bash
# Check if TMDB API key is configured
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "from config import get_config; print(get_config().api.omdb_api_key)"

# Test TMDB integration for recent Tara Theatre events
python3 << 'PYTHON'
from db import get_db
from posters import get_metadata_for_film_event

db = get_db()

# Get recent Tara events without images
tara_events = db.table('events').select('*').eq('source_id', <TARA_SOURCE_ID>).is_('image_url', 'null').limit(10).execute()

for event in tara_events.data:
    print(f"Testing: {event['title']}")
    metadata = get_metadata_for_film_event(event['title'], event.get('start_date', '')[:4])
    if metadata and metadata.get('poster_url'):
        print(f"  ✅ Found poster: {metadata['poster_url']}")
    else:
        print(f"  ❌ No poster found")
PYTHON
```

**Impact:** +9 event images per week for film screenings

---

## Fix #4: Add Nightlife Crawlers (High Priority)

See `NIGHTLIFE_CRAWLERS_SUMMARY.md` for full details. Priority targets:

### Immediate Adds (Walking Distance from FORTH)

1. **Sister Louisa's Church of the Living Room and Ping Pong Emporium**
   - Distance: 0.8mi from FORTH
   - Events: Bingo, drag shows, themed nights
   - Impact: +8-12 nightlife events/week

2. **Blake's on the Park**
   - Distance: 0.21mi from FORTH
   - Events: LGBTQ nightlife, drag, karaoke
   - Impact: +5-7 nightlife events/week

3. **Ten Atlanta**
   - Distance: 0.18mi from FORTH
   - Events: LGBTQ nightlife, DJ nights
   - Impact: +4-6 nightlife events/week

4. **Ormsby's**
   - Distance: 1.2mi
   - Events: Bocce, bar games, trivia
   - Impact: +6-8 nightlife events/week

5. **Painted Duck**
   - Distance: 1.1mi
   - Events: Bowling, games, late night
   - Impact: +5-7 nightlife events/week

**Combined Impact:** +30-40 nightlife events/week within 1.5mi of hotel

---

## Fix #5: Implement Walkable Event Filter (Product)

Add to FORTH portal settings:

```json
{
  "location": {
    "lat": 33.7834,
    "lng": -84.3831,
    "max_distance_miles": 2.0
  },
  "feed": {
    "prioritize_walkable": true,
    "walkable_boost_factor": 2.0
  }
}
```

Then update feed API to:
1. Calculate distance for all events
2. Boost walkable events in auto-filtered sections
3. Add "Nearby" section showing only <1mi events

**Impact:** Hotel guests see relevant, walkable content first

---

## Success Metrics (Track Weekly)

| Metric | Before | Target | How to Measure |
|--------|--------|--------|----------------|
| Walkable events (<1mi) | 66 | 150+ | SQL query with lat/lng bounds |
| Late night events (10pm+) | 27 | 75+ | `WHERE start_time >= '22:00'` |
| Food/drink events | 36 | 80+ | `WHERE category = 'food_drink'` |
| Nightlife events | 16 | 60+ | `WHERE category = 'nightlife'` |
| Image coverage | 82% | 90%+ | `SUM(image_url IS NOT NULL) / COUNT(*)` |
| Walkable venues with images | 60 | 100+ | Venues <1mi with `image_url IS NOT NULL` |

---

## Validation Checklist

After implementing fixes, verify:

- [ ] No Nashville events in FORTH feed
- [ ] Politan Row has hero image
- [ ] Tara Theatre film events have TMDB posters
- [ ] Sister Louisa's events appearing in feed
- [ ] Blake's events appearing in feed
- [ ] Nightlife count >40 events/week
- [ ] Walkable event count >120
- [ ] Image coverage >85%

---

**Next Review:** 1 week from implementation  
**Owner:** Data Quality Team + Crawler Team
