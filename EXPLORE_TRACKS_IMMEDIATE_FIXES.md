# Explore Tracks: Immediate Fixes Checklist

**Priority:** CRITICAL  
**Target Completion:** This week  
**Owner:** Content + Data Quality teams

---

## CRITICAL: Geocoding (Breaks Map View)

### Plaza Fiesta
- **Track:** A Beautiful Mosaic (★ FEATURED)
- **Current Status:** No lat/lng coordinates
- **Address:** 4166 Buford Hwy NE, Atlanta, GA 30345
- **Action:** Geocode and update venues table
- **SQL:**
```sql
UPDATE venues 
SET lat = 33.8479, lng = -84.3113
WHERE slug = 'plaza-fiesta';
```

### Southern Fried Queer Pride
- **Track:** Too Busy to Hate
- **Current Status:** No lat/lng coordinates, no address
- **Issue:** This is an organization/event, not a physical venue
- **Action:** Either remove from track OR assign coordinates to their event space
- **Recommendation:** Remove and replace with a physical LGBTQ+ venue

---

## CRITICAL: Featured Venues Missing Blurbs (14 total)

### Good Trouble Track (6 featured venues - 0% complete)

#### 1. APEX Museum
**Current:** [NO BLURB]  
**Suggested:** "Sweet Auburn's museum of the African American experience. The trolley replica and interactive exhibits make history feel alive, not dusty."  
_(This blurb exists in SpelHouse Spirit track — reuse or differentiate with civil rights angle)_

#### 2. Ebenezer Baptist Church
**Current:** [NO BLURB]  
**Suggested:** "Where Dr. King's voice echoed from the pulpit. The sanctuary where the civil rights movement found its moral center."  
_(Different from SpelHouse Spirit and A Beautiful Mosaic blurbs)_

#### 3. Hammonds House Museum
**Current:** [NO BLURB]  
**Suggested:** "A Victorian mansion turned museum of African American art. Free on First Fridays, essential year-round."  
_(Shorter version of SpelHouse Spirit blurb)_

#### 4. Oakland Cemetery
**Current:** [NO BLURB]  
**Suggested:** "Where Margaret Mitchell, Maynard Jackson, and civil rights martyrs rest. Atlanta's history written in granite and marble."  
_(Civil rights angle, different from Midnight Train blurb)_

#### 5. Sweet Auburn Curb Market
**Current:** [NO BLURB]  
**Suggested:** "The market that fed the movement. West African grocers next to Southern produce stands since 1924."  
_(Add civil rights context to existing A Beautiful Mosaic blurb)_

#### 6. Paschal's Restaurant & Bar
**Current:** "Where MLK planned the Montgomery Bus Boycott. The unofficial headquarters of the movement since 1947."  
**Status:** ✓ Already has blurb (good!)

---

### The Itis Track (4 featured venues missing)

#### 7. Buford Highway Farmers Market
**Current:** [NO BLURB]  
**Suggested:** "A global grocery the size of a football field. Korean, Mexican, Vietnamese, Ethiopian aisles. Bring an appetite and three hours."  
_(Food-focused version of A Beautiful Mosaic blurb)_

#### 8. Busy Bee Cafe (duplicate entry - one has blurb, one doesn't)
**Current:** Featured entry has no blurb, non-featured has blurb  
**Action:** Copy blurb to featured entry OR consolidate to single entry  
**Existing blurb:** "Soul food since 1947. MLK ate here, Obama ate here, and the fried chicken still hasn't changed."

#### 9. Mary Mac's Tea Room
**Current:** [NO BLURB]  
**Suggested:** "Atlanta's dining room since 1945. Fried chicken, pot roast, and sweet tea served by servers who call you 'honey.' The only restaurant Jimmy Carter called when homesick for Southern cooking."

#### 10. Sweet Auburn Curb Market
**Current:** [NO BLURB]  
**Suggested:** "Atlanta's oldest public market. Grindhouse Killer Burgers next to Bell Street Burritos next to Sweet Auburn BBQ. Locals eat here daily."  
_(Food-focused, different from Good Trouble/A Beautiful Mosaic versions)_

---

### Welcome to Atlanta Track (3 featured venues missing)

#### 11. Georgia Aquarium
**Current:** [NO BLURB]  
**Suggested:** "The largest aquarium in the Western Hemisphere. Whale sharks, beluga whales, and manta rays glide overhead in the Ocean Voyager tunnel."

#### 12. Stone Mountain Park
**Current:** [NO BLURB]  
**Suggested:** "The largest exposed granite dome in North America. Hike to the summit, take the Skyride, or ride the vintage train around its base."

#### 13. Zoo Atlanta
**Current:** [NO BLURB]  
**Suggested:** "Giant pandas, gorillas, and the largest collection of great apes in the country. Willie B's legacy lives on in Grant Park."

---

### Too Busy to Hate Track (1 featured venue missing)

#### 14. My Sister's Room
**Current:** [NO BLURB]  
**Suggested:** "Atlanta's longest-running lesbian bar. Decatur's queer anchor since 1980. Drag shows, DJs, and a patio that's seen four decades of Atlanta Pride."

---

## HIGH PRIORITY: Duplicate Blurbs Needing Differentiation

### Mercedes-Benz Stadium
**Issue:** Same blurb in The Main Event and Keep Swinging tracks  
**Current:** "The spaceship that opens its roof. 70,000 fans, $2 hot dogs, and an atmosphere unlike any stadium on earth."

