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

- `atlanta-families` currently links to `563` venues through accessible Family events/programs, with `118` target-type destinations (`park`, `library`, `museum`, `garden`, `community_center`, `pool`, `campground`, `trail`, `trailhead`, `visitor_center`, `plaza`)
- among those `118` target-type Family destinations:
  - `56` currently have `venue_destination_details`
  - `10` have active `venue_features`
  - `0` have active `venue_specials`
- destination-detail depth is still thin, but no longer zero:
  - `56` with `family_suitability`
  - `2` with `parking_type`
  - `56` with `practical_notes`
  - `56` with `weather_fit_tags`
- current Family destination richness is still materially missing for:
  - `community_center` venues
  - most `park` venues
  - most `museum` venues
  - many park-system child destinations and playground/water-play attachments
- the strongest immediate gap candidates are:
  - High Museum of Art
  - Pittman Park Recreation Center
  - Shorty Howell Park
  - McDaniel Farm Park
  - Fernbank Museum of Natural History
  - Atlanta Botanical Garden
- the strongest source-family gap candidates are:
  - `fulton-library`
  - `club-scikidz-atlanta`
  - `stone-mountain-park`
  - `atlanta-botanical-garden`
  - `gwinnett-family-programs`
  - `puppetry-arts`

Interpretation:

- Family has meaningful activity depth, but destination-depth is still far behind the venue universe already visible to the portal
- official-source destination enrichment is the right lever: the audit moved materially as soon as the first source canaries landed
- libraries are not absent from Family after all; they were undercounted by the first audit boundary and are now the clearest large-scale destination enrichment opportunity
- the next structural gap is no longer branch utility, it is parks/community-center richness and attached child features like playgrounds and water play

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
- [crawlers/sources/_rec1_base.py](/Users/coach/Projects/LostCity/crawlers/sources/_rec1_base.py) now supports a light tenant-level destination-enrichment hook for Family-heavy Rec1 systems
- [crawlers/sources/gwinnett_parks_rec.py](/Users/coach/Projects/LostCity/crawlers/sources/gwinnett_parks_rec.py) now uses that hook to project touched Gwinnett community centers and park venues into shared `destination_details`
- focused envelope tests added:
  - [crawlers/tests/test_gwinnett_ehc_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_ehc_destination_envelope.py)
  - [crawlers/tests/test_autrey_mill_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_autrey_mill_destination_envelope.py)
  - [crawlers/tests/test_fulton_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_fulton_library_destination_envelope.py)
  - [crawlers/tests/test_gwinnett_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_library_destination_envelope.py)
  - [crawlers/tests/test_dekalb_library_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_dekalb_library_destination_envelope.py)
  - [crawlers/tests/test_gwinnett_parks_rec_destination_envelope.py](/Users/coach/Projects/LostCity/crawlers/tests/test_gwinnett_parks_rec_destination_envelope.py)
  - [crawlers/tests/test_rec1_base.py](/Users/coach/Projects/LostCity/crawlers/tests/test_rec1_base.py)
- all five source extensions were canaried in production
- the Gwinnett parks/community-center canary is also live and already moving Family program venues into shared destination-detail coverage
- the Fulton, Gwinnett, and DeKalb library canaries are live and producing branch destination-detail rows in production

Result after the canaries:

- Family target-type destination coverage moved from the corrected baseline of:
  - `0` with `venue_destination_details` in the original owned-row audit
  - to `56` with `venue_destination_details` in the current federated audit after source execution
- library branch utility is now the strongest completed wedge so far:
  - `fulton-library`: `31` branch venues with destination details
  - `gwinnett-library`: `9` branch venues with destination details
  - `dekalb-library`: `13` Family-visible venues with destination details after fixing the branch-collapse bug
- the next wedge is now proven at the cluster level:
  - `gwinnett-family-programs` moved from `3/13` venues with destination details to `6/13` during the Rec1 canary
  - `gwinnett-parks-rec` moved from `3/10` venues with destination details to `6/10` during the same canary
- the highest-impact newly covered Family venues in that Rec1 cluster are:
  - Bogan Park Community Recreation Center
  - George Pierce Park Community Recreation Center
  - Bethesda Community Recreation Center
  - Pinckneyville Park Community Recreation Center
- overall Family-linked venue coverage also moved:
  - `552` total venues / `107` target-type destinations
  - to `563` total venues / `118` target-type destinations
- `venue_features` has not yet moved at the same pace and remains:
  - `10` with active `venue_features`
- detail-depth coverage moved materially on:
  - `family_suitability`
  - `practical_notes`
  - `weather_fit_tags`

Interpretation:

- the pattern works
- the library wedge is now meaningfully established
- the next execution wave should shift toward:
  - parks/community-center systems with Family program demand but no destination richness
  - single-venue, Family-heavy official destinations for richer attached features
  - attached child features like playgrounds, splash pads, and story-walk-style amenities

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

## What To Avoid

- editorial listicles masquerading as structured data
- event rows used as a substitute for destination intelligence
- portal-local hacks that do not enrich the shared graph
- creating new entity families before the attached-detail model is fully used
- UI work before destination rows are actually live and useful
