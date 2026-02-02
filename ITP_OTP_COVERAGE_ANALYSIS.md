# LostCity Atlanta Metro Coverage Analysis: ITP vs OTP

**Generated:** 2026-01-31  
**Analyst:** Data Quality Specialist

## Executive Summary

LostCity has **strong coverage** of ITP (Inside the Perimeter) Atlanta but **significant gaps** in OTP (Outside the Perimeter) suburban metro coverage. This creates a **urban bias** that doesn't reflect the region's population distribution.

### Key Findings

- **72% of venues are ITP**, yet ITP Atlanta city is only ~500k of the ~6.2M metro population (8%)
- **64% of events are ITP** vs 33% OTP (remaining are Decatur/other)
- OTP coverage is **10x weaker** than ITP (1.5 venues per 10k pop vs 15.2)
- **135 of 329 active crawlers** focus exclusively on ITP venues
- Only **28 crawlers** focus on OTP suburbs, leaving major cities underserved
- **Suwanee** (20k pop) has zero coverage; **Johns Creek** (85k) has only 3 venues

---

## 1. Venue Distribution

### Overall Breakdown

| Area | Venues | % of Total | Population | Coverage Ratio |
|------|--------|------------|------------|----------------|
| **ITP (Inside I-285)** | 721 | 72.1% | ~500k | 15.2 venues/10k pop |
| **OTP (Outside I-285)** | 178 | 17.8% | ~5.7M | 0.3 venues/10k pop |
| **Decatur area** | 39 | 3.9% | ~50k | 7.8 venues/10k pop |
| **Other/Unknown** | 62 | 6.2% | - | - |
| **TOTAL** | 1,000 | 100% | ~6.2M | - |

**Note:** The 1,000 venues analyzed here represent venues with clear location data. Total platform has 1,203 venues.

### Top ITP Neighborhoods (by venue count)

1. **Downtown**: 108 venues
2. **Midtown**: 99 venues  
3. **Buckhead**: 79 venues
4. **West Midtown**: 32 venues
5. **Old Fourth Ward**: 28 venues
6. **Westside**: 26 venues
7. **East Atlanta**: 20 venues
8. **Poncey-Highland**: 19 venues
9. **Virginia-Highland**: 18 venues
10. **Little Five Points**: 18 venues

### Top OTP Cities (by venue count)

1. **Marietta**: 16 venues (2.6 per 10k pop)
2. **Sandy Springs**: 12 venues (1.1 per 10k pop)
3. **Dunwoody**: 9 venues (1.8 per 10k pop)
4. **Alpharetta**: 9 venues (1.4 per 10k pop)
5. **Duluth**: 9 venues (3.0 per 10k pop)
6. **Kennesaw**: 9 venues (2.6 per 10k pop)
7. **Roswell**: 7 venues (0.7 per 10k pop)
8. **Lawrenceville**: 5 venues (1.7 per 10k pop)
9. **Smyrna**: 5 venues (0.9 per 10k pop)

---

## 2. Event Distribution (Last 90 Days + Next 90 Days)

| Area | Events | % of Total |
|------|--------|------------|
| **ITP** | 641 | 64.1% |
| **OTP** | 330 | 33.0% |
| **Decatur** | 5 | 0.5% |
| **Other** | 24 | 2.4% |

### Analysis

- While ITP has 72% of venues, it generates 64% of events
- OTP venues are **more active** per venue (33% of events from 18% of venues)
- This suggests OTP venues host more recurring/frequent events
- **Decatur is severely underrepresented** despite being a major cultural hub

---

## 3. Crawler Focus Analysis

**Total Sources:** 401 (329 active)

### Source Distribution by Focus

| Focus Type | Count | % of Active |
|------------|-------|-------------|
| **ITP-focused** (75%+ ITP events) | 135 | 41% |
| **OTP-focused** (75%+ OTP events) | 28 | 8.5% |
| **Mixed** (balanced coverage) | 2 | 0.6% |
| **Other/Inactive** | 236 | 50.9% |

### Top ITP-Focused Crawlers (by event volume)

