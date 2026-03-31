# Rich Data Roadmap — Events, Destinations, Programs, Festivals

**Date:** 2026-03-30  
**Status:** Active roadmap  
**Primary surface:** `both`

This is the execution roadmap for making LostCity's data layer materially richer, more reliable, and more reusable across Atlanta, FORTH, HelpATL, Family, Adventure, Arts, and Sports.

It is intentionally repo-specific. It translates the north star, crawler rules, and current plan docs into a single tracking artifact.

## Why This Exists

LostCity's product quality is now bottlenecked less by frontend breadth and more by data quality depth:

- too many crawlers still emit template or thin descriptions
- too much valuable venue/program/festival signal is missed on first pass
- enrichment work is spread across one-off scripts instead of shared extraction infrastructure
- entity resolution is good enough to operate, but not yet strong enough to fully compound the network

This roadmap exists to fix that in the right order:

1. deterministic extraction and provenance first
2. crawler fixes before enrichment backfills
3. LLMs only where deterministic extraction fails
4. canonical entity resolution after the capture layer improves
5. quality ops so gains stick

## Operating Rules

- Fix the crawler before fixing the database.
- When touching a source, capture all available first-pass signal: events, destinations, programs, recurring programming, specials, hours, metadata.
- Prefer `NULL` over synthetic machine prose.
- LLM output is enrichment, not source of truth.
- Every new field or enrichment path should preserve provenance and confidence.
- Consumer quality is the bar. If a real user would notice the defect, it is roadmap-worthy.

## Canonical Execution Docs

- Phase 1 workstream: `docs/superpowers/plans/2026-03-30-phase1-description-pipeline-workstream.md`
- Phase 2 workstream: `docs/superpowers/plans/2026-03-30-phase2-crawler-remediation-workstream.md`
- Remaining roadmap execution workstream: `docs/superpowers/plans/2026-03-31-rich-data-roadmap-continuation-workstream.md`

## Progress Board

| Phase | Status | Goal | Exit Signal |
|------|--------|------|-------------|
| 0. Shared Extraction Foundation | Planned | Reusable extraction helpers + provenance contract | 3 crawlers migrated to shared helpers without regression |
| 1. Description Pipeline Defuse | Completed | Stop synthetic descriptions from being generated or reintroduced | Daily/weekly automation no longer writes synthetic boilerplate |
| 2. High-Impact Crawler Remediation | In Progress | Replace template/thin descriptions with real source extraction | Production rewrite queue completes and high-noise sources emit grounded descriptions or `NULL` |
| 3. Bounded LLM Enrichment | Planned | Fill durable high-value gaps with grounded LLM extraction | Festival/venue description pipeline runs safely in dry-run + apply |
| 4. Canonical Entity Resolution | Planned | Improve venue/festival/program/organizer linking | Duplicate rate and unresolved entity rate trend down |
| 5. Quality Ops and Publishing | Planned | Make data quality measurable and enforceable | Dashboard + promotion gates in regular use |

## Phase 0: Shared Extraction Foundation

**Surface:** `both`

**Goal:** build shared extraction infrastructure so crawler fixes compound instead of repeating themselves.

### Outputs

- Shared extraction helpers under `crawlers/pipeline/` for:
  - description extraction from JSON-LD, Open Graph, meta, and main content
  - content region isolation
  - hours extraction
  - specials extraction
  - program/session extraction
- Standard normalized extraction contract for crawlers:
  - event facts
  - venue metadata
  - recurring programming
  - specials
  - hours
  - programs
- Provenance/confidence support for extracted fields where missing.

### Candidate files

- `crawlers/pipeline/detail_enrich.py`
- `crawlers/pipeline/fetch.py`
- `crawlers/pipeline/models.py`
- new shared helpers under `crawlers/pipeline/`
- `crawlers/description_quality.py`
- migration files if provenance fields need to be expanded

### Tasks

