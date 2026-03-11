# Yonder Destination Inventory

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034b-yonder-content-assessment.md`, `prds/034c-yonder-source-audit.md`  
**Status:** Draft  
**Method:** production `venues` inventory checks against Yonder seed destinations plus targeted metadata sampling

---

## 1. Purpose

This inventory answers:

1. Which Yonder anchor destinations already exist in the current venue layer?
2. Which parts of the PRD destination map are still missing?
3. Is current destination metadata good enough for Yonder’s decision-support promises?

---

## 2. Summary Read

The destination layer is in a mixed but usable state.

### What is already workable

- a small but credible metro / near-metro outdoor anchor set exists now
- several core destinations already have:
  - stable slugs
  - geo
  - images
  - basic type classification

### What is not yet workable

- the PRD’s North Georgia and weekend-trip layer is now materially seeded across mountain, water, and camping-adjacent anchors
- destination metadata is not rich enough for commitment-based guidance
- raw park / trail / artifact venue types are too noisy to power Yonder directly without curation

---

## 3. Existing Anchor Destinations Confirmed

Confirmed current destination anchors include:

| Destination | Slug | Type | Notes |
|---|---|---|---|
| Sweetwater Creek State Park | `sweetwater-creek-state-park` | `trail` | good anchor for quick drive / halfday |
| Chattahoochee River National Recreation Area | `chattahoochee-river-nra` | `park` | good anchor for water / trail / quick drive |
| Arabia Mountain | `arabia-mountain` | `park` | strong unique-landscape anchor |
| Panola Mountain State Park | `panola-mountain` | `park` | strong south/east metro day option |
| Morningside Nature Preserve | `morningside-nature-preserve` | `trail` | strong urban “an hour” anchor |
| Cascade Springs Nature Preserve | `cascade-springs-nature-preserve` | `trail` | strong urban hidden-gem anchor |
| Shoot the Hooch at Powers Island | `shoot-the-hooch-powers-island` | `park` | strong water-access anchor |
| BeltLine Eastside Trail | `beltline-eastside-trail` | `park` | strong urban commitment anchor |
| Atlanta BeltLine Westside Trail | `atlanta-beltline-westside-trail` | `trail` | strong urban commitment anchor |
| Stone Mountain Walk-Up Trail | `stone-mountain-walk-up-trail` | `trail` | strong halfday / fullday edge case anchor |

These are enough to support a first pass at:

- `hour`
- `halfday`
- some `fullday`

They are not enough by themselves to support the PRD’s intended regional spread.

### Wave 1 through Wave 5 promoted anchors now seeded

The first five Yonder destination passes now cover these promoted slugs:

- `amicalola-falls`
- `tallulah-gorge`
- `cloudland-canyon`
- `blood-mountain`
- `springer-mountain`
- `brasstown-bald`
- `raven-cliff-falls`
- `vogel-state-park`
- `fort-mountain-state-park`
- `boat-rock`
- `desoto-falls`
- `helton-creek-falls`
- `rabun-bald`
- `black-rock-mountain`
- `cohutta-overlook`
- `sweetwater-creek-state-park`
- `panola-mountain`
- `cochran-shoals-trail`
- `shoot-the-hooch-powers-island`
- `island-ford-crnra-boat-ramp`
- `chattahoochee-bend-state-park`
- `chattahoochee-river-nra`
- `east-palisades-trail`
- `indian-trail-entrance-east-palisades-unit-chattahoochee-nra`
- `whitewater-express-columbus`
- `etowah-river-park`
- `red-top-mountain-state-park`
- `hard-labor-creek-state-park`
- `fort-yargo-state-park`
- `don-carter-state-park`
- `unicoi-state-park`

Interpretation:

### Weekend accommodation-inventory source layer

The promoted weekend subset now also has a dedicated accommodation-inventory source model alongside the Yonder bridge.

- weekend anchors checked: `13`
- with inventory-source coverage: `13`
- normalized providers:
  - `ga_state_parks`
  - `unicoi_lodge`
  - `whitewater_express`
  - `self_guided`

Interpretation:

- Yonder can now separate booking providers and unit summaries from destination semantics
- this is the right substrate for eventual availability and price integration without overloading the destination bridge

- the structural “missing regional anchors” problem has moved materially
- the first water/access support layer is now credible instead of purely aspirational
- the weekend shelf now has a more realistic camping-adjacent base instead of relying almost entirely on mountain parks
- the next destination problem is density beyond the current promoted water, waterfall, and camping-adjacent set, not anchor presence itself

---

## 4. Missing or Unconfirmed PRD Destinations

The following high-value follow-up buckets still need more work even after the first 31 promoted anchors:

- additional river and paddle access nodes beyond the first Chattahoochee and Etowah layer
- more wilderness / overlook support inside the Cohutta lane
- secondary waterfall density beyond the current anchor set
- future campsite inventory and lodging comparison logic beyond broad park anchors

Interpretation:

- the highest-value regional anchor gap is no longer the main blocker
- the next missing bucket is support-layer density around water, weekend, and artifact clustering

---

## 5. Sample Metadata Quality Check

A full 31-destination promoted-anchor sample was checked for basic metadata completeness.

### Sample result

- sample size: `31`
- with image: `31`
- with short description: `31`
- with geo: `31`
- with website: `31`
- with typical duration: `31`
- with planning notes: `31`

### Interpretation

The promoted Yonder set is now launchable at the card and decision-support baseline:

- the anchor layer is no longer visually thin
- the seeded set now has enough structured support to drive commitment shelves across metro half-day, regional full-day, and curated weekend lanes
- the remaining problem is breadth, not basic launchability of the promoted set

### Weekend booking readiness

The promoted weekend subset now has a first booking-aware support layer.

- weekend anchors checked: `13`
- with booking decision flags: `13`
- with reservation URL: `11`

Interpretation:

- Yonder can now distinguish between book-ahead weekend nodes and show-up destinations
- this materially improves weekend planning guidance on promoted anchors without a new schema
- the next gap is campsite and lodging comparison depth, not total booking blindness

### Weekend overnight semantics

The promoted weekend subset now also has explicit overnight-support semantics in the Yonder bridge.

- weekend anchors checked: `13`
- with overnight support typing: `13`
- represented archetypes:
  - `camp_capable`
  - `cabin_capable`
  - `lodge_capable`
  - `operator_bookable`
  - `day_use_only`

Interpretation:

- Yonder can now distinguish between camp-first parks, cabin-capable parks, lodge-style weekends, operator-booked adventure trips, and scenic weekend objectives that are not stayable on their own
- this is the first real substrate for future campsite and lodging comparison work

### Weekend stay-option semantics

The promoted weekend subset now also has explicit stay-option coverage in the Yonder bridge.

- weekend anchors checked: `13`
- with stay-option coverage: `13`
- represented stay-option types:
  - tent sites / campground inventory
  - cabins
  - lodge rooms
  - operator-booked adventure packages
  - self-planned day-use objectives
- normalized booking surfaces:
  - Georgia State Parks / ReserveAmerica
  - direct lodge booking
  - direct operator booking
  - self-planned / no managed booking surface

Interpretation:

- Yonder can now talk about what the overnight setup actually is, not just whether a booking link exists
- this is the right bridge step before a true unit-level availability model exists

### Weekend stay-profile comparison layer

The promoted weekend subset now also has comparison-ready stay profiles in the Yonder bridge.

- weekend anchors checked: `13`
- with stay-profile coverage: `13`
- represented comparison fields:
  - inventory depth
  - planning lead time
  - coarse price signal

Interpretation:

- Yonder can now compare weekend anchors along inventory shape and planning friction, not just stay type
- this is the right bridge step before true availability, price, and unit counts exist

---

## 6. Inventory Shape By Type

Top-level current venue counts in production:

| Venue type | Count |
|---|---:|
| `trail` | 14 |
| `park` | 137 |
| `artifact` | 51 |
| `fitness_center` | 54 |
| `retail` | 10 |

These counts are directionally useful but not directly launchable for Yonder.

### Why raw counts overstate readiness

The `park` and `artifact` buckets are noisy. They include:

- true outdoor anchors
- urban parks with little Yonder value
- non-Yonder “artifacts” like local monuments, graves, signs, and museum objects
- cross-city / non-Atlanta inventory contamination

So Yonder cannot rely on `venue_type` alone. It needs a curated destination layer.

---

## 7. Destination Tiering For Yonder

## 7.1 Tier A: Launchable Now

These are good first-wave Yonder anchors:

- Sweetwater Creek State Park
- Chattahoochee River National Recreation Area
- Arabia Mountain
- Panola Mountain State Park
- Morningside Nature Preserve
- Cascade Springs Nature Preserve
- Stone Mountain Walk-Up Trail
- Shoot the Hooch at Powers Island
- BeltLine Eastside Trail
- Atlanta BeltLine Westside Trail

Why:

- they exist in current inventory
- they cover multiple commitment tiers
- they can anchor both destination and editorial modules

## 7.2 Tier B: Launchable With Enrichment

Likely current or near-current candidates that need better metadata, curation, or canonicalization:

- Davidson-Arabia Mountain Nature Preserve
- Arabia Mountain PATH
- Chattahoochee River Trail - Cochran Shoals
- Chattahoochee River NRA sub-units
- Beltline Arboretum
- additional metro trail / water access nodes surfaced by cleanup scripts

## 7.3 Tier C: Missing And Must Be Seeded Next

These are now the most important follow-up buckets after the first 31 promoted anchors:

- additional Chattahoochee, Etowah, and paddle-access nodes
- Cohutta-area support anchors beyond a single overlook
- secondary waterfall density
- future campsite, cabin, and booking-layer support beyond state park anchors

---

## 8. Destination Gaps By Product Need

### 8.1 Commitment Gap

Yonder’s primary nav depends on `hour`, `halfday`, `fullday`, `weekend`.

Current venue records do not yet provide that classification explicitly.

Implication:

- Yonder needs either a destination enrichment pass or a temporary editorial mapping table before UI implementation

### 8.2 Decision-Support Gap

Current destination records often lack:

- useful short descriptions
- duration
- difficulty
- best season
- permit or reservation friction
- commitment fit

Implication:

- Yonder can look visually credible before it becomes decision-useful
- this is a product risk if not addressed early

### 8.3 Regional Depth Gap

Metro Atlanta and nearby anchors are present.
The first North Georgia anchor wave is now present.

Implication:

- Yonder can now credibly point to real regional escapes
- it still cannot credibly launch as a fully developed North Georgia adventure layer because support density and metadata depth are still thin

### 8.4 Launchability Gap Within The Seeded Wave

The Wave 1 anchor set now clears the most visible card-readiness fields.

Current read on the 10-wave sample:

- with short description: `10`
- with website: `10`
- with image or hero image: `10`

Implication:

- the anchor-presence problem is largely solved
- the seeded wave can now support real destination modules visually
- the remaining launchability gap is structured guidance depth, not basic destination-card readiness
### 8.5 Data Cleanliness Gap

The raw `artifact` and `park` buckets are noisy.

Examples of non-Yonder-fit artifact inventory include:

- monuments
- grave sites
- museum-adjacent objects
- city oddities with weak outdoor relevance

Implication:

- artifact and destination selection must be intentionally curated
- naive type-based surfacing will degrade the brand quickly

---

## 9. Recommended Next Actions

1. Build a canonical Yonder destination seed list with three buckets:
   - launch now
   - enrich
   - seed new

2. Seed the high-value missing regional anchors first:
   - waterfalls
   - summits
   - mountain state parks
   - Boat Rock
   - Chattahoochee access points

3. Create a Yonder-specific destination enrichment contract before frontend work scales.

4. Keep artifact selection editorial and explicit.

5. Do not trust raw `park` / `artifact` typing as the Yonder inventory model.

---

## 10. Bottom Line

Yonder already has enough destination inventory to support a metro-first launch with strong local outdoor flavor.

It does **not** yet have enough destination depth or metadata to fulfill the PRD’s strongest claim:

- a commitment-based adventure portal spanning Atlanta through North Georgia

That larger promise remains achievable, but only after destination seeding and enrichment become a first-order workstream.
