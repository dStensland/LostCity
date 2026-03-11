# Yonder Regional Destination Seed List

**Parent docs:** `prds/034d-yonder-destination-inventory.md`, `prds/034e-yonder-destination-metadata-contract.md`  
**Status:** Draft  
**Purpose:** Turn Yonder’s missing regional destination layer into a prioritized seed list that can be executed as a focused data-enrichment workstream.

---

## 1. Why This Exists

The destination inventory audit showed that Yonder already has enough metro and near-metro anchors for a discovery-first launch, but it is missing many of the PRD’s most important day-trip and weekend destinations.

This list prioritizes those missing anchors by:

- strategic value to the product
- launch usefulness
- quest potential
- likely seeding effort

---

## 2. Seed Prioritization Rules

Seed destinations first when they do one or more of the following:

1. make the `fullday` or `weekend` commitment tiers feel real
2. create iconic anchor content for Yonder branding
3. support artifact and quest creation later
4. increase geographic range beyond the city without diluting quality

Do **not** seed just because a place is famous. Seed because it strengthens the product.

---

## 3. Phase 1 Seed Bucket: Highest Strategic Value

These are the missing destinations that most improve Yonder immediately.

| Destination | Why it matters | Likely tier |
|---|---|---|
| Amicalola Falls | iconic waterfall / day trip / strong visual hook | `fullday` |
| Tallulah Gorge | premium north Georgia anchor with strong “worth the trip” pull | `fullday` |
| Cloudland Canyon | major canyon / hiking / camping anchor | `weekend` |
| Blood Mountain | iconic summit / Appalachian identity | `fullday` |
| Springer Mountain | AT southern terminus / strong quest value | `weekend` |
| Brasstown Bald | top-tier summit / broad appeal / scenic reward | `fullday` |
| Raven Cliff Falls | classic waterfall destination | `fullday` |
| Vogel State Park | camping + mountain lake anchor | `weekend` |
| Fort Mountain State Park | mountain camping and scenic trail anchor | `weekend` |
| Boat Rock | climbing-specific anchor / community identity | `halfday` or `fullday` |

These should be the first 10 regional destination records Yonder adds.

---

## 4. Phase 1.5 Seed Bucket: Strong Secondary Anchors

| Destination | Why it matters | Likely tier |
|---|---|---|
| DeSoto Falls | waterfall cluster support | `fullday` |
| Helton Creek Falls | waterfall / scenic hit / low-friction payoff | `fullday` |
| Rabun Bald | strong viewpoint / advanced hike identity | `fullday` |
| Cohutta Overlook / Cohutta anchors | wilderness scale / weekend credibility | `weekend` |
| Chattahoochee River access points (additional canonical nodes) | improves water lane and commitment range | mixed |
| Panola Mountain enrichment | already present, needs better metadata and prominence | `halfday` |
| Arabia Mountain PATH enrichment | strengthens metro / near-metro lane | `halfday` |
| Cochran Shoals / Sope Creek canonicalization | strengthens quick-drive trail inventory | `halfday` |

---

## 5. Phase 2 Seed Bucket: Quest and Artifact Expansion

These matter most once artifact and quest work starts accelerating.

### Waterfall cluster

- Toccoa Falls
- Minnehaha Falls
- Anna Ruby Falls
- Dukes Creek Falls
- Long Creek Falls

### Viewpoint / tower / overlook cluster

- Black Rock Mountain
- additional fire tower destinations
- high-confidence mountain overlooks

### Urban artifact / hidden nature cluster

- overlooked Atlanta green spaces
- hidden overlooks
- river corridor oddities
- city-edge weird nature spots

---

## 6. Seed Types

Each destination should be seeded in one of three ways.

### Type A: Canonical destination record

Use for major anchors:

- parks
- summits
- waterfalls
- climbing areas
- trail systems

### Type B: Access-point record

Use when one broader destination has multiple meaningful entry nodes:

- Chattahoochee river access points
- NRA sub-units
- trailheads

### Type C: Artifact-under-destination candidate

Use when the item is better understood as part of a parent destination:

- overlook inside a state park
- waterfall within a broader trail area
- fire tower inside a regional recreation area

This matters because Yonder should not explode every destination into noisy flat inventory.

---

## 7. Minimum Seed Fields

Every seeded destination should include at minimum:

- `name`
- `slug`
- `destination_type`
- `primary_activity`
- `commitment_tier`
- `lat`, `lng`
- `image_url`
- `short_description`

Strongly recommended in the first pass:

- `drive_time_minutes`
- `difficulty_level`
- `typical_duration_minutes`
- `best_seasons`
- `website`
- `practical_notes`

Reference:

- `prds/034e-yonder-destination-metadata-contract.md`

---

## 8. Recommended Seeding Order

### Wave 1

Seed the 10 highest-value missing anchors:

1. Amicalola Falls
2. Tallulah Gorge
3. Cloudland Canyon
4. Blood Mountain
5. Springer Mountain
6. Brasstown Bald
7. Raven Cliff Falls
8. Vogel State Park
9. Fort Mountain State Park
10. Boat Rock

### Wave 2

Seed the waterfall and overlook support layer:

11. DeSoto Falls
12. Helton Creek Falls
13. Rabun Bald
14. Black Rock Mountain
15. Cohutta Overlook or canonical Cohutta anchor

### Wave 3

Expand access points and quest support:

16+. Chattahoochee access nodes
16+. secondary waterfalls
16+. fire towers / viewpoint support

---

## 9. Product Impact By Wave

### After Wave 1

Yonder becomes much more credible as a `fullday` / `weekend` product.

### After Wave 2

Yonder begins to support real artifact and quest clustering.

### After Wave 3

Yonder gains enough density to feel like a distinct adventure vertical rather than a curated city-outdoors layer.

---

## 10. Open Decisions

These need product judgment before large-scale seeding starts.

### Decision 1: How far does Yonder go at launch?

Possible answers:

- Atlanta + near-metro only
- Atlanta + selected North Georgia anchors
- full Atlanta-to-North-Georgia thesis

### Decision 2: What counts as a Yonder artifact versus a destination?

Example:

- Amicalola Falls itself could be a destination
- a specific overlook or hidden access spot could be an artifact

### Decision 3: Do we seed camping as destinations now or wait for Camp Finder?

Recommendation:

- seed iconic camp-capable parks now as destinations
- defer full campsite inventory until camping-specific work starts

---

## 11. Bottom Line

If source activation is the first Yonder content unlock, regional destination seeding is the second.

Without this list getting executed, Yonder will remain strongest as “Atlanta outdoors this week.”

With it, Yonder can start to earn its larger promise: a real commitment-spectrum adventure portal.
