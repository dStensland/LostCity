# Global Atlanta Track Data Quality Assessment

**Date**: 2026-02-14  
**Track**: `a-beautiful-mosaic` (Explore City Tracks feature)  
**Status**: Critical data quality issue - Track is empty  
**Deliverables**: 5 files + 2 TypeScript search scripts

---

## Quick Start

### Problem
The "A Beautiful Mosaic" explore track is currently empty (0 venues) but should showcase Atlanta's international cultural infrastructure - markets, cultural centers, community organizations, and gathering places representing the city's diverse immigrant communities.

### Solution
We've identified 15 venues ready to add immediately, plus 3+ critical venues that need to be created. This assessment provides a complete roadmap to fix the track.

### Immediate Action
Run this SQL script to add 15 cultural venues to the track:

```bash
psql [your-supabase-connection] < GLOBAL_ATLANTA_TRACK_FIX.sql
```

---

## Files in this Assessment

### 1. `GLOBAL_ATLANTA_SUMMARY.md` (START HERE)
**6.2 KB | 205 lines**

Executive summary with:
- Key findings (track empty, 15 venues ready, 3+ missing)
- All deliverables overview
- Immediate actions to take
- Success criteria checklist
- Quality metrics before/after

**Read this first** for the big picture.

---

### 2. `GLOBAL_ATLANTA_TRACK_FIX.sql` (EXECUTABLE)
**2.1 KB | 49 lines**

Ready-to-run SQL script that:
- Adds 15 venues to the track
- Fixes venue types (international_market, nonprofit, etc.)
- Sets missing neighborhood data
- Includes verification query

**Run this** to fix the immediate problem.

---

### 3. `GLOBAL_ATLANTA_TRACK_VENUES_DIAGNOSTIC.md` (FULL REPORT)
**12 KB | 344 lines**

Comprehensive data quality diagnostic including:
- All 15 venues recommended (with tables)
- Venue type consistency issues
- Image coverage analysis (60% have images)
- Geographic distribution (11 neighborhoods)
- Missing venues identification
- Validation SQL queries
- Data quality scoring rubric

**Reference this** for detailed analysis and validation.

---

### 4. `GLOBAL_ATLANTA_VENUE_DETAILS.md` (REFERENCE TABLE)
**7.6 KB | 206 lines**

Detailed venue data tables with:
- 15 venues to add (organized by category)
- Additional venues found but not added yet
- Venues NOT in database (need creation)
- Image sourcing TODO list
- Venue type fixes needed
- Geographic distribution table
- Next actions checklist

**Use this** as a working reference during implementation.

---

### 5. `GLOBAL_ATLANTA_VENUES_TO_ADD.md` (RESEARCH TODO)
**4.6 KB | 152 lines**

Research task list for venues NOT in database:
- Priority 1: Your DeKalb FM, Global Village Project, Refugee Coffee
- Priority 2: Clarkston community venues
- Priority 3: Hindu temples, mosques, Buddhist centers
- Priority 4: International markets (Nam Dae Mun, etc.)
- Research methodology guide

**Follow this** to find and add missing venues.

---

## TypeScript Search Scripts

Located in `web/scripts/`:

### `find-cultural-venues.ts`
Main search script that queries the database for cultural venues across multiple patterns:
- Specific venue name searches (Plaza Fiesta, IRC, etc.)
- Venue type searches (community_center, market, nonprofit, etc.)
- Neighborhood searches (Clarkston, Doraville, Chamblee, etc.)
- Keyword searches (international, global, cultural, etc.)

### `find-cultural-venues-final.ts`
Targeted search for specific high-value venues:
- Plaza Fiesta / Plaza Las Americas
- Your DeKalb Farmers Market (NOT found - needs creation)
- Buford Highway Farmers Market
- Cultural/religious centers (temples, mosques, etc.)

**Run these** to explore the database and find additional venues.

---

## Key Findings Summary

### Current State (Before Fix)
- **Venue count**: 0
- **Track status**: Empty
- **User complaint**: "Almost all restaurants, needs cultural centers"

