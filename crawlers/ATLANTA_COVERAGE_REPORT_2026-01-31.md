# Atlanta Event Content Coverage Report
**Generated:** 2026-01-31  
**Database:** LostCity Production  
**Analyst:** Data Quality Team

---

## Executive Summary

LostCity has achieved **strong foundational coverage** of Atlanta's event landscape with **398 sources** (326 active, 81.9% activation rate) producing **1,000+ upcoming events**. However, significant gaps remain in several high-value categories.

### Key Findings

- **407 crawler files** available vs **398 sources** in database (slight mismatch to investigate)
- **72.4%** of high-priority expansion sources are active (42 of 58)
- **8,653 events** found in last 7 days across **299 crawled sources**
- **40.9% of events lack neighborhood data** (409 of 1,000) - critical data quality issue
- **174 active sources** (53% of active sources) produced zero events in past week

---

## 1. Source Coverage Analysis

### By Source Type

| Source Type | Total | Active | Active % | Notes |
|------------|-------|--------|----------|-------|
| **scrape** | 209 | 166 | 79.4% | Largest category, custom HTML parsers |
| **venue** | 73 | 63 | 86.3% | Direct venue websites |
| **website** | 65 | 61 | 93.8% | General websites with events |
| **organization** | 12 | 12 | 100.0% | All org sources active |
| **api** | 7 | 5 | 71.4% | API integrations (Eventbrite, Ticketmaster) |
| **aggregator** | 3 | 1 | 33.3% | ⚠️ Low activation - needs attention |
| **mobilize** | 10 | 0 | 0.0% | ❌ All inactive - investigate |

**Recommendation:** Investigate why all 10 Mobilize sources are inactive. Mobilize is a major political/activism event platform that could provide significant community organizing coverage.

---

## 2. Event Distribution

### By Category (1,000 Upcoming Events)

| Category | Count | % | Coverage Assessment |
|----------|-------|---|---------------------|
| **words** | 226 | 22.6% | ✅ Strong (readings, talks, lectures) |
| **sports** | 182 | 18.2% | ✅ Strong (GT Athletics, KSU dominate) |
| **community** | 84 | 8.4% | ⚠️ Good but gaps remain |
| **learning** | 83 | 8.3% | ✅ Strong (libraries, universities) |
| **music** | 78 | 7.8% | ⚠️ Moderate - missing indie venues |
| **art** | 69 | 6.9% | ⚠️ Moderate - galleries underrepresented |
| **family** | 53 | 5.3% | ✅ Good |
| **fitness** | 51 | 5.1% | ✅ Good |
| **outdoors** | 47 | 4.7% | ✅ Good |
| **film** | 43 | 4.3% | ✅ Good (Landmark, Plaza strong) |
| **nightlife** | 35 | 3.5% | ⚠️ Low - missing DJ/club events |
| **theater** | 25 | 2.5% | ⚠️ Low - theater coverage needs work |
| **comedy** | 13 | 1.3% | ⚠️ Very low despite major venues |
| **food_drink** | 6 | 0.6% | ❌ Critical gap |
| **gaming** | 3 | 0.3% | ❌ Critical gap |

### By Neighborhood (Top 10)

| Neighborhood | Events | % | Assessment |
|--------------|--------|---|------------|
| **Unknown** | 409 | 40.9% | ❌ **Critical Data Quality Issue** |
| Midtown | 217 | 21.7% | ✅ Strong coverage |
| Kennesaw | 81 | 8.1% | ✅ KSU Athletics |
| Downtown | 33 | 3.3% | ⚠️ Low for downtown |
| Poncey-Highland | 23 | 2.3% | Good |
| West End | 20 | 2.0% | Good |
| East Atlanta | 12 | 1.2% | Low |
| Emory | 11 | 1.1% | Good (Schwartz Center) |

**Critical Issue:** 40.9% of events have no neighborhood assigned. This severely impacts discovery and neighborhood-based filtering.

**Action Items:**
1. Run venue geocoding/enrichment script to assign neighborhoods
2. Add validation to reject events without venue neighborhood data
3. Prioritize sources with proper venue metadata

---

## 3. Most Productive Sources (Top 15)

| Source | Type | Events | Status | Notes |
|--------|------|--------|--------|-------|
| Atlanta-Fulton Public Library | website | 356 | ✅ | Dominant - library events |
| Georgia Tech Athletics | scrape | 109 | ✅ | Sports coverage |
| Stone Mountain Park | venue | 80 | ✅ | Family/outdoors |
| Kennesaw State Athletics | scrape | 60 | ✅ | Sports coverage |
| Piedmont Park Conservancy | venue | 57 | ✅ | Community events |
| Ticketmaster | api | 57 | ✅ | Major concerts/events |
| Recurring Social Events | venue_calendar | 52 | ✅ | Nightlife/social |
| Eventbrite | api | 30 | ✅ | Mixed events |
| Kennesaw State University | scrape | 21 | ✅ | Academic events |
| Landmark Midtown | website | 20 | ✅ | Film/indie cinema |
| Kat's Cafe | scrape | 13 | ✅ | LGBTQ+ events |
| Plaza Theatre | website | 13 | ✅ | Film |
| Spelman College | scrape | 13 | ✅ | University events |
| Emory Schwartz Center | scrape | 11 | ✅ | Performing arts |
| Blake's on the Park | venue_calendar | 10 | ✅ | Drag shows |

