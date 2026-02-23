# ROMP Dog Portal Data Quality Report
**Date**: 2026-02-14  
**Analyst**: Data Quality Team  
**Database**: LostCity Production (rtppvljfrkjtoxmaizea.supabase.co)

---

## Executive Summary

The ROMP dog portal has **decent foundational data** but suffers from **critical gaps** in high-value content areas and significant data quality issues that will create poor user experiences.

### Overall Health: **C+ (Needs Improvement)**

**Strengths:**
- 264 dog-friendly venues total (good base)
- 1,441 upcoming dog-friendly events (strong pipeline)
- Good geographic coverage (56 neighborhoods)
- Strong bar/brewery/park venue coverage

**Critical Gaps:**
- **ZERO** dog training classes/events found
- Only **1** adoption event in pipeline
- All 7 dog parks missing images (0% coverage)
- 39% of dog-friendly venues missing images
- 79% of dog events missing pricing info
- Only 17 pet service venues total (vets, groomers, stores, daycare, shelters)

**Risk Level**: **HIGH** — Multiple portal sections will show empty states or sparse content on launch.

---

## 1. Venue Data Quality

### 1.1 Dog-Friendly Venue Distribution (264 total)

| Venue Type | Count | Portal Category |
|------------|-------|-----------------|
| **Bar** | 99 | Food & Drink |
| **Park** | 85 | Parks & Trails |
| **Coffee Shop** | 21 | Food & Drink |
| **Brewery** | 19 | Food & Drink |
| **Restaurant** | 9 | Food & Drink |
| **Farmers Market** | 7 | Shopping & Retail |
| **Dog Park** | 7 | Parks & Trails |
| **Organization** | 4 | Activities |
| **Event Space** | 3 | Activities |
| **Trail** | 3 | Parks & Trails |
| **Market** | 2 | Shopping & Retail |
| Other (9 types) | 5 | Mixed |

#### Portal Tab Impact:
```
Parks & Trails:     95 venues ✓ GOOD
Food & Drink:      148 venues ✓ GOOD
Pet Services:        0 venues ✗ CRITICAL (should be 17 - tagging issue!)
Shopping & Retail:   9 venues ⚠ SPARSE
Activities:          8 venues ⚠ SPARSE
```

**CRITICAL ISSUE**: Pet service venues (vets, groomers, etc.) are NOT tagged with `dog-friendly` vibe, so they don't appear in the dog-friendly venue query. The portal's `getDogVenues()` filters on `vibes @> ['dog-friendly']`, which excludes all 17 pet service venues.

### 1.2 Missing Critical Fields

| Field | Missing Count | % Missing |
|-------|---------------|-----------|
| **image_url** | 103 / 264 | **39%** ⚠ |
| **neighborhood** | 51 / 264 | 19% |
| **lat/lng** | 16 / 264 | 6% |
| **address** | 13 / 264 | 5% |
| **venue_type** | 0 / 264 | 0% ✓ |

**High-Priority Missing Images:**
- All 7 dog parks (100% missing)
- 10 parks without images (Blackburn Park, Etowah River Park, Percy Warner Park, etc.)
- Atlanta Beltline Partnership (key organization)
- Multiple bars (Slow Pour Brewing, Whelan, etc.)

#### Recommendation:
Run image discovery crawler for all dog parks immediately. Use Google Places API / Foursquare as fallback for parks without images.

### 1.3 Geographic Coverage

**Total Neighborhoods**: 56  
**Top 15 Neighborhoods** (dog-friendly venues):

| Neighborhood | Venue Count |
|--------------|-------------|
| Midtown | 36 |
| Old Fourth Ward | 22 |
| Downtown | 19 |
| Sandy Springs | 11 |
| West Midtown | 9 |
| Downtown Nashville | 9 |
| East Nashville | 8 |
| Decatur | 7 |
| Druid Hills | 7 |
| West End | 5 |
| Dunwoody | 5 |
| Johns Creek | 5 |
| Buckhead | 4 |
| Poncey-Highland | 3 |
| East Atlanta Village | 3 |

**Issue**: "Downtown Nashville" and "East Nashville" appear in Atlanta database — likely data contamination from Nashville sources.

---

## 2. High-Value Content Analysis

### 2.1 Dog Parks (7 total)

**ALL MISSING IMAGES (0% coverage)** — This is the portal's #1 content type.

