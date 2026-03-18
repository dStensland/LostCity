# Family Destination Content Workstream

**Surface:** `consumer`
**Status:** Active
**Date:** 2026-03-16
**Portal:** `atlanta-families`

This is the execution workstream for making Lost City: Family meaningfully stronger on destination-first family content, especially the free and practical content that parents repeatedly need and other products handle badly.

The core bet is simple: Family should not just be "programs plus family events." The moat is a durable graph of family-useful destinations and attached details that answer:

- where can I take kids right now
- what is free or low-friction
- what works for this age
- what is actually easy once we get there

This workstream exists because the current platform is ahead on Family `programs`, but still underpowered on Family destination intelligence.

For the parks / playgrounds / splash-pad wedge specifically, the acquisition strategy is now documented separately in [family-parks-acquisition-map.md](/Users/coach/Projects/LostCity/docs/family-parks-acquisition-map.md). That document defines the broad-first system map we should build before investing in another large wave of one-off park crawlers.

The first Atlanta implementation from that map is now the official overlay importer at [atlanta_parks_family_map.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_parks_family_map.py). It seeds and enriches city playground and splash-pad destinations from Atlanta's published rosters, while avoiding duplicate playground/water-play features on venues that already have richer park-specific coverage.

The first live production wave is complete. The source is registered as `atlanta-parks-family-map`, has run successfully against production, and materially improved Family destination coverage in the city core. After the canary plus repair rerun, the production Family audit moved to:

- `591` Family-linked venues
- `145` target-type destinations
- `89` venues with `venue_destination_details`
- `91` venues with active `venue_features`
- `water_play`: `10` venues
- `playground`: `6` venues

The important caveat from the Atlanta wave is geometry quality. The official amenity rosters are enough to build the citywide family-place map, but not enough to guarantee complete address data. The current importer now prefers existing venues, patches missing geometry via constrained OSM place lookup, and avoids adding duplicate overlay features on richer park destinations. That is good enough for a first broad map, but Atlanta still needs a later official inventory/address pass if we want every park row to be fully address-complete.

The second live production wave is now also complete. The source is registered as `cobb-parks-family-map`, has run successfully against production, and acts as the first true countywide family-park importer with structured addresses and amenity capture from official park detail pages. The Cobb canary processed `47` official parks and added `47` destination detail rows plus `57` feature rows. After Atlanta plus Cobb, the production Family audit now reads:

- `593` Family-linked venues
- `146` target-type destinations
- `89` venues with `venue_destination_details`
- `91` venues with active `venue_features`
- `water_play`: `10` venues
- `playground`: `6` venues

The important distinction is quality. Atlanta proved the broad overlay method for playground and splash-pad discovery, but Cobb proved the stronger system-level pattern: when a jurisdiction exposes a full roster plus park detail pages with structured address data and amenity bullets, we can build a broad importer that creates cleaner destination rows on the first pass instead of relying on later geometry repair.

The third live production wave is now also in place for Gwinnett. The source is registered as `gwinnett-parks-family-map`, and the current stable production run processed `27` official destinations, adding `26` destination detail rows and `44` feature rows. Confirmed live rows from that wave include `Alexander Park`, `Bay Creek Park`, `Best Friend Park`, `Bethesda Park`, `Bogan Park`, `Bryson Park`, `Duncan Creek Park`, `E. E. Robinson Park`, `George Pierce Park`, `Tribble Mill Park`, and `Yellow River Post Office Site`, all with real street addresses from Gwinnett's official park pages where the county now exposes them cleanly.

The important caveat is measurement. The current Family destination audit still starts from venues already linked through active Family events or `programs`, so it undercounts destination-only broad-importer wins by design. That is why the headline audit moved only slightly after the Gwinnett run even though the importer created real address-backed park destinations. To make the map layer measurable, the broad importers now stamp `source_slug` in `venue_destination_details.metadata`, so a follow-up audit can report on the park-system graph directly instead of only through active event/program linkage.

That measurement contract is now repaired on the live legacy rows too: older Cobb, Gwinnett, and Atlanta overlay rows that were still being attributed only through `jurisdiction` or `source_type` fallback now carry explicit `metadata.source_slug`, so broad-map audits reflect real source ownership instead of inference.

That direct broad-map measurement now exists in [audit_family_destination_content.py](/Users/coach/Projects/LostCity/database/audit_family_destination_content.py). The current production Family headline audit now reads:

- `602` Family-linked venues
- `153` target-type destinations
- `96` venues with `venue_destination_details`
- `98` venues with active `venue_features`
- `water_play`: `10` venues
- `playground`: `7` venues

Current live system-map totals are:

- `cobb-parks-family-map`: `47` venues, `47` detail rows, `47` venues with features, `4` water-play venues, `30` playground venues
- `gwinnett-parks-family-map`: `44` venues, `44` detail rows, `44` venues with features, `16` water-play venues, `24` playground venues
- `dekalb-parks-family-map`: `36` venues, `36` detail rows, `36` venues with features, `10` water-play venues, `27` playground venues
- `atlanta-parks-family-map`: `25` venues, `25` detail rows, `25` venues with features, `2` water-play venues, `25` playground venues

The map layer is also materially deeper now than it was at first rollout. Beyond playground and water-play coverage, the current broad-map feature layer includes:

- `cobb-parks-family-map`: `28` sports-field rows, `27` picnic/pavilion rows, `13` nature/open-space rows
- `gwinnett-parks-family-map`: `24` sports-field rows, `26` picnic/pavilion rows, `15` nature/open-space rows
- `dekalb-parks-family-map`: `25` sports-field rows, `25` picnic/pavilion rows, `8` nature/open-space rows

That matters because the map is no longer just “which parks exist.” It is starting to answer the Family planning question in a richer way: where are the playgrounds, where is water play, where are the picnic-friendly stops, where are the active sports parks, and where are the more passive nature-style destinations.

That is the right way to judge the map layer. The Family headline audit remains useful for portal-visible destination depth, but the broad-map section is now the source of truth for how much official park-system coverage we have built.

There is now also a direct quality audit for the broad-map layer at [audit_family_parks_system_quality.py](/Users/coach/Projects/LostCity/database/audit_family_parks_system_quality.py). The current cleanup queue is narrower and more concrete:

- `atlanta-parks-family-map`: official GIS plus city-geocoder fallback solved the address-quality problem for the trustworthy city overlay rows; the two unsupported overlay-only names (`Atlanta Children's Theme Park` and `Civic Center Playground`) are now excluded from the live system map instead of carrying fake addresses
- `cobb-parks-family-map`: address, city, and feature coverage are now clean across the current live row set
- `gwinnett-parks-family-map`: address, city, and feature coverage are now clean across the current live row set; the remaining issue is a small skip list where the county page still does not expose a reliable entrance address
- `dekalb-parks-family-map`: golf/disc-golf rows are excluded cleanly and all current rows have addresses plus features

With the broad map now clean enough to trust, the workstream has shifted from "what parks exist?" into "which parks are actually easy with kids?" The first Atlanta-core practical-utility batch is now live on the flagship in-city parks that families repeatedly use:

- `piedmont-park`: now carries `parking_type='garage'`, `best_time_of_day='morning'`, restroom and picnic-table planning notes, ADA/stroller-friendly accessibility notes, plus new features for `restrooms-and-picnic-table-support` and `stroller-friendly-paved-park-loops`
- `grant-park`: now carries stroller-loop and open-lawn practical notes, accessibility guidance on path-style circulation, and a new `picnic-lawns-and-family-spread-out-space` feature
- `chastain-park-conservancy`: now carries stronger family-meetup and stroller-loop notes, explicit accessibility guidance for the playground/path network, and a new `family-meetup-lawns-and-pavilion-space` feature

