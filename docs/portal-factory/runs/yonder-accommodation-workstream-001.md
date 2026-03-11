# Yonder Accommodation Workstream 001

**Date:** 2026-03-10  
**Scope:** Phase 0 baseline provider audit and Phase 1 provider-family classification

---

## What Ran

- created the workstream doc: `prds/034l-yonder-accommodation-inventory-workstream.md`
- added provider baseline audit: `web/scripts/audit-yonder-accommodation-providers.ts`
- ran live weekend provider audit against production venue rows
- probed live provider surfaces for:
  - Georgia State Parks
  - Unicoi Lodge
  - Whitewater Express
- corrected the broken Unicoi booking URL in:
  - `crawlers/scripts/enrich_yonder_weekend_booking_support.py`
  - production `venues.reservation_url` via the existing enrichment script

---

## Baseline Result

Weekend provider coverage is now clean:

- weekend anchors: `13`
- modeled provider rows: `13`

Provider family counts:

- `ga_state_parks`: `9`
- `self_guided`: `2`
- `unicoi_lodge`: `1`
- `whitewater_express`: `1`

This confirms that the first real provider integration should be `ga_state_parks`.

---

## Provider Classification

### Georgia State Parks

- status: `crawlable now`
- evidence: HTML booking surface responds directly and exposes booking / reservation / availability language in initial response

### Unicoi Lodge

- status: `crawlable with browser`
- evidence: current live booking URL is `https://us01.iqwebbook.com/ULGA340/`
- evidence: surface loads as an Angular app, so endpoint discovery or browser automation is likely required

### Whitewater Express

- status: `crawlable now`
- evidence: public site responds directly and clearly represents booking/package intent
- caveat: inventory object is a guided package, not a room/campsite unit

### Self Guided

- status: `no provider integration`
- evidence: these anchors are intentionally non-booking weekend objectives

---

## Real Defect Found

Unicoi’s stored booking URL was wrong.

- old: `https://reservations.unicoilodge.com/`
- live: `https://us01.iqwebbook.com/ULGA340/`

The enrichment script was updated and applied live. Validation now shows the corrected URL.

---

## Next Move

Start the first provider probe for `ga_state_parks`.

That should produce:

- sample unit extraction
- booking-surface field map
- date/availability feasibility read
- proposed normalized provider record shape for the first real inventory pull

Update:

- this next move is now underway
- `crawlers/scripts/probe_yonder_ga_state_parks.py` resolves all `9` Yonder Georgia State Park anchors to provider slugs, `park_id` values, public detail URLs, and public search URLs
- the same probe also extracts visible unit-option labels from the search pages, including campsites, cabins/cottages, RV/trailer sites, yurts, backcountry, and related variants
- dated `campsiteSearch.do` requests also work through the public flow using exposed fields like `campingDate`, `lengthOfStay`, and `siteTypeFilter`
- the next concrete task is no longer park discovery; it is extracting date-sensitive availability and price signals

Additional progress:

- `crawlers/scripts/extract_yonder_ga_state_park_inventory.py` now performs the first real extraction pass for the `ga_state_parks` provider family
- it emits dated unit-type counts and diversified sample site rows for all `9` Yonder Georgia State Park anchors
- sample site detail POSTs also expose:
  - coarse booking state like `bookable` or `notify_only`
  - nightly rate
  - weekly rate
- the extractor now also emits normalized per-unit records, which is enough to begin Phase 2 inventory-contract work

This means the first provider family is no longer blocked on discovery or parsing shape. The next step is to formalize a normalized record contract and decide whether to persist provider records or keep them as runtime fetches first.

Runtime follow-through:

- chose the runtime-first path for the first product consumption slice
- `web/lib/yonder-provider-inventory.ts` now fetches live next-weekend Georgia State Parks unit counts
- that runtime snapshot is now attached in:
  - `web/app/api/portals/[slug]/yonder/destinations/route.ts`
  - `web/lib/spot-detail.ts`
- the Yonder homepage shelf and Yonder detail page now surface the live park snapshot instead of config-only inventory interpretation for Georgia State Parks anchors
- the next step is now implemented in code as well:
  - generic persistence table: `database/migrations/366_venue_inventory_snapshots.sql`
  - first provider sync job: `crawlers/scripts/sync_yonder_ga_state_park_inventory.py`
  - runtime reads now prefer persisted snapshot rows and only fall back to live provider fetch if no current row exists

Current limit:

- Georgia State Parks, Whitewater Express, and Unicoi now have applied persistence paths
- the main remaining non-integrated family is intentionally `self_guided`

Persistence update:

- migration `database/migrations/366_venue_inventory_snapshots.sql` was applied
- `crawlers/scripts/sync_yonder_ga_state_park_inventory.py --apply` wrote `9` persisted rows for arrival `2026-03-20`
- runtime verification now reads persisted records successfully for `cloudland-canyon`, including:
  - `109` tent sites
  - `18` cabins
  - representative `bookable` state
  - representative nightly rates like `$60.00` and `$185.00`

Second provider update:

- Whitewater Express is now also on the persisted snapshot path
- `crawlers/scripts/sync_yonder_whitewater_express_inventory.py --apply` wrote the first `package` snapshot row
- runtime verification now reads that persisted row successfully for `whitewater-express-columbus`
- current package snapshot exposes:
  - `4` bookable products
  - lowest visible price `$49.95`
  - package labels including `Classic Trip`, `Challenge Trip`, `Carnage Trip`, and `Season Pass`

Third provider update:

- Unicoi is now also on the persisted snapshot path
- endpoint discovery found a direct JSON search surface at `api/roomtype/search`, so browser automation is not required for the current slice
- `crawlers/scripts/sync_yonder_unicoi_inventory.py --apply` wrote the first overnight snapshot row
- runtime verification now reads that persisted row successfully for `unicoi-state-park`
- current overnight snapshot exposes:
  - `57` tent-site results
  - `11` cabin results
  - `6` lodge-room results
  - public base prices such as `$20.00`, `$229.00`, and `$199.00`

Georgia window fix:

- a real defect was found in the Georgia State Parks sync path: the default arrival date was still hardcoded to `03/20/2026`
- `crawlers/scripts/extract_yonder_ga_state_park_inventory.py` and `crawlers/scripts/sync_yonder_ga_state_park_inventory.py` now default to the next-weekend window instead
- a corrected apply run wrote the current `2026-03-13` Georgia State Parks snapshot set, so persisted rows now line up with the runtime comparison window

Snapshot hardening update:

- `database/migrations/375_yonder_inventory_current_snapshot_view.sql` now defines `current_venue_inventory_snapshots`
- `web/lib/yonder-provider-inventory.ts` now prefers that canonical current-snapshot path and only falls back to raw snapshot ordering for migration compatibility
- `crawlers/scripts/audit_yonder_inventory_snapshots.py` now reports `current` versus `stale`
- `crawlers/scripts/prune_yonder_inventory_snapshots.py` now gives the workstream a controlled retention tool
- `crawlers/scripts/check_yonder_inventory_freshness.py` now gives the workstream a machine-readable freshness gate

Execution path update:

- `crawlers/scripts/run_yonder_inventory_cycle.py --apply` now runs the operational path end-to-end:
  - sync
  - freshness check
  - retention prune
  - audit
- `web/app/api/cron/yonder-inventory/route.ts` now provides the secure scheduled entrypoint for that cycle
- the live `yonder` portal row now has explicit `settings.yonder_inventory_refresh = { cadence: daily, hour_utc: 11 }`
- `.github/workflows/yonder-inventory-refresh.yml` now gives the repo a native scheduled runner path that does not depend on web runtime shell access
