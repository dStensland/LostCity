# Explore Tracks - Quick Fix Priorities

## URGENT Image Gaps (P0)
These venues MUST have images added immediately. They appear on multiple tracks or are major attractions:

1. **Paschal's Restaurant** (ID: 3207)
   - Appears on 3 tracks: Good Trouble, The South Got Something to Say, SpelHouse Spirit
   - Civil rights meeting place, soul food icon
   - Add hero image from: Google Images, Atlanta History Center, or Paschal's website

2. **Zoo Atlanta** (appears 2x)
   - Welcome to Atlanta + Life's Like a Movie
   - 38 upcoming events but no image
   - Source: Zoo Atlanta website hero image

3. **Stone Mountain Park** (appears 2x)
   - Welcome to Atlanta + City in a Forest
   - 851 upcoming events but no image!
   - Source: Stone Mountain Park official site

4. **Truist Park** (ID: find by slug)
   - Keep Swinging track
   - Braves stadium, 66 upcoming events
   - Source: Truist Park / Atlanta Braves website

## Hidden Gem Venues (P1)
Migration-created venues with no images:

5. **Drepung Loseling Monastery** (created 2026-02-11)
   - Appears on 2 tracks: A Beautiful Mosaic, The Midnight Train
   - Has 12 upcoming events but no image
   - Source: drepung.org or Google Images

6. **Westview Cemetery** (created 2026-02-15)
   - Appears on 2 tracks: City in a Forest, The Midnight Train
   - Historic Victorian cemetery
   - Source: westviewcemetery.com or historic photos

7. **Sope Creek Paper Mill Ruins** (created 2026-02-15)
   - Appears on 2 tracks: City in a Forest, The Midnight Train
   - Civil War ruins
   - Source: NPS Chattahoochee River site or Flickr

8. **Jeju Sauna** (created 2026-02-15)
   - A Beautiful Mosaic track
   - Korean spa complex
   - Source: jejusauna.com (NOTE: duplicate entry exists with image - may just need to merge)

## Other Image Gaps (P2)
Single-track appearances but still important:

- Sweet Auburn Curb Market (3 tracks: Good Trouble, The Itis, A Beautiful Mosaic)
- Moonlight at FORTH (Say Less)
- Busy Bee Cafe (2 tracks: The Itis, SpelHouse Spirit)
- Clark Atlanta University (SpelHouse Spirit)
- Plaza Fiesta (A Beautiful Mosaic)
- Atlanta Pride (Too Busy to Hate - needs logo/iconic photo)
- Atlanta Food Truck Park (The Itis)
- Politan Row (The Itis)
- Stackhouse (The Itis)
- The Works Atlanta (The Itis)

## Critical Crawler Gaps (P0)

### Say Less Track - 0% Event Coverage
ALL 7 venues need crawlers (speakeasy/cocktail bar events):
- Red Phone Booth
- Jojo's Beloved
- 12 Cocktail Bar
- Bacchanalia
- Himitsu
- Moonlight at FORTH
- Umi

### Atlanta Icons - Zero Events
- **Clermont Lounge** - Iconic strip club, needs crawler
- **Sister Louisa's Church** - Drag church, bingo nights
- **Magic City** - Hip-hop A&R club
- **Paschal's Restaurant** - Community hub, live music

### Major Theaters - Zero Events
- Alliance Theatre (Tony-winning)
- 7 Stages Theatre
- Theatrical Outfit
- Aurora Theatre
- Shakespeare Tavern
- Whole World Improv

## SQL to Find Image Gaps

```sql
-- Get all venues missing images with track context
SELECT 
  v.id,
  v.name,
  v.slug,
  STRING_AGG(et.slug, ', ') as appears_on_tracks,
  COUNT(DISTINCT et.id) as track_count
FROM venues v
JOIN explore_track_venues etv ON v.id = etv.venue_id
JOIN explore_tracks et ON etv.track_id = et.id
WHERE et.is_active = true
  AND v.hero_image_url IS NULL
  AND v.image_url IS NULL
GROUP BY v.id, v.name, v.slug
ORDER BY COUNT(DISTINCT et.id) DESC, v.name;
```

## Image Sourcing Checklist

1. Check venue's official website for high-res hero images
2. Google Images (filter by usage rights if needed for commercial use)
3. Flickr Creative Commons
4. Unsplash/Pexels for landmarks
5. Atlanta tourism board / Discover Atlanta
6. Wikipedia Commons for historic sites
7. Venue social media (Instagram, Facebook)

## Next Steps

1. Run image sourcing script for top 10 venues
2. Upload images to Supabase storage or CDN
3. Update venues table with image_url or hero_image_url
4. Create crawlers for Say Less track venues
5. Create crawlers for major theaters and nightlife icons
6. Run validation query to confirm fixes

