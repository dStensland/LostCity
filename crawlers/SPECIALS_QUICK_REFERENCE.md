# Specials & Happy Hours - Quick Reference Card

## Current State (One-Liner)
**Production-ready infrastructure, 217 records, ~5% coverage, zero events tagged**

## The Gap
- 302 bars → only ~18 have specials data (6% coverage)
- 671 restaurants → only ~34 have specials data (5% coverage)  
- 0 events tagged with 'specials' genre despite taxonomy existing

## Immediate Fix (Run Today)

### 1. Systematic Scrape (6-8 hours)
```bash
cd /Users/coach/Projects/LostCity/crawlers

# Scrape all bars
python3 scrape_venue_specials.py --venue-type bar --limit 300

# Scrape restaurants
python3 scrape_venue_specials.py --venue-type restaurant --limit 200
```
**Impact:** 300-500 new venue_specials records

### 2. Backfill Event Genres (30 min)
```sql
-- Run in Supabase SQL Editor
UPDATE events
SET genres = CASE 
  WHEN genres IS NULL THEN ARRAY['specials']
  ELSE array_append(genres, 'specials')
END
WHERE (title ILIKE '%happy hour%' OR title ILIKE '%drink special%' 
       OR title ILIKE '%taco tuesday%' OR title ILIKE '%wing night%')
  AND category = 'nightlife'
  AND (genres IS NULL OR NOT ('specials' = ANY(genres)));
```
**Impact:** 15-20 events tagged

## Key Files

**Crawlers:**
- `crawlers/scrape_venue_specials.py` - LLM extraction script (RUN THIS)
- `crawlers/tag_inference.py` - Lines 1160-1165 (specials patterns)

**Database:**
- `database/migrations/167_venue_specials.sql` - Table schema
- Query current data: `SELECT * FROM venue_specials WHERE is_active = true;`

**Web:**
- API: `web/app/api/portals/[slug]/destinations/specials/route.ts`
- UI: `web/app/[portal]/_components/concierge/sections/SpecialsCarousel.tsx`
- Taxonomy: `web/lib/search-constants.ts` (line 71)

## Validation Queries

```sql
-- Check coverage
SELECT 
  v.venue_type,
  COUNT(DISTINCT v.id) as total,
  COUNT(DISTINCT vs.venue_id) as with_specials,
  ROUND(COUNT(DISTINCT vs.venue_id) * 100.0 / COUNT(DISTINCT v.id), 1) as pct
FROM venues v
LEFT JOIN venue_specials vs ON v.id = vs.venue_id AND vs.is_active = true
WHERE v.venue_type IN ('bar', 'restaurant') AND v.active = true
GROUP BY v.venue_type;

-- Check genre usage
SELECT COUNT(*) FROM events WHERE 'specials' = ANY(genres);

-- Find scrape candidates (bars with websites, no specials)
SELECT id, name, neighborhood, website
FROM venues
WHERE venue_type = 'bar' AND active = true 
  AND website IS NOT NULL
  AND id NOT IN (SELECT venue_id FROM venue_specials WHERE is_active = true)
LIMIT 20;
```

## Expected Results After Phase 1

| Metric | Before | After Phase 1 | Target |
|--------|--------|--------------|--------|
| venue_specials | 217 | 500-700 | 800+ |
| Bar coverage | 6% | 50-60% | 80%+ |
| Restaurant coverage | 5% | 30-40% | 50%+ |
| Events w/ specials genre | 0 | 15-20 | 25+ |

## Known Issues to Watch

1. **Stale Data:** Records without `last_verified_at` are unverified
2. **Missing Prices:** Many specials lack `price_note` field
3. **Time Zones:** All times are local (America/New_York)
4. **UI Exposure:** Currently only in FORTH portal, not main feed

## Next Steps After Scrape

1. Review extraction quality (spot-check 20-30 random records)
2. Flag low-confidence records for manual verification
3. Add to main Atlanta portal UI (not just FORTH)
4. Schedule quarterly re-scrape for freshness

## Success Criteria

✓ 500+ venue_specials records  
✓ 50%+ bar coverage  
✓ Specials visible in main portal  
✓ Events backfilled with genres  

**Timeline:** 2 weeks
