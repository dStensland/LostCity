# Nashville Content Strategy
## LostCity Portal Launch Plan

**Version:** 1.0
**Date:** February 2, 2026
**Target Market:** Nashville, Tennessee (Music City)

---

## Executive Summary

This document outlines the comprehensive content strategy for launching a LostCity portal in Nashville, Tennessee. Nashville presents a unique opportunity given its identity as "Music City USA" and its explosive growth as a cultural destination. The strategy prioritizes music venues, honky-tonks, emerging food culture, and family-friendly attractions while maintaining the platform's core value of comprehensive event discovery.

**Key Metrics:**
- **Target Sources:** 150+ initial event sources
- **Launch Timeline:** 12 weeks (3-month phased rollout)
- **Priority Categories:** Music (40%), Nightlife (20%), Food/Drink (15%), Arts/Culture (15%), Family (10%)
- **Initial Venue Target:** 300+ destinations

---

## 1. Market Analysis

### 1.1 Nashville's Unique Identity

**Music City DNA:**
- Home to Grand Ole Opry, Country Music Hall of Fame
- 180+ live music venues (most per capita in US)
- "Honky-tonk highway" on Broadway
- Growing indie/rock/Americana scene beyond country
- Major music industry presence (labels, publishers, studios)

**Cultural Evolution:**
- Rapid population growth (100k+ new residents since 2020)
- Emerging culinary destination (James Beard recognition)
- Growing arts scene (Frist Art Museum, Cheekwood)
- Tech hub expansion ("Silicon Hills")
- Bachelor/bachelorette party capital

**Demographics:**
- Population: 1.4M metro (Nashville-Davidson-Murfreesboro)
- Median age: 34 (younger than Atlanta)
- High tourism (16M+ visitors/year)
- Strong LGBTQ+ community
- Diverse neighborhoods: East Nashville (hipster), The Gulch (upscale), Germantown (historic)

### 1.2 Competitive Landscape

**Existing Discovery Platforms:**
- NashvilleGuru (tourism focus, outdated UX)
- The Nashville Scene (weekly alt-paper, events section)
- Eventbrite/Ticketmaster (limited local discovery)
- Instagram (@nashville, venue accounts)
- Tourism board (VisitMusicCity.com)

**LostCity Differentiation:**
- AI-powered deduplication (avoid double-listings)
- Hyper-local neighborhood focus
- Non-obvious event discovery
- Community-driven curation
- Portal white-labeling opportunities (hotels, tourism)

---

## 2. Content Sources Strategy

### 2.1 Phase 1: Critical Foundation (Weeks 1-4)

**Priority 1A: Major Aggregators & APIs**
These provide immediate volume and breadth:

| Source | Type | Est. Events/Month | Implementation |
|--------|------|-------------------|----------------|
| Ticketmaster Nashville | API | 400+ | Adapt existing TM crawler, geo: 36.1627,-86.7816, radius 25mi |
| Eventbrite Nashville | API | 300+ | Adapt existing EB crawler, location filter |
| Visit Music City | Scrape | 200+ | Tourism board calendar |
| Nashville Scene Events | Scrape | 250+ | Alternative weekly events |
| Do615 | Scrape | 300+ | Local events aggregator |

**Priority 1B: Iconic Music Venues**
Essential for Nashville's identity:

| Venue | Category | Source Type | Notes |
|-------|----------|-------------|-------|
| Grand Ole Opry | Music | Scrape | opry.com/calendar |
| Ryman Auditorium | Music | Scrape | ryman.com/events |
| Bluebird Cafe | Music | Scrape | bluebirdcafe.com (songwriter rounds) |
| Exit/In | Music | Scrape | exitin.com |
| The Basement | Music | Scrape | thebasementnashville.com |
| The Basement East | Music | Scrape | Separate venue, rebuilt after tornado |
| Mercy Lounge / The High Watt | Music | Scrape | mercylounge.com |
| 3rd & Lindsley | Music | Scrape | 3rdandlindsley.com |
| Station Inn | Music | Scrape | stationinn.com (bluegrass) |
| Brooklyn Bowl Nashville | Music/Food | Scrape | brooklynbowl.com/nashville |

**Priority 1C: Honky-Tonk Row (Broadway)**
Tourist central, high volume:

| Venue | Type | Notes |
|-------|------|-------|
| Tootsie's Orchid Lounge | Honky-tonk | Multiple stages, live all day |
| Robert's Western World | Honky-tonk | Fried bologna sandwiches |
| Layla's Bluegrass Inn | Honky-tonk | 3 floors |
| Acme Feed & Seed | Honky-tonk | Rooftop bar |
| Legends Corner | Honky-tonk | Cash, Jennings memorabilia |
| Rippy's | Honky-tonk | Smoked meats + live music |
| The Stage on Broadway | Honky-tonk | 3 floors, daily lineup |

*Implementation:* Most honky-tonks don't post formal event listings. Strategy: Scrape weekly schedules from individual websites or create recurring "Live Music Daily" placeholder events.

### 2.2 Phase 2: Depth & Diversity (Weeks 5-8)

**Music Venues - Expanded:**

*Amphitheaters & Arenas:*
- Bridgestone Arena (NHL/concerts)
- Ascend Amphitheater (riverfront, summer series)
- The Woods at Fontanel (outdoor, north of city)
- FirstBank Amphitheater (Franklin, suburban)

