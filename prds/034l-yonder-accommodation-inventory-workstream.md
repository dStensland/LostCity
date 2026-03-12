# Yonder Accommodation Inventory Workstream

**Parent docs:** `prds/034k-yonder-accommodation-inventory-source-model.md`, `prds/034i-yonder-gap-closure-plan.md`, `prds/034h-yonder-category-content-analysis.md`  
**Status:** Active  
**Purpose:** Turn Yonder’s current weekend accommodation model from static provider semantics into a repeatable inventory workstream with clear execution phases, success criteria, and blocker rules.

---

## 1. Workstream Objective

Yonder already has:

- weekend destination anchors
- booking-readiness flags
- overnight semantics
- stay-option semantics
- booking-provider normalization
- coarse stay profiles
- accommodation-inventory source modeling

The next objective is narrower and more concrete:

**build enough provider-backed inventory truth that Yonder can compare weekend escapes by what is actually bookable, not just by destination narrative.**

This workstream is not trying to become a full OTA or reservation engine.

It is trying to make three claims true:

1. we know the provider surface for each weekend trip
2. we know the meaningful stay units for each provider family
3. we can progressively enrich into availability and price-aware comparison where the provider supports it

---

## 2. Workstream Structure

### Phase 0: Baseline Provider Audit

Goal:

- prove the current weekend set is internally consistent across venue rows, booking URLs, bridge semantics, and the new accommodation model

Outputs:

- provider-domain audit script
- baseline run note
- explicit provider family counts

Exit criteria:

- all promoted weekend anchors map to exactly one normalized provider family
- reservation URLs and provider classification are not obviously contradictory

Current state:

- complete
- all `13` promoted weekend anchors now map to one normalized provider family
- one real defect was found and fixed: `unicoi-state-park` now points to the live IQWebBook booking URL instead of the dead reservations subdomain

### Phase 1: Provider Profiles

Goal:

- define the extraction contract for each live provider family

Provider families in scope now:

- `ga_state_parks`
- `unicoi_lodge`
- `whitewater_express`
- `self_guided`

Outputs:

- one provider profile per family
- source URLs or entry URLs
- known unit types
- known availability surfaces
- known price surfaces
- auth / anti-bot / JS constraints

Exit criteria:

- each provider family is classified as:
  - `crawlable now`
  - `crawlable with browser`
  - `manual-link only for now`

Current state:

- underway
- baseline classification is now written for `ga_state_parks`, `unicoi_lodge`, `whitewater_express`, and `self_guided`

### Phase 2: Inventory Ingestion Shape

Goal:

- define the normalized record shape for provider-backed accommodation inventory without prematurely forcing schema

Candidate normalized fields:

- `destination_slug`
- `provider_id`
- `unit_type`
- `unit_label`
- `inventory_status`
- `availability_window`
- `price_from`
- `currency`
- `inventory_note`
- `source_url`
- `last_verified_at`

Outputs:

- proposed normalized record contract
- one validator or audit script against sample provider output

Exit criteria:

- at least one provider family can emit normalized unit records

Current state:

- started
- `ga_state_parks` now emits normalized per-unit records through `crawlers/scripts/extract_yonder_ga_state_park_inventory.py`
- current normalized fields already include unit category, visible inventory count, and sample price / booking-state evidence

### Phase 3: First Provider Integration

Goal:

- get one provider family producing real unit-level records

Recommended first provider:

- `ga_state_parks`

Why:

- highest surface share in the current weekend set
- strongest leverage across Yonder’s promoted anchors
- already represented through normalized booking posture and inventory semantics

Outputs:

- first provider fetch/probe script
- first normalized sample output
- baseline freshness / failure behavior

Exit criteria:

- at least 5 Yonder weekend anchors have provider-backed unit records

Current state:

- started with `ga_state_parks`
- first probe script resolves all `9` Georgia State Park weekend anchors to public provider handles and search URLs
- unit-option labels are already visible from public search pages, so the next step is availability/price extraction rather than basic park identification
- dated search requests also work through the public `campsiteSearch.do` flow with exposed form fields, so there is no current provider-level blocker on Georgia State Parks
- first extraction pass now emits dated unit-type summaries and normalized sample site rows for all `9` park anchors
- second-stage site-detail POSTs also expose coarse `bookable` / `notify_only` state plus nightly and weekly price signals

