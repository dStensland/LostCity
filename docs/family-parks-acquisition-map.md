# Family Parks Acquisition Map

**Surface:** `consumer`
**Portal:** `atlanta-families`
**Status:** Active research map
**Date:** 2026-03-16

This document defines the broad-first acquisition strategy for parks, playgrounds, splash pads, spraygrounds, pools, and related family-use outdoor destinations across Atlanta and the close-in metro.

The goal is to map the systems first, then deepen the best destinations. We should not keep building one-off park crawlers where a jurisdiction already exposes a complete or near-complete official inventory.

## Decision

The best method is a **system-first, amenity-led** approach:

1. **Build the jurisdiction map from official park inventories, facility directories, GIS viewers, and amenity lists**
2. **Attach amenity-specific overlays for playgrounds, splash pads, spraygrounds, and aquatics**
3. **Only then deepen the top family destinations with individual detail crawlers**

This is better than one-source-at-a-time crawling because:

- it finds the full universe before we optimize any one park
- it reduces blind spots caused by event-driven discovery
- it gives us a dedupe key by jurisdiction + facility + amenity
- it makes later depth work deliberate instead of opportunistic

## What Counts As the Map

The map is not just a list of parks. It is the broad inventory layer we need before deep enrichment:

- `jurisdiction`
- `source_system`
- `facility_name`
- `facility_url`
- `address`
- `city`
- `venue_type`
- `amenity_flags`
- `playground`
- `splash_pad` / `sprayground` / `water_play`
- `pool` / `aquatic_center`
- `trail_loop`
- `restrooms`
- `pavilion`
- `parking`
- `source_confidence`

At map stage, we care more about **coverage and amenity presence** than rich editorial detail.

## Best Source Types

Ranked by leverage.

### Tier 1: Official system inventories

These are the highest-value discovery sources because they define the universe.

- official park/facility directories
- county or city “find a park” pages
- GIS park layers
- amenity-filterable park indexes
- official park inventory PDFs if no structured directory exists

### Tier 2: Official amenity-specific overlays

These are the fastest way to find the wedge content families actually care about.

- playground lists
- splash pad or sprayground lists
- aquatics / pools pages
- parks & amenities maps

### Tier 3: Individual park detail pages

Use these after the map exists.

- park pages with playground or shade details
- splash-pad rules pages with seasonality and hours
- pool pages with child-water features
- map PDFs for large parks

### Tier 4: Event and program systems

These are not discovery-first for park mapping, but they help connect the park graph to actual Family demand.

- Rec1
- ActiveNet / Active Communities
- city calendars
- seasonal event pages

## Jurisdiction Map

This is the metro-source map we should use before building more one-off crawlers.

