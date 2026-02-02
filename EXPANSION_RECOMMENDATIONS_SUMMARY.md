# Geographic Expansion: Key Recommendations

**Date:** 2026-01-31  
**Prepared for:** LostCity Product & Engineering Teams  
**Document:** Summary of GEOGRAPHIC_EXPANSION_PLAYBOOK.md

---

## Executive Summary

This document provides actionable recommendations for expanding LostCity event coverage to new geographic areas, based on analysis of existing data infrastructure and the successful Marietta expansion case study.

**Key Insight:** LostCity has robust data quality infrastructure that scales well to new areas. The main bottlenecks are:
1. Neighborhood mapping (manual boundary definition required)
2. Source discovery (research-intensive)
3. Geocoding validation (requires coordinate verification)

**Estimated Time to Add New Area:** 2-3 weeks (from research to launch)

---

## 1. Pre-Expansion Data Quality Checks

### What to Check Before Expanding

**Run these checks to ensure healthy baseline:**

```bash
# 1. Full data audit
cd /Users/coach/Projects/LostCity/crawlers
python data_audit.py

# 2. Neighborhood coverage check
python fix_neighborhoods.py --dry-run

# 3. Review summary
cat /Users/coach/Projects/LostCity/DATA_AUDIT_SUMMARY.md
```

**Quality Gate:** Don't expand if baseline health is below B (85/100)

**Current Atlanta Health (as of 2026-01-31):**
- Overall Score: B+ (85/100) ✅
- Duplicate Rate: 0.7% ✅
- Neighborhood Coverage: 89% ✅
- Missing Descriptions: 16.7% ⚠️ (acceptable)
- Active Sources: 326 ✅

**Recommendation:** Atlanta is ready for expansion. Address missing descriptions as ongoing improvement, not blocker.

---

## 2. Venue Coverage Gap Identification

### How to Find Venues in New Area

**Step 1: Research Core Venues (20-50 targets)**

Use this research checklist:

| Venue Type | Research Method | Example Query |
|------------|----------------|---------------|
| Performing Arts | Google Maps | "Athens GA theater" |
| Museums | Tourism board | VisitAthensGA.com |
| Sports Venues | University athletics | UGA Athletics website |
| Nightlife | Eventbrite search | "Athens GA nightlife events" |
| Community | City government | Athens-Clarke County events |

**Step 2: Validate Existing Coverage**

```sql
-- Check what's already in database
SELECT name, address, city, neighborhood, venue_type
FROM venues
WHERE city ILIKE '%Athens%'
  OR address ILIKE '%Athens%'
ORDER BY name;
```

**Step 3: Add Missing Venues**

Use the pattern from existing crawlers (see `marietta_cobb_museum.py`):

```python
VENUE_DATA = {
    "name": "Venue Name",
    "slug": "venue-slug",
    "address": "123 Main St",
    "neighborhood": "Downtown Athens",  # See Section 3
    "city": "Athens",
    "state": "GA",
    "zip": "30601",
    "venue_type": "theater",  # theater, museum, bar, park, etc.
    "website": "https://venue.com",
}

venue_id = get_or_create_venue(VENUE_DATA)
```

**Recommendation:** Start with 10-15 high-priority venues, expand as sources are added.

---

## 3. Neighborhood Mapping Strategy

### Critical for User Discovery

**Why Neighborhoods Matter:**
- 40.9% of Atlanta events had missing neighborhood data before fixes
- Neighborhoods enable location-based filtering
- Improves local relevance and discovery

**How to Map Neighborhoods:**

**Step 1: Research Neighborhood Names**
- Wikipedia: "[City] neighborhoods"
- Real estate sites (Zillow, Redfin)
- City planning department maps
- Local business districts

**Step 2: Define Lat/Lng Boundaries**

Use Google Maps:
1. Navigate to neighborhood
2. Right-click corners → "What's here?"
3. Note coordinates

**Example: Athens Neighborhoods**
```python
# Add to fix_neighborhoods.py NEIGHBORHOOD_BOUNDARIES dict
"Downtown Athens": (33.950, 33.960, -83.385, -83.370),
"Five Points": (33.955, 33.965, -83.380, -83.365),
"Normaltown": (33.965, 33.980, -83.390, -83.375),
"The Classic City": (33.945, 33.970, -83.400, -83.360),
```

**Step 3: Add ZIP Code Fallbacks**

```python
# Add to fix_neighborhoods.py ZIP_TO_NEIGHBORHOOD dict
"30601": "Downtown Athens",
"30605": "Five Points",
"30606": "Normaltown",
```

**Step 4: Run Assignment Script**