### Phase 4: Product Consumption

Goal:

- turn provider-backed records into comparison value, not just hidden data

Product uses:

- weekend shelf ranking improvements
- “what can I actually stay in?” comparison rows
- booking-friction-aware recommendations
- better detail-page planning modules

Exit criteria:

- Yonder weekend UI uses provider-backed inventory records instead of config-only inference for at least one provider family

Current state:

- started
- Yonder’s destination API and weekend/detail UI now consume live next-weekend Georgia State Parks unit-count snapshots at runtime
- runtime consumption now prefers persisted `venue_inventory_snapshots` rows when present and falls back to live provider fetches
- first persistence layer is defined through `database/migrations/366_venue_inventory_snapshots.sql`
- first sync job is `crawlers/scripts/sync_yonder_ga_state_park_inventory.py`
- the first production write has landed: `9` Georgia State Parks snapshot rows for arrival `2026-03-20`
- second provider family now also lands on the same substrate through `crawlers/scripts/sync_yonder_whitewater_express_inventory.py`
- Whitewater Express now contributes a persisted `package` snapshot row with `4` live bookable products and a lowest visible price of `$49.95`
- third provider family now lands on the same substrate through `crawlers/scripts/sync_yonder_unicoi_inventory.py`
- Unicoi now contributes a persisted overnight snapshot with `74` overnight results across tent sites, cabins, and lodge rooms
- Georgia State Parks defaults are now corrected to use the next-weekend window instead of the earlier hardcoded `03/20/2026` placeholder

### Phase 5: Snapshot Hardening

Goal:

- make “current snapshot” a platform primitive instead of a consumer-side convention

Outputs:

- canonical current-snapshot view
- stronger lookup index
- stale-history audit and prune tooling

Exit criteria:

- consumers can read the latest row without re-implementing ordering logic
- stale history can be measured and managed explicitly

Current state:

- started and materially implemented
- `database/migrations/375_yonder_inventory_current_snapshot_view.sql` defines `current_venue_inventory_snapshots`
- `web/lib/yonder-provider-inventory.ts` now prefers the canonical current view and falls back to direct table ordering only for migration compatibility
- `crawlers/scripts/audit_yonder_inventory_snapshots.py` now reports `current` versus `stale`
- `crawlers/scripts/prune_yonder_inventory_snapshots.py` now supports dry-run and apply retention cleanup
- `crawlers/scripts/check_yonder_inventory_freshness.py` now provides a freshness gate for future scheduled sync execution
- `crawlers/scripts/run_yonder_inventory_cycle.py` now runs the full apply cycle in one command
- `web/app/api/cron/yonder-inventory/route.ts` now exposes the secure cron entrypoint
- the live `yonder` portal row now carries explicit `yonder_inventory_refresh` cadence settings
- `.github/workflows/yonder-inventory-refresh.yml` now provides the preferred scheduled execution path

---

## 3. Success Metrics

### Operational

- provider coverage for promoted weekend anchors
- percent of weekend anchors with normalized provider records
- percent of provider records with explicit unit type
- percent of provider records with a usable booking URL

### Product

- percent of weekend anchors with meaningful accommodation comparison
- reduction in “generic weekend shelf” repetition
- ability to distinguish book-early versus flexible weekends from provider evidence

---

## 4. Stop Conditions

This workstream should continue by default and only pause on real blockers.

Real blockers are:

- provider surface is behind auth, anti-bot, or inaccessible JS with no stable fallback
- provider pages do not expose meaningful unit-level inventory at all
- provider output is too unstable to normalize reliably
- legal or product policy says link-only is required

Not blockers:

- inventory is incomplete but parseable
- provider shape is messy but consistent enough to profile
- only one provider family is ready before others

---

## 5. Immediate Sequence

1. finish Phase 0 baseline provider audit
2. write Phase 1 provider profiles for the four current families
3. start with `ga_state_parks` as the first real provider integration target
4. only branch to `unicoi_lodge` or `whitewater_express` sooner if Georgia State Parks proves technically blocked
5. harden freshness and lifecycle before adding lower-leverage provider families
