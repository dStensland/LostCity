# Phase 4 Workstream — Canonical Entity Resolution

**Date:** 2026-03-30  
**Status:** Complete  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This is the execution workstream for Phase 4 of the rich data roadmap.

## Objective

Improve canonical linking across venues, festivals, programs, sessions, and organizers so the data layer compounds across sources instead of accumulating near-duplicates and fragmented identities.

## Drift Controls

- Do not start schema-heavy redesign before Phase 2 has materially improved source capture quality.
- Prefer strengthening existing matching and linkage before inventing new entity types or complex graph infrastructure.
- Changes should improve federation value across portals, not just one vertical.
- Any schema changes must include:
  - `database/migrations/`
  - `supabase/migrations/`
  - `database/schema.sql`

## Canonical References

- Roadmap: `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`
- `STRATEGIC_PRINCIPLES.md`
- `ARCHITECTURE_PLAN.md`

## Scope

### In scope

- venue alias and duplicate reduction
- festival entity vs yearly occurrence linkage
- recurring program vs session linkage
- stronger organizer/producer cross-entity linking

### Out of scope

- UI-first redesigns
- bespoke portal-only entity semantics
- speculative graph infrastructure not tied to clear product or quality gains

## Execution Tracks

## Track A — Audit and Metrics Baseline

- [x] audit duplicate venue creation patterns
- [x] audit unresolved venue/source matching patterns
- [x] audit festival occurrence linking quality
- [x] audit recurring program/session linking quality

## Track B — Venue Canonicalization

- [x] strengthen matching using normalized names
- [x] incorporate source URL/domain hints
- [x] incorporate address and geospatial hints
- [x] define conflict-handling rules for ambiguous matches

## Track C — Festival and Program Linkage

- [x] define persistent festival entity vs occurrence handling
- [x] strengthen program/session linkage for structured activities
- [x] improve recurring class/league series connection rules

## Track D — Organizer/Producer Linking

- [x] audit where organizer identity is duplicated or weakly captured
- [x] define when producer/organizer should be the linking spine across events, venues, festivals, and programs

## Verification

- [x] duplicate venue rate on sampled runs trends down
- [x] festival and program linkage quality improves on sampled data
- [x] no portal attribution or federation contracts are broken by the changes

## Exit Criteria

- measurable reduction in duplicate or unresolved entity cases
- clearer festival and program relationship model
- schema and matching changes are migration-backed and documented
- residual mutation work is explicitly bounded under a non-blocking gate

## Risks

- weak source capture quality can masquerade as an entity-resolution problem
- aggressive merging can create false canonical links that are harder to unwind than duplicates
- schema changes can collide with other ongoing federation work if sequencing is sloppy

## Progress Log

### 2026-03-30

- Workstream created from roadmap.
- Phase intentionally queued behind crawler remediation and bounded enrichment foundation work.

### 2026-04-03

- Phase 4 is now active after Phase 5 closed with two clean `PASS` cycles.
- The audit baseline artifacts now exist:
  - `crawlers/reports/entity_resolution_report_latest.md`
  - `crawlers/reports/entity_resolution_gate_latest.json`
- The first live baseline metrics are:
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `5.1%`
  - program/session fragmentation rate: `39.4%`
  - organizer duplication rate: `0.0%`
- At that baseline checkpoint, the gate was `BASELINE_READY`, which closed the audit-only prerequisite for mutation work.
- The first bounded Wave A queue should start with the lowest-risk place families surfaced by the report:
  - `Symphony Hall` / `Atlanta Symphony Hall`
  - `Painted Pin` / `The Painted Pin`
  - `Lore` / `Lore Atlanta`
  - `Atlanta BeltLine` / `Atlanta BeltLine Center`
- The baseline also shows a strategic pressure point: program/session fragmentation is materially larger than venue duplication, so Wave C already has a strong queued backlog once Wave A is underway.

### 2026-04-03 — Late-Stage Snapshot

- Wave A0 low-risk venue canonicalization landed:
  - `Atlanta Symphony Hall` merged into `Symphony Hall`
  - `The Painted Pin` merged into `Painted Pin`
- The residual same-domain / different-address venue families are now deliberately treated as `manual_review_only`, not low-risk alias work:
  - `Lore` / `Lore Atlanta`
  - `Atlanta BeltLine` / `Atlanta BeltLine Center`
  - `Metropolitan Studios, Inc.` / `Metropolitan Studios`
  - similar venue families now classify conservatively in `entity_resolution_report_latest.md`
- Wave B festival year-cycle cleanup is functionally closed:
  - yearly-wrapper fragmentation is now `0.0%`
  - safe wrappers for `Anime Weekend Atlanta`, `BronzeLens Film Festival`, `Dragon Con`, and `Juneteenth Atlanta Parade & Music Festival` were deactivated after unlinking the duplicate shell rows
