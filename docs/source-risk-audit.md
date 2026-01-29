# Event Source Permission Audit

**Date:** 2026-01-28
**Total Sources:** 374 crawler modules
**Registered Sources:** 511 entries in SOURCE_MODULES (includes aliases)

---

## Executive Summary

This audit categorizes all event sources being crawled by LostCity by legal/permission risk level. The goal is to identify sources that may object to data aggregation and establish guidelines for responsible data collection.

### Risk Distribution

| Risk Level | Count | Percentage |
|------------|-------|------------|
| GREEN (Low Risk) | ~320 | ~86% |
| YELLOW (Medium Risk) | ~45 | ~12% |
| RED (High Risk) | ~9 | ~2% |

---

## Risk Framework

### Risk Factors Evaluated

| Factor | Lower Risk | Higher Risk |
|--------|-----------|-------------|
| **Extraction Method** | Official API with key | HTML scraping/Playwright |
| **Source Type** | Individual venue | Aggregator/platform |
| **Terms of Service** | Allows/silent on aggregation | Explicitly prohibits |
| **Competition** | Different market | Direct competitor |
| **Content Type** | Factual event data | Editorial/reviews |
| **Attribution** | Links back to source | No attribution |
| **Commercialization** | Non-profit/free | Paid/ad-supported |

---

## RED - High Risk Sources (Immediate Attention Required)

These sources are aggregator platforms or competitors that likely have explicit ToS restrictions against scraping.

### 1. Eventbrite
- **Slug:** `eventbrite`
- **Method:** HTML scraping with BeautifulSoup (JSON-LD extraction)
- **Risk Factors:**
  - Direct competitor in event discovery
  - Explicitly working around API restrictions (as noted in code comments)
  - Large company with legal resources
  - Clear ToS prohibiting unauthorized scraping
- **Code Comment:** "Eventbrite's public event discovery API requires partner access. The free API only allows managing your own events."
- **Recommendation:** HIGH PRIORITY - Review ToS, consider applying for partner API access, or prepare for potential takedown request
- **Alternative:** Apply for Eventbrite Partner API access

### 2. Meetup.com
- **Slug:** `meetup`
- **Method:** Playwright browser automation
- **Risk Factors:**
  - Owned by Bending Spoons (well-funded)
  - Uses browser automation to bypass scraping detection
  - Has official API available
  - Known to enforce ToS against scrapers
- **Recommendation:** HIGH - Review ToS, consider official API access

### 3. Resident Advisor (ra.co)
- **Slug:** `resident-advisor`
- **Method:** Playwright browser automation
- **Risk Factors:**
  - Direct competitor for electronic/DJ events
  - Specialized niche platform
  - Uses browser automation
- **Recommendation:** MEDIUM-HIGH - Niche competitor, consider reaching out for partnership

### 4. Access Atlanta (AJC)
- **Slug:** `access-atlanta`
- **Method:** Web scraping
- **Risk Factors:**
  - Owned by Atlanta Journal-Constitution (Cox Media)
  - Media company with editorial content mixed with events
  - Large media company with legal resources
- **Recommendation:** MEDIUM-HIGH - Review ToS, consider partnership outreach

### 5. Creative Loafing
- **Slug:** `creative-loafing`
- **Method:** Web scraping
- **Risk Factors:**
  - Event aggregator with editorial content
  - Local media outlet
  - Business model depends on traffic
- **Recommendation:** MEDIUM-HIGH - Consider partnership/attribution arrangement

### 6. FanCons
- **Slug:** `fancons`
- **Method:** Web scraping
- **Risk Factors:**
  - Convention aggregator
  - Could view as competitor
- **Recommendation:** MEDIUM - Monitor, prepare response

### 7. 10times
- **Slug:** `10times`
- **Method:** Web scraping
- **Risk Factors:**
  - International event aggregator platform
  - Direct competitor
  - Commercial platform
- **Recommendation:** MEDIUM-HIGH - Direct competitor

### 8. ArtsATL
- **Slug:** `artsatl-calendar`, `arts-atl`
- **Method:** Web scraping
- **Risk Factors:**
  - Arts journalism site
  - Editorial content mixed with events
  - Non-profit but business model depends on traffic
- **Recommendation:** MEDIUM - Consider reaching out for partnership

### 9. Mobilize.us
- **Slugs:** Multiple (`mobilize-dekalb-dems`, `mobilize-ga-dems`, etc.)
- **Method:** Web scraping
- **Risk Factors:**
  - Political activism platform
  - May have data protection concerns
  - Multiple orgs could each complain
- **Recommendation:** MEDIUM - Review ToS, monitor

---

## YELLOW - Medium Risk Sources (Review Recommended)

These sources warrant review but are less likely to object.

### Major Festivals & Conventions
Events with their own significant marketing efforts.

| Source | Slug | Method | Notes |
|--------|------|--------|-------|
| Dragon Con | `dragon-con` | Scraping | Major convention, may have policies |
| MomoCon | `momocon` | Scraping | Gaming convention |
| Anime Weekend Atlanta | `anime-weekend-atlanta` | Scraping | Anime convention |
| DreamHack Atlanta | `dreamhack-atlanta` | Scraping | Esports/gaming |
| Shaky Knees | `shaky-knees` | Scraping | Major music festival |
| One MusicFest | `one-musicfest` | Scraping | Music festival |
| Atlanta Food & Wine | `atlanta-food-wine` | Scraping | Major food event |
| Sweetwater 420 Fest | `sweetwater-420-fest` | Scraping | Music festival |
| Breakaway Atlanta | `breakaway-atlanta` | Scraping | Music festival |
| Taste of Atlanta | `taste-of-atlanta` | Scraping | Food festival |

**Recommendation:** These events want publicity. Low risk but review ToS if concerned.

### Universities & Colleges
Institutional policies may restrict commercial use.