| Jurisdiction | Best official broad source | Broad value | Amenity overlay source | Current read |
|---|---|---|---|---|
| Atlanta | [Parks & Recreation Map](https://www.atlantaga.gov/government/departments/department-parks-recreation/parks-recreation-map) | city-wide park universe | [List of Playgrounds](https://www.atlantaga.gov/government/departments/department-parks-recreation/office-of-parks/list-of-playgrounds), [Splash Pads](https://www.atlantaga.gov/government/departments/department-parks-recreation/office-of-parks/splash-pads) | strongest immediate source for city-core playground + splash coverage |
| DeKalb County | [Park Inventory List](https://www.dekalbcountyga.gov/parks/park-inventory-list), [Park Maps](https://www.dekalbcountyga.gov/parks/park-maps) | broad park universe by region | [Aquatics](https://www.dekalbcountyga.gov/parks/aquatics) | good countywide breadth, weaker amenity structure than Atlanta |
| Cobb County | [County Park Locations](https://www.cobbcounty.org/parks/county-park-locations) | strong broad inventory with amenity categories | individual facility pages like [East Cobb Park](https://www.cobbcounty.org/location/east-cobb-park) | one of the best system-level candidates for bulk park mapping |
| Gwinnett County | [Visit Us](https://www.gwinnettcounty.com/departments/communityservices/visitus) | broad park/facility inventory with map + alphabetical list | [Splash Pad Rules](https://www.gwinnettcounty.com/departments/communityservices/parksandrecreation/parks/parksrulesordinances), [Pool Rules](https://www.gwinnettcounty.com/government/departments/parks-recreation/aquatics/pool-rules) | good system map, decent splash/aquatic overlay, park-by-park detail still needed |
| Roswell | [Facility Directory](https://www.roswellgov.com/government/facility-directory/) | unusually strong amenity-per-facility structure | [Roswell Area Park Pool](https://www.roswellgov.com/Pool) | one of the best municipal amenity sources in the metro |
| Dunwoody | [Parks & Facilities](https://www.dunwoodyga.gov/government/departments/parks-and-recreation/parks-facilities) | strong park set + interactive map | [Two Bridges Park](https://www.dunwoodyga.gov/government/departments/parks-and-recreation/parks-facilities/two-bridges-park), [Brook Run Park](https://www.dunwoodyga.gov/government/departments/parks-and-recreation/parks-facilities/brook-run-park) | very good for playground and splash specifics |
| Sandy Springs | [City Parks](https://www.sandyspringsga.gov/city-parks/) | broad park list and amenities map | park pages like [Abernathy Park](https://www.sandyspringsga.gov/places/abernathy-park/) | good park inventory, weaker direct splash inventory but still useful |
| Johns Creek | [Recreation & Parks Maps](https://johnscreekga.gov/departments/gis-maps/recreation-parks-maps/) | park system overview with park-specific pages | individual pages like [Shakerag Park](https://johnscreekga.gov/recreation-parks/parks/shakerag-park/), [Bell Boles Park](https://johnscreekga.gov/recreation-parks/parks/bell-boles-park/), [Morton Road Park](https://johnscreekga.gov/recreation-parks/parks/morton-road-park/) | very strong for playground-specific park detail |
| Marietta | [Parks & Amenities PDF](https://www.mariettaga.gov/DocumentCenter/View/6885/2018-Updated-Parks-and-Amenities-PDF), [Sprayground @ Elizabeth Porter Park](https://www.mariettaga.gov/1230/Sprayground-Elizabeth-Porter-Park) | amenities matrix across the city | sprayground page with hours/pricing | good special-case water-play source, weaker structured facility HTML |
| Alpharetta | [City Parks & Facilities](https://www.alpharetta.ga.us/395/Facilities) | partial broad source | `Wills Park Pool` and park PDFs if needed | currently weaker than Roswell/Johns Creek/Dunwoody for direct amenity scraping |
| Hapeville | [Splash Pad](https://www.hapeville.org/663/Splash-Pad), [Map Us](https://hapeville.org/316/Map-Us) | smaller city, high-value water-play wedge | splash pad + FAQ pages | strong single-amenity source, not a system source |
| South Fulton | park detail pages like [Trammell Crow Park](https://www.cityofsouthfultonga.gov/3060/Trammell-Crow-Park) | useful but not yet a clean system inventory | individual facility pages | lower leverage until a better system index is identified |
| College Park | city news/docs show park investments and a splash pad at Phillips Park | promising south-metro family utility | city pages are fragmented | needs system-level discovery before crawler investment |

## Best Broad-First Method By System

### Atlanta

Use Atlanta as the model because the city already exposes the exact wedge overlays we want.

- first-pass map source: city park map
- playground overlay: direct playground list
- water-play overlay: direct splash-pad list

This means Atlanta should not rely on piecemeal park discovery anymore. The broad map can be built directly from official lists.

**Implementation status:** The first Atlanta wave is now live through [atlanta_parks_family_map.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_parks_family_map.py). It uses the city's official playground and splash-pad rosters as amenity overlays, seeds missing family-place venues where needed, and patches geometry on known parks where OSM has a confident place match. This materially improved `atlanta-families` park/playground/water-play coverage, but it also confirmed the next Atlanta-quality task: the official amenity rosters are not enough by themselves for complete address hydration.

### Cobb

Cobb is the strongest county-level park inventory candidate because the county park site already exposes:

- a full park list
- amenity groupings like playgrounds, pools, and trails
- individual park pages with amenities and prose

This is ideal for a two-step crawl:

1. inventory crawl of all parks
2. per-park detail crawl only for the facilities that matter to Family wedges

**Implementation status:** Cobb is now wired for exactly that pattern in [cobb_parks_family_map.py](/Users/coach/Projects/LostCity/crawlers/sources/cobb_parks_family_map.py), and the first live production wave is complete. The current official site exposes a parseable countywide roster plus structured park detail pages with address data and amenity bullets. The first production run processed `47` official parks and added `47` destination detail rows plus `57` feature rows. That makes Cobb the cleanest proof so far that the broad importer model is better than continuing to build one-off park crawlers.

### Gwinnett

Gwinnett’s best broad source is the county “Visit Us” map/list, then amenity overlays for splash pads and aquatics.

This is a strong map-first system, but not as clean as Cobb because the county park pages are more distributed.

**Implementation status:** Gwinnett is now live in [gwinnett_parks_family_map.py](/Users/coach/Projects/LostCity/crawlers/sources/gwinnett_parks_family_map.py). The current stable production wave processed `27` official destinations, adding `26` destination detail rows plus `44` feature rows. The importer now reads the county's current park-detail structure directly and creates address-backed park rows such as `Alexander Park`, `Bay Creek Park`, `Best Friend Park`, `Bethesda Park`, `Bogan Park`, `Bryson Park`, `Duncan Creek Park`, `E. E. Robinson Park`, `George Pierce Park`, `Tribble Mill Park`, and `Yellow River Post Office Site`.

Gwinnett also exposed the next quality task for the broad-map strategy: some county child pages and some park pages still do not yield a clean entrance-address line through the current parser. That is not a reason to fall back to one-off crawlers. It is a reason to add a second address-recovery layer for broad importers where the official park graph is otherwise strong.

The new direct broad-map audit confirms the current live system totals:

- `cobb-parks-family-map`: `47` venues, all with active features
- `gwinnett-parks-family-map`: `44` venues, all with active features
- `dekalb-parks-family-map`: `36` venues, all with active features
- `atlanta-parks-family-map`: `25` venues, all with active features

That means the platform now has four real jurisdiction-scale Family park maps in production, not just a handful of one-off park crawlers. The main remaining broad-map cleanup is no longer amenity coverage. Atlanta's two unsupported overlay-only playground names have been removed from the live system map instead of carrying fake addresses, and the remaining quality work is now mostly a small Gwinnett skip list where the county page still does not expose a reliable entrance address.

The map layer is also getting meaningfully richer, not just broader. Current broad-system feature counts now include:

- Cobb: `28` sports-field rows, `27` picnic/pavilion rows, `13` nature/open-space rows
- Gwinnett: `24` sports-field rows, `26` picnic/pavilion rows, `15` nature/open-space rows
- DeKalb: `25` sports-field rows, `25` picnic/pavilion rows, `8` nature/open-space rows

That is the beginning of the “go deep” phase on top of the broad map: parks are no longer just a destination inventory, they are becoming a family-use utility graph.

That deeper phase is now live on the flagship Atlanta-core park sources too. `piedmont-park`, `grant-park`, and `chastain-park-conservancy` now carry stronger practical family-use signal in `venue_destination_details` and `venue_features`, including parking mode, stroller-loop utility, restroom/picnic support, and longer-stay meetup value where the official source supports it. The next depth work should follow that pattern: use the broad map for coverage, then selectively deepen the highest-value parks with the practical details parents actually need.

That same depth pattern is now starting to extend to adjacent Family anchor destinations outside the strict park-system importers too. `stone-mountain-park`, `atlanta-botanical-garden`, `atlanta-botanical-garden-gainesville`, and `centennial-olympic-park` now carry stronger practical-use planning signal such as parking mode, stroller-friendliness, timed-entry mindset, and lower-walk family utility. So the map-first strategy is working as intended: broad system coverage first, then selective depth on the destinations families actually choose most often.

The same is now true for major indoor and hybrid-family anchors: `high-museum-of-art`, `center-for-puppetry-arts`, and `chattahoochee-nature-center` all now carry stronger practical-use signal about weather resilience, stroller/lower-energy suitability, and indoor-fallback shape. That is important because the broad map should not become a park-only worldview. The real Family planning graph needs both the broad park universe and a small set of highly trusted anchor destinations with honest outing-shape guidance.

The event-only-to-destination-first upgrade path is now working on another important cluster too: `georgia-aquarium`, `zoo-atlanta`, `fernbank-museum`, and `childrens-museum-atlanta` now project shared destination-detail and feature rows instead of relying only on their event/program surfaces. That is strategically important because it means the Family graph can deepen even when the source is historically event-heavy. We do not need to wait for a perfect crawler rewrite to start making the anchor destinations usable as destination truth.

The same is now true for `lego-discovery-center-atlanta`, `museum-of-illusions-atlanta`, and `atlanta-history-center`. These are not park-system map rows, but they are core Family anchors, and they now carry the same practical-use destination truth about outing length, walking burden, weather resilience, and family-fit shape. That is an important strategic signal: the broad-map strategy is doing its job, and the follow-on depth work is now spreading correctly across the wider Family destination graph instead of getting trapped in the park category.

The old partial rows are also normalized now: Cobb, Gwinnett, and Atlanta legacy destination-detail rows that predated the current importer contract have been backfilled with explicit `metadata.source_slug`, so the broad-map layer is measurable by actual source ownership instead of relying on audit-side inference.

### DeKalb

DeKalb looked more fragmented at first, but the county's regional park pages turned out to be structured enough for a broad importer:

- regional park pages by area with name / address / acreage / amenity blocks
- aquatics page with seasonal pool and splash inventory

**Implementation status:** DeKalb is now live in [dekalb_parks_family_map.py](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_parks_family_map.py). The cleaned countywide wave now sits at `36` destination-detail rows with `36` featured venues, including Family-relevant rows like `Frazier Rowe`, `Mason Mill Center for Special Populations`, `Midway/Recreation Center`, `N. H. Scott III Recreation Center`, `Lucious Sanders/Recreation Center`, `Lithonia`, and `Hairston`.

The DeKalb rollout also clarified a useful map-layer rule: broad Family park importers should exclude golf-only facilities unless the official page also exposes a family-use signal like playgrounds, trails, picnic areas, recreation space, or water play.

### Roswell / Dunwoody / Johns Creek

These municipalities are especially strong for depth because their park pages expose amenities directly on each facility page.

Use them for:

- broad park universe
- amenity extraction
- high-confidence playground metadata
- sprayground / splash-pad / pool modeling

These cities are excellent “go deep” targets after the county/city broad map is built.

### Sandy Springs / Marietta / Hapeville

These are narrower but high-value:

- Sandy Springs has a good park list and strong individual park pages
- Marietta has a very important sprayground source plus a parks-and-amenities PDF
- Hapeville has a small but high-value splash-pad source

These are not first-wave universe builders, but they are first-wave wedge builders.

## What We Should Build Before More Crawlers

### 1. A parks universe ingest layer

This should collect the broad system rows first:

- facility name
- jurisdiction
- source URL
- type
- address
- core amenity booleans

This is closer to a seed/import pattern than a conventional event crawler.

### 2. An amenity overlay merge layer

This attaches official amenity-specific pages to the park universe:

- playground lists
- splash pad lists
- aquatics pages
- sprayground pages

This is how we avoid hand-discovering water-play and playground destinations one by one.

### 3. A detail-page deepening layer

Once the map exists, only then crawl:

- best Atlanta city parks
- best metro playground parks
- best water-play parks
- nature centers and easy micro-adventures

## Recommended Execution Order

### Wave 1: Build the broad map

Highest leverage because they define the park universe.

1. Atlanta official park inventory + playground list + splash pad list
2. Cobb County park locations + park amenities categories
3. Gwinnett Visit Us map + splash/aquatics overlay
4. DeKalb park inventory + aquatics overlay

**Current status:** Atlanta, Cobb, Gwinnett, and DeKalb are now live, and the broad-map cleanup pass is effectively complete. The current quality baseline is:

- Atlanta: `25` venues, clean on address/city/features
- Cobb: `47` venues, clean on address/city/features
- Gwinnett: `47` venues, clean on address/city/features
- DeKalb: `36` venues, clean on address/city/features

That cleanup pass is measurable through [audit_family_parks_system_quality.py](/Users/coach/Projects/LostCity/database/audit_family_parks_system_quality.py). The next gap is no longer broad inventory integrity. It is deeper family utility on top of the map:

- bathrooms / rest-stop reliability
- shade / heat-day fit
- stroller friction and walking burden
- lingerability and picnic quality
- where parks stack well with other family anchors nearby

In other words: the map is established. The next phase is practical family planning depth.

That practical-depth phase is now underway on the main Family anchors. The current live pattern is:

- aquarium / children’s museum / science-center style anchors:
  - bathroom-reset friendliness
  - weather-proof fallback value
  - stroller / attention-span friction
- zoo / garden / outdoor-flex anchors:
  - walking burden
  - shade and pacing
  - “outdoor bonus vs required outdoor commitment”

So the park map is no longer the bottleneck. The best next work is attached utility truth that helps a parent decide:

- can we reset here easily?
- will this fall apart in heat or rain?
- is this a short stop, half-day, or full-energy outing?
- do we need stroller stamina or just indoor patience?

That utility layer is now spreading beyond parks into the main Family anchor destinations too:

- indoor anchors:
  - bathroom/reset friendliness
  - low-walking indoor fallback value
  - predictable short-stop vs half-day behavior
- mixed campus anchors:
  - slower-pace vs short-stop guidance
  - where indoor reset points exist inside a larger walking day

The practical implication is that the Family graph is starting to answer not just “what is this place?” but “what kind of family outing does this actually become?”

That now includes the outdoor / hybrid family anchors too:

- large outdoor anchors:
  - how much range the family really needs
  - whether the outing should be paced around rest breaks
  - whether there are meaningful lower-friction attraction clusters
- gardens and hybrid nature anchors:
  - whether morning timing materially helps
  - whether there are shade / indoor fallback / conservatory reset options
- urban parks:
  - whether the park behaves like a flexible basecamp or a destination with one main path

So the next phase of Family depth is increasingly about outing-shape truth, not missing inventory.

That now clearly includes city-core “reset” and “stackable stop” logic too:

- free downtown reset stops
- compact museum stops that pair with a neighborhood walk
- slower-pace meetup parks
- free STEM destinations with enough substance to matter

So the Family graph is starting to distinguish between:

- a full committed outing
- a flexible basecamp park day
- a short downtown reset
- a compact cultural add-on

### Wave 2: Add high-quality amenity cities

Best place to improve playground and water-play specificity.

1. Roswell facility directory
2. Dunwoody parks and facilities
3. Johns Creek recreation & parks maps
4. Sandy Springs park list + amenity pages

### Wave 3: Fill targeted wedge cities

1. Marietta sprayground and amenity matrix
2. Hapeville splash pad
3. College Park splash-pad / park investment inventory
4. South Fulton park details once a better system index is found

## Recommended Data Products

We should generate two products before another large park-crawler wave.

### Product A: `family_parks_system_map`

One row per facility across the metro.

Fields:

- jurisdiction
- system_slug
- facility_name
- facility_slug
- facility_url
- city
- venue_type
- playground
- splash_pad
- sprayground
- pool
- aquatic_center
- trails
- restrooms
- pavilion
- parking
- notes

### Product B: `family_amenity_targets`

One row per amenity-bearing park that deserves deeper capture.

Fields:

- facility_slug
- amenity_type
- official_supporting_url
- why_it_matters
- current_repo_coverage
- next_action

## Recommended Crawl Philosophy

Broad first:

- build the universe from official facility systems
- normalize names and addresses
- attach basic amenity booleans

Deep second:

- only build individual park crawlers for the parks that matter most
- prioritize parks with official proof of:
  - playgrounds
  - splash pads / spraygrounds / pools
  - high Family use
  - distinctive practical value

This should cut down on one-off crawlers and make the Family destination graph more complete much faster.

## Immediate Next Implementation Batch

1. Build an Atlanta park-system importer from the official parks map + playground list + splash-pad list
2. Build a Cobb park-system importer from County Park Locations and amenity categories
3. Build a Gwinnett park-system importer from Visit Us and splash/aquatic overlays
4. Build a DeKalb park-system importer from the park inventory and aquatics pages
5. Only after those exist, start the next park detail wave for top Family parks

## Strategic Read

The strongest update from this research is that we should stop treating “park discovery” like event discovery.

For Family, parks/playgrounds/water play are a **system inventory problem first** and a **detail enrichment problem second**.

That is the map. Once we have it, going deep becomes much cheaper and much less random.
