# Crawler Candidate Analysis
**Data Quality Specialist Report**
**Date:** 2026-02-01
**Status:** 471 active crawlers / 500+ venues with websites

---

## Executive Summary

Analysis of the LostCity database reveals **23 high-priority venues** that are event-focused but currently lack dedicated crawlers. These venues represent significant coverage gaps, particularly in:

- **Music venues** (7 missing): Major concert venues with 50-200+ events/year
- **Comedy clubs** (2 missing): Nightly shows, major touring acts
- **Breweries** (3 missing): Weekly events, concerts, food trucks
- **Museums** (2 missing): Exhibitions, educational programs, special events

**Recommendation:** Prioritize the top 10 venues listed below, which collectively could add 500-1000+ events annually to the platform.

---

## Priority Tier 1: Critical Coverage Gaps

### 🎵 Music Venues

#### 1. Center Stage / Vinyl / The Loft ⭐⭐⭐
- **Website:** https://www.centerstage-atlanta.com
- **Location:** Midtown
- **Venue IDs:** 972, 973, 974
- **Why:** 3-room complex (Center Stage, Vinyl, The Loft) hosting major touring acts
- **Event Volume:** 100-150 shows/year
- **Impact:** HIGH - Major venue complex with national touring acts
- **Implementation:** Single crawler can handle all 3 rooms (same website)

#### 2. Smith's Olde Bar
- **Website:** https://www.smithsoldebar.com
- **Location:** Midtown
- **Venue ID:** 970
- **Why:** Historic music venue + restaurant, local/regional bands
- **Event Volume:** 150+ shows/year
- **Impact:** MEDIUM-HIGH - Popular local venue

#### 3. Aisle 5
- **Website:** https://www.aisle5atlanta.com
- **Location:** Edgewood
- **Venue ID:** 965
- **Why:** Smaller venue, local bands, craft cocktails
- **Event Volume:** 50-100 events/year
- **Impact:** MEDIUM - Neighborhood venue

#### 4. Apache Cafe
- **Website:** https://www.apachecafe.net
- **Location:** Poncey-Highland
- **Venue ID:** 969
- **Why:** Open mic nights, singer-songwriters
- **Event Volume:** 100+ events/year
- **Impact:** MEDIUM - Community music venue

#### 5. MadLife Stage & Studios
- **Website:** https://madlifestage.com
- **Location:** Duluth
- **Venue ID:** 1309
- **Why:** OTP music venue, covers northern suburbs
- **Event Volume:** 80+ shows/year
- **Impact:** MEDIUM - Geographic expansion (OTP)

#### 6. Perfect Note
- **Website:** https://www.perfectnoteatl.com
- **Location:** Chamblee
- **Venue ID:** 1338
- **Why:** Jazz and acoustic venue
- **Event Volume:** 50+ events/year
- **Impact:** MEDIUM - Niche jazz audience

---

### 🎭 Comedy Clubs

#### 7. The Punchline ⭐⭐⭐
- **Website:** https://www.punchline.com
- **Location:** Sandy Springs
- **Venue ID:** 142
- **Why:** Major comedy club, national touring comedians
- **Event Volume:** 200+ shows/year (nightly shows)
- **Impact:** HIGH - Premier comedy venue in Atlanta
- **Note:** Multiple shows per night, major headliners

#### 8. Laughing Skull Lounge
- **Website:** https://laughingskulllounge.com
- **Location:** Midtown
- **Venue ID:** 140
- **Why:** Smaller comedy club, up-and-coming comedians
- **Event Volume:** 150+ shows/year
- **Impact:** MEDIUM-HIGH - Popular comedy spot

---

### 🍺 Breweries

#### 9. Monday Night Brewing ⭐⭐
- **Website:** http://mondaynightbrewing.com
- **Location:** Westside
- **Venue ID:** 371
- **Why:** Large brewery with live music, food trucks, community events
- **Event Volume:** 100+ events/year
- **Impact:** HIGH - Very popular event venue
- **Note:** Multiple locations (Westside, Garage)

#### 10. SweetWater Brewing
- **Website:** https://www.sweetwaterbrew.com
- **Location:** Armour
- **Venue ID:** 420
- **Why:** Major Atlanta brewery, concerts, festivals
- **Event Volume:** 50+ events/year
- **Impact:** HIGH - Large-scale events, festivals

#### 11. New Realm Brewing
- **Website:** https://newrealmbrewing.com/atlanta
- **Location:** Virginia-Highland
- **Venue ID:** 925
- **Why:** Restaurant + brewery, live music
- **Event Volume:** 60+ events/year
- **Impact:** MEDIUM - Neighborhood brewery

---

### 🏛️ Museums

#### 12. Fernbank Museum ⭐⭐⭐
- **Website:** https://www.fernbankmuseum.org
- **Location:** Druid Hills
- **Venue ID:** 212
- **Why:** Major museum with IMAX, exhibitions, educational programs
- **Event Volume:** 50-100 events/year
- **Impact:** HIGH - Major cultural institution
- **Note:** Special exhibitions, film screenings, family events

