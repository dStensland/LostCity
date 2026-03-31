# Phase 1 Workstream — Description Pipeline Defuse

**Date:** 2026-03-30  
**Status:** Active  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This is the operational workstream for Phase 1 of the rich data roadmap.

The roadmap stays strategic. This file is the execution checklist.

## Objective

Stop LostCity from generating synthetic descriptions, clean existing synthetic records safely, and leave the pipeline in a state where future enrichment can be reintroduced only via real extraction.

## Drift Controls

- The roadmap is the long-lived source of truth for sequencing and phase status.
- This workstream is the only place Phase 1 execution tasks should be tracked.
- Do not pull Phase 2 crawler remediation into this workstream unless a Phase 1 task is truly blocked on it.
- If the repo and the older plan docs disagree, the repo wins. Update this workstream and the roadmap progress log accordingly.
- Any newly discovered runtime caller of synthetic description scripts must be added here before implementation proceeds.

## Canonical References

- Roadmap: `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`
- Spec: `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md`
- Older execution plan: `docs/superpowers/plans/2026-03-30-description-pipeline-defuse-and-clean.md`

## Current State Snapshot

The repo is already partially through Phase 1:

### Already done

- [x] Synthetic detection exists in `crawlers/description_quality.py`
- [x] Cleanup script exists at `crawlers/scripts/clean_synthetic_descriptions.py`
- [x] `crawlers/enrichment_pipeline.py` skips the old synthetic event description phase
- [x] `crawlers/scripts/post_crawl_maintenance.py` disables the short-description sweep
- [x] Synthetic detection tests exist in `crawlers/tests/test_description_quality.py`
- [x] Legacy script audit completed: both legacy enrichment scripts now use real extraction and are candidates to keep as manual recovery tools

### Still open

- [x] Decide whether to keep both legacy real-extraction scripts as supported manual recovery tools long-term
- [x] Run and review the cleanup flow against real data using backup + dry-run
- [x] Decide whether cleanup should be applied immediately or staged after audit review
- [x] Run backup mode before any cleanup apply
- [x] Decide whether to broaden cleanup dry-run from festivals-only to full event scope after sample review
- [x] Verify there are no remaining runtime paths that can reintroduce synthetic descriptions

## Scope

### In scope

- synthetic description detection and truncation quality gate
- maintenance and orchestration paths that used to invoke synthetic enrichment
- cleanup tooling and safe rollback path
- operator docs and runbooks that reference the old scripts
- verification that the synthetic pipeline is actually defused

### Out of scope

- crawler-by-crawler description remediation
- new LLM extraction rollout
- broad event backfill strategy
- venue/program/festival schema expansion

## Execution Plan

## Track A — Runtime Defuse Verification

Goal: prove synthetic scripts are no longer part of normal execution.

- [x] Verify `crawlers/enrichment_pipeline.py` no longer invokes synthetic enrichment scripts in any code path.
- [x] Verify `crawlers/scripts/post_crawl_maintenance.py` no longer invokes synthetic enrichment scripts in any code path.
- [x] Search the repo for any remaining runtime invocation of:
  - `enrich_eventbrite_descriptions.py`
  - `enrich_non_eventbrite_descriptions.py`
- [x] If any runtime callers remain, neutralize them before cleanup is applied.

Verification:

- [x] `rg -n "enrich_eventbrite_descriptions|enrich_non_eventbrite_descriptions" crawlers`
- [x] import or dry-run the affected scripts/orchestrators successfully

## Track B — Legacy Script Disposition

Goal: remove ambiguity about whether the old scripts are still supported.

Decision rule:

- If a legacy script still contains useful real extraction logic, strip synthetic fallback behavior and leave a narrow supported mode.
- If it is primarily synthetic fallback machinery, delete it or convert it to a hard no-op with a clear message.

Tasks:

- [x] Audit `crawlers/scripts/enrich_eventbrite_descriptions.py`
- [x] Audit `crawlers/scripts/enrich_non_eventbrite_descriptions.py`
- [x] For each script, choose one:
  - keep with synthetic fallback removed
  - convert to explicit no-op with migration guidance
  - delete if no longer justified
- [x] Update any comments in `crawlers/description_quality.py` that mention files that no longer exist or no longer matter operationally

Verification:

- [x] legacy script behavior is explicit and non-misleading
- [x] `python3 -m pytest`

## Track C — Documentation and Runbook Cleanup

Goal: ensure operators are not told to run deprecated synthetic enrichment flows.

Known stale references:

- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`
- `crawlers/scripts/README_DATA_QUALITY.md`

Tasks:

- [x] Remove or rewrite commands referencing:
  - `scripts/enrich_eventbrite_descriptions.py`
  - `scripts/enrich_non_eventbrite_descriptions.py`
- [x] Replace old operator guidance with:
  - synthetic pipeline disabled
  - cleanup script usage
  - future remediation path via crawler fixes and real extraction
- [x] Search for any other docs still describing synthetic enrichment as normal ops

Verification:

- [x] `rg -n "enrich_eventbrite_descriptions|enrich_non_eventbrite_descriptions" crawlers/scripts docs`
- [x] no operator-facing docs prescribe the synthetic scripts

## Track D — Cleanup Dry Run and Apply Decision

Goal: validate cleanup impact before destructive writes.

Tasks:

- [x] Run backup mode of `clean_synthetic_descriptions.py`
- [x] Run dry-run mode and inspect representative festival and event samples
- [x] Record:
  - synthetic count found
  - truncated count
  - nulled count
  - any obvious false positives
- [x] Decide whether apply is safe immediately or needs pattern tuning first
- [x] If apply proceeds, run apply with backup already captured

Verification commands:

```bash
cd crawlers
python3 scripts/clean_synthetic_descriptions.py --backup
python3 scripts/clean_synthetic_descriptions.py --dry-run --preview 20
python3 scripts/clean_synthetic_descriptions.py --apply
```

Acceptance notes:

- Backup must exist before apply
- False positives should block apply until pattern tuning is done
- `NULL` is acceptable when the remaining content is entirely synthetic
- Current decision: do not apply cleanup because full dry-run found zero synthetic matches in the current DB snapshot

## Track E — Exit Validation

Goal: prove Phase 1 is actually complete.

- [x] Synthetic scripts are not part of active runtime flows
- [x] Legacy scripts are deleted, no-op, or narrowed to real extraction only
- [x] Operator docs no longer instruct anyone to run synthetic enrichment
- [x] Cleanup script has been exercised with backup + dry-run
- [x] Apply decision has been made and documented
- [ ] Roadmap Phase 1 status updated

## Exit Criteria

Phase 1 is complete when all of the below are true:

- Daily and weekly automation cannot reintroduce synthetic descriptions
- There is a documented and tested cleanup path for existing synthetic descriptions
- Operators have no stale instructions pointing at deprecated synthetic scripts
- Remaining description quality work is clearly handed off to Phase 2 crawler remediation and Phase 3 bounded enrichment

## Risks

- Overbroad synthetic patterns could null real descriptions during cleanup
- Legacy scripts may still contain some non-synthetic logic worth preserving
- Doc drift can persist even after runtime defuse if runbooks are not cleaned
- Cleanup may expose how many sources truly lack first-pass description capture, which will increase pressure on Phase 2

## Progress Log

### 2026-03-30

- Workstream created from the roadmap to avoid full-roadmap execution drift.
- Verified current repo state already includes synthetic detection, cleanup tooling, and disabled runtime enrichment hooks.
- Remaining work narrowed to legacy script disposition, stale-doc cleanup, cleanup validation, and Phase 1 exit verification.
- Legacy script audit found both enrichment scripts already converted to real extraction; they are no longer synthetic pipeline components and should be treated as manual recovery tools unless later removed.
- Updated operator docs to describe both legacy scripts as manual real-extraction tools rather than automated synthetic enrichment.
- Verified runtime callers are defused: only historical comments still reference the old script names in Python runtime files.
- Targeted verification passed:
  - `python3 -m pytest crawlers/tests/test_description_quality.py -q` -> 13 passed
  - `python3 scripts/enrich_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 1` -> dry-run completed
  - `python3 scripts/enrich_non_eventbrite_descriptions.py --portal atlanta --start-date $(date +%F) --limit 1 --page-size 50` -> dry-run completed
  - `python3 scripts/clean_synthetic_descriptions.py --dry-run --festivals-only --limit 10 --preview 3` -> 0 synthetic festival descriptions found in the sampled batch
- Backup captured successfully:
  - `festival_descriptions_20260330_230123.json` with 103 festival descriptions
  - `event_descriptions_20260330_230123.json` with 37,387 event descriptions
- Broader cleanup dry-runs completed:
  - `python3 scripts/clean_synthetic_descriptions.py --dry-run --events-only --limit 5000 --preview 8` -> 0 synthetic matches
  - `python3 scripts/clean_synthetic_descriptions.py --dry-run --events-only --limit 50000 --preview 5` -> 0 synthetic matches across all 37,387 described events
- Apply decision: no cleanup apply needed at this time because the full dry-run found zero synthetic matches in the current DB snapshot.
