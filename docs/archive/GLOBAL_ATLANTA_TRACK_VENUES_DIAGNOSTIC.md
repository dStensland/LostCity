# Data Quality Diagnostic: Global Atlanta / "A Beautiful Mosaic" Track Venues

**Date**: 2026-02-14
**Track**: `a-beautiful-mosaic` 
**Current Status**: 0 venues assigned to track
**Issue**: Track is populated almost entirely with restaurants; needs cultural centers, markets, and community organizations

---

## Executive Summary

The "A Beautiful Mosaic" explore track currently has **ZERO venues** assigned in the `explore_track_venues` table. User reports the track contains mostly restaurants when it should showcase Atlanta's international cultural infrastructure - markets, cultural centers, community organizations, and gathering places that represent the city's diverse immigrant communities.

---

## Data Findings

### High-Priority Venues Found in Database

These venues exist and should be added to the track immediately:

#### Markets & Shopping
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 2430 | Plaza Las Americas | event_space | Buford Highway | ✗ |
| 2623 | Plaza Fiesta | organization | none | ✗ |
| 1205 | Buford Highway Farmers Market | venue | Doraville | ✓ |
| 352 | Sweet Auburn Curb Market | farmers_market | Sweet Auburn | ✗ |
| 372 | Ponce City Market | food_hall | Old Fourth Ward | ✓ |

**Note**: "Your DeKalb Farmers Market" is **NOT** in the database - needs to be created.

#### Cultural & Community Centers
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 3901 | Center for Pan Asian Community Services | community_center | Doraville | ✗ |
| 756 | Latin American Association | organization | Atlantic Station | ✗ |
| 3931 | International Rescue Committee Atlanta | organization | North Druid Hills | ✗ |
| 979 | Shrine Cultural Center | venue | Downtown | ✓ |
| 1972 | Westside Cultural Arts Center | community_center | West Midtown | ✓ |
| 985 | Ebenezer Baptist Church | community_center | Downtown | ✓ |
| 2177 | MJCCA | community_center | none | ✓ |

#### Clarkston Venues (Refugee Community Hub)
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 649 | Fine Arts Gallery, GSU\|PC Clarkston Campus | gallery | Clarkston | ✓ |

**Gap**: Only 1 Clarkston venue found. Need more refugee/immigrant community venues in this area.

#### Chamblee (International Corridor)
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 1804 | Blooms Emporium Chinatown | event_space | Chamblee | ✓ |
| 2348 | Chamblee Antiques & Interiors | venue | Chamblee | ✓ |
| 2347 | Antique Factory | venue | Chamblee | ✓ |
| 2351 | Atlanta Vintage Books | bookstore | Chamblee | ✓ |
| 48 | Atlanta Fusion Belly Dance | fitness_center | Chamblee | ✓ |

#### Doraville (Buford Highway Corridor)
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 1096 | The Oddities Museum | museum | Doraville | ✓ |
| 1216 | Great Wall Supermarket | venue | Doraville | ✗ |
| 1205 | Buford Highway Farmers Market | venue | Doraville | ✓ |

#### Duluth (Korean/International Hub)
| ID | Name | Type | Neighborhood | Has Image |
|----|------|------|--------------|-----------|
| 1722 | Jeju Sauna | venue | Duluth | ✓ |
| 1334 | Hudgens Center for Art & Learning | venue | Duluth | ✓ |
| 1308 | Cafe Mozart Bakery | coffee_shop | Duluth | ✓ |

---

## Missing Venues (Need to be Created)

### Critical Missing Venues
1. **Your DeKalb Farmers Market** - Major international market, highly relevant
   - Address: 3000 E Ponce de Leon Ave, Decatur, GA 30030
   - Type: farmers_market or international_market
   - Neighborhood: Decatur

2. **Global Village Project** - School for refugee girls
   - Clarkston-based
   - Type: nonprofit or community_center

3. **Refugee Coffee Company** - Social enterprise
   - Type: coffee_shop or nonprofit
   - Clarkston area

4. **Additional Clarkston community venues** - The "Ellis Island of the South" needs better representation

### Cultural/Religious Centers to Research
Based on search patterns, we found very few mosques, temples, or cultural centers:
- Hindu temples (Riverdale, Smyrna areas)
- Masjid Al-Muminun (SW Atlanta)
- Buddhist temples
- Ethiopian cultural centers
- Korean cultural organizations (Duluth)

---

## Venue Type Issues

### Problem: Inconsistent `venue_type` Assignments

Many relevant venues have generic or incorrect types:

| Venue | Current Type | Should Be |
|-------|--------------|-----------|
| Plaza Fiesta | organization | market or cultural_venue |
| Plaza Las Americas | event_space | market or cultural_venue |
| Buford Highway Farmers Market | venue | farmers_market or international_market |
| Great Wall Supermarket | venue | market or international_market |
| Latin American Association | organization | nonprofit or community_center |
| IRC Atlanta | organization | nonprofit or community_center |
| CPACS | community_center | nonprofit or cultural_center |

**Impact**: Explore track filtering may rely on `venue_type`, and "venue" or "organization" are too generic for discovery.

---

## Image Coverage

### Venues WITH Images (19 total)
Good image coverage for:
- Ponce City Market
- Buford Highway Farmers Market  
- Shrine Cultural Center
- Westside Cultural Arts Center
- Ebenezer Baptist Church
- MJCCA
- Chamblee antique shops
- Duluth venues (Jeju Sauna, Hudgens Center, Cafe Mozart)
- Clarkston gallery

### Venues WITHOUT Images (13 critical ones)
High-priority venues missing images:
- Plaza Las Americas
- Plaza Fiesta
- Sweet Auburn Curb Market
- Latin American Association
- IRC Atlanta
- CPACS (Center for Pan Asian Community Services)
- Great Wall Supermarket
- All farmers markets except Buford Highway and Ponce City

**Recommendation**: Source images for Plaza Fiesta, Your DeKalb FM, Sweet Auburn, and the nonprofit organizations.

---

## Geographic Distribution

### Well-Represented Areas
- **Chamblee**: 5+ quality venues with images
- **Doraville**: 3 key venues (Buford Hwy corridor)
- **Duluth**: 3 Korean/international venues
- **Downtown**: Cultural institutions (Shrine, Ebenezer, Sweet Auburn)

### Under-Represented Areas
- **Clarkston**: Only 1 venue (should have 5-10+ given refugee community density)
- **Norcross**: 11 venues found but mostly churches/generic orgs
- **Decatur**: Missing Your DeKalb Farmers Market
- **SW/SE Atlanta**: Minimal international/immigrant community representation

---

## Recommended Actions

### Immediate (Can Do Today)
1. **Add existing venues to track** via `explore_track_venues` inserts:
   - Plaza Fiesta (2623)
   - Plaza Las Americas (2430)
   - Buford Highway Farmers Market (1205)
   - Sweet Auburn Curb Market (352)
   - Latin American Association (756)
   - IRC Atlanta (3931)
   - CPACS (3901)
   - Shrine Cultural Center (979)
   - Westside Cultural Arts Center (1972)
   - Ebenezer Baptist Church (985)
   - MJCCA (2177)
   - Blooms Emporium Chinatown (1804)
   - Jeju Sauna (1722)
   - Hudgens Center (1334)
   - Fine Arts Gallery GSU Clarkston (649)

2. **Fix venue types** for better discoverability:
   ```sql
   UPDATE venues SET venue_type = 'international_market' WHERE id = 2623; -- Plaza Fiesta
   UPDATE venues SET venue_type = 'international_market' WHERE id = 2430; -- Plaza Las Americas
   UPDATE venues SET venue_type = 'international_market' WHERE id = 1205; -- Buford Hwy FM
   UPDATE venues SET venue_type = 'international_market' WHERE id = 1216; -- Great Wall
   UPDATE venues SET venue_type = 'nonprofit' WHERE id IN (756, 3931, 3901); -- Nonprofits
   ```

3. **Set neighborhood for Plaza Fiesta**:
   ```sql
   UPDATE venues SET neighborhood = 'Buford Highway' WHERE id = 2623;
   ```

### Short-Term (This Week)
1. **Create missing venue records**:
   - Your DeKalb Farmers Market
   - Global Village Project
   - Refugee Coffee Company
   - Additional Clarkston community venues (research needed)

2. **Source images** for high-priority venues:
   - Plaza Fiesta (can scrape from Google Maps)
   - Your DeKalb Farmers Market
   - Sweet Auburn Curb Market
   - Latin American Association (check their website)
   - IRC Atlanta (check their website)

3. **Research and add cultural/religious centers**:
   - Hindu temples in metro Atlanta
   - Prominent mosques
   - Ethiopian cultural organizations
   - Korean cultural centers (Duluth area)

### Medium-Term (Next Sprint)
1. **Create dedicated crawlers** for:
   - Plaza Fiesta event calendar (if they have one)
   - IRC Atlanta community events
   - Latin American Association events
   - CPACS events
   - MJCCA cultural programs

2. **Enrich venue metadata**:
   - Add `explore_blurb` for all track venues
   - Set `explore_category = 'food_culture'` or `'hidden_gems'` appropriately
   - Add `hero_image_url` for hero shots