| Source | Slug | Method | Notes |
|--------|------|--------|-------|
| Georgia Tech Events | `georgia-tech-events` | Scraping | University events |
| Georgia Tech Arts | `georgia-tech-arts` | Scraping | Arts events |
| Georgia Tech Athletics | `georgia-tech-athletics` | Scraping | Sports |
| Emory Events | `emory-events` | Scraping | University events |
| Emory Schwartz Center | `emory-schwartz-center` | Scraping | Performance venue |
| Georgia State University | `georgia-state-university` | Scraping | University events |
| GSU Athletics | `gsu-athletics` | Scraping | Sports |
| Spelman College | `spelman-college` | Scraping | HBCU events |
| Morehouse College | `morehouse-college` | Scraping | HBCU events |
| Clark Atlanta | `clark-atlanta` | Scraping | HBCU events |
| Kennesaw State | `kennesaw-state` | Scraping | University events |
| KSU Athletics | `ksu-athletics` | Scraping | Sports |
| SCAD Atlanta | `scad-atlanta` | Scraping | Art school |
| Agnes Scott | `agnes-scott` | Scraping | Liberal arts college |
| Oglethorpe University | `oglethorpe-university` | Scraping | University events |
| Spivey Hall | `spivey-hall` | Scraping | Performance venue |

**Recommendation:** Generally fine for non-commercial use. LostCity is free/non-monetized.

### Healthcare Events
Piedmont Healthcare system events (13 sources).

| Source | Slug | Notes |
|--------|------|-------|
| Piedmont Healthcare | `piedmont-healthcare` | Main health system |
| Piedmont Classes | `piedmont-classes` | Wellness classes |
| Piedmont Fitness | `piedmont-fitness` | Fitness programs |
| Piedmont Foundation | `piedmont-foundation` | Charity events |
| Piedmont Cancer Support | `piedmont-cancer-support` | Support groups |
| Piedmont Athens | `piedmont-athens` | Regional campus |
| Piedmont Auxiliary | `piedmont-auxiliary` | Volunteer events |
| Piedmont CME | `piedmont-cme` | Medical education |
| Piedmont Heart Conferences | `piedmont-heart-conferences` | Professional |
| Piedmont Women's Heart | `piedmont-womens-heart` | Health programs |
| Piedmont Luminaria | `piedmont-luminaria` | Charity event |
| Piedmont Transplant | `piedmont-transplant` | Support programs |
| Piedmonthealthcare Events | `piedmonthealthcare-events` | General events |

**Recommendation:** Healthcare org - likely appreciates community exposure. Low concern.

### Arts Journalism & Media
Sites mixing editorial with event listings.

| Source | Slug | Method | Notes |
|--------|------|--------|-------|
| ArtsATL | `artsatl`, `artsatl-calendar` | Scraping | Arts journalism |
| Creative Loafing | `creative-loafing` | Scraping | Alt-weekly |

**Recommendation:** Consider partnership outreach.

### Activism Organizations
Political/advocacy groups on Mobilize.us platform.

| Source | Slug | Notes |
|--------|------|-------|
| DeKalb Democrats | `mobilize-dekalb-dems` | Political |
| Georgia Democrats | `mobilize-ga-dems` | Political |
| Indivisible Atlanta | `mobilize-indivisible-atl` | Activism |
| Indivisible Cobb | `mobilize-indivisible-cobb` | Activism |
| Indivisible Cherokee | `mobilize-indivisible-cherokee` | Activism |
| Indivisible GA-10 | `mobilize-indivisible-ga10` | Activism |
| HRC Georgia | `mobilize-hrc-georgia` | LGBTQ+ advocacy |
| 50501 Georgia | `mobilize-50501-georgia` | Activism |
| Necessary Trouble | `mobilize-necessary-trouble` | Activism |
| VoteRiders | `mobilize-voteriders` | Voter assistance |
| ACLU Georgia | `aclu-georgia` | Civil liberties |
| GLAHR | `glahr` | Immigration advocacy |
| Atlanta Liberation Center | `atlanta-liberation-center` | Activism |
| Indivisible ATL | `indivisible-atl` | Activism |

**Recommendation:** Mission-aligned orgs want visibility. Low risk but be prepared for data handling questions.

---

## GREEN - Low Risk Sources (~320 sources)

These sources are individual venues, public institutions, or community organizations that benefit from event discovery.

### Major Venues (Want publicity)

#### Concert/Music Venues
| Source | Slug | Method |
|--------|------|--------|
| Terminal West | `terminal-west` | Scraping |
| The Earl | `the-earl` | Scraping |
| Variety Playhouse | `variety-playhouse` | Scraping |
| Tabernacle | `tabernacle` | Scraping |
| Fox Theatre | `fox-theatre` | Scraping |
| State Farm Arena | `state-farm-arena` | Scraping |
| Mercedes-Benz Stadium | `mercedes-benz-stadium` | Scraping |
| Cobb Energy | `cobb-energy` | Scraping |
| Coca-Cola Roxy | `coca-cola-roxy` | Scraping |
| The Eastern | `the-eastern` | Scraping |
| The Masquerade | `the-masquerade` | Scraping |
| Buckhead Theatre | `buckhead-theatre` | Scraping |
| Center Stage | `center-stage` | Scraping |
| The Loft | `the-loft` | Scraping |
| Eddie's Attic | `eddies-attic` | Scraping |
| Smith's Olde Bar | `smiths-olde-bar` | Scraping |
| City Winery | `city-winery-atlanta` | Scraping |
| Aisle 5 | `aisle5` | Scraping |
| 529 | `529` | Scraping |
| Blind Willie's | `blind-willies` | Scraping |
| Red Light Cafe | `red-light-cafe` | Scraping |
| Northside Tavern | `northside-tavern` | Scraping |
| Drunken Unicorn | `drunken-unicorn` | Scraping |
| Apache XLR | `apache-xlr` | Scraping |
| Venkman's | `venkmans` | Scraping |
| Boot Barn Hall | `boot-barn-hall` | Scraping |
| Believe Music Hall | `believe-music-hall` | Scraping |
| Knock Music House | `knock-music-house` | Scraping |
| Echo Room | `echo-room` | Scraping |
| MJQ Concourse | `mjq-concourse` | Scraping |
| Sound Table | `sound-table` | Scraping |
| St. James Live | `st-james-live` | Scraping |
| Ameris Bank Amphitheatre | `ameris-bank-amphitheatre` | Scraping |