**Observation:** Libraries and universities dominate event volume. Need more nightlife, music venue, and theater diversity.

---

## 4. Date Range Coverage

- **Earliest event:** 2026-01-31 (today)
- **Latest event:** 2027-01-20 (1 year out)

### Events by Month

| Month | Events | Coverage |
|-------|--------|----------|
| 2026-02 | 393 | ✅ Excellent (Feb strong) |
| 2026-03 | 181 | ✅ Good |
| 2026-04 | 91 | ⚠️ Moderate |
| 2026-05 | 56 | ⚠️ Moderate |
| 2026-06 | 43 | ⚠️ Moderate |
| 2026-07 | 30 | ⚠️ Low (summer gap) |
| 2026-08 | 39 | ⚠️ Low |
| 2026-09 | 34 | ⚠️ Low |
| 2026-10 | 36 | ⚠️ Low |
| 2026-11 | 38 | ⚠️ Low |
| 2026-12 | 24 | ⚠️ Low (holiday gap) |

**Concern:** Sharp drop-off after March. Many sources only publish 2-3 months ahead.

**Recommendations:**
1. Crawl more frequently to maintain forward coverage
2. Identify sources with longer event horizons (festivals, performing arts)
3. Add seasonal sources (summer festivals, holiday events)

---

## 5. Crawl Health (Last 7 Days)

### Overall Stats
- **Sources crawled:** 299
- **Total events found:** 8,653
- **Sources with errors:** 20
- **Active sources with zero events:** 174 (53% of active sources)

### Top Error Sources

| Source | Runs | Errors | Events | Issue Type |
|--------|------|--------|--------|------------|
| YMCA of Metro Atlanta | 6 | 3 | 9 | Intermittent failures |
| Eventbrite | 5 | 2 | 131 | Still producing events |
| Atlanta-Fulton Library | 6 | 2 | 2,000 | Still highly productive |
| City Springs | 4 | 2 | 214 | Intermittent |
| Southern Fried Queer Pride | 4 | 2 | 58 | Needs investigation |

**Note:** Some sources with errors are still producing events (e.g., Eventbrite, Library). This suggests transient network issues rather than broken crawlers.

### Critical Zero-Event Sources (Active but not producing)

| Source | Type | Priority |
|--------|------|----------|
| Dad's Garage | scrape | **HIGH** - Major comedy venue |
| Atlanta Contemporary | venue | **HIGH** - Major art museum |
| Cobb Energy Centre | scrape | **HIGH** - Performing arts |
| Aurora Theatre | scrape | **HIGH** - Theater |
| Buckhead Theatre | scrape | **MEDIUM** - Music venue |
| Blind Willie's | scrape | **MEDIUM** - Blues venue |
| Criminal Records | venue | **MEDIUM** - Music/events |

**Action Required:** These are known active venues that should be producing events. Crawlers may be broken or source websites have changed structure.

---

## 6. Gap Analysis: High-Priority Missing Sources

Based on SOURCES_EXPANSION.md, we have implemented **77.6%** of recommended high-priority sources (45 of 58). **13 sources** remain missing:

### Critical Gaps

#### High-Volume Aggregators (4 missing)
- **Atlanta Civic Circle** - Activism/organizing events hub
- **Atlanta Art Week** - Annual gallery events aggregator
- **Art on the BeltLine** - Public art exhibits
- **Creative Loafing Community** - Grassroots/activism calendar

#### Volunteer Opportunities (3 missing)
- **VolunteerMatch Atlanta** - National volunteer platform
- **Atlanta Community Food Bank** - Food security events
- **Habitat for Humanity Atlanta** - Housing build events

#### Activism & Community (2 missing)
- **Indivisible Georgia** - Political organizing
- **Georgia Peace & Justice Coalition** - Peace activism

#### Music Venues (1 missing)
- **Red Light Café** - Americana, bluegrass, folk

#### Conventions (2 missing)
- **DragonCon** - Massive Labor Day weekend convention
- **Atlanta Black Expo** - February expo

#### Theater (1 missing)
- **7 Stages Theatre** - Experimental theater

### Inactive High-Priority Sources (Need Reactivation)

- **Access Atlanta** (AJC) - Major local news aggregator
- **10times Atlanta** - Trade show aggregator
- **FanCons Georgia** - Fan convention calendar

---

## 7. Category-Specific Gaps

### Nightlife & Music
**Current Coverage:** 78 music events, 35 nightlife events (11.3% combined)

**Missing Sources:**
- Red Light Café (Americana/folk)
- Star Community Bar (punk/indie)
- Aisle 5 (already in DB but producing 0 events)
- Vinyl / The Loft (Center Stage complex)

**DJ/Electronic Music Gap:**
- MJQ Concourse (in DB, producing 0 events)
- Ravine Atlanta
- Sound Table
- Opera Nightclub