- [ ] Define a shared description extraction helper that prefers structured fields before body text.
- [ ] Add content-region extraction that can isolate `main`, `article`, or role-based main content without pulling full-page chrome.
- [ ] Standardize output shape for extracted descriptions, images, hours, specials, and programs.
- [ ] Audit where `field_provenance`, `field_confidence`, `extraction_version`, or `raw_text` are missing and add migration-backed support only where needed.
- [ ] Migrate at least 3 existing crawlers onto shared helpers to prove the abstraction is actually useful.

### Verification

- [ ] Shared helper tests added in `crawlers/tests/`
- [ ] `python3 -m pytest`
- [ ] Dry-run 3 migrated crawlers successfully

## Phase 1: Description Pipeline Defuse

**Surface:** `both`

**Goal:** stop writing synthetic descriptions before cleaning or backfilling anything.

### Canonical execution docs

- Primary spec: `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md`
- Existing execution plan: `docs/superpowers/plans/2026-03-30-description-pipeline-defuse-and-clean.md`
- Active workstream: `docs/superpowers/plans/2026-03-30-phase1-description-pipeline-workstream.md`

### Scope

- remove or neutralize synthetic description builders in maintenance/enrichment scripts
- add synthetic description detection to the quality gate
- prevent cleaned rows from being re-polluted by daily or weekly automation

### Tasks

- [ ] Extend `crawlers/description_quality.py` synthetic marker coverage based on actual builder outputs.
- [ ] Remove synthetic fallback writes from:
  - `crawlers/scripts/post_crawl_maintenance.py`
  - `crawlers/enrichment_pipeline.py`
  - any remaining description synthesizer scripts
- [ ] Create a cleanup path for existing synthetic descriptions with backup and dry-run support.
- [ ] Verify daily and weekly automation paths still run without description synthesis.

### Verification

- [ ] Synthetic description cleanup script has backup and dry-run modes
- [ ] `python3 -m pytest`
- [ ] relevant maintenance scripts import and run
- [ ] sample DB audit shows synthetic patterns trending toward zero

## Phase 2: High-Impact Crawler Remediation

**Surface:** `both`

**Goal:** replace template/thin descriptions with real source-grounded extraction in the sources that most affect live product quality.

### Existing execution doc

- `docs/superpowers/plans/2026-03-30-crawler-description-fixes.md`
- Future workstream: `docs/superpowers/plans/2026-03-30-phase2-crawler-remediation-workstream.md`
- Related spec: `docs/superpowers/specs/2026-03-30-event-classification-fix.md`

### Important corrections before execution

The current crawler fix plan is directionally right but not fully aligned to live code. Execute it with these corrections:

- `meetup.py` is Playwright scraping, not an API integration. Keep the task focused on DOM/detail extraction cleanup.
- `team_trivia.py` already has descriptions and multiple event types. Rewrite per event type or simplify safely; do not replace everything with one generic trivia string.
- `atlanta_city_meetings.py` likely needs compact factual copy, not blanket `NULL`, because the source exposes structured location context.
- Any task that assumes a source-provided description field must be verified against the real crawler before implementation.

### Wave 1 sources

- [x] `crawlers/sources/ticketmaster.py`
- [x] `crawlers/sources/terminal_west.py`
- [x] `crawlers/sources/meetup.py`
- [x] `crawlers/sources/fulton_library.py`
- [x] `crawlers/sources/emory_healthcare_community.py`
- [x] `crawlers/sources/laughing_skull.py`
- [x] `crawlers/sources/aisle5.py`
- [x] `crawlers/sources/cooks_warehouse.py`
- [x] `crawlers/sources/amc_atlanta.py`
- [x] `crawlers/sources/gsu_athletics.py`
- [x] `crawlers/sources/ksu_athletics.py`

### Wave 2 sources

