# Explore Tracks Editorial Blurb Quality Report

**Date:** 2026-02-16  
**Total Records:** 314 venues across 19 tracks  
**Analyst:** Data Quality Specialist

---

## Executive Summary

The explore tracks feature contains **314 venue entries across 19 thematic tracks**. Overall editorial quality is **strong**, with thoughtful, differentiated blurbs for most venues. Key findings:

- **24 venues missing blurbs** (7.6% of total) — concentrated in certain tracks
- **5 venues using identical blurbs** across multiple tracks (needs revision)
- **64 venues with data_quality < 60** (20.4%) — mostly parks, cemeteries, and landmarks
- **1 blurb too short** (< 50 chars) — needs expansion
- **0 blurbs too long** (> 200 chars) — excellent consistency
- **Generic words rare** — "legendary" (4x), "perfect" (3x), "classic" (3x) out of 290 blurbs

---

## 1. Missing Blurbs by Track

### High Priority (Featured venues without blurbs)

| Track | Venue | Status |
|-------|-------|--------|
| Good Trouble | APEX Museum | ★ FEATURED, NO BLURB |
| Good Trouble | Ebenezer Baptist Church | ★ FEATURED, NO BLURB |
| Good Trouble | Hammonds House Museum | ★ FEATURED, NO BLURB |
| Good Trouble | Oakland Cemetery | ★ FEATURED, NO BLURB |
| Good Trouble | Sweet Auburn Curb Market | ★ FEATURED, NO BLURB |
| Good Trouble | Paschal's Restaurant & Bar | ★ FEATURED, NO BLURB |
| The Itis | Buford Highway Farmers Market | ★ FEATURED, NO BLURB |
| The Itis | Busy Bee Cafe | ★ FEATURED (duplicate entry), has blurb on 2nd entry |
| The Itis | Mary Mac's Tea Room | ★ FEATURED, NO BLURB |
| The Itis | Sweet Auburn Curb Market | ★ FEATURED, NO BLURB |
| Too Busy to Hate | My Sister's Room | ★ FEATURED, NO BLURB |
| Welcome to Atlanta | Georgia Aquarium | ★ FEATURED, NO BLURB |
| Welcome to Atlanta | Stone Mountain Park | ★ FEATURED, NO BLURB |
| Welcome to Atlanta | Zoo Atlanta | ★ FEATURED, NO BLURB |

### All Missing Blurbs (24 total)

**Good Trouble (5 missing):**
- APEX Museum (★)
- Ebenezer Baptist Church (★)
- Hammonds House Museum (★)
- Oakland Cemetery (★)
- Sweet Auburn Curb Market (★)

**The Itis (8 missing):**
- Buford Highway Farmers Market (★)
- Busy Bee Cafe (★, but has blurb on duplicate entry)
- Mary Mac's Tea Room (★)
- Sweet Auburn Curb Market (★)
- Atlanta Food Truck Park & Market
- Politan Row
- Stackhouse
- The Works Atlanta

**Life's Like a Movie (4 missing):**
- Children's Museum of Atlanta (★)
- Fernbank Science Center (★)
- Georgia Aquarium (★)
- Zoo Atlanta (★)

**Welcome to Atlanta (3 missing):**
- Georgia Aquarium (★)
- Stone Mountain Park (★)
- Zoo Atlanta (★)

**Keep Moving Forward (2 missing):**
- Historic Fourth Ward Park (★)
- New Realm Brewing (★)

**The Midnight Train (2 missing):**
- Clermont Lounge (★)
- Oakland Cemetery (★)

**Too Busy to Hate (1 missing):**
- My Sister's Room (★)

---

## 2. Duplicate Blurbs (Same text across multiple tracks)

### Critical Issues

| Venue | Tracks | Issue |
|-------|--------|-------|
| **Mercedes-Benz Stadium** | The Main Event, Keep Swinging | Identical blurb: "The spaceship that opens its roof. 70,000 fans, $2 hot dogs, and an atmosphere unlike any stadium on earth." |
| **Krog Street Market** | Keep Moving Forward, The Itis | Identical blurb: "An industrial food hall on the BeltLine Eastside Trail. Local restaurants, a craft bar, and one of the city's best patios." |

### Acceptable Duplicates (One track missing blurb)