*Indie/Rock/Alternative:*
- Cannery Ballroom (sister to Mercy Lounge)
- The End (punk, metal, underground)
- Dee's Country Cocktail Lounge (dive, indie)
- The Owl Farm (East Nashville, intimate)
- Drkmttr (experimental, electronic)

*Jazz/Blues:*
- Bourbon Street Blues & Boogie Bar
- Rudy's Jazz Room
- The Listening Room Cafe

*Classical/Performing Arts:*
- Schermerhorn Symphony Center (Nashville Symphony)
- TPAC - Tennessee Performing Arts Center (Broadway tours)
- Belcourt Theatre (indie film + live music)

**Theater & Comedy:**
- Third Coast Comedy Club
- Zanies Comedy Night Club
- Nashville Repertory Theatre
- Nashville Children's Theatre
- Circle Players (community theater)

**Museums & Cultural:**
- Country Music Hall of Fame & Museum
- Frist Art Museum
- Cheekwood Estate & Gardens
- Johnny Cash Museum
- Musicians Hall of Fame
- National Museum of African American Music (NMAAM)
- Parthenon (Centennial Park - yes, full-scale replica)

**Breweries & Distilleries:**
Nashville has 30+ craft breweries:
- Jackalope Brewing Company
- Bearded Iris Brewing
- Smith & Lentz Brewing
- Tennessee Brew Works
- Yazoo Brewing Company
- Corsair Distillery
- Nelson's Green Brier Distillery
- Nearest Green Distillery

**Food Halls & Markets:**
- The Assembly Food Hall
- Fifth + Broadway (mixed-use development)
- Nashville Farmers' Market
- Richland Park Farmers Market

### 2.3 Phase 3: Neighborhoods & Specialization (Weeks 9-12)

**East Nashville:**
The "Brooklyn of Nashville" - hipster, artsy, LGBTQ+ friendly

*Venues:*
- Five Points Pizza (live music)
- The Crying Wolf (dive bar, punk/indie)
- Rosemary & Beauty Queen (cocktail bar)
- Bongo Java East (coffee + community)
- The Lipstick Lounge (lesbian bar)

*Annual Events:*
- Tomato Art Fest (August)
- East Nashville Porchfest

**The Gulch:**
Upscale dining, boutique hotels, young professionals

*Venues:*
- Station Inn (bluegrass - technically Gulch adjacent)
- The Sutler Saloon
- Acme Feed & Seed

**Germantown:**
Historic neighborhood, farm-to-table restaurants

*Venues:*
- City Winery Nashville
- Marathon Music Works (converted auto factory)
- Germantown Cafe

**12South:**
Trendy shopping/dining corridor