- [x] `crawlers/sources/truist_park.py`
- [x] `crawlers/sources/lore_atlanta.py`
- [x] `crawlers/sources/aa_atlanta.py`
- [x] `crawlers/sources/na_georgia.py`
- [x] `crawlers/sources/big_peach_running.py`
- [x] `crawlers/sources/atlanta_city_meetings.py`
- [x] `crawlers/sources/recurring_social_events.py`
- [x] `crawlers/sources/team_trivia.py`
- [x] `crawlers/sources/painting_with_a_twist.py`

### Requirements while touching any crawler

- [ ] Prefer real source copy over templated assembly.
- [ ] If no real source copy exists, prefer `None` over synthetic filler.
- [ ] Capture missing venue metadata if it is available on the same page.
- [ ] Capture recurring programming, specials, hours, or program/session data if visible.
- [ ] Preserve existing series linking and dedupe behavior.
- [ ] Correct upstream event classification when source patterns are obviously misrouted (for example music vs nightlife, show vs social format).
  - progress: extraction guidance and tag deflation are in code, migration-backed `is_show` ingestion is live, the shows API supports `?is_show=true`, and production rewrite waves are now running against the highest-noise sources

### Verification

- [ ] Dry-run each changed crawler with `python3 main.py --source <slug> --dry-run`
- [ ] Spot-check descriptions for synthetic markers and junk
- [ ] Spot-check category correctness on high-noise surfaces such as Music and Nightlife
- [ ] `python3 -m pytest`

## Phase 3: Bounded LLM Enrichment

**Surface:** `both`

**Goal:** use LLMs as a tightly-scoped enrichment layer for durable gaps, not as a broad event backfill hammer.

### Existing execution doc

- `docs/superpowers/plans/2026-03-30-llm-extract-festival-descriptions.md`
- Future workstream: `docs/superpowers/plans/2026-03-30-phase3-bounded-llm-enrichment-workstream.md`

### Important corrections before execution

The current LLM plan needs narrowing and alignment before implementation:

- start with festivals and venues, not broad event backfill
- if events are later included, scope to active/upcoming rows only
- fix content-region extraction so `role="main"` pages are handled correctly
- avoid overloading `--slug` semantics across both festivals and events
- treat grounding as a real quality gate, but tune it against real paraphrase samples so it does not reject obviously good source-grounded copy

### Execution order

- [ ] Festivals first
- [ ] Venues second
- [ ] Live/upcoming events only after deterministic crawler fixes land

### Tasks

- [ ] Build or narrow the prepare/extract/apply workflow for festivals only.
- [ ] Add task/result directories to `.gitignore`.
- [ ] Require junk/boilerplate/grounding checks before apply.
- [ ] Log rejection reasons so prompt or extractor issues are diagnosable.
- [ ] After festival success, design a venue description enrichment pass.

### Verification

- [ ] Prepare works on a single known festival
- [ ] Extract writes result files cleanly
- [ ] Apply supports dry-run and live modes
- [ ] Festival descriptions are source-grounded and consumer-usable

## Phase 4: Canonical Entity Resolution

**Surface:** `both`

**Goal:** improve linking so the data layer compounds across sources and portals instead of accumulating near-duplicates.

### Future workstream

- `docs/superpowers/plans/2026-03-30-phase4-canonical-entity-resolution-workstream.md`

### Scope

- canonical venues with alias/source matching
- festival entity vs yearly occurrence separation
- program vs session resolution
- organizer/producer canonicalization

### Tasks

- [ ] Audit current venue resolution failure modes and duplicate creation patterns.
- [ ] Define stronger venue matching using normalized names, source URLs, addresses, and geospatial hints.
- [ ] Strengthen festival linking between persistent festival entities and yearly occurrences.
- [ ] Strengthen recurring program and class series linkage.
- [ ] Introduce organizer/producers as stronger cross-entity linking nodes where useful.

### Verification

- [ ] Duplicate venue rate declines on sampled source runs
- [ ] Festival pages can reliably aggregate related occurrences/programming
- [ ] Program/session grouping becomes stable across repeated crawls