| Venue | Tracks | Note |
|-------|--------|------|
| Sweet Auburn Curb Market | A Beautiful Mosaic, Good Trouble, The Itis | Good Trouble + The Itis have no blurb, only A Beautiful Mosaic has one |
| Buford Highway Farmers Market | A Beautiful Mosaic, The Itis | The Itis has no blurb, only A Beautiful Mosaic has one |
| APEX Museum | Good Trouble, SpelHouse Spirit | Good Trouble has no blurb, only SpelHouse Spirit has one |
| New Realm Brewing | Keep Moving Forward, Up on the Roof | Keep Moving Forward has no blurb, only Up on the Roof has one |

---

## 3. Blurb Length Analysis

### By Track (Average Character Count)

| Track | Venues | With Blurbs | Avg Length | Status |
|-------|--------|-------------|------------|--------|
| **Up on the Roof** | 22 | 22 | 159.2 chars | Longest, context-rich |
| **Resurgens** | 14 | 14 | 154.8 chars | Architecture needs detail ✓ |
| **Artefacts of the Lost City** | 42 | 42 | 138.7 chars | Strong storytelling ✓ |
| **SpelHouse Spirit** | 11 | 11 | 137.0 chars | Community focus ✓ |
| **Y'allywood** | 14 | 14 | 132.0 chars | Theatrical flair ✓ |
| **The South Got Something to Say** | 9 | 9 | 123.7 chars | Hip-hop history ✓ |
| **Say Less** | 10 | 10 | 119.4 chars | Cocktail bars ✓ |
| **Hard in Da Paint** | 10 | 10 | 114.7 chars | Arts focused ✓ |
| **City in a Forest** | 13 | 13 | 112.0 chars | Nature/parks ✓ |
| **The Main Event** | 12 | 12 | 110.3 chars | Event venues ✓ |
| **The Midnight Train** | 26 | 24 | 106.8 chars | Quirky finds ✓ |
| **Keep Swinging** | 9 | 9 | 102.3 chars | Sports bars ✓ |
| **Life's Like a Movie** | 14 | 10 | 101.5 chars | Family-friendly |
| **Welcome to Atlanta** | 12 | 9 | 103.1 chars | Tourist intro |
| **The Itis** | 25 | 17 | 97.4 chars | Food-focused |
| **Good Trouble** | 9 | 4 | 94.8 chars | **NEEDS WORK** |
| **Keep Moving Forward** | 13 | 11 | 94.6 chars | BeltLine venues |
| **A Beautiful Mosaic** | 33 | 33 | 93.3 chars | International ATL ✓ |
| **Too Busy to Hate** | 16 | 15 | 81.2 chars | LGBTQ+ venues |

### Too Short (< 50 chars)

Only **1 blurb** is too short:

- **A Beautiful Mosaic / Bun Bo Hue Kitchen**: "Spicy, soul-warming bun bo hue in Duluth." (41 chars)  
  **Recommendation:** Expand to include what makes this spot special — family-run? Best in the region? Cash only?

### Too Long (> 200 chars)

**0 blurbs exceed 200 characters.** Excellent discipline across all tracks.

---

## 4. Generic Word Usage

Out of 290 blurbs, generic words appear rarely:

| Word | Count | % of Blurbs | Assessment |
|------|-------|-------------|------------|
| legendary | 4 | 1.4% | Acceptable |
| perfect | 3 | 1.0% | Acceptable |
| classic | 3 | 1.0% | Acceptable |
| famous | 2 | 0.7% | Acceptable |
| beloved | 2 | 0.7% | Acceptable |
| iconic | 1 | 0.3% | Acceptable |
| must-visit | 0 | 0% | ✓ |

**Assessment:** Generic word usage is **excellent**. Most blurbs use specific, evocative language instead of clichés.

---

## 5. Multi-Track Venue Analysis

**56 venues appear in multiple tracks.** This is intentional curation — venues fit multiple themes.

### Cross-Track Blurb Quality

- **52 venues** have **different blurbs per track** ✓ (93% success rate)
- **4 venues** reuse **identical blurbs** across tracks ⚠️

### Venues Needing Differentiated Blurbs