*Venues:*
- The Basement East (mentioned above)
- Draper James (Reese Witherspoon's store - occasional events)

**The Nations:**
Up-and-coming west side neighborhood

*Venues:*
- Oz Arts Nashville (contemporary arts)
- Harding House (cocktail bar)

**Family & Kid-Friendly:**
- Nashville Zoo
- Adventure Science Center
- Nashville Children's Theatre
- Gaylord Opryland Resort (holiday events)
- Grand Ole Golf (mini golf)
- Opry Mills Mall (events, holiday displays)

**Sports & Fitness:**
- Nissan Stadium (Tennessee Titans)
- Bridgestone Arena (Nashville Predators)
- Nashville Sounds (AAA baseball) at First Horizon Park
- Nashville SC (MLS) at GEODIS Park
- November Project Nashville (free fitness)
- Fleet Feet Nashville (running club events)

**LGBTQ+ Venues:**
- Play Dance Bar
- Lipstick Lounge
- Tribe
- Canvas Lounge & Bar
- Trax Nashville (closed - check status)

**Universities:**
- Vanderbilt University (Vanderbilt Presents, arts calendar)
- Belmont University (music school events)
- Tennessee State University (HBCU, cultural events)
- Fisk University (historic HBCU, Jubilee Singers)

**Festivals & Annual Events:**
- CMA Fest (June)
- AmericanaFest (September)
- Nashville Film Festival (October)
- Musician's Corner (free summer series at Centennial Park)
- Live on the Green (free concert series)
- Tin Pan South (songwriter festival)
- Tomato Art Fest
- Music City Hot Chicken Festival

**Community Organizations:**
- Nashville Public Library (15 branches, events at each)
- The Contributor (street paper, vendor events)
- Adventure Science Center
- Hands On Nashville (volunteer opportunities)

---

## 3. Data Acquisition Plan

### 3.1 Crawler Implementation Priority

**Week 1-2: Critical Infrastructure**
1. Adapt Ticketmaster crawler (change geo coordinates)
2. Adapt Eventbrite crawler (Nashville location filter)
3. Build Visit Music City scraper
4. Build Nashville Scene scraper
5. Build Do615 scraper

**Week 3-4: Iconic Venues (15 crawlers)**
- Grand Ole Opry
- Ryman Auditorium
- Bluebird Cafe
- Exit/In
- Bridgestone Arena
- Ascend Amphitheater
- Schermerhorn Symphony
- TPAC
- Frist Art Museum
- Country Music Hall of Fame
- Brooklyn Bowl
- City Winery
- Marathon Music Works
- Third Coast Comedy
- Zanies

**Week 5-6: Depth (20 crawlers)**
- All remaining Phase 2 venues
- Top breweries (5)
- Food halls (3)
- Museums (5)

**Week 7-8: Neighborhoods (25 crawlers)**
- East Nashville venues (8)
- The Gulch (4)
- Germantown (3)
- 12South (3)
- Family attractions (7)

**Week 9-10: Specialization (30 crawlers)**
- Universities (4)
- LGBTQ+ venues (4)
- Sports venues (4)
- Smaller music venues (10)
- Bookstores/cafes (8)

**Week 11-12: Long Tail & Polish**
- Neighborhood associations (10)
- Recurring community events (10)
- Seasonal festivals (database entries)
- Quality assurance
- Deduplication tuning

### 3.2 Technical Implementation

**Crawler Templates:**

```python
# crawlers/sources/grand_ole_opry.py
VENUE_DATA = {
    "name": "Grand Ole Opry",
    "slug": "grand-ole-opry",
    "address": "2804 Opryland Drive",
    "neighborhood": "Music Valley",
    "city": "Nashville",
    "state": "TN",
    "zip": "37214",
    "venue_type": "music_venue",
    "website": "https://www.opry.com",
    "vibes": ["historic", "country", "iconic", "legendary"]
}
```

**Geo Coordinates for Nashville:**
```python
NASHVILLE_LATLONG = "36.1627,-86.7816"  # Downtown Nashville
RADIUS = "25"  # miles (covers metro area)
```

**Category Distribution (Nashville-specific):**
- Music: 40% of events (vs. 25% in Atlanta)
- Nightlife: 20% (honky-tonks, bars)
- Food/Drink: 15% (brewery events, food halls)
- Arts/Culture: 10%
- Family: 8%
- Comedy: 5%
- Other: 2%

### 3.3 Data Quality Considerations

**Nashville-Specific Challenges:**

1. **Honky-Tonk Scheduling:**
   - Most don't post formal events
   - Live music is continuous (11am-2am daily)
   - Solution: Create recurring "Live Music" events with band schedules when available

2. **Songwriter Rounds:**
   - Unique to Nashville (Bluebird, Listening Room, etc.)
   - Not traditional concerts
   - Tag appropriately: "songwriter-round", "acoustic", "intimate"

3. **Bachelor/Bachelorette Parties:**
   - Not public events but influence venue availability
   - Focus on public-facing events only

4. **Tourism vs. Local:**
   - Balance Broadway tourist attractions with East Nashville local scene
   - Ensure neighborhood diversity in featured events

5. **Music Industry Events:**
   - Many private (label showcases, industry mixers)
   - Only crawl public-facing events

**Deduplication Challenges:**
- Same artist at multiple venues (tours)
- Festival events (CMA Fest has 100+ events)
- Songwriter rounds (same writers, different venues)

**Solution:** Enhanced content hashing to include venue_id for multi-venue tours.

---

## 4. Venue & Destination Strategy

### 4.1 Venue Curation Priority

**Tier 1: Must-Have (50 venues)**
Iconic Nashville experiences:
- All honky-tonks on Broadway (12)
- Top 15 music venues
- Major museums (8)
- Performing arts centers (3)
- Sports venues (3)
- Top 10 restaurants (Nashville hot chicken, meat-and-3, fine dining)

**Tier 2: Depth (150 venues)**
- All remaining music venues
- Breweries & distilleries
- Neighborhood bars/cafes
- Family attractions
- Universities
- Theaters

**Tier 3: Long Tail (100+ venues)**
- Community centers
- Neighborhood spots
- Specialty venues
- Pop-up spaces

### 4.2 Neighborhood Mapping

Critical for local discovery:

| Neighborhood | Vibe | Key Venues |
|--------------|------|------------|
| Downtown/Broadway | Tourist, honky-tonks | Tootsie's, Ryman, CMHOF |
| The Gulch | Upscale, trendy | Station Inn, Acme |
| East Nashville | Hipster, artsy | Five Points, The End |
| Germantown | Historic, foodie | City Winery, Marathon |
| 12South | Boutique, brunch | Draper James, local cafes |
| Music Row | Industry, studios | Historic RCA Studio B |
| Midtown/Vanderbilt | College, cultural | Belcourt, Vanderbilt |
| Music Valley | Opry, Opryland | Grand Ole Opry |
| Berry Hill | Vintage, eclectic | The Groove, Live Oak |
| The Nations | Up-and-coming | Oz Arts |
| Wedgewood-Houston | Arts district | Zeitgeist Gallery |
| Sylvan Park | Residential, family | McCabe Park, local spots |

### 4.3 Destination Categories

**Music Venues:**
- Honky-tonks (12)
- Concert halls (15)
- Amphitheaters (4)
- Dive bars with music (20)
- Listening rooms (8)
- Jazz clubs (5)

**Food & Drink:**
- Nashville hot chicken (Prince's, Hattie B's, Bolton's)
- Meat-and-3 (Arnold's Country Kitchen, Swett's)
- Breweries (30+)
- Distilleries (10+)
- Food halls (3)
- Iconic restaurants (The Catbird Seat, Husk, etc.)

**Arts & Culture:**
- Museums (10)
- Galleries (Frist, Zeitgeist, etc.)
- Historic sites (Belle Meade, The Hermitage)
- Performing arts (TPAC, Schermerhorn)

**Family:**
- Nashville Zoo
- Adventure Science Center
- Cheekwood
- Gaylord Opryland
- Opry Mills
- Parks (Centennial, Percy Warner)

---

## 5. Organization & Partnership Strategy

### 5.1 Key Organizations to Feature

**Tourism & Promotion:**
- Nashville Convention & Visitors Corp (Visit Music City)
- Nashville Downtown Partnership
- Music City Center (convention center)

**Arts & Culture:**
- Nashville Arts Coalition
- Metro Arts Commission
- Tennessee Arts Commission
- Nashville Symphony
- Nashville Ballet
- Nashville Opera

**Music Industry:**
- Country Music Association (CMA)
- Americana Music Association
- Nashville Songwriters Association International (NSAI)

**Community & Social:**
- Hands On Nashville
- Nashville Public Library
- Adventure Science Center
- Frist Art Museum
- NMAAM (National Museum of African American Music)

**LGBTQ+:**
- Nashville LGBT Chamber of Commerce
- Nashville PRIDE
- OUTMemphis (regional)

**Universities:**
- Vanderbilt University
- Belmont University
- Tennessee State University
- Fisk University

**Neighborhood Associations:**
- East Nashville Community Association
- Germantown Neighborhood Association
- 12South Business Association
- The Gulch neighborhood group

### 5.2 White-Label Partnership Opportunities

**Hotels (Broadway/Downtown):**
- Omni Nashville Hotel
- JW Marriott Nashville
- Thompson Nashville
- The Union Station Hotel
- Gaylord Opryland Resort

**Tourism Board:**
- Visit Music City (official tourism org)
- Could power "Official Nashville Events" portal

**Music Industry:**
- CMA (Country Music Association)
- Portal for "CMA Events" or "Music Industry Calendar"

**Bachelor/Bachelorette Services:**
- Nashville Party Planning companies
- Portal for "Nashville Nightlife & Events"

**Corporate/Business:**
- Nashville Area Chamber of Commerce
- "Business Events in Nashville" portal

---

## 6. Content Categories & Taxonomy

### 6.1 Nashville-Specific Category Adjustments

**Existing Categories (from Atlanta):**
```
music, art, comedy, theater, film, sports, food_drink, nightlife,
community, fitness, family, learning, dance, tours, meetup, words,
religious, markets, wellness, gaming, outdoors, activism, other
```

**Nashville Additions/Emphasis:**

1. **Music Subcategories (critical for Nashville):**
   - music.country
   - music.americana
   - music.bluegrass
   - music.honky-tonk
   - music.songwriter-round
   - music.rock
   - music.indie
   - music.jazz
   - music.blues
   - music.gospel

2. **Nightlife Subcategories:**
   - nightlife.honky-tonk (unique to Nashville)
   - nightlife.dive-bar
   - nightlife.rooftop
   - nightlife.brewery
   - nightlife.distillery

3. **Food/Drink Subcategories:**
   - food_drink.hot-chicken (Nashville-specific)
   - food_drink.meat-and-3 (Southern tradition)
   - food_drink.brunch
   - food_drink.tasting (whiskey, beer)

4. **Tours Subcategories:**
   - tours.music-history
   - tours.distillery
   - tours.brewery
   - tours.walking
   - tours.haunted
   - tours.celebrity-homes

### 6.2 Tag Strategy

**Nashville-Specific Tags:**
- "broadway" (honky-tonk row)
- "music-city"
- "honky-tonk"
- "songwriter"
- "opry"
- "hot-chicken"
- "whiskey"
- "country-music"
- "americana"
- "bluegrass"
- "bachelorette" (controversial but high search volume)
- "tourists" vs "locals" (help users filter)
- "east-nashville"
- "the-gulch"
- "germantown"
- "12south"

**Inherited Tags from Venue Vibes:**
```python
# Example venue vibe tags
VENUE_VIBES = {
    "grand-ole-opry": ["historic", "iconic", "country", "legendary", "tourists"],
    "bluebird-cafe": ["intimate", "songwriter", "acoustic", "reservations-required"],
    "roberts-western-world": ["honky-tonk", "dive", "fried-bologna", "cash-only"],
    "the-basement-east": ["indie", "rock", "east-nashville", "locals"],
    "station-inn": ["bluegrass", "traditional", "no-alcohol", "listening-room"],
}
```

---

## 7. Portal Branding & Experience

### 7.1 Nashville Portal Identity

**Portal Configuration:**
```json
{
  "slug": "nashville",
  "name": "LostCity Nashville",
  "tagline": "Every show, every night, every neighborhood.",
  "portal_type": "city",
  "status": "active",
  "visibility": "public",
  "filters": {
    "city": "Nashville",
    "geo_center": [36.1627, -86.7816],
    "geo_radius_km": 40
  },
  "branding": {
    "visual_preset": "nightlife",
    "primary_color": "#FFD700",
    "secondary_color": "#8B0000",
    "header": {
      "template": "immersive",
      "hero_image": "/nashville-skyline-night.jpg",
      "hero_height": "md"
    },
    "ambient": {
      "effect": "subtle_glow",
      "intensity": "medium"
    }
  },
  "settings": {
    "show_map": true,
    "show_categories": true,
    "default_view": "list",
    "featured_categories": ["music", "nightlife", "food_drink"],
    "meta_description": "Discover live music, honky-tonks, and hidden gems in Nashville. From Broadway to East Nashville, find what's happening tonight."
  }
}
```

**Visual Direction:**
- Neon glow aesthetic (honky-tonk vibes)
- Gold and deep red color palette (country music heritage)
- Emphasis on live music imagery
- Nashville skyline at night

**Featured Sections:**
- "Tonight on Broadway" (honky-tonk listings)
- "Songwriter Rounds" (intimate acoustic shows)
- "East Nashville Picks" (hipster/indie scene)
- "Family-Friendly" (zoo, museums, kids events)
- "This Weekend's Big Shows" (major concerts)

### 7.2 White-Label Opportunities

**Example: Omni Hotel Nashville Portal**

```json
{
  "slug": "omni-nashville",
  "name": "Omni Nashville Events",
  "tagline": "Your guide to Nashville nightlife and entertainment",
  "portal_type": "business",
  "parent_portal_id": "nashville",
  "branding": {
    "visual_preset": "corporate_clean",
    "logo_url": "/omni-logo.png",
    "primary_color": "#003366",
    "header": {
      "template": "branded",
      "nav_style": "minimal"
    }
  },
  "filters": {
    "city": "Nashville",
    "geo_center": [36.1590, -86.7779],
    "geo_radius_km": 5,
    "categories": ["music", "nightlife", "food_drink", "tours"],
    "exclude_categories": ["activism", "meetup"]
  },
  "settings": {
    "featured_venues": ["ryman", "broadway-honky-tonks", "acme"],
    "exclude_adult": true
  }
}
```

**Target White-Label Partners:**
1. **Hotels:** Omni, JW Marriott, Thompson, Gaylord Opryland
2. **Tourism:** Visit Music City official portal
3. **Music Industry:** CMA events calendar
4. **Event Spaces:** Bridgestone Arena, TPAC
5. **Neighborhoods:** East Nashville Association, 12South

---

## 8. Launch Timeline & Milestones

### Week 1-2: Foundation
- [ ] Set up Nashville portal in database
- [ ] Deploy Ticketmaster Nashville crawler
- [ ] Deploy Eventbrite Nashville crawler
- [ ] Build Visit Music City scraper
- [ ] Build Nashville Scene scraper
- [ ] Build Do615 scraper
- **Target:** 500+ events in database

### Week 3-4: Iconic Venues
- [ ] Deploy 15 iconic venue crawlers (Opry, Ryman, Bluebird, etc.)
- [ ] Add 50 Tier 1 venues to destinations
- [ ] Configure Nashville neighborhoods
- [ ] Test deduplication with Broadway honky-tonks
- **Target:** 1,500+ events, 50+ venues

### Week 5-6: Depth
- [ ] Deploy 20 Phase 2 crawlers (museums, breweries, etc.)
- [ ] Add 100 more venues
- [ ] Implement Nashville-specific tags
- [ ] Create honky-tonk "continuous music" events
- **Target:** 2,500+ events, 150+ venues

### Week 7-8: Neighborhoods
- [ ] Deploy 25 neighborhood-focused crawlers
- [ ] Add family attractions
- [ ] Configure East Nashville, Gulch, Germantown portals
- [ ] Quality assurance pass
- **Target:** 3,500+ events, 200+ venues

### Week 9-10: Specialization
- [ ] Deploy 30 specialized crawlers (universities, LGBTQ+, sports)
- [ ] Add all remaining Tier 2/3 venues
- [ ] Configure category-specific views
- [ ] Build white-label demo (hotel partner)
- **Target:** 4,500+ events, 300+ venues

### Week 11-12: Polish & Launch
- [ ] Final QA pass
- [ ] Deduplication tuning (especially festivals)
- [ ] SEO optimization
- [ ] Marketing materials
- [ ] Soft launch to beta users
- [ ] Partnership outreach
- **Target:** 5,000+ events, 350+ venues, 5 white-label partners in discussion

---

## 9. Success Metrics

### 9.1 Content Quality KPIs

**Coverage:**
- 150+ active crawlers
- 300+ venues in database
- 5,000+ events/month
- 95%+ major venue coverage (top 50 venues)
- All neighborhoods represented

**Data Quality:**
- 90%+ extraction confidence
- <5% duplicate event rate
- 85%+ events with images
- 95%+ events with correct categories
- 80%+ events with venue geocoding

**Category Distribution:**
- Music: 35-45% of events
- Nightlife: 15-25%
- Food/Drink: 10-15%
- Arts/Culture: 8-12%
- Family: 5-10%
- Other: <20%

### 9.2 User Engagement Metrics

**Discovery:**
- 70%+ users discover at least 1 non-obvious event
- 40%+ users explore beyond music category
- 50%+ users filter by neighborhood

**Portal Usage:**
- 10k+ monthly active users (Month 6)
- 30k+ page views/month (Month 6)
- 3+ pages/session average
- 60%+ mobile usage

**White-Label:**
- 3+ white-label portals live (Month 12)
- 1+ hotel partner (Month 6)
- Tourism board interest (Month 9)

### 9.3 Competitive Differentiation Metrics

**vs. Nashville Scene:**
- 2x more events listed
- Better mobile experience
- Real-time updates vs. weekly

**vs. Do615:**
- More comprehensive coverage
- Better categorization
- Neighborhood-level filtering

**vs. Eventbrite/Ticketmaster:**
- Include non-ticketed events
- Better local discovery
- Honky-tonk continuous music

---

## 10. Risks & Mitigations

### 10.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Honky-tonk sites lack structured data | Medium | High | Manual recurring event creation; partner with Do615 |
| High deduplication complexity (festivals) | High | Medium | Enhanced content hashing; venue-aware deduplication |
| Venue website changes break crawlers | Medium | High | Circuit breaker pattern; graceful degradation |
| Rate limiting on tourism sites | Low | Medium | Respectful crawling; 1-2s delays between requests |

### 10.2 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Lower engagement than Atlanta | High | Low | Nashville has higher music/event density; tourism boost |
| Competition from Do615 | Medium | Medium | Differentiate on UX, deduplication, white-label |
| Tourism-heavy (seasonal) | Medium | High | Emphasize locals; neighborhood discovery |
| Bachelor party oversaturation | Low | High | Balance Broadway with East Nashville content |

### 10.3 Content Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Over-indexing on country music | Medium | High | Actively feature indie, rock, jazz, hip-hop |
| Missing neighborhood events | High | Medium | Partner with neighborhood associations |
| Broadway tourist trap perception | Medium | Medium | Feature "locals" tag; East Nashville section |
| Private music industry events | Low | Low | Only crawl public-facing events |

---

## 11. Partnership & Revenue Strategy

### 11.1 White-Label Partnership Tiers

**Tier 1: Hotels & Hospitality**
- Target: 5 hotel partners (Year 1)
- Offering: Branded event portal for guest services
- Revenue: $500-2000/month per hotel
- Customization: Hotel branding, geo-filtered to 5mi radius, exclude adult content

**Tier 2: Tourism & Destination Marketing**
- Target: Visit Music City, neighborhood associations
- Offering: Official event calendar powered by LostCity
- Revenue: $5k-15k/month
- Customization: Full white-label, custom domain, API access

**Tier 3: Music Industry & Venues**
- Target: CMA, major venues (Bridgestone, TPAC)
- Offering: Industry event calendar, member-exclusive events
- Revenue: $1k-5k/month
- Customization: Private portals, member authentication

**Tier 4: Corporate & Business**
- Target: Nashville Chamber of Commerce
- Offering: Business networking events calendar
- Revenue: $2k-8k/month
- Customization: B2B focus, networking event emphasis

### 11.2 Content Partnerships

**Nashville Scene:**
- Potential data partnership (they share, we dedupe/enhance)
- Revenue share on tickets sold

**Do615:**
- Competitor but potential collaboration
- Possible acquisition target

**Ticket Platforms:**
- Affiliate revenue on ticket sales
- 5-10% commission on conversions

---

## 12. Next Steps

### Immediate Actions (This Week)
1. Create Nashville portal in database
2. Set up Nashville geo filters (36.1627,-86.7816, 40km)
3. Clone and adapt Ticketmaster crawler for Nashville
4. Clone and adapt Eventbrite crawler for Nashville
5. Research Visit Music City and Nashville Scene data structures

### Week 2-3 Actions
1. Build Visit Music City scraper
2. Build Nashville Scene scraper
3. Build Do615 scraper
4. Manually add top 50 venues to database
5. Configure Nashville neighborhoods

### Month 2 Actions
1. Deploy 15 iconic venue crawlers
2. Build honky-tonk continuous music event generator
3. Test deduplication across similar events
4. Create Nashville-specific tags and categories

### Month 3 Actions
1. Complete all Phase 2 & 3 crawlers
2. Quality assurance and data cleanup
3. Build white-label demo for hotel partner
4. Prepare marketing materials for soft launch

---

## Appendix A: Complete Source List (150+ targets)

### Music Venues (60)

**Major Venues:**
- Grand Ole Opry
- Ryman Auditorium
- Bridgestone Arena
- Ascend Amphitheater
- TPAC (Tennessee Performing Arts Center)
- Schermerhorn Symphony Center
- The Woods at Fontanel
- FirstBank Amphitheater

**Honky-Tonks (12):**
- Tootsie's Orchid Lounge
- Robert's Western World
- Layla's Bluegrass Inn
- Acme Feed & Seed
- Legends Corner
- Rippy's Smokin' Bar & Grill
- The Stage on Broadway
- Nashville Underground
- Kid Rock's Big Ass Honky Tonk & Rock N' Roll Steakhouse
- Luke's 32 Bridge
- Jason Aldean's Kitchen + Rooftop Bar
- FGL House (Florida Georgia Line)

**Club/Concert Venues (20):**
- Exit/In
- The Basement
- The Basement East
- Mercy Lounge
- The High Watt
- Cannery Ballroom
- 3rd & Lindsley
- The End
- Marathon Music Works
- Brooklyn Bowl Nashville
- City Winery Nashville
- The Bluebird Cafe
- The Listening Room Cafe
- Dee's Country Cocktail Lounge
- The Owl Farm
- Drkmttr
- Bourbon Street Blues & Boogie Bar
- Rudy's Jazz Room
- The Station Inn
- Belcourt Theatre

**Neighborhood Bars w/ Music (15):**
- Five Points Pizza (East Nashville)
- The Crying Wolf (East Nashville)
- The Lipstick Lounge (East Nashville)
- Rosemary & Beauty Queen (East Nashville)
- The Sutler Saloon (The Gulch)
- The Groove (Berry Hill)
- Live Oak (Berry Hill)
- The 5 Spot (East Nashville)
- Foobar (East Nashville)
- Santa's Pub (South Nashville)
- Douglas Corner Cafe
- The Local (Germantown)
- Mag's Fireside Lounge
- Springwater Supper Club & Lounge
- Robert's Western World

**Other Music Venues (13):**
- Musician's Corner (Centennial Park - outdoor summer series)
- Nashville Symphony (Schermerhorn)
- Live on the Green (Public Square - free series)
- Cheekwood Estate & Gardens (outdoor concerts)
- The Parthenon (Centennial Park - occasional)
- Vanderbilt University (Blair School of Music)
- Belmont University (various venues)
- Tennessee State University
- Fisk University (Jubilee Hall)
- Nashville Palace
- Nudie's Honky Tonk
- Wildhorse Saloon
- Tin Roof

### Food & Drink (35)

**Breweries (15):**
- Jackalope Brewing Company
- Bearded Iris Brewing
- Smith & Lentz Brewing
- Tennessee Brew Works
- Yazoo Brewing Company
- Black Abbey Brewing Company
- Little Harpeth Brewing
- Tailgate Brewery
- Southern Grist Brewing Company
- East Nashville Beer Works
- New Heights Brewing
- Monday Night Brewing Nashville
- Czann's Brewing
- Honky Tonk Brewing Co
- Fat Bottom Brewing

**Distilleries (10):**
- Corsair Distillery
- Nelson's Green Brier Distillery
- Nearest Green Distillery
- Pennington Distilling Co.
- Diskin Cider
- Short Mountain Distillery
- H Clark Distillery
- Old Glory Distilling Co.
- Ole Smoky Distillery Nashville
- Nashville Craft Distillery

**Food Halls & Markets (5):**
- The Assembly Food Hall
- Fifth + Broadway
- Nashville Farmers' Market
- Richland Park Farmers Market
- Porter Road Butcher

**Notable Restaurants w/ Events (5):**
- The Catbird Seat (tasting menus)
- Husk Nashville
- Rolf and Daughters
- Arnold's Country Kitchen (meat-and-3)
- Swett's Restaurant (soul food)

### Arts & Culture (30)

**Museums (15):**
- Country Music Hall of Fame & Museum
- Frist Art Museum
- Cheekwood Estate & Gardens
- Johnny Cash Museum
- Musicians Hall of Fame & Museum
- National Museum of African American Music (NMAAM)
- The Parthenon
- Tennessee State Museum
- Belmont Mansion
- The Hermitage (Andrew Jackson's home)
- Belle Meade Historic Site & Winery
- RCA Studio B (Historic music studio)
- Adventure Science Center
- Lane Motor Museum
- Nashville Zoo

**Theaters (8):**
- Nashville Repertory Theatre
- Nashville Children's Theatre
- Circle Players
- Actors Bridge Ensemble
- OZ Arts Nashville
- Street Theatre Company
- Chaffin's Barn Dinner Theatre
- People's Branch Theatre

**Galleries (7):**
- Frist Art Museum
- Zeitgeist Gallery (Wedgewood-Houston)
- David Lusk Gallery
- Cumberland Gallery
- Track One (Wedgewood-Houston)
- The Rymer Gallery
- Local Color Gallery

### Comedy & Entertainment (8)

- Third Coast Comedy Club
- Zanies Comedy Night Club
- The Improv at Zanies
- Doyle & Debbie (comedy musical)
- Stand Up Nashville
- Third Coast Comedy
- The Listening Room Cafe (comedy nights)
- Grand Ole Opry (occasional comedy)

### Family & Kids (12)

- Nashville Zoo at Grassmere
- Adventure Science Center
- Nashville Children's Theatre
- Cheekwood Estate & Gardens
- The Parthenon
- Wave Country (water park)
- Opry Mills Mall
- Gaylord Opryland Resort (SoundWaves water park)
- Grand Ole Golf (mini golf)
- Centennial Park
- Edwin Warner Park
- Percy Warner Park

### Sports & Fitness (10)

**Professional Sports:**
- Nissan Stadium (Tennessee Titans - NFL)
- Bridgestone Arena (Nashville Predators - NHL)
- First Horizon Park (Nashville Sounds - AAA baseball)
- GEODIS Park (Nashville SC - MLS)

**Fitness & Recreation:**
- November Project Nashville
- Fleet Feet Nashville (running club)
- The Bluff (climbing gym)
- High Gravity (climbing gym)
- YMCA Nashville locations (5 branches)
- Centennial Sportsplex

### Universities (6)

- Vanderbilt University (VU Presents, Blair School)
- Belmont University (music events)
- Tennessee State University (TSU)
- Fisk University (Jubilee Singers)
- Lipscomb University
- Trevecca Nazarene University

### Community & Libraries (20)

**Nashville Public Library (15 branches):**
- Main Library (Downtown)
- Green Hills Branch
- Bellevue Branch
- Madison Branch
- Hermitage Branch
- Southeast Branch
- Edmondson Pike Branch
- Donelson Branch
- Bordeaux Branch
- Hadley Park Branch
- Richland Park Branch
- Inglewood Branch
- Old Hickory Branch
- Pruitt Branch
- East Branch

**Community Centers (5):**
- Nashville Public Library (system-wide)
- Metro Parks & Recreation (community centers)
- Hands On Nashville
- The Contributor (street newspaper)
- Nashville Farmers' Market

### Festivals & Annual Events (20+)

- CMA Fest (June)
- AmericanaFest (September)
- Nashville Film Festival (October)
- Musician's Corner (free summer series, Centennial Park)
- Live on the Green (free fall concert series)
- Tin Pan South (songwriter festival, April)
- Tomato Art Fest (East Nashville, August)
- Music City Hot Chicken Festival (July)
- Nashville Pride Festival (June)
- Southern Festival of Books (October)
- Nashville Jazz Workshop events
- Frist Friday (Wedgewood-Houston art crawl)
- East Nashville Porchfest
- Belmont Fall Festival
- Nashville Shakespeare Festival (Centennial Park)
- Nashville Film Festival
- NashvilleMusicGuide.com
- Do615 Events
- Nashville Scene Events

---

## Appendix B: Crawler Technical Specifications

### B.1 Nashville Geo Configuration

```python
# Geographic settings for Nashville crawlers
NASHVILLE_CONFIG = {
    "city": "Nashville",
    "state": "TN",
    "geo_center": [36.1627, -86.7816],  # Downtown Nashville
    "geo_radius_km": 40,  # Covers metro area

    # Ticketmaster API settings
    "ticketmaster_latlong": "36.1627,-86.7816",
    "ticketmaster_radius": "25",  # miles
    "ticketmaster_metro_id": "258",  # Nashville DMA

    # Eventbrite settings
    "eventbrite_location": "Nashville, TN",
    "eventbrite_within": "25mi",
}
```

### B.2 Category Mapping (Nashville Priority)

```python
NASHVILLE_CATEGORY_WEIGHTS = {
    "music": 0.40,  # Higher than Atlanta (0.25)
    "nightlife": 0.20,
    "food_drink": 0.15,
    "arts": 0.10,
    "family": 0.08,
    "comedy": 0.05,
    "other": 0.02
}
```

### B.3 Honky-Tonk Continuous Event Strategy

```python
# For honky-tonks without formal event listings
def create_continuous_music_event(venue_data, date):
    """
    Create a daily 'Live Music' event for honky-tonks.
    These venues have music from 11am-2am daily but don't post individual shows.
    """
    return {
        "title": f"Live Music at {venue_data['name']}",
        "description": f"Continuous live country music featuring rotating artists. {venue_data['name']} features live performances throughout the day and night. Check venue website or social media for today's lineup.",
        "start_date": date,
        "start_time": "11:00",
        "end_date": date,
        "end_time": "02:00",
        "is_all_day": False,
        "category": "music",
        "subcategory": "country",
        "tags": ["honky-tonk", "live-music", "country", "walk-ins", "no-cover"],
        "is_free": True,  # Most honky-tonks have no cover
        "is_recurring": True,
        "recurrence_rule": "FREQ=DAILY",
        "confidence": 0.70  # Lower confidence since not from explicit listing
    }
```

### B.4 Deduplication Strategy

```python
# Enhanced content hashing for Nashville
def generate_nashville_content_hash(title, venue_name, start_date, artist_name=None):
    """
    Nashville-specific hashing to handle:
    - Same artist, different venues (tours)
    - Songwriter rounds (same writers, different nights)
    - Festival events (hundreds of sub-events)
    """
    # Include artist name if available (for songwriter rounds)
    if artist_name:
        return hashlib.md5(
            f"{title}:{artist_name}:{venue_name}:{start_date}".lower().encode()
        ).hexdigest()

    # Standard hash for other events
    return hashlib.md5(
        f"{title}:{venue_name}:{start_date}".lower().encode()
    ).hexdigest()
```

---

## Appendix C: Sample Crawler Implementations

### C.1 Grand Ole Opry Crawler

```python
"""
Crawler for Grand Ole Opry (opry.com).
The most iconic music venue in Nashville.
"""

from __future__ import annotations
import logging
from datetime import datetime
from typing import Optional
import requests
from bs4 import BeautifulSoup

from db import get_or_create_venue, insert_event, find_event_by_hash
from dedupe import generate_content_hash
from utils import slugify

logger = logging.getLogger(__name__)

BASE_URL = "https://www.opry.com"
EVENTS_URL = f"{BASE_URL}/calendar"

VENUE_DATA = {
    "name": "Grand Ole Opry",
    "slug": "grand-ole-opry",
    "address": "2804 Opryland Drive",
    "neighborhood": "Music Valley",
    "city": "Nashville",
    "state": "TN",
    "zip": "37214",
    "lat": 36.2068,
    "lng": -86.6920,
    "venue_type": "music_venue",
    "website": BASE_URL,
    "vibes": ["historic", "country", "iconic", "legendary", "opry"]
}

def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Grand Ole Opry events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    venue_id = get_or_create_venue(VENUE_DATA)

    # Opry typically has structured event data
    # Implementation would parse their calendar page
    # This is a simplified example

    logger.info(f"Grand Ole Opry crawler complete: {events_found} found")
    return events_found, events_new, events_updated
```

### C.2 Nashville Scene Events Crawler

```python
"""
Crawler for Nashville Scene events calendar.
Alternative weekly newspaper - comprehensive local events.
"""

from __future__ import annotations
import logging
from datetime import datetime
import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

BASE_URL = "https://www.nashvillescene.com"
EVENTS_URL = f"{BASE_URL}/events"

def crawl(source: dict) -> tuple[int, int, int]:
    """Crawl Nashville Scene events."""
    source_id = source["id"]
    events_found = 0
    events_new = 0
    events_updated = 0

    # Nashville Scene has a structured events section
    # Would parse their event listings

    logger.info(f"Nashville Scene crawler complete: {events_found} found")
    return events_found, events_new, events_updated
```

---

**END OF DOCUMENT**

*This content strategy is a living document and will be updated as the Nashville portal evolves.*
