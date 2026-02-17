# Explore Tracks Data Quality Audit
**Date:** 2026-02-15  
**Scope:** All 15 active explore tracks (211 venue mappings total)  
**API Files Validated:** `/web/app/api/explore/tracks/route.ts`, `/web/app/api/explore/tracks/[slug]/route.ts`

## Executive Summary

### Critical Findings
1. **Image Coverage Crisis:** 32 venues (15% of total) have NO images (neither `hero_image_url` nor `image_url`)
2. **Event Drought:** 129 venues (61%) have ZERO upcoming events in the next 14 days
3. **Description Wasteland:** 210 of 211 venues (99.5%) are missing `short_description` field
4. **Editorial Blurbs:** Strong coverage (195/211 = 92%) but API doesn't use `short_description` fallback

### Track Health Overview (Active Tracks Only)
| Track | Venues | Images Missing | Events Zero | Active Sources Zero |
|-------|--------|----------------|-------------|---------------------|
| **Welcome to Atlanta** | 12 | 2 (17%) | 4 (33%) | 4 (33%) |
| **Good Trouble** | 9 | 2 (22%) | 6 (67%) | 6 (67%) |
| **The South Got Something to Say** | 8 | 1 (13%) | 6 (75%) | 6 (75%) |
| **Keep Moving Forward** | 11 | 0 (0%) ✅ | 5 (45%) | 5 (45%) |
| **The Itis** | 23 | 6 (26%) | 19 (83%) | 19 (83%) |
| **City in a Forest** | 13 | 4 (31%) | 8 (62%) | 8 (62%) |
| **Hard in Da Paint** | 10 | 0 (0%) ✅ | 2 (20%) | 2 (20%) |
| **A Beautiful Mosaic** | 30 | 8 (27%) | 27 (90%) | 27 (90%) |
| **Too Busy to Hate** | 16 | 1 (6%) ✅ | 4 (25%) | 4 (25%) |
| **The Midnight Train** | 26 | 3 (12%) | 12 (46%) | 12 (46%) |
| **Keep Swinging** | 9 | 1 (11%) ✅ | 2 (22%) | 2 (22%) |
| **Life's Like a Movie** | 12 | 1 (8%) ✅ | 3 (25%) | 3 (25%) |
| **Say Less** | 7 | 1 (14%) | 7 (100%) | 7 (100%) |
| **Y'allywood** | 14 | 0 (0%) ✅ | 6 (43%) | 6 (43%) |
| **SpelHouse Spirit** | 11 | 3 (27%) | 7 (64%) | 7 (64%) |

**Best Performers (Image Coverage):**
- Keep Moving Forward (100%)
- Hard in Da Paint (100%)
- Y'allywood (100%)

**Worst Performers (Event Coverage):**
- Say Less (0% have events) ❌
- A Beautiful Mosaic (10% have events)
- The Itis (17% have events)

---

## Track-by-Track Data Quality Scorecards

### 1. Welcome to Atlanta (12 venues)
**Mission:** Atlanta's greatest hits album  
**Image Coverage:** 10/12 (83%) ✅  
**Event Coverage:** 8/12 (67%) ⚠️  
**Editorial Blurbs:** 10/12 (83%)

**Critical Gaps:**
- **Stone Mountain Park** - MISSING IMAGE (but has 851 upcoming events!)
- **Zoo Atlanta** - MISSING IMAGE (but has 38 upcoming events)
- **Centennial Olympic Park** - No events, no active sources
- **World of Coca-Cola** - No events, no active sources
- **The Carter Center** - No events, no active sources
- **The King Center** - No events, no active sources

**Data Quality Issue:** Major attractions with NO crawlers producing events. These are marquee venues that should have active event feeds.

**Recommendation:** 
- Add hero images for Stone Mountain, Zoo Atlanta
- Create crawlers for World of Coca-Cola, The King Center, Carter Center (or mark as "visit anytime" landmarks with different UX treatment)

---

### 2. Good Trouble (9 venues)
**Mission:** Civil Rights heritage trail  
**Image Coverage:** 7/9 (78%) ⚠️  
**Event Coverage:** 3/9 (33%) ❌  
**Editorial Blurbs:** 6/9 (67%)

