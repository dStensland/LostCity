# Atlanta Metro Coverage Gap Analysis
**Generated:** February 1, 2026  
**Analyzer:** data-quality specialist

## Executive Summary

LostCity currently has **471 crawler modules** covering **368 active sources** across the Atlanta metro area. However, significant coverage gaps exist:

- **Critical Infrastructure**: 315 sources (86%) produced zero events in the last 30 days
- **Geographic Gaps**: 27 of 37 ITP neighborhoods missing or underrepresented
- **OTP Underrepresentation**: Major suburban cities (Alpharetta, Roswell, Duluth) have minimal coverage
- **Venue Utilization**: Only 193 of 1,000 venues (19%) have had events in the last 60 days

## Current Coverage Statistics

### Overall Metrics
- **Total Events in Database**: 994
- **Active Sources (Last 30 Days)**: 53 (14% of total)
- **Inactive Sources**: 315 (86%)
- **Total Venues**: 1,000
- **Active Venues (Last 60 Days)**: 193 (19%)
- **Cities Covered**: 21
- **ITP Neighborhoods with Events**: 27 of 37 expected

### Event Distribution by City

| City | Events | % of Total | Venues |
|------|--------|------------|--------|
| **Atlanta** | 677 | 68.1% | 116 |
| Kennesaw | 85 | 8.6% | 6 |
| Stone Mountain | 80 | 8.0% | 2 |
| Alpharetta | 29 | 2.9% | 1 |
| Sandy Springs | 17 | 1.7% | 2 |
| Roswell | 17 | 1.7% | 3 |
| Johns Creek | 14 | 1.4% | 2 |
| Decatur | 10 | 1.0% | 5 |
| All Others | 65 | 6.5% | - |

### Category Distribution

| Category | Events | % of Total |
|----------|--------|------------|
| Sports | 193 | 19.4% |
| Community | 186 | 18.7% |
| Film | 106 | 10.7% |
| Words/Books | 105 | 10.6% |
| Music | 71 | 7.1% |
| Fitness | 59 | 5.9% |
| Art | 59 | 5.9% |
| Family | 53 | 5.3% |
| Outdoors | 46 | 4.6% |
| Nightlife | 44 | 4.4% |
| Theater | 28 | 2.8% |
| Comedy | 9 | 0.9% |
| Food & Drink | 8 | 0.8% |

---

## Critical Gaps (Immediate Action Required)

### 1. ITP Tier 1 Neighborhoods - MISSING

These high-activity neighborhoods have **zero event coverage** despite being major cultural hubs:

#### **Little Five Points**
- **Why Critical**: Historic bohemian district, numerous music venues, theaters, bars
- **Missing Venues**: 
  - The EARL (has crawler, producing only 1 event/month)
  - 529 (has crawler, experiencing errors)
  - Variety Playhouse (has crawler, only 1 event last 30 days)
  - Criminal Records (has crawler)
  - Junkman's Daughter (needs crawler)
  - Euclid Avenue Yacht Club (needs crawler)
- **Recommended Action**: Debug existing L5P venue crawlers; they're implemented but failing

#### **Ponce City Market Area**
- **Why Critical**: Major food hall, retail, office complex with frequent events
- **Missing Venues**:
  - Ponce City Market (has basic crawler)
  - Skyline Park (rooftop amusement park)
  - Central Food Hall events
  - Regular pop-ups and markets
- **Recommended Action**: Enhance PCM crawler to capture all internal venue events

#### **Krog Street**
- **Why Critical**: Krog Street Market, art studios, BeltLine access point
- **Missing Venues**:
  - Krog Street Market (has crawler, may be broken)
  - Krog Street Tunnel (art events)
  - Various galleries and studios
- **Recommended Action**: Verify and fix Krog Street Market crawler

### 2. ITP Tier 1 Neighborhoods - LOW COVERAGE

#### **East Atlanta Village** (7 events)
- Has The EARL, 529, Argosy - all with crawlers
- **Issue**: Crawlers appear to be underperforming
- **Recommended Action**: Review crawler quality for EAV venues

#### **Decatur** (4 events)
- **Why This Is Wrong**: Decatur is a MAJOR events hub with:
  - Decatur Book Festival (one of largest in US)
  - Decatur Arts Festival
  - Multiple theaters, Eddie's Attic, etc.
- **Existing Crawlers**: 
  - `decatur-city` (active)
  - `visit-decatur` (active)
  - `decatur-arts-festival` (active)
  - `decatur-book-festival` (active)
