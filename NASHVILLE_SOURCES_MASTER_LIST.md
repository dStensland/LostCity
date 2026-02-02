# Nashville Sources - Master Implementation List

Complete list of 150+ event sources to implement for Nashville portal launch.

---

## Phase 1: Foundation (Weeks 1-4) - 25 Sources

### Critical Aggregators (5)

| Source | URL | Type | Events/Mo | Priority | Notes |
|--------|-----|------|-----------|----------|-------|
| Ticketmaster Nashville | app.ticketmaster.com | API | 400+ | P0 | Geo: 36.1627,-86.7816 |
| Eventbrite Nashville | eventbrite.com | API | 300+ | P0 | Location: Nashville, TN |
| Visit Music City | visitmusiccity.com/events | Scrape | 200+ | P0 | Official tourism |
| Nashville Scene | nashvillescene.com/events | Scrape | 250+ | P0 | Alt-weekly |
| Do615 | do615.com/events | Scrape | 300+ | P0 | Local aggregator |

### Iconic Music Venues (15)

| Venue | URL | Events/Mo | Type | Priority | Neighborhood |
|-------|-----|-----------|------|----------|--------------|
| Grand Ole Opry | opry.com/calendar | 30+ | Scrape | P1 | Music Valley |
| Ryman Auditorium | ryman.com/events | 40+ | Scrape | P1 | Downtown |
| Bluebird Cafe | bluebirdcafe.com | 25+ | Scrape | P1 | Green Hills |
| Exit/In | exitin.com | 40+ | Scrape | P1 | Midtown |
| The Basement | thebasementnashville.com | 30+ | Scrape | P1 | Downtown |
| The Basement East | Same as above | 30+ | Scrape | P1 | East Nashville |
| Mercy Lounge | mercylounge.com | 35+ | Scrape | P1 | Downtown |
| 3rd & Lindsley | 3rdandlindsley.com | 30+ | Scrape | P1 | The Gulch |
| Station Inn | stationinn.com | 25+ | Scrape | P1 | The Gulch |
| Brooklyn Bowl Nashville | brooklynbowl.com/nashville | 30+ | Scrape | P1 | Downtown |
| Bridgestone Arena | bridgestonearena.com | 50+ | Scrape | P1 | Downtown |
| Ascend Amphitheater | ascendamphitheater.com | 25+ | Scrape | P1 | Riverfront |
| Marathon Music Works | marathonmusicworks.com | 30+ | Scrape | P1 | Germantown |
| City Winery Nashville | citywinery.com/nashville | 30+ | Scrape | P1 | Germantown |
| The End | theendnashville.com | 25+ | Scrape | P1 | Midtown |

### Major Arts/Culture (5)

| Venue | URL | Events/Mo | Category | Priority |
|-------|-----|-----------|----------|----------|
| TPAC | tpac.org | 60+ | Theater | P1 |
| Schermerhorn Symphony | nashvillesymphony.org | 50+ | Classical | P1 |
| Frist Art Museum | fristartmuseum.org | 40+ | Art | P1 |
| Country Music Hall of Fame | countrymusichalloffame.org | 30+ | Museum | P1 |
| Cheekwood Estate | cheekwood.org | 25+ | Gardens/Art | P1 |

**Phase 1 Total:** 1,450+ events/month from 25 sources

---

## Phase 2: Depth & Expansion (Weeks 5-8) - 60 Sources

### Honky-Tonks (12)

| Venue | Address | Type | Implementation | Priority |
|-------|---------|------|----------------|----------|
| Tootsie's Orchid Lounge | 422 Broadway | Continuous | Generate daily events | P2 |
| Robert's Western World | 416 Broadway | Continuous | Generate daily events | P2 |
| Layla's Bluegrass Inn | 418 Broadway | Continuous | Generate daily events | P2 |
| Acme Feed & Seed | 101 Broadway | Mixed | Scrape + generate | P2 |
| Legends Corner | 428 Broadway | Continuous | Generate daily events | P2 |
| Rippy's | 429 Broadway | Continuous | Generate daily events | P2 |
| The Stage on Broadway | 412 Broadway | Continuous | Generate daily events | P2 |
| Nashville Underground | 105 Broadway | Continuous | Generate daily events | P2 |
| Kid Rock's Big Ass Honky Tonk | 221 Broadway | Continuous | Generate daily events | P2 |
| Luke's 32 Bridge | 301 Broadway | Continuous | Generate daily events | P2 |
| Jason Aldean's Kitchen | 307 Broadway | Continuous | Generate daily events | P2 |
| FGL House | 120 3rd Ave S | Continuous | Generate daily events | P2 |