| Name | Neighborhood | Image |
|------|--------------|-------|
| Brook Run Dog Park | Dunwoody | ✗ |
| Fetch Dog Park & Bar | Buckhead | ✗ |
| Freedom Park Off-Leash Area | Candler Park | ✗ |
| Mason Mill Dog Park | Decatur | ✗ |
| Newtown Dream Dog Park | Decatur | ✗ |
| Piedmont Park Dog Park | Midtown | ✗ |
| Wagging Tail Dog Park | Sandy Springs | ✗ |

**Action Required**: Emergency image acquisition for all 7 dog parks before launch.

### 2.2 Off-Leash Areas (17 total)

**17 venues** tagged with `off-leash` vibe, including:
- 7 dog parks
- 10 other venues (mostly Piedmont Park variants, Freedom Park)

**Issue**: Many "off-leash" venues are duplicates or variants of Piedmont Park (5 different Piedmont Park entries). Needs deduplication.

### 2.3 Pup Cup / Dog Menu Spots (20 venues)

**Good coverage**, but dominated by Starbucks (11 of 20).

| Venue | Vibes |
|-------|-------|
| Dog City Bakery & Boutique | treats-available, pup-cup, dog-menu |
| Bone Appetite | treats-available, pup-cup |
| Fetch Dog Park & Bar | treats-available |
| Shake Shack (5 locations) | pup-cup, dog-menu |
| Starbucks (11 locations) | pup-cup |
| Hollywood Feed - Decatur | treats-available |

**Issue**: Need more variety beyond Starbucks. Missing obvious candidates like Jeni's Ice Cream, local bakeries, food trucks.

### 2.4 Pet Services (17 venues, but NOT in dog-friendly query)

**CRITICAL ISSUE**: These venues exist but aren't tagged `dog-friendly`, so they don't appear in the portal's main venue queries.

| Type | Count |
|------|-------|
| Vet | 4 |
| Pet Store | 4 |
| Groomer | 3 |
| Pet Daycare | 3 |
| Animal Shelter | 3 |

**Vets (4)**:
- BluePearl Pet Hospital - Sandy Springs
- Georgia Veterinary Specialists (Sandy Springs)
- LifeLine Community Animal Hospital (DeKalb County)
- PAWS Atlanta Clinic (Decatur)

**Shelters/Rescues (3)**:
- Angels Among Us Pet Rescue (North Druid Hills)
- Best Friends Atlanta (Brookhaven)
- Furkids Animal Rescue (Cumming)

**Pet Stores (4)**:
- Bone Appetite
- Dog City Bakery & Boutique
- The Natural Pet Market - Decatur
- Who's Walking Who

**Recommendation**: Add `dog-friendly` vibe to all pet service venues, OR update portal queries to include pet service venue types directly (not just filter on vibes).

### 2.5 Common Co-Occurring Vibes

Among 264 dog-friendly venues:

| Vibe | Count |
|------|-------|
| outdoor-seating | 122 |
| pup-cup | 25 |
| off-leash | 17 |
| dog-menu | 6 |
| patio | 4 |

**Insight**: `outdoor-seating` is a strong signal for dog-friendly patios (46% of all dog-friendly venues).

---

## 3. Event Data Quality

### 3.1 Upcoming Dog-Friendly Events

**Total**: 1,441 events  
**Top Sources** (producing dog-friendly events):

| Source | Event Count |
|--------|-------------|
| Stone Mountain Park | 847 (59%) |
| Piedmont Park Conservancy | 56 |
| City Springs | 45 |
| Alcoholics Anonymous - Atlanta | 32 |
| Atlanta Botanical Garden | 31 |
| Boggs Social & Supply | 29 |
| Friends on Ponce | 29 |
| Atlanta Recurring Social Events | 28 |
| EAV Farmers Market | 21 |
| Star Community Bar | 19 |
| Chattahoochee Nature Center | 18 |
| LifeLine Animal Project | 17 |
| Snellville Farmers Market | 17 |
| Eventbrite Nashville | 16 |
| Chastain Park Amphitheatre | 15 |

**Issue**: Stone Mountain Park dominates (847 events = 59% of all dog events). This will create a monotonous feed experience. Likely many of these are NOT actually dog-specific events.

**Tag Distribution**:
```
dog-friendly: 1,441
adoption-event: 1
dog-social: 1
```

**CRITICAL ISSUE**: Only 2 events total have specific dog tags beyond the generic `dog-friendly`. Missing tags for:
- `dog-training`
- `puppy-class`
- `yappy-hour`
- `vaccination`
- `agility`

