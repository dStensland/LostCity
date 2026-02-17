# Global Atlanta Track - Venues to Research and Add

**Date**: 2026-02-14  
**Track**: `a-beautiful-mosaic`  
**Status**: Research needed - these venues do NOT exist in the database yet

---

## Priority 1: Critical Missing Venues

### Your DeKalb Farmers Market
- **Why**: One of Atlanta's most iconic international markets
- **Address**: 3000 E Ponce de Leon Ave, Decatur, GA 30030
- **Type**: international_market or farmers_market
- **Neighborhood**: Decatur
- **Website**: https://www.dekalbfarmersmarket.com/
- **Description**: 140,000 sq ft international market with produce, meat, seafood, cheese, and prepared foods from around the world
- **Events**: Likely has cooking classes, food demos, seasonal events

### Global Village Project
- **Why**: School for refugee girls, highly relevant to the track
- **Location**: Clarkston
- **Type**: nonprofit or community_center
- **Website**: https://globalvillageproject.org/
- **Description**: Middle school for refugee girls who are newcomers to the US
- **Events**: May host community events, cultural celebrations

### Refugee Coffee Company
- **Why**: Social enterprise supporting refugees, cultural significance
- **Location**: Clarkston area
- **Type**: coffee_shop or nonprofit
- **Website**: Check if they have events/workshops
- **Description**: Coffee shop that provides employment and training to refugees

---

## Priority 2: Clarkston Community Venues

Clarkston is known as the "Ellis Island of the South" - we only found 1 venue there. Research needed for:

### Clarkston Community Center
- Search for: city recreation centers, community gathering spaces
- Type: community_center

### Friends of Refugees
- Check if they have a physical space/events
- Type: nonprofit

### Clarkston churches/worship centers serving refugee communities
- Ethiopian Orthodox churches
- Bhutanese/Nepali temples
- Other multi-cultural worship spaces
- Type: worship or cultural_center

---

## Priority 3: Cultural/Religious Centers

Very few found in database - need to research:

### Hindu Temples
- BAPS Shri Swaminarayan Mandir (Lilburn)
- Hindu Temple of Atlanta (Riverdale)
- Type: worship or cultural_center

### Mosques
- Masjid Al-Muminun (SW Atlanta)
- Al-Farooq Masjid of Atlanta
- Type: worship or cultural_center

### Buddhist Centers
- Yamato-Ji Zen Buddhist Temple
- Atlanta Soto Zen Center
- Type: worship or cultural_center

### Ethiopian Cultural Organizations
- Ethiopian Community Center
- Ethiopian restaurants with cultural events (check if they host community gatherings)
- Type: cultural_center or community_center

### Korean Cultural Centers (Duluth area)
- Korean Community Center
- Korean churches with cultural programs
- Type: cultural_center or community_center

---

## Priority 4: International Markets (Beyond what we found)

### Nam Dae Mun Farmers Market
- Doraville/Duluth area
- Korean international market
- Type: international_market

### Asian grocery stores with community/cultural significance
- Great Wall Supermarket (already in DB as ID 1216, needs events)
- H-Mart locations
- Type: international_market

---

## Priority 5: Cultural Event Venues

### Venues hosting international/cultural events
Research if these have regular cultural programming:
- Cobb Energy Performing Arts Centre (international performances)
- Rialto Center for the Arts (world music, dance)
- Type: Check existing type, may just need events

---

## Research Methodology

For each venue above:

1. **Verify existence**: Google search, check website, verify address
2. **Check for events**: Look for event calendars, cultural programs, community gatherings
3. **Gather data**:
   - Exact address with zip code
   - Lat/lng coordinates (use Google Maps)
   - Official website
   - Social media (Instagram, Facebook)
   - Description (50-100 words)
   - Categories/tags
   - Image (scrape from Google Maps or website)

4. **Create venue record** via crawler or manual SQL insert

5. **Create event source** if they have an event calendar:
   - Create source record in `sources` table
   - Write crawler in `crawlers/sources/`
   - Test crawler
   - Register with main crawler system

6. **Add to track**:
   ```sql
   INSERT INTO explore_track_venues (track_slug, venue_id, sort_order)
   VALUES ('a-beautiful-mosaic', [NEW_VENUE_ID], [NEXT_SORT_ORDER]);
   ```

---

## Next Steps

1. Start with Your DeKalb Farmers Market (highest priority)
2. Research Clarkston venues (biggest gap)
3. Add 2-3 temples/mosques for religious diversity
4. Add 1-2 Korean/Ethiopian cultural centers
5. Re-assess track balance and geographic coverage

Target: 25-30 total venues in track with good geographic and cultural balance.

