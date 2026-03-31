# Phase 4 Workstream — Canonical Entity Resolution

**Date:** 2026-03-30  
**Status:** Queued  
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

- [ ] audit duplicate venue creation patterns
- [ ] audit unresolved venue/source matching patterns
- [ ] audit festival occurrence linking quality
- [ ] audit recurring program/session linking quality

## Track B — Venue Canonicalization

- [ ] strengthen matching using normalized names
- [ ] incorporate source URL/domain hints
- [ ] incorporate address and geospatial hints
- [ ] define conflict-handling rules for ambiguous matches

## Track C — Festival and Program Linkage

- [ ] define persistent festival entity vs occurrence handling
- [ ] strengthen program/session linkage for structured activities
- [ ] improve recurring class/league series connection rules

## Track D — Organizer/Producer Linking

- [ ] audit where organizer identity is duplicated or weakly captured
- [ ] define when producer/organizer should be the linking spine across events, venues, festivals, and programs

## Verification

- [ ] duplicate venue rate on sampled runs trends down
- [ ] festival and program linkage quality improves on sampled data
- [ ] no portal attribution or federation contracts are broken by the changes

## Exit Criteria

- measurable reduction in duplicate or unresolved entity cases
- clearer festival and program relationship model
- schema and matching changes are migration-backed and documented

## Risks

- weak source capture quality can masquerade as an entity-resolution problem
- aggressive merging can create false canonical links that are harder to unwind than duplicates
- schema changes can collide with other ongoing federation work if sequencing is sloppy

## Progress Log

### 2026-03-30

- Workstream created from roadmap.
- Phase intentionally queued behind crawler remediation and bounded enrichment foundation work.

