# Yonder Public-Land Source Matrix

**Parent docs:** `prds/034p-yonder-camping-trail-coverage-workstream.md`, `prds/034l-yonder-accommodation-inventory-workstream.md`  
**Status:** Draft  
**Purpose:** Define the source stack for Yonder’s campground and trail breadth layer.

---

## 1. Strategic Read

Yonder should not try to replace AllTrails or Hipcamp at their consumer-product layer.

It should use the sources that actually strengthen LostCity’s shared graph:

- OSM / Overpass for breadth discovery
- provider booking surfaces for overnight truth
- official federal and state sources for canonical public-land coverage
- targeted private/operator seeding where the graph would otherwise miss obvious campground supply

That keeps the system defensible and reusable across portals.

---

## 2. Source Matrix

| Source family | Coverage role | Access status | Current readiness | Best use |
|---|---|---|---|---|
| `osm_overpass` | named trails, hiking routes, camp sites, trailheads | open HTTP | ready now | breadth discovery and queue generation |
| `ga_state_parks_booking` | state-park campground/cabin inventory | public booking surface | already integrated | overnight truth and weekend comparison |
| `unicoi_lodge` | lodge/cabin/camp mix at Unicoi | public booking surface | already integrated | overnight truth for Unicoi |
| `whitewater_express` | adventure package inventory | public operator booking | already integrated | operator-led weekend comparison |
| `ridb_recreation_gov` | federal campground/facility inventory and public-land parent anchors | API key required | live and authenticated | federal campground breadth and parent-anchor acquisition |
| `nps_api` | park / campground support data | API key required | live and authenticated | NPS campground enrichment and park-anchor support |
| `usfs_public_pages` | named campground and recreation-area detail pages | open web pages | usable now | canonical URLs and metadata for public campgrounds |
| `usace_public_pages` | lake / reservoir camping areas | open web pages | usable now | Corps-managed campground coverage |
| `state_park_pages` | named park, trail, and camping surfaces | open web pages | usable now | state-park anchors, child campgrounds, and canonical trail rows |
| `private_operator_pages` | private campground / RV park websites | open web pages | usable now | obvious private/operator campground breadth |

---

## 3. Source Roles By Problem

### Problem: “What campgrounds even exist?”

Primary sources:

- `osm_overpass`
- `ridb_recreation_gov`
- `usfs_public_pages`
- `usace_public_pages`
- `private_operator_pages`

### Problem: “Can I actually stay there and what does it roughly look like?”

Primary sources:

- `ga_state_parks_booking`
- `unicoi_lodge`
- `whitewater_express`
- official operator booking surfaces

### Problem: “What named trails should the graph know about?”

Primary sources:

- `osm_overpass`
- official state-park / trail pages
- official park or forest pages linked from OSM candidates

### Problem: “What makes Yonder feel more definitive than just park names?”

Primary sources:

- canonical trail systems
- canonical campground children
- official operator URLs
- parent-child structure beneath parks, lakes, forests, and refuges

---

## 4. Current Probe Outcome

Live results from `crawlers/scripts/probe_yonder_public_land_coverage.py`:

- `osm_overpass`: ready
- `ridb_recreation_gov`: live and authenticated
- `nps_api`: live and authenticated

Georgia Overpass probe result after low-signal filtering:

- `344` total named public-land candidates
- `292` camp-site candidates
- `52` hiking-route candidates
- `241` candidates absent from the current Georgia venue graph

Remaining split:

- missing `camp_site`: `212`
- missing `hiking_route`: `29`

This still justifies continued public-land seeding, but the composition of the backlog has changed. The official-public-land lane is no longer the main problem.

---

## 5. What’s Live Now

### Federal and public-land backbone

Live federal probes and audits:

- `crawlers/scripts/probe_yonder_ridb_coverage.py`
- `crawlers/scripts/probe_yonder_nps_coverage.py`
- `crawlers/scripts/audit_yonder_federal_backbone_coverage.py`
- `crawlers/scripts/audit_yonder_federal_campground_coverage.py`

Federal parent-anchor seeding:

- `crawlers/scripts/seed_yonder_federal_backbone_wave1.py`
- `crawlers/scripts/seed_yonder_federal_backbone_wave2.py`
- `crawlers/scripts/seed_yonder_federal_backbone_wave3.py`
- `crawlers/scripts/enrich_yonder_federal_backbone_images_google.py`

Targeted federal backbone coverage is now `19/19`.

### Campground acquisition

Campground seeding and enrichment now live through:

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
- `crawlers/scripts/enrich_yonder_nps_campground_images_google.py`

### Trail acquisition

Trail seeding and enrichment now live through:

- `crawlers/scripts/seed_yonder_public_land_trails_wave1.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave2.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave3.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave4.py`
- `crawlers/scripts/seed_yonder_public_land_trails_wave5.py`
- `crawlers/scripts/seed_yonder_state_park_hiking_wave1.py`
- `crawlers/scripts/enrich_yonder_public_land_trail_images_google.py`
- `crawlers/scripts/enrich_yonder_state_park_hiking_wave1_images_google.py`

### Net effect

- Georgia `campground` rows increased from `2` to `87`
- Georgia `trail` rows increased from `20` to `41`
- Georgia `park` rows increased from `193` to `228`
- the seeded public-land and state-park trail set is `21/21` on images, short descriptions, and websites
- the expanded public-land plus state-park campground set is `52/52` on images and `52/52` on websites
- the private/operator campground waves now total `33/33` on images and `33/33` on websites
- the curated review-wave campground set is `3/3` on images and `3/3` on websites
- the seeded NPS campground wave is `4/4` on images, short descriptions, websites, and reservation URLs
- the official-public-land trail backlog is cleared
- the official-public-land campground backlog is effectively cleared

---

## 6. Queue Read

### Camp queue

From `crawlers/scripts/qualify_yonder_public_land_camp_queue.py`:

- remaining missing camp candidates: `164`
- `needs_review`: `107`
- `private_operator`: `30`
- `special_permit`: `17`
- `group_camp`: `10`

This means the camp backlog is now mostly policy and verification work, not open-public-land breadth.

### Trail queue

From `crawlers/scripts/qualify_yonder_public_land_trail_queue.py`:

- remaining missing trail candidates: `29`
- `needs_review`: `14`
- `connector_or_low_signal`: `8`
- `map_mirror_noise`: `7`

This means the remaining trail backlog is now small enough to curate.

---

## 7. Recommended Operating Rules

1. `osm_overpass` is for candidate discovery, not blind ingestion.
2. When OSM exposes an official operator URL, prefer that as the canonical verification surface.
3. Do not create standalone rows for numbered campsites or tiny subunits.
4. Child campground nodes should attach to broader anchors when the relationship is obvious.
5. Prefer official park and operator surfaces over generic map or review-site data.
6. `special_permit` and `group_camp` inventory should not become automatic seed lanes.
7. Trail rows that resolve only to connector-path names or map mirrors should not be promoted into canonical coverage waves.

---

## 8. Practical Next Move

The next best source-expansion sequence is:

1. continue the `needs_review` campground lane with the cleanest official/operator rows
2. continue curated private/operator waves only where the row is clearly public-facing and has a live official operator surface
3. curate the remaining `needs_review` trail list route by route
4. improve booking-snapshot participation for the newly added state-park parents and campground children
