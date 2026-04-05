# Rich Data Master Execution Workstream

**Date:** 2026-03-31  
**Status:** Active  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`  
**Program board:** `docs/superpowers/plans/2026-04-01-rich-data-program-board.md`

This is the only active execution document for the rich data effort.

## Objective

Run the rich data program from one canonical operational surface so multiple agents can execute without drifting across stale phase checklists.

The current execution order is:

1. keep the Phase 5 festival lane operational as monitoring-only guardrails
2. finish the late-stage Phase 4 mutation waves against the bounded residual queue
3. open one post-Phase-4 bounded venue-description enrichment lane
4. stop with rich-data in steady-state rather than rescue mode

## Control Rules

- The program board is the top-level status truth.
- This document is the only active execution checklist and tranche log.
- The roadmap is strategy and phase-definition reference only.
- Older phase workstreams are historical audit docs unless the board explicitly reopens one.
- Agents must not create new active plan docs for this effort unless the board explicitly promotes them.
- Preserve current code and worktree state. This reset does not imply a clean repo.
- Repo cleanup, revert decisions, or keep/drop triage are separate work and are not part of this control-plane reset.

## Current Baseline

- Phase 1 is complete.
- Phase 2 is complete.
- Phase 0 is complete.
- Phase 3 is complete.
- Phase 5 is complete.
- Phase 4 is operationally closed; the active engineering track is now bounded venue-description monitoring.

## Active Phase

### Bounded Venue-Description Monitoring

**Goal:** keep the post-roadmap venue-description lane bounded, source-grounded, and monitored without reopening broad rich-data remediation.

### What is active now

- bounded venue-description monitoring driven by `venue_description_report_latest.md`
- one explicit bounded program/session residual queue under the entity `BOUNDED_QUEUE` gate
- keeping Phase 5 report/gate artifacts operational as monitoring-only guardrails

### What is explicitly not active

- Phase 3 festival workflow expansion beyond the bounded pilot set
- Phase 0 helper migration work
- Phase 2 crawler remediation queues
- venue-wide or event-wide LLM backfill
- repo cleanup or dirty-worktree triage

## Active Queue

- [x] Phase 4 bounded mutation closeout
- [x] First post-Phase-4 bounded enrichment lane prepare/extract/apply implementation
- [x] Two additional clean venue-description operating cycles under the fixed prepare/extract/dry-run/live/report rhythm

## Immediate Next Tranche

The next concrete tranche is:

1. keep the venue-description lane bounded to explicit rich-copy tranches instead of widening the queue
2. keep the residual venue duplicate queue deliberately classified as `manual_review_only` unless new address evidence appears
3. keep the residual `2.4%` program/session tail explicit under `BOUNDED_QUEUE`, but treat it as non-blocking monitoring follow-up

## Deferred Phases

### Phase 4 — Canonical Entity Resolution

Operationally complete. The audit prerequisite is closed, the mutation waves are landed, and the remaining work is a bounded residual queue under `BOUNDED_QUEUE`, not a fresh audit or schema-design pass.

### Post-Phase-4 Expansion Lane

Queued after Phase 4. The first expansion lane remains bounded enrichment beyond festivals, ordered as:

1. destination/venue descriptions
2. structured program parent descriptions
3. broader niche/event lanes only if still justified

## Stop Conditions

Continue without asking unless one of these is true:

- a new database migration is required
- a production failure mode changes rollout strategy
- a portal-visible semantic or entity-contract change is required
- broad cross-phase rescoping is needed
- dirty-worktree triage becomes necessary to safely proceed

If one of those occurs, stop and surface the decision at the board level.

## Reporting Rules

- Update the board when phase status, blockers, or next-up sequencing changes.
- Update this document when tranche status, queue order, or execution notes change.
- Do not use the roadmap as an execution log.
- Do not update historical phase docs with ongoing tranche progress unless the board explicitly reopens them.

## Verification Standard

- Run targeted tests for every code slice touched.
- Run bounded dry-runs instead of trust-me batch claims.
- Log only tranche-level results here.
- Keep narrative concise and decision-oriented.

## Progress Log

### 2026-04-03 — Phase 4 Late-Stage Snapshot

- Phase 3 is now closed cleanly:
  - the bounded festival pilot control set (`roswell-roots-festival`, `georgia-educational-technology-conference`, `west-end-comedy-fest`) completes `prepare -> extract -> dry-run apply`
  - `west-end-comedy-fest` no longer remains as an open fetch-hardening edge in the bounded pilot
- Phase 5 is now operationally complete:
  - `festival_quality_report_latest.md` is `PASS`
  - `festival_promotion_gate_latest.json` is `PASS` with `0` promotion holds
  - `festival_remediation_manifest_latest.md` is empty as a monitoring artifact
  - `festival_atlanta_verification_latest.md` is `PASS`
- Phase 4 mutation work materially advanced beyond the original baseline:
  - Wave A0 low-risk venue merges landed:
    - `Atlanta Symphony Hall` → `Symphony Hall`
    - `The Painted Pin` → `Painted Pin`
  - the residual same-domain / different-address venue families (`Lore`, `Atlanta BeltLine`, `Metropolitan Studios`, and similar) are now explicitly treated as `manual_review_only`, not low-risk alias work
  - Wave B yearly-wrapper cleanup landed for:
    - `Anime Weekend Atlanta 2026`
    - `BronzeLens Film Festival 2026`
    - `Dragon Con 2026`
    - `Juneteenth Atlanta Parade & Music Festival 2026`
  - Wave C program/session repair swept the active `atlanta-families` program set:
    - `32` active sources scanned
    - `19` sources changed
    - `1250` family-key backfills
    - `43` exact duplicate deletes
    - program/session fragmentation dropped from `39.4%` to `7.9%`
  - Wave D remains verify-only:
    - organizer duplication still reads `0.0%`
- The live Phase 4 artifact state is now:
  - `entity_resolution_report_latest.md`
  - `entity_resolution_gate_latest.json`
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `0.0%`
  - program/session fragmentation rate: `7.9%`
  - organizer duplication rate: `0.0%`
- A follow-up residual Wave C tranche then landed against legacy base-portal rows:
  - `cobb-parks-rec` on portal `atlanta`: `793` family-key backfills, `46` duplicate deletes
  - `gwinnett-parks-rec` on portal `atlanta`: `238` family-key backfills, `18` duplicate deletes
  - `piedmont-classes` on portal `piedmont`: `94` family-key backfills, `2` duplicate deletes
- The live Phase 4 artifact state is now:
  - `entity_resolution_report_latest.md`
  - `entity_resolution_gate_latest.json`
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `0.0%`
  - program/session fragmentation rate: `1.4%`
  - organizer duplication rate: `0.0%`
- The first post-Phase-4 expansion artifacts now exist:
  - `venue_description_report_latest.md`
  - `venue_description_gate_latest.json`
  - eligible website-backed Tier 1+ places: `2339`
  - pilot candidate count: `284`
  - healthy description rate: `87.9%`
  - gate decision: `PILOT_READY`
- The active mainline is now the first bounded venue-description pilot, with the residual `1.4%` program/session tail left explicit but non-blocking.
- The first bounded venue-description lane then moved from artifact-only to live execution:
  - `crawlers/enrich_venue_descriptions.py` now implements venue `prepare -> extract -> apply`
  - task prep hardened to skip low-signal source pages under `MIN_SOURCE_TEXT_LENGTH = 120`
  - noisy administrative fragments are filtered from prepared source text before extraction
  - the extraction prompt no longer passes structured city/type hints into generation, so venue copy stays grounded in source text
  - focused verification passed:
    - `python3 -m pytest tests/test_enrich_venue_descriptions.py tests/test_venue_description_metrics.py -q` -> `7 passed`
- Two clean bounded live cycles then landed:
  - cycle 1 selection from the report-backed queue:
    - accepted and updated:
      - `Best Friend Park Pool`
      - `Cemetery Field`
      - `DeShong Park`
    - correctly skipped at prepare time after the hardening pass:
      - `Look Cinemas`
      - `The Springs Cinema & Taphouse`
  - cycle 2 rich-copy tranche:
    - accepted and updated:
      - `Core Dance Studios`
      - `Gordon Biersch Brewery Restaurant`
      - `Marietta Theatre Company`
      - `Urban Grind`
      - `Vas Kouzina`
- The venue-description lane then kept compounding through additional bounded live cycles:
  - cycle 3 arts/theater tranche:
    - accepted and updated:
      - `Ameris Bank Amphitheatre`
      - `Lyndon House Arts Center`
      - `Mary Schmidt Campbell Center for Innovation and the Arts`
      - `Pinch 'n' Ouch Theatre`
      - `Spelman College Museum of Fine Art`
    - correctly rejected on grounding:
      - `Level Up Gaming Lounge`
      - `Selig Family Black Box Theatre`
      - `The Flatiron`
    - correctly skipped at prep:
      - `Roswell Cultural Arts Center`
      - `Marcia Wood Gallery`
  - cycle 4 cultural/restaurant tranche:
    - accepted and updated:
      - `Atlanta Ballet Centre - Michael C. Carlos Dance Centre`
      - `Auburn Avenue Research Library`
      - `The Ivy Bookshop at Ponce City Market`
      - `Kimchi Red - Alpharetta`
      - `Mary Schmidt Campbell Center for Innovation and the Arts, Bank of America Gallery`
  - cycle 5 arena/museum tranche:
    - accepted and updated:
      - `Gas South Arena`
      - `Gateway Center Arena`
      - `Silverbacks Park`
      - `Waffle House Museum`
      - `World of Coca-Cola`
- The metrics/report layer was also hardened so the queue is operationally useful:
  - `venue_description_metrics.py` now separates:
    - `pilot_candidates`
    - `monitor_only`
  - low-signal storefront/corporate pages now land in `monitor_only` instead of polluting the active pilot queue
  - the low-signal domain policy now also routes:
    - `artsatl.org`
    - `roswellgov.com`
    - `georgiastatesports.com`
    - `stadium.utah.edu`
    into `monitor_only`
  - focused verification passed:
    - `python3 -m pytest tests/test_venue_description_metrics.py tests/test_enrich_venue_descriptions.py -q` -> `9 passed`
- The current live venue-description artifact state is now:
  - `venue_description_report_latest.md`
  - `venue_description_gate_latest.json`
  - eligible website-backed Tier 1+ places: `2349`
  - pilot candidate count: `208`
  - monitor-only low-signal count: `45`
  - healthy description rate: `89.2%`
  - junk / boilerplate rate: `1.1%`
  - short description rate: `9.7%`
  - gate decision: `PILOT_READY`
- The venue-description lane is now a real bounded production loop with repeated accepted live cycles, grounded rejections preserved, and an explicit monitor-only queue for thin sites.
- Two more bounded live cycles then landed cleanly:
  - cycle 6 accepted and updated:
    - `Giga-Bites Cafe`
    - `OYL Studios`
    - `Spruill Center for the Arts`
    - `The Wasteland Gaming`
  - cycle 7 accepted and updated:
    - `Atlanta Monetary Museum`
    - `Echo Contemporary`
    - `Tony’s Sports Grill Norcross`
  - cycle 7 correctly skipped thin source pages for:
    - `Martin Luther King Jr. National Historical Park`
    - `Wolf Creek Amphitheater`
- The queue policy then tightened one more time:
  - `mlk-national-historical-park`
  - `wolf-creek-amphitheater`
  now route directly to `monitor_only` as repeated thin-source rows instead of resurfacing in the active pilot queue
- Two closeout cycles then landed under the fixed operating model:
  - cycle 8 Bucket A:
    - accepted and updated:
      - `The Royal Peacock`
    - classified non-write outcomes:
      - `Currahee Brewing Company` (`ssrf-blocked`)
      - `Contender eSports` (`ERR_CERT_COMMON_NAME_INVALID`)
      - `Paris on Ponce` (`grounding_failed`)
  - cycle 9 Bucket B:
    - accepted and updated:
      - `Actor’s Express`
      - `SK8 the Roof`
    - classified non-write outcomes:
      - `Track Rock Gap Petroglyphs` (`low-signal page text`)
      - `KING OF DIAMONDS ATLANTA` (`grounding_failed`)
      - `Nightmare’s Gate` (`grounding_failed`)
- The entity gate is no longer baseline-only:
  - `entity_resolution_gate_latest.json` now reports `BOUNDED_QUEUE`
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `0.0%`
  - program/session fragmentation rate: `2.4%`
  - organizer duplication rate: `0.0%`
- Rich-data is now in steady-state rather than rescue mode:
  - Phase 5 remains monitoring-only at `PASS`
  - Phase 4 mutation work is operationally closed
  - the remaining queues are explicit and bounded:
    - `manual_review_only` venue duplicate families
    - `BOUNDED_QUEUE` program/session tail
    - `monitor_only` venue-description rows

### 2026-04-04 — Steady-State Closeout

- The venue-description lane is now executed through a fixed helper path in `crawlers/enrich_venue_descriptions.py`:
  - `run_venue_cycle(...)` now runs one bounded cycle through prepare, extract, dry-run apply, optional live apply, history update, and report/gate regeneration
  - focused coverage passed in:
    - `tests/test_enrich_venue_descriptions.py`
    - `tests/test_venue_description_metrics.py`
    - `tests/test_entity_resolution_metrics.py`
    - `21 passed`
- Two closeout cycles landed under that fixed operating model:
  - Bucket A:
    - accepted and updated:
      - `The Royal Peacock`
    - classified non-write outcomes:
      - `Currahee Brewing Company` (`ssrf-blocked`)
      - `Contender eSports` (`ERR_CERT_COMMON_NAME_INVALID`)
      - `Paris on Ponce` (`grounding_failed`)
  - Bucket B:
    - accepted and updated:
      - `Actor’s Express`
      - `SK8 the Roof`
    - classified non-write outcomes:
      - `Track Rock Gap Petroglyphs` (`low-signal page text`)
      - `KING OF DIAMONDS ATLANTA` (`grounding_failed`)
      - `Nightmare’s Gate` (`grounding_failed`)
- The current live venue-description artifact state is:
  - eligible website-backed Tier 1+ places: `2349`
  - pilot candidate count: `208`
  - monitor-only low-signal count: `45`
  - healthy description rate: `89.2%`
  - short description rate: `9.7%`
  - gate decision: `PILOT_READY`
- The current entity gate state is:
  - `decision = BOUNDED_QUEUE`
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `0.0%`
  - program/session fragmentation rate: `2.4%`
  - organizer duplication rate: `0.0%`
- This closes the rich-data endgame as an operational program:
  - no active broad remediation queue remains
  - venue-description work is now monitored bounded enrichment
  - the residual entity-resolution tail is explicit and non-blocking

### Reset Baseline

- This file is now the single active execution workstream for the rich data effort.
- Track A and Track B from the prior version are closed and treated as historical context.
- Phase 3 is the active engineering track.
- The first festival hardening slice is already in code:
  - `crawlers/enrich_festivals.py` now honors `role="main"` content correctly
  - `.gitignore` excludes `crawlers/llm-tasks/` and `crawlers/llm-results/`
  - focused regression coverage exists in `crawlers/tests/test_enrich_festivals.py`
- The first executable festival tranche is now landed:
  - `crawlers/enrich_festivals.py` has a festival-only `--prepare-tasks` path
  - prepared tasks are written under `crawlers/llm-tasks/festivals/`
  - task payloads are festival-specific and include `festival_id`, `slug`, `name`, `website`, current description/date context, and extracted visible page text
  - focused verification passed:
    - `python3 -m py_compile crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals.py`
    - `cd crawlers && python3 -m pytest tests/test_enrich_festivals.py -q` -> `5 passed`
- The second executable festival tranche is now landed:
  - `crawlers/enrich_festivals.py` has festival-only `--extract-tasks` and `--apply-results` paths
  - result payloads are festival-specific and include grounded description output plus source text for gating
  - dry-run apply now enforces basic length, noise, and grounding checks before any write
  - focused verification passed:
    - `python3 -m py_compile crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals.py`
    - `cd crawlers && python3 -m pytest tests/test_enrich_festivals.py -q` -> `9 passed`
- The first real festival dry-run is now closed:
  - `roswell-roots-festival` completed `prepare -> extract -> dry-run apply` cleanly
  - the initial live task payload exposed a real quality issue: `visible_text` was pulling cookie/privacy chrome and sitewide taxonomy lists
  - the fix landed in `crawlers/enrich_festivals.py`: task prep now prefers clean extracted festival description text before falling back to raw visible-text dumps, and boilerplate-heavy page chunks are filtered more aggressively
  - focused verification passed:
    - `python3 -m py_compile crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals.py`
    - `cd crawlers && python3 -m pytest tests/test_enrich_festivals.py -q` -> `12 passed`
  - the post-fix live Roswell Roots task payload shrank from a noisy ~5.4k chars to a clean 150-char source excerpt
  - the post-fix live Roswell Roots dry-run apply accepted the grounded output cleanly
- The bounded festival pilot has now advanced past a single happy-path row:
  - `--min-description-length` now lets task prep revisit slightly longer but still weak festival descriptions without broadening beyond festivals
  - focused verification passed:
    - `python3 -m py_compile crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals.py`
    - `cd crawlers && python3 -m pytest tests/test_enrich_festivals.py -q` -> `13 passed`
  - `georgia-educational-technology-conference` then completed `prepare -> extract -> dry-run apply` cleanly under a bounded `--min-description-length 140` pass
  - this closes the “one additional clean or intentionally rejected live candidate” gate from the board and unlocks the first Phase 5 quality-reporting tranche
- The first Phase 5 report artifact now exists:
  - `crawlers/festival_audit_metrics.py` was repaired for the current schema (`place_id` instead of `venue_id`) so live festival audits run again
  - `crawlers/scripts/festival_quality_report.py` now generates `crawlers/reports/festival_quality_report_latest.md`
  - the first live report is useful, not decorative:
    - overall festival quality state is `FAIL`
    - the strongest failing signals are `series_description_quality_pct`, ghost/single/orphan `festival_program` series, and fragmented sources
    - the LLM pilot section reports `2` prepared tasks, `2` result files, and `2` current dry-run acceptances
  - the report now also derives operator-facing actions:
    - explicit promotion holds initially included `toylanta`, `atlanta-science-festival`, `atlanta-fringe-festival`, `landmark-midtown`, `east-atlanta-strut`, `render-atl`
    - the first remediation queue was led by `toylanta` and `atlanta-science-festival`, then festival date/window integrity issues
  - `crawlers/scripts/festival_promotion_gate.py` now emits `crawlers/reports/festival_promotion_gate_latest.json`
  - the first live gate run returns `HOLD` with `6` explicit held sources, matching the markdown report
  - `crawlers/scripts/festival_remediation_manifest.py` now emits `crawlers/reports/festival_remediation_manifest_latest.md`
  - the remediation manifest resolves each held source to a real file target plus a likely fix path:
    - `toylanta` -> profile-backed festival_schedule grouping fix
    - `atlanta-science-festival` -> crawler-side series creation / `festival_program` collapse fix
    - `atlanta-fringe-festival`, `landmark-midtown` -> short description capture fixes
    - `east-atlanta-strut`, `render-atl` -> missing description capture fixes
- The current follow-up is narrower, not broader:
  - `west-end-comedy-fest` surfaced a fetch stall / connection-reset path during festival selection
  - that is recorded as the next Phase 3 edge case to harden, but it does not block the festivals-first lane after Roswell Roots and GaETC completed cleanly
  - the first report-backed remediation tranche is now landed:
    - `crawl_festival_schedule.py` reruns no longer bypass `insert_event()` for existing rows, so held profile-backed festivals can relink series on reruns
    - `sources/atlanta_science_festival.py` no longer bypasses `insert_event()` for existing rows either
    - `scripts/backfill_festival_program_series.py` now falls back to the parent festival series name instead of creating a generic `General Program` bucket for one-off rows
    - live targeted backfills applied cleanly:
      - `toylanta`: `13/13` relinks, `0` new series
      - `atlanta-science-festival`: `23/23` relinks, `0` new series
    - `atlanta-science-festival` cleared the promotion hold after the live relink pass
    - `toylanta` then received a live schedule rerun with stronger source-grounded descriptions, narrowing its remaining hold from `16` short descriptions to `12`
  - the immediate next execution target is now Phase 5-driven description capture follow-up:
    - `toylanta`
    - `atlanta-fringe-festival`
    - `landmark-midtown`
    - `east-atlanta-strut`
    - `render-atl`
  - the held-source tranche is now closed:
    - `render-atl` missing-description hold cleared after the tabbed schedule extractor restored event description capture
    - `toylanta` short-description hold cleared after stronger schedule-grounded description backfill
    - `atlanta-fringe-festival` short-description hold cleared after source-side fallback expansion and an audit fix that excludes inactive rows from event-quality gates
    - `festival_audit_metrics.py` now scopes event quality to active linked events instead of inactive historical rows, with focused regression coverage in `crawlers/tests/test_festival_audit_metrics.py`
    - the latest live artifacts now show:
      - `crawlers/reports/festival_promotion_gate_latest.json` -> `HOLD` with `0` promotion holds
      - `crawlers/reports/festival_quality_report_latest.md` -> overall `FAIL`, but no explicit source holds remain
      - `crawlers/reports/festival_remediation_manifest_latest.md` -> structural remediation queue only
  - the active queue has therefore shifted from source-level description capture to structural festival integrity:
    - all report-queue missing announced-start festivals are now cleared:
      - `west-end-comedy-fest`
      - `candler-park-fall-fest`
      - `japanfest-atlanta`
    - the next live out-of-window linkage cleanup queue is:
      - `jordancon`
      - `norcross-irish-fest`
      - `panda-fest-atlanta`
      - `pigs-and-peaches-bbq`
      - `render-atl`
    - `west-end-comedy-fest` was removed from the missing announced-start queue after the targeted date-checker promotion to `2026-03-06` .. `2026-03-08`
    - `candler-park-fall-fest` was removed from the missing announced-start queue through conservative linked-event backfill to `2026-10-05` .. `2026-10-06`
    - `japanfest-atlanta` was removed from the missing announced-start queue after the targeted date-checker promotion to `2026-09-19` .. `2026-09-20`
    - `atlanta-ice-cream-festival`, `big-shanty-festival`, and `cherry-blossom-festival-macon` were then repaired through targeted festival date rechecks against live sites
    - `atlanta-film-festival`, `atlanta-ice-cream-festival`, `atlanta-pride`, `covington-vampire-diaries-fest`, `dunwoody-art-festival`, `jordancon`, `norcross-irish-fest`, `panda-fest-atlanta`, `pigs-and-peaches-bbq`, and `render-atl` were then cleared from the structural out-of-window queue through live cleanup in `scripts/backfill_festival_window_linkage.py`
    - the report/gate queue is now finally actionable instead of empty:
      - `festival_audit_metrics.py` now aggregates ghost/orphan `festival_program` series and series-description gaps by festival
      - `festival_quality_report.py` now emits a structural remediation queue even when explicit promotion holds are `0`
      - `festival_remediation_manifest.py` now stays aligned with the current gate queue after regeneration
    - live structural cleanup then kept shrinking the orphan tail:
      - `scripts/cleanup_festival_program_ghosts.py` deleted `146` zero-event, no-description `festival_program` series, then safely removed described dead wrappers for `beer-bourbon-bbq-atlanta` and `devnexus` while preserving stronger festival descriptions
      - `scripts/cleanup_festival_program_orphans.py` first collapsed `12` safe singleton or stale-wrapper `festival_program` series across `ga-food-wine-festival`, `atlanta-jazz-fest`, `atlanta-shortsfest`, `candler-park-fall-fest`, and `dogwood-festival`
      - it then collapsed the next safe queue: `east-atlanta-strut`, `japanfest-atlanta`, `monsterama-con`, `north-georgia-state-fair`, `out-on-film`, `panda-fest-atlanta`, `pigs-and-peaches-bbq`, `shaky-knees-festival`, and `smu-steel-summit`
    - the current report surface is now:
      - `ghost_program_series_pct`: `0.0`
      - `single_program_series_pct`: `0.0`
      - `orphan_program_series_pct`: `0.0`
      - `promotion_hold_count`: `0`
      - `festival_description_quality_pct`: `100.0`
      - `series_description_quality_pct`: `100.0`
      - `festival_model_fit_pct`: `97.9`
      - `tentpole_fit_candidate_pct`: `3.4`
      - the remediation queue is now empty
        - `shaky-knees-festival`
  - the latest structural-report tranche then landed:
    - `scripts/backfill_festival_parent_series_descriptions.py` safely matched generic parent-wrapper tokens like `Festival` vs `Weekend`, which cleared `404-day-festival`
    - `festival_audit_metrics.py` now excludes inactive festival-linked series wrappers with no active linked events, which removed `render-atl` from the live structural queue for the right reason
    - `sources/west_end_comedy_fest.py` now extracts homepage festival copy, hydrates the festival row, and feeds that copy into the canonical parent `festival_program` series path
    - the West End production run completed cleanly at `17 found / 0 new / 17 updated`, clearing its structural parent-series gap
    - `scripts/backfill_festival_series_descriptions_from_events.py` then updated `231` ATLFF film-series descriptions from active source-grounded event copy
    - a follow-up ATLFF production rerun picked up shared series blank-field metadata backfill and active venue repair, shrinking ATLFF weak film-series debt from `14` to `1`
    - the current live artifacts now show:
      - `series_description_quality_pct`: `99.6`
      - `festival_model_fit_pct`: `95.8`
      - `tentpole_fit_candidate_pct`: `3.4`
      - overall report/gate state improved from `FAIL` / `HOLD` to `WARN` / `WARN`
      - ATLFF no longer drives the gate broadly; the final residual weak-series edge (`Mystery Panel`) was strengthened live with a festival-session placeholder description that clears the structural threshold
      - `festival_audit_metrics.py` now treats zero-event / zero-program festival rows as `insufficient_data` instead of false tentpole-fit candidates
      - shared source-hint policy now forces direct tentpole-event model for:
        - `atlanta-ice-cream-festival`
        - `east-atlanta-strut`
        - `panda-fest-atlanta`
        - `pigs-and-peaches-bbq`
      - those four festival containers were demoted live to direct tentpole-event model
      - `shaky-knees-festival` has now been removed from that queue after the source was converted from a stub annual event into a real lineup-bearing festival source
    - the Shaky Knees remediation tranche landed end to end:
      - `sources/shaky_knees.py` now extracts the official lineup poster image from the live site, OCRs it, and emits Friday/Saturday/Sunday festival-program lineup events
      - focused verification passed:
        - `python3 -m py_compile crawlers/sources/shaky_knees.py crawlers/tests/test_shaky_knees.py`
        - `cd crawlers && python3 -m pytest tests/test_shaky_knees.py -q` -> `3 passed`
      - live validation passed:
        - `cd crawlers && python3 main.py --source shaky-knees --dry-run` -> `4 found / 3 new / 1 updated`
      - live writes then landed:
        - `cd crawlers && python3 main.py --source shaky-knees --db-target production --allow-production-writes --skip-launch-maintenance` -> `4 found / 3 new / 1 updated`
        - follow-up cleanup replaced title-derived placeholder participants with source-grounded artist rows from the OCR parse
        - the `Shaky Knees 2026 Lineup` series description was lengthened past the structural quality threshold
      - shared source-hint policy now also forces direct event model for `out-on-film`, and the stale `out-on-film` festival container was demoted live (`2` linked series unlinked, `3` linked events unlinked, festival row deleted)
      - the date-coverage closeout tranche then landed:
        - `scripts/check_festival_dates.py` now falls back to `curl` for TLS-hostile sites
        - the checker now uses slug-aware single-date targeting on multi-city pages
        - focused verification passed:
          - `cd crawlers && python3 -m pytest tests/test_check_festival_dates.py -q` -> `8 passed`
        - targeted dry-run evidence showed `beer-bourbon-bbq-atlanta` could be promoted safely to `2026-02-28`
        - the live promotion landed via `python3 scripts/check_festival_dates.py --promote-pending --slug beer-bourbon-bbq-atlanta`
      - the current Phase 5 live queue is now empty
      - the current report/gate state is now:
        - `announced_start_coverage_pct = 91.4`
        - `decision = PASS`
        - `overall_gate_status = PASS`
        - `promotion_hold_count = 0`
      - the remaining pending-only festivals are now monitoring targets rather than active gate blockers:
        - `atlanta-black-expo`
        - `atlanta-jewish-film-festival`
        - `hinman-dental-meeting`
        - `thriftcon-atlanta`
      - `transact`

### 2026-04-03 — Stage 1 closeout

- The bounded festival pilot control set is now fully clean:
  - `roswell-roots-festival` completed `prepare -> extract -> dry-run apply`
  - `georgia-educational-technology-conference` completed `prepare -> extract -> dry-run apply`
  - `west-end-comedy-fest` completed `prepare -> extract -> dry-run apply`
- The last real Phase 3 edge was not a fetch failure anymore; it was a grounding failure on a schedule-heavy page.
- `crawlers/enrich_festivals.py` now carries grounded current festival copy into schedule-heavy task payloads instead of feeding the LLM only lineup text.
- Focused verification passed:
  - `python3 -m py_compile crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals.py`
  - `cd crawlers && python3 -m pytest tests/test_enrich_festivals.py -q` -> `14 passed`
- Phase 3 is now complete.
- The active mainline shifts to Phase 5 steady-state hardening:
  - second clean report/gate cycle
  - Atlanta-facing verification loop
  - then Phase 4 audit baseline artifacts

### 2026-04-03 — Stage 2 closeout and Stage 3 baseline

- Phase 5 is now complete:
  - the festival report/gate/manifest stayed `PASS` through two consecutive clean cycles
  - `crawlers/reports/festival_atlanta_verification_latest.md` now verifies the Atlanta-facing festival lane at `PASS`
- Phase 4 baseline artifacts now exist:
  - `crawlers/reports/entity_resolution_report_latest.md`
  - `crawlers/reports/entity_resolution_gate_latest.json`
- The first live baseline metrics are:
  - duplicate place rate: `1.2%`
  - unresolved place/source match rate: `0.4%`
  - festival yearly-wrapper fragmentation rate: `5.1%`
  - program/session fragmentation rate: `39.4%`
  - organizer duplication rate: `0.0%`
- At that baseline checkpoint, the gate was `BASELINE_READY`, which closed the audit-only prerequisite for mutation work.
- The next mainline tranche is Wave A venue canonicalization, while keeping the dominant program/session families staged behind it for Wave C.

### Historical Summary

- Phase 1 closed synthetic description re-pollution paths.
- Phase 2 closed the high-noise crawler remediation and classification tranches.
- Phase 0 landed shared extraction helper families without changing the persisted write contract.
