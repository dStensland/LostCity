# Happy Hours & Specials - Executive Summary

**Date:** February 14, 2026  
**Status:** Infrastructure Complete, Data Coverage at ~5%  
**Priority:** HIGH (top 3 user-requested feature)

---

## TL;DR

We have **production-ready infrastructure** for happy hours and specials but only **217 venue_specials records** covering ~5-6% of bars/restaurants. Running one systematic scrape across our 302 bars + 671 restaurants would increase coverage to 500-700+ records within 2 weeks.

---

## Current State

### What Works ✓

1. **Database Schema** (migration 167)
   - `venue_specials` table with 217 active records
   - Time-aware: days_of_week, time_start/time_end
   - Types: happy_hour, daily_special, recurring_deal, brunch, event_night
   - Confidence scoring and last_verified_at tracking

2. **API Infrastructure**
   - `/api/portals/[slug]/destinations/specials` - sophisticated proximity + time-aware ranking
   - Real-time state calculation (active_now, starting_soon, inactive)
   - Distance scoring, social proof, confidence weighting
   - 60s cache with stale-while-revalidate

3. **UI Components**
   - SpecialsCarousel - polished carousel for active specials
   - Time-remaining badges, distance labels
   - Empty state handling
   - Currently deployed in FORTH hotel portal

4. **Data Extraction**
   - `scrape_venue_specials.py` - LLM-powered crawler
   - Fetches main page + /menu, /happy-hour, /specials subpages
   - Extracts specials, hours, menu_url, reservation_url
   - 477 lines of production code

5. **Taxonomy**
   - `nightlife.specials` subcategory defined
   - Pattern matching in tag_inference.py (lines 1160-1165)
   - Supports both events (one-time) and venue attributes (recurring)

### What's Missing ✗

1. **Data Coverage** - CRITICAL GAP
   - Only 217 venue_specials records
   - 302 bars × ~6% = only ~18 bars with data
   - 671 restaurants × ~5% = only ~34 restaurants with data
   - 0 events tagged with 'specials' genre

2. **Crawler Integration**
   - scrape_venue_specials.py NOT in main.py orchestrator
   - No scheduled re-runs (freshness risk)
   - Appears manually run for FORTH corridor only

3. **UI Exposure**
   - Only shown in FORTH hotel portal
   - NOT in main Atlanta feed
   - NOT in Find/Explore tab
   - NOT on venue detail pages

4. **Genre Backfill**
   - ~20 events have specials keywords in title but no 'specials' genre
   - Tag inference pattern exists but not applied retroactively

---

## The Numbers

| Metric | Current | Potential | Gap |
|--------|---------|-----------|-----|
| venue_specials records | 217 | 600-800 | **73% missing** |
| Bars with specials | ~18 (6%) | 150-200 (50-66%) | **88% missing** |
| Restaurants with specials | ~34 (5%) | 200-300 (30-45%) | **83% missing** |
| Events with specials genre | 0 | 15-25 | **100% missing** |
| Nightlife genres with 0 events | 6 of 16 | 0 of 16 | **38% taxonomy unused** |

---

## Immediate Actions (This Week)

### 1. Run Systematic Scrape (6-8 hours runtime)

```bash
cd /Users/coach/Projects/LostCity/crawlers

# All bars in Atlanta
python3 scrape_venue_specials.py --venue-type bar --limit 300

# Restaurants with brunch/specials potential
python3 scrape_venue_specials.py --venue-type restaurant --limit 200

# Nightclubs
python3 scrape_venue_specials.py --venue-type nightclub --limit 60
```

**Expected Output:**
- 300-500 new venue_specials records
- Coverage increases to 50-60% of bars
- Coverage increases to 30-40% of restaurants

**Estimated Time:** 6-8 hours with rate limiting (can run overnight)

### 2. Backfill Genre Tags (30 minutes)

Run SQL query in Supabase:

```sql
UPDATE events
SET genres = CASE 
  WHEN genres IS NULL THEN ARRAY['specials']
  ELSE array_append(genres, 'specials')
END
WHERE (
    title ILIKE '%happy hour%' OR 
    title ILIKE '%drink special%' OR
    title ILIKE '%taco tuesday%' OR
    title ILIKE '%wing night%' OR
    title ILIKE '%oyster night%' OR
    title ILIKE '%ladies night%' OR
    title ILIKE '%industry night%'
  )
  AND category = 'nightlife'
  AND (genres IS NULL OR NOT ('specials' = ANY(genres)));
```