### After Running Fix Script
- **Venue count**: 15
- **Markets**: 4 (Plaza Fiesta, Plaza Las Americas, Buford Hwy FM, Sweet Auburn)
- **Cultural centers**: 7 (LAA, IRC, CPACS, Shrine, Westside Arts, Ebenezer, MJCCA)
- **Neighborhood venues**: 4 (Chamblee, Duluth, Clarkston)
- **Image coverage**: ~60% (9 of 15 have images)
- **Geographic spread**: 11 neighborhoods

### Still Needed (Short-term)
- Your DeKalb Farmers Market (create venue record)
- Global Village Project (create venue record)
- Refugee Coffee Company (create venue record)
- 5-8 more Clarkston venues (research + create)
- Images for 6 venues without them
- Explore blurbs for all venues

### Target State (4 weeks)
- **Venue count**: 25-30
- **Image coverage**: 90%+
- **Geographic areas**: 8-10
- **Restaurant %**: < 10%
- **Clarkston venues**: 3+
- **Cultural/religious centers**: 3+ temples/mosques

---

## Workflow

### Week 0 (Today)
1. Read `GLOBAL_ATLANTA_SUMMARY.md`
2. Run `GLOBAL_ATLANTA_TRACK_FIX.sql`
3. Verify with query: `SELECT COUNT(*) FROM explore_track_venues WHERE track_slug = 'a-beautiful-mosaic';`
4. Should return 15

### Week 1
1. Source images for 6 venues (use `GLOBAL_ATLANTA_VENUE_DETAILS.md` image TODO list)
2. Upload to Supabase storage
3. Update venue records with image URLs
4. Write explore_blurb for all 15 venues

### Week 2
1. Follow `GLOBAL_ATLANTA_VENUES_TO_ADD.md` Priority 1
2. Create venue records for Your DeKalb FM, Global Village, Refugee Coffee
3. Add these 3 to the track (INSERT into explore_track_venues)

### Week 3
1. Clarkston community audit (see Priority 2 in venues-to-add doc)
2. Research and create 5-8 Clarkston venues
3. Add to track

### Week 4
1. Cultural/religious centers (Priority 3)
2. Add 2-3 temples, 1-2 mosques, 1-2 Buddhist centers
3. Final quality check against success criteria

---

## Data Quality Metrics

| Metric | Before | After Fix | Target | Status |
|--------|--------|-----------|--------|--------|
| Venue Count | 0 | 15 | 25-30 | 50% |
| Markets | 0 | 4 | 5-6 | 67% |
| Cultural Centers | 0 | 7 | 10-12 | 58% |
| Geographic Areas | 0 | 11 | 8-10 | ✓ EXCEEDS |
| Image Coverage | N/A | 60% | 90%+ | 67% |
| Restaurant % | 100%? | 0% | <10% | ✓ |

---

## Success Criteria Checklist

Track will be considered "healthy" when:

- [ ] 25-30 venues in track (currently 0 → 15 after fix)
- [x] < 10% are restaurants/bars (0% after fix)
- [x] 8+ geographic areas represented (11 after fix)
- [ ] 90%+ image coverage (60% after fix)
- [ ] At least 3 venues in Clarkston (1 after fix)
- [ ] Your DeKalb Farmers Market added (not in database yet)
- [ ] 3+ temples/mosques/cultural worship centers (0 after fix)
- [ ] 2+ refugee-focused organizations/venues (1 after fix - IRC)
- [ ] All venues have `explore_blurb` descriptions (0 after fix)
- [ ] Event crawlers created for venues with calendars (0 after fix)

**Progress**: 2 of 10 criteria met after immediate fix (20%)  
**Target**: 10 of 10 after 4-week roadmap (100%)

---

## Questions?

This assessment was performed by the data quality specialist for LostCity on 2026-02-14.

All files are located in the repo root: `/Users/coach/Projects/LostCity/`

For questions or to report issues:
- Check the diagnostic report for root cause analysis
- Review the venue details table for specific data
- Use the validation queries in the diagnostic to verify fixes
- Follow the research TODO for missing venues

---

## Related Documentation

- `prds/020-explore-city-tracks.md` - Feature PRD for Explore City Tracks
- `web/lib/explore-tracks.ts` - TypeScript types and constants
- `web/lib/explore-constants.ts` - Explore feature constants
- `supabase/migrations/20260215100000_explore_tracks.sql` - Track schema migration
- `web/app/api/explore/tracks/route.ts` - Track list API endpoint
- `web/components/explore/ExploreTrackList.tsx` - Track UI component

