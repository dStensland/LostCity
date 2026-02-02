# Marietta Coverage Gap Analysis
**Generated:** 2026-01-31
**Analyst:** Data Quality Team

## Executive Summary

LostCity currently has **minimal coverage** of Marietta and broader Cobb County, with only **19 venues** and **~33 events** in the system. This represents a significant gap given Marietta's size (60,000+ residents) and position as Cobb County's seat and a major Atlanta metro suburb.

## Current State

### Venues in Database
**Total Marietta Venues:** 19
**Geocoded:** 11 (58%)

#### Breakdown by Type
| Type | Count |
|------|-------|
| Theater | 4 |
| Recreation | 3 |
| Community Center | 2 |
| Library | 2 |
| Nightclub | 2 |
| Restaurant | 2 |
| Brewery | 1 |
| Water Park | 1 |
| Event Space | 1 |
| Museum | 1 |

#### Notable Existing Venues
- **Earl Smith Strand Theatre** (Marietta Square)
- **Atlanta Lyric Theatre**
- **Out of Box Theatre**
- **Marietta Cobb Museum of Art**
- **Schoolhouse Brewing**
- **The Maker Station**
- **Marietta Square** (event space)
- **Cobb County Public Library System** (15 branches)
- **KSU Dance Theater, Marietta Campus**

### Events Coverage
- **Total Events:** ~33 (limited sample)
- **Upcoming Events:** ~19
- **Event Sources:** Limited to specific crawlers

### Dedicated Marietta/Cobb Sources

| ID | Status | Source Name | URL |
|----|--------|-------------|-----|
| 303 | ACTIVE | Cobb County Public Library | cobbcounty.gov/events |
| 85 | ACTIVE | Cobb Energy Performing Arts Centre | cobbenergycentre.com |
| 87 | ACTIVE | Cobb Galleria Centre | cobbgalleria.com |
| 398 | ACTIVE | Marietta Cobb Museum of Art | mariettacobbartmuseum.org |
| 358 | INACTIVE | Indivisible Cobb (Mobilize) | mobilize.us/indivisiblecobb |

**Active Crawlers:** 4 out of 5

### Existing Crawler Analysis

#### 1. marietta_cobb_museum.py
- **Status:** Implemented, complete
- **Venue:** Marietta Cobb Museum of Art
- **Coverage:** Art exhibitions, receptions, workshops
- **Quality:** Good - comprehensive event extraction

#### 2. cobb_library.py  
- **Status:** Implemented, comprehensive
- **Venues:** 15 library branches across Cobb County
  - 9 branches in Marietta
  - Others in Kennesaw, Mableton, Austell, Powder Springs, Vinings
- **Coverage:** Storytimes, book clubs, classes, author talks, community programs
- **Quality:** Excellent - structured data extraction from county website

#### 3. cobb_energy.py
- **Status:** Implemented
- **Venue:** Cobb Energy Performing Arts Centre (Cumberland/Atlanta border)
- **Coverage:** Concerts, theater, ballet, opera
- **Note:** City listed as "Atlanta" but serves Cobb County

#### 4. cobb_galleria.py
- **Status:** Implemented  
- **Venue:** Cobb Galleria Centre (convention center)
- **Coverage:** Trade shows, conferences, conventions
- **Note:** City listed as "Atlanta" but in Cumberland/Cobb area

### Adjacent Coverage (Cobb County Cities)

**Kennesaw:**
- Kennesaw State University (kennesaw_state.py) - Bailey Performance Center, arts events
- KSU Athletics (ksu_athletics.py)
- West Cobb Regional Library (via cobb_library.py)

**Smyrna:**
- Six Flags Over Georgia (six_flags.py)
- SOHO Lounge (nightclub, in database)

**Other Cobb:**
- Level Up Gaming (level_up_gaming.py) - Kennesaw location

## Gap Analysis

### Critical Gaps

#### 1. **Downtown Marietta Square Events**
**Missing:**
- Marietta Square Farmers Market (year-round, Saturdays)
- Concert Series in the Park (summer)
- Art in the Park
- Movies in the Park
- Chalktoberfest
- Taste of Marietta
- Christmas parade and festivities

**Source:** City of Marietta website, Marietta Square Market