**Expected:** 15-20 events updated

### 3. Expand UI to Main Portal (2-3 hours)

Add SpecialsCarousel to main Atlanta portal:
- Import component into main feed
- Add "Active Specials Nearby" section
- Show between 2pm-11pm (time-aware)

---

## Short-Term Actions (Next 2 Weeks)

### 1. Integrate Scraper into Orchestrator
- Add to main.py source registry
- Create source record in database
- Schedule quarterly re-runs

### 2. Manual Curation Pass
- Top 50 Atlanta bars known for specials
- Verify with website/social media
- Set confidence=high

### 3. Venue Detail Page Integration
- Add "Specials" section to venue profiles
- Show recurring weekly specials
- Link to active specials feed

---

## Medium-Term Actions (Next Month)

1. **Crowdsourced Corrections**
   - "Report incorrect special" button
   - User-submitted specials
   - Moderation workflow

2. **Venue Partnerships**
   - Self-service admin for business owners
   - "Verified Specials" badge
   - Priority placement for verified records

3. **Notification System**
   - Push: "Happy hour starting in 30 min at [nearby bar]"
   - Filter by followed venues
   - Requires location permission

---

## Success Metrics

### Phase 1 (2 weeks)
- [ ] 500+ venue_specials records
- [ ] 150+ bars with specials (~50% coverage)
- [ ] 200+ restaurants with specials (~30% coverage)
- [ ] Specials visible in main Atlanta portal

### Phase 2 (1 month)
- [ ] 700+ venue_specials records
- [ ] Quarterly scrape schedule active
- [ ] User correction workflow live
- [ ] Venue partnerships launched

### Phase 3 (3 months)
- [ ] 90% freshness (last_verified < 90 days)
- [ ] 10+ venue self-submissions per week
- [ ] Push notifications active
- [ ] Geographic expansion ready (Nashville, Charleston)

---

## Files to Review

**Research & Documentation:**
- `/Users/coach/Projects/LostCity/SPECIALS_HAPPY_HOUR_RESEARCH_REPORT.md` (821 lines, comprehensive analysis)
- `/Users/coach/Projects/LostCity/SPECIALS_VALIDATION_QUERIES.sql` (SQL queries for QA)

**Database:**
- `database/migrations/167_venue_specials.sql` - schema definition
- `database/migrations/169_forth_venues_and_specials.sql` - FORTH seed data

**Crawlers:**
- `crawlers/scrape_venue_specials.py` - LLM extraction (477 lines)
- `crawlers/sources/recurring_social_events.py` - weekly events generator
- `crawlers/tag_inference.py` - genre assignment (lines 1160-1165)

**Web:**
- `web/app/api/portals/[slug]/destinations/specials/route.ts` - API (590 lines)
- `web/app/[portal]/_components/concierge/sections/SpecialsCarousel.tsx` - UI component
- `web/lib/search-constants.ts` - taxonomy (line 71: nightlife.specials)

**PRDs:**
- `prds/006-specials-destination-experience.md` - product requirements

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| LLM extraction inaccuracies | Medium | Confidence scoring, user corrections |
| Stale specials data | Medium | Quarterly re-scrape, last_verified_at tracking |
| Venue website blocks scraper | Low | Rate limiting, respectful User-Agent |
| Legal issues (TOS violations) | Low | Scraping public data, attribution via source_url |
| User trust if data is wrong | High | "Last verified" badges, easy correction flow |

---

## Estimated Effort

| Phase | Engineering Hours | Timeline |
|-------|------------------|----------|
| Phase 1 (scrape + backfill + UI) | 40-60 hours | 2 weeks |
| Phase 2 (integration + curation) | 20-30 hours | +2 weeks |
| Phase 3 (ongoing + partnerships) | 10 hours/month | Ongoing |

**Total initial investment:** 60-90 hours  
**Ongoing maintenance:** 10 hours/month

---

## Recommendation

**Proceed with Phase 1 immediately.** Infrastructure is production-ready, gap is purely data coverage. Running the systematic scrape would transform this from a FORTH-only feature to a platform-wide differentiator within 2 weeks.

**Priority rationale:** Happy hour/specials search is consistently in the top 3 user requests for nightlife discovery apps. Competitors (Yelp, Google Maps) show operating hours but NOT time-sensitive specials state. This is a winnable competitive advantage.

---

**Prepared by:** Data Quality Specialist  
**Date:** February 14, 2026  
**Next Review:** After Phase 1 completion (target: Feb 28, 2026)