### 3.2 Missing Critical Fields (sample of 500 events)

| Field | Missing | % Missing |
|-------|---------|-----------|
| **price_min/price_max** | 1,139 / 1,441 | **79%** ⚠ |
| **image_url** | 61 / 500 | 12% |
| **start_time** | 24 / 500 | 5% |
| **description** | 0 / 500 | 0% ✓ |
| **venue_id** | 0 / 500 | 0% ✓ |

**Pricing Breakdown**:
```
Free:             290 events (20%)
Paid:              12 events (1%)
Unknown pricing: 1,139 events (79%)  ✗ CRITICAL
```

**Impact**: Users can't filter by free events effectively. Most events show "Price info unavailable".

### 3.3 Adoption Events

**Total**: 1 event found  
- "Rescue Puppy Yoga - Bellevue Family YMCA" (2026-02-21)

**CRITICAL GAP**: The portal's "Adopt" section will be nearly empty. Only 1 adoption event despite having 3 animal shelters in the database.

**Expected Content**: LifeLine Animal Project (in top sources) shows 17 events total but only 1 tagged as adoption.

**Issue**: LifeLine events likely NOT tagged correctly. Need to review all LifeLine events and retag adoption events.

Sample LifeLine event:
```
PetSmart (Dunwoody) Dog Adoption Event @ LifeLine Animal Project (2026-02-14)
Tags: dog-friendly
Missing: adoption-event tag
```

### 3.4 Dog Training Classes

**Total**: **0 events found** ✗ CRITICAL

The query looks for:
```sql
is_class = true AND tags && ['dog-training', 'puppy-class', 'obedience', 'agility']
```

**Issue**: Either:
1. No training classes in database, OR
2. Training classes exist but not tagged correctly

**Recommendation**: Search for events with "training", "puppy", "obedience", "agility" in title and manually tag.

### 3.5 Mistagged Events (Dog in Title, Not Tagged)

Found **16 events** with "dog" in title that are NOT tagged `dog-friendly`:

**False Positives** (correctly NOT tagged):
- "Value Pack Hot Dog & Soda" @ Nashville Predators
- "Dogs In A Pile" (band name) @ The Basement East

**Potentially Misclassified** (should be tagged):
- "Workshop - Hand Sewing Workshop at Doghead Farm" (farm name, not dog event)
- Multiple "Dogwood Group" meetings (probably AA, not dog-related)

**Puppy/Pup Events** (7 found, 5 NOT tagged dog-friendly):
- ✓ "Rescue Puppy Yoga - Bellevue Family YMCA"
- ✓ "Pints & Puppy Love at Fat Bottom Brewing"
- ✗ "SNARKY PUPPY" (band - correctly not tagged)
- ✗ "Puppy Prov!" (improv show - needs review)

---

## 4. Portal Feed Impact Analysis

### Current Feed Query Results

The portal feed builder (`getDogFeed()`) queries multiple sections. Here's what would appear:

#### Section 1: This Weekend (10 events)
**Status**: ✓ GOOD (10 events found for this weekend)

Sample events:
- Sweet Meteor of Death concert @ Boggs Social & Supply
- Eye-Spy Valentine Nature Hunt @ Chattahoochee Bend State Park
- PetSmart Dog Adoption Event @ LifeLine Animal Project
- Hot Girl Walk Nashville @ Shelby Park
- Volunteer: Freedom Park Clean-Up

**Issue**: Most are generic outdoor events, not dog-specific. "Hot Girl Walk" and concerts tagged as dog-friendly.

#### Section 2: Off-Leash Parks
**Status**: ⚠ SPARSE (17 venues, but many duplicates)

**Issue**: 5 of 17 are Piedmont Park variants. After deduplication, likely only ~10 unique off-leash areas.

#### Section 3: Pup Cup Spots
**Status**: ✓ GOOD (20 venues)

But 11 of 20 are Starbucks. Need more variety.

#### Section 4: Dog-Friendly Patios
**Status**: ✓ GOOD (148 bars/breweries/restaurants)

This section will look great. 46% have outdoor seating.

#### Section 5: Adopt
**Status**: ✗ CRITICAL (1 event + 3 shelters)

**What portal will show**:
- 1 adoption event (Rescue Puppy Yoga)
- Fallback to 3 shelter org cards (Angels Among Us, Best Friends Atlanta, Furkids)

