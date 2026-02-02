# Geographic Expansion Quick Reference Card

**Purpose:** One-page cheat sheet for expanding LostCity to new geographic areas  
**Full Guide:** `/Users/coach/Projects/LostCity/GEOGRAPHIC_EXPANSION_PLAYBOOK.md`

---

## 5-Minute Overview

**Timeline:** 2-3 weeks from research to launch  
**Minimum Team:** 1 data engineer + 1 QA reviewer  
**Minimum Events:** 30+ events before launch  
**Key Bottleneck:** Neighborhood mapping (4-6 hours of research)

---

## Phase 1: Assessment (Day 1-2)

### Research Checklist
- [ ] Define lat/lng boundaries for new area
- [ ] List 10-20 core venues (theaters, museums, venues)
- [ ] Identify 5-10 event sources (venue calendars, aggregators)
- [ ] Check existing database coverage

### Commands
```bash
cd /Users/coach/Projects/LostCity/crawlers
source venv/bin/activate

# Run baseline audit
python data_audit.py

# Check existing venues
psql $DATABASE_URL -c "SELECT name, city, neighborhood FROM venues WHERE city ILIKE '%NewCity%';"
```

**Gate:** Don't proceed if Atlanta baseline health <B (85/100)

---

## Phase 2: Neighborhood Mapping (Day 3)

### Steps
1. Research 5-10 neighborhood names (Wikipedia, real estate sites)
2. Get lat/lng boundaries from Google Maps (right-click corners)
3. Add to `fix_neighborhoods.py`:

```python
# In NEIGHBORHOOD_BOUNDARIES dict
"Downtown Athens": (33.950, 33.960, -83.385, -83.370),
"Five Points": (33.955, 33.965, -83.380, -83.365),

# In ZIP_TO_NEIGHBORHOOD dict
"30601": "Downtown Athens",
"30605": "Five Points",
```

4. Run assignment:
```bash
python fix_neighborhoods.py --dry-run  # Preview
python fix_neighborhoods.py            # Apply
python check_remaining_venues.py       # Verify
```

**Target:** >85% of venues have neighborhoods

---

## Phase 3: Source Integration (Day 4-5)

### Crawler Template
```python
# crawlers/sources/venue_name.py
VENUE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",
    "address": "123 Main St",
    "neighborhood": "Downtown",  # From Phase 2
    "city": "Athens",
    "state": "GA",
    "zip": "30601",
    "venue_type": "theater",
    "website": "https://venue.com",
}

def crawl(source: dict) -> tuple[int, int, int]:
    venue_id = get_or_create_venue(VENUE_DATA)
    # ... fetch events ...
    # ... insert_event() for each ...
    return events_found, events_new, events_updated
```

### Test Crawler
```bash
python main.py --source venue-slug --dry-run  # Test
python main.py --source venue-slug            # Run
```

---

## Phase 4: Validation (Day 6)

### Pre-Launch Checklist

```sql
-- 1. Event count (minimum 30)
SELECT COUNT(*) FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens' AND e.start_date >= CURRENT_DATE;

-- 2. Neighborhood coverage (target >85%)
SELECT COUNT(*) FILTER (WHERE neighborhood IS NOT NULL) * 100.0 / COUNT(*)
FROM venues WHERE city = 'Athens';

-- 3. Duplicate check (target <1%)
SELECT title, start_date, COUNT(*) FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens'
GROUP BY title, start_date HAVING COUNT(*) > 1;

-- 4. Missing critical fields
SELECT 
  COUNT(*) FILTER (WHERE description IS NULL OR LENGTH(description) < 50) * 100.0 / COUNT(*) as missing_desc_pct,
  COUNT(*) FILTER (WHERE image_url IS NULL) * 100.0 / COUNT(*) as missing_img_pct
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens' AND e.start_date >= CURRENT_DATE;
```

### Launch Gates (Must Pass)
- [x] Total events ≥ 30
- [x] Neighborhood coverage ≥ 70%
- [x] Duplicate rate < 3%
- [x] Active sources ≥ 3

### Quality Targets (Nice to Have)
- [ ] Neighborhood coverage ≥ 85%
- [ ] Missing descriptions < 15%
- [ ] Missing images < 20%
- [ ] Forward coverage ≥ 2 months

---

## Phase 5: Launch & Monitor (Day 7+)

### Week 1: Daily Checks
```sql
-- Events added in last 24 hours
SELECT s.name, COUNT(e.id) as new_events
FROM events e
JOIN sources s ON s.id = e.source_id
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens' AND e.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.name;
```

### Week 2-4: Weekly Audit
```bash
python data_audit.py > weekly_audit_$(date +%Y%m%d).txt
```

### Month 1+: Standard Monitoring
Follow `DATA_QUALITY_MONITORING.md` queries

---

## Common Issues & Quick Fixes

### Issue: High "Unknown" Neighborhood (>20%)

**Fix:**
1. Check venues missing coordinates: `SELECT name, address FROM venues WHERE city='Athens' AND (lat IS NULL OR lng IS NULL);`
2. Geocode manually or run: `python hydrate_venues_foursquare.py --city Athens`
3. Expand neighborhood boundaries in `fix_neighborhoods.py`
4. Re-run: `python fix_neighborhoods.py`

### Issue: Crawler Produces 0 Events

**Fix:**
1. Test manually: `python main.py --source slug --dry-run`
2. Check source website for events
3. Review error in console output
4. Update crawler parsing logic

### Issue: High Duplicates (>5%)

**Fix:**
1. Find duplicates: `SELECT title, start_date, COUNT(*) FROM events WHERE city='Athens' GROUP BY title, start_date HAVING COUNT(*) > 1;`
2. Check if from different sources (cross-posting is OK)
3. Improve content_hash in crawler
4. Manually merge obvious duplicates

---

## Success Metrics Timeline

### Week 1
- 50+ events
- 5+ active sources
- 80%+ neighborhood coverage

### Month 1
- 100+ events
- 10+ active sources
- 85%+ neighborhood coverage
- 2 months forward coverage

### Quarter 1
- 200+ events
- 15+ active sources
- All categories represented
- B+ data quality score

---

## Key Files & Commands

### Scripts
```bash
# Data quality
python data_audit.py                           # Full audit
python fix_neighborhoods.py                    # Assign neighborhoods
python check_remaining_venues.py               # Find gaps
python hydrate_venues_foursquare.py --city X   # Geocode

# Crawlers
python main.py --list                          # List sources
python main.py --source slug --dry-run         # Test
python main.py --source slug                   # Run
```

### Documentation
- Full playbook: `/Users/coach/Projects/LostCity/GEOGRAPHIC_EXPANSION_PLAYBOOK.md`
- Summary: `/Users/coach/Projects/LostCity/EXPANSION_RECOMMENDATIONS_SUMMARY.md`
- Monitoring: `/Users/coach/Projects/LostCity/DATA_QUALITY_MONITORING.md`
- Audit guide: `/Users/coach/Projects/LostCity/DATA_AUDIT_README.md`

### Sample Crawlers
- `/Users/coach/Projects/LostCity/crawlers/sources/marietta_cobb_museum.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/the_earl.py`
- `/Users/coach/Projects/LostCity/crawlers/sources/spivey_hall.py`

---

## Next Recommended Expansions

1. **Athens, GA** - College town, music scene, 200-300 events/month
2. **Roswell/Alpharetta** - North Fulton suburbs, 100-150 events/month
3. **Decatur** - Already partial coverage, formalize, 50-100 events/month

---

**Questions?** See full playbook or contact Data Quality Team

**Last Updated:** 2026-01-31
