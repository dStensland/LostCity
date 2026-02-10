# Phase B: Data Quality Triage - Executive Summary

**Date**: 2026-02-10
**Overall System Health**: 88.6/100 ⭐

## Key Findings

### System Health Scores
| Entity | Score | Status |
|--------|-------|--------|
| Festivals | 98.4/100 | ✅ Excellent |
| Venues | 95.0/100 | ✅ Excellent |
| Events | 92.0/100 | ✅ Excellent |
| Classes | 86.7/100 | ✅ Good |
| Organizations | 82.4/100 | ✅ Good |
| Series | 77.0/100 | ⚠️ Needs Improvement |

### Data Completeness
- **Total Events**: 10,872 (10,871 future, 1 past)
- **Total Venues**: 2,332
- **Active Sources**: ~500
- **Future Events Fill Rates**:
  - Title: 100% ✅
  - Start Date: 100% ✅
  - Category: 100% ✅
  - Venue: 97.9% ✅
  - Description: 89.4% ⚠️
  - Start Time: 88.8% ⚠️
  - Image: 88.4% ⚠️

### Tag Quality
- 96.0% have any tags ✅
- 46.2% have 3+ tags ⚠️ (target: 70%)
- 43.6% have experiential tags ⚠️ (target: 60%)
- 15.0% have genres ❌ (target: 40%)

## Critical Issues (Immediate Action Required)

### 1. Broken Crawlers (2 sources)
- **community-foundation-atl**: 27% success rate, brittle HTML parsing
- **bold-monk-brewing**: 36% success rate, Playwright timing issues

**Action**: Debug and fix within 1 week, or disable

### 2. Zero-Event Sources (5 sources)
- **sandy-springs-pac**: Year-round venue, likely extraction bug
- **candler-park-fest**: Seasonal (September) - set active_months
- **atlanta-greek-festival**: Seasonal (Sept/Oct) - set active_months
- **blade-show**: Seasonal (June) - set active_months
- **afropunk-atlanta**: Seasonal (Aug/Sept) - set active_months

**Action**: Fix sandy-springs-pac, set active_months for festivals

### 3. Missing Critical Data

**Venues:**
- 208 missing coordinates (8.9%) - blocks map view
- 514 missing neighborhoods (22.0%) - hurts filtering
- 787 missing images (33.7%) - poor UX
- 226 missing venue_type (9.7%) - breaks spot filtering

**Events (recent 5,000 sample):**
- 834 missing start_time (16.7%)
- 803 missing description (16.1%)
- 739 missing image (14.8%)

## High-Impact Quick Wins

### Run These Scripts Now (< 30 min each)
```bash
# 1. Fill venue coordinates (critical for maps)
python3 venue_enrich.py --only-missing-coords

# 2. Fill neighborhoods (important for filtering)
python3 venue_enrich.py --only-missing-neighborhoods

# 3. Classify venue types (required for spots)
python3 classify_venues.py

# 4. Backfill genres for music events
python3 scripts/backfill_genres.py
```

### Expected Impact
- Coordinates: 208 venues → 100% map coverage
- Neighborhoods: 514 venues → 95%+ filter accuracy  
- Venue types: 226 venues → 100% spot filtering
- Genres: ~1,000 music events gain genre tags

## Sources Needing Extraction Improvements

### Worst Missing Field Rates (>50% missing, >10 events)
| Source | Total Events | Missing Time | Missing Desc | Missing Img |
|--------|--------------|--------------|--------------|-------------|
| gwcc | 41 | 92.7% | 87.8% | 95.1% |
| zoo-atlanta | 22 | 100% | 54.5% | 63.6% |
| atlanta-supercross | 26 | 100% | 0% | 100% |
| coca-cola-roxy | 17 | 100% | 0% | 82.4% |
| fox-theatre | 10 | 100% | 0% | 80% |

**Root Cause**: Crawlers only parse calendar views, not event detail pages

**Fix**: Update to follow event detail links and extract full metadata

## Category Coverage Gaps

### Strong Coverage (>400 events)
- Music: 1,029
- Community: 731
- Art: 631
- Sports: 402

### Weak Coverage (<100 events) - Expansion Needed
- Fitness: 115 ⚠️
- Food & Drink: 92 ⚠️
- Comedy: 78 ⚠️
- Outdoor: 63 ⚠️

**Recommendation**: Add crawlers for:
- Comedy clubs: Dad's Garage, Village Theatre, Laughing Skull
- Fitness studios: YogaSix, OrangeTheory, F45
- Food events: Taste of Atlanta, food truck festivals
- Outdoor: BeltLine events, hiking groups

## 4-Week Action Plan

### Week 1: Critical Fixes
- [ ] Debug/fix community-foundation-atl
- [ ] Fix bold-monk-brewing timing
- [ ] Set active_months for seasonal sources
- [ ] Run all venue enrichment scripts

### Week 2: Data Backfill
- [ ] Backfill genres for music events
- [ ] Fix high missing-field sources (GWCC, Zoo, Fox)
- [ ] Run venue image scraper

### Week 3: Tag Quality
- [ ] Enhance tag_inference.py (experiential tags)
- [ ] Add venue-type → tag mappings
- [ ] Backfill tags on existing events

### Week 4: Coverage Expansion
- [ ] Add 5+ comedy crawlers
- [ ] Add 3+ fitness crawlers
- [ ] Add 2+ food festival crawlers

## Success Metrics

**Target State (End of Month 1)**:
- System health: 92+/100 (currently 88.6)
- Events with 3+ tags: 70% (currently 46.2%)
- Events with genres (music/film): 40% (currently 15%)
- Venues with coordinates: 100% (currently 91.1%)
- Venues with images: 80% (currently 66.3%)
- Broken source count: 0 (currently 2)

## Files Generated

1. `/Users/coach/Projects/LostCity/crawlers/reports/data_quality_triage_2026-02-10.md` - Full diagnostic report
2. `/Users/coach/Projects/LostCity/crawlers/reports/PHASE_B_SUMMARY.md` - This executive summary
3. `/Users/coach/Projects/LostCity/crawlers/scripts/data_quality_triage.py` - Reusable triage script

## Next Phase

**Phase C: Crawler Coverage Blitz** can run in parallel with data quality fixes. See DEV_PLAN.md for details.

---

*Generated: 2026-02-10 14:35*
*Data Quality Specialist: Claude Code*
