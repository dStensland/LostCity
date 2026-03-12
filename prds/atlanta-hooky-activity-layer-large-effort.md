# Atlanta-Owned Activity Layer Large Effort

**Owner portal:** `atlanta`  
**Consumer portal:** `hooky`  
**Surface:** `consumer`  
**Status:** Active / expansion complete, quality hardening underway  
**Last Updated:** 2026-03-11  
**Depends on:** `prds/hooky-next-big-effort-workstream.md`, `prds/atlanta-activity-queue-a-feasibility.md`, `prds/atlanta-activity-overlay-audit.md`, `prds/hooky-family-portal-health-plan.md`, `prds/hooky-activity-federation-rules.md`, `prds/atlanta-hooky-activity-preflight-checkpoint-2026-03-11.md`, `prds/atlanta-hooky-activity-layer-phase-2.md`

---

## Purpose

This document consolidates the current activity-layer work into one large execution program that can run in batches without requiring check-in after every task.

The central rule remains:

- Atlanta owns shared family-relevant activity and destination intelligence
- Hooky consumes that layer through federation, family filtering, age-band framing, and planning surfaces

The point of this effort is not just to add more places.

The point is to give LostCity a durable shared activity graph that:

- improves Hooky immediately
- strengthens Atlanta as the system of record
- compounds into other portals later

---

## Current Baseline

As of 2026-03-11:

- `39` Hooky family-program sources are active
- `53` Atlanta-owned activity targets are live
- `159` active `venue_features` rows exist across the current activity-overlay program
- Hooky federation rules are implemented for venue features on spot detail
- the first activity waves already cover museums, attractions, animal destinations, indoor play, arcades/games, ropes/adventure, and water/outdoor outing categories

This means the effort has moved past research.

The next phase is coordinated expansion plus hygiene hardening.

The current checkpoint for whether it is safe to proceed lives in:

- `prds/atlanta-hooky-activity-preflight-checkpoint-2026-03-11.md`

The next major expansion push after the current baseline is now defined in:

- `prds/atlanta-hooky-activity-layer-phase-2.md`

The current quality audit for this layer lives in:

- `crawlers/reports/atlanta_activity_quality_audit_2026-03-11.md`

The reusable audit runner for this layer lives in:

- `crawlers/scripts/audit_atlanta_activity_quality.py`

---

## Preflight Reality Check

Before the next major build sweep, we need to separate `live data is healthy` from `repo state is clean`.

### What is in good shape now

- live activity overlay data is applied
- the Atlanta-owned overlay model is working
- Hooky federation is wired
- the workstream has real reports and implementation artifacts
- the 2026-03-11 quality audit reduced weak venue metadata issues in the target set to `0`

### What is not clean right now

- the git worktree is heavily dirty outside this activity effort
- `database/schema.sql` is already modified
- `database/migrations/` and `supabase/migrations/` have large numbers of unrelated untracked files
- there is no safe clean commit boundary for this activity-layer effort yet

### Practical implication

We should treat repo hygiene as a checkpoint requirement before any attempt to package this as a coherent commit stream.

We should **not** pretend the whole repository is clean.

We should **not** make a mixed commit that bundles unrelated crawler, web, and migration work with the activity-layer program.

---

## Program Goal

By the end of this large effort, LostCity should have:

1. a strong Atlanta-owned activity graph for family-relevant outings
2. clear Hooky federation rules for family-safe consumption
3. better family fallback planning for:
   - `This Weekend`
   - `Rainy Day`
   - `No School`
   - `Gap Fill`
   - `Visitors In Town`
4. a cleaner operational package for data, docs, tests, and live-state verification

---

## Workstream Structure

## Phase 0. Hygiene And Checkpointing

**Goal:** establish a trustworthy execution baseline before the next large build wave.

### Tasks

- inventory the files that belong to the activity-layer program
- identify files that are activity-related but mixed with unrelated edits
- verify current live totals and existing reports
- confirm whether any schema or migration work is actually required for the next phase
- define the commit boundary that would be safe once the worktree is isolated

### Exit gate

- clear file manifest for this effort
- explicit statement of what is safe to commit versus what is mixed with unrelated work
- no false claim that the repo is globally clean

---

## Phase 1. Stabilize The Existing Atlanta-Owned Activity Layer

**Goal:** harden what is already live before widening further.