#### 2. **Theater Coverage Gaps**
**Have:** Earl Smith Strand Theatre, Atlanta Lyric Theatre, Out of Box Theatre, KSU venues

**Missing:**
- Theatre in the Square (former landmark venue - check if still active)
- Community theater groups
- Student productions beyond KSU

#### 3. **Live Music Venues**
**Have:** Schoolhouse Brewing (limited)

**Missing:**
- The Glover Park Concert Series
- Bars/restaurants with live music
- Music venues in Marietta Square area
- Coffee shops with open mics

#### 4. **Parks & Recreation**
**Have:** White Water (water park)

**Missing:**
- City of Marietta Parks & Recreation events
- Youth sports leagues (if public events)
- Running clubs/races
- Outdoor fitness classes

#### 5. **Food & Drink Events**
**Have:** Schoolhouse Brewing

**Missing:**
- Brewery events (if other breweries exist)
- Restaurant events (tastings, wine dinners)
- Food festivals beyond Taste of Marietta
- Farmers markets beyond the Square

#### 6. **Family & Kids**
**Have:** Library programs (excellent coverage via cobb_library.py)

**Missing:**
- Marietta Museum of History events (if they exist)
- Gone with the Wind Museum
- Kids classes/workshops at other venues
- Story times outside libraries

#### 7. **Business & Networking**
**Missing:**
- Marietta Chamber of Commerce events
- Business After Hours
- Networking meetups
- Professional development

#### 8. **Arts & Culture**
**Have:** Marietta Cobb Museum of Art

**Missing:**
- Gallery openings (if independent galleries exist)
- Artist studio tours
- Craft fairs
- Art classes/workshops outside museum

#### 9. **Community & Civic**
**Have:** Library events

**Missing:**
- City Council meetings (public)
- Neighborhood association events
- Community cleanups
- Volunteer events

#### 10. **Faith-Based Events**
**Have:** West Cobb Church (venue in system)

**Missing:**
- Concerts at churches
- Festival events
- Public community service events

### Geographic Gaps

**Cobb County Coverage Issues:**
- **East Cobb:** Limited - only library branches
- **West Cobb:** Very limited - one library, one church
- **South Cobb:** Minimal - libraries only
- **Smyrna:** Minimal - Six Flags, one nightclub
- **Acworth:** None identified
- **Austell:** Library only
- **Powder Springs:** Library only

## Comparison to Other Coverage

**Total LostCity Crawlers:** ~408 source files
**Marietta-Specific:** 5 (1.2%)
**Active Marietta:** 4 (1.0%)

**Atlanta Coverage:** Extensive (130+ active sources)
**Decatur Coverage:** Good coverage
**Marietta Coverage:** Poor coverage

## Recommended Actions

### High Priority

1. **Add Marietta Square Events Source**
   - Target: mariettaga.gov events calendar
   - Coverage: All downtown/square events
   - Estimated: 50-100 annual events

2. **Add Marietta Parks & Recreation**
   - Target: mariettaga.gov/parks
   - Coverage: Concerts, movies, festivals, classes
   - Estimated: 100+ annual events

3. **Theater Venues Verification**
   - Verify Theatre in the Square status
   - Add any missing theater venues
   - Ensure all theater events captured

4. **Music Venue Discovery**
   - Research live music venues in Marietta
   - Add Glover Park concert calendar
   - Add bars/restaurants with regular music

### Medium Priority

5. **Chamber of Commerce Events**
   - Target: mariettachamber.com events
   - Coverage: Business networking, community events

6. **Marietta Museum of History**
   - Target: mariettahistory.org
   - Coverage: Exhibits, lectures, tours

7. **Restaurant Event Aggregation**
   - Survey Marietta Square restaurants
   - Add special dinner events, wine tastings

8. **Seasonal Festival Tracking**
   - Ensure major festivals are captured
   - Add recurring annual events

### Lower Priority

9. **Broader Cobb County Sources**
   - Add Smyrna events
   - Add East Cobb community events
   - Add Acworth events

10. **Regional Sources That May Include Marietta**
    - Verify if Creative Loafing covers Marietta
    - Check Eventbrite for Marietta events
    - Review ArtsATL for Marietta arts coverage

## Data Quality Issues

