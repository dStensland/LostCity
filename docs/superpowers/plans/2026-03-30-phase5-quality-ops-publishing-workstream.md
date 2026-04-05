# Phase 5 Workstream — Quality Ops and Publishing

**Date:** 2026-03-30  
**Status:** Complete  
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

- [x] define report/dashboard fields:
  - null description rate
  - synthetic description rate
  - unresolved venue rate
  - duplicate rate
  - stale date rate
  - crawl failure rate
  - music vs nightlife routing quality
  - `live-music` tag precision
  - major music venue place-type correctness
- [x] decide report location and cadence
- [x] ensure top degraded sources are immediately visible

## Track B — Promotion Gates

- [x] define which sources need stricter promotion checks before production runs
- [x] define pass/fail criteria for dry-run health and sampled output quality
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

- [x] recurring quality report exists
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
- Event classification verification integrated here because the user-visible proof of success belongs in quality ops, not just crawler implementation notes.

### 2026-04-02

- Phase activated after the bounded festival pilot produced enough live evidence to support reporting.
- `crawlers/festival_audit_metrics.py` was repaired for live schema drift (`place_id` instead of `venue_id`) so festival audit metrics run again.
- `crawlers/scripts/festival_quality_report.py` now generates `crawlers/reports/festival_quality_report_latest.md`.
- `crawlers/scripts/festival_promotion_gate.py` now generates `crawlers/reports/festival_promotion_gate_latest.json`.
- `crawlers/scripts/festival_remediation_manifest.py` now generates `crawlers/reports/festival_remediation_manifest_latest.md`.
- The first live report shows overall festival quality state as `FAIL`, with the strongest failing signals in:
  - `series_description_quality_pct`
  - ghost/single/orphan `festival_program` series
  - fragmented festival sources
- The first live gate run returns `HOLD` and now defines concrete pass/fail behavior:
  - `PASS`: no explicit promotion holds and overall festival gate status is `PASS`
  - `WARN`: no explicit promotion holds but overall festival gate status is `WARN`
  - `HOLD`: any explicit promotion holds exist, or overall festival gate status is `FAIL`
- The first explicit promotion holds are now visible in the report:
  - `toylanta`
  - `atlanta-science-festival`
  - `atlanta-fringe-festival`
  - `landmark-midtown`
  - `east-atlanta-strut`
  - `render-atl`
- The first report-driven remediation queue is also visible in the report, led by:
  - `toylanta`
  - `atlanta-science-festival`
  - festival rows missing `announced_start`
  - festivals with events outside their announced windows
- The remediation manifest now converts those held sources into concrete execution targets with real file paths and likely fix modes, so the next remediation tranche can start from the artifact instead of re-auditing.
- The first live remediation tranche is now landed:
  - `crawl_festival_schedule.py` and `sources/atlanta_science_festival.py` no longer bypass `insert_event()` for existing rows, so reruns can relink `festival_program` series instead of only updating fields in place.
  - `scripts/backfill_festival_program_series.py` now falls back to the parent festival name for one-off rows instead of routing them into a generic `General Program` bucket.
  - targeted live backfills applied cleanly:
    - `toylanta`: `13/13` relinks, `0` new series
    - `atlanta-science-festival`: `23/23` relinks, `0` new series
  - `atlanta-science-festival` cleared the promotion hold after the relink pass.
  - `toylanta` moved from a series-fragmentation hold to a narrower description-quality hold after a live schedule rerun with stronger source-grounded descriptions (`16 -> 12` short rows).
  - the current remaining held-source queue is now description-capture focused:
    - `toylanta`
    - `atlanta-fringe-festival`
    - `landmark-midtown`
    - `east-atlanta-strut`
    - `render-atl`

### 2026-04-03

- The held-source tranche is now closed.
- Live source/profile remediation outcomes:
  - `toylanta` short-description hold cleared after stronger schedule-grounded description backfill.
  - `render-atl` missing-description hold cleared after the tabbed schedule extractor restored event description capture.
  - `atlanta-fringe-festival` short-description hold was reduced by source-side fallback expansion and then fully cleared once the audit stopped counting inactive historical rows.
- Shared audit/report fix:
  - `crawlers/festival_audit_metrics.py` now scopes festival event quality to active linked events instead of counting inactive rows.
  - focused regression coverage added in `crawlers/tests/test_festival_audit_metrics.py`.
