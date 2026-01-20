# Atlanta Playbook Application Analysis

**Analysis Date:** January 19, 2026
**Time Scope:** 3 Months (Q1 2026)
**Goal:** Apply City Onboarding Playbook to identify gaps and create improvement roadmap

---

## Executive Summary

### Current State (Baseline)
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Total Events | 2,120 | 5,000+ | -2,880 |
| Future Events | 1,732 | 4,000+ | -2,268 |
| Active Venues | 381 | 500+ | -119 |
| Active Sources | 190 | 200+ | -10 |
| **Producing Sources** | **34** | **180+** | **-146** |
| Categories Covered | 14 | 15 | -1 |
| Days Forward Coverage | ~5 weeks | 12+ weeks | -7 weeks |

### Critical Finding
**82% of active sources (156/190) produce ZERO future events.** This represents massive untapped potential. Fixing existing crawlers is priority #1 before adding new sources.

---

## Phase 0: Geographic Definition ✅

### Atlanta Metro Configuration
```python
ATLANTA_CONFIG = {
    "name": "Atlanta",
    "state": "GA",
    "center_lat": 33.7490,
    "center_lng": -84.3880,
    "radius_miles": 35,
    "neighborhoods": [
        # Core ITP
        "Downtown", "Midtown", "Buckhead", "West Midtown",
        "Old Fourth Ward", "Virginia-Highland", "Inman Park",
        "East Atlanta Village", "Grant Park", "Cabbagetown",
        "Edgewood", "Little Five Points", "Poncey-Highland",
        "Candler Park", "Lake Claire", "Kirkwood",
        "Reynoldstown", "Castleberry Hill", "English Avenue",
        # Suburban/OTP
        "Decatur", "East Atlanta", "Druid Hills", "Emory",
        "Sandy Springs", "Dunwoody", "Brookhaven",
        "Alpharetta", "Roswell", "Marietta", "Smyrna",
        "Cumberland", "Vinings", "Chamblee", "Doraville",
        "Tucker", "Stone Mountain", "Avondale Estates"
    ],
    "key_districts": {
        "downtown_core": ["Downtown", "Centennial Park", "Mercedes-Benz Stadium area"],
        "arts_district": ["Midtown", "Woodruff Arts Center", "High Museum"],
        "entertainment": ["Buckhead", "Atlantic Station", "The Battery"],
        "emerging": ["West End", "Westside", "Adair Park", "Pittsburgh"],
        "lgbtq": ["Midtown", "Piedmont Park area", "Virginia-Highland"],
        "food_drink": ["Buford Highway", "Krog Street", "Ponce City", "West Midtown"]
    }
}
```

### Current Neighborhood Coverage
| Neighborhood | Venues | Status |
|--------------|--------|--------|
| Unknown | 164 | ⚠️ DATA QUALITY ISSUE |
| Downtown | 58 | ✅ Good |
| Midtown | 45 | ✅ Good |
| Buckhead | 18 | 🔶 Moderate |
| West Midtown | 17 | 🔶 Moderate |
| Old Fourth Ward | 16 | 🔶 Moderate |
| Decatur | 12 | 🔶 Needs more |
| East Atlanta Village | 7 | ❌ Gap |
| Grant Park | 5 | ❌ Gap |
| Virginia-Highland | 3 | ❌ Major Gap |
| Little Five Points | 0 | ❌ Critical Gap |
| Inman Park | 0 | ❌ Critical Gap |

**Priority Fix:** 43% of venues have "Unknown" neighborhood - need data enrichment.

---

## Phase 1: Foundation Sources Assessment

### Tier 1 Aggregators - Status

| Source | Expected | Actual | Status | Notes |
|--------|----------|--------|--------|-------|
| **Ticketmaster** | 300-500 | 345 | ✅ Working | Primary driver |
| **Eventbrite** | 100-300 | 127 | ✅ Working | Good yield |
| **Meetup** | 50-100 | 48 | ✅ Working | On target |
| **Creative Loafing** | 50-200 | 0 | ❌ BROKEN | Critical - local aggregator |
| **Discover Atlanta** | 50-100 | 0 | ❌ BROKEN | Tourism authority |
| **Access Atlanta** | 50-100 | 2 | ⚠️ LOW | AJC events |
| **BeltLine** | 20-50 | 17 | 🔶 OK | Parks/outdoor |

