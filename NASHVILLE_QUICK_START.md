# Nashville Portal - Quick Start Guide

This is a condensed implementation guide for launching the Nashville LostCity portal. For full strategy details, see `NASHVILLE_CONTENT_STRATEGY.md`.

---

## Phase 1: Week 1-2 (Critical Foundation)

### Step 1: Database Setup

```sql
-- Create Nashville portal
INSERT INTO portals (slug, name, tagline, portal_type, status, visibility, filters, branding, settings)
VALUES (
  'nashville',
  'LostCity Nashville',
  'Every show, every night, every neighborhood.',
  'city',
  'active',
  'public',
  '{"city": "Nashville", "geo_center": [36.1627, -86.7816], "geo_radius_km": 40}',
  '{"visual_preset": "nightlife", "primary_color": "#FFD700", "secondary_color": "#8B0000"}',
  '{"show_map": true, "show_categories": true, "default_view": "list"}'
);
```

### Step 2: Adapt Existing Crawlers

**Ticketmaster (Nashville):**
```python
# crawlers/sources/ticketmaster_nashville.py
NASHVILLE_LATLONG = "36.1627,-86.7816"
RADIUS = "25"  # miles
```

**Eventbrite (Nashville):**
```python
# crawlers/sources/eventbrite_nashville.py
LOCATION = "Nashville, TN"
WITHIN = "25mi"
```

### Step 3: Build Priority Crawlers (5)

1. **Visit Music City** (tourism board)
   - URL: `https://www.visitmusiccity.com/events`
   - Type: Scrape
   - Expected: 200+ events/month

2. **Nashville Scene** (alt-weekly)
   - URL: `https://www.nashvillescene.com/events`
   - Type: Scrape
   - Expected: 250+ events/month

3. **Do615** (local aggregator)
   - URL: `https://do615.com/events`
   - Type: Scrape
   - Expected: 300+ events/month

4. **Grand Ole Opry**
   - URL: `https://www.opry.com/calendar`
   - Type: Scrape
   - Expected: 30+ events/month

5. **Ryman Auditorium**
   - URL: `https://www.ryman.com/events`
   - Type: Scrape
   - Expected: 40+ events/month

**Expected Week 2 Results:** 1,200+ events in database

---

## Phase 2: Week 3-4 (Iconic Venues)

### Top 15 Music Venues to Crawl

| Priority | Venue | URL | Category |
|----------|-------|-----|----------|
| 1 | Bluebird Cafe | bluebirdcafe.com | Songwriter rounds |
| 2 | Exit/In | exitin.com | Indie/rock |
| 3 | Brooklyn Bowl | brooklynbowl.com/nashville | Music/bowling |
| 4 | The Basement | thebasementnashville.com | Indie |
| 5 | Station Inn | stationinn.com | Bluegrass |
| 6 | 3rd & Lindsley | 3rdandlindsley.com | Blues/rock |
| 7 | Mercy Lounge | mercylounge.com | Multi-venue |
| 8 | Marathon Music Works | marathonmusicworks.com | Indie/rock |
| 9 | City Winery | citywinery.com/nashville | Wine/music |
| 10 | Bridgestone Arena | bridgestonearena.com | Arena concerts |
| 11 | Ascend Amphitheater | ascendamphitheater.com | Outdoor |
| 12 | Schermerhorn Symphony | nashvillesymphony.org | Classical |
| 13 | TPAC | tpac.org | Broadway/theater |
| 14 | Cannery Ballroom | mercylounge.com/cannery | Large venue |
| 15 | The End | theendnashville.com | Punk/metal |

**Expected Week 4 Results:** 2,000+ events, 50+ venues

---

## Phase 3: Week 5-8 (Depth & Neighborhoods)

### Honky-Tonk Strategy

**Problem:** Most honky-tonks don't post structured events. They have continuous live music 11am-2am daily.

**Solution:** Create recurring "Live Music" events:

```python
# crawlers/sources/honky_tonks.py

HONKY_TONKS = [
    {"name": "Tootsie's Orchid Lounge", "slug": "tootsies", "address": "422 Broadway"},
    {"name": "Robert's Western World", "slug": "roberts-western-world", "address": "416 Broadway"},
    {"name": "Layla's Bluegrass Inn", "slug": "laylas", "address": "418 Broadway"},
    # ... 9 more
]

def create_honky_tonk_events():
    """Generate daily live music events for honky-tonks without formal calendars."""
    for venue in HONKY_TONKS:
        venue_id = get_or_create_venue({
            "name": venue["name"],
            "slug": venue["slug"],
            "address": venue["address"],
            "neighborhood": "Downtown",
            "city": "Nashville",
            "state": "TN",
            "venue_type": "honky_tonk",
            "vibes": ["honky-tonk", "country", "live-music", "no-cover"]
        })

        # Create recurring daily event
        insert_event({
            "title": f"Live Music at {venue['name']}",
            "description": "Continuous live country music featuring rotating artists throughout the day and night.",
            "start_time": "11:00",
            "end_time": "02:00",
            "is_all_day": False,
            "is_recurring": True,
            "recurrence_rule": "FREQ=DAILY",
            "category": "music",
            "subcategory": "country",
            "tags": ["honky-tonk", "live-music", "walk-ins", "no-cover"],
            "is_free": True,
            "venue_id": venue_id,
        })
```

### Neighborhood Focus

