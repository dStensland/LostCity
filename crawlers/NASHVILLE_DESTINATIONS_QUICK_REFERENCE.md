# Nashville Destinations - Quick Reference Guide

## Overview
270 Nashville venues imported and ready to use.

---

## Quick Stats

- **Total Venues**: 270
- **Curator-Vetted**: 139 venues
- **Neighborhoods**: 30
- **Venue Types**: 13

---

## Most Useful Queries

### Get All Bars
```python
bars = client.table('venues').select('*').eq('city', 'Nashville').eq('venue_type', 'bar').execute()
# Returns: 27 bars
```

### Get All Coffee Shops
```python
coffee = client.table('venues').select('*').eq('city', 'Nashville').eq('venue_type', 'coffee_shop').execute()
# Returns: 15 coffee shops
```

### Get All Breweries
```python
breweries = client.table('venues').select('*').eq('city', 'Nashville').eq('venue_type', 'brewery').execute()
# Returns: 14 breweries
```

### Get Venues by Neighborhood
```python
east_nash = client.table('venues').select('*').eq('city', 'Nashville').eq('neighborhood', 'East Nashville').execute()
# Returns: 33 venues
```

### Get Honky-Tonks
```python
honky_tonks = client.table('venues').select('*').eq('city', 'Nashville').contains('vibes', ['honky-tonk']).execute()
# Returns: 6 honky-tonks (Tootsie's, Robert's, Layla's, etc.)
```

### Get Music Venues
```python
music = client.table('venues').select('*').eq('city', 'Nashville').eq('venue_type', 'music_venue').execute()
# Returns: 21 music venues
```

### Get LGBTQ+ Venues
```python
lgbtq = client.table('venues').select('*').eq('city', 'Nashville').contains('vibes', ['lgbtq']).execute()
# Returns: 4 LGBTQ+ venues
```

### Get Family-Friendly Attractions
```python
family = client.table('venues').select('*').eq('city', 'Nashville').contains('vibes', ['family-friendly']).execute()
# Returns: 10+ family venues
```

### Get Curator-Vetted Venues
```python
curator = client.table('venues').select('*').eq('city', 'Nashville').contains('vibes', ['curator-vetted']).execute()
# Returns: 139 curator-vetted venues
```

---

## SQL Quick Queries

```sql
-- All Nashville venues
SELECT * FROM venues WHERE city = 'Nashville' AND state = 'TN';

-- Count by venue type
SELECT venue_type, COUNT(*) 
FROM venues 
WHERE city = 'Nashville' 
GROUP BY venue_type 
ORDER BY COUNT(*) DESC;

-- Count by neighborhood
SELECT neighborhood, COUNT(*) 
FROM venues 
WHERE city = 'Nashville' 
GROUP BY neighborhood 
ORDER BY COUNT(*) DESC;

-- Get honky-tonks on Broadway
SELECT name, address FROM venues 
WHERE city = 'Nashville' 
  AND 'honky-tonk' = ANY(vibes) 
  AND neighborhood = 'Downtown';

-- Get all breweries with taprooms
SELECT name, neighborhood FROM venues 
WHERE city = 'Nashville' 
  AND venue_type = 'brewery' 
  AND 'taproom' = ANY(vibes);

-- Get specialty coffee roasters
SELECT name, neighborhood FROM venues 
WHERE city = 'Nashville' 
  AND 'roastery' = ANY(vibes);
```

---

## Top Venues by Category

### Must-Visit Bars:
1. Patterson House - Speakeasy cocktails (Midtown)
2. Tootsie's Orchid Lounge - Iconic honky-tonk (Downtown)
3. Santa's Pub - Legendary dive bar (Berry Hill)
4. Rudy's Jazz Room - Jazz club (The Gulch)
5. Lipstick Lounge - Historic LGBTQ+ bar (East Nashville)

### Must-Visit Coffee:
1. Barista Parlor - Nashville's best roaster (3 locations)
2. Crema Coffee - Downtown specialty coffee
3. Eighth & Roast - Small-batch roaster (Melrose)
4. Bongo Java - Nashville institution since 1993
5. Frothy Monkey - Local chain with food (2 locations)

### Must-Visit Breweries:
1. Yazoo Brewing - Original Nashville brewery (The Gulch)
2. Bearded Iris - Known for hazy IPAs (2 locations)
3. Southern Grist - Experimental beers (2 locations)
4. Jackalope Brewing - Bearwalker Maple Brown
5. Black Abbey - Belgian-inspired (South Nashville)

### Must-Visit Music Venues:
1. Grand Ole Opry - World's most famous country venue
2. Ryman Auditorium - "Mother Church of Country Music"
3. Bluebird Cafe - Legendary songwriter venue
4. Exit/In - Historic rock club since 1971
5. Station Inn - Bluegrass institution since 1974