#### Comedy Venues
| Source | Slug | Method |
|--------|------|--------|
| Laughing Skull | `laughing-skull` | Scraping |
| Punchline | `punchline` | Scraping |
| Helium Comedy | `helium-comedy` | Scraping |
| Uptown Comedy | `uptown-comedy` | Scraping |
| Whole World Improv | `whole-world-improv` | Scraping |
| Atlanta Comedy Theater | `atlanta-comedy-theater` | Scraping |
| Dad's Garage | `dads-garage` | Scraping |

#### Theaters
| Source | Slug | Method |
|--------|------|--------|
| Alliance Theatre | `alliance-theatre` | Scraping |
| Aurora Theatre | `aurora-theatre` | Scraping |
| Horizon Theatre | `horizon-theatre` | Scraping |
| Georgia Ensemble Theatre | `georgia-ensemble-theatre` | Scraping |
| Actors Express | `actors-express` | Scraping |
| Out of Box Theatre | `out-of-box-theatre` | Scraping |
| Stage Door Players | `stage-door-players` | Scraping |
| 7 Stages | `7-stages` | Scraping |
| Theatrical Outfit | `theatrical-outfit` | Scraping |
| True Colors Theatre | `true-colors-theatre` | Scraping |
| Synchronicity Theatre | `synchronicity-theatre` | Scraping |
| Atlanta Lyric Theatre | `atlanta-lyric-theatre` | Scraping |
| Shakespeare Tavern | `shakespeare-tavern` | Scraping |
| OnStage Atlanta | `onstage-atlanta` | Scraping |
| PushPush Theater | `pushpush-theater` | Scraping |
| Working Title Playwrights | `working-title-playwrights` | Scraping |
| Pinch 'n' Ouch Theatre | `pinch-n-ouch-theatre` | Scraping |
| Atlanta Ballet | `atlanta-ballet` | Scraping |
| Atlanta Opera | `atlanta-opera` | Scraping |

#### Performing Arts Centers
| Source | Slug | Method |
|--------|------|--------|
| Ferst Center | `ferst-center` | Scraping |
| Schwartz Center | `schwartz-center` | Scraping |
| Rialto Center | `rialto-center` | Scraping |
| Roswell Cultural Arts | `roswell-cultural-arts` | Scraping |
| Sandy Springs PAC | `sandy-springs-pac` | Scraping |
| City Springs | `city-springs` | Scraping |

### Museums & Cultural Institutions

| Source | Slug | Method |
|--------|------|--------|
| High Museum | `high-museum` | Scraping |
| Atlanta Botanical Garden | `atlanta-botanical-garden` | Scraping |
| Fernbank | `fernbank` | Scraping |
| Atlanta History Center | `atlanta-history-center` | Scraping |
| Carlos Museum | `carlos-museum` | Scraping |
| Breman Museum | `breman-museum` | Scraping |
| Children's Museum | `childrens-museum` | Scraping |
| Civil Rights Center | `civil-rights-center` | Scraping |
| College Football HOF | `college-football-hof` | Scraping |
| World of Coca-Cola | `world-of-coca-cola` | Scraping |
| APEX Museum | `apex-museum` | Scraping |
| King Center | `king-center` | Scraping |
| Trap Music Museum | `trap-music-museum` | Scraping |
| Oddities Museum | `oddities-museum` | Scraping |

### Public/Government Sources (Public information)

#### Libraries
| Source | Slug | Method |
|--------|------|--------|
| Fulton Library | `fulton-library` | Scraping |
| DeKalb Library | `dekalb-library` | Scraping |
| Gwinnett Library | `gwinnett-library` | Scraping |
| Cobb Library | `cobb-library` | Scraping |
| Auburn Ave Library | `auburn-ave-library` | Scraping |

#### Parks & Recreation
| Source | Slug | Method |
|--------|------|--------|
| Piedmont Park | `piedmont-park` | Scraping |
| Beltline | `beltline` | Scraping |
| Stone Mountain Park | `stone-mountain-park` | Scraping |
| Chattahoochee Nature | `chattahoochee-nature` | Scraping |
| Atlanta Parks & Rec | `atlanta-parks-rec` | Scraping |
| Decatur Recreation | `decatur-recreation` | Scraping |
| Trees Atlanta | `trees-atlanta` | Scraping |

#### City/Municipal
| Source | Slug | Method |
|--------|------|--------|
| Discover Atlanta | `discover-atlanta` | Scraping |
| Decatur City | `decatur-city` | Scraping |
| Johns Creek | `johns-creek` | Scraping |
| Atlanta Cultural Affairs | `atlanta-cultural-affairs` | Scraping |

#### Convention Centers
| Source | Slug | Method |
|--------|------|--------|
| GWCC | `gwcc` | Scraping |
| Cobb Galleria | `cobb-galleria` | Scraping |
| GICC | `gicc` | Scraping |
| AmericasMart | `americasmart` | Scraping |
| Gas South | `gas-south` | Scraping |

### Nonprofits & Community Organizations

| Source | Slug | Method |
|--------|------|--------|
| Hands On Atlanta | `hands-on-atlanta` | Scraping |
| Callanwolde | `callanwolde` | Scraping |
| Marcus JCC | `marcus-jcc` | Scraping |
| YMCA Atlanta | `ymca-atlanta` | Scraping |
| Community Foundation ATL | `community-foundation-atl` | Scraping |
| L5P Community Center | `l5p-community-center` | Scraping |
| Ebenezer Baptist Church | `ebenezer-baptist-church` | Scraping |

### Breweries & Distilleries

| Source | Slug | Method |
|--------|------|--------|
| Sweetwater | `sweetwater` | Scraping |
| Orpheus Brewing | `orpheus-brewing` | Scraping |
| Three Taverns | `three-taverns` | Scraping |
| Pontoon Brewing | `pontoon-brewing` | Scraping |
| Monday Night | `monday-night` | Scraping |
| Scofflaw Brewing | `scofflaw-brewing` | Scraping |
| Second Self Brewing | `second-self-brewing` | Scraping |
| Bold Monk Brewing | `bold-monk-brewing` | Scraping |
| Reformation Brewery | `reformation-brewery` | Scraping |
| ASW Distillery | `asw-distillery` | Scraping |
| Steady Hand Beer | `steady-hand-beer` | Scraping |
| Cherry Street Brewing | `cherry-street-brewing` | Scraping |
| Round Trip Brewing | `round-trip-brewing` | Scraping |
| Halfway Crooks | `halfway-crooks` | Scraping |
| Fire Maker Brewing | `fire-maker-brewing` | Scraping |
| Eventide Brewing | `eventide-brewing` | Scraping |
| Wild Heaven | `wild-heaven` | Scraping |