```bash
# Dry run first
python fix_neighborhoods.py --dry-run

# Apply changes
python fix_neighborhoods.py

# Verify results
python check_remaining_venues.py
```

**Target Metric:** >85% of venues should have neighborhoods after this step.

**Recommendation:** Budget 4-6 hours for neighborhood research and mapping per new city.

---

## 4. Geocoding Validation Checklist

### Ensure Accurate Location Data

**Common Issues:**
- Venues with missing lat/lng coordinates
- Coordinates outside expected geographic bounds
- Address geocoded to wrong location

**Validation SQL Queries:**

```sql
-- 1. Venues missing coordinates
SELECT name, address, city, zip
FROM venues
WHERE city = 'Athens'
  AND (lat IS NULL OR lng IS NULL);

-- 2. Venues with suspicious coordinates (outside Athens area)
-- Athens bounds: lat 33.8-34.1, lng -83.5 to -83.2
SELECT name, lat, lng, address
FROM venues
WHERE city = 'Athens'
  AND (lat < 33.8 OR lat > 34.1 OR lng < -83.5 OR lng > -83.2);

-- 3. Venues missing neighborhood after mapping
SELECT name, address, lat, lng, zip
FROM venues
WHERE city = 'Athens'
  AND neighborhood IS NULL
  AND (lat IS NOT NULL OR zip IS NOT NULL);
```

**Fix Missing Coordinates:**

Option 1: Use Foursquare enrichment script
```bash
python hydrate_venues_foursquare.py --city Athens --limit 50
```

Option 2: Manual geocoding using Google Maps
- Search venue name + address
- Right-click location → "What's here?"
- Update venue record with coordinates

**Recommendation:** Validate all venue coordinates before launching new area. Budget 2-3 hours for geocoding validation.

---

## 5. Data Quality Metrics to Track

### Pre-Launch Validation

**Run these checks before making new area public:**

```sql
-- Overall quality dashboard for new area
SELECT 
  COUNT(*) as total_events,
  COUNT(*) FILTER (WHERE v.neighborhood IS NULL) * 100.0 / COUNT(*) as missing_neighborhood_pct,
  COUNT(*) FILTER (WHERE description IS NULL OR LENGTH(description) < 50) * 100.0 / COUNT(*) as missing_desc_pct,
  COUNT(*) FILTER (WHERE image_url IS NULL) * 100.0 / COUNT(*) as missing_img_pct,
  COUNT(*) FILTER (WHERE category IS NULL) * 100.0 / COUNT(*) as missing_category_pct,
  COUNT(DISTINCT source_id) as active_sources,
  COUNT(DISTINCT venue_id) as venues_used,
  MIN(start_date) as earliest_event,
  MAX(start_date) as latest_event
FROM events e
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens'  -- Change to new city
  AND e.start_date >= CURRENT_DATE;
```

**Quality Thresholds (Launch Gate):**

| Metric | Minimum | Target | Blocker? |
|--------|---------|--------|----------|
| Total Events | 30+ | 100+ | Yes |
| Neighborhood Coverage | 70% | 85% | Yes |
| Missing Descriptions | <25% | <15% | No |
| Missing Images | <30% | <20% | No |
| Active Sources | 3+ | 10+ | Yes |
| Forward Coverage | 1 month | 2 months | No |
| Duplicate Rate | <3% | <1% | Yes |

**Recommendation:** Don't launch with <30 events or <70% neighborhood coverage. Other metrics can improve post-launch.

---

### Post-Launch Monitoring

**Week 1: Daily Checks**

```sql
-- Events added in last 24 hours
SELECT 
  s.name as source,
  COUNT(e.id) as new_events,
  MAX(e.created_at) as last_event_time
FROM events e
JOIN sources s ON s.id = e.source_id
JOIN venues v ON v.id = e.venue_id
WHERE v.city = 'Athens'
  AND e.created_at >= NOW() - INTERVAL '24 hours'
GROUP BY s.name;
```

**Week 2-4: Weekly Audits**

```bash
# Run full data audit
cd /Users/coach/Projects/LostCity/crawlers
python data_audit.py > weekly_audit_athens_$(date +%Y%m%d).txt

# Review summary
grep -A 20 "OVERVIEW STATISTICS" weekly_audit_athens_*.txt
```

**Monthly: Full Quality Review**

Use standard monitoring infrastructure:
- Review `DATA_QUALITY_MONITORING.md` queries
- Check crawl health for new sources
- Validate forward coverage hasn't degraded

**Recommendation:** Assign dedicated monitoring for first month, then quarterly reviews.

---

## 6. Success Metrics by Timeline

### Launch Success Criteria

**Week 1 Targets:**