That is the right next layer for the Family moat. Broad county inventory gave us coverage; these deeper destination-detail updates start answering the real planning question a parent has before leaving the house: where can I park, is it stroller-friendly, can we linger there, and does the park support a longer family session without friction.

The same practical-utility layer is now extending beyond the city parks into the highest-traffic Family anchor destinations:

- `stone-mountain-park`: now carries fuller `practical_notes` and `accessibility_notes` for the full-day family trip reality, plus a `scenic-railroad-and-lower-walk-family-loop` feature for families who need a lower-walk attraction mix
- `atlanta-botanical-garden` and `atlanta-botanical-garden-gainesville`: now carry timed-entry planning guidance, stroller/weather-flex accessibility notes, and new features for `paved-garden-paths-and-stroller-friendly-circulation` plus `indoor-conservatories-and-weather-flex-space`
- `centennial-olympic-park`: now carries `parking_type='garage'`, short-stop family-use guidance, stroller-friendly accessibility notes, and a new `flat-paved-downtown-stroller-loop` feature

That matters because the Family graph is starting to answer practical outing-shape questions across more than just parks: where can I do a short downtown reset, where can I handle a stroller-heavy garden visit, and where is a full-day destination still manageable with lower-walk kid options.

The next indoor / weather-flex utility batch is now live too:

- `high-museum-of-art` (existing production slug for High Museum of Art): now carries weather-proof Midtown planning notes, stroller/multigenerational accessibility guidance, and a `weather-proof-midtown-family-culture-stop` feature on top of its earlier family-program and free-Sunday strengths
- `center-for-puppetry-arts`: now carries stronger half-day indoor stacking guidance, stroller/lower-energy accessibility notes, and an `indoor-half-day-family-stack` feature
- `chattahoochee-nature-center`: now carries `parking_type='free_lot'`, clearer easy-nature-day / indoor-fallback guidance, terrain-aware accessibility notes, and an `easy-trails-plus-indoor-fallback` feature

That is exactly the direction the Family moat needs to go. The graph is not just getting broader or more "kid-friendly" in abstract terms; it is getting more honest about outing shape, walking burden, weather resilience, and how realistically a family can pull off the destination.

The next upgrade wave is also now live for four anchors that used to behave mostly like event venues instead of destination-first Family stops:

- `georgia-aquarium`: now carries timed-entry indoor planning guidance, stroller/weather-proof accessibility notes, and destination features for `weather-proof-marine-galleries` plus `stroller-friendly-downtown-anchor`
- `zoo-atlanta`: now carries earlier-start / walking-burden guidance, weather-exposure accessibility notes, and destination features for `animal-habitats-and-family-walking-circuits` plus `grant-park-family-anchor`
- `fernbank-museum`: now carries half-day museum-plus-outdoor planning guidance, stroller / shorter-visit accessibility notes, and destination features for `dinosaurs-and-natural-history-galleries` plus `museum-plus-outdoor-nature-flex`
- `childrens-museum-atlanta`: now carries timed indoor younger-kid planning guidance, stroller / attention-span accessibility notes, and destination features for `interactive-play-and-learning-floor` plus `downtown-younger-kid-weather-proof-anchor`

That matters because these are precisely the places parents already think about. Turning them into shared destination-detail rows means the Family graph is no longer over-weighting event-rich sources while under-describing the biggest real anchors.

Another anchor-upgrade wave is now live too:

- `lego-discovery-center-atlanta`: now carries timed indoor younger-kid planning guidance, stroller / attention-span accessibility notes, and destination features for `indoor-build-play-attraction-stack` plus `buckhead-weather-proof-younger-kid-anchor`
- `museum-of-illusions-atlanta`: now carries short-stop downtown family guidance, lower-energy accessibility notes, and destination features for `interactive-photo-illusion-galleries` plus `short-downtown-family-reset-stop`
- `atlanta-history-center`: now carries half-day campus planning guidance, walking-range accessibility notes, and destination features for `historic-houses-gardens-and-galleries` plus `buckhead-history-campus-day`

This is the right compounding pattern. The Family graph is now getting outing-shape truth across parks, museums, nature centers, indoor attractions, and weather-flex downtown anchors instead of just one class of destination.

## Goal

Make `atlanta-families` the best local source for practical family destination intelligence in Metro Atlanta, with special depth in:

1. free family destinations
2. splash pads, spraygrounds, fountains, and water play
3. playground intelligence
4. libraries, nature centers, and low-friction educational destinations
5. easy family micro-adventures
6. recurring low-cost destination offers and family specials

## Why This Matters

This aligns directly with the north star and the current platform strategy:

- it enriches the shared destination layer, not just one portal feed
- it answers a high-frequency real-world question families actually have
- it compounds across Family, Adventure, Atlanta, and future distribution portals
- it creates quality depth instead of another breadth-only event surface

The current gap is not schema. The shared model already has the right primitives:

- `venues` for the anchor destination
- `venue_destination_details` for practical destination intelligence
- `venue_features` for attached amenities, experiences, and child attractions
- `venue_specials` for recurring low-cost or free destination offers

The current gap is systematic capture and quality depth.

## Strategic Thesis

The highest-leverage Family destination content is not another generic "things to do with kids" list. It is durable, structured, locally specific operational truth.

That means content like:

- splash pads with real hours, seasonality, restroom notes, shade notes, and parking friction
- playgrounds with toddler suitability, fencing, shade, bathroom access, and inclusive equipment
- libraries with branch-level family utility, not just event calendars
- free museum windows and family-access offers captured as destination specials
- stroller-friendly loops, boardwalks, creek-play spots, and easy nature destinations
- destination bundles that solve a real plan: playground + lunch + bathroom + free

## Product Positioning

Family should become the place that parents trust for:

- `Free Today`
- `Best Splash Pads`
- `Playgrounds Worth the Drive`
- `Indoor Places for a Hot Day`
- `Easy Family Adventures`
- `Cheap and Easy Wins`

That is a stronger moat than a broader events tab.

## Current State

### What is already strong

- Family `programs` are now materially deeper in production
- Family parks, rec, museum, library, and camp crawlers already create a useful source base
- the shared destination graph exists and is getting stronger across the platform

### What is missing

- family-useful destination attributes are not being captured systematically
- free and low-friction destination content is not organized as a deliberate Family wedge
- `venue_features` and `venue_destination_details` are underused for Family
- recurring family utility content still leaks into event-shaped or editorial-shaped patterns

### Strategy mismatch to note

The older Family PRD still talks in terms of `Hooky` and an older portal slug. This workstream uses the current platform reality:

- portal brand family: `Lost City: Family`
- live portal slug: `atlanta-families`

## Content Wedges

These are ordered by expected leverage.

### Wedge 1: Cooling + Water Play

**Why first:** high intent, high repeat usage, highly seasonal, under-structured elsewhere.

Target types:

- splash pads
- spraygrounds
- play fountains
- wading pools
- creek-play destinations
- public pool free-swim windows

Critical fields:

- `is_free`
- `seasonal_opening_window`
- `seasonal_closing_window`
- `water_play_type`
- `shade_level`
- `restroom_available`
- `parking_type`
- `parking_friction`
- `best_age_bands`
- `heat_day_fit`
- `source_url`

Primary storage:

- `venue_features` for attached splash pads/play fountains inside a park or plaza
- `venue_destination_details` for broader practical context
- `venue_specials` for free-swim windows or recurring access offers

### Wedge 2: Playground Intelligence