3. **Neighborhood audit**: 
   - Comprehensive search for Clarkston venues (churches, community centers, nonprofits serving refugees)
   - Buford Highway corridor mapping (Chamblee to Doraville stretch)

---

## Validation Queries

### Check current track venues
```sql
SELECT 
  v.id, 
  v.name, 
  v.venue_type, 
  v.neighborhood,
  CASE WHEN v.image_url IS NOT NULL OR v.hero_image_url IS NOT NULL THEN 'Yes' ELSE 'No' END as has_image
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_slug = 'a-beautiful-mosaic'
ORDER BY v.neighborhood, v.name;
```

### Count venues by type in track
```sql
SELECT 
  COALESCE(v.venue_type, 'null') as type,
  COUNT(*) as count
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_slug = 'a-beautiful-mosaic'
GROUP BY v.venue_type
ORDER BY count DESC;
```

### Find restaurants vs non-restaurants
```sql
SELECT 
  CASE 
    WHEN v.venue_type IN ('restaurant', 'bar', 'cafe', 'coffee_shop') THEN 'Food/Drink'
    ELSE 'Cultural/Community'
  END as category,
  COUNT(*) as count
FROM explore_track_venues etv
JOIN venues v ON etv.venue_id = v.id
WHERE etv.track_slug = 'a-beautiful-mosaic'
GROUP BY category;
```

---

## Data Quality Score

| Metric | Score | Notes |
|--------|-------|-------|
| **Venue Count** | 0/20 | Track is empty, needs 15-20 venues |
| **Geographic Coverage** | 2/5 | Missing Clarkston, Decatur, SW/SE |
| **Image Coverage** | N/A | Can't assess until venues added |
| **Type Accuracy** | 3/5 | Many generic "venue" or "organization" types |
| **Cultural Balance** | 0/5 | Currently all restaurants (per user) |
| **Data Completeness** | 4/10 | Missing Your DeKalb FM, Global Village, etc. |

**Overall**: 🔴 Critical - Track needs immediate attention

---

## Next Steps for crawler-dev

1. Run the insert script to add the 15 recommended venues to the track
2. Update venue types for better discoverability
3. Research and create venue records for the 3 missing critical venues
4. Source images for Plaza Fiesta, Your DeKalb FM, and nonprofit orgs
5. Conduct Clarkston neighborhood audit to find more refugee community venues

---

## SQL Script to Add Venues

```sql
-- Add high-priority venues to a-beautiful-mosaic track
INSERT INTO explore_track_venues (track_slug, venue_id, sort_order) VALUES
  ('a-beautiful-mosaic', 2623, 1),   -- Plaza Fiesta
  ('a-beautiful-mosaic', 2430, 2),   -- Plaza Las Americas
  ('a-beautiful-mosaic', 1205, 3),   -- Buford Highway Farmers Market
  ('a-beautiful-mosaic', 352, 4),    -- Sweet Auburn Curb Market
  ('a-beautiful-mosaic', 756, 5),    -- Latin American Association
  ('a-beautiful-mosaic', 3931, 6),   -- IRC Atlanta
  ('a-beautiful-mosaic', 3901, 7),   -- CPACS
  ('a-beautiful-mosaic', 979, 8),    -- Shrine Cultural Center
  ('a-beautiful-mosaic', 1972, 9),   -- Westside Cultural Arts Center
  ('a-beautiful-mosaic', 985, 10),   -- Ebenezer Baptist Church
  ('a-beautiful-mosaic', 2177, 11),  -- MJCCA
  ('a-beautiful-mosaic', 1804, 12),  -- Blooms Emporium Chinatown
  ('a-beautiful-mosaic', 1722, 13),  -- Jeju Sauna
  ('a-beautiful-mosaic', 1334, 14),  -- Hudgens Center
  ('a-beautiful-mosaic', 649, 15)    -- Fine Arts Gallery GSU Clarkston
ON CONFLICT (track_slug, venue_id) DO NOTHING;

-- Fix venue types
UPDATE venues SET 
  venue_type = 'international_market',
  neighborhood = 'Buford Highway'
WHERE id = 2623; -- Plaza Fiesta

UPDATE venues SET venue_type = 'international_market' WHERE id = 2430; -- Plaza Las Americas
UPDATE venues SET venue_type = 'international_market' WHERE id = 1205; -- Buford Hwy FM
UPDATE venues SET venue_type = 'international_market' WHERE id = 1216; -- Great Wall
UPDATE venues SET venue_type = 'nonprofit' WHERE id IN (756, 3931, 3901);
```