- **Issue**: Crawlers exist but producing minimal events
- **Recommended Action**: URGENT - Debug Decatur crawlers, especially decatur-city

### 3. Major OTP Cities - MISSING

#### **Alpharetta** (29 events - mostly from one venue)
- **Why Critical**: Wealthy suburb, major dining/shopping, corporate events
- **Missing Coverage**:
  - Avalon (mixed-use, concerts, events) - has crawler: `avalon-alpharetta` but INACTIVE
  - Alpharetta City events
  - Wills Park events
- **Recommended Action**: Activate and fix `avalon-alpharetta` crawler

#### **Roswell** (17 events)
- **Why Critical**: Historic district, arts scene, Canton Street
- **Existing**: 
  - `roswell-city` (active)
  - `roswell-cultural-arts` (active)
  - `canton-street-roswell` (active)
- **Issue**: Low output from existing crawlers
- **Recommended Action**: Debug Roswell crawlers

#### **Duluth** (7 events)
- **Why Critical**: Gas South Arena (major venue), downtown revival
- **Existing**: 
  - `duluth-city` (active)
  - `downtown-duluth` (active)
  - `gas-south` (active - but only produced events during one event window)
- **Issue**: Gas South Arena should have 20-40 events/year
- **Recommended Action**: Fix `gas-south` crawler to capture full event schedule

---

## High Priority Gaps

### 4. ITP Tier 2 Neighborhoods - MISSING (11 total)

These active neighborhoods have zero coverage:

- **Virginia-Highland**: Major dining/nightlife, neighborhood festivals
- **Inman Park**: Inman Park Festival (major annual event), restaurant scene
- **Reynoldstown**: Emerging arts district, breweries
- **Kirkwood**: Kirkwood Spring Fling, community events
- **Edgewood**: Entertainment district, bars, restaurants
- **Atlantic Station**: Major mixed-use development with events
- **Ansley Park**: Historic neighborhood, Piedmont Park adjacent
- **Morningside**: Morningside Farmers Market, civic events
- **Druid Hills**: Emory University adjacent, Fernbank
- **East Lake**: Golf club, Tom Cousins development
- **Summerhill**: Near stadium, emerging neighborhood

**Recommended Actions**:
1. Add crawlers for neighborhood association websites (many already implemented but inactive)
2. Focus on Virginia-Highland, Inman Park, Edgewood first (highest activity)
3. Many have existing crawlers that are inactive or broken:
   - `virginia-highland-civic` - exists but INACTIVE
   - `atlantic-station` - exists, may be broken
   - `morningside-farmers-market` - exists

### 5. Underrepresented OTP Cities

Cities with crawlers but low output:

| City | Events | Issue | Recommendation |
|------|--------|-------|----------------|
| Marietta | 2 | Has `marietta-city`, `marietta-main-street`, `marietta-cobb-museum` | Debug crawlers - Marietta Square has weekly events |
| Smyrna | 3 | Near Battery Atlanta | Add Market Village crawler |
| Kennesaw | 0 | Has `kennesaw-city`, KSU nearby | Fix crawler, add KSU events |
| Lawrenceville | 0 | Has `lawrenceville-city` | Historic square has regular events |
| Stone Mountain | 3 | Has `stone-mountain-park` | Park has daily/weekly events - crawler broken? |
| East Point | 3 | Has crawlers | Arts district needs better coverage |

---

## Medium Priority Gaps

### 6. Missing Major Venue Crawlers

These venues exist but crawlers are missing or inactive:

1. **Gateway Center Arena** (College Park)
   - Slug: `gateway-center-arena` 
   - **Status**: Has crawler, produced 0 events in last 30 days
   - **Issue**: Arena hosts 20-30 events/year
   - **Action**: Debug crawler

2. **7 Stages Theatre**
   - Slug: `seven-stages` or `7-stages`
   - **Status**: Both slugs exist in SOURCE_MODULES
   - **Issue**: Major theater, should have 100+ events/year
   - **Action**: Verify crawler is working

3. **Shakespeare Tavern**
   - Slug: `shakespeare-tavern`
   - **Status**: Has crawler
   - **Issue**: Year-round theater, should have many events
   - **Action**: Debug crawler

### 7. Underperforming Major Venue Crawlers

Venues with crawlers that produced <5 events in last 30 days:

- **Terminal West**: 2 events (major music venue - should be 20+/month)
- **Eddie's Attic**: 2 events (iconic listening room - should be 15+/month)
- **The Masquerade**: 2 events (3-stage venue - should be 30+/month)
- **Tabernacle**: 2 events (major concert hall - should be 10+/month)
- **Variety Playhouse**: 1 event (major music venue - should be 15+/month)
- **The Earl**: 1 event (popular dive bar venue - should be 20+/month)
- **Laughing Skull**: 1 event (comedy club - should have shows nightly)
- **State Farm Arena**: 1 event (major arena - should be 5-10/month)
- **Mercedes-Benz Stadium**: 1 event (major stadium - should be 3-5/month)

**Root Cause Hypothesis**: These are likely Ticketmaster-fed venues. The issue may be:
- Ticketmaster API rate limiting
- Ticketmaster crawler broken
- Venues not consistently publishing to Ticketmaster
- Crawler not capturing all event types (private events, recurring shows)

**Recommended Action**: 
1. Review Ticketmaster crawler implementation
2. Consider venue-specific crawlers for major venues
3. Check if venues have native event calendars we should crawl directly

### 8. Category Gaps

While overall distribution is decent, these specific gaps exist:

- **Comedy** (0.9%): Only 9 events despite multiple comedy venue crawlers
  - Punchline, Laughing Skull, Uptown Comedy all underperforming
  - Dad's Garage producing events but may be miscategorized

- **Food & Drink** (0.8%): Only 8 events
  - Missing: tastings, food festivals, chef events
  - Existing crawlers: `taste-of-atlanta`, `atlanta-food-wine` (both low output)

- **Theater** (2.8%): Only 28 events despite 20+ theater venue crawlers
  - Major theaters (Alliance, Aurora, 7 Stages, etc.) exist but underproducing
  - May be extraction or categorization issue

---

## Source Health Issues

### Crawlers with Recent Errors (Last 7 Days)

**High Error Count (3+ errors)**:
- `ymca-atlanta`: Syntax error in code (line 176)
- `city-springs`: NoneType error
- `agnes-scott`: Resource errors

**Timeout Issues**:
- `plaza-theatre`: Page load timeout
- `atlanta-film-society`: Page load timeout
- `venkmans`: Page load timeout

**Network Issues**:
Multiple sources reporting `[Errno 35] Resource temporarily unavailable`:
- eventbrite, fulton-library, hands-on-atlanta, laughing-skull, puppetry-arts, farmers-markets, and 8+ others

**Recommended Action**:
1. Fix syntax error in `ymca-atlanta.py` line 176
2. Add retry logic with exponential backoff for network errors
3. Increase timeout for slow-loading sites (plaza-theatre, venkmans)
4. Investigate if [Errno 35] is a system-wide issue (network config, rate limiting)

---

## Recommendations by Priority

### CRITICAL (Complete in Next 2 Weeks)

1. **Debug Decatur Crawlers** (4 events from a major events hub is unacceptable)
   - `decatur-city`, `visit-decatur`, `decatur-book-festival`, `decatur-arts-festival`
   - Expected outcome: 50-100 events from Decatur

2. **Fix Little Five Points Venue Crawlers**
   - The Earl, 529, Variety Playhouse all producing <2 events/month
   - These are high-volume venues - should be 15-20 events each

3. **Debug Major Music Venue Crawlers**
   - Terminal West, The Masquerade, Tabernacle, Buckhead Theatre
   - Combined should produce 100+ events/month

4. **Activate/Fix Alpharetta Coverage**
   - Avalon crawler exists but inactive
   - Add Alpharetta City crawler

5. **Fix Duluth/Gas South Arena**
   - Major arena with spotty coverage
   - Should have consistent event stream

### HIGH PRIORITY (Complete in Next Month)

6. **Add Virginia-Highland Coverage**
   - Neighborhood association crawler exists but inactive
   - Add specific venue crawlers (restaurants, bars with events)

7. **Fix Marietta Crawlers**
   - Marietta Square is active but only 2 events captured
   - `marietta-city` and `marietta-main-street` need debugging

8. **Enhance Inman Park/Edgewood Coverage**
   - Major festivals and nightlife districts
   - Add specific venue and event crawlers

9. **Debug Comedy Venue Crawlers**
   - Punchline, Laughing Skull, Uptown Comedy all underproducing
   - Should be capturing nightly shows

10. **Fix Theater Crawlers**
    - 20+ theater crawlers producing only 28 total events
    - Systematic issue with theater event extraction

### MEDIUM PRIORITY (Complete in Next Quarter)

11. **Expand Tier 2 Neighborhood Coverage**
    - Add crawlers for remaining 11 Tier 2 neighborhoods
    - Focus on Kirkwood, Reynoldstown, Atlantic Station

