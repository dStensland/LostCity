# Phase 3 Workstream — Bounded LLM Enrichment

> **Status marker:** Historical reference doc. This file contains phase-specific implementation notes, but it is not the active control-plane surface unless the program board explicitly reopens it. Use `docs/superpowers/plans/2026-04-01-rich-data-program-board.md` for status and `docs/superpowers/plans/2026-03-31-rich-data-roadmap-continuation-workstream.md` for live execution.

**Date:** 2026-03-30  
**Status:** Historical reference  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This is the execution workstream for Phase 3 of the rich data roadmap.

## Objective

Introduce a tightly-scoped LLM enrichment workflow for durable, high-value description gaps, starting with festivals and then venues, while keeping deterministic extraction as the default path.

## Drift Controls

- Do not start with a broad event backfill.
- Festivals first, venues second, events only if narrowly scoped to active/upcoming inventory.
- LLM output must be grounded in source text and pass quality gates before apply.
- Prompt and workflow changes must be validated against real samples before scaling.
- If deterministic extraction can solve a source class, that belongs in Phase 2 or Phase 0, not here.

## Canonical References

- Roadmap: `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`
- Existing plan: `docs/superpowers/plans/2026-03-30-llm-extract-festival-descriptions.md`
- Spec: `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md`

## Current State Snapshot

The existing LLM plan is directionally useful but needs narrowing before implementation:

- start with festivals, not festivals plus broad event batches
- fix content-region extraction for `role="main"` and similar layouts
- avoid overloaded CLI semantics that mix festival slug and event targeting
- tune grounding checks against paraphrase reality so good outputs are not over-rejected

The first hardening slice is now in code:

- `crawlers/enrich_festivals.py` now correctly honors `role="main"` content regions instead of using BeautifulSoup's broken `find("[role='main']")` pattern
- `.gitignore` now excludes `crawlers/llm-tasks/` and `crawlers/llm-results/`
- focused regression coverage exists in `crawlers/tests/test_enrich_festivals.py`

## Scope

### In scope

- prepare/extract/apply workflow for festival descriptions
- task/result file handling and gitignore updates
- quality gates: junk, boilerplate, grounding, minimum usefulness
- post-pilot extension plan for venue descriptions

### Out of scope

- wide event backfill across historical inventory
- replacing crawler fixes with LLM summarization
- portal-specific copy generation

## Execution Order

- [ ] Festivals pilot
- [ ] Venue design after festival pilot
- [ ] Live/upcoming event pilot only if deterministic gaps remain after Phase 2

## Execution Tracks

## Track A — Plan Narrowing

- [ ] Rewrite the current plan to festival-first execution assumptions
- [ ] Define clearer CLI/entity semantics than a shared overloaded `--slug`
- [ ] Define sample set and acceptance criteria for prompt evaluation

## Track B — Festival Workflow

- [ ] Prepare task files for festivals with thin or missing descriptions
- [ ] Extract via bounded LLM workflow
- [ ] Apply only after quality gates pass
- [ ] Log rejection reasons for prompt/extractor tuning

## Track C — Grounding and Quality Tuning

- [ ] Validate content-region extraction against real festival sites
- [ ] Tune grounding logic so it catches hallucinations without rejecting obvious paraphrases
- [ ] Confirm output avoids dates, times, pricing, addresses, and ticketing noise

## Track D — Venue Follow-On Design

- [ ] Decide whether venue descriptions should use the same workflow or a venue-specific path
- [ ] Define pilot set for venues if festival pilot succeeds

## Verification

- [ ] single-festival prepare succeeds
- [ ] result files are written and inspectable
- [ ] dry-run apply works
- [ ] applied descriptions are source-grounded and consumer-usable

## Exit Criteria

- festival pilot workflow is stable and documented
- quality gates reject weak or hallucinated outputs
- venue follow-on is either specified or intentionally deferred
- any future event usage is explicitly limited to live/upcoming rows only

## Risks

- poor content extraction will poison prompts before the model even runs
- grounding may be too loose and allow hallucinations or too strict and reject good paraphrases
- LLM convenience can create pressure to skip deterministic crawler fixes

## Progress Log

### 2026-03-30

- Workstream created from roadmap.
- Existing LLM plan retained as input, but execution is intentionally narrowed to a festivals-first pilot.

### 2026-04-02

- Phase 3 is now the active execution track after Phase 0 closeout.
- The first festival-path hardening fix is landed in `crawlers/enrich_festivals.py`, correcting `role="main"` content extraction before task-flow expansion.
- Task/result artifact directories are now ignored in `.gitignore` so the prepare/extract/apply workflow can be added without polluting git status.
