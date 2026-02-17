# Global Atlanta Track Data Quality Assessment - Summary

**Date**: 2026-02-14  
**Track**: `a-beautiful-mosaic` (Global Atlanta / International Culture)  
**Assessment**: Critical - Track is empty and needs immediate attention  

---

## Key Findings

1. **Track is currently EMPTY**: `explore_track_venues` table has 0 venues for this track
2. **User complaint confirmed**: Track should showcase cultural centers, markets, and community organizations, NOT just restaurants
3. **15 venues found ready to add immediately** from existing database
4. **3+ critical venues missing** from database entirely (Your DeKalb Farmers Market, Global Village Project, Refugee Coffee Co.)
5. **Geographic gaps**: Clarkston (only 1 venue), Decatur (0 international venues), SW/SE Atlanta underrepresented
6. **Image coverage**: ~60% of recommended venues have images, 40% need image sourcing

---

## Deliverables Created

### 1. `GLOBAL_ATLANTA_TRACK_VENUES_DIAGNOSTIC.md`
Comprehensive data quality report including:
- 15 venues recommended for immediate addition
- Venue type consistency issues
- Geographic distribution analysis
- Image coverage assessment
- Missing venue identification
- Validation queries

### 2. `GLOBAL_ATLANTA_TRACK_FIX.sql`
Executable SQL script to:
- Add 15 cultural venues to the track
- Fix venue types (international_market, nonprofit, etc.)
- Set missing neighborhoods
- Verify results

### 3. `GLOBAL_ATLANTA_VENUES_TO_ADD.md`
Research TODO list for venues NOT in database:
- Your DeKalb Farmers Market (Priority 1)
- Global Village Project (Priority 1)
- Refugee Coffee Company (Priority 1)
- Clarkston community venues (Priority 2)
- Hindu temples, mosques, Buddhist centers (Priority 3)
- Korean/Ethiopian cultural centers (Priority 4)

### 4. TypeScript search scripts (in `web/scripts/`)
- `find-cultural-venues.ts` - Main venue search across multiple patterns
- `find-cultural-venues-final.ts` - Specific high-value venue search

---

## Immediate Actions (Ready to Execute)

### Step 1: Run the SQL fix script
```bash
# Connect to Supabase and run:
psql [connection-string] < GLOBAL_ATLANTA_TRACK_FIX.sql
```

This will:
- Add 15 venues to the track
- Fix venue types for Plaza Fiesta, Plaza Las Americas, Buford Highway FM, etc.
- Update missing neighborhood data

### Step 2: Verify the fix
```sql
SELECT COUNT(*) FROM explore_track_venues WHERE track_slug = 'a-beautiful-mosaic';
-- Should return: 15

SELECT v.name, v.venue_type, v.neighborhood 
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_slug = 'a-beautiful-mosaic'
ORDER BY etv.sort_order;
-- Should show all 15 venues with correct types
```

---

## Recommended Venues Added (15 total)

### Markets (4)
1. Plaza Fiesta (ID: 2623)
2. Plaza Las Americas (ID: 2430)
3. Buford Highway Farmers Market (ID: 1205)
4. Sweet Auburn Curb Market (ID: 352)

### Cultural/Community Centers (7)
5. Latin American Association (ID: 756)
6. International Rescue Committee Atlanta (ID: 3931)
7. Center for Pan Asian Community Services (ID: 3901)
8. Shrine Cultural Center (ID: 979)
9. Westside Cultural Arts Center (ID: 1972)
10. Ebenezer Baptist Church (ID: 985)
11. MJCCA (ID: 2177)

### International Neighborhood Venues (4)
12. Blooms Emporium Chinatown (ID: 1804) - Chamblee
13. Jeju Sauna (ID: 1722) - Duluth
14. Hudgens Center for Art & Learning (ID: 1334) - Duluth
15. Fine Arts Gallery, GSU Clarkston Campus (ID: 649) - Clarkston

---

## Next Steps (Short-term)

### Week 1: Data Enrichment
1. Source images for venues without them:
   - Plaza Fiesta → Google Maps scrape
   - Plaza Las Americas → Google Maps scrape
   - Sweet Auburn Curb Market → Official website
   - Latin American Association → Organization website
   - IRC Atlanta → Organization website
   - CPACS → Organization website

2. Add `explore_blurb` descriptions for all 15 venues
3. Set `explore_category` (food_culture, hidden_gems, etc.)

### Week 2: Missing Venue Creation
1. Create venue record for **Your DeKalb Farmers Market**
   - Address: 3000 E Ponce de Leon Ave, Decatur, GA 30030
   - Get lat/lng, image, description
   - Check for event calendar (cooking classes?)

2. Create venue record for **Global Village Project**
   - Research address, website
   - Check for community events

3. Create venue record for **Refugee Coffee Company**
   - Research current status (may have moved/closed?)

### Week 3: Clarkston Deep Dive
- Research Clarkston community venues
- Target: Add 5-10 venues representing refugee communities
- Focus: Community centers, cultural organizations, multi-faith worship spaces

### Week 4: Cultural/Religious Centers
- Add 2-3 Hindu temples
- Add 1-2 mosques
- Add 1-2 Buddhist centers
- Add Ethiopian/Korean cultural organizations

---

## Geographic Balance Target

| Area | Current | Target | Gap |
|------|---------|--------|-----|
| Buford Highway Corridor | 3 | 5 | +2 |
| Clarkston | 1 | 6-8 | +5-7 |
| Decatur | 0 | 2 | +2 |
| Chamblee | 1 | 3 | +2 |
| Duluth | 2 | 3 | +1 |
| Doraville | 0 | 2 | +2 |
| Downtown | 3 | 3 | ✓ |
| SW/SE Atlanta | 0 | 2-3 | +2-3 |

**Total venues target**: 25-30 venues

---

## Quality Metrics - Before vs After Fix

| Metric | Before | After Fix | Target |
|--------|--------|-----------|--------|
| Venue Count | 0 | 15 | 25-30 |
| Markets | 0 | 4 | 5-6 |
| Cultural Centers | 0 | 7 | 10-12 |
| Geographic Areas | 0 | 6 | 8-10 |
| Image Coverage | N/A | ~60% | 90%+ |
| Restaurant % | 100%? | 0% | 0-10% |

---

## Files Reference

All files located in repo root:

- `GLOBAL_ATLANTA_TRACK_VENUES_DIAGNOSTIC.md` - Full diagnostic report
- `GLOBAL_ATLANTA_TRACK_FIX.sql` - Executable SQL fix
- `GLOBAL_ATLANTA_VENUES_TO_ADD.md` - Research TODO list
- `GLOBAL_ATLANTA_SUMMARY.md` - This file

Search scripts:
- `web/scripts/find-cultural-venues.ts`
- `web/scripts/find-cultural-venues-final.ts`

---

## Success Criteria

Track will be considered "healthy" when:

- [ ] 25-30 venues in track
- [ ] < 10% are restaurants/bars
- [ ] 8+ geographic areas represented
- [ ] 90%+ image coverage
- [ ] At least 3 venues in Clarkston
- [ ] Your DeKalb Farmers Market added
- [ ] 3+ temples/mosques/cultural worship centers
- [ ] 2+ refugee-focused organizations/venues
- [ ] All venues have `explore_blurb` descriptions
- [ ] Event crawlers created for venues with calendars