12. **Enhance OTP City Coverage**
    - Fix Kennesaw, Lawrenceville, Stone Mountain crawlers
    - Add Suwanee, Tucker coverage

13. **Improve Category Distribution**
    - Food & Drink: Add more restaurant/brewery event crawlers
    - Family: Enhance family-friendly venue coverage
    - Sports: Expand beyond major stadiums to rec leagues, running clubs

14. **Add Tier 3 Neighborhood Coverage**
    - Lower priority residential neighborhoods
    - Focus on those with community centers or event spaces

---

## Infrastructure Improvements Needed

### 1. Circuit Breaker Analysis
- 315 sources with zero events in 30 days suggests:
  - Many crawlers were added but never tested
  - Circuit breaker may be too aggressive
  - Many venues may not have regular events (seasonal, annual)

**Recommendation**: 
- Audit all zero-event sources to categorize:
  - Broken crawlers needing fixes
  - Seasonal sources (OK to have zero in off-season)
  - Venues that should be deactivated

### 2. Error Handling
- Widespread `[Errno 35]` errors suggest system-level issue
- Timeout errors on multiple sites

**Recommendation**:
- Add better retry logic with exponential backoff
- Increase default timeout from 30s to 60s for slow sites
- Investigate system-level network configuration

### 3. Venue Database Quality
- 859 of 1,000 venues (86%) have no recent events
- Suggests:
  - Many venues were imported but never had crawlers
  - Venues may be closed or incorrectly geocoded
  - Venues may be destinations (restaurants) not event venues

**Recommendation**:
- Audit venue database
- Tag venues by type (event venue vs. destination)
- Remove/archive closed venues

### 4. Crawler Performance Monitoring
- Need better visibility into which crawlers are underperforming
- Current circuit breaker focuses on errors, not low output

**Recommendation**:
- Add alerting for crawlers that drop below expected event thresholds
- Create crawler performance dashboard
- Implement "expected events per month" benchmarks per source

---

## Data Quality Observations

### Positive Findings
- **Geographic diversity**: 21 cities covered (good OTP spread)
- **Category balance**: Decent distribution across major categories
- **Tag usage**: Good use of free/ticketed, family-friendly, outdoor tags
- **Crawler infrastructure**: 471 modules is impressive scale

### Areas for Improvement
- **Crawler reliability**: 86% inactive rate suggests many crawlers never worked
- **Venue-event linkage**: Only 19% of venues have events (data quality issue)
- **Major venue coverage**: Even famous venues underproducing (likely crawler issues not actual lack of events)
- **Neighborhood accuracy**: 27 of 37 ITP neighborhoods covered, but many with <5 events

---

## Next Steps

1. **Immediate** (This Week):
   - Fix syntax error in `ymca-atlanta.py`
   - Debug Decatur crawlers (highest ROI - major events hub)
   - Review Ticketmaster integration (affects many major venues)

2. **Short-term** (Next 2 Weeks):
   - Audit and fix L5P venue crawlers
   - Debug Gas South Arena crawler
   - Activate Avalon Alpharetta crawler
   - Fix major music venue crawlers (Terminal West, Masquerade, etc.)

3. **Medium-term** (Next Month):
   - Systematic theater crawler audit
   - Comedy venue crawler fixes
   - Virginia-Highland and Marietta coverage
   - OTP city crawler improvements

4. **Long-term** (Next Quarter):
   - Complete Tier 2 neighborhood coverage
   - Venue database cleanup
   - Crawler performance monitoring system
   - Category gap filling (food, family, sports)

---

## Appendix: Crawler Inventory

### Total Crawlers: 471
- **Active Sources**: 368
- **Producing Events (Last 30d)**: 53 (14%)
- **Zero Events**: 315 (86%)

### Sources with 1-4 Events (Last 30 Days)
Likely underperforming:
- Terminal West (2), Eddie's Attic (2), The Masquerade (2), Tabernacle (2)
- Variety Playhouse (1), The Earl (1), Laughing Skull (1)
- State Farm Arena (1), Mercedes-Benz Stadium (1)
- High Museum (1), AJFF (1), Ferst Center (1)

These venues should be producing 10-20x more events.

---

**Report prepared by**: data-quality specialist  
**Files generated**:
- `/Users/coach/Projects/LostCity/crawlers/coverage_analysis.py` - Base coverage metrics
- `/Users/coach/Projects/LostCity/crawlers/gap_analysis_detailed.py` - Detailed gap analysis
- `/Users/coach/Projects/LostCity/crawlers/verify_categories.py` - Category validation

**For questions or to report data quality issues**, reference this analysis when working with crawler-dev.
