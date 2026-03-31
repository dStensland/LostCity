# Rich Data Roadmap Continuation Workstream

**Date:** 2026-03-31  
**Status:** Active  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This workstream exists so execution can continue through the rest of the roadmap without requiring constant user check-ins for normal sequencing decisions.

## Objective

Finish the remaining high-value roadmap work in the right order:

1. close Phase 2 production remediation cleanly
2. harvest the shared extraction layer from proven Phase 2 patterns
3. start bounded festivals-first LLM enrichment
4. add minimum viable quality reporting and promotion gates
5. begin canonical entity hardening only after the ingestion layer is stable enough that the work will stick

## Autonomy Contract

Continue without asking for approval when the next step is one of these:

- the next source in an already-defined production or dry-run queue
- targeted crawler, classification, or test fixes needed to complete the active phase
- doc updates that reconcile the written roadmap with the live state
- additive shared-helper work derived directly from already-landed crawler patterns
- bounded verification runs, backfills, and read-only audits that do not introduce a new product or schema direction

Stop and ask only when one of these is true:

- a new database migration is needed beyond the currently understood roadmap path
- a production write run shows a new failure mode that changes the rollout strategy
- a change would alter portal-visible semantics beyond the current roadmap, such as new consumer-facing filters or entity contracts
- the next useful step would require broad rescoping across multiple phases rather than finishing the active one

## Execution Order

### Track A — Finish Phase 2

**Goal:** close the remaining production rewrite queue and exit Phase 2 with the docs matching reality.

#### Current production queue

- [ ] Finish the refreshed four-source library batch on the corrected process image:
  - [x] `fulton-library`
  - `dekalb-library`
  - `cobb-library`
  - `gwinnett-library`

#### Follow-on cleanup tranche

- [ ] Revisit the false-negative music and show source set identified during `is_show` rollout:
  - `smiths-olde-bar`
  - `eddies-attic`
  - `believe-music-hall`
  - `commune`
  - `hotel-clermont`
- [ ] Spot-check Music and Nightlife inventories after that tranche.
- [ ] Reconcile `docs/superpowers/plans/2026-03-30-phase2-crawler-remediation-workstream.md` with the live execution record.
- [ ] Define the exact handoff notes for Phase 0 and Phase 3 based on the repeated patterns observed in the Phase 2 sources.

#### Exit criteria

- [ ] Remaining queued production rewrite sources are run or intentionally deferred with a written reason.
- [ ] Music, Nightlife, library, and community spot checks show the new classifier behavior holding on live data.
- [ ] Phase 2 workstream doc is current enough to serve as an audit trail.

### Track B — Start Phase 0 Shared Extraction Foundation

**Goal:** turn repeated Phase 2 patterns into reusable helpers without speculative abstraction.

#### Candidate patterns to harvest first

- [ ] Content-region extraction and sanitizer logic now repeated across venue, class, and program crawlers.
- [ ] Detail-page description extraction patterns from `meetup`, `cooks_warehouse`, `fulton_library`, and the library and community sources.
- [ ] Compact factual description builders for structured recurring and community sources where real prose does not exist.

#### Deliverables

- [ ] Add shared helpers under `crawlers/pipeline/` for description extraction and content-region isolation.
- [ ] Migrate at least 3 existing crawlers onto those helpers.
- [ ] Keep provenance and confidence behavior explicit where helper adoption changes extraction shape.

#### Exit criteria

- [ ] Three crawlers use the shared helpers without regression.
- [ ] Shared helper tests exist and pass.

### Track C — Start Phase 3 Bounded LLM Enrichment

**Goal:** use LLMs only for durable festival gaps after deterministic remediation has stabilized.

#### Scope

- [ ] Festivals first only
- [ ] Grounded prepare, extract, and apply flow only
- [ ] No broad event backfill

#### Deliverables

- [ ] Narrow the existing workflow to a festival-only execution path.
- [ ] Add task and result directories to `.gitignore`.
- [ ] Require junk, boilerplate, and grounding gates before apply.
- [ ] Verify one known festival end-to-end in dry-run before any live apply.

#### Exit criteria

- [ ] One real festival can go through prepare, extract, and dry-run apply cleanly.
- [ ] Rejection reasons are logged clearly enough to tune prompts and extractors.

### Track D — Minimum Viable Phase 5 Quality Ops

**Goal:** make the remediation work measurable before broader entity-resolution effort begins.

#### Deliverables