**Why second:** durable, highly reused, and almost always poorly structured elsewhere.

Critical fields:

- toddler suitability
- big-kid suitability
- fenced or open
- shade level
- bathroom access
- swings
- climbing-heavy
- inclusive equipment
- stroller-friendly
- nearby water play
- picnic fit

Primary storage:

- `venue_features` with `feature_type='amenity'`
- `venue_destination_details.metadata` only for details that are destination-level rather than attached-feature-level

### Wedge 3: Free Family Destinations

**Why third:** strong value proposition and strong SEO/product utility without low-quality listicle behavior.

Target types:

- libraries
- nature centers
- visitor centers
- public gardens and plazas
- free museums or free museum windows
- story walk / storybook trail destinations
- public farms or educational campuses with family access

Critical fields:

- always free vs conditionally free
- free window cadence
- indoor or outdoor
- rainy-day fit
- age-band fit
- dwell time
- stroller fit
- bathroom access
- parking notes

Primary storage:

- `venues`
- `venue_destination_details`
- `venue_specials`

### Wedge 4: Easy Family Micro-Adventures

**Why fourth:** this creates overlap with Adventure and broadens Family beyond event/program utility.

Target types:

- stroller-friendly trails
- boardwalk loops
- creek overlooks
- train-watching spots
- easy waterfalls
- lake loops
- easy wildlife-viewing spots

Critical fields:

- `commitment_tier`
- `drive_time_minutes`
- `trail_length_miles`
- `surface_type`
- `family_suitability`
- `weather_fit_tags`
- `best_time_of_day`
- `parking_type`
- `dog_friendly`
- `accessibility_notes`

Primary storage:

- `venue_destination_details`
- `venue_features` for attached child attractions or amenities

### Wedge 5: Cheap and Easy Family Wins

**Why fifth:** valuable, but should stay attached to real destinations rather than becoming another event-feed trap.

Target types:

- free museum days
- cheap mini-golf windows
- public skate sessions
- discounted admission periods
- family meal deals at destination-like venues

Primary storage:

- `venue_specials`

## Data Model Rules

### What belongs where

Use these rules consistently.

#### `venues`

Use for the anchor place:

- park
- library branch
- nature center
- plaza
- museum
- pool
- trailhead

#### `venue_destination_details`

Use for destination-level practical intelligence:

- commitment
- difficulty
- drive time
- weather fit
- accessibility notes
- practical notes
- parking
- family suitability

#### `venue_features`

Use for attached amenities, attractions, and child-relevant sub-destination details:

- splash pad at a park
- playground at a park
- train-themed play area at a museum
- story walk at a nature center
- creek access zone at a preserve

#### `venue_specials`

Use for recurring value windows:

- free admission days
- free swim windows
- discounted family sessions
- recurring low-cost destination offers

### Promotion rule

Do **not** create a new first-class entity family for every interesting Family thing.

Default behavior:

- attach the detail to a destination

Promote only if the thing needs:

- independent browse surfaces
- independent recommendation/ranking
- independent compare semantics
- independent planning/progress semantics

For this workstream, splash pads and playgrounds are attached details unless proven otherwise.

## Source Strategy

Prioritize source families that produce durable destination truth, not one-off editorial lists.

### Tier 1 source families

1. city and county parks department facility pages
2. park-specific official pages
3. public library branch and service pages
4. official aquatics and splash-pad pages
5. official nature center and visitor center pages

### Tier 2 source families

1. museums with strong family-access pages
2. municipal destination pages
3. tourism pages only as discovery inputs
4. conservancies and friends-of-parks orgs

### Tier 3 source families

1. high-quality editorial discovery pages used only for discovery leads
2. neighborhood parent resources used only to find official targets

## Initial Metro Atlanta Gap Targets

The first execution wave should focus on source clusters where Family value is obvious and the data is likely durable.

### Cluster A: Splash pads and water play

- Atlanta parks and city aquatic pages
- Cobb, DeKalb, Gwinnett parks/aquatics pages
- destination-level pages for fountains and spraygrounds

### Cluster B: Playground-rich parks

- flagship city parks
- county parks with destination pages
- conservancy-managed parks

### Cluster C: Library branches as family destinations

- Fulton
- DeKalb
- Gwinnett
- Cobb

Treat branch utility as destination content, not just event feeds.

### Cluster D: Family micro-adventure destinations

- easy trailheads
- boardwalks
- creek and lake loops
- train-viewing or wildlife-viewing spots

### Cluster E: Free and low-cost indoor wins

- museums with free family windows
- visitor centers
- indoor public educational spaces

## Execution Phases

## Phase 1: Inventory Audit

**Outcome:** know exactly what Family destination content already exists and where the gaps are.

### Progress

Kickoff batch completed on **2026-03-16**:

- reusable production audit added at [database/audit_family_destination_content.py](/Users/coach/Projects/LostCity/database/audit_family_destination_content.py)
- first production audit run completed against `atlanta-families`
- the audit boundary was then corrected to use federated `portal_source_access` for event-linked Family venues, not just portal-owned rows

Current audit findings:

- the Family destination audit was corrected again to count family-useful `recreation` venues, not just narrower destination labels, because Atlanta- and metro-family rec centers were being undercounted by venue taxonomy
- `atlanta-families` currently links to `565` venues through accessible Family events/programs, with `129` target-type destinations (`park`, `library`, `museum`, `garden`, `community_center`, `recreation`, `pool`, `campground`, `trail`, `trailhead`, `visitor_center`, `plaza`)
- among those `129` target-type Family destinations:
  - the active count fluctuates with the live Family event/program window, but the current production audit now shows `60` with `venue_destination_details`, `15` with active `venue_features`, and `1` with an active `venue_special`
- destination-detail depth is stronger than the early baseline, but still too thin:
  - `61` with `family_suitability`
  - `29` with `parking_type`
  - `34` with `practical_notes`
  - `61` with `weather_fit_tags`
- current Family destination richness is still materially missing for:
  - `community_center` venues
  - most `park` venues
  - many `recreation` venues tied to city and county parks systems
  - most `museum` venues
  - many park-system child destinations and playground/water-play attachments
- current metro-city breakdown now shows where the Family destination graph is strongest and weakest:
  - `Atlanta`: now `29` Family-visible venues with destination details and `10` with features in the current production audit
  - `Lawrenceville`: `5` venues, `4` with details
  - `Decatur`: `4` venues, `1` with details
  - `Marietta`: `4` venues, still thin on details
  - `Alpharetta`: `3` venues, `1` with details after the Milton destination pass
- the strongest immediate gap candidates are:
  - City of Milton Parks & Recreation
  - St. James UMC - Atlanta
  - Clairmont Presbyterian Church-Decatur
  - St. Luke's Presbyterian Church
  - Camp Timber Ridge
  - Peachtree City Christian Church-Peachtree City
  - Due West Methodist - West Cobb
  - club-scikidz-atlanta venues
  - Fulton library branches still missing destination detail
- the strongest source-family gap candidates are:
  - `fulton-library`
  - `club-scikidz-atlanta`
  - `stone-mountain-park`
  - `atlanta-botanical-garden`
  - `gwinnett-parks-rec`
  - `dekalb-family-programs`
  - `cobb-parks-rec`
  - `atlanta-family-programs`
  - `gwinnett-ehc`
  - `milton-parks-rec`

Interpretation:

- Family has meaningful activity depth, but destination-depth is still far behind the venue universe already visible to the portal
- official-source destination enrichment is the right lever: the audit moved materially as soon as the first source canaries landed
- libraries are not absent from Family after all; they were undercounted by the first audit boundary and are now the clearest large-scale destination enrichment opportunity
- the next structural gap is no longer branch utility, it is parks/community-center richness and attached child features like playgrounds and water play
- the next city-and-metro gap is specifically Atlanta-core and close-metro rec-center depth, not more exurban venue breadth