### Foundation Source Actions
1. **FIX Creative Loafing** - This is Atlanta's primary local events aggregator. Zero events is critical.
2. **FIX Discover Atlanta** - Official tourism source, should have convention/tourism events.
3. **IMPROVE Access Atlanta** - Only 2 events from AJC's events calendar.

---

## Phase 2: Major Venues Assessment

### "Big 10" Anchor Venues

| Venue | Type | Expected | Actual | Status |
|-------|------|----------|--------|--------|
| **State Farm Arena** | Arena | 50-100/yr | 0 | ❌ BROKEN |
| **Mercedes-Benz Stadium** | Stadium | 30-50/yr | 0 | ❌ BROKEN |
| **Fox Theatre** | Theater | 100+/yr | 0 | ❌ BROKEN |
| **Coca-Cola Roxy** | Music | 150+/yr | 0 | ❌ BROKEN |
| **Tabernacle** | Music | 100+/yr | 0 | ❌ BROKEN |
| **Variety Playhouse** | Music | 150+/yr | 0 | ❌ BROKEN |
| **Terminal West** | Music | 100+/yr | 54 | ✅ Working |
| **The Earl** | Music | 100+/yr | 50 | ✅ Working |
| **Dad's Garage** | Comedy | 50+/yr | 16 | 🔶 Low |
| **Alliance Theatre** | Theater | 50+/yr | 0 | ❌ BROKEN |

### Ticketmaster Coverage Check
Many "broken" venue crawlers should still show events via Ticketmaster. Need to verify:
- State Farm Arena → Ticketmaster ✅
- Mercedes-Benz Stadium → Ticketmaster ✅
- Fox Theatre → Ticketmaster ✅

**Insight:** The big venues ARE in Ticketmaster (345 events), but venue-specific crawlers would provide richer data (descriptions, images, better categorization).

---

## Phase 3: Category Analysis

### Current Category Distribution (Future Events)

| Category | Count | % | Target % | Status |
|----------|-------|---|----------|--------|
| music | 228 | 13.2% | 25% | ❌ LOW |
| other | 201 | 11.6% | <5% | ⚠️ CLASSIFICATION ISSUE |
| film | 113 | 6.5% | 5% | ✅ Good |
| words | 87 | 5.0% | 5% | ✅ Good |
| sports | 85 | 4.9% | 8% | 🔶 Low |
| comedy | 63 | 3.6% | 5% | 🔶 Low |
| community | 55 | 3.2% | 10% | ❌ LOW |
| theater | 55 | 3.2% | 5% | 🔶 Low |
| meetup | 48 | 2.8% | 5% | 🔶 Low |
| food_drink | 26 | 1.5% | 8% | ❌ CRITICAL GAP |
| art | 25 | 1.4% | 5% | ❌ CRITICAL GAP |
| fitness | 9 | 0.5% | 5% | ❌ CRITICAL GAP |
| family | 3 | 0.2% | 8% | ❌ CRITICAL GAP |
| dance | 1 | 0.1% | 3% | ❌ CRITICAL GAP |
| nightlife | 1 | 0.1% | 5% | ❌ CRITICAL GAP |

### Category Gap Analysis

#### Music (13.2% → 25% target)
**Gap:** Need ~200 more music events
**Working Sources:** Terminal West, The Earl, 529, Eddie's Attic, Smith's Olde Bar
**Broken Sources (FIX THESE):**
- Variety Playhouse, Tabernacle, Coca-Cola Roxy
- Aisle 5, Blind Willie's, Buckhead Theatre
- The Masquerade, Northside Tavern
- Center Stage, Believe Music Hall