**Critical Gaps:**
- **Paschal's Restaurant** - MISSING IMAGE, no events, no sources (featured venue!)
- **Sweet Auburn Curb Market** - MISSING IMAGE, no events, no sources
- **APEX Museum** - No blurb, no events
- **Ebenezer Baptist Church** - No blurb (but has 5 events)
- **Hammonds House** - No blurb (1 event)
- **The King Center** - No events
- **The Carter Center** - No events

**Data Quality Issue:** Civil rights track is 67% landmarks with no event feeds. This may be intentional (historic sites), but UX needs to clarify these are "visit anytime" vs "check for events."

**Recommendation:**
- Add images for Paschal's (iconic restaurant), Sweet Auburn Curb Market
- Create crawlers for Paschal's events (live music, community dinners)
- Add editorial context explaining which venues are museums vs active community spaces

---

### 3. The South Got Something to Say (8 venues, Hip-Hop Heritage)
**Mission:** Studios, stages, spots where Atlanta built hip-hop  
**Image Coverage:** 7/8 (88%) ✅  
**Event Coverage:** 2/8 (25%) ❌  
**Editorial Blurbs:** 8/8 (100%) ✅

**Critical Gaps:**
- **Paschal's Restaurant** - MISSING IMAGE (appears on 3 tracks, needs image urgently)
- **Apache XLR** - No events (used to host AWOL Open Mic)
- **Magic City** - No events, no sources (THE hip-hop venue)
- **JB's Record Lounge** - No events
- **Wax n Facts** - No events

**Data Quality Issue:** Track narrative is strong (all blurbs present), but most venues are not producing event data. Magic City especially critical gap.

**Recommendation:**
- Magic City crawler (nightlife events, hip-hop shows)
- Apache XLR crawler (open mics, neo-soul events)
- Research if JB's, Wax n Facts host events (or mark as "retail/daytime")

---

### 4. Keep Moving Forward (11 venues, BeltLine)
**Mission:** BeltLine trail + breweries + food halls  
**Image Coverage:** 11/11 (100%) ✅✅✅  
**Event Coverage:** 6/11 (55%) ⚠️  
**Editorial Blurbs:** 11/11 (100%) ✅

**Best-in-Class Image Coverage!**

**Event Gaps:**
- **BoccaLupo** - No events (Michelin restaurant, may not host events)
- **Historic Fourth Ward Park** - 1 event (July 23, far future)
- **Home Grown** - No events
- **Staplehouse** - No events (restaurant, likely no public events)
- **Three Taverns Imaginarium** - No events (brewery should have)

**Data Quality Issue:** Food venues (restaurants) showing 0 events is expected. But Three Taverns Imaginarium (brewery) should have event feed.

**Recommendation:**
- Add crawler for Three Taverns Imaginarium (brewery events, releases)
- Consider filtering restaurants from "event coverage" metric if they're not event venues

---

### 5. The Itis (23 venues, Food Scene)
**Mission:** James Beard legends, soul food, Buford Highway  
**Image Coverage:** 17/23 (74%) ⚠️  
**Event Coverage:** 4/23 (17%) ❌  
**Editorial Blurbs:** 19/23 (83%)

**Critical Gaps - MISSING IMAGES (6 venues):**
1. Sweet Auburn Curb Market
2. Atlanta Food Truck Park
3. Paschal's Restaurant (appears 3x across tracks)
4. Politan Row
5. Stackhouse
6. The Works Atlanta

**Event Gaps (19 venues with 0 events):**
Most are restaurants (expected), but food halls should have events:
- **Politan Row** - Food hall, should have events
- **Atlanta Food Truck Park** - Should have event feeds

**Data Quality Issue:** 26% missing images is worst among "featured" tracks. Many food hall venues have no images or events.

**Recommendation:**
- Prioritize images for: Paschal's, Politan Row, Sweet Auburn Curb Market
- Add crawlers for food halls (Politan Row, Atlanta Food Truck Park)
- Consider marking pure restaurants as "reservations only" vs "events hosted"