#### 13. Center for Puppetry Arts
- **Website:** https://puppet.org
- **Location:** Midtown
- **Venue ID:** 196
- **Why:** Unique museum, puppet shows, workshops
- **Event Volume:** 200+ shows/year
- **Impact:** HIGH - Family-friendly, unique content
- **Note:** Multiple daily performances

---

## Priority Tier 2: Secondary Targets

### 🎨 Art Venues

#### Chastain Arts Center
- **Website:** https://www.chastainarts.org
- **Location:** Chastain Park
- **Venue ID:** 1347
- **Event Volume:** 40+ events/year
- **Impact:** MEDIUM - Classes, exhibitions, workshops

#### Mint Gallery
- **Website:** https://mintgallery.com
- **Location:** Edgewood
- **Venue ID:** 246
- **Event Volume:** 20-30 events/year
- **Impact:** LOW-MEDIUM - Gallery openings, artist talks

---

### 🍻 Bars with Events

#### 529 Bar
- **Website:** https://529atl.com
- **Location:** East Atlanta
- **Venue ID:** 1009
- **Event Volume:** 100+ shows/year
- **Impact:** MEDIUM - Dive bar with punk/indie shows

#### Church Bar
- **Website:** https://www.churchatlanta.com
- **Location:** Little Five Points
- **Venue ID:** 581
- **Event Volume:** 80+ events/year
- **Impact:** MEDIUM - LGBTQ+ venue, drag shows, DJ nights

#### The Porter Beer Bar
- **Website:** https://www.theporterbeerbar.com
- **Location:** Little Five Points
- **Venue ID:** 916
- **Event Volume:** 50+ events/year
- **Impact:** MEDIUM - Beer bar with occasional live music

---

### 🎭 Theater

#### Actor's Express
- **Website:** https://actors-express.com
- **Location:** West Midtown
- **Venue ID:** 152
- **Event Volume:** 6-8 shows/year
- **Impact:** MEDIUM - Professional theater

#### Out Front Theatre Company
- **Website:** https://www.outfronttheatre.com
- **Location:** Midtown
- **Venue ID:** 1233
- **Event Volume:** 6-8 shows/year
- **Impact:** MEDIUM - LGBTQ+ theater

---

### 📚 Bookstores

#### Eagle Eye Book Shop
- **Website:** https://eagleeyebooks.com
- **Location:** Decatur
- **Venue ID:** 274
- **Event Volume:** 30+ events/year
- **Impact:** LOW-MEDIUM - Author readings, book clubs

---

### 🏟️ Entertainment Districts

#### The Battery Atlanta
- **Website:** https://www.batteryatl.com
- **Location:** Cumberland
- **Venue ID:** 897
- **Event Volume:** 100+ events/year
- **Impact:** MEDIUM-HIGH - Mixed-use district with concerts, festivals
- **Note:** Multiple sub-venues, complex calendar

---

## Implementation Priority Ranking

### Top 10 by Impact

| Rank | Venue | Type | Est. Events/Year | Impact | Difficulty |
|------|-------|------|------------------|--------|------------|
| 1 | Center Stage Complex | Music | 150 | HIGH | Medium |
| 2 | The Punchline | Comedy | 200+ | HIGH | Low |
| 3 | Fernbank Museum | Museum | 75 | HIGH | Medium |
| 4 | Monday Night Brewing | Brewery | 100 | HIGH | Low |
| 5 | Center for Puppetry Arts | Museum | 200+ | HIGH | Medium |
| 6 | SweetWater Brewing | Brewery | 50 | HIGH | Low |
| 7 | Smith's Olde Bar | Music | 150 | MEDIUM-HIGH | Low |
| 8 | Laughing Skull Lounge | Comedy | 150 | MEDIUM-HIGH | Low |
| 9 | The Battery Atlanta | Entertainment | 100 | MEDIUM-HIGH | High |
| 10 | Aisle 5 | Music | 75 | MEDIUM | Low |

---

## Crawler Implementation Notes

### Easy Wins (Low Difficulty)
These venues likely have simple, parseable event calendars:
- The Punchline (Ticketmaster/standard calendar)
- Monday Night Brewing (standard brewery calendar)
- SweetWater Brewing (standard brewery calendar)
- Smith's Olde Bar (calendar page)
- Laughing Skull Lounge (ticketing integration)
- Aisle 5 (simple calendar)

### Medium Complexity
May require LLM extraction or custom parsing:
- Center Stage Complex (multiple rooms, Ticketmaster)
- Fernbank Museum (exhibitions + events)
- Center for Puppetry Arts (show schedules)
- New Realm Brewing (restaurant + events)