#### Nightlife (0.1% → 5% target)
**Gap:** Need ~85+ nightlife events
**Broken Sources (ALL):**
- Opera Nightclub, District Atlanta, Ravine
- Tongue & Groove, Gold Room, Domain
- Church Atlanta, Lyfe Atlanta
- All LGBTQ+ venues (Blake's, Heretic, Mary's, etc.)

#### Food & Drink (1.5% → 8% target)
**Gap:** Need ~110+ food events
**Broken Sources:**
- Krog Street Market, Ponce City Market, Sweet Auburn Market
- All breweries: Monday Night, SweetWater, Orpheus, etc.
- Farmers Markets (only 9 events)
- Atlanta Food & Wine Festival

#### Art (1.4% → 5% target)
**Gap:** Need ~60+ art events
**Broken Sources:**
- High Museum (only 5 events)
- Atlanta Contemporary (0 events)
- MOCA GA, Whitespace, ABV Gallery, Zucot

#### Family (0.2% → 8% target)
**Gap:** Need ~135+ family events
**Broken Sources:**
- Children's Museum (0)
- Georgia Aquarium (0)
- Zoo Atlanta (0)
- Fernbank (0)
- Chattahoochee Nature Center (0)

#### Fitness (0.5% → 5% target)
**Gap:** Need ~75+ fitness events
**Broken Sources:**
- Atlanta Track Club (0)
- Atlanta Outdoor Club (0)
- All yoga studios (0)
- Peachtree Road Race (0)

---

## Phase 4: Community & Niche Assessment

### LGBTQ+ Coverage - CRITICAL GAP
**Current:** 1 nightlife event total
**Sources (ALL BROKEN):**
- Atlanta Pride (0)
- Atlanta Black Pride (0)
- Southern Fried Queer Pride (0)
- Blake's on the Park (0)
- The Heretic (0)
- My Sister's Room (0)
- Mary's Bar (0)
- Atlanta Eagle (0)
- Bulldogs Atlanta (0)
- Lips Atlanta (0)

### Tech/Professional Community
**Working:** Meetup (48 events)
**Broken:**
- Atlanta Tech Village (0)
- Atlanta Tech Week (0)
- Render ATL (0)
- WeWork/Industrious (0)

### Cultural Centers - ALL BROKEN
- Marcus JCC (0)
- Callanwolde (0)
- Civil Rights Center (0)

---

## Top 20 Sources to Fix (Priority Order)

Based on expected event yield and category gaps:

| Priority | Source | Category | Expected Events | Fix Complexity |
|----------|--------|----------|-----------------|----------------|
| 1 | Creative Loafing | Aggregator | 100-200 | Medium (Playwright) |
| 2 | Variety Playhouse | Music | 150+ | Medium |
| 3 | Fox Theatre | Theater | 100+ | Low (JSON-LD) |
| 4 | Georgia Aquarium | Family | 50+ | Medium |
| 5 | Coca-Cola Roxy | Music | 150+ | Medium |
| 6 | Atlanta Pride | LGBTQ+ | 50+ | Medium |
| 7 | High Museum | Art | 50+ | Low |
| 8 | Tabernacle | Music | 100+ | Medium |
| 9 | Zoo Atlanta | Family | 50+ | Medium |
| 10 | Fernbank | Family | 50+ | Medium |
| 11 | Alliance Theatre | Theater | 50+ | Medium |
| 12 | Atlanta Track Club | Fitness | 100+ | Low |
| 13 | Children's Museum | Family | 30+ | Medium |
| 14 | SweetWater Brewing | Food/Drink | 30+ | Low |
| 15 | Krog Street Market | Food/Drink | 30+ | Medium |
| 16 | Atlanta Contemporary | Art | 30+ | Low |
| 17 | Monday Night Brewing | Food/Drink | 30+ | Low |
| 18 | Opera Nightclub | Nightlife | 50+ | Medium (FB/Insta) |
| 19 | Dad's Garage | Comedy | 50+ | Medium |
| 20 | Discover Atlanta | Aggregator | 50-100 | Medium |

---

## 3-Month Implementation Roadmap

### Month 1: Foundation Repair (Weeks 1-4)