---

### 6. City in a Forest (13 venues, Great Outdoors)
**Mission:** Parks, trails, waterfalls, green spaces  
**Image Coverage:** 9/13 (69%) ⚠️  
**Event Coverage:** 5/13 (38%) ❌  
**Editorial Blurbs:** 13/13 (100%) ✅

**Critical Gaps - MISSING IMAGES (4 venues):**
1. **Historic Fourth Ward Park Multipurpose Field** - Created by venue lookup, generic name
2. **Sope Creek Paper Mill Ruins** - NEW hidden gem venue (created in migration 20260215950000)
3. **Stone Mountain Park** - Major attraction, missing image
4. **Westview Cemetery** - NEW hidden gem venue (created in migration 20260215950000)

**Event Gaps:**
Most parks have 0 events (expected), but some should:
- **Chastain Park** - Should have amphitheater events (0 events)
- **Sope Creek**, **Westview Cemetery**, **Arabia Mountain** - Unlikely to have events (hiking/exploring)

**Data Quality Issue:** New "hidden gem" venues added in enrichment migration have NO images. Stone Mountain is a major gap.

**Recommendation:**
- **URGENT:** Add images for Sope Creek, Westview Cemetery, Stone Mountain
- Research Chastain Park events (amphitheater should have active crawler)
- Clean up "Historic Fourth Ward Park Multipurpose Field" name (too generic)

---

### 7. Hard in Da Paint (10 venues, Street Art & Galleries)
**Mission:** Krog Tunnel, Goat Farm, galleries, local art  
**Image Coverage:** 10/10 (100%) ✅✅✅  
**Event Coverage:** 8/10 (80%) ✅  
**Editorial Blurbs:** 10/10 (100%) ✅

**BEST OVERALL TRACK!** Only 2 venues with 0 events (both galleries, expected).

**Minor Gaps:**
- **MODA (Museum of Design Atlanta)** - No events (may be seasonal)
- **Whitespace Gallery** - No events (gallery may have openings not in system)

**Recommendation:** This track is production-ready. Consider showcasing as reference for other tracks.

---

### 8. A Beautiful Mosaic (30 venues, Global Atlanta)
**Mission:** Buford Highway world tour, cultural centers, ethnic restaurants  
**Image Coverage:** 22/30 (73%) ⚠️  
**Event Coverage:** 3/30 (10%) ❌  
**Editorial Blurbs:** 30/30 (100%) ✅

**Critical Gaps - MISSING IMAGES (8 venues):**
1. Drepung Loseling Monastery (NEW hidden gem, created 2026-02-11)
2. Plaza Fiesta
3. Center for Pan Asian Community Services
4. International Rescue Committee
5. Jeju Sauna (appears 2x, one has image)
6. Latin American Association
7. Plaza Las Americas
8. Sweet Auburn Curb Market

**Event Coverage Disaster:** Only 3 venues have events (Drepung Loseling: 12 events, others minimal). 90% of track is event-dead.

**Data Quality Issue:** Most venues are restaurants (not event venues) OR community organizations without public event crawlers.

**Recommendation:**
- **URGENT:** Add images for Drepung Loseling (monastery), Plaza Fiesta, Jeju Sauna
- Research which cultural centers host public events (IRC Atlanta, Latin American Assoc, CPACS)
- Consider splitting track: "Global Eats" (restaurants) vs "Cultural Centers" (event venues)

---

### 9. Too Busy to Hate (16 venues, LGBTQ+ Atlanta)
**Mission:** Pride, drag, queer nightlife, community spaces  
**Image Coverage:** 15/16 (94%) ✅  
**Event Coverage:** 12/16 (75%) ✅  
**Editorial Blurbs:** 16/16 (100%) ✅

**Strong Track!** Only 1 image gap, good event coverage.

**Critical Gap:**
- **Atlanta Pride** - MISSING IMAGE (organization, not venue - needs logo or parade photo)

**Event Gaps (minor):**
- **Lips Atlanta** - Drag venue, 0 events (may need crawler)
- **My Sister's Room** - Historic lesbian bar, 0 events
- **Future Atlanta** - 0 events
- **Jungle Atlanta** - 0 events