### First Wave Targets

Start with targets that already have Family demand signal in production or are obvious Family destination wedges missing entirely.

**Destination-richness retrofits on already-active Family venues**

- Gwinnett Environmental & Heritage Center
- High Museum of Art
- Fernbank Museum of Natural History
- Autrey Mill Nature Preserve
- Pittman Park Recreation Center
- Shorty Howell Park
- McDaniel Farm Park

**Acquisition gaps to add deliberately**

- Atlanta-Fulton Public Library branch utility
- DeKalb County Public Library branch utility
- Gwinnett County Public Library branch utility
- Cobb County Public Library branch utility
- official splash-pad / aquatics pages across Atlanta, Cobb, DeKalb, and Gwinnett parks systems

### Tasks

1. audit current `atlanta-families` destination coverage by source family
2. audit current use of `venue_features` for Family-relevant amenities
3. audit current `venue_destination_details` rows for family-useful destinations
4. identify top 50 missing family destinations across the five wedges
5. identify which existing crawlers already touch the target source families but only emit events/programs

### Exit Gate

- one concrete inventory report by wedge
- one concrete gap list by source family
- one prioritized target list for the first 20 destinations or source pages

## Phase 2: Family Destination Schema Conventions

**Outcome:** consistent attached-detail capture rules for Family destination richness.

### Tasks

1. define canonical Family feature slugs and naming rules for:
   - splash pads
   - playgrounds
   - story walks
   - creek play
   - toddler zones
2. define metadata conventions for playground and water-play detail
3. define `venue_specials` conventions for recurring family-value offers
4. define which practical fields belong in structured columns versus JSON metadata

### Exit Gate

- one written Family destination field contract
- no ambiguity on `venue_features` vs `venue_destination_details` vs `venue_specials`

## Phase 3: First-Pass Capture Expansion

**Outcome:** Family-relevant destinations start landing through official-source crawlers in the shared model.

### Progress

First source-execution batch completed on **2026-03-16**:

- [crawlers/sources/gwinnett_ehc.py](/Users/coach/Projects/LostCity/crawlers/sources/gwinnett_ehc.py) now projects Gwinnett Environmental & Heritage Center into shared `destination_details` and `venue_features`
- [crawlers/sources/autrey_mill.py](/Users/coach/Projects/LostCity/crawlers/sources/autrey_mill.py) now projects Autrey Mill Nature Preserve into shared `destination_details` and `venue_features`
- [crawlers/sources/fulton_library.py](/Users/coach/Projects/LostCity/crawlers/sources/fulton_library.py) now projects branch venues into shared `destination_details`
- [crawlers/sources/gwinnett_library.py](/Users/coach/Projects/LostCity/crawlers/sources/gwinnett_library.py) now projects Gwinnett branch venues into shared `destination_details`
- [crawlers/sources/dekalb_library.py](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_library.py) now projects DeKalb branch venues into shared `destination_details`, with the full official branch map instead of collapsing most events into a generic county venue
- [crawlers/sources/cobb_library.py](/Users/coach/Projects/LostCity/crawlers/sources/cobb_library.py) now projects Cobb branch venues into shared `destination_details`
- [crawlers/sources/_rec1_base.py](/Users/coach/Projects/LostCity/crawlers/sources/_rec1_base.py) now supports a light tenant-level destination-enrichment hook for Family-heavy Rec1 systems
- [crawlers/sources/gwinnett_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/gwinnett_parks_rec.py) now uses that hook to project touched Gwinnett community centers and park venues into shared `destination_details`
- [crawlers/sources/atlanta_dpr.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_dpr.py) now projects touched Atlanta city rec centers, aquatic centers, and parks into shared `destination_details`, with aquatic-center family amenities in `venue_features`
- [crawlers/sources/cobb_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/cobb_parks_rec.py) now uses the same typed destination-enrichment pattern for Cobb aquatic centers, parks, and recreation centers
- [crawlers/sources/high_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/high_museum.py) now projects the High Museum into shared `destination_details`, family-focused `venue_features`, and a recurring `venue_special` for free Second Sundays
- [crawlers/sources/atlanta_botanical.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_botanical.py) now projects both garden campuses into shared `destination_details` and family `venue_features`
- [crawlers/sources/puppetry_arts.py](/Users/coach/Projects/LostCity/crawlers/sources/puppetry_arts.py) now projects Center for Puppetry Arts into shared `destination_details` and family-focused `venue_features`
- [crawlers/sources/stone_mountain_park.py](/Users/coach/Projects/LostCity/crawlers/sources/stone_mountain_park.py) now projects Stone Mountain Park into shared `destination_details` and family destination `venue_features`
- [crawlers/sources/dekalb_family_programs.py](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_family_programs.py) now projects touched DeKalb family-program rec centers and parks into shared `destination_details`
- [crawlers/sources/milton_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/milton_parks_rec.py) now projects the Family-visible Milton parks venue into shared `destination_details`
- [crawlers/sources/dekalb_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/dekalb_parks_rec.py) now projects broader DeKalb rec-center and park venues into shared `destination_details`, which closes the Family-visible `N.H. Scott` gap through the federated Atlanta source
- the library branch sources now also project shared `venue_features` for:
  - `free-indoor-family-stop`
  - `storytime-and-family-programs`
- the metro rec-center sources now project a shared `venue_feature` for:
  - `family-classes-and-seasonal-camps`
- focused envelope tests added:
  - [crawlers/tests/test_gwinnett_ehc_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_ehc_destination_envelope.py)
  - [crawlers/tests/test_autrey_mill_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_autrey_mill_destination_envelope.py)
  - [crawlers/tests/test_fulton_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_fulton_library_destination_envelope.py)
  - [crawlers/tests/test_gwinnett_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_library_destination_envelope.py)
  - [crawlers/tests/test_dekalb_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_dekalb_library_destination_envelope.py)
  - [crawlers/tests/test_cobb_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_cobb_library_destination_envelope.py)
  - [crawlers/tests/test_gwinnett_parks_rec_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_parks_rec_destination_envelope.py)
  - [crawlers/tests/test_atlanta_dpr_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_atlanta_dpr_destination_envelope.py)
  - [crawlers/tests/test_cobb_parks_rec_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_cobb_parks_rec_destination_envelope.py)
  - [crawlers/tests/test_high_museum_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_high_museum_destination_envelope.py)
  - [crawlers/tests/test_atlanta_botanical_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_atlanta_botanical_destination_envelope.py)
  - [crawlers/tests/test_puppetry_arts_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_puppetry_arts_destination_envelope.py)
  - [crawlers/tests/test_stone_mountain_park_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_stone_mountain_park_destination_envelope.py)
  - [crawlers/tests/test_dekalb_family_programs_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_dekalb_family_programs_destination_envelope.py)
  - [crawlers/tests/test_milton_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/tests/test_milton_parks_rec.py)
  - [crawlers/tests/test_dekalb_parks_rec_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_dekalb_parks_rec_destination_envelope.py)
  - [crawlers/tests/test_rec1_base.py](/Users/coach/Projects/LostCity/crawlers/tests/test_rec1_base.py)