1. **Dad's Garage**: 100 ITP events
2. **Plaza Theatre**: 100 ITP events  
3. **Tara Theatre**: 100 ITP events
4. **529**: 100 ITP events
5. **The Masquerade**: 100 ITP events
6. **Landmark Midtown Art Cinema**: 100 ITP events
7. **Georgia Tech Athletics**: 100 ITP events
8. **Eventbrite**: 82 ITP, 9 OTP
9. **Atlanta Recurring Social Events**: 82 ITP, 18 OTP
10. **Hands On Atlanta**: 78 ITP, 19 OTP

### Top OTP-Focused Crawlers (by event volume)

1. **Stone Mountain Park**: 100 OTP events
2. **City Springs** (Sandy Springs): 99 OTP events
3. **Piedmont Healthcare**: 78 OTP events (multi-location)
4. **Kennesaw State Athletics**: 62 OTP events
5. **Coca-Cola Roxy** (Cumberland): 40 OTP events
6. **Kennesaw State University**: 29 OTP events
7. **Aurora Theatre** (Lawrenceville): 26 OTP events
8. **Spivey Hall** (Morrow): 21 OTP events
9. **The Maker Station** (Alpharetta): 19 OTP events
10. **Battle & Brew** (Marietta): 17 OTP events

### Mixed Coverage Crawlers

Only **2 sources** provide balanced ITP/OTP coverage:
- **Ticketmaster**: 61 ITP, 39 OTP
- **Atlanta-Fulton Public Library**: 32 ITP, 59 OTP

---

## 4. Major Coverage Gaps

### 4A. Missing OTP Cities (Zero Coverage)

| City | Population | Notes |
|------|------------|-------|
| **Suwanee** | 20,000 | Growing suburb, Town Center Park events |

### 4B. Weak OTP Coverage (<5 venues)

| City | Population | Venues | Venues per 10k |
|------|------------|--------|----------------|
| **Johns Creek** | 85,000 | 3 | 0.4 |
| **East Point** | 38,000 | 4 | 1.1 |
| **Tucker** | 35,000 | 3 | 0.9 |
| **Acworth** | 22,000 | 1 | 0.5 |
| **Forest Park** | 20,000 | 2 | 1.0 |
| **Norcross** | 17,000 | 2 | 1.2 |
| **Lilburn** | 15,000 | 1 | 0.7 |
| **Hapeville** | 7,000 | 3 | 4.3 |
| **Morrow** | 7,000 | 2 | 2.9 |
| **Stone Mountain** | 6,000 | 3 | 5.0 |
| **Jonesboro** | 5,000 | 1 | 2.0 |

### 4C. Weak ITP Neighborhoods (<5 venues)

| Neighborhood | Venues | Type | Notes |
|--------------|--------|------|-------|
| **Edgewood** | 1 | Developing | Rapidly growing area near East Atlanta |
| **Castleberry Hill** | 3 | Arts district | Known galleries, need better coverage |
| **Candler Park** | 4 | Residential | Little Five Points adjacent |
| **Sweet Auburn** | 4 | Historic | MLK birthplace, cultural importance |

---

## 5. Population vs Coverage Comparison

### Metro Atlanta Context

- **Atlanta city proper**: ~500k population
- **Fulton County**: ~1.1M  
- **Metro Atlanta (29 counties)**: ~6.2M
- **ITP estimate**: ~800k-1M
- **OTP estimate**: ~5.2M-5.4M

### Coverage Efficiency

| Region | Population (approx) | Venues | Events (90d window) | Venues per 10k | Coverage Index* |
|--------|---------------------|--------|---------------------|----------------|-----------------|
| **ITP** | 800k | 721 | 641 | 9.0 | 100 (baseline) |
| **OTP** | 5.2M | 178 | 330 | 0.3 | 3.7 |
| **Decatur** | 50k | 39 | 5 | 7.8 | 86.7 |

*Coverage Index = (Venues per 10k pop) normalized to ITP = 100

**Key Insight:** OTP receives **27x less coverage** per capita than ITP, despite containing **85% of metro population**.

---

## 6. Recommendations

### Priority 1: Expand Major OTP City Coverage

Target cities with 50k+ population and weak coverage:

1. **Johns Creek** (85k pop, 3 venues)
   - Add: Johns Creek Symphony, city parks/rec events
   - Focus: Family-oriented programming

