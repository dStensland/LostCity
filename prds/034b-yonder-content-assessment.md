# BP-1b Content Assessment: Yonder

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034a-yonder-content-sweep-plan.md`  
**Status:** Draft  
**Assessment type:** projected content and capability gap analysis with limited runtime validation

---

## 1. Executive Read

Yonder is viable as a portal concept right now, but not in the full shape promised by the PRD.

The current Lost City stack is already strong enough to support:

- a commitment-oriented outdoor discovery portal
- a live feed of urban and metro outdoor activity
- a first pass at trail / park / river / climbing destination discovery
- an editorially seeded “interesting places” layer

The current stack is **not** yet strong enough to support, without major new work:

- full regional destination depth from Atlanta through North Georgia
- a true camping aggregation product
- first-class quests, badges, and discovery tracking
- a robust conditions engine driven by structured outdoor metadata
- a fully realized multi-day trip planning system

That means the Yonder opportunity is real, but the launch shape needs discipline.

---

## 2. What We Are Sweeping

The Yonder sweep covers six layers because this portal depends on more than event coverage.

### 2.1 Outdoor / Adventure Event Sources

This is the freshness layer: what makes Yonder feel alive this weekend.

Primary source families already present in the repo:

- `atlanta-outdoor-club`
- `blk-hiking-club`
- `rei-atlanta`
- `chattahoochee-riverkeeper`
- `chattahoochee-nature`
- `dunwoody-nature`
- `park-pride`
- `trees-atlanta`
- `beltline-fitness`
- `big-peach-running`
- `monday-night-run-club`
- `meetup.outdoors`
- `central-rock-gym-atlanta`
- `bicycle-tours-atlanta`
- `atlanta-parks-rec`
- `piedmont-park`
- `south-river-forest`

### 2.2 Destination Inventory

This is the “where can I go?” layer:

- urban parks and trails
- quick-drive hikes and river access
- climbing / paddling / bike infrastructure
- day-trip mountain destinations
- weekend anchors

### 2.3 Artifact Candidates

This is the proprietary taste layer:

- waterfalls
- viewpoints and fire towers
- swimming holes and river spots
- hidden trails and overlooked green spaces
- geological or historical oddities
- urban exploration artifacts

### 2.4 Camping Inventory

This is the comparison / booking-adjacent layer:

- state parks
- recreation.gov / USFS / dispersed sites
- Hipcamp
- private campgrounds
- glamping and cabin inventory

### 2.5 Conditions Intelligence

This is the adaptive recommendation layer:

- what weather / season says should be promoted
- what should be downranked
- what editorial statements can be made honestly from current data

### 2.6 Planning and Social Reuse

This is the capability audit:

- what Yonder can inherit from `hangs`
- what it can inherit from outing planner / playbook
- what must be new

---

## 3. Current Content Surface: What Appears Reachable Today

## 3.1 Event Source Strength

The repo already contains a meaningful outdoor activity source pack.

### Strongest existing source categories

1. **Guided hikes / group adventure**
   - Atlanta Outdoor Club
   - BLK Hiking Club
   - Meetup outdoors

2. **Nature programming / interpretive experiences**
   - Chattahoochee Nature Center
   - Dunwoody Nature Center

3. **Water / stewardship / conservation**
   - Chattahoochee Riverkeeper
   - Trees Atlanta
   - Park Pride
   - South River Forest

4. **Urban outdoor fitness and social movement**
   - BeltLine Fitness
   - Big Peach Running
   - Monday Night Run Club

5. **Climbing / cycling / skills**
   - Central Rock Gym Atlanta
   - Bicycle Tours of Atlanta
   - REI Atlanta

### What this likely means for Yonder

This source pack is good enough to support:

- `hour` and `halfday` discovery
- urban and metro exploration
- recurring social loops around the outdoors
- stewardship and purpose-driven adventure

It is weaker for:

- serious day-trip inventory
- weekend expedition inventory
- camping-specific freshness
- whitewater / mountain / backpacking trip planning

## 3.2 Runtime Validation Snapshot

Limited dry-run checks were performed against three core source candidates.

### `chattahoochee-riverkeeper`

Dry-run succeeded.

- source record exists in live `sources`
- crawler ran in dry-run mode
- result: `11 found, 0 new, 11 updated`

Interpretation:

- this is a valid current source for Yonder
- it appears to have useful event freshness
- it supports the “water + stewardship + purpose-driven outdoors” lane well

### `atlanta-outdoor-club`

Dry-run failed before crawl execution because the live `sources` table returned zero rows for slug `atlanta-outdoor-club`.

Interpretation:

- crawler module exists
- source is not currently registered in DB
- this is a provisioning / source-pack gap, not a concept gap

### `rei-atlanta`

Dry-run failed before crawl execution because the live `sources` table returned zero rows for slug `rei-atlanta`.

Interpretation:

- crawler module exists
- source is not currently available as a live source record in the current DB target
- again, this is a source-activation gap

### Assessment implication

The outdoor content opportunity is not blocked only by crawler code. It is also blocked by:

- source registration completeness
- source-pack provisioning
- source activation and federation hygiene

That is exactly the sort of issue the portal factory process should catch before a Yonder build starts.

---

## 4. Destination Surface: What Exists vs. What The PRD Promises

## 4.1 Existing / Adjacent Destination Support

The repo already shows three forms of destination groundwork:

1. **Outdoor venue seeding**
   - `crawlers/scripts/import_outdoor_recreation.py`
   - examples include Sweetwater Creek, Chattahoochee River NRA, Arabia Mountain, Whitewater Express, REI, climbing gyms

2. **Trail venue cleanup / reclassification**
   - `crawlers/scripts/backfill_trail_venues.py`
   - indicates active effort to normalize trail-oriented venues in the base data layer

3. **Spot detail artifact-style relationships**
   - current app can surface child venues as “Inside This Venue” artifacts via `parent_venue_id`
   - useful adjacency, but not the Yonder artifact system

## 4.2 PRD Destination Ambition

The Yonder PRD explicitly targets destinations such as:

- Amicalola Falls
- Tallulah Gorge
- Cloudland Canyon
- Raven Cliff Falls
- DeSoto Falls
- Helton Creek Falls
- Blood Mountain
- Springer Mountain
- Panola Mountain
- Boat Rock
- Chattahoochee River access points
- Brasstown Bald
- Rabun Bald
- Cohutta
- Vogel
- Fort Mountain

## 4.3 Projected Read

The current repo is strongest on:

- Atlanta and near-metro outdoors
- selected metro destinations
- some high-signal outdoor anchors

The repo is weak on:

- complete North Georgia destination depth
- systematic waterfall / summit / fire tower coverage
- destination metadata normalization for comparison

Conclusion:

Yonder’s destination promise is only partially supported today. The inventory appears sufficient for a metro-first or “soft regional” launch, but not yet for the full Atlanta-to-North-Georgia positioning.

---

## 5. Metadata Readiness

This is the biggest structural gap.

Yonder’s differentiation depends on:

- commitment tiers
- drive time
- duration
- difficulty
- best season
- permit / reservation friction
- weather suitability
- group suitability

The repo does **not** currently expose a first-class general-purpose outdoor metadata layer for those fields.

### Important nuance

There is an existing `commitment_level` concept in the volunteer domain in `database/schema.sql`, but it is scoped to volunteer opportunities (`drop_in`, `ongoing`, `lead_role`) and is not reusable as the Yonder commitment system.

### What this means

Even where venues or events already exist, Yonder cannot yet deliver its intended decision-support layer without either:

- new schema fields
- heavy enrichment
- or a temporary editorial mapping layer

Projected severity: `high`

---

## 6. Artifact and Quest Readiness

## 6.1 What exists now

There is an “artifacts” concept in the current app, but in practice it is:

- a child-venue relationship under a parent venue
- displayed as “Inside This Venue”

This is useful precedent, but it is **not** the Yonder artifact model.

## 6.2 What does not yet exist

The first-class Yonder PRD requires:

- `artifacts`
- `quests`
- `quest_artifacts`
- `artifact_discoveries`
- likely `user_badges`

Those are not currently present as first-class schema or platform capabilities.

## 6.3 Projected read

The content side of artifacts is feasible because it can begin editorially.

The product side is not yet ready because:

- there is no cross-portal artifact schema
- there is no quest/progress model
- there is no earned-badge substrate

Projected severity:

- artifact content gap: `moderate`
- artifact product gap: `high`
- quest / badge gap: `very high`

---

## 7. Camping Readiness

Camping is the most underbuilt content area relative to the PRD.

### What the PRD wants

- state parks
- USFS / recreation.gov
- private campgrounds
- Hipcamp
- glamping
- cabins

### What the repo currently shows

- concept in the PRD
- no first-class camping schema
- no `camping_sites` table
- no normalized camp comparison surface
- no visible proof yet of source integration for those inventory classes

### Projected read

Camp Finder is **not** launch-ready as a full product surface.

Most likely viable near-term shapes:

1. curated editorial camping picks with stable link-outs
2. limited state-park-first inventory
3. deferred full comparison finder

Projected severity: `very high`

---

## 8. Conditions Intelligence Readiness

There is partial adjacency in the repo:

- weather-aware city pulse logic
- weather mapping utilities
- some recommendation context systems

But there is no reusable outdoor recommendation engine that can say, with confidence:

- waterfalls are peaking
- this is a shaded-trail weekend
- summit hikes should be downranked
- heat should redirect users toward water

### Why this is hard

Conditions intelligence is not only weather data.

It also needs:

- destination metadata
- seasonality rules
- practical field coverage
- safe recommendation constraints

### Projected read

Yonder can probably launch with a **small, editorially opinionated conditions banner** before it can launch with a robust structured conditions engine.

Projected severity: `moderate to high`

---

## 9. Planning / Social Reuse Readiness

The repo already has:

- `hangs`
- outing planner
- playbook

That is meaningful leverage.

### What it likely supports

- planning around an anchor
- lightweight social intent
- some recommendation and sequencing reuse

### What it likely does not yet support

- multi-day trip objects
- gear assignment
- carpool logistics
- trip member roles
- destination-first planning flows built for outdoor travel

### Projected read

Yonder should treat current planning capabilities as a reusable substrate, not as proof that `trip_hangs` is already solved.

Projected severity: `moderate`

---

## 10. Projected Gap Matrix

| Area | Current strength | Main gap | Severity |
|---|---|---|---|
| Outdoor event freshness | Good for urban / metro outdoor activity | uneven day-trip / weekend depth | Moderate |
| Destination inventory | Partial | thin North Georgia / regional depth | High |
| Outdoor metadata | Weak | no first-class commitment / difficulty / season schema | Very high |
| Artifact content | Partial | needs editorial candidate sweep and seed pack | Moderate |
| Artifact product model | Weak | no first-class artifact schema | High |
| Quest / badge system | Weak | no quest/progress/badge primitive | Very high |
| Camping inventory | Weak | no normalized camping data model or source layer | Very high |
| Conditions intelligence | Partial adjacency | lacks structured outdoor recommendation engine | Moderate-High |
| Trip planning reuse | Partial | current planning tools are not yet outdoor-trip-native | Moderate |
| Source activation hygiene | Partial | crawler modules exist but some source records are missing in DB | High |

---

## 11. Launch Recommendation

Yonder should not launch as “everything in the PRD at once.”

The strongest launch shape from current evidence is:

### Phase 1: Discovery-first Yonder

Ship:

- commitment-based outdoor feed and browse
- metro + near-regional destination discovery
- outdoor events from the strongest existing source pack
- initial destination enrichment
- editorial “weekend picks” and “go do this” framing

Delay:

- full quest system
- full camp finder
- full trip hangs
- heavy conditions automation

### Phase 1.5: Taste layer

Add:

- seeded artifacts
- 3-5 editorial quests
- lightweight progress framing if schema is ready
- stronger destination storytelling

### Phase 2: Platform lift

Add only after the content and data layer are ready:

- first-class artifacts / quests / discoveries
- badges
- camp finder
- trip hangs
- conditions rules engine

---

## 12. Hero Content Assessment

The strongest likely Yonder hero content types are:

1. a timely outdoor event with social pull
   - example class: paddle trip / guided hike / trail cleanup / group run

2. a high-payoff day-trip destination
   - example class: waterfall, summit, gorge, river access

3. an artifact with narrative pull
   - example class: hidden waterfall, fire tower, strange overlook, “most people miss this” trail

If Yonder cannot make those three content types feel compelling, it will collapse into a generic outdoors listing app.

---

## 13. Immediate Remediation Priorities Before Build

1. **Source registration audit**
   - confirm all Yonder P0/P1 crawler modules have live `sources` records
   - treat missing source registration as a provisioning blocker

2. **Destination spreadsheet**
   - inventory what already exists for trails / parks / water / climbing
   - separate metro-ready from regional-missing

3. **Metadata contract draft**
   - define minimum Yonder destination fields before UI work proceeds

4. **Artifact candidate sweep**
   - produce 50 raw candidates, then narrow to the first 20

5. **Camping feasibility audit**
   - prove whether Camp Finder is v1, v1.5, or v2

---

## 14. Bottom Line

Yonder is promising because the repo already contains enough outdoor event and portal infrastructure to make a differentiated discovery product.

But the current system is still much closer to:

- “what should I go do outside this week?”

than to:

- “the definitive adventure operating system for Atlanta through North Georgia.”

That larger version is achievable, but only if the next work wave focuses on:

- destination enrichment
- source activation hygiene
- artifact seeding
- and a clean platform decision about which Yonder features should become shared primitives.