#### Week 1: Critical Aggregators
- [ ] Debug & fix Creative Loafing crawler
- [ ] Debug & fix Discover Atlanta crawler
- [ ] Debug & fix Access Atlanta crawler
- [ ] Validate Ticketmaster geo coverage
- [ ] Validate Eventbrite geo coverage

**Target:** Aggregators producing 600+ events

#### Week 2: Big Music Venues
- [ ] Fix Variety Playhouse
- [ ] Fix Tabernacle
- [ ] Fix Coca-Cola Roxy
- [ ] Fix The Masquerade
- [ ] Fix Aisle 5, Buckhead Theatre

**Target:** +300 music events

#### Week 3: Family & Museums
- [ ] Fix Georgia Aquarium
- [ ] Fix Zoo Atlanta
- [ ] Fix Fernbank
- [ ] Fix Children's Museum
- [ ] Fix High Museum
- [ ] Fix Atlanta History Center

**Target:** +150 family/museum events

#### Week 4: Theater & Comedy
- [ ] Fix Fox Theatre
- [ ] Fix Alliance Theatre
- [ ] Fix Aurora Theatre
- [ ] Fix 7 Stages, Horizon Theatre
- [ ] Fix/improve Dad's Garage
- [ ] Fix Helium Comedy, Uptown Comedy

**Target:** +100 theater/comedy events

**Month 1 Total Target:** 2,800+ events (from 1,732)

---

### Month 2: Category Deep-Dive (Weeks 5-8)

#### Week 5: Food & Drink
- [ ] Fix Krog Street Market
- [ ] Fix Ponce City Market
- [ ] Fix Sweet Auburn Market
- [ ] Fix SweetWater, Monday Night, Orpheus breweries
- [ ] Fix ASW Distillery
- [ ] Fix Taste of Atlanta, Atlanta Food & Wine

**Target:** +100 food/drink events

#### Week 6: Art & Culture
- [ ] Fix Atlanta Contemporary
- [ ] Fix MOCA GA
- [ ] Fix all galleries (Whitespace, ABV, Zucot, Sandler Hudson)
- [ ] Fix Carlos Museum
- [ ] Fix Civil Rights Center

**Target:** +60 art events

#### Week 7: Nightlife & LGBTQ+
- [ ] Fix Opera Nightclub
- [ ] Fix District Atlanta, Ravine
- [ ] Fix all LGBTQ+ venues
- [ ] Fix Atlanta Pride
- [ ] Fix Blake's, Heretic, Mary's
- [ ] Fix Southern Fried Queer Pride

**Target:** +100 nightlife events

#### Week 8: Fitness & Outdoor
- [ ] Fix Atlanta Track Club
- [ ] Fix Atlanta Outdoor Club
- [ ] Fix BLK Hiking Club
- [ ] Fix all yoga studios
- [ ] Fix Chattahoochee Nature Center
- [ ] Fix Piedmont Park

**Target:** +80 fitness events

**Month 2 Total Target:** 3,400+ events

---

### Month 3: Community & Polish (Weeks 9-12)

#### Week 9: Community Organizations
- [ ] Fix Marcus JCC
- [ ] Fix Callanwolde
- [ ] Fix L5P Community Center
- [ ] Fix Decatur Recreation
- [ ] Expand Hands On Atlanta coverage
- [ ] Add neighborhood associations

**Target:** +50 community events

#### Week 10: Tech & Professional
- [ ] Fix Atlanta Tech Village
- [ ] Fix WeWork/Industrious events
- [ ] Fix Atlanta Tech Week
- [ ] Fix Render ATL
- [ ] Expand Meetup categories

**Target:** +50 professional events

#### Week 11: Festivals & Seasonal
- [ ] Verify all festival crawlers
- [ ] Dragon Con, MomoCon
- [ ] Shaky Knees, Music Midtown
- [ ] Atlanta Jazz Festival
- [ ] All neighborhood festivals

**Target:** +30 festival events

#### Week 12: Data Quality & Optimization
- [ ] Fix 164 venues with "Unknown" neighborhood
- [ ] Fix 221 venues with "unknown" type
- [ ] Reduce "other" category events
- [ ] Dedupe audit
- [ ] Performance optimization