- all five source extensions were canaried in production
- the Atlanta DPR and Cobb parks canaries were then added and production-verified
- the Gwinnett parks/community-center canary is also live and already moving Family program venues into shared destination-detail coverage
- the Fulton, Gwinnett, and DeKalb library canaries are live and producing branch destination-detail rows in production
- the DeKalb family, Milton Rec1, and broader DeKalb parks canaries are now live and production-verified too
- the Fulton, DeKalb, Cobb, and Gwinnett library canaries were rerun after the feature expansion and are writing the new free-family branch features in production
- the Atlanta, DeKalb, Milton, Gwinnett, and Cobb rec-center canaries were rerun after the feature expansion and are writing the new community-center family-program feature in production
- the same metro rec-center wave was extended again with a second shared amenity:
  - `indoor-family-recreation-space`
- the park/recreation source family was also extended with a free-family park amenity contract:
  - `free-outdoor-play-space`
  - this is wired in code for the metro park sources, but it has not yet surfaced in the active Family-linked production venue set because the currently visible Family rows are still much more rec-center-heavy than park-heavy

Result after the canaries:

- Family target-type destination coverage moved from the corrected early baseline of `0` owned-row destination-detail rows to `63` federated `venue_destination_details`, `66` active `venue_features`, and `1` active `venue_special` in the current production audit
- library branch utility is now the strongest completed wedge so far:
  - `fulton-library`: `31` branch venues with destination details
  - `gwinnett-library`: `9` branch venues with destination details
  - `dekalb-library`: `13` Family-visible venues with destination details after fixing the branch-collapse bug
  - `cobb-library`: first Family-visible branch destination-detail row now live, with the branch-utility path established for repeat expansion
- the next wedge is now proven at the cluster level:
  - `gwinnett-family-programs` moved from `3/13` venues with destination details to `6/13` during the Rec1 canary
  - `gwinnett-parks-rec` moved from `3/10` venues with destination details to `6/10` during the same canary
- the Atlanta-core and close-metro parks wave is now live too:
  - `atlanta-dpr` now has `6` Family-visible venues with destination details in production
  - visible Atlanta-core destination-detail wins include CT Martin, MLK Recreation & Aquatic Center, Rosel Fann, Washington Park Aquatic Center, Grove Park Recreation Center, and Pittman Park Recreation Center
  - `cobb-parks-rec` now has its first Family-visible detailed/featured venue in production through the new typed path
- the close-metro rec-center follow-up wave is now live too:
  - `dekalb-family-programs` now has `3/3` Family-visible venues with destination details in the current audit window
  - `milton-parks-rec` now has `1/1` Family-visible venue with destination details
  - `dekalb-parks-rec` closed the remaining `N.H. Scott Recreation Center` detail gap for Family-visible DeKalb recreation venues
- the free-library wedge now has real attached richness instead of only branch-level destination details:
  - `32` library venues now have active Family-oriented branch features in production
  - the visible Family feature layer moved from `15` to `23` active feature-bearing target destinations immediately after the library feature canaries
- the metro rec-center wedge now has attached program richness too:
  - `City of Milton Parks & Recreation`
  - `Mason Mill Recreation Center`
  - `Lucious Sanders Recreation Center`
  - `N.H. Scott Recreation Center`
  - `CT Martin Recreation & Aquatic Center`
  - `Rosel Fann Recreation & Aquatic Center`
  all now have active Family-oriented attached features in production
- the metro rec-center utility wedge is now the strongest new Family place layer in production:
  - `13` Family-visible venues now have the new `indoor-family-recreation-space` feature
  - the current audit now shows `66` Family-visible destinations with active features overall
  - `Atlanta` alone is now at `33` Family-visible venues with attached features in the current production audit
- the first explicit city-core playground and water-play batch is now live too:
  - `Grant Park` now has shared destination details plus:
    - `playgrounds-and-open-green-space`
    - `walking-trails-and-family-park-loops`
  - `Piedmont Park` now has shared destination details plus:
    - `playgrounds-and-kid-play-areas`
    - `pool-and-splash-pad`
  - the production audit now classifies:
    - `3` Family-visible playground feature venues
    - `5` Family-visible water-play feature venues
- the metro aquatics and family-nature follow-up wave is now live too:
  - `Atlanta Aquatic Fitness` now projects:
    - `CT Martin Recreation & Aquatic Center` as `aquatic_center`
    - `Rosel Fann Recreation & Aquatic Center` as `aquatic_center`
  - `Gwinnett Aquatic Fitness` now projects:
    - `Collins Hill Park Aquatic Center` as `aquatic_center`
  - `DeKalb Aquatic Fitness` now projects:
    - `East Central DeKalb Community & Senior Center` as `aquatic_center`
  - `Chattahoochee Nature Center` now has shared destination details as `nature_center` plus:
    - `river-trails-and-canoe-trips`
    - `wildlife-exhibits-and-discovery-center`
- the next metro park/rec gap-closure wave is live too:
  - `Chamblee Parks and Recreation` now has shared destination details as `community_recreation_center` plus:
    - `indoor-family-recreation-space`
    - `family-classes-and-seasonal-camps`
  - `Island Ford - Chattahoochee River National Recreation Area` now has shared destination details as `park` plus:
    - `river-and-pond-exploration`
    - `forest-trails-and-outdoor-adventure`
- the Family audit contract was tightened inline with the strategy:
  - pool and aquatics features now count in the `water_play` wedge instead of being buried under `other_family`
  - this surfaced the real current metro water-play layer instead of undercounting it
- the strongest Atlanta family-culture anchors now land as real destinations too:
  - `High Museum of Art` now has shared destination details, `4` family destination features, and the first recurring active Family-visible `venue_special` (`Free Second Sunday admission`)
  - `Atlanta Botanical Garden` now has shared destination details and `4` family destination features
  - `Center for Puppetry Arts` now has shared destination details and `5` family destination features
  - `Stone Mountain Park` now has shared destination details and `9` active family destination features
- the highest-impact newly covered Family venues in that Rec1 cluster are:
  - Bogan Park Community Recreation Center
  - George Pierce Park Community Recreation Center
  - Bethesda Community Recreation Center
  - Pinckneyville Park Community Recreation Center
- overall Family-linked venue coverage is currently:
  - `566` total venues / `130` target-type destinations in the active production audit window
- the feature layer is no longer the obvious lagging metric:
  - `73` Family-visible target destinations now have active `venue_features`
  - the strongest remaining Family depth gap has shifted toward park/playground/water-play specificity and low-cost specials, not just “any feature row exists”
- detail-depth coverage moved materially on:
  - `family_suitability`
  - `practical_notes`
  - `weather_fit_tags`
  - `water_play` wedge visibility
  - overall Family-visible destination-detail coverage (`71` venues)
- the latest Atlanta-core park passes landed three meaningful corrections:
  - `Centennial Olympic Park` now carries explicit `fountain-rings-and-water-play` instead of only a generic fountain/lawn feature, which raised the Family `water_play` wedge to `6` venues
  - the legacy Centennial feature row is now retired (`fountain-rings-and-open-lawn` is inactive), so the audit is cleaner instead of double-counting the same place under generic and wedge-specific semantics
  - `park-pride` now conservatively projects touched public parks into shared destination details plus `free-outdoor-play-space`, which strengthens the city park graph without inventing unsupported amenities
- `Atlanta BeltLine` was still too important to leave as destination-only:
  - the canonical `atlanta-beltline` crawler is now back on structured event-card parsing instead of the broken body-text scan
  - production updates are landing again under the canonical source while preserving the shared Family destination envelope
- the next metro-scale lift came from `Stone Mountain Park`, which is already one of the highest-volume Family-visible destinations in production:
  - the official attractions page now drives explicit attached features for `geyser-splash-pad-and-water-play` and `dinotorium-and-dinosaur-explore`
  - this pushed the Family production audit to `567` total Family-linked venues, `130` target-type destinations, `70` destinations with detail rows, and `72` with active features
  - the Family `water_play` wedge is now up to `7` venues in production