**User Experience**: Section appears sparse and doesn't meet user expectations for adoption content.

#### Section 6: Services
**Status**: ✗ BROKEN (0 venues returned)

**Query**: `getDogServices()` filters by pet service venue types, but doesn't require `dog-friendly` vibe.

**Expected**: 17 venues  
**Actual in dog portal feed**: 0 (because main feed only includes dog-friendly venues)

**Issue**: The service section query in the feed (`getDogVenues()`) filters by vibe, which excludes all pet services.

#### Section 7: Trails & Nature
**Status**: ⚠ SPARSE (~10 venues)

Query looks for parks/trails with nature vibes. Limited coverage.

#### Section 8: Coming Up (20 events)
**Status**: ✓ GOOD (dominated by Stone Mountain Park)

---

## 5. Data Quality Issues Summary

### 5.1 Critical Issues (Launch Blockers)

| Issue | Impact | Severity |
|-------|--------|----------|
| **0 dog training classes** | Training section empty | CRITICAL |
| **1 adoption event** | Adoption section nearly empty | CRITICAL |
| **0 pet service venues in feed** | Services section broken | CRITICAL |
| **All dog parks missing images** | Poor visual experience for #1 content | CRITICAL |
| **79% events missing price** | Can't filter by free/paid | HIGH |

### 5.2 High-Priority Issues

| Issue | Impact | Severity |
|-------|--------|----------|
| **39% venues missing images** | Poor browsing experience | HIGH |
| **Stone Mountain dominates feed** (59%) | Repetitive feed experience | HIGH |
| **Nashville venues in Atlanta DB** | Geographic accuracy issues | MEDIUM |
| **Piedmont Park duplicates** | Confusing off-leash results | MEDIUM |
| **Only 2 events with specific dog tags** | Can't filter/search effectively | MEDIUM |

### 5.3 Enhancement Opportunities

| Issue | Impact | Severity |
|-------|--------|----------|
| **Missing pup cup variety** | 11/20 are Starbucks | LOW |
| **19% venues missing neighborhood** | Can't filter by area | LOW |
| **Limited pet store coverage** | Only 4 stores total | LOW |

---

## 6. Root Cause Analysis

### 6.1 Tagging Issues

**Problem**: Events are over-tagged with generic `dog-friendly` but under-tagged with specific dog tags.

**Why**: 
1. Tag inference (`tag_inference.py`) likely applies `dog-friendly` broadly to any park/outdoor event
2. No specific rules for detecting dog training, adoption events
3. Crawlers may not extract structured dog-specific metadata

**Example**:
```
"PetSmart (Dunwoody) Dog Adoption Event"
Current tags: ["dog-friendly"]
Should be: ["dog-friendly", "adoption-event", "adoption", "pets"]
```

### 6.2 Venue Vibe Coverage

**Problem**: Pet service venues (vets, groomers, etc.) exist but aren't tagged `dog-friendly`.

**Why**:
1. These venue types are implicitly dog-related (no need for tagging in source data)
2. Crawler doesn't apply `dog-friendly` vibe to these types
3. Portal query design assumes only `vibes @> ['dog-friendly']` filter

**Fix**: Either:
- Option A: Add `dog-friendly` vibe to all pet service venues automatically
- Option B: Update portal query to include pet service types OR vibes

### 6.3 Stone Mountain Over-Representation

**Problem**: 847/1,441 (59%) of dog events from Stone Mountain Park.

**Why**:
- Stone Mountain Park crawler scrapes all events
- Tag inference applies `dog-friendly` to all park events
- No filtering for actual dog-specific programming

**Impact**: Feed dominated by generic park events (zip line, lake activities, concerts) that happen to allow dogs.

**Fix**: Refine tag inference to NOT apply `dog-friendly` to non-dog events at parks. Use title/description matching for actual dog events.

### 6.4 Missing Adoption Event Tagging

**Problem**: LifeLine Animal Project has 17 events but only 1 tagged as adoption.

**Why**:
- Event title contains "Dog Adoption Event" but not tagged
- Extraction or tag inference failing to recognize adoption keywords

**Example**:
```sql
SELECT title, tags FROM events 
WHERE source_id = (SELECT id FROM sources WHERE name = 'LifeLine Animal Project')
  AND title ILIKE '%adoption%';
```

Expected: 10+ events  
Actual tagged: 1

**Fix**: Add keyword rules in tag inference for adoption-related terms.

