# Yonder Camping / Trail Coverage Workstream

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034h-yonder-category-content-analysis.md`, `prds/034i-yonder-gap-closure-plan.md`, `prds/034l-yonder-accommodation-inventory-workstream.md`  
**Status:** Active  
**As of:** 2026-03-12  
**Purpose:** Close Yonder’s remaining camping and trail breadth gap with a reusable acquisition layer instead of more one-off destination waves.

---

## 1. Executive Read

Yonder’s trail and camping problem is no longer a product-shape problem.

It is a **coverage substrate** problem with two separate lanes:

- public-land breadth
- structured operator and state-park child depth

Current live state from `crawlers/scripts/audit_yonder_trail_camp_coverage.py` and `crawlers/scripts/probe_yonder_public_land_coverage.py`:

- Georgia active venue rows: `4273`
- typed `trail`: `41`
- typed `park`: `228`
- typed `campground`: `87`
- Georgia state-park parent rows: `25`
- Georgia state-park campground child rows: `15`
- state-park rows with current inventory snapshots: `10`
- public-land candidates from Overpass: `344`
  - `292` camp-site candidates
  - `52` hiking-route candidates
- missing against current Georgia venue graph: `241`
  - missing `camp_site`: `212`
  - missing `hiking_route`: `29`
- public-land plus state-park campground waves created: `52` rows
- private/operator campground waves 1-8 created: `33` rows
- public-land plus state-park trail waves created: `21` rows
- federal backbone waves 1-3 created: `17` outdoor parent anchors
- targeted federal backbone coverage: `19/19`

Implication:

- Yonder now has enough structured inventory to support a much more credible Georgia camping / hiking story
- the official public-land backlog is no longer the dominant blocker
- the next decisions are about which `needs_review`, `private_operator`, `special_permit`, and `group_camp` classes deserve first-class coverage

---

## 2. What The Audit Says Now

### 2.1 Typing gap

The graph is much better than it was, but `venue_type` is still not perfectly trustworthy as a filter substrate.

- `41` Georgia venues are typed `trail`
- `87` Georgia venues are typed `campground`
- trail-like and camp-like names still exist under noisy types like `event_space`, `organization`, and `community_center`

This means Yonder can increasingly rely on typed rows, but should still expect cleanup work around stray name-pattern matches.

### 2.2 State-park child-depth gap

The biggest structural gain in this pass was campground-child depth under parks Yonder already promotes as weekend anchors.

- `25` Georgia state-park parent rows exist
- `15` campground child rows now exist under the state-park lane
- only `10` currently participate in `current_venue_inventory_snapshots`

That means:

- the venue graph is now much closer to Yonder’s current product logic
- the next state-park gap is no longer “do campground children exist?”
- the next gap is “which of these parents also need inventory and booking depth?”

### 2.3 Public-land breadth gap

Georgia still exposes more named public-land candidates than the venue graph currently represents.

Current remaining gap:

- `212` camp-site candidates absent from the Georgia venue graph
- `29` hiking-route candidates absent from the Georgia venue graph

That is still a real breadth gap, but it is no longer mostly official public-land inventory. The remaining queue is now a mix of:

- `needs_review`
- `private_operator`
- `special_permit`
- `group_camp`

### 2.4 Federal parent-anchor gap

This is largely closed for the current target set.

Federal backbone anchors now cover the selected NPS + RIDB outdoor-unit set at `19/19`, including:

- `cumberland-island-national-seashore`
- `chattahoochee-oconee-national-forest`
- `okefenokee-national-wildlife-refuge`
- `allatoona-lake`
- `lake-sidney-lanier`
- `carters-lake`
- `hartwell-lake`
- `richard-b-russell-lake`
- `west-point-lake`
- `banks-lake-national-wildlife-refuge`
- `blackbeard-island-national-wildlife-refuge`
- `harris-neck-national-wildlife-refuge`
- `piedmont-national-wildlife-refuge`
- `sapelo-island-national-estuarine-research-reserve`
- `bond-swamp-national-wildlife-refuge`
- `walter-f-george-lake`
- `george-w-andrews-lake`

The next value is hanging more children beneath these anchors, not hunting more parent rows by default.

---

## 3. What Landed

### 3.1 Public-land and state-park campground coverage

Campground acquisition now lives through:

- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave2.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave4.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave5.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave6.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave7.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave8.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave9.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave10.py`
- `crawlers/scripts/seed_yonder_nps_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave2.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave3.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave4.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave5.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave6.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave7.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave8.py`
- `crawlers/scripts/seed_yonder_campgrounds_wave_review1.py`
- `crawlers/scripts/seed_yonder_state_park_hiking_wave1.py`