| Venue | Tracks Using Same Blurb | Action Needed |
|-------|-------------------------|---------------|
| Mercedes-Benz Stadium | The Main Event, Keep Swinging | Write sports-focused version for Keep Swinging |
| Krog Street Market | Keep Moving Forward, The Itis | Write food-focused version for The Itis |
| Sweet Auburn Curb Market | A Beautiful Mosaic (only) | Write blurbs for Good Trouble + The Itis |
| Buford Highway Farmers Market | A Beautiful Mosaic (only) | Write blurb for The Itis |

### Exemplary Multi-Track Differentiation

**Piedmont Park** (5 tracks, 5 different blurbs):
- Welcome to Atlanta: "Atlanta's backyard. 200 acres of green space, trails, a lake, and the anchor of the BeltLine corridor."
- Life's Like a Movie: "Playgrounds, splash pads, a lake, and wide open lawns. The Saturday farmers market is perfect for family mornings."
- The Main Event: "Atlanta's front yard. Jazz Fest, Music Midtown, Dogwood Festival — if it's big and outdoors, it's probably here."
- City in a Forest: "Atlanta's Central Park. 189 acres, a lake, the skyline behind the trees. Weekend farmers market and free concerts."
- Too Busy to Hate: [Same as Welcome to Atlanta — needs LGBTQ+ angle]

**Fox Theatre - Atlanta** (5 tracks, 5 different blurbs) ✓  
**Dad's Garage Theatre** (4 tracks, 4 different blurbs) ✓  
**Paschal's Restaurant & Bar** (4 tracks, 4 different blurbs) ✓

---

## 6. Venue Data Quality Issues

**64 venues (20.4%) have data_quality scores < 60**. Most are parks, cemeteries, or landmarks where traditional venue data doesn't apply.

### Critical Data Gaps

| Issue | Count | Impact |
|-------|-------|--------|
| **Missing coordinates** | 2 | HIGH — breaks map view |
| **Missing address** | 17 | MEDIUM — mostly parks |
| **Missing venue_type** | 0 | ✓ None |
| **Data quality < 60** | 64 | LOW — mostly expected |

### Venues Missing Coordinates (CRITICAL)

1. **Southern Fried Queer Pride** — Too Busy to Hate track
2. **Plaza Fiesta** — A Beautiful Mosaic track (★ FEATURED)

**Action Required:** Geocode these two venues immediately. Plaza Fiesta is a featured venue and cannot appear on maps without coordinates.

### Venues Missing Addresses (17 total)

Most are parks or events, not physical venues:
- Piedmont Park (5 tracks)
- Grant Park (2 tracks)
- Chastain Park / Chastain Park Amphitheatre (2 tracks)
- Westside Park (2 tracks)
- Historic Fourth Ward Park (1 track)
- Northside Tavern (1 track)
- Southern Fried Queer Pride (1 track)
- 1895 Exposition Steps (1 track)
- FDR's Superb Railcar (1 track)