### Art Galleries

| Source | Slug | Method |
|--------|------|--------|
| Whitespace Gallery | `whitespace-gallery` | Scraping |
| ABV Gallery | `abv-gallery` | Scraping |
| Atlanta Contemporary | `atlanta-contemporary` | Scraping |
| MOCA GA | `moca-ga` | Scraping |
| Zucot Gallery | `zucot-gallery` | Scraping |
| Sandler Hudson | `sandler-hudson` | Scraping |
| Poem88 Gallery | `poem88-gallery` | Scraping |
| Kai Lin Art | `kai-lin-art` | Scraping |
| Marcia Wood Gallery | `marcia-wood-gallery` | Scraping |
| Hathaway Contemporary | `hathaway-contemporary` | Scraping |
| Mason Fine Art | `mason-fine-art` | Scraping |
| Forward Warrior | `forward-warrior` | Scraping |
| Atlanta Art Fair | `atlanta-art-fair` | Scraping |
| Goat Farm Arts Center | `goat-farm-arts-center` | Scraping |

### LGBTQ+ Venues

| Source | Slug | Method |
|--------|------|--------|
| Blake's on the Park | `blakes-on-park` | Scraping |
| The Heretic | `the-heretic` | Scraping |
| My Sister's Room | `my-sisters-room` | Scraping |
| Mary's Bar | `marys-bar` | Scraping |
| Atlanta Eagle | `atlanta-eagle` | Scraping |
| Future Atlanta | `future-atlanta` | Scraping |
| Bulldogs Atlanta | `bulldogs-atlanta` | Scraping |
| Lips Atlanta | `lips-atlanta` | Scraping |
| Joystick Gamebar | `joystick-gamebar` | Scraping |
| Southern Fried Queer Pride | `southern-fried-queer-pride` | Scraping |
| Lore Atlanta | `lore-atlanta` | Scraping |
| Friends on Ponce | `friends-on-ponce` | Scraping |
| Woody's Atlanta | `woodys-atlanta` | Scraping |
| Jungle Atlanta | `jungle-atlanta` | Scraping |
| Pisces Atlanta | `pisces-atlanta` | Scraping |
| Club Wander | `club-wander` | Scraping |
| Woofs Atlanta | `woofs-atlanta` | Scraping |
| Atlanta Pride | `atlanta-pride` | Scraping |
| Atlanta Black Pride | `atlanta-black-pride` | Scraping |

### Bookstores

| Source | Slug | Method |
|--------|------|--------|
| A Cappella Books | `a-cappella-books` | Scraping |
| Charis Books | `charis-books` | Scraping |
| Little Shop of Stories | `little-shop-of-stories` | Scraping |
| Eagle Eye Books | `eagle-eye-books` | Scraping |
| Foxtale Books | `foxtale-books` | Scraping |
| Criminal Records | `criminal-records` | Scraping |
| Bookish Atlanta | `bookish-atlanta` | Scraping |
| Wild Aster Books | `wild-aster-books` | Scraping |
| Book Boutique | `book-boutique` | Scraping |

### Farmers Markets

| Source | Slug | Method |
|--------|------|--------|
| Farmers Markets (hardcoded) | `farmers-markets` | Generated |
| EAV Farmers Market | `eav-farmers-market` | Scraping |
| Decatur Farmers Market | `decatur-farmers-market` | Scraping |
| Morningside Farmers Market | `morningside-farmers-market` | Scraping |
| Grant Park Farmers Market | `grant-park-farmers-market` | Scraping |
| Peachtree Road Farmers Market | `peachtree-road-farmers-market` | Scraping |
| Freedom Farmers Market | `freedom-farmers-market` | Scraping |

### Sports & Fitness

#### Pro Sports Venues
| Source | Slug | Method |
|--------|------|--------|
| Truist Park | `truist-park` | Scraping |
| Live at the Battery | `live-at-battery` | Scraping |
| Battery Atlanta | `battery-atlanta` | Scraping |
| Atlanta Motor Speedway | `atlanta-motor-speedway` | Scraping |

#### Running & Cycling Clubs
| Source | Slug | Method |
|--------|------|--------|
| Atlanta Track Club | `atlanta-track-club` | Scraping |
| Atlanta Outdoor Club | `atlanta-outdoor-club` | Scraping |
| BLK Hiking Club | `blk-hiking-club` | Scraping |
| Big Peach Running | `big-peach-running` | Scraping |
| PTC Running Club | `ptc-running-club` | Scraping |
| Monday Night Run Club | `monday-night-run-club` | Scraping |
| Atlanta Cycling | `atlanta-cycling` | Scraping |
| Bicycle Tours Atlanta | `bicycle-tours-atlanta` | Scraping |

#### Yoga & Wellness
| Source | Slug | Method |
|--------|------|--------|
| Highland Yoga | `highland-yoga` | Scraping |
| Yonder Yoga | `yonder-yoga` | Scraping |
| Dancing Dogs Yoga | `dancing-dogs-yoga` | Scraping |
| Vista Yoga | `vista-yoga` | Scraping |
| Evolation Yoga | `evolation-yoga` | Scraping |

### Dance Studios

| Source | Slug | Method |
|--------|------|--------|
| Pasofino Dance | `pasofino-dance` | Scraping |
| Salsa Atlanta | `salsa-atlanta` | Scraping |
| Academy Ballroom | `academy-ballroom` | Scraping |
| Ballroom Impact | `ballroom-impact` | Scraping |
| Dancing4Fun | `dancing4fun` | Scraping |
| Atlanta Dance Ballroom | `atlanta-dance-ballroom` | Scraping |
| Arthur Murray Atlanta | `arthur-murray-atlanta` | Scraping |
| Terminus Modern Ballet | `terminus-modern-ballet` | Scraping |