**Recommendation:**
- Add Atlanta Pride image (organization logo or iconic photo)
- Investigate Lips Atlanta, My Sister's Room event feeds (both should have regular shows)

---

### 10. The Midnight Train (26 venues, Quirky Atlanta)
**Mission:** Clermont Lounge, Doll's Head Trail, MJQ bunker, weird spots  
**Image Coverage:** 23/26 (88%) ✅  
**Event Coverage:** 14/26 (54%) ⚠️  
**Editorial Blurbs:** 25/26 (96%)

**Critical Gaps - MISSING IMAGES:**
1. **Drepung Loseling Monastery** (appears in 2 tracks, needs image)
2. **Westview Cemetery** (NEW hidden gem)
3. **Sope Creek Paper Mill Ruins** (NEW hidden gem)

**Event Gaps (12 venues):**
Mix of landmarks (expected 0) and nightlife venues (unexpected 0):
- **Clermont Lounge** - Iconic strip club, 0 events (needs crawler!)
- **Sister Louisa's** - Drag church, 0 events (needs crawler!)
- **Junkman's Daughter** - Retail, 0 expected
- **Vortex Bar & Grill** - Bar, should have events

**Recommendation:**
- **URGENT:** Clermont Lounge crawler (ATL icon, must have event feed)
- Sister Louisa's crawler (drag shows, bingo)
- Add images for 3 hidden gem venues

---

### 11. Keep Swinging (9 venues, Sports)
**Mission:** Stadiums, sports bars, game day culture  
**Image Coverage:** 8/9 (89%) ✅  
**Event Coverage:** 7/9 (78%) ✅  
**Editorial Blurbs:** 9/9 (100%) ✅

**Strong Track!**

**Critical Gap:**
- **Truist Park** - MISSING IMAGE (Braves stadium, major attraction!)

**Event Gaps (minor):**
- **STATS Brewpub** - 0 events
- **The Beverly** - 0 events

**Recommendation:**
- **URGENT:** Add Truist Park image (major stadium, should have hero image)
- STATS Brewpub, The Beverly likely need crawlers (pre-game events, watch parties)

---

### 12. Life's Like a Movie (12 venues, Film & Family)
**Mission:** Puppetry, dinosaurs, Zoo, kid-friendly entertainment  
**Image Coverage:** 11/12 (92%) ✅  
**Event Coverage:** 9/12 (75%) ✅  
**Editorial Blurbs:** 8/12 (67%)

**Critical Gap:**
- **Zoo Atlanta** - MISSING IMAGE (appears on 2 tracks, major family destination)

**Event Gaps (minor):**
- **Children's Museum of Atlanta** - 0 events (should have)
- **Fernbank Science Center** - 0 events (planetarium shows should be events)

**Missing Blurbs:**
- Georgia Aquarium
- Children's Museum
- Fernbank Science Center
- Zoo Atlanta

**Recommendation:**
- **URGENT:** Zoo Atlanta image
- Crawlers for Children's Museum, Fernbank Science Center (both host events)
- Add blurbs for 4 venues missing editorial copy

---

### 13. Say Less (7 venues, Speakeasy Culture)
**Mission:** Hidden cocktail bars, secret doors, craft mixology  
**Image Coverage:** 6/7 (86%) ✅  
**Event Coverage:** 0/7 (0%) ❌❌❌  
**Editorial Blurbs:** 7/7 (100%) ✅

**ZERO EVENT COVERAGE!** All 7 venues have no upcoming events.

**Critical Gap:**
- **Moonlight at FORTH** - MISSING IMAGE

**Event Coverage Disaster:**
Every venue has 0 events. These are cocktail bars that likely host events (DJ nights, tastings, burlesque).

**Venues with 0 events:**
- Red Phone Booth
- Jojo's Beloved
- 12 Cocktail Bar
- Bacchanalia
- Himitsu
- Moonlight at FORTH
- Umi

