# Yonder Inventory Hardening Plan

**Parent docs:** `prds/034l-yonder-accommodation-inventory-workstream.md`, `prds/034n-yonder-provider-record-contract.md`  
**Status:** Active  
**Purpose:** Move Yonder accommodation inventory from “provider-backed and working” to “operationally reliable and reusable across portals.”

---

## 1. Current State

Yonder now has three live provider families on a shared persisted substrate:

- `ga_state_parks`
- `whitewater_express`
- `unicoi_lodge`

That solved the foundational feasibility question.

The next risk is not extraction. It is operational drift:

- multiple capture dates accumulate for the same venue/provider/window
- downstream readers have to know how to interpret “latest”
- stale rows can quietly pile up without any lifecycle rule

---

## 2. Hardening Objective

Make one claim true:

**there is a single canonical current snapshot for every destination/provider/window, and the system has an explicit lifecycle for history behind it.**

This is the platform-level improvement, not just a Yonder patch.

---

## 3. Execution Sequence

### Phase 1: Canonical Current Snapshot Layer

Deliverables:

- database view for the latest snapshot per venue/provider/scope/arrival window
- stronger lookup index for current-snapshot reads
- reader update so web consumers use the canonical path first

Success criteria:

- consumers no longer need to order raw snapshot history themselves
- fallback logic still works before or during migration rollout

### Phase 2: Snapshot Lifecycle Tooling

Deliverables:

- audit script that distinguishes current rows from stale history
- prune script with dry-run and apply modes

Success criteria:

- we can quantify stale buildup
- we can safely keep a small amount of history without leaving unbounded growth

### Phase 3: Freshness Operations

Deliverables:

- single orchestrated sync entrypoint
- expected freshness rule per provider family
- secure cron handoff

Success criteria:

- next-weekend comparisons do not silently fall behind

---

## 4. Current Implementation State

Implemented now:

- `database/migrations/375_yonder_inventory_current_snapshot_view.sql`
- `supabase/migrations/20260311110000_yonder_inventory_current_snapshot_view.sql`
- `web/lib/yonder-provider-inventory.ts` now prefers `current_venue_inventory_snapshots`
- `crawlers/scripts/audit_yonder_inventory_snapshots.py` now reports `current` vs `stale`
- `crawlers/scripts/prune_yonder_inventory_snapshots.py` now provides controlled retention management
- `crawlers/scripts/check_yonder_inventory_freshness.py` now provides a gate for future cron/automation runs
- `crawlers/scripts/run_yonder_inventory_cycle.py` now runs sync + freshness + prune + audit as one execution path
- `web/app/api/cron/yonder-inventory/route.ts` now provides a secure machine endpoint for scheduled Yonder inventory refresh
- live portal settings now include `settings.yonder_inventory_refresh = { cadence: daily, hour_utc: 11 }`
- `.github/workflows/yonder-inventory-refresh.yml` now provides the preferred scheduled runner path

Still pending:

- explicit freshness SLA by provider family beyond the current `1` day gate
- optional SQL-side or admin-side stale snapshot dashboarding
- route-trigger mode still requires `YONDER_INVENTORY_CRON_API_KEY` if that execution path is used

---

## 5. Recommended Retention Rule

Keep:

- latest `2` capture dates per venue/provider/scope/arrival window

Why:

- preserves one rollback/debugging layer
- prevents silent growth from daily reruns
- keeps read semantics simple

This should stay conservative until we have a broader inventory customer beyond Yonder.
