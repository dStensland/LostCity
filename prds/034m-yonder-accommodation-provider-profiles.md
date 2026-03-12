# Yonder Accommodation Provider Profiles

**Parent docs:** `prds/034l-yonder-accommodation-inventory-workstream.md`, `prds/034k-yonder-accommodation-inventory-source-model.md`  
**Status:** Active  
**Purpose:** Capture the current provider-family read for Yonder weekend accommodation inventory so integration work starts from actual surface behavior.

---

## 1. Current Provider Families

Current normalized families in the promoted weekend set:

- `ga_state_parks`
- `unicoi_lodge`
- `whitewater_express`
- `self_guided`

Current baseline counts:

- `ga_state_parks`: `9`
- `self_guided`: `2`
- `unicoi_lodge`: `1`
- `whitewater_express`: `1`

This makes `ga_state_parks` the obvious first integration target.

---

## 2. Provider Profiles

### `ga_state_parks`

Representative URL:

- `https://gastateparks.reserveamerica.com/`

Current Yonder anchors:

- `cloudland-canyon`
- `vogel-state-park`
- `fort-mountain-state-park`
- `black-rock-mountain`
- `chattahoochee-bend-state-park`
- `red-top-mountain-state-park`
- `hard-labor-creek-state-park`
- `fort-yargo-state-park`
- `don-carter-state-park`

Observed surface traits:

- server-rendered HTML
- live booking surface
- strong reservation and availability language
- form-based search surface visible without auth

Current classification:

- `crawlable now`

Integration implication:

- highest-leverage provider because it covers most of Yonder’s weekend inventory
- best candidate for first normalized unit-record extraction
- the first provider probe already resolved all `9` Yonder park anchors to concrete `park_id` values and public `campgroundDetails` / `campsiteSearch` URLs
- public search pages also expose unit-option labels like cabins, cottages, campsites, RV sites, trailer sites, yurts, backcountry, and other stay variants
- dated search requests also work as plain HTTP GETs with exposed fields like `campingDate`, `lengthOfStay`, and `siteTypeFilter`
- the main remaining question is how cleanly availability and price rows can be normalized from the results DOM

Current extraction state:

- `crawlers/scripts/extract_yonder_ga_state_park_inventory.py` now emits dated unit-type counts for all `9` Yonder Georgia State Park anchors
- the search-grid rows are parseable enough for normalized sample site rows
- row-level static HTML still collapses the availability cell to `Enter Date`
- site-detail POSTs, however, do expose coarse booking state plus nightly and weekly price signals
- that means the provider is now good enough for a first normalized inventory record model without browser automation

### `unicoi_lodge`

Representative URL:

- `https://us01.iqwebbook.com/ULGA340/`

Current Yonder anchor:

- `unicoi-state-park`

Observed surface traits:

- Angular / SPA-style booking surface
- provider appears live and price-capable
- inventory is exposed through direct JSON endpoints behind the SPA

Current classification:

- `crawlable now`

Integration implication:

- worth integrating after Georgia State Parks and Whitewater Express
- direct endpoint discovery was sufficient; browser automation is not required for the current inventory slice

Important note:

- the older stored URL `https://reservations.unicoilodge.com/` was dead
- Yonder now points to the live IQWebBook booking URL instead

Implementation update:

- active now
- `api/roomtype/search` accepts Angular-formatted dates plus a JSON-encoded `rooms` array
- `crawlers/scripts/sync_yonder_unicoi_inventory.py` writes normalized overnight snapshots into `venue_inventory_snapshots`
- the first persisted Unicoi snapshot currently exposes:
  - `57` tent-site results
  - `11` cabin results
  - `6` lodge-room results
  - public `Best Available Rate` pricing like `$20.00`, `$229.00`, and `$199.00`

### `whitewater_express`

Representative URL:

- `https://whitewaterexpress.com/`

Current Yonder anchor:

- `whitewater-express-columbus`

Observed surface traits:

- public site responds cleanly
- package-led booking context rather than campsite or room inventory
- booking intent is visible, but the meaningful inventory object is the adventure package

Current classification:

- `crawlable now`

Integration implication:

- should be modeled as package inventory, not lodging inventory
- useful second-wave provider because it broadens Yonder beyond park weekends

Implementation update:

- active now
- `crawlers/scripts/sync_yonder_whitewater_express_inventory.py` extracts the live Rezdy catalog and writes a normalized `package` snapshot into `venue_inventory_snapshots`
- the first persisted Whitewater snapshot currently includes `4` public products:
  - `Classic Trip`
  - `Challenge Trip`
  - `Carnage Trip`
  - `Season Pass`

### `self_guided`

Current Yonder anchors:

- `springer-mountain`
- `cohutta-overlook`

Observed surface traits:

- no provider-backed accommodation inventory
- no booking flow expected

Current classification:

- `manual / no provider integration`

Integration implication:

- not a blocker
- this family should stay explicit so Yonder does not pretend every weekend trip is inventory-backed

---

## 3. Recommended Integration Order

1. `ga_state_parks`
2. `whitewater_express`
3. `unicoi_lodge`
4. keep `self_guided` as explicit non-inventory inventory

Why this order:

- Georgia State Parks has the largest anchor share and the cleanest surface
- Whitewater Express is smaller but likely simpler than IQWebBook
- Unicoi matters, but the SPA booking surface makes it a weaker first target

---

## 4. Immediate Next Step

Build the first Georgia State Parks provider probe.

That probe should answer:

- what unit categories can be extracted reliably?
- are nightly prices exposed pre-search?
- is date-based availability discoverable without login?
- what record shape can be normalized across the 9 park anchors?

Current answer:

- unit categories are extractable now from the public search pages
- park-level handles are resolved for all `9` Yonder Georgia State Park anchors
- the next concrete question is availability and price detail, not park discovery