## Phase 5: Quality Ops and Publishing

**Surface:** `both`

**Goal:** turn improvements into measurable operating discipline.

### Future workstream

- `docs/superpowers/plans/2026-03-30-phase5-quality-ops-publishing-workstream.md`
- Related spec: `docs/superpowers/specs/2026-03-30-event-classification-fix.md`

### Tasks

- [ ] Create a source quality dashboard or report covering:
  - null description rate
  - synthetic description rate
  - unresolved venue rate
  - duplicate rate
  - stale date rate
  - crawl failure rate
- [ ] Add classification quality checks where misrouting is consumer-visible:
  - music vs nightlife
  - show vs social-format filtering
  - venue place type correctness for major music venues
- [ ] Add promotion gates for high-value sources before production runs.
- [ ] Add recurring QA sampling for changed sources.
- [ ] Ensure consumer surfaces prefer no description over bad description.
- [ ] Verify improvements land on Atlanta/FORTH/HelpATL/Family surfaces, not just in crawler logs.

### Verification

- [ ] Weekly or per-run quality report exists
- [ ] Top degraded sources are visible and actionable
- [ ] Portal-facing pages show fewer broken, synthetic, or empty-detail experiences

## Success Metrics

Track these at roadmap level:

- `% events with synthetic descriptions` -> drive toward zero
- `% active/upcoming events with useful descriptions`
- `% venues with description + image + neighborhood`
- `% crawlers using shared extraction helpers`
- `% recurring sources with series linkage`
- `% venues with hours captured when source publishes hours`
- `% venue sources with specials captured when source publishes specials`
- duplicate venue creation rate
- dry-run failure rate across Wave 1 sources

## Current Recommended Sequence

Run this roadmap in the following order:

1. Phase 1 — stop synthetic description generation
2. Phase 2 — fix top live-product crawlers
3. Phase 0 — extract shared helpers while those fixes are underway
4. Phase 3 — festivals-first LLM enrichment
5. Phase 4 — canonical entity hardening
6. Phase 5 — quality ops and enforcement

The sequencing is intentional:

- stopping bad writes before cleanup avoids re-pollution
- crawler fixes produce durable value across every portal
- shared extraction infra should emerge from real crawler remediation work, not speculative abstraction
- LLM enrichment should target durable gaps after deterministic capture improves

## Current Remaining Queue

This is the active execution order for the rest of the roadmap. It is intentionally narrower than the full plan so execution can continue without constant rescoping.

1. Finish the remaining Phase 2 production rewrite wave:
   - `dekalb-library` in flight
   - `cobb-library`
   - `gwinnett-library`
   - then the false-negative show/music venue cleanup tranche led by `smiths-olde-bar`, `eddies-attic`, `believe-music-hall`, `commune`, and `hotel-clermont`
2. Reconcile Phase 2 state into the docs and close out its remaining verification and spot-check work.
3. Start Phase 0 shared extraction work by harvesting patterns already proven in Phase 2.
4. Start Phase 3 in the narrow festivals-first shape already defined in the Phase 3 workstream.
5. Add the minimum viable Phase 5 quality reporting layer so later phases are measured instead of anecdotal.
6. Start Phase 4 canonical resolution only after the ingestion and classification layer is stable enough that duplicate and linkage work will stick.

## Progress Log

Use this section to record meaningful roadmap movement. Keep it terse and factual.

### 2026-03-30

- Roadmap created and aligned to current north star, crawler rules, and active execution docs.
- Existing plan review found corrections needed in the crawler description fixes plan and LLM extraction plan before blind execution.
- Phase 1 workstream created so execution can stay narrow without drifting into later phases.
- Phase 2 through Phase 5 workstreams created as queued execution docs so later phases can activate cleanly without turning the roadmap into a giant checklist.
- Event classification fix spec integrated into later-phase planning as Phase 2 upstream classification work plus Phase 5 verification/quality reporting work.
- Phase 1 execution completed:
  - runtime synthetic enrichment paths are defused
  - legacy scripts are documented as manual real-extraction tools
  - backup was captured before cleanup review
  - full cleanup dry-run found zero synthetic matches in the current DB snapshot, so no apply step was needed