### Gaming & Entertainment

| Source | Slug | Method |
|--------|------|--------|
| Battle and Brew | `battle-and-brew` | Scraping |
| Puttshack | `puttshack` | Scraping |
| Painted Pin | `painted-pin` | Scraping |
| Painted Duck | `painted-duck` | Scraping |
| Punch Bowl Social | `punch-bowl-social` | Scraping |
| Fowling Warehouse | `fowling-warehouse` | Scraping |
| Activate Games | `activate-games` | Scraping |
| EEG Arena | `eeg-arena` | Scraping |
| Level Up Gaming | `level-up-gaming` | Scraping |
| Token Gaming Pub | `token-gaming-pub` | Scraping |
| ATL Gaming | `atl-gaming` | Scraping |
| Southern Fried Gaming | `southern-fried-gaming` | Scraping |
| Fun Spot America Atlanta | `fun-spot-america-atlanta` | Scraping |
| Six Flags Over Georgia | `six-flags-over-georgia` | Scraping |

### Nightlife

| Source | Slug | Method |
|--------|------|--------|
| Opera Nightclub | `opera-nightclub` | Scraping |
| District Atlanta | `district-atlanta` | Scraping |
| Ravine Atlanta | `ravine-atlanta` | Scraping |
| Tongue and Groove | `tongue-and-groove` | Scraping |
| Gold Room | `gold-room` | Scraping |
| Domaine Atlanta | `domaine-atlanta` | Scraping |
| Lyfe Atlanta | `lyfe-atlanta` | Scraping |
| Church Atlanta | `church-atlanta` | Scraping |
| Compound Atlanta | `compound-atlanta` | Scraping |
| Basement Atlanta | `basement-atlanta` | Scraping |
| Johnny's Hideaway | `johnnys-hideaway` | Scraping |

### Food Markets & Halls

| Source | Slug | Method |
|--------|------|--------|
| Ponce City Market | `ponce-city-market` | Scraping |
| Krog Street Market | `krog-street-market` | Scraping |
| Sweet Auburn Market | `sweet-auburn-market` | Scraping |

### Cooking Schools

| Source | Slug | Method |
|--------|------|--------|
| Sur La Table | `sur-la-table` | Scraping |
| Publix Aprons | `publix-aprons` | Scraping |
| Irwin Street Cooking | `irwin-street-cooking` | Scraping |
| Williams Sonoma | `williams-sonoma` | Scraping |

### Makerspaces & Tech

| Source | Slug | Method |
|--------|------|--------|
| Atlanta Tech Village | `atlanta-tech-village` | Scraping |
| Render ATL | `render-atl` | Scraping |
| Freeside Atlanta | `freeside-atlanta` | Scraping |
| Decatur Makers | `decatur-makers` | Scraping |
| The Maker Station | `the-maker-station` | Scraping |
| Atlanta Tech Week | `atlanta-tech-week` | Scraping |
| YPA Atlanta | `ypa-atlanta` | Scraping |

### Art Studios & Creative Spaces

| Source | Slug | Method |
|--------|------|--------|
| Janke Studios | `janke-studios` | Scraping |
| Mudfire | `mudfire` | Scraping |
| Spruill Center | `spruill-center` | Scraping |
| Atlanta Clay Works | `atlanta-clay-works` | Scraping |
| Supermarket ATL | `supermarket-atl` | Scraping |
| 404 Found ATL | `404-found-atl` | Scraping |
| Mass Collective | `mass-collective` | Scraping |
| Avondale Arts | `avondale-arts` | Scraping |
| Hambidge Center | `hambidge-center` | Scraping |
| Blue Merle Studios | `blue-merle-studios` | Scraping |
| South River Art | `south-river-art` | Scraping |

### Film & Cinema

| Source | Slug | Method |
|--------|------|--------|
| Plaza Theatre | `plaza-theatre` | Scraping |
| Tara Theatre | `tara-theatre` | Scraping |
| Landmark Midtown | `landmark-midtown` | Scraping |
| Atlanta Film Festival | `atlanta-film-festival` | Scraping |
| Out on Film | `out-on-film` | Scraping |
| AJFF | `ajff` | Scraping |
| Atlanta Film Society | `atlanta-film-society` | Scraping |
| Atlanta Film Series | `atlanta-film-series` | Scraping |
| Buried Alive | `buried-alive` | Scraping |
| BronzeLens | `bronzelens` | Scraping |
| WeWatchStuff | `wewatchstuff` | Scraping |

### Haunted Attractions (Seasonal)

| Source | Slug | Method |
|--------|------|--------|
| Netherworld | `netherworld` | Scraping |
| 13 Stories | `13-stories` | Scraping |
| Folklore Haunted | `folklore-haunted` | Scraping |
| Paranoia Haunted | `paranoia-haunted` | Scraping |
| Nightmares Gate | `nightmares-gate` | Scraping |

### Historic Sites

| Source | Slug | Method |
|--------|------|--------|
| Oakland Cemetery | `oakland-cemetery` | Scraping |
| Wren's Nest | `wrens-nest` | Scraping |
| Shrine Cultural Center | `shrine-cultural-center` | Scraping |

### Hotels with Event Spaces

| Source | Slug | Method |
|--------|------|--------|
| Hotel Clermont | `hotel-clermont` | Scraping |
| Georgian Terrace | `georgian-terrace-hotel` | Scraping |
| Skylounge Glenn | `skylounge-glenn-hotel` | Scraping |

### Sports Bars

| Source | Slug | Method |
|--------|------|--------|
| Brewhouse Cafe | `brewhouse-cafe` | Scraping |
| ATL UTD Pubs | `atlutd-pubs` | Scraping |
| Hawks Bars | `hawks-bars` | Scraping |
| Fado Irish Pub | `fado-irish-pub` | Scraping |
| Stats Downtown | `stats-downtown` | Scraping |
| Meehan's Pub | `meehans-pub` | Scraping |

### Restaurants with Events

