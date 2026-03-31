# Phase 5 Workstream — Quality Ops and Publishing

**Date:** 2026-03-30  
**Status:** Queued  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This is the execution workstream for Phase 5 of the rich data roadmap.

## Objective

Turn data quality improvements into a repeatable operating system with measurable reporting, promotion gates, and visible impact on live consumer surfaces.

## Drift Controls

- This phase should measure and enforce real quality, not become another reporting-only document exercise.
- Consumer-visible outcomes matter more than internal metric vanity.
- Reporting should focus on actionable source/entity defects, not just aggregate counts.
- Do not build portal-specific hacks to hide bad data; upstream quality fixes remain the priority.

## Canonical References

- Roadmap: `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`
- `BACKLOG.md`
- `DEV_PLAN.md`
- Related spec: `docs/superpowers/specs/2026-03-30-event-classification-fix.md`

## Scope

### In scope

- source quality reporting
- promotion gates for high-value sources
- recurring QA sampling for changed sources
- ensuring live portal surfaces benefit from upstream fixes

### Out of scope

- building net-new crawler enrichment systems
- deep entity resolution changes
- design-only dashboard work without operational hooks

## Execution Tracks

## Track A — Quality Reporting

- [ ] define report/dashboard fields:
  - null description rate
  - synthetic description rate
  - unresolved venue rate
  - duplicate rate
  - stale date rate
  - crawl failure rate
  - music vs nightlife routing quality
  - `live-music` tag precision
  - major music venue place-type correctness
- [ ] decide report location and cadence
- [ ] ensure top degraded sources are immediately visible

## Track B — Promotion Gates

- [ ] define which sources need stricter promotion checks before production runs
- [ ] define pass/fail criteria for dry-run health and sampled output quality
- [ ] document rollback or hold procedures when a source fails

## Track C — Portal Impact Verification

- [ ] verify Atlanta consumer pages show fewer synthetic/thin/broken detail experiences
- [ ] verify FORTH/HelpATL/Family surfaces benefit from upstream quality improvements
- [ ] identify remaining live-product rough edges caused by data defects
- [ ] verify Music/Nightlife/Theater surfaces are materially cleaner after classification fixes

## Track D — QA Sampling Loop

- [ ] define recurring sample review process for changed sources
- [ ] define where findings are logged and how they feed back into crawler fixes

## Verification

- [ ] recurring quality report exists
- [ ] degraded sources are ranked and actionable
- [ ] portal-facing pages show measurable quality improvement

## Exit Criteria

- quality reporting is operational, not ad hoc
- production gating exists for high-value sources
- portal teams can see the impact of crawler and enrichment improvements on live surfaces

## Risks

- metrics can become passive if no ownership or cadence is attached
- aggregate dashboards can hide the specific sources causing user-visible pain
- publishing pressure can encourage hiding defects instead of fixing ingestion

## Progress Log

### 2026-03-30

- Workstream created from roadmap.
- Phase intentionally queued until upstream fixes produce enough signal to operationalize.
- Event classification verification integrated here because the user-visible proof of success belongs in quality ops, not just crawler implementation notes.