- Phase 2 execution started:
  - first remediation batch landed in `ticketmaster.py`, `emory_healthcare_community.py`, `gsu_athletics.py`, `ksu_athletics.py`, and `amc_atlanta.py`
  - template/schedule-assembled descriptions were replaced with source descriptions or intentional `NULL`
  - file-level compile checks passed
  - `gsu-athletics` and `ksu-athletics` dry-runs completed cleanly
  - second remediation batch landed in `terminal_west.py`, `meetup.py`, `fulton_library.py`, and `cooks_warehouse.py`
  - `terminal-west` dry-run completed cleanly; `cooks-warehouse` is currently inactive in the source registry
  - targeted pytest coverage for the new Cook's description sanitizer is in place
  - third remediation batch landed in `aisle5.py` and `laughing_skull.py`
  - Wave 1 source remediation is complete in code; remaining Phase 2 work is Wave 2 plus any follow-up verification sweeps
  - fourth remediation batch landed in `atlanta_city_meetings.py`, `team_trivia.py`, and `painting_with_a_twist.py`
  - targeted pytest coverage was added for the Wave 2 helper changes
  - `team-trivia` dry-run completed cleanly
  - `atlanta-city-meetings` is currently inactive in the source registry, so validation there is blocked by source state rather than code failure
  - `painting-with-a-twist` dry-run started cleanly and processed live detail-page updates without import/runtime errors, but was not left running to full completion because of crawl volume
  - fifth remediation batch landed in `truist_park.py`, `lore_atlanta.py`, and `recurring_social_events.py`
  - `truist-park` and `lore-atlanta` dry-runs completed cleanly
  - targeted pytest coverage for the Lore and recurring-social description cleaners is in place
  - `atlanta-recurring-social` dry-run started cleanly with the corrected slug and processed live read-only updates without import/runtime failures, but was not left running to full completion because of source volume
  - sixth remediation batch landed in `aa_atlanta.py`, `na_georgia.py`, and `big_peach_running.py`
  - `big-peach-running` dry-run completed cleanly
  - targeted pytest coverage for the AA and NA compact-description helpers is in place
  - `aa-atlanta` and `na-georgia` dry-runs started cleanly and processed live read-only updates without import/runtime failures, but were not left running to full completion because of source volume
  - Anthropic-backed classification calls hit low-credit errors during several dry-runs, which exposed a provider-routing gap in the shared LLM path
  - classification no longer hardcodes Anthropic and the shared LLM client now falls back to OpenAI on provider credit/quota/auth availability failures when both providers are configured
  - targeted provider-failover coverage was added in `crawlers/tests/test_llm_client.py`
  - this environment currently has OpenAI configured and Anthropic unset, so the shared provider path now matches the available runtime instead of bypassing it
  - extraction guidance in `crawlers/extract.py` now explicitly separates booked music shows from nightlife/open-format programming
  - `live-music` tag inference now requires a real show signal and recurring/open-format music rows are deflated into `open-format`
  - migration-backed `is_show` support landed in the crawler DB write path with additive schema guards and matching schema/migration files
  - audit of the named major music-venue crawlers found they are already normalized in code; the remaining place-type problem is primarily live data drift/backfill rather than active crawler definitions
  - targeted classification/show-signal regression coverage passed (`90 passed` across the affected suites)
  - representative `atlanta-recurring-social` dry-run confirmed the new `is_show` guard fails open when the production DB has not yet received the migration
  - the shows API now supports `?is_show=true` with a graceful missing-column fallback, so downstream adoption can begin before the migration is live everywhere
  - a dedicated `backfill_is_show.py` script now exists for immediate post-migration remediation of existing rows
  - targeted web verification passed for the shows API contract, and `web` TypeScript still builds cleanly
  - the `is_show` migration has now been applied to production through the repo’s targeted migration runner
  - a live 90-day `is_show` backfill is in progress; pre-apply dry-run found 7,661 candidate updates across 36,280 active rows
  - live production counts already moved materially while that batch is running, especially in `music` and `theater`
  - the first post-backfill re-crawl target remains `atlanta-recurring-social`, but a separate production write crawl lock is currently active, so the source-write pass is queued behind that lock instead of being forced
  - remaining `music` non-shows now appear to split between intentional open-format inventory (`atlanta-recurring-social`) and false negatives caused by bad upstream genres/tags on real concert rows from a smaller set of venue crawlers
  - follow-up production diagnostics exposed a narrower `is_show` heuristic gap: generic `ticket_status` values like `free` and `tickets-available` were still over-promoting recurring bar/nightlife inventory into the shows set
  - `crawlers/db/events.py` was tightened so only stronger ticket-status states count as show evidence on their own; paid pricing, explicit performance tags, and real ticket URLs still promote true shows
  - targeted pipeline coverage for those cases now passes (`13 passed` in the focused `test_classify_pipeline.py` run)
  - a second production `is_show` correction pass applied 163 additional updates after that heuristic change, with the largest cleanups coming from public-library dance/music inventory and recurring bar/nightlife programming
  - post-apply verification on the same 90-day active window now drains to zero pending updates
  - current active live counts are `music 2419 / 2891`, `theater 1128 / 1133`, `comedy 429 / 446`, `film 3514 / 3514`, `dance 75 / 639`, `nightlife 0 / 337`
  - the production write crawl lock is still active, so the next source-write wave remains queued behind that lock rather than being forced
  - a fresh `atlanta-recurring-social` dry-run confirmed the recurring-suppression path is active and exposed a shared karaoke-classification bug rather than just a source-local defect
  - the shared classifier has now been corrected so karaoke resolves to the social-format classification (`nightlife`) at the rules layer instead of being force-promoted into `music`
  - targeted rules/pipeline verification passed (`48 passed` across the focused suites)
  - both reproduced karaoke edge cases now resolve cleanly at the rules layer:
    - `Live Band Karaoke at Metalsome Live Band Karaoke` -> `nightlife` / `karaoke` / `0.88`
    - `Emo Night Karaoke` -> `nightlife` / `karaoke` / `0.88`
  - read-only validation of the queued source wave shows `lore-atlanta` drag programming now disagreeing in the right direction (`old=nightlife new=theater`), while `the-masquerade` karaoke no longer needs a source-specific classifier exception
  - the next structural blocker was upstream write behavior: v2 classification still logged better categories without rewriting stored event categories
  - a feature-flagged rewrite path now exists in the event write pipeline and smart-update path; production recrawls can opt in with `CLASSIFY_V2_REWRITE_CATEGORY=1` so category fixes actually persist
  - focused rewrite-path coverage passed (`4 passed` across the targeted tests), and a dry-run with both classifier flags started cleanly on `lore-atlanta`
  - operationally, `atlanta-recurring-social` remains the first queued production write pass once the crawl lock clears, and that write wave should run with both flags: `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1`
  - a dedicated `backfill_classify_v2_categories.py` remediation script now exists for category drift, but direct DB reads plus the shared rules classifier are currently the faster way to size large-source rewrite batches interactively
  - current post-lock write order is now evidence-based rather than assumed:
    - `atlanta-recurring-social`: `155` high-confidence rule rewrites in the active 30-day window
    - `lore-atlanta`: `28` high-confidence rule rewrites in the active 90-day window
    - `boggs-social`: `5` high-confidence rule rewrites in the active 90-day window
  - additional library/community rules coverage landed in `crawlers/classify.py` and `crawlers/tests/test_classify_rules.py`, covering `Baby Time`, `Reading Buddies`, disability-support meetups, English-conversation groups, and ukulele class series
  - focused rules verification passed (`40 passed` in `test_classify_rules.py`)
  - that rules expansion exposed a second high-confidence rewrite queue on active library inventory:
    - `gwinnett-library`: `34` high-confidence rule rewrites in the active 30-day window
    - `cobb-library`: `28` high-confidence rule rewrites in the active 30-day window
    - `fulton-library`: `5` high-confidence rule rewrites in the active 30-day window
    - `dekalb-library`: `1` high-confidence rule rewrite in the active 30-day window
  - post-lock sequencing is now clearer: finish the nightlife-heavy rewrite wave first, then move to the library/community queue rather than letting those rows sit behind ad hoc manual cleanup