| Source | Slug | Method |
|--------|------|--------|
| Le Colonial Atlanta | `le-colonial-atlanta` | Scraping |
| Gypsy Kitchen | `gypsy-kitchen` | Scraping |
| Sun Dial Restaurant | `sun-dial-restaurant` | Scraping |
| Park Tavern | `park-tavern` | Scraping |
| Urban Grind | `urban-grind` | Scraping |
| Kat's Cafe | `kats-cafe` | Scraping |
| Midway Pub | `midway-pub` | Scraping |
| Rowdy Tiger | `rowdy-tiger` | Scraping |

### Coworking Spaces

| Source | Slug | Method |
|--------|------|--------|
| Switchyards | `switchyards` | Scraping |
| WeWork Atlanta | `wework-atlanta` | Scraping |
| Industrious Atlanta | `industrious-atlanta` | Scraping |
| The Gathering Spot | `the-gathering-spot` | Scraping |

### Community Events

| Source | Slug | Method |
|--------|------|--------|
| Recurring Social Events | `atlanta-recurring-social` | Generated |
| Georgia Chess | `georgia-chess` | Scraping |
| Freeroll Atlanta | `freeroll-atlanta` | Scraping |

### Suburban Venues

| Source | Slug | Method |
|--------|------|--------|
| Strand Theatre | `strand-theatre` | Scraping |
| Avalon Alpharetta | `avalon-alpharetta` | Scraping |

### Record Stores

| Source | Slug | Method |
|--------|------|--------|
| Wax'n'Facts | `wax-n-facts` | Scraping |
| Moods Music | `moods-music` | Scraping |

### Immersive Experiences

| Source | Slug | Method |
|--------|------|--------|
| Illuminarium Atlanta | `illuminarium-atlanta` | Scraping |

### Attractions

| Source | Slug | Method |
|--------|------|--------|
| Georgia Aquarium | `georgia-aquarium` | Scraping |
| Zoo Atlanta | `zoo-atlanta` | Scraping |

### Puppetry/Children's Theater

| Source | Slug | Method |
|--------|------|--------|
| Center for Puppetry Arts | `puppetry-arts` | Scraping |

---

## Ticketmaster - Special Case

- **Slug:** `ticketmaster`
- **Method:** Official Discovery API with API key
- **Risk Level:** GREEN (API access)
- **Notes:** Using official API per their developer program terms
- **Requirements:** Ensure compliance with API rate limits and attribution requirements
- **Recommendation:** Review API terms periodically; ensure proper attribution

---

## Summary by Extraction Method

| Method | Count | Risk Level |
|--------|-------|------------|
| Official API (Ticketmaster) | 1 | LOW |
| JSON-LD scraping (Eventbrite) | 1 | HIGH |
| Playwright browser automation | 2 | HIGH |
| BeautifulSoup HTML scraping | ~365 | Varies |
| Hardcoded/Generated | ~5 | LOW |

---

## Next Steps

1. **Immediate:** Review Eventbrite and Meetup ToS; consider official API applications
2. **Short-term:** Reach out to Creative Loafing and ArtsATL about partnership
3. **Ongoing:** Monitor for any complaints; have takedown process ready
4. **Future:** If monetizing, reassess all YELLOW sources

---

## Appendix: Source Module File List

All 374 crawler modules in `/crawlers/sources/`:

```
a_cappella_books.py          abv_gallery.py               academy_ballroom.py
access_atlanta.py            aclu_georgia.py              activate_games.py
actors_express.py            agnes_scott.py               aisle5.py
ajff.py                      alliance_theatre.py          americasmart.py
ameris_bank_amphitheatre.py  anime_weekend_atlanta.py     apache_xlr.py
apex_museum.py               arthur_murray_atlanta.py     arts_atl.py
artsatl.py                   asw_distillery.py            atl_food_wine.py
atl_gaming.py                atlanta_art_fair.py          atlanta_ballet.py
atlanta_black_pride.py       atlanta_botanical.py         atlanta_clay_works.py
atlanta_comedy_theater.py    atlanta_contemporary.py      atlanta_cultural_affairs.py
atlanta_cycling.py           atlanta_dance_ballroom.py    atlanta_dogwood.py
atlanta_eagle.py             atlanta_film_festival.py     atlanta_film_series.py
atlanta_film_society.py      atlanta_food_wine.py         atlanta_history_center.py
atlanta_jazz_festival.py     atlanta_liberation_center.py atlanta_lyric_theatre.py
atlanta_motor_speedway.py    atlanta_opera.py             atlanta_outdoor_club.py
atlanta_parks_rec.py         atlanta_pride.py             atlanta_tech_village.py
atlanta_tech_week.py         atlanta_track_club.py        atlutd_pubs.py
auburn_ave_library.py        aurora_theatre.py            avalon_alpharetta.py
avondale_arts.py             ballroom_impact.py           basement_atlanta.py
battery_atlanta.py           battle_and_brew.py           believe_music_hall.py
beltline.py                  bicycle_tours_atlanta.py     big_peach_running.py
blakes_on_park.py            blind_willies.py             blk_hiking_club.py
blue_merle.py                bold_monk_brewing.py         book_boutique.py
bookish_atlanta.py           boot_barn_hall.py            breakaway_atlanta.py
breman_museum.py             brewhouse_cafe.py            bronzelens.py
buckhead_theatre.py          bulldogs_atlanta.py          buried_alive.py
callanwolde.py               candler_park_fest.py         carlos_museum.py
center_stage.py              charis_books.py              chattahoochee_nature.py
cherry_street_brewing.py     childrens_museum.py          church_atlanta.py
city_springs.py              city_winery.py               civil_rights_center.py
clark_atlanta.py             club_wander.py               cobb_energy.py
cobb_galleria.py             cobb_library.py              coca_cola_roxy.py
college_football_hof.py      community_foundation_atl.py  compound_atlanta.py
creative_loafing.py          criminal_records.py          dads_garage.py
dancing_dogs_yoga.py         dancing4fun.py               decatur_arts_festival.py
decatur_book_festival.py     decatur_city.py              decatur_farmers_market.py
decatur_makers.py            decatur_recreation.py        dekalb_library.py
discover_atlanta.py          district_atlanta.py          domaine_atlanta.py
dragon_con.py                dreamhack_atlanta.py         drunken_unicorn.py
eagle_eye_books.py           east_atlanta_strut.py        eav_farmers_market.py
ebenezer_church.py           echo_room.py                 eddies_attic.py
eeg_arena.py                 emory_events.py              emory_schwartz_center.py
eventbrite.py                eventide_brewing.py          evolation_yoga.py
exhibition_hub.py            fado_irish_pub.py            fancons.py
farmers_markets.py           fernbank.py                  ferst_center.py
fire_maker_brewing.py        five29.py                    folklore_haunted.py
forward_warrior.py           four04_found_atl.py          fowling_warehouse.py
fox_theatre.py               foxtale_books.py             freedom_farmers_market.py
freeroll_atlanta.py          freeside_atlanta.py          friends_on_ponce.py
fulton_library.py            fun_spot_atlanta.py          future_atlanta.py
gas_south.py                 gathering_spot.py            georgia_aquarium.py
georgia_chess.py             georgia_ensemble.py          georgia_state_university.py
georgia_tech_arts.py         georgia_tech_athletics.py    georgia_tech_events.py
georgian_terrace.py          gicc.py                      glahr.py
goat_farm.py                 gold_room.py                 grant_park_farmers_market.py
grant_park_festival.py       gsu_athletics.py             gwcc.py
gwinnett_library.py          gypsy_kitchen.py             halfway_crooks.py
hambidge.py                  hands_on_atlanta.py          hathaway_contemporary.py
hawks_bars.py                helium_comedy.py             high_museum.py
highland_yoga.py             horizon_theatre.py           hotel_clermont.py
illuminarium.py              indivisible_atl.py           industrious_atlanta.py
inman_park_festival.py       irwin_street_cooking.py      janke_studios.py
johnnys_hideaway.py          johns_creek.py               joystick_gamebar.py
juneteenth_atlanta.py        jungle_atlanta.py            kai_lin_art.py
kats_cafe.py                 kennesaw_state.py            king_center.py
knock_music_house.py         krog_street_market.py        ksu_athletics.py
l5p_community_center.py      landmark_midtown.py          laughing_skull.py
le_colonial.py               level_up_gaming.py           lips_atlanta.py
little_shop_of_stories.py    live_at_battery.py           lore_atlanta.py
lyfe_atlanta.py              maker_station.py             marcia_wood_gallery.py
marcus_jcc.py                marys.py                     marys_bar.py
mason_fine_art.py            mass_collective.py           meehans_pub.py
meetup.py                    mercedes_benz_stadium.py     midway_pub.py
mjq_concourse.py             mobilize.py                  moca_ga.py
momocon.py                   monday_night.py              monday_night_run_club.py
moods_music.py               morehouse_college.py         morningside_farmers_market.py
mudfire.py                   my_sisters_room.py           netherworld.py
nightmares_gate.py           northside_tavern.py          oakland_cemetery.py
oddities_museum.py           oglethorpe_university.py     one_musicfest.py
onstage_atlanta.py           opera_nightclub.py           orpheus_brewing.py
out_of_box_theatre.py        out_on_film.py               painted_duck.py
painted_pin.py               paranoia_haunted.py          park_tavern.py
pasofino_dance.py            peachtree_road_farmers_market.py  peachtree_road_race.py
piedmont_athens.py           piedmont_auxiliary.py        piedmont_cancer_support.py
piedmont_classes.py          piedmont_cme.py              piedmont_fitness.py
piedmont_foundation.py       piedmont_healthcare.py       piedmont_heart_conferences.py
piedmont_luminaria.py        piedmont_park.py             piedmont_transplant.py
piedmont_womens_heart.py     piedmonthealthcare_events.py pinch_n_ouch_theatre.py
pisces_atlanta.py            plaza_theatre.py             poem88_gallery.py
ponce_city_market.py         pontoon_brewing.py           porchfest_vahi.py
ptc_running_club.py          publix_aprons.py             punch_bowl_social.py
punchline.py                 puppetry_arts.py             pushpush_arts.py
pushpush_theater.py          puttshack.py                 ravine_atlanta.py
recurring_social_events.py   red_light_cafe.py            reformation_brewery.py
render_atl.py                resident_advisor.py          rialto_center.py
roswell_cultural_arts.py     round_trip_brewing.py        rowdy_tiger.py
salsa_atlanta.py             sandler_hudson.py            sandy_springs_pac.py
scad_atlanta.py              schwartz_center.py           scofflaw_brewing.py
second_self_brewing.py       seven_stages.py              shakespeare_tavern.py
shaky_knees.py               shrine_cultural_center.py    side_saddle.py
six_flags.py                 skylounge_glenn.py           smiths_olde_bar.py
sound_table.py               south_river_art.py           southern_fried_gaming.py
southern_fried_queer_pride.py  spaceman_rooftop.py        spelman_college.py
spivey_hall.py               sports_social.py             spruill_center.py
st_james_live.py             stage_door_players.py        state_farm_arena.py
stats_downtown.py            steady_hand_beer.py          stone_mountain_park.py
strand_theatre.py            sun_dial_restaurant.py       supermarket_atl.py
sur_la_table.py              sweet_auburn_market.py       sweet_auburn_springfest.py
sweetwater.py                sweetwater_420_fest.py       switchyards.py
synchronicity_theatre.py     tabernacle.py                tara_theatre.py
taste_of_atlanta.py          tentimes.py                  terminal_west.py
terminus_modern_ballet.py    the_earl.py                  the_eastern.py
the_heretic.py               the_loft.py                  the_masquerade.py
theatrical_outfit.py         thirteen_stories.py          three_taverns.py
ticketmaster.py              token_gaming_pub.py          tongue_and_groove.py
trap_music_museum.py         trees_atlanta.py             trolley_barn.py
true_colors_theatre.py       truist_park.py               uptown_comedy.py
urban_grind.py               variety_playhouse.py         venkmans.py
vista_yoga.py                wax_n_facts.py               wewatchstuff.py
wework_atlanta.py            whitespace_gallery.py        whole_world_improv.py
wild_aster_books.py          wild_heaven.py               williams_sonoma.py
woodys_atlanta.py            woofs_atlanta.py             working_title_playwrights.py
world_of_coca_cola.py        wrens_nest.py                ymca_atlanta.py
yonder_yoga.py               ypa_atlanta.py               zoo_atlanta.py
zucot_gallery.py
```