---

## 7. Recommendations

### 7.1 Immediate (Pre-Launch)

**Priority 1: Fix Critical Empty Sections**

1. **Dog Training Classes**
   - [ ] Search for events with "training", "puppy class", "obedience", "agility" in title
   - [ ] Manually tag first batch (estimated ~20-50 events)
   - [ ] Add tag inference rules for training keywords

2. **Adoption Events**
   - [ ] Query all LifeLine Animal Project events with "adoption" in title
   - [ ] Retag with `adoption-event` tag
   - [ ] Add adoption keyword rules to tag inference
   - [ ] Check other shelter sources (Angels Among Us, Furkids, Best Friends)

3. **Pet Services Venues**
   - [ ] Add `dog-friendly` vibe to all venues where `venue_type IN ('vet', 'groomer', 'pet_store', 'pet_daycare', 'animal_shelter')`
   - [ ] OR update portal query to include pet service types

4. **Dog Park Images**
   - [ ] Run image discovery for all 7 dog parks
   - [ ] Use Google Places API as primary source
   - [ ] Fallback to Foursquare, Instagram, or manual curation

**Priority 2: Data Quality Fixes**

5. **Deduplicate Piedmont Park**
   - [ ] Merge duplicate Piedmont Park venue entries
   - [ ] Assign unique names or use aliases

6. **Fix Stone Mountain Over-Tagging**
   - [ ] Remove `dog-friendly` tag from generic Stone Mountain events
   - [ ] Keep only events with "dog", "puppy", "pet" in title/description
   - [ ] Estimated impact: reduce from 847 to ~50 events

7. **Price Data Extraction**
   - [ ] Review top event sources and improve price parsing
   - [ ] Add "free" inference for park events, farmers markets

### 7.2 Short-Term (Post-Launch)

8. **Image Coverage**
   - [ ] Target 80%+ image coverage for dog-friendly venues
   - [ ] Focus on parks, patios, pet stores

9. **Add Dog-Specific Sources**
   - [ ] Atlanta Humane Society events
   - [ ] PetSmart/Petco event calendars
   - [ ] Local dog training businesses (e.g., Zoom Room, Canine Country)
   - [ ] Yappy hour series (bars with recurring dog events)

10. **Improve Tag Vocabulary**
    - [ ] Add specific tags used in queries: `puppy-class`, `obedience`, `agility`, `yappy-hour`, `vaccination`
    - [ ] Update extraction prompts to recognize these terms
    - [ ] Add post-processing rules in tag inference

11. **Nashville Data Contamination**
    - [ ] Filter out Nashville venues from Atlanta portal
    - [ ] Add geographic validation to crawlers

### 7.3 Long-Term (Roadmap)

12. **Structured Dog Metadata**
    - [ ] Add `dog_amenities` JSON field to venues (water bowls, fenced, surface type)
    - [ ] Extract from source descriptions or crowdsource

13. **User-Generated Content**
    - [ ] Allow users to submit dog park photos
    - [ ] Tag suggestions for venues/events
    - [ ] Reviews with dog-specific ratings (safety, cleanliness, size)

14. **Recurring Event Series**
    - [ ] Detect recurring dog socials (e.g., "Yappy Hour every Thursday")
    - [ ] Create series records for easier discovery

---

## 8. Validation Queries

Use these queries to verify fixes:

### 8.1 Check Adoption Event Tagging

```sql
-- Before fix
SELECT COUNT(*) FROM events
WHERE start_date >= CURRENT_DATE
  AND title ILIKE '%adoption%'
  AND NOT (tags @> ARRAY['adoption-event']);
-- Expected: 10+

-- After fix
SELECT COUNT(*) FROM events
WHERE start_date >= CURRENT_DATE
  AND tags @> ARRAY['adoption-event']
  AND canonical_event_id IS NULL;
-- Target: 20+
```

### 8.2 Check Dog Training Classes

```sql
-- Search for potential training events
SELECT title, tags, source_id FROM events
WHERE start_date >= CURRENT_DATE
  AND (title ILIKE '%training%' OR title ILIKE '%puppy class%' OR title ILIKE '%obedience%')
  AND canonical_event_id IS NULL
LIMIT 50;

-- After tagging
SELECT COUNT(*) FROM events
WHERE start_date >= CURRENT_DATE
  AND is_class = true
  AND tags && ARRAY['dog-training', 'puppy-class', 'obedience', 'agility']
  AND canonical_event_id IS NULL;
-- Target: 30+
```