### Must-Visit Attractions:
1. Country Music Hall of Fame - Premier music museum
2. Cheekwood Estate - Gardens and art museum
3. Nashville Zoo - Family-friendly
4. Parthenon - Full-scale Athens replica
5. Frist Art Museum - Rotating exhibitions

---

## Vibes/Tags Reference

### Bar Vibes:
- `cocktails`, `craft-cocktails`, `speakeasy`
- `honky-tonk`, `dive-bar`, `neighborhood-bar`
- `lgbtq`, `drag-shows`, `dance-club`
- `jazz`, `blues`, `live-music`
- `rooftop`, `patio`, `beer-garden`

### Coffee Vibes:
- `specialty-coffee`, `roastery`, `local-roaster`
- `community`, `hipster`, `industrial`
- `brunch`, `all-day`, `cafe`

### Brewery Vibes:
- `brewery`, `taproom`, `craft-beer`
- `hazy-ipa`, `belgian-beer`, `german-lager`
- `tours`, `tastings`, `beer-garden`

### Music Vibes:
- `live-music`, `songwriter-rounds`, `acoustic`
- `country-music`, `indie`, `rock`, `punk`
- `bluegrass`, `jazz`, `electronic`
- `iconic`, `historic`, `intimate`

### Attraction Vibes:
- `museum`, `historic`, `family-friendly`
- `interactive`, `kids`, `zoo`, `planetarium`
- `gardens`, `art`, `architecture`

---

## Neighborhood Guide

### East Nashville (33 venues)
Hip, creative neighborhood. Bars, coffee, restaurants, music.
- Key venues: Bastion, Barista Parlor, The 5 Spot

### Downtown (20 venues)
Tourist central. Honky-tonks, museums, major music venues.
- Key venues: Ryman, Tootsie's, Country Music Hall of Fame

### Germantown (11 venues)
Upscale historic. Breweries, restaurants, music venues.
- Key venues: City House, Bearded Iris, City Winery

### Midtown (10 venues)
Music Row area. Cocktail bars, comedy, music venues.
- Key venues: Patterson House, Exit/In, Third Coast Comedy

### The Gulch (7 venues)
Urban luxury. Breweries, coffee, upscale dining.
- Key venues: Yazoo, Rudy's Jazz Room, Station Inn

### 12 South (4 venues)
Trendy shopping district. Coffee, cocktails, restaurants.
- Key venues: Frothy Monkey, The Fox Bar, Locust

---

## Files & Scripts

- **Import Script**: `import_nashville_comprehensive.py`
- **Full Summary**: `NASHVILLE_DESTINATIONS_COMPLETE.md`
- **Data Quality**: `NASHVILLE_DATA_QUALITY_REPORT.md`
- **Eater 38 Import**: `NASHVILLE_IMPORT_COMPLETE.md`
- **This Quick Reference**: `NASHVILLE_DESTINATIONS_QUICK_REFERENCE.md`

---

## Common Tasks

### Task: Find venues for event crawler development
```python
# Get music venues with events
music_venues = client.table('venues').select('*') \
    .eq('city', 'Nashville') \
    .eq('venue_type', 'music_venue') \
    .execute()

# Prioritize: Ryman, Bluebird, Exit/In, The Basement
```

### Task: Build "Nashville Nightlife" guide
```python
# Get all bars + music venues
nightlife = client.table('venues').select('*') \
    .eq('city', 'Nashville') \
    .in_('venue_type', ['bar', 'music_venue']) \
    .execute()

# Filter by vibes: honky-tonk, dive-bar, cocktails, live-music
```

### Task: Create coffee shop map
```python
# Get all coffee shops (need lat/lng first)
coffee = client.table('venues').select('*') \
    .eq('city', 'Nashville') \
    .eq('venue_type', 'coffee_shop') \
    .execute()

# Group by neighborhood for map clustering
```

### Task: Build brewery tour itinerary
```python
# Get breweries with taprooms
taprooms = client.table('venues').select('*') \
    .eq('city', 'Nashville') \
    .eq('venue_type', 'brewery') \
    .contains('vibes', ['taproom']) \
    .execute()

# Suggest route: Yazoo → Bearded Iris → Southern Grist
```

---

## Pro Tips

1. **Use vibes for better filtering** - More specific than venue_type alone
2. **Combine neighborhood + venue_type** - Get East Nashville bars, etc.
3. **Check curator-vetted tag** - Quality signal for recommendations
4. **Multiple locations** - Barista Parlor, Frothy Monkey, Southern Grist have 2-3 locations
5. **Honky-tonks need special handling** - Most don't post formal events, generate daily "Live Music" entries

---

## Next Enhancements

1. Add lat/lng coordinates (enable mapping)
2. Add website URLs (enable event crawlers)
3. Add phone numbers (contact info)
4. Add operating hours ("open now" filter)
5. Add images (visual appeal)

---

**Last Updated**: February 2, 2026  
**Total Venues**: 270  
**Status**: Ready to use ✅