### High Complexity
Complex calendars or multiple sub-venues:
- The Battery Atlanta (district-wide events, multiple sources)

---

## Geographic Coverage Analysis

### Current Gaps
- **Midtown Music:** Center Stage complex, Smith's Olde Bar
- **Comedy:** Both major comedy clubs (Punchline, Laughing Skull)
- **Museums:** Fernbank, Center for Puppetry Arts
- **Breweries:** Monday Night (major), SweetWater (major)

### OTP Expansion Opportunities
- MadLife Stage & Studios (Duluth)
- Perfect Note (Chamblee)
- The Punchline (Sandy Springs)

---

## Next Steps

### Phase 1: Quick Wins (Week 1-2)
1. The Punchline - comedy shows
2. Monday Night Brewing - brewery events
3. Smith's Olde Bar - music venue
4. Laughing Skull Lounge - comedy shows

**Expected Impact:** 600-700 events added

### Phase 2: High-Value Venues (Week 3-4)
1. Center Stage Complex - major music venue
2. Fernbank Museum - cultural events
3. SweetWater Brewing - large brewery
4. Center for Puppetry Arts - family shows

**Expected Impact:** 400-500 events added

### Phase 3: Fill Coverage Gaps (Week 5-6)
1. Aisle 5 - neighborhood music
2. Apache Cafe - local music
3. 529 Bar - punk/indie shows
4. Church Bar - LGBTQ+ events
5. The Battery Atlanta - district events

**Expected Impact:** 300-400 events added

---

## Data Quality Monitoring

Once these crawlers are implemented, monitor for:

### Common Issues
- **Duplicate events:** Center Stage complex has 3 rooms
- **Price extraction:** Comedy clubs often have drink minimums
- **Time zones:** Ensure consistent UTC handling
- **Recurring events:** Brewery taproom hours vs. special events
- **Category assignment:** Museum events span multiple categories

### Quality Checks
```sql
-- Check for new venues after crawler runs
SELECT source_id, COUNT(*) as event_count
FROM events
WHERE source_id IN (
  SELECT id FROM sources 
  WHERE slug IN ('center_stage_theater', 'the_punchline', 'fernbank_museum')
)
GROUP BY source_id;

-- Verify venue assignment
SELECT v.name, COUNT(e.id) as events
FROM events e
JOIN venues v ON e.venue_id = v.id
WHERE v.id IN (972, 973, 974, 142, 212)
GROUP BY v.name;
```

---

## Appendix: Full Venue List

### All 23 Missing Crawlers

| Category | Name | Website | Location | ID |
|----------|------|---------|----------|-----|
| Music | Vinyl | https://www.centerstage-atlanta.com | Midtown | 974 |
| Music | Center Stage Theater | https://www.centerstage-atlanta.com | Midtown | 972 |
| Music | The Loft | https://www.centerstage-atlanta.com | Midtown | 973 |
| Music | Smith's Olde Bar | https://www.smithsoldebar.com | Midtown | 970 |
| Music | Aisle 5 | https://www.aisle5atlanta.com | Edgewood | 965 |
| Music | Apache Cafe | https://www.apachecafe.net | Poncey-Highland | 969 |
| Music | MadLife Stage | https://madlifestage.com | Duluth | 1309 |
| Music | Perfect Note | https://www.perfectnoteatl.com | Chamblee | 1338 |
| Comedy | The Punchline | https://www.punchline.com | Sandy Springs | 142 |
| Comedy | Laughing Skull | https://laughingskulllounge.com | Midtown | 140 |
| Brewery | Monday Night | http://mondaynightbrewing.com | Westside | 371 |
| Brewery | SweetWater | https://www.sweetwaterbrew.com | Armour | 420 |
| Brewery | New Realm | https://newrealmbrewing.com/atlanta | Virginia-Highland | 925 |
| Museum | Fernbank | https://www.fernbankmuseum.org | Druid Hills | 212 |
| Museum | Puppetry Arts | https://puppet.org | Midtown | 196 |
| Gallery | Chastain Arts | https://www.chastainarts.org | Chastain Park | 1347 |
| Gallery | Mint Gallery | https://mintgallery.com | Edgewood | 246 |
| Theater | Actor's Express | https://actors-express.com | West Midtown | 152 |
| Theater | Out Front | https://www.outfronttheatre.com | Midtown | 1233 |
| Bar | 529 Bar | https://529atl.com | East Atlanta | 1009 |
| Bar | Church | https://www.churchatlanta.com | Little Five Points | 581 |
| Bar | The Porter | https://www.theporterbeerbar.com | Little Five Points | 916 |
| Bookstore | Eagle Eye | https://eagleeyebooks.com | Decatur | 274 |
| Entertainment | The Battery | https://www.batteryatl.com | Cumberland | 897 |

---

**Report prepared by:** Data Quality Specialist
**For:** crawler-dev team
**Action Required:** Prioritize top 10 crawlers for implementation