**Target:** Data quality score >85%

**Month 3 Total Target:** 4,000+ events

---

## Success Metrics

### After 3 Months
| Metric | Current | Target | Improvement |
|--------|---------|--------|-------------|
| Future Events | 1,732 | 4,000+ | +131% |
| Producing Sources | 34 | 150+ | +341% |
| Music Events | 228 | 800+ | +251% |
| Nightlife Events | 1 | 100+ | +9,900% |
| Food/Drink Events | 26 | 150+ | +477% |
| Art Events | 25 | 100+ | +300% |
| Family Events | 3 | 150+ | +4,900% |
| Fitness Events | 9 | 100+ | +1,011% |
| Weeks Forward | 5 | 12+ | +140% |
| Venue Data Quality | 42% | 85%+ | +102% |

### Category Distribution Target (After 3 Months)
| Category | Current % | Target % |
|----------|-----------|----------|
| music | 13.2% | 20% |
| community | 3.2% | 12% |
| food_drink | 1.5% | 10% |
| family | 0.2% | 10% |
| sports | 4.9% | 8% |
| theater | 3.2% | 6% |
| nightlife | 0.1% | 6% |
| comedy | 3.6% | 5% |
| art | 1.4% | 5% |
| fitness | 0.5% | 5% |
| film | 6.5% | 5% |
| meetup | 2.8% | 4% |
| words | 5.0% | 3% |
| other | 11.6% | <2% |

---

## Appendix: All Broken Sources by Category

### Music (15 broken sources)
- variety-playhouse, tabernacle, coca-cola-roxy, the-masquerade
- aisle5, blind-willies, buckhead-theatre, center-stage
- believe-music-hall, the-loft, northside-tavern, red-light-cafe
- venkmans, the-eastern, wild-heaven

### Theater (12 broken sources)
- fox-theatre, alliance-theatre, aurora-theatre, horizon-theatre
- actors-express, out-of-box-theatre, stage-door-players
- seven-stages, theatrical-outfit, true-colors-theatre
- synchronicity-theatre, atlanta-lyric-theatre

### Art/Museums (12 broken sources)
- atlanta-contemporary, moca-ga, whitespace-gallery, abv-gallery
- zucot-gallery, sandler-hudson, high-museum*, carlos-museum
- atlanta-history-center, civil-rights-center, fernbank, college-football-hof

### Family (5 broken sources)
- georgia-aquarium, zoo-atlanta, childrens-museum
- chattahoochee-nature, world-of-coca-cola

### Food/Drink (12 broken sources)
- krog-street-market, ponce-city-market, sweet-auburn-market
- sweetwater, monday-night, orpheus-brewing, three-taverns
- pontoon-brewing, scofflaw-brewing, second-self-brewing
- bold-monk-brewing, reformation-brewery

### Nightlife (6 broken sources)
- opera-nightclub, district-atlanta, ravine-atlanta
- tongue-and-groove, gold-room, domaine-atlanta

### LGBTQ+ (11 broken sources)
- atlanta-pride, southern-fried-queer-pride, atlanta-black-pride
- blakes-on-park, the-heretic, my-sisters-room, marys-bar
- atlanta-eagle, bulldogs-atlanta, lips-atlanta, future-atlanta

### Comedy (4 broken sources)
- helium-comedy, uptown-comedy, whole-world-improv, atlanta-comedy-theater

### Fitness (7 broken sources)
- atlanta-track-club, atlanta-outdoor-club, blk-hiking-club
- highland-yoga, yonder-yoga, dancing-dogs-yoga, vista-yoga

### Festivals (13 broken sources)
- dragon-con, momocon, shaky-knees, atlanta-jazz-festival
- atlanta-dogwood, inman-park-festival, grant-park-festival
- candler-park-fest, east-atlanta-strut, decatur-arts-festival
- decatur-book-festival, sweet-auburn-springfest, taste-of-atlanta

---

*Generated by Lost City Crawler Strategy Analysis*
*Last Updated: January 19, 2026*