### Geocoding
- 8 out of 19 venues (42%) lack coordinates
- Priority: Geocode all Marietta venues

### Neighborhood Assignment
- Several venues show "(not set)" for neighborhood
- Marietta neighborhoods: Marietta Square, West Cobb, East Cobb
- Action: Assign neighborhoods to all venues

### City Field Consistency
- Cobb Energy Centre shows city="Atlanta" (should be Marietta or note Cobb County)
- Cobb Galleria shows city="Atlanta" (should be Atlanta with note about serving Cobb)
- Action: Review city assignments for Cumberland area venues

### Venue Type Completeness
- All venues have types assigned - good
- Types seem appropriate

## Source Recommendations (Prioritized)

### Tier 1: Essential (Immediate)
1. **Marietta Parks & Recreation** - mariettaga.gov/city-government/departments/parks-recreation
2. **Marietta Square Market** - mariettasquaremarket.com
3. **Marietta/Cobb Convention & Visitors Bureau** - mariettacvb.com/events

### Tier 2: High Value (Next 30 days)
4. **Theatre in the Square** (if active) - theatreinthesquare.net
5. **Glover Park Concert Series** - Part of Parks & Rec
6. **Marietta Museum of History** - mariettahistory.org
7. **Marietta Chamber of Commerce** - mariettachamber.com

### Tier 3: Expanded Coverage (Next 60 days)
8. **Smyrna** - smyrnaga.gov/events
9. **East Cobb events aggregator** (if exists)
10. **Individual venue discovery** - Bars, restaurants, galleries

## Metrics to Track

### Coverage Goals (6 months)
- **Venues:** Increase from 19 to 75+ (4x)
- **Events:** Increase from ~33 to 200+ upcoming (6x)
- **Sources:** Increase from 4 to 12+ active (3x)
- **Geocoding:** 100% of venues (currently 58%)

### Quality Goals
- **Neighborhood assignment:** 100% (currently ~60%)
- **Venue photos:** 50%+ have images
- **Event descriptions:** 80%+ have meaningful descriptions
- **Event images:** 60%+ have images

## Next Steps

1. **Immediate:** Run existing Marietta crawlers to get baseline event count
2. **This week:** Implement Marietta Parks & Recreation crawler
3. **This week:** Implement Marietta Square Market crawler
4. **Next week:** Verify and implement Theatre in the Square
5. **Next 2 weeks:** Add Marietta Museum of History
6. **Monthly:** Review coverage gaps and add 2-3 new sources

## Appendix: Full Venue List

### Current Marietta Venues (19 total)

1. Andretti Indoor Karting & Games Marietta (recreation)
2. Atlanta Lyric Theatre (theater) - Marietta neighborhood
3. Cobb County Public Library System (library) - Marietta
4. Dave & Busters Marietta (recreation) - Marietta
5. Diamond Cabaret (nightclub) - Marietta
6. Earl Smith Strand Theatre (theater) - Marietta Square
7. KSU Dance Theater, Marietta Campus (theater) - Marietta
8. Marietta Cobb Museum of Art (museum) - Marietta Square
9. Marietta Library (library) - Marietta
10. Marietta Square (event_space) - Marietta
11. Monster Mini Golf Marietta (recreation) - Marietta
12. Out of Box Theatre (theater) - Marietta
13. Schoolhouse Brewing (brewery) - Marietta
14. SOHO Lounge (nightclub) - Smyrna
15. The Maker Station (community_center) - Marietta
16. Varenita of West Cobb (restaurant) - West Cobb
17. Waffle House (Marietta) (restaurant) - Marietta
18. West Cobb Church (community_center) - Marietta
19. White Water (water_park) - Marietta

### Cobb County Library Branches (from cobb_library.py)
**Marietta locations:**
- East Cobb Library
- Gritters Library
- Kemp Memorial Library
- Lewis A. Ray Library
- Mountain View Regional Library
- Sibley Library
- Stratton Library
- Switzer Library
- Sewell Mill Library & Cultural Center
- Merchants Walk Library

**Other Cobb locations:**
- South Cobb Regional Library (Mableton)
- West Cobb Regional Library (Kennesaw)
- Vinings Library (Atlanta/Vinings)
- Sweetwater Valley Library (Austell)
- Powder Springs Library (Powder Springs)