**Recommendation:** Add addresses for parks using main entrance coordinates. For artifacts (1895 Exposition Steps, FDR's Railcar), add museum addresses.

---

## 7. Recommendations by Priority

### CRITICAL (Fix immediately)

1. **Geocode 2 venues without coordinates:**
   - Plaza Fiesta (★ FEATURED in A Beautiful Mosaic)
   - Southern Fried Queer Pride (Too Busy to Hate)

2. **Write blurbs for all 14 FEATURED venues missing them:**
   - Good Trouble track: 6 featured venues, all missing blurbs
   - The Itis track: 4 featured venues missing blurbs
   - Welcome to Atlanta: 3 featured venues missing blurbs
   - Too Busy to Hate: 1 featured venue missing blurb

### HIGH PRIORITY

3. **Differentiate duplicate blurbs (4 venues):**
   - Mercedes-Benz Stadium: Write sports-specific version for Keep Swinging
   - Krog Street Market: Write food-specific version for The Itis
   - Ponce City Market: Already has 4 tracks, but 3 use same blurb — vary them
   - Sweet Auburn Curb Market: Write versions for Good Trouble + The Itis

4. **Expand the 1 too-short blurb:**
   - Bun Bo Hue Kitchen (A Beautiful Mosaic): Currently 41 chars, needs 50+

5. **Complete The Itis track:**
   - 8 venues missing blurbs (32% incomplete)
   - This is a food-focused track — critical for discovery

### MEDIUM PRIORITY

6. **Complete Life's Like a Movie track:**
   - 4 family-friendly venues missing blurbs
   - Georgia Aquarium, Zoo Atlanta, Children's Museum, Fernbank Science Center

7. **Complete Welcome to Atlanta track:**
   - 3 tourist-facing venues missing blurbs
   - This is the intro track — should be 100% complete

8. **Add addresses for parks:**
   - Piedmont Park, Grant Park, Chastain Park, Westside Park, Historic Fourth Ward Park
   - Use main entrance addresses for map accuracy

### LOW PRIORITY

9. **Enrich venue data for low-scoring venues:**
   - 64 venues with data_quality < 60
   - Most are landmarks/parks — expected to have lower scores
   - Focus on venues that should have richer data (Northside Tavern, The Goat Farm, etc.)

10. **Review "legendary" usage:**
    - Only 4 instances, but ensure each is earned (Clermont Lounge, Miller Union, etc.)

---

## 8. Track-by-Track Health Report

| Track | Venues | Blurbs | Completion | Quality Grade |
|-------|--------|--------|------------|---------------|
| A Beautiful Mosaic | 33 | 33 | 100% | A (1 too short) |
| Artefacts of the Lost City | 42 | 42 | 100% | A+ |
| City in a Forest | 13 | 13 | 100% | A |
| Good Trouble | 9 | 4 | **44%** | **D** (6 featured missing) |
| Hard in Da Paint | 10 | 10 | 100% | A |
| Keep Moving Forward | 13 | 11 | 85% | B+ |
| Keep Swinging | 9 | 9 | 100% | A (1 duplicate) |
| Life's Like a Movie | 14 | 10 | 71% | B (4 missing) |
| Resurgens | 14 | 14 | 100% | A+ |
| Say Less | 10 | 10 | 100% | A+ |
| SpelHouse Spirit | 11 | 11 | 100% | A+ |
| The Itis | 25 | 17 | **68%** | **C** (8 missing) |
| The Main Event | 12 | 12 | 100% | A |
| The Midnight Train | 26 | 24 | 92% | A |
| The South Got Something to Say | 9 | 9 | 100% | A+ |
| Too Busy to Hate | 16 | 15 | 94% | A- (1 featured missing) |
| Up on the Roof | 22 | 22 | 100% | A+ |
| Welcome to Atlanta | 12 | 9 | 75% | B (3 featured missing) |
| Y'allywood | 14 | 14 | 100% | A+ |

### Tracks Needing Immediate Attention

1. **Good Trouble** (44% complete) — Civil rights track missing most blurbs
2. **The Itis** (68% complete) — Food track needs completion
3. **Welcome to Atlanta** (75% complete) — Tourist intro track should be 100%
4. **Life's Like a Movie** (71% complete) — Family track needs family-friendly venues filled

---

## 9. Overall Assessment

**Grade: A-**

The explore tracks editorial content is **high-quality**, with thoughtful, specific, evocative blurbs that avoid clichés. The writing voice is consistent, confident, and captures the spirit of each venue within its thematic context.

### Strengths
- **Differentiated multi-track coverage** (93% success rate)
- **No overly long blurbs** (excellent discipline)
- **Minimal generic language** (< 2% of blurbs)
- **Strong storytelling** in Artefacts, SpelHouse Spirit, The South Got Something to Say
- **Thematic consistency** within each track

### Weaknesses
- **24 missing blurbs** (7.6% of total)
- **4 duplicate blurbs** across tracks
- **Good Trouble track severely incomplete** (44%)
- **2 venues missing coordinates** (breaks map functionality)

### Next Steps

**Immediate (this week):**
1. Geocode Plaza Fiesta and Southern Fried Queer Pride
2. Write blurbs for 6 Good Trouble featured venues
3. Write blurbs for 4 The Itis featured venues

**Short-term (next 2 weeks):**
4. Complete Welcome to Atlanta and Life's Like a Movie tracks
5. Differentiate 4 duplicate blurbs
6. Expand Bun Bo Hue Kitchen blurb

**Ongoing:**
7. Enrich venue data for low-scoring entries
8. Add park addresses for map accuracy

---

**Report generated:** 2026-02-16  
**Data source:** `explore_track_venues` table (314 records)  
**Analyst:** LostCity Data Quality Specialist