**Recommendation:**
- **CRITICAL:** Add crawlers for ALL 7 venues (speakeasies/cocktail bars definitely host events)
- Moonlight image
- This track will look completely broken in the UI with no activity pills

---

### 14. Y'allywood (14 venues, Stage & Screen)
**Mission:** Theaters, comedy clubs, improv, film landmarks  
**Image Coverage:** 14/14 (100%) ✅✅✅  
**Event Coverage:** 8/14 (57%) ⚠️  
**Editorial Blurbs:** 14/14 (100%) ✅

**Perfect image coverage!**

**Event Gaps:**
- **7 Stages Theatre** - 0 events (experimental theater should have)
- **Alliance Theatre** - 0 events (Tony-winning theater, needs crawler)
- **Aurora Theatre** - 0 events
- **Shakespeare Tavern** - 0 events
- **Theatrical Outfit** - 0 events
- **Whole World Improv** - 0 events

**Data Quality Issue:** 6 major Atlanta theaters have NO event feeds. This is a critical gap for a "Stage & Screen" track.

**Recommendation:**
- **URGENT:** Crawlers for Alliance Theatre, 7 Stages, Theatrical Outfit (major venues)
- Aurora, Shakespeare Tavern, Whole World Improv crawlers
- All these venues have public calendars that should be scrapable

---

### 15. SpelHouse Spirit (11 venues, HBCU Culture)
**Mission:** Morehouse, Spelman, AUC culture, Black excellence  
**Image Coverage:** 8/11 (73%) ⚠️  
**Event Coverage:** 4/11 (36%) ❌  
**Editorial Blurbs:** 11/11 (100%) ✅

**Critical Gaps - MISSING IMAGES:**
1. **Paschal's Restaurant** (appears on 3 tracks! highest priority)
2. **Busy Bee Cafe** (soul food icon)
3. **Clark Atlanta University** (HBCU, needs campus photo)

**Event Gaps:**
- **Paschal's** - No events (community hub, should have)
- **Busy Bee Cafe** - No events
- **APEX Museum** - No events
- **Clark Atlanta** - No events (campus events)
- **Shrine Cultural Center** - No events (Pan-African bookstore/center)
- **The Beverly** - No events (Morehouse grad bar)

**Recommendation:**
- **URGENT:** Paschal's image (appears on 3 tracks)
- Busy Bee, Clark Atlanta images
- Crawlers for campus events (Morehouse, Clark Atlanta likely have public calendars)

---

## Global Data Quality Issues

### 1. Paschal's Restaurant - Multi-Track Gap
**Appears on 3 tracks:** Good Trouble, The South Got Something to Say, SpelHouse Spirit  
**Status:** MISSING IMAGE, 0 events, 0 sources  
**Priority:** CRITICAL - This is THE civil rights meeting place, soul food icon, community hub

**Recommendation:** Create Paschal's crawler + add hero image as highest priority fix.

---

### 2. Hidden Gem Venues - Migration Created, No Images
**Created in migration 20260215950000:**
- Sope Creek Paper Mill Ruins (NONE)
- Westview Cemetery (NONE)
- Jeju Sauna (NONE - but duplicate entry with image exists)

**Created earlier:**
- Drepung Loseling Monastery (2026-02-11, NONE)

**Recommendation:** Source and add images for all 4 venues. These were manually curated as "hidden gems" but have no visuals.

---

### 3. Short Description Field - 99.5% Empty
**Status:** 210/211 venues have `short_description = NULL`  
**API Impact:** The explore tracks API returns `short_description` field, but it's always null.

**Root Cause:** Venues don't have this field populated. Editorial blurbs exist (92% coverage) but live in `explore_track_venues.editorial_blurb`.

**Recommendation:**
- Option A: Backfill `venues.short_description` from `explore_track_venues.editorial_blurb` (use earliest/most general blurb)
- Option B: Remove `short_description` from API response (unused field)
- Option C: Make UI use `editorial_blurb` (already returned) and ignore `short_description`

---

### 4. Venue Type Inconsistencies
**Examples from data:**
- Drepung Loseling Monastery: `venue_type = 'monastery'` (should be standardized)
- Multiple venues: `venue_type = 'church'` vs `'monastery'` vs `'temple'`