Notable campground additions across these waves:

- `amicalola-falls-state-park-campground`
- `red-top-mountain-state-park-campground`
- `terrora-campground`
- `old-federal-campground`
- `bolding-mill-campground`
- `bolding-mill-shelters-ga`
- `ducket-mill`
- `hickory-hill-wilderness-campsite`
- `sea-camp-campground`
- `stafford-beach-campground`
- `yankee-paradise-wilderness-campsite`
- `ocmulgee-horse-camp`
- `andrews-cove-campground`
- `tate-branch-campground`
- `sandy-bottoms-recreation-area-campground`
- `james-h-floyd-state-park-campground`
- `stephen-c-foster-state-park-pioneer-campground`
- `cloudland-canyon-state-park-campground`
- `vogel-state-park-campground`
- `fort-mountain-state-park-campground`
- `black-rock-mountain-state-park-campground`
- `chattahoochee-bend-state-park-campground`
- `hard-labor-creek-state-park-campground`
- `fort-yargo-state-park-campground`
- `don-carter-state-park-campground`
- `unicoi-state-park-campground`
- `stone-mountain-campground`
- `bainbridge-riverview-campground`
- `beautiful-rock-campground`
- `jennys-creek-campground`
- `atlanta-south-rv-park`
- `georgia-veterans-state-park-campground`
- `blue-moon-campground`
- `lake-harmony-rv-park`
- `cecil-bay-rv-park`
- `a-big-wheel-rv-park`
- `morganton-point-campground`
- `albany-rv-resort`
- `talona-ridge-rv-resort`
- `lake-park-rv-campground`
- `oz-campground`
- `allatoona-landing-marine-resort-campground`
- `camp-david-rv-resort`
- `fd-roosevelt-state-park-campground`
- `tallulah-river-campground`
- `mulberry-gap-adventure-basecamp`
- `yonah-mountain-campground`
- `country-oaks-campground-rv`
- `eagles-roost-rv-resort`
- `georgia-peanut-rv-park`
- `pataula-creek-rv-campground`
- `battlefield-campground-rv-park`
- `coastal-georgia-rv-resort`
- `southern-retreat-rv-park`
- `inland-harbor-rv-park`
- `mcintosh-lake-rv-park`
- `hucks-rv-park`
- `walkabout-camp-rv-park`
- `cat-head-creek-rv-park`
- `rivers-end-campground-rv-park`
- `341-rv-park`
- `madison-rv-park`
- `okefenokee-rv-park`

### 3.2 Public-land and state-park trail coverage

Trail acquisition now lives through:

- `crawlers/scripts/seed_yonder_public_land_trails_wave1.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave2.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave4.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave5.py`
- `crawlers/scripts/seed_yonder_state_park_hiking_wave1.py`

Notable trail additions:

- `appalachian-trail`
- `benton-mackaye-trail`
- `bartram-trail`
- `chattooga-river-trail`
- `pinhoti-trail`
- `gahuti-trail`
- `amadahy-trail`
- `terrora-trail`
- `upper-terrora-nature-trail`
- `boarding-house-trail`
- `chickamauga-creek-trail`
- `pine-mountain-trail`