- Wave C is now late-stage rather than dominant:
  - exact-duplicate and family-key repair swept the active `atlanta-families` portal program sources
  - live summary:
    - `32` active sources scanned
    - `19` sources changed
    - `1250` family-key backfills
    - `43` exact duplicate deletes
  - a follow-up residual tranche then repaired legacy base-portal rows:
    - `cobb-parks-rec` on `atlanta`: `793` family-key backfills, `46` duplicate deletes
    - `gwinnett-parks-rec` on `atlanta`: `238` family-key backfills, `18` duplicate deletes
    - `piedmont-classes` on `piedmont`: `94` family-key backfills, `2` duplicate deletes
  - program/session fragmentation dropped from `39.4%` into a bounded residual queue now measured at `2.4%`
- Wave D remains verify-only:
  - organizer duplication still reads `0.0%`
  - no organizer alias/canonical-link tranche is currently justified
- The first post-roadmap venue-description pilot artifacts now exist:
  - `crawlers/reports/venue_description_report_latest.md`
  - `crawlers/reports/venue_description_gate_latest.json`
  - the pilot is now a repeated bounded production loop:
    - cycle 1 accepted and updated:
      - `Best Friend Park Pool`
      - `Cemetery Field`
      - `DeShong Park`
    - cycle 1 skipped thin/noisy sites:
      - `Look Cinemas`
      - `The Springs Cinema & Taphouse`
    - cycle 2 accepted and updated:
      - `Core Dance Studios`
      - `Gordon Biersch Brewery Restaurant`
      - `Marietta Theatre Company`
      - `Urban Grind`
      - `Vas Kouzina`
    - cycle 3 accepted and updated:
      - `Ameris Bank Amphitheatre`
      - `Lyndon House Arts Center`
      - `Mary Schmidt Campbell Center for Innovation and the Arts`
      - `Pinch 'n' Ouch Theatre`
      - `Spelman College Museum of Fine Art`
    - cycle 4 accepted and updated:
      - `Atlanta Ballet Centre - Michael C. Carlos Dance Centre`
      - `Auburn Avenue Research Library`
      - `The Ivy Bookshop at Ponce City Market`
      - `Kimchi Red - Alpharetta`
      - `Mary Schmidt Campbell Center for Innovation and the Arts, Bank of America Gallery`
    - cycle 5 accepted and updated:
      - `Gas South Arena`
      - `Gateway Center Arena`
      - `Silverbacks Park`
      - `Waffle House Museum`
      - `World of Coca-Cola`
    - cycle 6 accepted and updated:
      - `Giga-Bites Cafe`
      - `OYL Studios`
      - `Spruill Center for the Arts`
      - `The Wasteland Gaming`
    - cycle 7 accepted and updated:
      - `Atlanta Monetary Museum`
      - `Echo Contemporary`
      - `Tony’s Sports Grill Norcross`
    - cycle 7 correctly skipped thin source pages:
      - `Martin Luther King Jr. National Historical Park`
      - `Wolf Creek Amphitheater`
    - cycle 8 accepted and updated:
      - `The Royal Peacock`
    - cycle 8 classified non-write outcomes:
      - `Currahee Brewing Company` (`ssrf-blocked`)
      - `Contender eSports` (`ERR_CERT_COMMON_NAME_INVALID`)
      - `Paris on Ponce` (`grounding_failed`)
    - cycle 9 accepted and updated:
      - `Actor’s Express`
      - `SK8 the Roof`
    - cycle 9 classified non-write outcomes:
      - `Track Rock Gap Petroglyphs` (`low-signal page text`)
      - `KING OF DIAMONDS ATLANTA` (`grounding_failed`)
      - `Nightmare’s Gate` (`grounding_failed`)
    - repeated thin-source rows now route directly to `monitor_only`:
      - `mlk-national-historical-park`
      - `wolf-creek-amphitheater`
    - low-signal storefront/corporate pages now land in an explicit `monitor_only` queue instead of the active pilot queue
    - known low-signal domains like `artsatl.org`, `roswellgov.com`, `georgiastatesports.com`, and `stadium.utah.edu` now route directly to `monitor_only`
  - current pilot state:
    - eligible website-backed Tier 1+ places: `2349`
    - pilot candidate count: `208`
    - monitor-only low-signal count: `45`
    - healthy description rate: `89.2%`
    - junk / boilerplate rate: `1.1%`
    - gate decision: `PILOT_READY`
- The entity gate is now operationally aligned with the real state:
  - `entity_resolution_gate_latest.json` reports `BOUNDED_QUEUE`
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `0.0%`
  - program/session fragmentation rate: `2.4%`
  - organizer duplication rate: `0.0%`
- The remaining Phase 4 queue is now a bounded monitoring surface, not an active mutation workstream.