### Additional Music Venues (18)

| Venue | URL | Events/Mo | Genre Focus | Neighborhood |
|-------|-----|-----------|-------------|--------------|
| Cannery Ballroom | mercylounge.com/cannery | 25+ | Rock/Indie | Downtown |
| The High Watt | mercylounge.com/highwatt | 20+ | Indie | Downtown |
| Listening Room Cafe | listeningroomcafe.com | 25+ | Songwriter | Downtown |
| The Woods at Fontanel | fontaneltn.com | 15+ | Outdoor | North Nashville |
| FirstBank Amphitheater | firstbankamphitheater.com | 20+ | Major acts | Franklin |
| Dee's Country Cocktail Lounge | deescountrylive.com | 20+ | Country/Dive | Madison |
| The Owl Farm | theowlfarmnashville.com | 15+ | Indie | East Nashville |
| Drkmttr | drkmttr.com | 12+ | Electronic | East Nashville |
| Bourbon Street Blues & Boogie | bourbonstblues.com | 20+ | Blues | Downtown |
| Rudy's Jazz Room | rudysjazzroom.com | 20+ | Jazz | Downtown |
| Belcourt Theatre | belcourt.org | 30+ | Film/Music | Hillsboro Village |
| Five Points Pizza | fivepointspizza.com | 15+ | Indie | East Nashville |
| The Crying Wolf | thecryingwolfnashville.com | 12+ | Punk/Indie | East Nashville |
| The 5 Spot | the5spot.club | 15+ | Eclectic | East Nashville |
| Santa's Pub | santaspub.com | 10+ | Karaoke/Dive | South Nashville |
| Douglas Corner Cafe | douglascorner.com | 15+ | Songwriter | Midtown |
| Nashville Palace | nashvillepalace.com | 15+ | Country | Music Valley |
| Wildhorse Saloon | wildhorsesaloon.com | 20+ | Country/Dance | Downtown |

### Breweries & Distilleries (15)

| Venue | URL | Events/Mo | Focus | Neighborhood |
|-------|-----|-----------|-------|--------------|
| Jackalope Brewing | jackalopebrew.com | 8+ | Brewery | Wedgewood-Houston |
| Bearded Iris Brewing | beardedirisbrewing.com | 8+ | Brewery | Germantown |
| Tennessee Brew Works | tnbrew.com | 8+ | Brewery | Downtown |
| Yazoo Brewing | yazoobrew.com | 8+ | Brewery | The Gulch |
| Corsair Distillery | corsairdistillery.com | 6+ | Distillery | Marathon Village |
| Nelson's Green Brier | greenbrierdistillery.com | 6+ | Distillery | Germantown |
| Nearest Green Distillery | nearestgreen.com | 6+ | Distillery | Shelbyville (45min) |
| Smith & Lentz Brewing | smithandlentz.com | 6+ | Brewery | Midtown |
| Black Abbey Brewing | blackabbeybrewing.com | 6+ | Brewery | Germantown |
| Little Harpeth Brewing | littleharpethbrewing.com | 6+ | Brewery | Bellevue |
| Tailgate Brewery | tailgatebeer.com | 8+ | Brewery | Multiple locations |
| Southern Grist Brewing | southerngristbrewing.com | 8+ | Brewery | Multiple locations |
| East Nashville Beer Works | eastnashvillebeerworks.com | 6+ | Brewery | East Nashville |
| Monday Night Brewing Nashville | mondaynightbrewing.com | 6+ | Brewery | The Gulch |
| Fat Bottom Brewing | fatbottombrewing.com | 6+ | Brewery | Inglewood |