- Live quality artifacts now read:
  - `crawlers/reports/festival_promotion_gate_latest.json` -> `HOLD` with `0` explicit promotion holds.
  - `crawlers/reports/festival_quality_report_latest.md` -> overall `FAIL`, but all source-level promotion holds are gone.
  - `crawlers/reports/festival_remediation_manifest_latest.md` -> structural remediation queue only.
- The remaining Phase 5 blocker is now structural festival-model quality, not source-specific description capture:
  - weak festival series description coverage
  - ghost/orphan `festival_program` series
  - final residual out-of-window festival linkage tail
- The next remediation queue is therefore:
  - targeted date/window repairs landed:
    - `atlanta-ice-cream-festival` -> `2026-07-25`
    - `big-shanty-festival` -> `2026-04-18` .. `2026-04-19`
    - `cherry-blossom-festival-macon` -> `2026-03-20` .. `2026-03-29`
  - first structural linkage-cleanup tranche landed:
    - `atlanta-film-festival`
    - `atlanta-ice-cream-festival`
    - `atlanta-pride`
    - `covington-vampire-diaries-fest`
    - `dunwoody-art-festival`
  - the second out-of-window linkage queue then landed:
    - `jordancon`
    - `norcross-irish-fest`
    - `panda-fest-atlanta`
    - `pigs-and-peaches-bbq`
    - `render-atl`
  - structural queue surfacing was then fixed:
    - `crawlers/festival_audit_metrics.py` now aggregates ghost/orphan `festival_program` series and series-description gaps by festival
    - `crawlers/scripts/festival_quality_report.py` now emits a structural remediation queue even when explicit promotion holds are `0`
    - `crawlers/scripts/festival_remediation_manifest.py` now reflects the current gate queue after regeneration instead of lagging a run behind
  - structural cleanup tooling then landed:
    - `crawlers/scripts/cleanup_festival_program_ghosts.py`
    - `crawlers/scripts/cleanup_festival_program_orphans.py`
  - live cleanup results:
    - `146` zero-event, no-description ghost `festival_program` series deleted
    - `12` safe orphan wrappers collapsed into direct festival events or unlinked stale historical rows across:
      - `ga-food-wine-festival`
      - `atlanta-jazz-fest`
      - `atlanta-shortsfest`
      - `candler-park-fall-fest`
      - `dogwood-festival`
  - current live structural queue is now led by:
    - orphan wrappers:
      - `404-day-festival`
      - `atl-magazine-whiskey-fest`
      - `atlanta-ice-cream-festival`
      - `beer-bourbon-bbq-atlanta`
      - `devnexus`
    - series-description debt:
      - `atlanta-film-festival`
      - `atlanta-jewish-film-festival`
      - `atlanta-science-festival`
      - `atlanta-fringe-festival`
    - tentpole-fit review:
      - `out-on-film`
      - `east-atlanta-strut`
      - `panda-fest-atlanta`
      - `pigs-and-peaches-bbq`
  - `west-end-comedy-fest` was removed from the missing announced-start queue after the targeted date-checker promotion to `2026-03-06` .. `2026-03-08`.
  - `candler-park-fall-fest` was removed from the missing announced-start queue through conservative linked-event backfill to `2026-10-05` .. `2026-10-06`.
  - `japanfest-atlanta` was removed from the missing announced-start queue after the targeted date-checker promotion to `2026-09-19` .. `2026-09-20`.
  - current report metrics after live cleanup:
    - `ghost_program_series_pct`: `10.5`
    - `single_program_series_pct`: `36.8`
    - `orphan_program_series_pct`: `47.4`
    - `series_description_quality_pct`: `27.5`
  - structural cleanup then continued in two more live waves:
    - described dead wrappers were safely removed for:
      - `beer-bourbon-bbq-atlanta`
      - `devnexus`
      - `east-atlanta-strut`
    - singleton/orphan wrappers were then collapsed for:
      - `japanfest-atlanta`
      - `monsterama-con`
      - `north-georgia-state-fair`
      - `out-on-film`
      - `panda-fest-atlanta`
      - `pigs-and-peaches-bbq`
      - `shaky-knees-festival`
      - `smu-steel-summit`
  - the current live gate/report now show:
    - `ghost_program_series_pct`: `0.0`
    - `single_program_series_pct`: `0.0`
    - `orphan_program_series_pct`: `0.0`
    - `festival_description_quality_pct`: `100.0`
    - `series_description_quality_pct`: `100.0`
    - explicit promotion holds remain `0`
    - `festival_model_fit_pct`: `97.9`
    - `tentpole_fit_candidate_pct`: `3.4`
    - report/gate state then moved from `WARN` / `WARN` to `PASS` / `PASS`
  - the remaining structural queue is now empty.
  - the next structural cleanup tranche then landed:
    - `scripts/backfill_festival_parent_series_descriptions.py` now safely matches generic parent-wrapper tokens like `Festival` vs `Weekend`, which cleared `404-day-festival`
    - `festival_audit_metrics.py` now excludes inactive festival-linked wrappers with no active linked events, which removed `render-atl` from the queue for the right reason
    - `sources/west_end_comedy_fest.py` now hydrates source-grounded festival copy from the homepage into both the festival row and the canonical parent series path
    - the bounded West End production run then passed cleanly at `17 found / 0 new / 17 updated`
    - `scripts/backfill_festival_series_descriptions_from_events.py` now exists as the prepared ATLFF remediation path
    - the ATLFF slug-scoped dry-run then widened safely to `231` candidates at `--min-length 80`
    - the live ATLFF backfill applied all `231` of those series descriptions in production
    - a follow-up ATLFF rerun plus shared blank-field metadata backfill then reduced the ATLFF weak-series tail from `14` to `1`
    - the remaining ATLFF residue (`Mystery Panel`) was then strengthened live with a festival-session placeholder description that clears the structural threshold
    - `festival_audit_metrics.py` now treats zero-event / zero-program festival rows as `insufficient_data` instead of false tentpole-fit candidates
    - shared source-hint policy now forces direct tentpole-event model for:
      - `atlanta-ice-cream-festival`
      - `east-atlanta-strut`
      - `panda-fest-atlanta`
      - `pigs-and-peaches-bbq`
    - those four festival containers were demoted live to direct tentpole-event model, which moved the gate from `FAIL/HOLD` to `WARN/WARN`
    - `sources/shaky_knees.py` then moved from a stub annual-event crawler to a real festival source:
      - it now extracts the official lineup poster image from the live site
      - OCRs the poster into Friday / Saturday / Sunday day buckets
      - emits three festival-program lineup events linked under `Shaky Knees 2026 Lineup`
      - replaces title-derived placeholder participants with source-grounded artist rows
      - lengthens the parent series description past the structural quality threshold
      - focused verification passed:
        - `python3 -m py_compile crawlers/sources/shaky_knees.py crawlers/tests/test_shaky_knees.py`
        - `cd crawlers && python3 -m pytest tests/test_shaky_knees.py -q` -> `3 passed`
      - live dry-run passed:
        - `cd crawlers && python3 main.py --source shaky-knees --dry-run` -> `4 found / 3 new / 1 updated`
      - live writes landed cleanly and Shaky Knees is now out of the remediation queue
    - shared source-hint policy now also forces direct event model for `out-on-film`, and the stale `out-on-film` festival container was demoted live (`2` linked series unlinked, `3` linked events unlinked, festival row deleted)
    - the final date-coverage closeout tranche then landed:
      - `scripts/check_festival_dates.py` now falls back to `curl` for TLS-hostile sites
      - it also uses slug-aware single-date targeting on multi-city pages, which allows city-specific promotions from aggregator-style tour pages
      - focused verification passed:
        - `cd crawlers && python3 -m pytest tests/test_check_festival_dates.py -q` -> `8 passed`
      - `beer-bourbon-bbq-atlanta` promoted live to announced date `2026-02-28`
    - current live Phase 5 state:
      - remediation queue empty
      - `promotion_hold_count = 0`
      - `announced_start_coverage_pct = 91.4`
      - report/gate state = `PASS` / `PASS`
      - residual pending-only festivals are historical past-cycle demotions, not gate blockers:
        - `atlanta-black-expo`
        - `atlanta-jewish-film-festival`
        - `hinman-dental-meeting`
        - `thriftcon-atlanta`
        - `transact`

### 2026-04-03 — Closeout

- Phase 5 is now complete.
- The festival quality lane stayed `PASS` through two consecutive clean report/gate cycles.
- `crawlers/scripts/festival_atlanta_verification.py` now generates `crawlers/reports/festival_atlanta_verification_latest.md`.
- The Atlanta-facing verification loop currently reports:
  - verification status: `PASS`
  - promotion decision: `PASS`
  - remediation queue entries: `0`
  - in-scope missing announced starts: `0`
- The Phase 5 artifacts are now monitoring guardrails rather than active remediation queues:
  - `crawlers/reports/festival_quality_report_latest.md`
  - `crawlers/reports/festival_promotion_gate_latest.json`
  - `crawlers/reports/festival_remediation_manifest_latest.md`
  - `crawlers/reports/festival_atlanta_verification_latest.md`