- `Chastain Park Conservancy` is now live as an Atlanta-core family park source instead of only an activity-adjacent gap:
  - the official park overview now drives shared destination details plus attached features for:
    - `playground-and-open-green-space`
    - `walking-trails-and-path-loops`
    - `athletic-swimming-pool-and-summer-aquatics`
    - `outdoor-classroom-and-park-programs`
  - the first production run also landed `5` conservancy-owned public events under the canonical park venue:
    - `Chastain Park Meadow Maintenance Workshop`
    - `Chastain Park Gardening 101 Workshop`
    - `Chastain Park Easter Egg Hunt`
    - `Wine Chastain`
    - `Home & Garden Tour`
  - post-write production audit now reads:
    - `568` Family-linked venues
    - `130` target-type destinations
    - `71` destinations with detail rows
    - `73` destinations with active features
    - `water_play: 8` venues
    - `playground: 4` venues
- `Candler Park` is no longer just a fall-festival venue in the graph:
  - [crawlers/sources/candler_park_fest.py](/Users/coach/Projects/LostCity/crawlers/sources/candler_park_fest.py) now projects the park into shared destination details and a city-run pool amenity using the official Candler Park and Candler Park Pool pages
  - the source was re-activated in production because it now carries durable Family destination value even outside festival season
  - current production state for the venue is:
    - shared `destination_details`
    - `public-pool-and-summer-aquatics`
  - post-activation production audit now reads:
    - `72` destinations with detail rows
    - `74` destinations with active features
    - `water_play: 9` venues
    - `Atlanta: 35` detailed Family-visible venues / `37` with features
- the Cobb umbrella fallback was also corrected upstream:
  - [crawlers/sources/cobb_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/cobb_parks_rec.py) now treats the default `cobb-county-parks-recreation` venue as an `organization`, not a destination-like recreation site
  - matching repair migrations were added at [530_reclassify_cobb_parks_hq_venue.sql](/Users/coach/Projects/LostCity/database/migrations/530_reclassify_cobb_parks_hq_venue.sql) and [20260316153000_reclassify_cobb_parks_hq_venue.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260316153000_reclassify_cobb_parks_hq_venue.sql)
  - the live venue row was repaired directly through the production API when the database-shell path was hanging
  - this keeps the Family destination audit focused on real parks, pools, and rec centers instead of a county-system fallback venue

Interpretation:

- the pattern works
- the library wedge is now meaningfully established
- the rec-center utility wedge is now meaningfully established too
- the next execution wave should shift toward:
  - parks/community-center systems with Family program demand but no park-specific attached richness
  - single-venue, Family-heavy official destinations for richer attached features
  - attached child features like playgrounds, splash pads, water play, and story-walk-style amenities
  - recurring free or low-cost specials beyond the High Museum baseline

### Tasks

1. convert or extend the highest-leverage parks/aquatics crawlers to emit Family destination richness in first pass
2. add branch/destination capture for library systems where branch-level family utility matters
3. capture splash pads, playgrounds, and official family-access details as attached features
4. capture free-window and low-cost recurring offers as `venue_specials`

### Exit Gate

- at least one source family live for each top wedge
- production rows in `venue_features` and `venue_destination_details` clearly attributable to this workstream

## Phase 4: Quality Depth Pass

**Outcome:** the data is materially useful, not just present.

### Tasks

1. fill practical fields:
   - bathrooms
   - shade
   - stroller fit
   - parking notes
   - seasonality
2. normalize free vs conditionally free semantics
3. normalize age-fit semantics
4. ensure child attractions inside larger parks are attached and discoverable

### Exit Gate

- destination records answer real planning questions, not just naming questions
- Family-specific destination pages can ship without placeholder copy

## Phase 5: Consumer Surface Readiness

**Outcome:** Family can expose destination-first utility without pretending it is just another event feed.

### Tasks

1. expose Family destination wedges in data-first surfaces:
   - free destinations
   - splash pads
   - playgrounds
   - easy adventures
2. validate portal-safe filtering and no cross-portal leakage
3. define empty-state thresholds so no surface ships thin

### Exit Gate

- at least one Family destination-first consumer surface can ship with real depth

## First Ticket Queue

These are the first 10 tickets worth executing.

1. Audit current production `venue_features` rows for Family-relevant amenities and quantify splash-pad/playground coverage.
2. Audit current production `venue_destination_details` rows for Family-relevant destinations and identify the top missing fields.
3. Build the first Family destination audit script for `atlanta-families`.
4. Produce the first top-50 Family destination gap list across the five wedges.
5. Extend one official parks or aquatics source to emit splash-pad or water-play `venue_features`.
6. Extend one flagship park source to emit playground intelligence as attached `venue_features`.
7. Extend one library system path to emit branch-level family destination utility beyond event calendars.
8. Extend one museum or indoor family destination source to emit recurring free or low-cost `venue_specials`.
9. Add Family destination field conventions to the crawler architecture docs once the first capture rules are proven.
10. Validate the resulting production rows and only then design the first Family destination-first browse surface.

## Immediate Execution Order

1. Phase 1 audit
2. Phase 2 field contract
3. one water-play source
4. one playground source
5. one library branch utility source
6. one free indoor family destination source
7. quality pass
8. consumer surface exposure

## Definition of Done

This workstream is done when all of the following are true:

- `atlanta-families` has obvious destination-first depth, not just program depth
- splash pads, playgrounds, and free family destinations are captured systematically
- Family destination data lives in the shared destination graph rather than one-off portal hacks
- official-source first-pass capture is the default path for this data
- at least one Family destination-first surface can ship consumer-ready from real data

## Recent Execution Notes

- the Family destination layer is now materially deeper on anchor destinations, not just park-system coverage
- the latest production-confirmed destination enrichments include:
  - [crawlers/sources/fernbank_science_center.py](/Users/coach/Projects/LostCity/crawlers/sources/fernbank_science_center.py)
    - live on `fernbank-science-center`
    - current production state:
      - `destination_type=science_center`
      - `commitment_tier=halfday`
      - `parking_type=free_lot`
      - features:
        - `free-planetarium-and-science-hall`
        - `observatory-and-free-learning-anchor`
  - [crawlers/sources/cdc_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/cdc_museum.py)
    - live on `cdc-museum`
    - current production state:
      - `destination_type=science_museum`
      - `commitment_tier=hour`
      - `family_suitability=caution`
      - feature:
        - `free-public-health-exhibitions`
  - [crawlers/sources/apex_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/apex_museum.py)
    - live on `apex-museum`
    - current production state:
      - `destination_type=history_museum`
      - `parking_type=street`
      - features:
        - `sweet-auburn-black-history-anchor`
        - `compact-history-museum-stop`
  - [crawlers/sources/carlos_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/carlos_museum.py)
    - now aligned to the canonical production venue slug `michael-c-carlos-museum`
    - current production state:
      - `destination_type=art_museum`
      - `parking_type=paid_lot`
      - features:
        - `free-emory-art-and-antiquities-anchor`
        - `compact-campus-museum-stop`
  - [crawlers/sources/southern_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/southern_museum.py)
    - live on `southern-museum`
    - current production state:
      - `destination_type=history_museum`
      - `commitment_tier=halfday`
      - `parking_type=free_lot`
      - features:
        - `the-general-locomotive-anchor`
        - `railroad-history-family-stop`
- this changes the Family content shape in a useful way:
  - the graph is no longer just “big paid anchors + park rows”
  - it now has more compact, educational, and lower-cost outing options that answer real family planning questions