### Museums & Cultural (10)

| Venue | URL | Events/Mo | Focus |
|-------|-----|-----------|-------|
| Musicians Hall of Fame | musicianshalloffame.com | 15+ | Music history |
| Johnny Cash Museum | johnnycashmuseum.com | 10+ | Cash memorabilia |
| NMAAM | nmaam.org | 20+ | African American music |
| The Parthenon | nashville.gov/parthenon | 12+ | Art/architecture |
| Tennessee State Museum | tnmuseum.org | 15+ | State history |
| Belmont Mansion | belmontmansion.com | 8+ | Historic home |
| The Hermitage | thehermitage.com | 10+ | Andrew Jackson |
| Belle Meade Historic Site | bellemeadeplantation.com | 10+ | Historic site/winery |
| Adventure Science Center | adventuresci.org | 15+ | Science/family |
| Lane Motor Museum | lanemotormuseum.org | 8+ | Cars |

### Family & Attractions (5)

| Venue | URL | Events/Mo | Category |
|-------|-----|-----------|----------|
| Nashville Zoo | nashvillezoo.org | 20+ | Zoo/family |
| Gaylord Opryland Resort | marriott.com/opryland | 25+ | Resort/holiday |
| Opry Mills Mall | simon.com/oprymills | 15+ | Mall events |
| Grand Ole Golf | grandolegolf.com | 5+ | Mini golf |
| Wave Country | nashville.gov/wavecountry | 8+ | Water park (seasonal) |

**Phase 2 Total:** 800+ events/month from 60 sources
**Cumulative:** 2,250+ events/month from 85 sources

---

## Phase 3: Specialization (Weeks 9-12) - 65 Sources

### Theater & Comedy (10)

| Venue | URL | Events/Mo | Type |
|-------|-----|-----------|------|
| Third Coast Comedy | thirdcoastcomedy.club | 25+ | Comedy |
| Zanies Comedy Night Club | nashville.zanies.com | 30+ | Comedy |
| Nashville Repertory Theatre | nashvillerep.org | 12+ | Theater |
| Nashville Children's Theatre | nashvillechildrenstheatre.org | 15+ | Kids theater |
| Circle Players | circleplayers.net | 10+ | Community theater |
| Actors Bridge Ensemble | actorsbridgeensemble.org | 8+ | Theater |
| OZ Arts Nashville | ozartsnashville.org | 12+ | Contemporary arts |
| Street Theatre Company | streettheatrecompany.org | 8+ | Theater |
| Chaffin's Barn Dinner Theatre | dinnertheatre.com | 12+ | Dinner theater |
| Tennessee Performing Arts Center | tpac.org | 60+ | Broadway (duplicate from P1) |

### Universities (6)

| Institution | URL | Events/Mo | Focus |
|-------------|-----|-----------|-------|
| Vanderbilt University | vanderbilt.edu/events | 50+ | Academic/arts |
| Belmont University | belmont.edu/events | 40+ | Music/arts |
| Tennessee State University | tnstate.edu/events | 25+ | HBCU/cultural |
| Fisk University | fisk.edu/events | 20+ | HBCU/Jubilee Singers |
| Lipscomb University | lipscomb.edu/events | 20+ | Christian university |
| Trevecca Nazarene University | trevecca.edu/events | 15+ | Christian university |

### LGBTQ+ Venues (6)

| Venue | URL | Events/Mo | Type |
|-------|-----|-----------|------|
| Play Dance Bar | playnashville.com | 20+ | Dance club |
| Lipstick Lounge | lipsticklounge.com | 15+ | Lesbian bar |
| Tribe | tribenashville.com | 15+ | Dance club |
| Canvas Lounge & Bar | canvasnashville.com | 12+ | Lounge |
| Friends on Ponce | TBD | 10+ | Bar |
| Woody's Nashville | TBD | 10+ | Bar |

### Sports Venues (4)

