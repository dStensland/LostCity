# Yonder Gap-Closure Plan

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034h-yonder-category-content-analysis.md`, `prds/034d-yonder-destination-inventory.md`, `prds/034e-yonder-destination-metadata-contract.md`  
**Status:** Draft  
**As of:** 2026-03-10  
**Purpose:** Turn the Yonder content analysis into an execution plan that closes the highest-risk gaps without bloating V1 beyond what the current platform and content graph can actually support.

---

## 1. Executive Recommendation

Yonder should launch as a **commitment-based outdoor discovery portal** first, not as the full long-range adventure platform described in the PRD.

That means the plan should optimize for:

1. making `an hour` and `half day` unmistakably strong
2. making `full day` credible through destination seeding and selective event recovery
3. keeping `weekend` present but curated, not overpromised
4. deferring or staging the product-capability-heavy layers until the content substrate is real

The main strategic correction is simple:

- do not let future-facing features like camping, quests, badges, and trip hangs define launch scope
- use them as Phase 2 and Phase 3 platform work once Yonder is already useful
- do not spend disproportionate effort chasing route-level trail comprehensiveness where specialist products already win
- let Yonder own destination context, commitment framing, and recommendation quality, then link out when deep route catalog depth matters

---

## 2. Current Gap Map

The current Yonder gaps break into four classes.

### 2.1 Source coverage gaps

These are the gaps between crawler capability and live portal inventory.

Current read:

- `atlanta-outdoor-club` is now live and materially improved Yonder inventory
- `blk-hiking-club` is now live after title-extraction fixes, but remains low-volume
- `atlanta-parks-rec` is technically crawlable but removed from the active Yonder v1 pack because it is too broad to ingest blindly
- `rei-atlanta` is still blocked and cannot be part of the launch promise

Implication:

- the main remaining source gap is now quality control, not activation
- `half day` improved materially after Atlanta Outdoor Club went live
- `full day` improved, but still depends on destination seeding
- source-side work should now be selective and quality-driven

### 2.2 Destination depth gaps

These are the gaps between the PRD promise and the current venue graph.

Current read:

- metro and near-metro anchors are present
- the promoted regional destination layer is now real across 31 anchors
- Yonder still cannot support a strong `weekend` promise from destination inventory alone because campsite and booking-aware overnight depth remain thin

Implication:

- destination seeding is not optional
- it is the main structural requirement for `full day` and `weekend`

### 2.3 Metadata gaps

These are the gaps between raw inventory and decision-quality discovery.

Current read:

- Yonder does not yet have a real commitment-tier substrate for destinations
- descriptions, drive-time logic, duration, difficulty, seasonality, and weather fit are inconsistent or absent
- weekend booking guidance is now partially bridged through existing venue planning fields
- weekend accommodation semantics are now partially bridged through the Yonder intelligence layer
- weekend stay-option semantics are now partially bridged through the Yonder intelligence layer
- weekend booking-provider normalization is now partially bridged through the Yonder intelligence layer
- weekend comparison-ready stay profiles are now partially bridged through the Yonder intelligence layer
- raw `venue_type` is too noisy to drive the UI directly

Implication:

- even where destinations exist, Yonder cannot yet feel smart
- metadata enrichment is a core product dependency, not cleanup work
- existing venue fields can cover a thin booking/readiness layer before a fuller campsite or lodging model exists
- the bridge can now carry weekend accommodation archetypes before unit-level inventory exists
- the bridge can now also carry stay-option semantics before true inventory and availability exist
- the bridge can now normalize booking surfaces before a real provider-backed inventory model exists
- the bridge can now carry inventory-depth and planning-friction comparisons before provider-backed availability exists
- a dedicated accommodation-inventory source model can now carry provider normalization and unit summaries before live provider integration exists

### 2.4 Product capability gaps

These are the layers that require new platform primitives rather than better content alone.

Current read:

- artifacts
- quests
- badges / discovery progress
- camp finder
- conditions intelligence
- trip hangs / group-planning extensions

Implication:

- these should be phased behind the content substrate
- they should be built as reusable platform capabilities, not Yonder-only hacks

---

## 3. What V1 Should Actually Promise

Yonder V1 should promise:

- `what should I do outside soon?`
- `what fits the amount of time I actually have?`
- `what nearby nature, hike, run, paddle, or stewardship option is worth it?`

Yonder V1 should **not** promise:

- a complete North Georgia weekend planner
- a robust camping comparison engine
- automated conditions intelligence with deep confidence
- a full quest / badge ecosystem
- a full-featured multi-day trip coordination product

This is not a downgrade.

It is the correct scope cut that keeps Yonder aligned with the current platform truth while still building the substrate for later phases.

---

## 4. Gap-Closure Strategy By Lane

## 4.1 `AN HOUR`

### Goal

Make this lane feel abundant and low-friction.

### Current state

- already strong

### Needed work

- ensure noisy non-adventure inventory does not dominate
- improve categorization and shelfing so quick outdoor movement is easy to scan
- use metro destination anchors to support nearby destination modules

### Launch posture

- fully in scope for V1

## 4.2 `HALF DAY`

### Goal

Make this Yonder’s strongest signature lane after `an hour`.

### Current state

- decent now
- materially stronger now that Atlanta Outdoor Club is live

### Needed work

- keep Atlanta Outdoor Club healthy and monitored
- keep BLK Hiking Club healthy and treat it as a low-volume, identity-rich source
- use destination anchors to support “quick drive” and “worth the morning” modules
- enrich promoted destinations with commitment and practical metadata

### Launch posture

- fully in scope for V1

## 4.3 `FULL DAY`

### Goal

Make this lane credible, even if not yet deep.

### Current state

- weak in live event inventory
- destination coverage is the main bottleneck
- route-level trail comprehensiveness is not the main bottleneck and should not become a primary build goal

### Needed work

- seed the first regional destination wave
- add manual commitment and activity classification to seeded anchors
- combine event-driven and destination-driven discovery instead of waiting for event supply alone
- treat canonical trails as support data for destination pages and shelves, not as a standalone comprehensiveness race

### Launch posture

- in scope for V1, but with curated inventory targets rather than an assumption of natural source abundance

## 4.4 `WEEKEND`

### Goal

Keep the lane present without letting it define launch quality.

### Current state

- still the clearest risk area

### Needed work

- seed a regional weekend anchor set
- present weekend content as curated escape ideas, not a high-volume live feed
- explicitly defer true camping and trip-planning depth
- use external route curators when users need detailed route choice beyond Yonder's canonical trail layer

### Launch posture

- curated and limited in V1
- avoid claiming full breadth until destination and camping layers are real

---

## 5. Workstreams

## 5.1 Workstream A: Live Source Activation And Quality

### Objective

Close the gap between recovered crawler capability and live portal inventory.

### Actions

1. keep `atlanta-outdoor-club` active and monitor retention / venue quality
2. monitor `blk-hiking-club` as a low-volume, identity-rich source and decide whether more source expansion is needed around that lane
3. leave `atlanta-parks-rec` out of the active launch pack until a scoped/filterable version exists
4. decide whether `rei-atlanta` is worth further recovery effort or should be replaced/deferred
5. review source-level category/tag quality so Yonder shelves are based on adventure intent, not raw categories

### Success criteria

- Atlanta Outdoor Club remains a stable live contributor
- BLK contributes retained events and is sized realistically in launch assumptions
- noisy parks-rec inventory is either intentionally used or intentionally filtered out
- launch assumptions no longer depend on a broken REI crawler

### Main risk

- some recovered sources may add quantity without improving Yonder identity

## 5.2 Workstream B: Regional Destination Seeding

### Objective

Close the structural destination gap behind `full day` and `weekend`.

### Wave 1 anchor set

- Amicalola Falls
- Tallulah Gorge
- Cloudland Canyon
- Blood Mountain
- Brasstown Bald
- Raven Cliff Falls
- Vogel State Park
- Fort Mountain State Park
- Boat Rock
- Springer Mountain

### Wave 2 support set

- DeSoto Falls
- Helton Creek Falls
- Rabun Bald
- Black Rock Mountain State Park
- Cohutta Overlook

### Wave 3 support set

- Sweetwater Creek State Park
- Panola Mountain State Park
- Cochran Shoals Trail
- Shoot the Hooch at Powers Island
- Island Ford CRNRA Boat Ramp
- Chattahoochee Bend State Park

### Wave 4 water/support set

- Chattahoochee River National Recreation Area
- East Palisades Trail
- Indian Trail Entrance, East Palisades Unit
- Whitewater Express Columbus
- Etowah River Park

### Wave 5 camping/overnight support set

- Red Top Mountain State Park
- Hard Labor Creek State Park
- Fort Yargo State Park
- Don Carter State Park
- Unicoi State Park

### Actions

1. treat Wave 1 through Wave 5 destination seeding as complete for the current promoted set
2. finish launchability work across the 31-anchor promoted set:
   - commitment-oriented metadata depth
   - metadata completeness
   - canonical relationships where needed
3. attach at least Tier 0 metadata and three Tier 1 fields to each promoted anchor
4. prepare the next support wave for additional water access, campsite inventory, and destination clusters that make weekend shelves feel less repetitive

### Success criteria

- Yonder has a defendable promoted destination map across 31 anchors
- `full day` and `weekend` modules can feature real regional anchors
- at least thirty-one promoted anchors are launchable by the metadata contract

### Main risk

- raw insertion without metadata will create the illusion of depth without actual usefulness

## 5.3 Workstream C: Metadata Enrichment Layer

### Objective

Make Yonder feel decision-ready, not just inventory-rich.

### Actions

1. define the storage path for Yonder destination enrichment
2. assign `commitment_tier` for promoted destinations
3. normalize `destination_type` and `primary_activity`
4. add short descriptions and practical notes to promoted anchors
5. add launch-critical enrichment fields:
   - drive time
   - difficulty
   - typical duration
   - best seasons
   - weather fit tags

### Success criteria

- promoted destinations have all Tier 0 fields
- promoted destinations have enough Tier 1 fields to support confidence at decision time
- commitment-based browse no longer depends on editorial guesswork

### Main risk

- if this becomes a loose editorial spreadsheet instead of a reusable data layer, the platform loses compounding value

## 5.4 Workstream D: Yonder V1 Product Scope Cut

### Objective

Make the launch shape explicit so the product does not drift into fantasy-scope implementation.

### Ship in V1

- commitment-tier browsing
- strong `an hour` and `half day` discovery
- curated `full day` recommendations
- limited `weekend` escape ideas
- destination modules backed by launchable metadata
- basic outdoor source/event freshness

### Defer from V1

- full camp finder
- automated conditions engine
- artifact discovery system as a real data model
- quests / badges / progress tracking
- rich trip hangs coordination
- route-level trail catalog completeness beyond Yonder's canonical/support layer

### Success criteria

- the portal promise matches the real inventory and capabilities
- the first shipped surface feels strong, not broad-and-thin

### Main risk

- ambition may push these deferred layers back into the build before the substrate exists

## 5.5 Workstream E: Platform Primitive Planning

### Objective

Separate what is Yonder-local from what should become shared platform capability.

### Candidate reusable primitives

- commitment tier
- outdoor destination enrichment contract
- destination type taxonomy
- weather fit tags
- artifact entity model
- quest / progress model
- camping inventory model
- trip-planning extensions for outings / hangs
- outbound route-curation contract for destination pages and recommendation modules

### Success criteria

- new data work benefits future portals, not just Yonder
- product development docs can classify new portal asks against these primitives

---

## 6. Phase Plan

## Phase 0: Inventory Reality

### Duration

- immediate

### Focus

- get recovered inventory live
- measure what changes
- stop assuming dry-run output equals usable launch inventory

### Deliverables

- live Atlanta Outdoor Club run and retained-count measurement
- live BLK qualification run and parser-gap confirmation
- Atlanta Parks Rec qualification decision
- updated event counts by lane
- decision on REI: recover, replace, or defer

### Exit gate

- Yonder counts reflect actual recovered-source contribution
- non-fit sources are no longer hidden inside launch assumptions

## Phase 1: Destination Credibility

### Duration

- next

### Focus

- seed the first regional anchors
- enrich the first promoted destination set

### Deliverables

- Wave 1 through Wave 5 destination sets
- metadata-complete promoted destination list
- first curated `full day` and `weekend` shelves

### Exit gate

- Yonder can make a credible regional recommendation, not just a metro one

## Phase 2: Smart Discovery

### Duration

- after destination credibility is in place

### Focus

- make commitment browsing and recommendation modules feel intentional
- use conditions-lite editorial logic where supported

### Deliverables

- browse and feed logic aligned to commitment tiers
- curated recommendation rules for heat, rain, seasonality, and drive burden

### Exit gate

- Yonder can answer “what fits my time and this weekend’s conditions?” at a basic but credible level

## Phase 3: Platform Expansion

### Duration

- after Yonder’s core discovery loop is strong

### Focus

- build the capability-heavy layers

### Deliverables

- artifact model
- quest/progress model
- camping model
- trip-hangs extension plan
- outbound route-link strategy for AllTrails and similar curators where specialist depth is better than internal replication

### Exit gate

- deeper engagement loops are supported by real content and a stable launch core

---

## 7. Recommended Near-Term Sequence

This is the highest-leverage order of operations.

1. run the recovered sources live and refresh the category analysis
2. fix or exclude the recovery sources that still fail quality or fit review
3. classify the actual contribution of the retained sources by commitment tier
4. seed the first regional anchor wave
5. enrich the promoted destination set to the Yonder metadata contract
6. lock the V1 scope cut in writing before frontend build expands

This sequence matters.

If we build the frontend promise before Steps 1 through 4 are done, the interface will overstate what the content graph can support.

---

## 8. Concrete Targets

The plan needs measurable launch bars.

### Source-side targets

- Atlanta Outdoor Club contributes live retained inventory at meaningful scale
- BLK Hiking Club contributes a real identity-rich hiking lane, even if volume stays low
- Atlanta Parks Rec is either intentionally included as a supporting lane or demoted from the adventure core
- REI is no longer a hidden dependency

### Destination-side targets

- at least `10` metro / near-metro anchors promoted with launchable metadata
- at least `21` promoted anchors with launchable metadata
- `full day` and `weekend` shelves each have enough real inventory to avoid repetition

### Metadata targets

- every promoted destination has all Tier 0 fields
- every promoted destination has at least three Tier 1 fields
- commitment tier is explicit for every top-level promoted destination

### Product targets

- Yonder homepage can support clear shelves for:
  - `an hour`
  - `half day`
  - `full day`
  - `weekend`
- the `weekend` shelf is explicitly curated, not treated as a naturally high-volume feed

---

## 9. What To Cut If Time Compresses

If delivery pressure increases, cut in this order.

### Cut first

- camp finder depth
- full quest / badge loops
- sophisticated conditions automation
- group-planning expansion beyond lightweight reuse

### Keep at all costs

- commitment-tier browsing
- destination seeding for `full day` and `weekend`
- destination metadata enrichment
- live source activation for the recovered hiking/outdoor sources

Reason:

These are the pieces that actually close the launch risk. The rest mostly adds aspiration.

---

## 10. Recommended Strategic Position

Yonder should position itself in Phase 1 as:

- the fastest way to find something worth doing outside
- organized by the amount of time you actually have
- strong on metro and quick-drive adventure
- growing into regional escapes

That is honest, differentiated, and platform-aligned.

It avoids the two biggest mistakes available right now:

1. launching a broad but shallow “outdoor everything” portal
2. building expensive capability layers before the content graph can justify them