**Fix:**
- **Keep The Main Event version** (concerts + festivals focus)
- **Rewrite Keep Swinging version** (sports focus):  
  "Home of the Falcons and Atlanta United. 70,000 fans, $2 hot dogs, and the retractable roof that opens to the sky. Game day atmosphere unlike any stadium on earth."

---

### Krog Street Market
**Issue:** Same blurb in Keep Moving Forward and The Itis tracks  
**Current:** "An industrial food hall on the BeltLine Eastside Trail. Local restaurants, a craft bar, and one of the city's best patios."

**Fix:**
- **Keep Keep Moving Forward version** (BeltLine focus)
- **Rewrite The Itis version** (food focus):  
  "Superica, Fred's Meat & Bread, Gu's Dumplings, and Hop City under one industrial roof. The patio is the BeltLine's dining room."

---

### Ponce City Market (3 tracks use same blurb)
**Issue:** Welcome to Atlanta, Keep Moving Forward, The Itis all say:  
"A historic Sears building reborn as Atlanta's most vibrant food hall, market, and rooftop destination on the BeltLine."

**Fix:**
- **Keep Welcome to Atlanta version** (tourist overview)
- **Keep Keep Moving Forward version** (BeltLine context)
- **Rewrite The Itis version** (food focus):  
  "H&F Burger, Bellina Alimentari, W.H. Stiles Fish Camp, and 20+ more restaurants in the old Sears building. The Central Food Hall is Atlanta's most photogenic meal."

---

## MEDIUM PRIORITY: Too-Short Blurb

### Bun Bo Hue Kitchen (A Beautiful Mosaic)
**Current:** "Spicy, soul-warming bun bo hue in Duluth." (41 chars)  
**Issue:** Below 50-char minimum

**Fix:** "Spicy, soul-warming bun bo hue in Duluth. Family-run, cash-friendly, and the best Central Vietnamese cooking in metro Atlanta." (128 chars)

---

## SQL to Track Progress

Run this query to verify all fixes:

```sql
-- Featured venues still missing blurbs
SELECT 
    et.name as track_name,
    v.name as venue_name,
    v.id as venue_id
FROM explore_track_venues etv
JOIN explore_tracks et ON etv.track_id = et.id
JOIN venues v ON etv.venue_id = v.id
WHERE etv.is_featured = true 
  AND (etv.editorial_blurb IS NULL OR etv.editorial_blurb = '')
ORDER BY et.name, v.name;

-- Should return 0 rows when complete
```

---

## Implementation Checklist

### Day 1: Critical Geocoding
- [ ] Geocode Plaza Fiesta (venue_id = ???)
- [ ] Resolve Southern Fried Queer Pride (remove or assign venue)
- [ ] Run map view QA to verify fixes

### Day 2: Good Trouble Track (6 blurbs)
- [ ] APEX Museum
- [ ] Ebenezer Baptist Church
- [ ] Hammonds House Museum
- [ ] Oakland Cemetery
- [ ] Sweet Auburn Curb Market
- [ ] Verify Paschal's has blurb (already done)

### Day 3: The Itis Track (4 blurbs)
- [ ] Buford Highway Farmers Market
- [ ] Busy Bee Cafe (fix duplicate)
- [ ] Mary Mac's Tea Room
- [ ] Sweet Auburn Curb Market

### Day 4: Welcome to Atlanta (3 blurbs)
- [ ] Georgia Aquarium
- [ ] Stone Mountain Park
- [ ] Zoo Atlanta

### Day 5: Final Fixes
- [ ] My Sister's Room (Too Busy to Hate)
- [ ] Differentiate Mercedes-Benz Stadium blurbs (2 tracks)
- [ ] Differentiate Krog Street Market blurbs (2 tracks)
- [ ] Differentiate Ponce City Market blurbs (3 tracks)
- [ ] Expand Bun Bo Hue Kitchen blurb

### Day 6: Validation
- [ ] Run all SQL validation queries
- [ ] Verify no featured venues missing blurbs
- [ ] Verify no venues missing coordinates
- [ ] Check map view renders correctly
- [ ] QA all 4 tracks with fixes (Good Trouble, The Itis, Welcome, Too Busy to Hate)

---

## Copy-Paste SQL Template for Blurb Updates

```sql
-- Update editorial blurb for a venue in a specific track
UPDATE explore_track_venues
SET editorial_blurb = 'YOUR BLURB HERE'
WHERE venue_id = (SELECT id FROM venues WHERE slug = 'venue-slug-here')
  AND track_id = (SELECT id FROM explore_tracks WHERE slug = 'track-slug-here');
```

### Track Slugs Reference
- `welcome-to-atlanta`
- `artefacts-of-the-lost-city`
- `a-beautiful-mosaic`
- `good-trouble`
- `the-itis`
- `the-midnight-train`
- `spel-house-spirit`
- `the-south-got-something-to-say`
- `too-busy-to-hate`
- `up-on-the-roof`
- `city-in-a-forest`
- `keep-swinging`
- `say-less`
- `resurgens`
- `hard-in-da-paint`
- `keep-moving-forward`
- `the-main-event`
- `yallywood`
- `lifes-like-a-movie`

---

**Target Completion:** End of week  
**Success Metric:** 0 featured venues missing blurbs, 0 venues missing coordinates  
**Owner:** Content team (blurbs) + Data quality team (geocoding)