- a second practical-utility pass is also now live on the highest-use Family anchors:
  - [crawlers/sources/georgia_aquarium.py](/Users/coach/Projects/LostCity/crawlers/sources/georgia_aquarium.py)
    - added explicit bathroom / cool-down reset signal
    - current production additions:
      - stronger practical/accessibility notes around air-conditioning, stroller ease, and lower walking friction
      - feature:
        - `easy-bathroom-and-cool-down-resets`
  - [crawlers/sources/zoo_atlanta.py](/Users/coach/Projects/LostCity/crawlers/sources/zoo_atlanta.py)
    - added explicit shade / pacing / walking-burden signal
    - current production additions:
      - stronger practical/accessibility notes around looping the day, shade, and sit-down pacing
      - feature:
        - `shade-and-rest-break-pacing`
  - [crawlers/sources/childrens_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/childrens_museum.py)
    - added explicit bathroom / attention-span reset signal
    - current production additions:
      - stronger practical notes around younger-kid resets
      - feature:
        - `bathroom-and-attention-span-reset-friendly`
  - [crawlers/sources/fernbank.py](/Users/coach/Projects/LostCity/crawlers/sources/fernbank.py)
    - added explicit indoor-bathroom / outdoor-bonus signal
    - current production additions:
      - stronger practical/accessibility notes around indoor core, shade, and outdoor optionality
      - feature:
        - `indoor-bathroom-core-with-outdoor-bonus`
- that practical-utility layer is also now live on the next Family anchor tier:
  - [crawlers/sources/high_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/high_museum.py)
    - added explicit museum-break / reset signal
    - current production additions:
      - stronger practical/accessibility notes around bathroom breaks, resets, and lower walking burden
      - feature:
        - `easy-museum-breaks-and-resets`
  - [crawlers/sources/atlanta_history_center.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_history_center.py)
    - added explicit walking-range / slower-pace signal
    - current production additions:
      - stronger practical notes around campus pacing
      - feature:
        - `longer-walking-campus-with-indoor-reset-points`
  - [crawlers/sources/legoland_atlanta.py](/Users/coach/Projects/LostCity/crawlers/sources/legoland_atlanta.py)
    - added explicit low-walking / bathroom-reset signal
    - current production additions:
      - stronger practical notes around low walking friction for younger kids
      - feature:
        - `low-walking-indoor-younger-kid-reset`
  - [crawlers/sources/museum_of_illusions.py](/Users/coach/Projects/LostCity/crawlers/sources/museum_of_illusions.py)
    - added explicit predictable-short-stop signal
    - current production additions:
      - stronger practical notes around bounded indoor novelty and easier pacing
      - feature:
        - `predictable-short-stop-indoor-novelty`
- the same practical-utility work is now live on outdoor and hybrid Family anchors too:
  - [crawlers/sources/stone_mountain_park.py](/Users/coach/Projects/LostCity/crawlers/sources/stone_mountain_park.py)
    - added explicit range / rest-break pacing signal
    - current production additions:
      - stronger practical/accessibility notes around full-day pacing, shade, and choosing shorter loops
      - feature:
        - `choose-your-range-with-rest-breaks`
  - [crawlers/sources/atlanta_botanical.py](/Users/coach/Projects/LostCity/crawlers/sources/atlanta_botanical.py)
    - added explicit heat / shade / conservatory-reset signal on both Atlanta and Gainesville rows
    - current production additions:
      - stronger practical/accessibility notes around morning timing, heat, and shaded reset options
      - feature:
        - `shade-and-conservatory-reset-flex`
  - [crawlers/sources/chattahoochee_nature.py](/Users/coach/Projects/LostCity/crawlers/sources/chattahoochee_nature.py)
    - added explicit shorter-range / indoor-backup signal
    - current production additions:
      - stronger practical/accessibility notes around choosing shorter trail range and using the indoor layer intentionally
      - feature:
        - `short-trail-range-with-indoor-backup`
  - [crawlers/sources/piedmont_park.py](/Users/coach/Projects/LostCity/crawlers/sources/piedmont_park.py)
    - added explicit flexible-basecamp / shade-lawns signal
    - current production additions:
      - stronger practical/accessibility notes around basecamp-style park days
      - feature:
        - `shade-lawns-and-flexible-basecamp-day`
- a city-core utility pass is now live on free-reset and compact cultural destinations:
  - [crawlers/sources/grant_park_conservancy.py](/Users/coach/Projects/LostCity/crawlers/sources/grant_park_conservancy.py)
    - added explicit flexible-free-reset signal
    - current production additions:
      - stronger practical/accessibility notes around looser pacing, shade, and lingering
      - feature:
        - `flexible-free-park-reset-stop`
  - [crawlers/sources/chastain_park_conservancy.py](/Users/coach/Projects/LostCity/crawlers/sources/chastain_park_conservancy.py)
    - added explicit slower-pace meetup-day signal
    - current production additions:
      - stronger practical/accessibility notes around shade, group size, and spread-out park use
      - feature:
        - `slow-pace-meetup-park-day`
  - [crawlers/sources/centennial_olympic_park.py](/Users/coach/Projects/LostCity/crawlers/sources/centennial_olympic_park.py)
    - added explicit free-water-play-reset signal
    - current production additions:
      - stronger practical/accessibility notes around downtown reset behavior
      - feature:
        - `free-water-play-downtown-reset`
  - [crawlers/sources/fernbank_science_center.py](/Users/coach/Projects/LostCity/crawlers/sources/fernbank_science_center.py)
    - added explicit free-STEM-depth signal
    - current production additions:
      - stronger practical/accessibility notes around “real learning value without a full-price day”
      - feature:
        - `free-stem-stop-with-real-depth`
  - [crawlers/sources/apex_museum.py](/Users/coach/Projects/LostCity/crawlers/sources/apex_museum.py)
    - added explicit stackable-Sweet-Auburn signal
    - current production additions:
      - stronger practical/accessibility notes around compact culture-stop behavior
      - feature:
        - `stackable-sweet-auburn-cultural-stop`
- a singleton-gap batch is now also live from the production queue:
  - [crawlers/sources/callanwolde.py](/Users/coach/Projects/LostCity/crawlers/sources/callanwolde.py)
    - current production state:
      - `destination_type=arts_center`
      - `parking_type=free_lot`
      - features:
        - `historic-arts-campus-and-grounds`
        - `family-classes-camps-and-arts-events`
        - `slower-pace-creative-campus-stop`
  - [crawlers/sources/mjcca.py](/Users/coach/Projects/LostCity/crawlers/sources/mjcca.py)
    - current production state:
      - `destination_type=community_center`
      - `parking_type=free_lot`
      - features:
        - `family-campus-program-hub`
        - `indoor-community-and-cultural-flex`
        - `planned-program-day-rather-than-drop-in-stop`
  - [crawlers/sources/civil_rights_center.py](/Users/coach/Projects/LostCity/crawlers/sources/civil_rights_center.py)
    - current production state:
      - `destination_type=history_museum`
      - `family_suitability=caution`
      - `parking_type=garage`
      - features:
        - `civil-rights-history-and-dialogue-stop`
        - `school-age-history-anchor`
        - `purposeful-downtown-museum-stop`
- the next high-leverage quality pass should keep layering practical truth on top of these anchors:
  - bathrooms / rest-stop reliability
  - shade / weather-flex reality
  - walking burden
  - lingerability and stackability with nearby destinations

## Queued Execution Batch

This is the current autonomous burn-down queue from the live production audit. It is ordered by leverage, not just by raw row count.

### Batch A: Singleton high-signal venues