- [ ] Create a per-run or weekly source quality report covering:
  - null description rate
  - synthetic description rate
  - obvious classification drift buckets
  - unresolved venue and series errors where visible
- [ ] Add promotion gates for the highest-noise sources touched in Phase 2.
- [ ] Verify at least Atlanta-facing surfaces reflect the cleaner data, not just crawler logs.

#### Exit criteria

- [ ] A repeatable quality report exists and is easy to regenerate.
- [ ] The worst degraded sources are visible without manual log archaeology.

### Track E — Start Phase 4 Canonical Entity Resolution

**Goal:** begin canonical linking only after the ingestion layer is stable enough to avoid churn.

#### Entry gate

- [ ] Tracks A through D are complete enough that current duplicate and linkage failures are not being driven mainly by fresh ingestion defects.

#### First deliverables

- [ ] Audit duplicate venue creation and unresolved organizer, program, and festival link failures.
- [ ] Define the smallest useful venue alias and source matching hardening step.
- [ ] Separate festival entity vs yearly occurrence where current data shape is actively blocking portal quality.

## Verification Standard

- [ ] Run targeted tests for every code slice touched.
- [ ] Run dry-runs or bounded production writes per queue item, not bulk trust-me batches.
- [ ] Update the roadmap and the active phase workstream after each meaningful tranche, not at the very end.

## Progress Log

### 2026-03-31

- Workstream created to let the roadmap proceed without constant user check-ins.
- Phase 2 is the active execution track; later tracks are defined here so sequencing stays explicit once Phase 2 exits.
- The immediate queue is the library and community production rewrite tranche, starting with `gwinnett-library`.
- The library tranche moved farther than the earlier docs showed:
  - `gwinnett-library` completed successfully with `1028 found / 9 new / 1019 updated`
  - latest successful runs already exist for `cobb-library`, `fulton-library`, and `dekalb-library`
- Follow-up live spot checks found the tranche is not clean enough to close:
  - some active library rows still carry stale categories like `music`, `family`, or `support_group` where the current classifier now prefers `words`, `education`, `support`, `workshops`, or `dance`
  - `dekalb-library` also had stale `crawl_logs` rows left in `running` status; those were cleaned up
- Shared classifier hardening continued before more remediation:
  - `tummy time` now routes deterministically to `family` instead of falling through to the LLM and misclassifying as `support`
  - focused classifier suites passed after that change
- The generic `backfill_classify_v2_categories.py` path proved too slow and opaque for this library cleanup slice, so execution switched back to source reruns with `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1`
- `fulton-library` production rerun is now in flight again under that mode; next queue remains `dekalb-library`, then `cobb-library`, then `gwinnett-library` if live spot checks still justify another pass.
- A second rewrite-path defect surfaced during the Fulton rerun:
  - existing-event category rewrites depended on `_classification_confidence`, but the insert pipeline was stripping that field before `smart_update_existing_event()` could evaluate the rewrite gate
  - the fix landed in `crawlers/db/events.py`, preserving `_classification_confidence` through the existing-row merge path and only dropping it before true inserts
  - targeted regression coverage was added in `crawlers/tests/test_db.py`
  - focused verification passed after the hotfix (`67 passed` across the targeted database, rules, and pipeline suites)
- The first Fulton rerun using the broken process image was cancelled deliberately and recorded in `crawl_logs`; the active rerun is now the first production pass using the corrected confidence-propagation path.
- One more shared defect surfaced as the library reruns were validated:
  - the four library crawlers were bypassing `insert_event()` on existing rows by calling `smart_update_existing_event()` directly after `find_event_by_hash(...)`
  - that meant many existing library rows never passed through `_step_classify_v2`, even when reruns touched them
- `cobb_library.py`, `gwinnett_library.py`, `fulton_library.py`, and `dekalb_library.py` were patched so existing rows now always flow through the shared `insert_event()` pipeline; `find_event_by_hash(...)` remains only for update/new counting.
- Focused verification passed with `python3 -m py_compile` across the four patched library crawlers.
- Live validation on the first reruns then exposed a second shared smart-update defect:
  - existing-row rewrites could change `category_id`, but they were not persisting `classification_prompt_version` or the non-empty v2 derived fields on those same rows
  - the symptom was rows getting touched while `classification_prompt_version` remained `NULL`, making the reruns look half-applied