### 3.3 Park and backbone additions

Park/backbone additions now include:

- federal backbone waves 1-3
- `fd-roosevelt-state-park`

This matters because Yonder now has a cleaner structure for:

- Pine Mountain hiking
- state-park weekend camping
- public-land campground parent-child relationships

---

## 4. Image / Presentation Readiness

The campground and trail layer is now visually promotable, not just technically present.

Image coverage tooling now includes:

- `crawlers/scripts/enrich_yonder_public_land_campground_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave2_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave3_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave4_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave5_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave6_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave7_images_google.py`
- `crawlers/scripts/enrich_yonder_private_campground_wave8_images_google.py`
- `crawlers/scripts/enrich_yonder_campgrounds_review_wave1_images_google.py`
- `crawlers/scripts/enrich_yonder_public_land_trail_images_google.py`
- `crawlers/scripts/enrich_yonder_nps_campground_images_google.py`
- `crawlers/scripts/enrich_yonder_federal_backbone_images_google.py`
- `crawlers/scripts/enrich_yonder_state_park_hiking_wave1_images_google.py`

Current readiness:

- public-land plus state-park campground set: `52/52` on images and `52/52` on websites
- private/operator campground waves 1-8: `33/33` on images and `33/33` on websites
- curated review-wave campgrounds: `3/3` on images and `3/3` on websites
- public-land plus state-park trail set: `21/21` on images, `21/21` on short descriptions, and `21/21` on websites
- `38/49` of the public-land plus state-park campground set are currently parented beneath broader anchors

---

## 5. Source Strategy

Yonder should keep camping / trail coverage split into three layers.

### Layer A: Booking truth

Already underway.

Use direct provider integrations where inventory quality matters most:

- Georgia State Parks
- Unicoi Lodge
- Whitewater Express

Role:

- overnight comparison
- live availability / price posture
- weekend planning truth

### Layer B: Public-land breadth

Use official/open sources to expand the underlying graph:

- OSM Overpass
- RIDB / Recreation.gov
- NPS API
- USFS / USACE / state-park pages

Role:

- statewide breadth
- canonical public-land coverage
- parent-anchor support

### Layer C: Operator / editorial enrichment

Use targeted seeding where open/public-land data is not the right source:

- private campgrounds
- municipal campgrounds
- permit-backed campsites
- group camps and scouting properties when product fit is real

Role:

- high-signal exceptions
- convenience-led supply
- regionally distinctive camping inventory

---

## 6. Current Queue Read

From `crawlers/scripts/qualify_yonder_public_land_camp_queue.py`:

- remaining missing camp candidates: `164`
- `needs_review`: `107`
- `private_operator`: `30`
- `special_permit`: `17`
- `group_camp`: `10`

From `crawlers/scripts/qualify_yonder_public_land_trail_queue.py`:

- remaining missing trail candidates: `29`
- `needs_review`: `14`
- `connector_or_low_signal`: `8`
- `map_mirror_noise`: `7`

Implication:

- the official public-land trail bucket is cleared
- the official public-land campground backlog is effectively cleared
- the next highest-leverage work is selective, not blind

---

## 7. What We Should Build Next

### Workstream A: More high-confidence `needs_review` campgrounds

Target rows should be campground-grade, source-verifiable, and useful to Yonder:

- `Holbrook Pond Campground`
- `Rush Creek Campground`
- `Wildcat Lodge & Campground`
- `Nichols Campground`

Why:

- this continues breadth without collapsing into noisy permit/group inventory

### Workstream B: Curated private/operator wave 9

The private/operator lane is still worth doing, but only when the row is clearly public-facing and has a live operator surface.

Next likely candidates:

- `Currahee RV and Campground` only if Facebook-backed operator surfaces are acceptable
- `Kiki RV Park`
- `City of Roses RV Park` only if a stable operator surface is verified
- `Southern Gates RV Park and Campground`
- `Chattahoochee RV Park`
- `Eagle Hammock RV Park` only if Yonder explicitly wants access-restricted military MWR inventory

Why:

- it broadens the “real places people actually compare” layer without taking on low-fit or access-restricted inventory by accident

### Workstream C: Trail review queue

The next trail work should be support-oriented, not comprehensiveness-driven.

Priority uses:

- canonical routes that materially improve destination pages
- trailheads/access points that clarify how to do the outing
- link-out support to specialist route curators where users need dense route choice

Why:

- Yonder does not need to beat AllTrails on route density to win the decision layer
- the remaining trail queue is small enough to curate selectively
- campground, park, water-access, and overnight depth now matter more than long-tail trail coverage

### Workstream D: Snapshot participation under new state-park parents

The graph now has many more state-park campground children than the runtime inventory layer knows about.

Why:

- `15` campground children now exist
- only `10` state-park parents have current inventory snapshots
- the next product-quality gain is to close that mismatch

---

## 8. Guardrails

Do not:

- ingest raw OSM campsite rows wholesale
- treat numbered sub-sites as standalone campgrounds
- let generic park rows stand in for campground truth
- treat `special_permit` or `group_camp` as automatic seed lanes
- turn Yonder into a route-catalog completeness project

Do:

- keep public-land acquisition read-first, audited, and cached
- prefer official operator URLs when present
- attach child rows to broader anchors when the relationship is obvious
- let new coverage enrich the shared venue graph, not only Yonder
- use canonical trail coverage to support destination and recommendation quality, then link out for route-depth specialists

---

## 9. Current Tooling Added

This workstream now has a real toolchain, not just ad hoc edits:

- `crawlers/scripts/audit_yonder_trail_camp_coverage.py`
- `crawlers/scripts/probe_yonder_public_land_coverage.py`
- `crawlers/scripts/qualify_yonder_public_land_camp_queue.py`
- `crawlers/scripts/qualify_yonder_public_land_trail_queue.py`
- `crawlers/scripts/link_yonder_federal_children.py`
- `crawlers/scripts/probe_yonder_ridb_coverage.py`
- `crawlers/scripts/probe_yonder_nps_coverage.py`
- `crawlers/scripts/audit_yonder_federal_campground_coverage.py`
- `crawlers/scripts/audit_yonder_federal_backbone_coverage.py`
- `crawlers/scripts/seed_yonder_federal_backbone_wave1.py`
- `crawlers/scripts/seed_yonder_federal_backbone_wave2.py`
- `crawlers/scripts/seed_yonder_federal_backbone_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave1.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave2.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave4.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave5.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave2.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave4.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave5.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave6.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave7.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave8.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave9.py`
- `crawlers/scripts/seed_yonder_public_land_campgrounds_wave10.py`
- `crawlers/scripts/seed_yonder_nps_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave1.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave2.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave3.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave4.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave5.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave6.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave7.py`
- `crawlers/scripts/seed_yonder_private_campgrounds_wave8.py`
- `crawlers/scripts/seed_yonder_campgrounds_wave_review1.py`
- `crawlers/scripts/seed_yonder_state_park_hiking_wave1.py`
- image enrichment scripts for public-land campgrounds, private campgrounds, trails, NPS campgrounds, federal backbone, and state-park hiking wave 1
- image enrichment scripts for private/operator waves 2-8 and review-wave campgrounds

---

## 10. Immediate Next Move

The next highest-leverage execution step is:

1. keep converting the highest-confidence `needs_review` campground rows with clean official surfaces
2. keep `special_permit` and `group_camp` out of automatic seed waves unless the source and product fit are both strong
3. attach more campground / trail / access children beneath the existing anchors instead of broad parent seeding by default
4. expand snapshot participation across the new state-park parents so the graph and booking substrate stop drifting apart
