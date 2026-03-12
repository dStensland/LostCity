# Yonder Provider Record Contract

**Parent docs:** `prds/034l-yonder-accommodation-inventory-workstream.md`, `prds/034m-yonder-accommodation-provider-profiles.md`  
**Status:** Active  
**Purpose:** Define the first normalized provider-backed inventory record shape for Yonder weekend accommodation work.

---

## 1. Why This Exists

Yonder now has enough evidence from the Georgia State Parks provider family to stop speaking about “inventory” in the abstract.

The provider workstream can now produce:

- park-level provider handles
- dated unit-type counts
- normalized unit categories
- sample booking state
- sample nightly and weekly rates

That is enough to define a first normalized record contract and now a first persisted snapshot path as well.

---

## 2. Current Extraction Artifact

Current source of truth:

- `crawlers/scripts/extract_yonder_ga_state_park_inventory.py`

This script now emits three layers:

1. raw unit-type summaries from the dated results page
2. diversified sample site rows
3. normalized per-unit records

Persistence path now in code:

- schema: `database/migrations/366_venue_inventory_snapshots.sql`
- sync job: `crawlers/scripts/sync_yonder_ga_state_park_inventory.py`
- second sync job: `crawlers/scripts/sync_yonder_whitewater_express_inventory.py`
- third sync job: `crawlers/scripts/sync_yonder_unicoi_inventory.py`
- read path: `web/lib/yonder-provider-inventory.ts`
- canonical current-snapshot view: `current_venue_inventory_snapshots`

The normalized per-unit record is the important new layer.

---

## 3. First Normalized Record Shape

Current fields:

- `destination_slug`
- `provider_slug`
- `park_id`
- `arrival_date`
- `nights`
- `unit_type`
- `raw_labels`
- `visible_inventory_count`
- `sample_detail_status`
- `sample_nightly_rate`
- `sample_weekly_rate`

This is intentionally modest.

It is not pretending we already have:

- full live availability
- all-site pricing
- booking conversion state
- taxes / fees normalization

It is just enough to support truthful comparison.

---

## 4. Current Proven Unit Types

From the first Georgia State Parks extraction pass, the normalized set already includes:

- `cabin`
- `tent_site`
- `backcountry_site`
- `group_site`
- `group_lodge`
- `yurt`
- `other`

This is enough to make the Yonder weekend shelf materially smarter than “park with booking link.”

---

## 5. What This Contract Can Power Right Now

- better weekend comparison cards
- booking-friction-aware ranking
- “what kind of overnight is this?” explanation on detail pages
- coarse price comparisons between park weekends

Examples:

- cabins at one park are materially more expensive than primitive or backcountry sites
- some provider-backed `other` inventory is event-room noise and should likely be downranked or excluded
- `notify_only` versus `bookable` is already visible on sample detail pages for some units

---

## 6. What Is Still Missing

This contract does not yet guarantee:

- exact available-unit counts for a given date
- cheapest available unit by type
- full tax-inclusive price
- reliable row-level availability in the search grid

That is the next layer, not a reason to delay this one.

---

## 7. Recommended Next Move

Promote the current Georgia State Parks normalized output into one of two paths:

1. runtime-only comparison fetch for Yonder weekend cards
2. persisted provider inventory table or snapshot table

Current implementation state:

- both paths now exist
- `web/lib/yonder-provider-inventory.ts` prefers persisted `venue_inventory_snapshots` rows and falls back to live provider fetch when no current row exists
- `web/lib/yonder-provider-inventory.ts` now prefers the canonical `current_venue_inventory_snapshots` view before falling back to raw snapshot ordering
- `crawlers/scripts/sync_yonder_ga_state_park_inventory.py --apply` has already written the first `9` Georgia State Parks snapshots for the next-weekend window
- `crawlers/scripts/sync_yonder_whitewater_express_inventory.py --apply` has also written the first `whitewater_express` `package` snapshot
- `crawlers/scripts/sync_yonder_unicoi_inventory.py --apply` has also written the first `unicoi_lodge` overnight snapshot
- the persisted record now carries unit counts plus representative booking-state and nightly-rate signals