### 8.3 Check Pet Service Venues in Portal

```sql
-- Check if pet services appear in dog-friendly query
SELECT COUNT(*) FROM venues
WHERE active = true
  AND venue_type IN ('vet', 'groomer', 'pet_store', 'pet_daycare', 'animal_shelter')
  AND vibes @> ARRAY['dog-friendly'];
-- Current: 0
-- Target: 17
```

### 8.4 Check Dog Park Image Coverage

```sql
SELECT name, image_url FROM venues
WHERE active = true
  AND venue_type = 'dog_park'
ORDER BY name;
-- Current: 0/7 with images
-- Target: 7/7 with images
```

### 8.5 Check Stone Mountain Event Reduction

```sql
-- Current state
SELECT COUNT(*) FROM events
WHERE start_date >= CURRENT_DATE
  AND source_id = (SELECT id FROM sources WHERE name = 'Stone Mountain Park')
  AND tags @> ARRAY['dog-friendly']
  AND canonical_event_id IS NULL;
-- Current: 847

-- After fix
-- Target: ~50 (only truly dog-specific events)
```

---

## 9. Portal Launch Readiness

### Current State: **NOT READY**

**Critical blockers:**
- ✗ Dog training section: 0 events (empty state)
- ✗ Adoption section: 1 event (nearly empty)
- ✗ Pet services: 0 venues (broken query)
- ✗ Dog parks: 0/7 with images (poor UX)

**Minimum Viable State for Soft Launch:**
- ✓ 20+ dog training events tagged
- ✓ 10+ adoption events tagged
- ✓ 17 pet service venues visible
- ✓ 7/7 dog parks with images
- ✓ Stone Mountain reduced from 847 to ~100 events max
- ✓ Pricing data for at least 50% of events

**Estimated Effort to Reach MVP:**
- Manual tagging: 4-6 hours (adoption + training events)
- Pet service vibe fix: 1 hour (SQL update)
- Dog park images: 2-3 hours (API + manual curation)
- Stone Mountain filtering: 2 hours (tag inference rules)
- **Total: 9-12 hours of data work**

### Recommended Path Forward

**Phase 1: Emergency Fixes (Day 1)**
1. Add `dog-friendly` vibe to all pet service venues (SQL)
2. Manually tag LifeLine adoption events
3. Search + tag dog training events from common sources

**Phase 2: Image Acquisition (Day 2)**
4. Run Google Places image discovery for all dog parks
5. Manual fallback for any missing images

**Phase 3: Feed Quality (Day 3)**
6. Implement Stone Mountain filtering rules
7. Deduplicate Piedmont Park entries
8. Add price inference rules

**Phase 4: Soft Launch (Day 4)**
9. Internal testing of all portal sections
10. Validate feed diversity and image coverage
11. Spot-check top 20 venues and events

**Phase 5: Monitoring (Ongoing)**
12. Track empty section rates
13. Monitor user feedback on data quality
14. Weekly data quality audits

---

## 10. Contact & Next Steps

**Report Owner**: Data Quality Team  
**Last Updated**: 2026-02-14  

**Immediate Action Required**:
- [ ] Assign owner for each Phase 1 task
- [ ] Schedule data quality sync with crawler-dev
- [ ] Set target launch date based on data readiness

**For questions or to request additional diagnostics**:
- See queries in `/web/dog_portal_diagnostics.mjs`
- Database: rtppvljfrkjtoxmaizea.supabase.co (use service key from .env.local)

---

## Appendix A: Query Log

All diagnostic queries are preserved in:
- `/Users/coach/Projects/LostCity/web/dog_portal_diagnostics.mjs`
- `/Users/coach/Projects/LostCity/web/dog_portal_quality_deep_dive.mjs`
- `/Users/coach/Projects/LostCity/web/dog_portal_final_checks.mjs`

Run with: `node <filename>.mjs`

## Appendix B: Portal Code References

**Data Layer**: `/Users/coach/Projects/LostCity/web/lib/dog-data.ts`  
**Source Policy**: `/Users/coach/Projects/LostCity/web/lib/dog-source-policy.ts`  
**Tag Vocabulary**: `/Users/coach/Projects/LostCity/web/lib/dog-tags.ts`  
**Portal Template**: `/Users/coach/Projects/LostCity/web/app/[portal]/_templates/dog.tsx`