| Venue | URL | Events/Mo | Sport |
|-------|-----|-----------|-------|
| Nissan Stadium | titansonline.com | 10+ | NFL (Titans) |
| First Horizon Park | milb.com/nashville | 15+ | Baseball (Sounds) |
| GEODIS Park | nashvillesc.com | 18+ | MLS (Nashville SC) |
| Bridgestone Arena | bridgestonearena.com | 20+ | NHL/Concerts (duplicate) |

### Festivals & Annual Events (10)

| Event | URL | Frequency | Month | Est. Events |
|-------|-----|-----------|-------|-------------|
| CMA Fest | cmafest.com | Annual | June | 100+ |
| AmericanaFest | americanamusic.org | Annual | September | 80+ |
| Nashville Film Festival | nashvillefilmfestival.org | Annual | October | 50+ |
| Tin Pan South | tinpansouth.com | Annual | April | 40+ |
| Music City Hot Chicken Festival | hot-chicken.com | Annual | July | 5+ |
| Tomato Art Fest | tomatoartfest.com | Annual | August | 10+ |
| Nashville Pride | nashvillepride.org | Annual | June | 20+ |
| Southern Festival of Books | humanitiestennessee.org | Annual | October | 30+ |
| Live on the Green | liveonthegreen.net | Seasonal | Sep-Oct | 12+ |
| Musician's Corner | musicianscornernashville.com | Seasonal | May-Sep | 20+ |

### Community & Libraries (15)

| Venue | URL | Events/Mo | Type |
|-------|-----|-----------|------|
| Nashville Public Library Main | library.nashville.org | 40+ | Main branch |
| NPL Green Hills Branch | library.nashville.org/greenhills | 15+ | Branch |
| NPL Bellevue Branch | library.nashville.org/bellevue | 15+ | Branch |
| NPL Madison Branch | library.nashville.org/madison | 12+ | Branch |
| NPL Hermitage Branch | library.nashville.org/hermitage | 12+ | Branch |
| NPL Southeast Branch | library.nashville.org/southeast | 12+ | Branch |
| NPL Edmondson Pike Branch | library.nashville.org/edmondson | 10+ | Branch |
| NPL Donelson Branch | library.nashville.org/donelson | 10+ | Branch |
| NPL Bordeaux Branch | library.nashville.org/bordeaux | 10+ | Branch |
| NPL Hadley Park Branch | library.nashville.org/hadley | 10+ | Branch |
| NPL Richland Park Branch | library.nashville.org/richland | 10+ | Branch |
| NPL Inglewood Branch | library.nashville.org/inglewood | 10+ | Branch |
| NPL Old Hickory Branch | library.nashville.org/oldhickory | 10+ | Branch |
| NPL Pruitt Branch | library.nashville.org/pruitt | 10+ | Branch |
| NPL East Branch | library.nashville.org/east | 10+ | Branch |

### Neighborhood & Food Halls (4)

| Venue | URL | Events/Mo | Type |
|-------|-----|-----------|------|
| The Assembly Food Hall | theassemblyfoodhall.com | 12+ | Food hall |
| Fifth + Broadway | fifthandb.com | 15+ | Mixed-use |
| Nashville Farmers Market | nashvillefarmersmarket.org | 20+ | Market |
| Richland Park Farmers Market | nashville.gov/markets | 10+ | Farmers market |

### Running/Fitness (5)

| Organization | URL | Events/Mo | Type |
|--------------|-----|-----------|------|
| November Project Nashville | november-project.com | 12+ | Free fitness |
| Fleet Feet Nashville | fleetfeetnashville.com | 8+ | Running club |
| The Bluff | thebluff.cc | 6+ | Climbing gym |
| High Gravity | highgravitynashville.com | 6+ | Climbing gym |
| Centennial Sportsplex | nashville.gov/sportsplex | 10+ | Ice rink/sports |

### Neighborhood Associations (5)

| Organization | URL | Events/Mo | Neighborhood |
|--------------|-----|-----------|--------------|
| East Nashville Community Assoc | eastnashville.org | 8+ | East Nashville |
| Germantown Neighborhood Assoc | Historic area | 5+ | Germantown |
| 12South Business Association | 12southnashville.com | 6+ | 12South |
| The Gulch neighborhood group | thegulchnashville.com | 5+ | The Gulch |
| Berry Hill Main Street | berryhillchamber.com | 5+ | Berry Hill |