**Recommendation:** Venue type taxonomy review needed for filtering/categorization.

---

## Crawler Coverage Analysis

### Venues with Events But No Active Sources (Anomalies)
These venues have upcoming events but show 0 active sources in the last 90 days:
- Centennial Olympic Park (0 events, 0 sources) ✓
- World of Coca-Cola (0 events, 0 sources) ✓

**Note:** Most venues with events DO show active sources. The "0 sources" count may be a query artifact (checking last 90 days of events for source_id).

---

## Recommendations by Priority

### P0 - Critical (Blocks Track UX)
1. **Paschal's Restaurant:** Add image + crawler (appears 3x, soul food icon)
2. **Say Less track:** Add crawlers for ALL 7 cocktail bars (0% event coverage breaks track)
3. **Zoo Atlanta:** Add image (appears 2x, major family destination)
4. **Truist Park:** Add image (Braves stadium)
5. **Stone Mountain Park:** Add image (851 events but no image!)

### P1 - High (Impacts Featured Venues)
6. **Hidden Gem Images:** Sope Creek, Westview Cemetery, Drepung Loseling (migration-created venues)
7. **Clermont Lounge:** Add crawler (Atlanta icon, 0 events)
8. **Sister Louisa's:** Add crawler (drag church, 0 events)
9. **Magic City:** Add crawler (hip-hop A&R club, 0 events)
10. **Alliance Theatre:** Add crawler (Tony-winning theater, 0 events)

### P2 - Medium (Fill Event Gaps)
11. Theater crawlers: 7 Stages, Theatrical Outfit, Shakespeare Tavern, Whole World Improv
12. LGBTQ+ venue crawlers: Lips Atlanta, My Sister's Room
13. Food hall crawlers: Politan Row, Atlanta Food Truck Park
14. Cultural center research: Which venues host public events? (IRC, Latin American Assoc, CPACS)

### P3 - Low (Polish)
15. Clean up venue names: "Historic Fourth Ward Park Multipurpose Field/Skatepark" → "Fourth Ward Skatepark"
16. Add editorial blurbs for 16 venues missing them
17. Backfill `short_description` field (or remove from API)
18. Venue type taxonomy standardization

---

## SQL Queries for Validation

### Find all venues missing images
```sql
SELECT 
  et.slug as track_slug,
  v.name as venue_name,
  v.slug as venue_slug,
  etv.is_featured
FROM explore_tracks et
JOIN explore_track_venues etv ON et.id = etv.track_id
JOIN venues v ON etv.venue_id = v.id
WHERE et.is_active = true
  AND v.hero_image_url IS NULL 
  AND v.image_url IS NULL
ORDER BY etv.is_featured DESC, et.sort_order, v.name;
```

### Find all venues with 0 upcoming events
```sql
WITH venue_event_counts AS (
  SELECT venue_id, COUNT(*) as cnt
  FROM events
  WHERE start_date >= CURRENT_DATE
    AND canonical_event_id IS NULL
  GROUP BY venue_id
)
SELECT 
  et.slug,
  v.name,
  v.venue_type,
  etv.is_featured
FROM explore_tracks et
JOIN explore_track_venues etv ON et.id = etv.track_id
JOIN venues v ON etv.venue_id = v.id
LEFT JOIN venue_event_counts vec ON v.id = vec.venue_id
WHERE et.is_active = true
  AND (vec.cnt IS NULL OR vec.cnt = 0)
ORDER BY et.sort_order, etv.is_featured DESC;
```

---

## Files Analyzed
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215800000_explore_tracks_curation_overhaul.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215920000_new_explore_tracks.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215950000_hidden_gems_enrichment.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215100002_explore_track_venue_mappings.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215300001_explore_tracks_enrichment.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260215300004_explore_tracks_enrichment_quirky.sql`
- `/Users/coach/Projects/LostCity/web/app/api/explore/tracks/route.ts`
- `/Users/coach/Projects/LostCity/web/app/api/explore/tracks/[slug]/route.ts`

**End of Report**
