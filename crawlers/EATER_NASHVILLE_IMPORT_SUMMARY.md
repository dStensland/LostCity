# Eater Nashville Essential 38 - Import Summary

## Import Date
February 2, 2026

## Source
NASHVILLE_METRO_CURATORS_RESEARCH.md - Eater Nashville Essential 38 section

## Results
- **Total venues imported**: 38
- **Created**: 38 (all new)
- **Updated**: 0
- **Errors**: 0

## Venue Tags
All venues are tagged with:
- `curator-vetted` - Indicates quality-vetted by professional curators
- `eater-nashville-38` - Specific to this Eater Nashville list

## Geographic Distribution

### Neighborhood Breakdown
- **East Nashville**: 17 venues (45%) - Dominant area, creative/foodie hub
- **South Nashville**: 4 venues (11%) - International corridor (Nolensville Pike)
- **Germantown**: 3 venues (8%) - Historic upscale dining
- **West Nashville**: 3 venues (8%)
- **12 South**: 2 venues (5%) - Trendy walkable area
- **Wedgewood Houston**: 2 venues (5%)
- **Other neighborhoods**: 1 venue each (The Gulch, Belle Meade, Jefferson Street, Salemtown, Midtown, Belmont, Antioch)

### Key Insights
- **East Nashville dominance**: Nearly half of Eater's Essential 38 are in East Nashville, confirming its status as the city's premier foodie destination
- **Neighborhood diversity**: List spans 13 different neighborhoods, showing Nashville's decentralized food scene
- **International representation**: Strong showing on Nolensville Pike (South Nashville) with Ethiopian, Thai, Egyptian, Kurdish/Turkish venues

## Venue Type Distribution
- **Restaurant**: 34 venues (89%)
- **Bar**: 3 venues (8%) - Dino's Bar, Turkey and the Wolf Icehouse, Bad Idea
- **Cafe**: 1 venue (3%) - The Butter Milk Ranch

## Notable Cuisines & Features
- **James Beard Recognition**: 3 venues
  - City House (Tandy Wilson - Winner 2016)
  - Bastion (Josh Habiger - Finalist)
  - International Market (Arnold Myint - Semifinalist)
  
- **International Cuisine**: Thai, Vietnamese, Ethiopian, Egyptian, Kurdish, Turkish, Korean, Caribbean/Jamaican, Pan-Asian
  
- **Nashville Specialties**: 
  - Hot chicken (Bolton's)
  - BBQ (Shotgun Willie's)
  - Meat-and-three (Wendell Smith's - since 1952)

- **Celebrity Chefs**: Sean Brock (Sho Pizza Bar), Josh Habiger (Bastion), Vivek Surti (Tailor), Trevor Moran (Locust - World's 50 Best NA list)

## Venue Vibes
Each venue includes descriptive vibes such as:
- `upscale`, `casual`, `chef-driven`, `award-winning`
- `pizza`, `bbq`, `hot-chicken`, `thai`, `italian`, etc.
- `tasting-menu`, `dive-bar`, `wine-bar`, `food-hall`
- `local-favorite`, `historic`, `unique-space`

## Data Quality
All venues include:
- Name, slug (URL-friendly identifier)
- Full address
- City (Nashville), State (TN)
- Neighborhood
- Venue type
- Description with context
- Vibes/tags for filtering

## Files Created
1. `/Users/coach/Projects/LostCity/crawlers/import_eater_nashville.py` - Import script
2. `/Users/coach/Projects/LostCity/crawlers/verify_nashville_import.py` - Verification script
3. This summary document

## Next Steps
These venues can now be:
1. **Featured in Nashville portal** - Use `vibes` filter for `eater-nashville-38`
2. **Used for event sourcing** - Research which venues have event calendars
3. **Enhanced with geocoding** - Add lat/lng coordinates for map display
4. **Linked to events** - When crawling Nashville events, match to these venue records
5. **Cross-referenced with other curators** - Compare with Nashville Scene, The Infatuation lists

## Query to View These Venues
```sql
SELECT name, neighborhood, venue_type, address
FROM venues
WHERE 'eater-nashville-38' = ANY(vibes)
ORDER BY neighborhood, name;
```

## Python Query
```python
import db
client = db.get_client()
result = client.table('venues').select('*').contains('vibes', ['eater-nashville-38']).execute()
```