**East Nashville (Hipster/Indie):**
- The Basement East
- Five Points Pizza
- The Crying Wolf
- The Lipstick Lounge (LGBTQ+)

**The Gulch (Upscale):**
- Station Inn (bluegrass)
- Acme Feed & Seed

**Germantown (Historic/Foodie):**
- City Winery
- Marathon Music Works

---

## Phase 4: Week 9-12 (Specialization & Launch)

### Key Features to Implement

1. **Nashville-Specific Tags:**
   - `honky-tonk`
   - `songwriter-round`
   - `broadway`
   - `east-nashville`
   - `hot-chicken`

2. **Music Subcategories:**
   - `music.country`
   - `music.americana`
   - `music.bluegrass`
   - `music.songwriter-round`

3. **Featured Sections:**
   - "Tonight on Broadway"
   - "Songwriter Rounds"
   - "East Nashville Picks"

### White-Label Demo

Create a demo portal for hotel partners:

```javascript
// Example: Omni Hotel Nashville
{
  "slug": "omni-nashville",
  "name": "Omni Nashville Events",
  "filters": {
    "geo_center": [36.1590, -86.7779],
    "geo_radius_km": 5,  // 5km radius from hotel
    "categories": ["music", "nightlife", "food_drink"],
    "exclude_categories": ["activism"]
  },
  "settings": {
    "exclude_adult": true,
    "featured_venues": ["ryman", "broadway-honky-tonks"]
  }
}
```

---

## Critical Decisions

### 1. Honky-Tonk Event Strategy

**Option A:** Create daily recurring "Live Music" events for each honky-tonk
- Pros: Shows up in searches, gives users info
- Cons: Lower data quality (not specific acts)

**Option B:** Only show honky-tonks as destinations, not events
- Pros: Higher data quality
- Cons: Users miss continuous music opportunity

**Recommendation:** Option A. Users expect to see "what's happening on Broadway tonight."

### 2. Bachelor/Bachelorette Content

**Question:** Do we promote bachelor/bachelorette activities?

**Recommendation:** Yes, but balanced. Nashville gets 16M+ tourists/year, many for bachelor/bachelorette parties. This is legitimate demand. BUT:
- Balance with locals-focused content
- Prominently feature East Nashville (locals)
- Use tags to let users filter: `tourists` vs `locals`

### 3. Country Music Dominance

**Question:** Will over-indexing on country music alienate non-country fans?

**Recommendation:** Actively curate diversity:
- Feature indie/rock from East Nashville
- Highlight jazz (Rudy's, Bourbon Street Blues)
- Showcase hip-hop at smaller venues
- Include electronic/DJ nights at nightclubs

Target: 60% country/americana, 40% other genres

---

## Success Criteria

**By End of Week 12:**
- [ ] 150+ active crawlers
- [ ] 5,000+ events in database
- [ ] 300+ venues/destinations
- [ ] All major venues covered (top 50)
- [ ] All neighborhoods represented
- [ ] 1 white-label demo deployed
- [ ] Deduplication <5% error rate
- [ ] 90%+ extraction confidence

**By Month 6:**
- [ ] 10,000+ monthly active users
- [ ] 3+ white-label portals live
- [ ] Partnership discussions with Visit Music City
- [ ] Featured in Nashville Scene or Do615

---

## Technical Gotchas

### 1. CMA Fest Deduplication

CMA Fest has 100+ events across 4 days. Without proper deduplication, you'll get:
- Same artist listed 5x (different sources)
- Festival main event + sub-events duplicated

**Solution:** Enhanced content hashing with artist + date + venue.

### 2. Songwriter Rounds

Multiple writers perform at same venue on same night. Each source might list:
- "Songwriter Round at Bluebird"
- "John Smith + Sarah Jones + Mike Williams at Bluebird"
- Same event, different titles

**Solution:** Detect "songwriter round" pattern and create series.

### 3. Broadway Honky-Tonks

12 honky-tonks in 2 blocks, all with live music 11am-2am. High risk of:
- Users overwhelmed by similar events
- "Live Music" spam

**Solution:**
- Create single "Broadway Honky-Tonk Hop" guide/destination
- Individual venues as destinations, not daily events
- Only create events for special occasions (NYE, CMA Fest week)

---

## Quick Reference: Nashville vs Atlanta

| Metric | Atlanta | Nashville | Notes |
|--------|---------|-----------|-------|
| Population | 6M metro | 1.4M metro | Nashville is smaller |
| Venues | 400+ | 300+ target | Higher density/capita in Nash |
| Music % | 25% | 40% target | Nashville is Music City |
| Tourism | 55M/year | 16M/year | Both high, different types |
| Events/month | 8,000+ | 5,000 target | Smaller market |

---

## Next Steps

1. **This Week:**
   - Create Nashville portal in database
   - Clone Ticketmaster/Eventbrite crawlers
   - Research Visit Music City API/structure

2. **Next Week:**
   - Build 3 aggregator scrapers
   - Build Opry + Ryman scrapers
   - Test initial event ingestion

3. **Week 3:**
   - Add top 15 venues
   - Configure Nashville neighborhoods
   - Test honky-tonk continuous event strategy

4. **Month 2:**
   - Full Phase 2 deployment
   - Quality assurance
   - Deduplication tuning

5. **Month 3:**
   - Complete all crawlers
   - Build white-label demo
   - Prepare for soft launch

---

For complete details, see **NASHVILLE_CONTENT_STRATEGY.md**.