| Metric | Target | Validation Query |
|--------|--------|-----------------|
| Events Live | 50+ | `SELECT COUNT(*) FROM events e JOIN venues v ON v.id = e.venue_id WHERE v.city = 'Athens' AND e.start_date >= CURRENT_DATE;` |
| Active Sources | 5+ | See "Post-Launch Monitoring" query above |
| Neighborhood Coverage | 80%+ | `SELECT COUNT(*) FILTER (WHERE neighborhood IS NOT NULL) * 100.0 / COUNT(*) FROM venues WHERE city = 'Athens';` |
| Crawl Error Rate | <10% | Check `crawl_logs` table |

**Month 1 Targets:**

| Metric | Target |
|--------|--------|
| Events Live | 100+ |
| Active Sources | 10+ |
| Neighborhood Coverage | 85%+ |
| Forward Coverage | 2 months |
| Duplicate Rate | <1% |

**Quarter 1 Targets:**

| Metric | Target |
|--------|--------|
| Events Live | 200+ |
| Active Sources | 15+ |
| Category Balance | All categories >2% |
| Data Quality Score | B+ (85+) |

**Recommendation:** Set conservative Week 1 targets, ambitious Month 1 targets. Reassess quarterly.

---

## 7. Common Pitfalls & Solutions

### Pitfall 1: Incomplete Neighborhood Coverage

**Symptom:** >20% of events show as "Unknown" neighborhood

**Root Causes:**
- Venues missing lat/lng coordinates
- Neighborhood boundaries too narrow
- ZIP code fallbacks not defined

**Solutions:**
1. Run `python check_remaining_venues.py` to identify gaps
2. Manually geocode venues with missing coordinates
3. Expand neighborhood boundaries or add new neighborhoods
4. Add ZIP code mappings for edge cases

**Prevention:** Validate neighborhood coverage >85% before launch (see Section 3)

---

### Pitfall 2: Sources Producing Zero Events

**Symptom:** Sources marked active but produce 0 events in crawls

**Root Causes:**
- Website structure changed (broken crawler)
- No upcoming events on source calendar
- Seasonal source (only active certain months)
- Crawler parsing logic incorrect

**Solutions:**
1. Test crawler manually: `python main.py --source [slug] --dry-run`
2. Check source website manually for events
3. Review crawler logs in `crawl_logs` table
4. Update crawler parsing logic if structure changed
5. Mark seasonal sources as inactive during off-months

**Prevention:** Test crawlers on dry-run mode before adding to production (see Section 4)

---

### Pitfall 3: High Duplicate Rate

**Symptom:** Same event appears 2+ times with different IDs

**Root Causes:**
- Multiple sources cover same venue
- Content hash not unique enough
- Title variations not normalized

**Solutions:**
1. Review duplicate pairs: `SELECT title, start_date, COUNT(*) FROM events WHERE city = 'Athens' GROUP BY title, start_date HAVING COUNT(*) > 1;`
2. Check if duplicates are from different sources (legitimate cross-posting)
3. Improve `content_hash` generation in crawler
4. Add venue name normalization to deduplication logic
5. Manually merge obvious duplicates

**Prevention:** Run duplicate check before launch (see Section 5)

---

### Pitfall 4: Forward Coverage Drop-Off

**Symptom:** Events only available 2-4 weeks in advance

**Root Causes:**
- Sources only publish short-term calendars
- Seasonal gap (summer, holidays)
- Crawl frequency too low

**Solutions:**
1. Increase crawl frequency for high-volume sources (12-24 hours)
2. Add sources with longer horizons (performing arts, festivals)
3. Check if seasonal (summer slowdown is normal)
4. Add annual event sources (conferences, fairs)

**Prevention:** Target sources with 2+ month calendars during research phase

---

## 8. Tool Reference

### Data Quality Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `data_audit.py` | Comprehensive data analysis | `python data_audit.py [limit]` |
| `fix_neighborhoods.py` | Assign neighborhoods to venues | `python fix_neighborhoods.py [--dry-run]` |
| `check_remaining_venues.py` | Find venues missing neighborhoods | `python check_remaining_venues.py` |
| `hydrate_venues_foursquare.py` | Enrich venue data from Foursquare | `python hydrate_venues_foursquare.py --city [City]` |

### Crawler Scripts

| Script | Purpose | Usage |
|--------|---------|-------|
| `main.py` | Run crawlers | `python main.py [--source slug] [--dry-run] [--list]` |

### Documentation