### Tasks

- clean legacy mixed feature packs on venues with pre-existing rows
- verify feature slugs, labels, categories, URLs, and `venue_type` consistency
- confirm Hooky family filtering is excluding operational/admin-style features
- refresh reports and counts so docs match reality
- identify thin or low-confidence overlays that need better sourcing

### Exit gate

- current `53` targets are internally consistent
- Hooky consumes the correct subset of Atlanta-owned features
- docs and live counts match

---

## Phase 2. Expand Overlay Coverage To The Next Tier

**Goal:** widen the activity graph using the lowest-friction Atlanta-owned targets.

### Target categories

- remaining animal/wildlife destinations
- additional indoor-play operators
- additional metro games/arcade destinations
- more outdoor/adventure outing destinations
- strong family attractions with durable public pages

### Batch shape

- run in grouped overlay waves, not one-off venue additions
- each wave should include:
  - target list
  - dry-run
  - live apply
  - report
  - aggregate count refresh

### Exit gate

- activity overlay program reaches the next meaningful breadth threshold
- major family destination gaps in Atlanta are materially smaller

---

## Phase 3. Add True New Operator Families

**Goal:** move beyond overlay wins and add operators that require net-new venue ownership or source logic.

### Priority lanes

- family indoor play operators not already covered
- animal / sanctuary / wildlife outing operators
- ropes / climbing / aerial / adventure operators
- destination-grade entertainment venues that work for mixed age bands
- seasonal or water-oriented outing operators with repeat family value

### Tasks

- create missing Atlanta venue rows where appropriate
- seed durable feature packs with explicit URLs
- document any operator-specific parsing or sourcing rules
- avoid fake metro-wide aggregation where locations should be distinct rows

### Exit gate

- at least 2-3 additional operator families are represented
- location-level ownership is correct where multi-location brands exist

---

## Phase 4. Hooky Federation And Family Readiness

**Goal:** make the Atlanta-owned activity graph genuinely useful inside Hooky.

### Tasks

- tighten family inclusion/exclusion rules for venue features
- define family-facing category groupings and age-band hints
- identify which activity types deserve special treatment in Hooky surfaces
- audit activity usefulness for:
  - `Rainy Day`
  - `No School`
  - `Gap Fill`
  - toddler
  - elementary
  - tween
  - mixed-age family use

### Exit gate

- Hooky is not just inheriting raw Atlanta feature rows
- family-facing presentation logic is explicit and testable

---

## Phase 5. Product Readiness And Scorecard

**Goal:** grade the combined family-program plus activity stack like a product, not a crawler backlog.

### Tasks

- score major family planning lanes:
  - programs
  - civic/public family inventory
  - destination activities
  - rainy-day fallback
  - outdoor fallback
  - younger-kid utility
  - mixed-age utility
- identify categories where competitors still feel fuller
- identify whitespace categories nobody is covering well
- turn the scorecard into the next prioritized backlog

### Exit gate

- clear `ahead / near parity / behind` view by lane
- next backlog driven by product health, not instinct

---

## Execution Rules

These are the standing rules for autonomous execution.

1. Prefer Atlanta-owned activity additions when the destination is broadly useful beyond Hooky.
2. Batch work by category or operator family, not one venue at a time.
3. Every execution wave should leave behind:
   - code or data changes
   - a report
   - refreshed totals
   - updated planning docs
4. Do not create duplicate Hooky-owned source graphs for things Atlanta should own.
5. Do not make schema changes unless they are truly required; if required, update:
   - `database/migrations`
   - `supabase/migrations`
   - `database/schema.sql`
6. Do not make mixed commits while the repo contains unrelated modifications.

---

## Hygiene Checklist Before The Next Major Push

Before continuing large implementation waves, confirm:

- live data totals are still correct
- the activity-layer file manifest is current
- no pending schema requirement is being ignored
- the next batch does not depend on unresolved mixed edits in unrelated files
- commit packaging strategy is explicit

If those are not true, stop and resolve the hygiene issue first.

---

## Immediate Next Batch

The next large batch after preflight should be:

1. finalize the activity-layer file manifest
2. refresh live overlay totals and legacy-pack cleanup targets
3. define the next grouped overlay/new-operator queue
4. only then resume implementation

That keeps the effort large and fast without letting repo hygiene drift further.