**Phase 3 Total:** 1,000+ events/month from 65 sources
**Cumulative:** 3,250+ events/month from 150 sources

---

## Summary by Category

| Category | Sources | Events/Mo | % of Total |
|----------|---------|-----------|-----------|
| Music | 55 | 1,500+ | 46% |
| Arts/Culture | 15 | 400+ | 12% |
| Food/Drink | 20 | 300+ | 9% |
| Theater/Comedy | 10 | 250+ | 8% |
| Family | 10 | 200+ | 6% |
| Universities | 6 | 170+ | 5% |
| Community/Libraries | 20 | 300+ | 9% |
| Sports | 4 | 80+ | 2% |
| LGBTQ+ | 6 | 80+ | 2% |
| Other | 4 | 50+ | 2% |
| **Total** | **150** | **3,330+** | **100%** |

---

## Implementation Priority Guide

### P0 (Week 1): 5 Sources
Critical aggregators that provide immediate volume
- Ticketmaster Nashville
- Eventbrite Nashville
- Visit Music City
- Nashville Scene
- Do615

### P1 (Weeks 2-4): 20 Sources
Iconic venues that define Nashville
- Grand Ole Opry
- Ryman Auditorium
- Bluebird Cafe
- Top 15 music venues
- TPAC, Schermerhorn, Frist

### P2 (Weeks 5-8): 60 Sources
Depth and breadth
- 12 honky-tonks
- 18 additional music venues
- 15 breweries/distilleries
- 10 museums
- 5 family attractions

### P3 (Weeks 9-12): 65 Sources
Specialization and long tail
- 10 theater/comedy
- 6 universities
- 6 LGBTQ+ venues
- 15 libraries
- Festivals, neighborhoods, fitness

---

## Nashville-Specific Source Types

### 1. Traditional Scrape
Standard event page scraping (80% of sources)
- Venue websites with /events or /calendar pages
- Museum event calendars
- University event listings

### 2. Continuous Music (Honky-Tonks)
Generate recurring daily events (12 venues)
- No formal event listings
- Live music 11am-2am daily
- Create "Live Music" placeholder events

### 3. API Integration
Structured data from APIs (2 sources)
- Ticketmaster Discovery API
- Eventbrite API

### 4. Festival/Multi-Event
Special handling for multi-day festivals (10 sources)
- CMA Fest (100+ sub-events)
- AmericanaFest (80+ sub-events)
- Enhanced deduplication needed

### 5. Songwriter Rounds
Special format unique to Nashville (5 venues)
- Multiple writers perform acoustically
- "In-the-round" format
- Tag: songwriter-round

---

## Geographic Coverage

### Downtown/Broadway (30 sources)
- 12 honky-tonks
- Ryman, TPAC, Bridgestone
- Museums, theaters

### East Nashville (15 sources)
- The Basement East
- Indie venues, breweries
- Community events

### The Gulch (8 sources)
- Station Inn
- Upscale restaurants/bars

### Germantown (6 sources)
- City Winery
- Marathon Music Works
- Breweries

### Music Valley (5 sources)
- Grand Ole Opry
- Gaylord Opryland

### Other Neighborhoods (86 sources)
- Distributed across 12+ neighborhoods
- Libraries in all areas

---

## Next Steps

1. **Week 1:** Implement P0 sources (5 aggregators)
2. **Week 2:** Add P1 iconic venues (20 venues)
3. **Week 3-4:** Continue P1 + start P2 (honky-tonks)
4. **Week 5-8:** Complete P2 (breweries, museums, family)
5. **Week 9-12:** Add P3 (universities, LGBTQ+, long tail)

**Target:** 150+ sources, 3,300+ events/month by Week 12

---

**For implementation details, see:**
- NASHVILLE_QUICK_START.md (how to build crawlers)
- crawlers/sources/nashville_example.py (code templates)

**Last Updated:** February 2, 2026