- done:
  - `callanwolde`
  - `mjcca`
  - `civil-rights-center`
  - `college-football-hall-of-fame`
  - `zuckerman-museum-of-art`
  - `ksu-fine-arts-gallery`
  - `spelman-museum`
  - `cascade-springs-nature-preserve`
- next:
  - `outdoor-activity-center`
  - `lake-allatoona-rec-camp`

### Batch B: Library residuals

- done:
  - `alpharetta-library`
  - `east-atlanta-library`
  - `central-library-atlanta`
- result:
  - Fulton branch coverage is now complete for the current Family-linked library set, which materially strengthens the free indoor Family layer across the city and metro.

### Batch C: Multi-venue source clusters

- done:
  - `club-scikidz-atlanta`
    - `8/8` Family-visible venue rows now carry destination details and features
  - `ymca-atlanta`
    - `23/23` Family-visible venue rows now carry destination details and features
  - `gwinnett-line-dancing` venue trio
    - `george-pierce-park-crc`
    - `bethesda-park-senior-center`
    - `shorty-howell-park-activity-building`
- next:
  - `trees-atlanta`
    - the remaining gap list is now mostly a Trees Atlanta park cluster problem, not a generic library or community-center problem

### Batch D: Remaining community-center / arts-center anchors

- done:
  - `shorty-howell-park-activity-building`
  - `exchange-recreation-center`
  - `kirkwood`
  - `outdoor-activity-center`
  - `piedmont-park-greystone`
- result:
  - the live Family destination-detail / feature backlog is now closed for the current production target-type venue set
  - the remaining execution priority is no longer gap cleanup; it is practical-depth enrichment and Family specials

### Batch E: Specials and cheap/free recurring value

- current production state is still thin relative to total destination coverage, but it is now a real layer:
  - `active_specials=7`
  - `free_or_low_cost_specials=7`
- targets:
  - family museum free windows
  - recurring low-cost admission offers
  - destination-attached specials rather than event substitutions

### Current production floor after this queue setup

- `venue_count=606`
- `target_type_count=142`
- `with_destination_details=142`
- `with_features=142`
- `with_specials=6`
- detail coverage still worth improving:
  - `with_parking_type=80`
  - `with_accessibility_notes=67`
  - `with_practical_notes=116`

### Latest execution notes

- the singleton queue materially shrank in one pass:
  - `college-football-hall-of-fame`
  - `zuckerman-museum-of-art`
  - `ksu-fine-arts-gallery`
  - `spelman-museum`
  - `cascade-springs-nature-preserve`
  - `atlanta-contemporary`
- the library residual queue is now closed for the current Family-linked Fulton branches
- the multi-venue cluster queue is no longer abstract:
  - `club-scikidz-atlanta` is fully destination-enriched across its Family-visible venue set
  - `ymca-atlanta` is fully destination-enriched across its Family-visible venue set
  - the Gwinnett community-center trio now carries destination details/features, which removes `shorty-howell-park-activity-building` from the live gap list
- the Trees Atlanta residual park cluster is now closed for the current Family-linked venue set:
  - `trees-atl-ashview-heights`
  - `trees-atl-decatur`
  - `trees-atl-east-point`
  - `trees-atl-downtown`
  - `trees-atl-english-avenue`
  - `trees-atl-hapeville`
  - `trees-atl-oakland-city`
- `lake-allatoona-rec-camp` is no longer a live destination-detail/feature gap
- `outdoor-activity-center` and `exchange-recreation-center` now have dedicated destination-first owners instead of surfacing only through generic event owners
- `kirkwood` now resolves through the canonical Trees Atlanta neighborhood-stop path, with destination details/features attached under the official source
- `piedmont-park-greystone` now carries the official Piedmont Park destination envelope as a sub-venue alias of `piedmont-park`
- the live production Family audit is now clean on target-type destination coverage:
  - `gap_candidates=[]`
  - every current Family-linked target-type venue row has both `venue_destination_details` and active `venue_features`
- the free/cheap-value layer is now a meaningful graph instead of a single exception:
  - `high-museum-of-art` carries `free-second-sunday-admission` and `children-5-and-under-free`
  - `atlanta-contemporary` now carries `always-free-gallery-admission`
  - `fernbank-science-center` now carries `always-free-general-admission`
  - `cdc-museum` now carries `always-free-museum-admission`
  - `michael-c-carlos-museum` now carries `sunday-funday-free-admission`
  - `atlanta-botanical-garden` and `atlanta-botanical-garden-gainesville` now carry `children-under-3-free-daytime-admission`
  - `apex-museum` now carries `children-under-4-free-admission`
- the next real gaps are now depth gaps, not coverage gaps:
  - more Family specials and cheap/free recurring value
  - more parking / accessibility / practical-note depth across the long tail
  - stronger water-play / playground / outing-shape specificity where current rows are still generic

This queue is now the default execution order unless a stronger production gap appears.

### Next autonomous burn-down

This is the current default execution order for continued Family destination work without needing re-prioritization every turn.

#### Batch F: Family admission-value expansion

Goal: turn the current specials layer from `7` useful offers into a real family-planning filter.

Priority targets:
- `childrens-museum-atlanta`
- `fernbank-museum`
- `georgia-aquarium`
- `atlanta-history-center`
- `civil-rights-center`
- `museum-of-illusions-atlanta`

Acceptance criteria:
- add only durable, official, recurring admission-value facts
- prefer age-based free windows, recurring free days, and durable member/public access rules
- do not encode one-off promo copy or seasonal marketing pages as destination truth

#### Batch G: Long-tail practical-depth pass

Goal: improve outing usability where coverage exists but planning confidence is still thin.

Priority fields:
- `parking_type`
- `best_time_of_day`
- `practical_notes`
- `accessibility_notes`

Priority target clusters:
- libraries with only minimal utility framing
- rec centers with generic family framing but weak practical notes
- smaller museum / culture stops that still read like descriptions instead of planning advice

Acceptance criteria:
- practical notes should answer visit-shape questions, not repeat the venue description
- accessibility notes should describe friction and fit, not generic inclusivity language

#### Batch H: Park utility specificity

Goal: make the park graph more decision-useful for actual family outings.

Priority targets:
- top Atlanta parks already visible in `atlanta-families`
- broad-map system rows that still only carry generic park amenity language

Priority utility wedges:
- bathrooms / reset points
- shade / heat management
- stroller friction
- picnic / basecamp quality
- “short stop” vs “half-day” vs “full-day” reality

Acceptance criteria:
- prefer official-source support
- avoid generic copy like “great for families”
- encode what kind of day the place actually becomes

#### Batch I: Water-play and playground richness

Goal: deepen the strongest family moat beyond simple venue presence.

Priority targets:
- parks with official splash-pad or aquatic-center pages already in the network
- playground-bearing venues with only broad play-space features today

Priority fields / signals:
- water-play vs pool vs fountain distinction
- shade and bathroom support
- fenced / open feel when official source supports it
- younger-kid vs broad-age fit when the source clearly signals it

Acceptance criteria:
- keep this in `venue_features` / `venue_destination_details`
- do not invent a new entity family

#### Batch J: Audit hardening

Goal: keep the Family layer measurable as depth increases.

Priority follow-ups:
- separate Family-specific specials reporting from global `venue_specials`
- add a “durable family value offers” section to the audit output
- track practical-depth coverage by venue type so the next batch stays data-driven

## What To Avoid

- editorial listicles masquerading as structured data
- event rows used as a substitute for destination intelligence
- portal-local hacks that do not enrich the shared graph
- creating new entity families before the attached-detail model is fully used
- UI work before destination rows are actually live and useful