### 2026-03-31

- Phase 2 moved from code-only remediation into live production rollout.
- The `is_show` migration was applied to production, the 90-day backfill completed, and the shows API now supports `?is_show=true` with a fail-open missing-column fallback.
- Production rewrite waves have completed successfully for:
  - `atlanta-recurring-social`: `628 found / 0 new / 591 updated`
  - `lore-atlanta`: `65 found / 1 new / 64 updated`
  - `boggs-social`: `46 found / 1 new / 45 updated`
- Phase 2 also required real production data-path repair:
  - recurring series venue scoping was corrected in `crawlers/series.py`
  - stale adult-event trigger functions were repaired with new database and Supabase migrations after the place and venue rename drift surfaced in production inserts
  - duration normalization was tightened in `crawlers/db/events.py` so classifier output fits the production constraint set
- The active Phase 2 production queue has now moved into the library and community tranche:
  - `gwinnett-library` is in flight
  - `cobb-library`, `fulton-library`, and `dekalb-library` are next
- Reality update: the clean boundary between crawler remediation and platform hardening is weaker than the original roadmap implied. Phase 2 has already required selective DB and API repair to let crawler-quality gains land in production.
- Remaining structural cleanup item: `database/schema.sql` is behind the live place and venue rename state and should be reconciled before Phase 4 or broader Phase 5 reporting relies on it as the canonical snapshot.
  - a read-only `atlanta-recurring-social` dry-run with both classification flags stayed operationally clean and confirmed the rewrite path is ready once the production lock clears
  - that dry-run also exposed one remaining classifier risk on recurring multi-format open mics, where the LLM wanted to over-promote `Open Mic at Joe's Coffeehouse` into `comedy`
  - shared classifier hardening now intercepts those ambiguous open mics before the LLM fallback:
    - `poetry` / `spoken word` cues -> deterministic `words`
    - `stand-up` / `improv` cues -> deterministic `comedy`
  - focused verification passed (`58 passed` across `test_classify_rules.py` and `test_classify_pipeline.py`), and the Joe's-style case now skips the LLM path entirely
  - the library/community tranche then exposed two more shared-pipeline defects that were more important than any single crawler rewrite:
    - `cobb_library.py`, `gwinnett_library.py`, `fulton_library.py`, and `dekalb_library.py` were bypassing `insert_event()` on existing rows, which meant many library reruns never passed through `_step_classify_v2`
    - existing-row smart updates could rewrite `category_id`, but they were not persisting `classification_prompt_version` or the non-empty v2 derived fields on those same rows
  - both defects were fixed in shared code:
    - the four library crawlers now always route existing rows through `insert_event()` and only use `find_event_by_hash(...)` for update/new counting
    - `crawlers/db/events.py` now persists `classification_prompt_version` plus the v2 derived fields (`duration`, `cost_tier`, `skill_level`, `booking_required`, `indoor_outdoor`, `significance`, `significance_signals`, `audience_tags`) on existing-row rewrites when appropriate
    - the rewriteable legacy source-category set was widened to include `education` and `support`, which is necessary for stale library rows like `Baby Time`, `Reading Buddies`, and disability-support programs to move out of legacy buckets
  - focused verification passed after the shared update-path fix (`68 passed` in `crawlers/tests/test_db.py`)
  - the pre-patch Cobb rerun was cancelled and recorded in `crawl_logs`
  - a fresh four-source library batch was launched on the corrected process image:
    - `fulton-library`
    - `dekalb-library`
    - `cobb-library`
    - `gwinnett-library`
  - the refreshed batch is still in flight as of this roadmap update
  - early live Fulton logs already confirm the corrected path is active in production, with existing rows now persisting `classification_prompt_version` and v2 derived fields during smart updates instead of only timestamp churn
  - the refreshed batch has advanced:
    - `fulton-library` completed successfully with `410 found / 0 new / 402 updated`
    - `dekalb-library` is the active long-running leg
    - `cobb-library` and `gwinnett-library` remain queued behind it
  - shared rewrite hardening continued while the batch was in flight:
    - the rewriteable legacy source-category set now also includes `art`, which is required for stale `Reading Buddies`-style rows to move out of bad art defaults
    - targeted `art -> words` regression coverage passed, bringing the focused DB suite to `69 passed`
  - shared deterministic library-program rules were added for titles that were still leaking to the LLM in live runs:
    - `Nintendo Switch` and `Chess Club` -> `games`
    - `Kids Sewing`, `Origami`, `Papermaking`, and `Soap Making` -> `workshops`
    - `Social Work Intern` -> `support`
    - `Filmmakers Club` -> `film`
    - `Homework Help` -> `education`
    - `Read to a Pet` -> `words`
    - `Toddler Time` and `StoryWalk` -> `words`
    - `Friday Movies` -> `film`
    - `GED Study Time` -> `education`
    - `Sensory Play` -> `family`
    - `Blood Drive` -> `volunteer`
    - `Take & Make`, `Mah Jongg`, and `Cricut Creations` now classify deterministically in the expected craft/game buckets
  - that rules batch exposed a taxonomy mismatch: `tags.py` already treated `chess` and `video-games` as valid game genres, but `genre_normalize.py` was stripping them from `GAMES_GENRES`; the set is now aligned
  - focused classifier verification passed after those additions (`63 passed` in `crawlers/tests/test_classify_rules.py`)
  - live Cobb validation then exposed a shared LLM-normalization defect rather than another source-local issue:
    - some library rows were returning the literal string `"null"` for `cost_tier`, which then violated `events_cost_tier_check` during smart updates
    - `crawlers/classify.py` now collapses null-like string sentinels across the LLM enrichment fields before they reach the DB write path
    - targeted regression coverage landed in `crawlers/tests/test_classify_llm.py`
    - the exact failing craft-kit title now reproduces locally with `cost_tier=None`
    - focused verification passed after that fix with `149 passed` across `test_classify_llm.py`, `test_classify_rules.py`, and `test_db.py`
  - another deterministic library rule slice then landed directly from live Cobb misses:
    - `Sensory Playtime` -> `family`
    - `Book-A-Librarian Tech Help` and `Computer Basics` -> `education`
    - `Creative Writing Workshop`, `Clothing Repair Clinic`, and `Shell Charm Bracelet` -> `workshops`
    - focused rules verification passed after that batch with `76 passed`
  - the rewriteable legacy source-category set now also includes `words`, which is required for stale `words` rows like `Book-A-Librarian Tech Help` to move into stronger v2 categories such as `education`
  - another deterministic live-Cobb rule slice then landed for `Pokémon Club` -> `games` and `Crafternoon` -> `workshops`
  - focused verification passed after that batch with `148 passed` across `test_classify_rules.py` and `test_db.py`
  - the active Cobb production process is still the pre-patch image, so a clean follow-on rerun has been queued automatically:
    - wait for the active `cobb-library` process to exit
    - rerun `cobb-library` with `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1` on the corrected code
    - then rerun `gwinnett-library` with the same flags