| Document | Purpose | Location |
|----------|---------|----------|
| GEOGRAPHIC_EXPANSION_PLAYBOOK.md | Full expansion guide | `/Users/coach/Projects/LostCity/` |
| DATA_AUDIT_README.md | Data audit system overview | `/Users/coach/Projects/LostCity/` |
| DATA_QUALITY_MONITORING.md | Ongoing monitoring guide | `/Users/coach/Projects/LostCity/` |
| NEIGHBORHOOD_FIX_SUMMARY.md | Neighborhood mapping details | `/Users/coach/Projects/LostCity/crawlers/` |

---

## 9. Recommended Next Expansions

Based on current Atlanta coverage analysis, these areas are ready for expansion:

### High Priority (Ready Now)

**1. Athens, GA**
- Population: 127,000
- Key Venues: UGA campus (40k students), Georgia Theatre, 40 Watt Club
- Expected Events: 200-300/month
- Estimated Effort: 2 weeks
- Rationale: Major college town, strong music scene, 1 hour from Atlanta

**2. Roswell/Alpharetta (North Fulton)**
- Population: 180,000
- Key Venues: Verizon Amphitheatre, Avalon, Alpharetta City Center
- Expected Events: 100-150/month
- Estimated Effort: 1.5 weeks
- Rationale: Wealthy suburbs, existing Atlanta portal integration, many venues

**3. Decatur, GA**
- Population: 25,000
- Key Venues: Eddie's Attic, Decatur Square, Oakhurst
- Expected Events: 50-100/month
- Estimated Effort: 1 week
- Rationale: Already partially covered, formalize neighborhood mapping

### Medium Priority (2-3 Months Out)

**4. Gwinnett County (Lawrenceville, Duluth, Buford)**
- Population: 930,000
- Expected Events: 300-400/month
- Estimated Effort: 3 weeks
- Rationale: Large population, diverse communities, Gas South Arena

**5. South Metro (Fayetteville, Peachtree City, Newnan)**
- Population: 200,000
- Expected Events: 100-150/month
- Estimated Effort: 2 weeks
- Rationale: Growing suburbs, distinct community events

---

## 10. Quick Start: Expanding to New Area

### Minimum Viable Expansion (1 Week Sprint)

**Day 1-2: Research & Assessment**
- [ ] Define geographic boundaries
- [ ] Identify 10 core venues
- [ ] Research 5 high-priority event sources
- [ ] Run baseline data quality check

**Day 3: Neighborhood Mapping**
- [ ] Define 5-7 major neighborhoods
- [ ] Add lat/lng boundaries to `fix_neighborhoods.py`
- [ ] Add ZIP code mappings
- [ ] Run neighborhood assignment script

**Day 4-5: Source Integration**
- [ ] Build 3-5 initial crawlers
- [ ] Test with dry-run mode
- [ ] Add source records to database
- [ ] Run initial crawls

**Day 6: Validation**
- [ ] Run data quality checks (Section 5)
- [ ] Verify >30 events with >70% neighborhood coverage
- [ ] Fix critical issues

**Day 7: Launch & Monitor**
- [ ] Enable in portal
- [ ] Add to neighborhood filter
- [ ] Set up daily monitoring

**Result:** 30-50 events live in new area, foundation for growth.

---

## 11. Questions & Next Steps

### Questions This Playbook Answers

✅ What data quality checks should be run before/after adding a new area?  
→ See Section 1 (Pre-Expansion) and Section 5 (Validation)

✅ How do we identify gaps in venue coverage for a new area?  
→ See Section 2 (Venue Coverage Strategy)

✅ What neighborhood/location mapping considerations are there?  
→ See Section 3 (Neighborhood Mapping)

✅ How should we validate that events and venues are properly geocoded?  
→ See Section 4 (Geocoding Validation)

✅ What metrics should we track to measure successful area integration?  
→ See Section 6 (Success Metrics)

### Next Steps

**Immediate (This Week):**
1. Review full playbook: `GEOGRAPHIC_EXPANSION_PLAYBOOK.md`
2. Run baseline data audit: `python data_audit.py`
3. Decide on first expansion area (recommend Athens or Roswell)

**Short-Term (Next 2 Weeks):**
4. Execute expansion using playbook checklist (Section 8 of full playbook)
5. Document lessons learned
6. Update playbook based on experience

**Ongoing:**
7. Set up quarterly expansion planning cycle
8. Monitor existing areas using `DATA_QUALITY_MONITORING.md`
9. Refine metrics and thresholds based on growth

---

**For Full Details:** See `/Users/coach/Projects/LostCity/GEOGRAPHIC_EXPANSION_PLAYBOOK.md`

**Questions?** Contact Data Quality Team

---

**Document Version:** 1.0  
**Last Updated:** 2026-01-31  
**Next Review:** After first expansion using this playbook