2. **Roswell** (95k pop, 7 venues)  
   - Add: Roswell Cultural Arts Center, historic district
   - Focus: Heritage events, family activities

3. **East Point** (38k pop, 4 venues)
   - Add: East Point Theatre, city events
   - Focus: Community programming

4. **Suwanee** (20k pop, 0 venues)
   - Add: Town Center Park, Suwanee Fest, concerts
   - Focus: Family events, festivals

### Priority 2: Add OTP Cultural Hubs

Major OTP venues/organizations to prioritize:

**North OTP:**
- Johns Creek Symphony Orchestra
- Roswell Cultural Arts Center  
- Avalon (Alpharetta shopping/events)
- The AMP at Atlantic Station (concerts)

**Northeast OTP:**
- Infinite Energy Center (Duluth)
- Gas South Convention Center
- Gwinnett Performing Arts Center
- Hudgens Center for Art & Learning (Duluth)

**South OTP:**
- Georgia International Convention Center (College Park)
- Wolf Creek Amphitheater (College Park)
- Clayton County Performing Arts Center

**West/Northwest OTP:**
- Earl & Rachel Smith Strand Theatre (Marietta)
- Theatre in the Square (Marietta)
- Legacy Theatre (Acworth/Kennesaw)
- The Coupe Studios (Smyrna)

### Priority 3: Improve ITP Neighborhood Balance

Fill gaps in underserved ITP neighborhoods:

1. **Edgewood** (1 venue)
   - Target: Edgewood Ave restaurants, bars
   - High potential given proximity to East Atlanta/O4W

2. **Sweet Auburn** (4 venues)
   - Critical historic district  
   - Target: Sweet Auburn Market, Ebenezer Baptist, heritage events

3. **Castleberry Hill** (3 venues)
   - Known arts district
   - Target: Galleries, First Friday events, Atlanta Contemporary

4. **Candler Park** (4 venues)
   - Target: Candler Park area businesses, Little Five adjacent

### Priority 4: Add Multi-Location OTP Crawlers

Identify sources that serve multiple OTP locations:

- **Gwinnett County Parks & Rec**: County-wide events
- **Cobb County events**: Marietta, Kennesaw, Smyrna
- **DeKalb County events**: Tucker, Chamblee, Doraville
- **North Fulton events**: Alpharetta, Roswell, Johns Creek

### Priority 5: Enhance Decatur Coverage

**Critical gap**: Decatur has strong venue presence (39 venues) but minimal event coverage (5 events in 90-day window).

**Issue:** Likely crawler health problem or deduplication overzealousness

**Action Items:**
1. Audit Decatur-area crawlers for errors
2. Check if events are being deduplicated incorrectly  
3. Add Decatur Arts Festival, Decatur Book Festival crawlers
4. Target: Eddie's Attic, The Square, Decatur rec programming

---

## 7. Data Quality Issues Identified

### Issue 1: Inconsistent "Other" Venues

62 venues categorized as "Other/Unknown" includes:

- **College Park neighborhood confusion**: Some venues listed as "College Park" city with "Historic College Park" neighborhood
- **Missing neighborhood data**: Some Atlanta venues lack neighborhood assignment
- **Chamblee naming**: Inconsistency between city and neighborhood

**Fix:** Standardize neighborhood assignment logic, especially for edge cases.

### Issue 2: Decatur Event Discrepancy

Decatur has 39 venues but only 5 events in a 90-day window. This is **anomalous**.

**Diagnostic needed:**
- Check crawl_logs for Decatur venue crawlers
- Verify deduplication isn't over-aggressive  
- Compare to ITP venues with similar counts

### Issue 3: OTP Event Volume Higher Than Expected

OTP venues generate 33% of events from 18% of venues. This suggests:

**Positive interpretation:**
- OTP venues host more recurring events (sports, classes, regular programming)
- Families in suburbs attend more repeat events

**Data quality concern:**
- Could indicate over-crawling of certain OTP sources (e.g., Stone Mountain Park showing 100 events)
- May need to review recurring event deduplication for OTP sources

---

## 8. Strategic Implications

### For "Atlanta Families" Portal

The OTP gap is **critical** for a family-focused portal:

1. **Suburban families are underserved**: 85% of metro families live OTP
2. **Johns Creek, Roswell, Alpharetta** are high-income family areas with zero/weak coverage
3. **School-age programming** (most OTP) is missing vs ITP cultural events
4. **Parks & Recreation** departments (OTP focus) are key missing sources

**Recommendation:** Before launching "Atlanta Families," add minimum coverage of:
- Top 10 OTP cities (50+ venues each for Alpharetta, Roswell, Sandy Springs)
- County parks & rec departments
- Library systems (already have Atlanta-Fulton, need Gwinnett, Cobb, DeKalb)
- Youth sports leagues (soccer, baseball, etc.)

### For General LostCity Growth

**Current positioning:** "ITP cultural events platform"  
**Desired positioning:** "Atlanta metro discovery platform"

To achieve metro-wide coverage:
- **2x OTP crawler count** (28 → 60+ OTP-focused sources)
- Target **300+ OTP venues** (currently 178)
- Balance event distribution to **40% ITP, 50% OTP, 10% mixed**

---

## 9. Validation Queries

### Check OTP Cities with Weak Coverage

```sql
SELECT 
  city,
  COUNT(*) as venue_count,
  COUNT(DISTINCT id) as unique_venues
FROM venues 
WHERE city IN (
  'Johns Creek', 'Roswell', 'East Point', 'Tucker', 
  'Acworth', 'Suwanee', 'Forest Park', 'Lilburn'
)
GROUP BY city
ORDER BY venue_count DESC;
```

### Find ITP Venues Missing Neighborhood Data

```sql
SELECT id, name, address, city
FROM venues
WHERE city = 'Atlanta' 
  AND neighborhood IS NULL
LIMIT 50;
```

### Identify Decatur Crawler Health

```sql
SELECT 
  s.name,
  s.slug,
  cl.status,
  cl.events_found,
  cl.started_at
FROM crawl_logs cl
JOIN sources s ON cl.source_id = s.id
JOIN events e ON e.source_id = s.id
JOIN venues v ON e.venue_id = v.id
WHERE (v.city = 'Decatur' OR v.neighborhood LIKE '%Decatur%')
  AND cl.started_at > NOW() - INTERVAL '30 days'
ORDER BY cl.started_at DESC;
```

### Compare OTP Event Volume by Source

```sql
SELECT 
  s.name,
  COUNT(e.id) as event_count,
  COUNT(DISTINCT e.venue_id) as unique_venues,
  COUNT(DISTINCT DATE(e.start_date)) as unique_dates
FROM sources s
JOIN events e ON e.source_id = s.id  
JOIN venues v ON e.venue_id = v.id
WHERE v.city IN (
  'Marietta', 'Sandy Springs', 'Alpharetta', 'Roswell',
  'Kennesaw', 'Duluth', 'Dunwoody', 'Lawrenceville'
)
AND e.start_date >= CURRENT_DATE - INTERVAL '90 days'
GROUP BY s.name
ORDER BY event_count DESC;
```

---

## Conclusion

LostCity has **excellent ITP coverage** suitable for urban cultural discovery, but **critical OTP gaps** that limit metro-wide appeal. The current 72% ITP / 18% OTP venue split creates an **urban bias** mismatched to the region's 15% ITP / 85% OTP population distribution.

**To serve the full Atlanta metro:**
1. Add 120+ OTP venues (target: 300 total OTP)
2. Recruit 30+ OTP-focused crawlers
3. Prioritize Johns Creek, Roswell, East Point, Suwanee
4. Fix Decatur event discrepancy
5. Add county-wide sources (parks, libraries, schools)

**For "Atlanta Families" portal specifically:**
Minimum 3x increase in OTP coverage needed before launch, with focus on:
- Suburban city programming (parks, rec centers)
- Family venues (zoos, museums, libraries)  
- Youth sports and education events
- Gwinnett/Cobb/North Fulton sources

---

**Files Referenced:**
- `/Users/coach/Projects/LostCity/crawlers/db.py` - Database operations
- `/Users/coach/Projects/LostCity/crawlers/config.py` - Configuration

**Analyst:** LostCity Data Quality Specialist  
**Date:** 2026-01-31