### Theater & Performing Arts
**Current Coverage:** 25 theater events (2.5%)

**Issues:**
- 7 Stages Theatre not implemented
- Aurora Theatre producing 0 events (crawler broken?)
- Cobb Energy Centre producing 0 events

### Comedy
**Current Coverage:** 13 comedy events (1.3%)

**Issues:**
- Dad's Garage producing 0 events (crawler broken?) - **CRITICAL**
- Relapse Theatre (improv) not implemented
- Village Theatre (improv) not implemented

### Food & Beverage
**Current Coverage:** 6 food/drink events (0.6%) - **CRITICAL GAP**

**Missing:**
- Atlanta Food & Wine Festival
- Taste of Atlanta (in DB but not producing)
- Brewery events (Monday Night, SweetWater, etc.)
- Cooking classes (Sur La Table, Williams Sonoma in DB)

### Conventions & Expos
**Current Coverage:** Limited to MomoCon, GWCC

**Missing:**
- DragonCon (60k+ attendees)
- Atlanta Black Expo
- Anime Weekend Atlanta
- Southern Women's Show
- Atlanta Pet Expo

---

## 8. Data Quality Issues

### Issue 1: Missing Neighborhood Data (40.9%)
**Severity:** Critical  
**Impact:** Breaks neighborhood filtering, reduces discoverability  
**Root Cause:** Venues without lat/lng or neighborhood assignment  
**Fix:** Run geocoding enrichment, require neighborhood on venue creation

### Issue 2: Sources Producing Zero Events (53% of active)
**Severity:** High  
**Impact:** Wasted crawler execution, inflated "active source" count  
**Root Cause:** Broken crawlers, changed website structure, seasonal sources  
**Fix:** 
1. Audit zero-event sources manually
2. Tag seasonal sources with `active_months` field
3. Add `health_tags` to failing sources
4. Disable permanently broken sources

### Issue 3: Forward Coverage Drop-off
**Severity:** Medium  
**Impact:** Users can't plan far ahead, especially for summer events  
**Root Cause:** Sources only publish 2-3 months ahead  
**Fix:** Prioritize festival/seasonal sources with long horizons

---

## 9. Recommendations

### Immediate Actions (This Week)

1. **Fix broken high-value crawlers:**
   - Dad's Garage (major comedy venue)
   - Atlanta Contemporary (art museum)
   - Aurora Theatre
   - Cobb Energy Centre

2. **Add missing critical aggregators:**
   - Atlanta Civic Circle (activism)
   - Art on the BeltLine (public art)
   - VolunteerMatch Atlanta

3. **Run venue enrichment:**
   - Geocode all venues missing lat/lng
   - Assign neighborhoods to reduce "Unknown" from 40.9%

### Short-Term (Next 2 Weeks)

4. **Implement DragonCon crawler** (60k+ attendees, huge cultural event)

5. **Activate existing inactive sources:**
   - Access Atlanta (AJC)
   - 10times Atlanta
   - FanCons Georgia

6. **Audit zero-event sources:**
   - Tag seasonal sources
   - Disable permanently broken sources
   - Fix recoverable crawlers

### Medium-Term (Next Month)

7. **Fill category gaps:**
   - Food/beverage: Atlanta Food & Wine, brewery events
   - Nightlife: DJ/electronic venues
   - Comedy: Relapse Theatre, Village Theatre
   - Music: Red Light Café, indie venues

8. **Add volunteer opportunity sources:**
   - Atlanta Community Food Bank
   - Habitat for Humanity

9. **Improve forward coverage:**
   - Identify festival/seasonal sources
   - Increase crawl frequency for high-volume sources

---

## 10. Success Metrics

### Current Baseline
- Total events: 1,000 upcoming
- Active sources: 326
- Categories covered: 16
- Events/week found: 8,653
- Forward coverage: 12 months (with drop-off)

### 30-Day Targets
- Total events: **1,500+** (50% increase)
- Neighborhood coverage: **<15% Unknown** (from 40.9%)
- Comedy events: **40+** (from 13)
- Food/drink events: **30+** (from 6)
- Theater events: **50+** (from 25)
- Zero-event sources: **<25%** (from 53%)

### 90-Day Targets
- Total events: **2,500+**
- All high-priority expansion sources: **95%+** (from 72.4%)
- Balanced category distribution (no category <3%)
- 6-month forward coverage maintained
- <5% crawl error rate

---

## Conclusion

LostCity has built a **solid foundation** with strong coverage of libraries, universities, major venues, and community organizations. However, **critical gaps** remain in nightlife, comedy, food/beverage, and conventions - categories that are essential for a complete Atlanta event discovery platform.

The **40.9% missing neighborhood data** is the most urgent data quality issue, followed by the **53% of active sources producing zero events**, which suggests significant crawler maintenance debt.

By focusing on the 13 missing high-priority sources, fixing broken crawlers for major venues (Dad's Garage, Aurora Theatre), and improving data quality, LostCity can achieve comprehensive Atlanta coverage within 60-90 days.

---

**Report prepared by:** Data Quality Team  
**Next review:** 2026-02-28  
**Questions:** Contact crawler-dev team
