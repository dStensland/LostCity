# Yonder Destination Metadata Contract

**Parent docs:** `prds/034-yonder-adventure-portal.md`, `prds/034d-yonder-destination-inventory.md`  
**Status:** Draft  
**Purpose:** Define the minimum destination data contract required for Yonder to deliver commitment-based adventure discovery without devolving into a generic place directory.

---

## 1. Why This Exists

Yonder’s product promise depends on structured destination intelligence, not just destination names.

Without this metadata, Yonder cannot reliably support:

- commitment filtering
- conditions-aware recommendations
- comparison between destinations
- useful quest framing
- user confidence at decision time

This contract defines the minimum viable field set for a Yonder destination to be considered launchable.

---

## 2. Scope

Applies to destination-like inventory used by Yonder, including:

- trails
- parks
- river access points
- climbing spots
- summits / overlooks
- waterfalls
- swimming holes
- camping areas
- outfitter or access nodes when they function as trip anchors

This contract is for the **consumer** surface.

Operator/admin tooling can evolve later, but the consumer-facing data requirements must be explicit now.

---

## 3. Field Tiers

## 3.1 Tier 0: Required For Any Yonder Destination

These fields are mandatory before a destination can appear in primary Yonder browse/feed modules.

| Field | Why it matters |
|---|---|
| `name` | user-recognizable identity |
| `slug` | canonical routing |
| `lat`, `lng` | map placement, drive-time logic |
| `destination_type` | trail, waterfall, river access, summit, climbing, etc. |
| `image_url` or approved fallback | visual credibility |
| `short_description` | one-sentence reason to care |
| `commitment_tier` | primary nav contract |
| `primary_activity` | supports filtering and recommendation copy |

If any of these are missing, the destination is not ready for top-level Yonder promotion.

## 3.2 Tier 1: Strongly Recommended For Launch

These fields are what make the portal feel useful rather than decorative.

| Field | Example |
|---|---|
| `drive_time_minutes` | `35` |
| `difficulty_level` | `easy`, `moderate`, `hard` |
| `typical_duration_minutes` | `90` |
| `best_seasons` | `spring`, `fall` |
| `weather_fit_tags` | `shaded`, `after-rain`, `summer-friendly` |
| `website` or `source_url` | official info / directions / booking |
| `practical_notes` | permit, parking, fees, timing caveat |

## 3.3 Tier 2: High-Leverage Enrichment

These unlock stronger recommendation and comparison layers.

| Field | Example |
|---|---|
| `elevation_gain_ft` | `850` |
| `trail_distance_miles` | `4.7` |
| `surface_type` | paved, dirt, scramble, water |
| `family_suitability` | yes / no / caution |
| `dog_friendly` | yes / no / partial |
| `reservation_required` | boolean |
| `permit_required` | boolean |
| `fee_note` | parking fee, access fee, launch fee |
| `seasonal_hazards` | heat exposure, muddy after rain, water level caution |

---

## 4. Commitment Tier Contract

This is the core Yonder field and should be normalized at the data layer.

Allowed values:

- `hour`
- `halfday`
- `fullday`
- `weekend`

### Interpretation guidance

| Tier | Meaning |
|---|---|
| `hour` | low-friction urban or hyperlocal outing |
| `halfday` | metro nature or local activity that fits around the rest of the day |
| `fullday` | destination where the outing is the main plan |
| `weekend` | overnight / expedition / camping / significant drive commitment |

### Important rule

Commitment is **not** the same thing as linear distance.

It should account for:

- drive time
- prep burden
- onsite duration
- reservation friction
- overnight implication

---

## 5. Destination Type Contract

Yonder should avoid overloading generic `venue_type`.

Recommended Yonder-facing `destination_type` values:

- `urban_trail`
- `nature_preserve`
- `state_park`
- `waterfall`
- `viewpoint`
- `summit`
- `river_access`
- `swimming_hole`
- `climbing_area`
- `climbing_gym`
- `campground`
- `glamping_site`
- `cabin_base`
- `outfitter`

This can be stored as:

- a new column
- a normalized related table
- or a Yonder-specific enrichment layer

But the consumer surface should not have to infer it from noisy generic venue types.

---

## 6. Launchability Rules

### Launchable now

A destination is launchable in Phase 1 if it has:

- all Tier 0 fields
- at least three Tier 1 fields
- no major confidence issues in geo or identity

### Launchable with enrichment

A destination can be staged for later promotion if it has:

- Tier 0 identity and geo
- image
- but weak short description / commitment / practical metadata

### Not launchable

Do not promote destinations that are missing:

- commitment tier
- canonical identity
- image/fallback strategy
- enough description to explain why they matter

---

## 7. Conditions Intelligence Dependencies

Conditions logic should only use fields we can defend.

Minimum condition-supporting metadata:

- `commitment_tier`
- `best_seasons`
- `weather_fit_tags`
- `practical_notes`

Examples:

- `after-rain`
- `summer-friendly`
- `heat-exposed`
- `leaf-season`
- `best-at-sunrise`
- `shade-heavy`

Without these fields, conditions modules should stay editorial and conservative.

---

## 8. Cross-Portal Reuse Potential

This contract should be designed as a candidate platform primitive, not a Yonder-only hack.

High reuse potential:

- commitment tier
- destination type
- duration / drive time
- best season
- dog/family suitability
- reservation friction

Possible downstream reuse:

- hotel portals
- dog portal
- tourism board portals
- family portal

---

## 9. Immediate Implementation Recommendation

Do **not** wait for a perfect schema to start enriching.

Near-term approach:

1. define the canonical field set now
2. use a temporary enrichment layer for Yonder seed destinations
3. promote the stable parts into shared schema once the second portal needs them

That keeps Yonder moving while preserving platform discipline.

---

## 10. Bottom Line

Yonder’s frontend can be designed boldly and flexibly, but the product will only feel differentiated if destination records become structurally richer.

This metadata contract is the minimum bar for making Yonder feel like a decision engine instead of a pretty outdoor directory.