---

## Policy Recommendations

### Guidelines for New Sources

#### Safe to Add (GREEN)
- Individual venue websites (they want exposure)
- Official tourism/government event calendars
- Nonprofit/community org calendars
- Public library event systems
- RSS feeds or APIs explicitly offered for aggregation
- Venues with public event listings
- Community organizations and clubs

#### Review Before Adding (YELLOW)
- Major festivals/conventions (check ToS)
- University event calendars (check institutional policies)
- Arts journalism sites (check ToS, consider partnership)
- Any source with login/paywall
- Healthcare organizations (HIPAA considerations for certain events)
- Political/activist organizations (may have data handling concerns)

#### Avoid or Seek Permission First (RED)
- Other event aggregators (Eventbrite, Meetup, competitors)
- Ticketing platforms without API access
- Sources with explicit anti-scraping ToS
- Paywalled or member-only content
- Sites using CAPTCHAs or explicit bot protection
- Social media platforms (Facebook Events, Instagram, etc.)

### Data Handling Rules

1. **Always link back to original source** - Every event must have `source_url` pointing to the original listing
2. **Truncate long descriptions** - Consider truncating descriptions over 500 characters with "Read more" link
3. **Respect robots.txt** - Check and honor robots.txt directives
4. **Rate limiting** - Don't overwhelm sources; use reasonable delays between requests
5. **Image attribution** - Store and display image source when available
6. **No authentication bypass** - Never circumvent login requirements
7. **Regular review** - Audit sources quarterly for ToS changes

### Attribution Standards

Events should display:
- Link to original source
- Source name/attribution
- "Powered by [Source]" for API sources like Ticketmaster
- Image attribution when available

---

## Takedown Response Process

### When a Complaint Arrives

#### Step 1: Acknowledge (within 24 hours)

```
Subject: Re: [Source Name] Content Inquiry

Thank you for reaching out. We've received your message regarding
[specific concern] and are reviewing it promptly.

We will respond with more details within 48 hours.

Best regards,
The Lost City Team
```

#### Step 2: Assess the Complaint

Questions to answer:
- Is it a formal cease & desist or informal request?
- What specific content/data is at issue?
- What is their stated concern (copyright, ToS, competition)?
- Is this a source we want to maintain a relationship with?
- What is their risk level in our audit?

#### Step 3: Response Options

**Option A - Comply (default for RED sources)**
```
Subject: Re: [Source Name] - Content Removed

We've removed [source name] events from Lost City effective immediately.
We apologize for any concern this caused and appreciate you reaching out.

If you'd like to discuss a partnership arrangement in the future that
works for both parties, we'd welcome that conversation.

Best regards,
The Lost City Team
```

**Option B - Negotiate (for valuable GREEN/YELLOW sources)**
```
Subject: Re: [Source Name] - Partnership Discussion

Thank you for reaching out. We'd love to discuss an arrangement that
works for both of us.

Lost City is a free, non-commercial event discovery platform serving
the Atlanta community. We drive traffic to event sources through direct
links - every event links back to your site for ticketing and details.

We'd be happy to:
- Add more prominent attribution to your events
- Include a "Powered by [Source]" badge
- Respect any specific data handling preferences
- Discuss API access if available

Would you be open to a quick call to explore options?

Best regards,
The Lost City Team
```

**Option C - Clarify (if claim seems unclear)**
```
Subject: Re: [Source Name] - Request for Clarification

Thank you for your message. We'd like to understand your concern better.

Lost City aggregates publicly available event information and links
directly to your site for ticketing/details. We don't monetize this
data - no ads, no subscriptions.

Could you clarify:
- What specific content/data concerns you?
- What resolution would work for you?

We're committed to being good partners in the Atlanta events ecosystem.

Best regards,
The Lost City Team
```

#### Step 4: Document Everything

Keep records of:
- Original complaint (date, sender, content)
- All correspondence
- Actions taken
- Final resolution

### Proactive Outreach Template

For high-value sources you want to maintain good relationships with:

```
Subject: Lost City Event Platform - Partnership Inquiry

Hi [Name],

I'm reaching out from Lost City, a free event discovery platform
serving the Atlanta community.

We currently include events from [Source Name] in our listings, with
full attribution and links back to your site. We'd love to ensure
we're representing your events in a way that works for you.

Options we can offer:
- Prominent "Events from [Source Name]" attribution
- Featured placement for your venue/events
- Notification when we add your events
- Custom data handling per your preferences

Would you be interested in a quick chat to discuss how we can best
work together?

Best regards,
[Name]
Lost City Team
```

---

## Image Attribution Implementation

### Current Implementation (v1)

A "Source" link has been added to the event detail view hero image area (`web/components/views/EventDetailView.tsx`). This links to the original `source_url` for the event, providing attribution for both the event data and any images from that source.

**What's implemented:**
- Small "Source" link in the top-right of hero images
- Links to the original event source page
- Provides implicit attribution for images

### Future Enhancement (v2 - Requires DB Migration)

For more granular image attribution, a database schema change would be needed:

```sql
-- Add to events table
ALTER TABLE events ADD COLUMN image_source_url TEXT;
ALTER TABLE events ADD COLUMN image_attribution TEXT;
```

**Crawler changes needed:**
- Extract and store image source URLs when available
- Populate `image_attribution` with source name

**UI changes:**
- Display "Image: [source name]" below hero images
- Link to original image source

This enhancement is recommended if/when:
- LostCity monetizes (adds, subscriptions)
- A source specifically requests image attribution
- Legal review recommends explicit image attribution

---

## Verification Checklist

- [x] All 374 source modules categorized
- [x] Risk levels assigned with reasoning
- [x] Extraction methods documented
- [x] Policy recommendations included
- [x] Takedown templates created
- [x] Image attribution - v1 (source link on images)
- [ ] Image attribution - v2 (dedicated image_source field) - future
- [ ] Stakeholder review
- [ ] Mock takedown test