- `crawlers/db/events.py` was patched so existing-row rewrites now persist `classification_prompt_version` plus non-empty v2 derived fields (`duration`, `cost_tier`, `skill_level`, `booking_required`, `indoor_outdoor`, `significance`, `significance_signals`, `audience_tags`) when appropriate.
- The rewriteable legacy source-category set was widened to include `education` and `support`, which is necessary for stale library rows like `Baby Time`, `Reading Buddies`, and disability-support programs to move out of legacy buckets.
- Added targeted regression coverage in `crawlers/tests/test_db.py`; focused verification passed with `68 passed`.
- The pre-patch Cobb rerun was cancelled and recorded in `crawl_logs`.
- A fresh four-source library batch was launched on the corrected process image:
  - `fulton-library`
  - `dekalb-library`
  - `cobb-library`
  - `gwinnett-library`
- The refreshed batch is still in flight as of this log entry.
- Early live Fulton logs already confirm the corrected path is active in production:
  - existing rows now persist `classification_prompt_version` and v2 derived fields during smart updates
  - update shapes now include fields like `classification_prompt_version`, `duration`, `skill_level`, `booking_required`, `indoor_outdoor`, `significance`, and `audience_tags` instead of only timestamp churn
- The refreshed batch has advanced:
  - `fulton-library` completed successfully with `410 found / 0 new / 402 updated`
  - `dekalb-library` is the active long-running leg
  - `cobb-library` and `gwinnett-library` remain queued behind it
- Shared classifier hardening continued while `dekalb-library` was running so the queued Cobb/Gwinnett legs pick up additional fixes without another restart:
  - the rewriteable legacy source-category set now also includes `art`, which is required for stale Gwinnett `Reading Buddies` rows to move out of bad art defaults
  - targeted `art -> words` regression coverage was added and passed in the focused DB suite (`69 passed`)
  - `crawlers/classify.py` now has deterministic library-program rules for `Nintendo Switch`, `Chess Club`, `Kids Sewing`, `Origami`, `Papermaking`, `Soap Making`, `Social Work Intern`, `Filmmakers Club`, `Homework Help`, and `Read to a Pet`
  - a second deterministic library slice now also covers `Toddler Time`, `StoryWalk`, `Friday Movies`, `GED Study Time`, `Sensory Play`, `Blood Drive`, `Take & Make`, `Mah Jongg`, and `Cricut Creations`
  - `genre_normalize.py` was aligned with `tags.py` by adding `chess` and `video-games` to `GAMES_GENRES`, so the validator no longer strips those legitimate game genres
  - focused classifier verification passed after those additions (`63 passed` in `crawlers/tests/test_classify_rules.py`)
- Live Cobb validation then surfaced a shared LLM-normalization defect rather than another source-local bug:
  - some library rows were returning the literal string `"null"` for `cost_tier`, which then violated `events_cost_tier_check` during smart updates
  - `crawlers/classify.py` now collapses null-like string sentinels across the LLM enrichment fields before they reach the DB write path
  - targeted regression coverage landed in `crawlers/tests/test_classify_llm.py`
  - the exact failing craft-kit title now reproduces locally with `cost_tier=None`
  - focused verification passed after that fix with `149 passed` across `test_classify_llm.py`, `test_classify_rules.py`, and `test_db.py`
- A third deterministic Cobb-driven rule slice landed immediately after that normalization fix:
  - `Sensory Playtime` -> `family`
  - `Book-A-Librarian Tech Help` and `Computer Basics` -> `education`
  - `Creative Writing Workshop`, `Clothing Repair Clinic`, and `Shell Charm Bracelet` -> `workshops`
  - focused rules verification passed after the new batch with `76 passed`
- One more shared rewrite-gate fix landed after live validation showed `Book-A-Librarian Tech Help` rows still keeping stale `words` categories:
  - the rewriteable legacy source-category set now also includes `words`, so existing rows can move from stale `words` into stronger v2 categories like `education`
  - targeted DB regression coverage landed for `words -> education` rewrites
- Another deterministic Cobb-driven rule slice then landed directly from live misses:
  - `Pokémon Club` -> `games`
  - `Crafternoon` -> `workshops`
  - focused verification passed after that batch with `148 passed` across `test_classify_rules.py` and `test_db.py`
- The currently running Cobb production process is still the pre-patch image, so a clean follow-on rerun has been queued automatically:
  - wait for the active `cobb-library` process to exit
  - rerun `cobb-library` with `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1` on the corrected code
  - then rerun `gwinnett-library` with the same flags
