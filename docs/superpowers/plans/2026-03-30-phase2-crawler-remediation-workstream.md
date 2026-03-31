# Phase 2 Workstream — High-Impact Crawler Remediation

**Date:** 2026-03-30  
**Status:** In Progress  
**Surface:** `both`  
**Roadmap parent:** `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`

This is the execution workstream for Phase 2 of the rich data roadmap.

## Objective

Replace template or thin descriptions with real source-grounded extraction in the crawlers that most affect live product quality, while capturing more first-pass venue/program/recurring signal whenever the source makes it available.

## Drift Controls

- This workstream begins only after Phase 1 has defused synthetic pipeline writes.
- Do not expand this into broad “fix all crawlers” scope. Stay on the named wave list unless a closely related source is needed to finish a shared pattern.
- If a source does not publish real description copy, prefer `None` over synthetic filler.
- Every crawler touched here should be evaluated for missed first-pass capture, not just description text.
- If a proposed task assumes a source/API field exists, verify it in the live crawler before implementation.

## Canonical References

- Roadmap: `docs/superpowers/plans/2026-03-30-rich-data-roadmap.md`
- Existing plan: `docs/superpowers/plans/2026-03-30-crawler-description-fixes.md`
- Related spec: `docs/superpowers/specs/2026-03-30-event-classification-fix.md`
- Crawler rules: `crawlers/CLAUDE.md`

## Current State Snapshot

Execution has started. Review identified these corrections in the existing plan before the first implementation slice:

- `meetup.py` is Playwright scraping, not an API integration
- `team_trivia.py` already has descriptions and multiple event types
- `atlanta_city_meetings.py` likely needs compact factual copy, not blanket `NULL`
- some “use API description directly” assumptions need verification against current source code

## Scope

### In scope

- replacing templated description builders with real extraction or `None`
- adding detail-page extraction where the source publishes real copy
- capturing additional first-pass venue metadata, hours, specials, recurring programming, or program/session structure when visible on the same source
- upstream classification fixes where ingestion currently misroutes events in consumer-visible ways

### Out of scope

- synthetic cleanup scripts and maintenance orchestration
- broad LLM backfill
- canonical entity graph redesign
- dashboarding and quality ops beyond crawler-level validation

## Execution Waves

## Wave 1 — Highest Live-Product Impact

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

## Wave 2 — Secondary and Recurring/Structured Sources

- [x] `crawlers/sources/truist_park.py`
- [x] `crawlers/sources/lore_atlanta.py`
- [x] `crawlers/sources/aa_atlanta.py`
- [x] `crawlers/sources/na_georgia.py`
- [x] `crawlers/sources/big_peach_running.py`
- [x] `crawlers/sources/atlanta_city_meetings.py`
- [x] `crawlers/sources/recurring_social_events.py`
- [x] `crawlers/sources/team_trivia.py`
- [x] `crawlers/sources/painting_with_a_twist.py`

## Shared Requirements For Every Touched Crawler

- [ ] Prefer source-provided descriptions over templated assembly
- [ ] If no real description exists, use `None`
- [ ] Preserve series grouping and dedupe behavior
- [ ] Capture missing venue metadata if the source page already exposes it
- [ ] Capture recurring programming if the source has recurring sections
- [ ] Capture specials and hours if the source visibly publishes them
- [ ] Add or update tests where crawler logic is non-trivial

## Execution Tracks

## Track A — Plan Corrections

- [ ] Rewrite task assumptions from the existing plan where they diverge from live code
- [ ] Mark which tasks are “real extraction,” “detail-page extraction,” or “intentional null”
- [ ] Identify any source pairs that should share extraction helpers

## Track A2 — Classification Hardening

This track integrates `docs/superpowers/specs/2026-03-30-event-classification-fix.md`.

- [x] Update category guidance in `crawlers/extract.py` for music vs nightlife routing
- [x] Audit major music venue crawlers and normalize `place_type`/crawler venue type where they are still too generic
  - result: the audited venue-specific crawlers are already normalized in code for the true music-room set (`tabernacle`, `variety_playhouse`, `terminal_west`, `aisle5`, `eddies_attic`, `the_eastern`, `center_stage`, `the_loft`)
  - follow-up: remaining discrepancy looks like live data/backfill, not active crawler definitions; `fox_theatre` and `buckhead_theatre` intentionally remain `theater`
- [x] Define the implementation path for `is_show`
  - [x] migration-backed schema work
  - [x] ingestion computation in crawler DB write path
  - [x] API/query contract updates where needed
- [x] Deflate `live-music` tagging in `crawlers/tag_inference.py` so it reflects performance signals instead of all music-tagged rows
- [ ] Identify and queue the required re-crawls after prompt/classification fixes land

## Track B — Wave 1 Implementation

- [x] Implement Wave 1 source fixes
- [ ] Dry-run each source
- [ ] Spot-check resulting descriptions for junk, synthetic markers, and source fidelity

## Track C — Wave 2 Implementation

- [x] Implement Wave 2 source fixes
- [ ] Dry-run each source
- [ ] Spot-check recurring/structured source behavior

## Track D — Shared Helper Harvest

- [ ] Extract any repeated detail-page logic into shared helpers once at least 2-3 sources need the same pattern
- [ ] Feed useful abstractions back into Phase 0 shared extraction work

## Track E — Classification Re-crawl and Validation

- [ ] Re-crawl the highest-noise classification sources after the ingestion fixes land
- [ ] Spot-check Music, Nightlife, and Theater-facing inventories for obvious misroutes
- [ ] Verify major music venues are discoverable through correct place-type filters

## Verification

- [ ] `python3 main.py --source <slug> --dry-run`
- [ ] `python3 -m pytest`
- [ ] synthetic/junk spot checks on changed source outputs
- [ ] confirm no regressions in series linkage where applicable
- [ ] confirm classification improvements on the consumer-facing Music/Nightlife split

## Current Remaining Queue

- [ ] Finish the refreshed library/community rewrite tranche on the corrected process image:
  - [x] `fulton-library`
  - `dekalb-library`
  - `cobb-library`
  - `gwinnett-library`
- [ ] Run the false-negative music and show cleanup tranche:
  - `smiths-olde-bar`
  - `eddies-attic`
  - `believe-music-hall`
  - `commune`
  - `hotel-clermont`
- [ ] Close the remaining spot-check and docs reconciliation work needed for a real Phase 2 exit

## Exit Criteria

- Wave 1 sources no longer emit synthetic/template descriptions
- Wave 2 sources are fixed or intentionally documented as `None`
- touched sources use source-grounded descriptions or no description
- useful repeated extraction logic has been identified for shared-helper consolidation
- handoff notes exist for Phase 3 where bounded LLM enrichment still makes sense

## Risks

- removing filler copy will expose how many sources truly lack first-pass description capture
- detail-page fetches can increase crawl runtime or failure modes
- recurring/structured sources can regress series behavior if description cleanup is done carelessly
- classification changes can materially alter consumer inventory and should be validated against live portal expectations

## Progress Log

### 2026-03-30

- Workstream created from roadmap.
- Existing source-fix plan is accepted as input, but not as-is execution truth; plan corrections are required before implementation.
- Event classification fix spec integrated here because the problem is upstream ingestion/classification quality, not a UI-side filtering problem.
- Batch 1 landed in code for `ticketmaster.py`, `emory_healthcare_community.py`, `gsu_athletics.py`, `ksu_athletics.py`, and `amc_atlanta.py`.
- `ticketmaster.py` had dead template fallback helpers removed; behavior remains API/detail-page description only.
- `emory_healthcare_community.py` now uses the Blackthorn API `description` field directly instead of assembling schedule metadata into prose.
- `gsu_athletics.py` now stores JSON-LD `description` when present and otherwise leaves descriptions `NULL`.
- `ksu_athletics.py` and `amc_atlanta.py` now intentionally leave descriptions `NULL` because the current source pages do not publish meaningful event copy.
- File-level verification passed with `python3 -m py_compile` across the touched crawlers.
- Dry-runs completed cleanly for `gsu-athletics` and `ksu-athletics`.
- Dry-runs for `amc-atlanta`, `emory-healthcare-community`, and `ticketmaster` started cleanly and processed live read-only updates without import/runtime failures; they are materially slower because of source volume and pagination.
- Batch 2 landed in code for `terminal_west.py`, `meetup.py`, `fulton_library.py`, and `cooks_warehouse.py`.
- `terminal_west.py` now keeps the feed/detail descriptions directly and no longer wraps them in schedule/location/ticketing boilerplate.
- `meetup.py` now stores the page description directly when it is visible and drops member-only Meetup boilerplate instead of appending host/topic filler.
- `fulton_library.py` now stores the BiblioCommons API description directly instead of rebuilding it with location and registration prose.
- `cooks_warehouse.py` now fetches real class descriptions from the detail product pages and strips recurring schedule/policy scaffolding; a targeted sanitizer test was added.
- `python3 -m pytest crawlers/tests/test_cooks_warehouse.py crawlers/tests/test_description_quality.py -q` passed with 15 tests green.
- Dry-run completed cleanly for `terminal-west`.
- `cooks-warehouse` did not run because the source is currently inactive in the sources table, which is an activation/state issue rather than a code failure.
- `meetup` and `fulton-library` dry-runs started cleanly and processed live data without import/runtime errors, but were not allowed to run to full completion because of crawl volume.
- Batch 3 landed in code for `aisle5.py` and `laughing_skull.py`.
- `aisle5.py` now keeps detail-enriched description copy directly and no longer wraps supporting-act, date, venue, and ticket metadata into prose.
- `laughing_skull.py` now keeps real site/detail descriptions directly for scraped events, and the generated recurring series rows intentionally store `NULL` descriptions instead of synthetic comedy-show templates.
- File-level verification passed with `python3 -m py_compile` for the final Wave 1 pair.
- Dry-run completed cleanly for `aisle5`.
- `laughing-skull` dry-run started cleanly and exercised both detail-page enrichment and recurring-series generation without code/runtime errors, but was not left running to full completion.
- Batch 4 landed in code for `atlanta_city_meetings.py`, `team_trivia.py`, and `painting_with_a_twist.py`.
- `atlanta_city_meetings.py` now emits compact factual meeting descriptions using the structured board, meeting type, and location context instead of a longer schedule/location boilerplate builder.
- `team_trivia.py` now uses concise event-type-aware descriptions for trivia and music bingo instead of rebuilding schedule/location prose for every recurring row.
- `painting_with_a_twist.py` now stores cleaned detail-page description copy directly and no longer wraps it in time, age, and BYOB template prose.
- Added targeted regression coverage in `crawlers/tests/test_wave2_description_helpers.py` for the Atlanta City Meetings and Team Trivia description helpers.
- `python3 -m pytest crawlers/tests/test_wave2_description_helpers.py crawlers/tests/test_description_quality.py -q` passed with 15 tests green.
- File-level verification passed with `python3 -m py_compile` for the Wave 2 batch.
- `team-trivia` dry-run completed cleanly with 120 found, 16 new, and 104 updated in read-only mode.
- `atlanta-city-meetings` could not be dry-run because the source is currently inactive in the sources table, which is a source-state issue rather than a code/runtime failure.
- `painting-with-a-twist` dry-run started cleanly and processed live detail-page updates without import/runtime errors, but was not left running to full completion because of source volume.
- Batch 5 landed in code for `truist_park.py`, `lore_atlanta.py`, and `recurring_social_events.py`.
- `truist_park.py` now stores `NULL` descriptions for MLB schedule rows instead of manufacturing venue/date/ticket boilerplate around API-only game data.
- `lore_atlanta.py` now keeps the recurring base descriptions directly and no longer wraps them with schedule, location, and venue-explainer prose.
- `recurring_social_events.py` now keeps the curated template descriptions directly and no longer appends weekly schedule, price, and venue-channel boilerplate to every generated row.
- Added targeted regression coverage for the Lore and recurring-social description cleaners in `crawlers/tests/test_wave2_description_helpers.py`.
- `python3 -m pytest crawlers/tests/test_wave2_description_helpers.py crawlers/tests/test_recurring_social_events.py crawlers/tests/test_description_quality.py -q` passed with 22 tests green.
- File-level verification passed with `python3 -m py_compile` for the batch.
- `truist-park` dry-run completed cleanly with 78 found, 0 new, and 78 updated in read-only mode.
- `lore-atlanta` dry-run completed cleanly with 65 found, 1 new, and 64 updated in read-only mode.
- `atlanta-recurring-social` dry-run started cleanly with the corrected source slug and processed recurring suppression plus live read-only updates without import/runtime failures, but was not left running to full completion because of source volume.
- Batch 6 landed in code for `aa_atlanta.py`, `na_georgia.py`, and `big_peach_running.py`.
- `aa_atlanta.py` and `na_georgia.py` now emit compact factual support-meeting descriptions instead of recurring-schedule and source-listing boilerplate.
- `big_peach_running.py` now stores `NULL` descriptions for schedule-only group-run rows instead of manufacturing venue, amenities, and weather-update prose.
- Added targeted regression coverage for the AA and NA compact-description helpers in `crawlers/tests/test_wave2_description_helpers.py`.
- `python3 -m pytest crawlers/tests/test_wave2_description_helpers.py crawlers/tests/test_description_quality.py -q` passed with 19 tests green.
- File-level verification passed with `python3 -m py_compile` for the batch.
- `big-peach-running` dry-run completed cleanly with 64 found, 1 new, and 63 updated in read-only mode.
- `aa-atlanta` and `na-georgia` dry-runs started cleanly and processed live read-only updates without import/runtime failures, but were not left running to full completion because of source volume.
- During the AA, NA, Lore, and Big Peach dry-runs, Anthropic-backed classification requests returned low-credit errors; crawls continued, so this is an environment/runtime issue to track separately from the source remediation itself.
- LLM provider routing was hardened in `crawlers/classify.py` and `crawlers/llm_client.py` so classification no longer hardcodes Anthropic and the shared client can fall back to OpenAI on provider credit/quota/auth availability failures when both providers are configured.
- Added targeted coverage in `crawlers/tests/test_llm_client.py` for provider failover behavior.
- `python3 -m pytest crawlers/tests/test_llm_client.py crawlers/tests/test_classify_llm.py crawlers/tests/test_config.py -q` passed with 32 tests green.
- Verified this environment has `OPENAI_API_KEY` configured and no `ANTHROPIC_API_KEY`, so the shared provider path now aligns with the currently available runtime.
- Classification guidance in `crawlers/extract.py` now explicitly distinguishes booked music shows from nightlife/open-format social programming and warns against venue-type-driven misclassification.
- `crawlers/tag_inference.py` now only adds `live-music` when there is a show signal (ticketing, paid entry, or non-recurring format); recurring/open-format music rows receive `open-format` instead.
- Added targeted tag-inference coverage in `crawlers/tests/test_tag_inference.py` for live-music deflation behavior.
- `python3 -m pytest crawlers/tests/test_tag_inference.py crawlers/tests/test_classify_rules.py crawlers/tests/test_classify_pipeline.py -q` passed with 104 tests green.
- Added migration-backed `events.is_show` support in `database/migrations/20260330010001_event_is_show.sql` and `supabase/migrations/20260330010001_event_is_show.sql`, with matching `database/schema.sql` updates.
- `crawlers/db/events.py` now computes `is_show` in the insert pipeline using conservative category-plus-signal logic: theater and film always true, comedy true for real show contexts, music gated by booked-show signals or stage venues, and open-format tags explicitly false.
- `crawlers/db/client.py` now feature-detects `events.is_show` so additive rollout is safe before the migration is applied.
- Added targeted `is_show` coverage in `crawlers/tests/test_classify_pipeline.py`.
- `python3 -m pytest crawlers/tests/test_classify_pipeline.py crawlers/tests/test_classify_orchestrator.py crawlers/tests/test_show_signals.py crawlers/tests/test_tag_inference.py -q` passed with 90 tests green.
- Representative dry-run: `CLASSIFY_V2_ENABLED=1 python3 crawlers/main.py --source atlanta-recurring-social --dry-run`
  - started cleanly and exercised the updated classification path without runtime failures
  - confirmed the production database does not yet have `events.is_show`, and the new schema guard logged the missing-column warning instead of breaking the crawl
  - surfaced a real remaining classification edge case (`Live Band Karaoke at Metalsome Live Band Karaoke`), which should stay queued for the re-crawl/validation pass rather than block this schema-and-pipeline slice
- Audited the “major music venues are typed too generically” claim against the actual crawler code:
  - audited music-venue crawlers already use `music_venue` in their place definitions
  - the remaining issue appears to be live place data drift/backfill, not active source code, so it should be handled as data correction rather than another crawler rewrite
- `web/app/api/portals/[slug]/shows/route.ts` now accepts `?is_show=true` and retries without that filter if the deployed database has not yet received the new column, so the shows surface fails open during rollout instead of returning a 500.
- Added targeted route coverage in `web/app/api/portals/[slug]/shows/route.test.ts` for both the normal filter path and the missing-column fallback path.
- `cd web && npx vitest run 'app/api/portals/[slug]/shows/route.test.ts' 'app/api/programs/route.test.ts' 'app/api/portals/[slug]/sources/route.test.ts'` passed with 6 tests green.
- `cd web && npx tsc --noEmit` passed after the shows route change.
- Added `crawlers/scripts/backfill_is_show.py` so existing event rows can be remediated immediately after the migration is applied instead of waiting for crawl cadence.
- `python3 -m py_compile crawlers/scripts/backfill_is_show.py` passed.
- Applied `supabase/migrations/20260330010001_event_is_show.sql` to production with `python3 database/apply_targeted_migrations.py --versions 20260330010001`.
- Pre-apply verification:
  - `python3 database/apply_targeted_migrations.py --versions 20260330010001 --dry-run` showed the migration pending
  - `cd crawlers && python3 scripts/backfill_is_show.py --lookback-days 90 --preview 20` still exited with the expected missing-column message before the migration was applied
- Started the live 90-day `is_show` backfill with `cd crawlers && python3 scripts/backfill_is_show.py --apply --lookback-days 90 --preview 10`.
- Pre-apply dry-run for that same 90-day window scanned 36,280 active rows and identified 7,661 pending `is_show` updates.
- Live post-migration counts moved from all-zero `is_show` values to meaningful coverage while the backfill is running:
  - `music`: 0 -> 902
  - `theater`: 0 -> 430
  - `film`: 0 -> 75
  - `comedy`: 0 -> 55
  - `dance`: 0 -> 9
- Remaining `music` non-show inventory still points at the same top re-crawl targets, led by `atlanta-recurring-social`, `ticketmaster`, `city-winery-atlanta`, `lore-atlanta`, and `the-masquerade`.
- Attempted to start a production write re-crawl for `atlanta-recurring-social`, but an existing production write crawl lock was already active (`main.py --db-target production --allow-production-writes --skip-launch-maintenance`), so the re-crawl queue should wait for that writer to clear instead of forcing `--skip-run-lock`.
- Live `is_show` coverage continued climbing while the backfill ran. Mid-run production snapshot:
  - `music`: 1,812 / 2,397 upcoming active rows
  - `theater`: 888 / 988
  - `comedy`: 330 / 372
  - `film`: 248 / 1,295
  - `dance`: 41 / 598
- Post-backfill diagnostics show the remaining `music` non-shows split into two distinct classes:
  - intentional open-format/non-show rows, led by `atlanta-recurring-social` open mic and karaoke inventory
  - false negatives driven by bad upstream genres/tags on real shows, especially rows carrying `karaoke` or `open-mic` genres despite being ticketed one-off concerts
- Concrete false-negative sources sampled from production:
  - `boggs-social`
  - `smiths-olde-bar`
  - `eddies-attic`
  - `believe-music-hall`
  - `commune`
  - `hotel-clermont`
- This means the next Phase 2 write wave after the crawl lock clears should not be “re-crawl everything.” It should separate:
  - re-crawl / classification rewrite for `atlanta-recurring-social`
  - source-level genre/tag cleanup for the false-negative venue crawlers above
- Follow-up production diagnostics exposed a heuristic gap: generic `ticket_status` values like `free` and `tickets-available` were still being treated as strong show evidence, which kept recurring bar/nightlife rows marked as shows.
- `crawlers/db/events.py` was tightened so only stronger ticket-status states contribute to `is_show`; paid pricing, explicit performance tags, and actual ticket URLs still count as show signals.
- Added targeted regression coverage in `crawlers/tests/test_classify_pipeline.py` for:
  - recurring open-mic comedy staying `is_show=false`
  - recurring bar music with generic `tickets-available` staying `is_show=false`
  - paid recurring music shows still staying `is_show=true`
- `python3 -m py_compile crawlers/db/events.py crawlers/tests/test_classify_pipeline.py` passed.
- `python3 -m pytest crawlers/tests/test_classify_pipeline.py -q` passed with 13 tests green.
- Post-tightening dry-run for the same 90-day production window found a bounded correction batch of 163 rows, with the largest source buckets:
  - `Gwinnett County Public Library`: 29 `true -> false`
  - `Cobb County Public Library`: 28 `true -> false`
  - `Boggs Social & Supply`: 23 total (`19 false -> true`, `4 true -> false`)
  - `Star Community Bar`: 19 `true -> false`
  - `Sister Louisa's Church`: 14 `true -> false`
- Applied that second production remediation pass with `cd crawlers && python3 scripts/backfill_is_show.py --apply --lookback-days 90 --preview 30`.
- Post-apply verification:
  - `cd crawlers && python3 scripts/backfill_is_show.py --lookback-days 90 --preview 10` completed with `updates=0`
  - current live active counts are:
    - `music`: `2419 / 2891`
    - `theater`: `1128 / 1133`
    - `comedy`: `429 / 446`
    - `film`: `3514 / 3514`
    - `dance`: `75 / 639`
    - `nightlife`: `0 / 337`
- The production write crawl lock is still active (`main.py --db-target production --allow-production-writes --skip-launch-maintenance`), so the source re-crawl queue remains blocked behind that writer instead of being forced with `--skip-run-lock`.
- Fresh read-only validation with `CLASSIFY_V2_ENABLED=1 python3 crawlers/main.py --source atlanta-recurring-social --dry-run` confirmed:
  - recurring suppression is active for a broad overlap set of venue crawlers, so the source is already deleting many redundant recurring rows instead of blindly adding them
  - the `Live Band Karaoke at Metalsome Live Band Karaoke` classification disagreement originally reproduced, which identified a shared karaoke-classification bug rather than a source-only defect
- Root-cause fix landed in `crawlers/classify.py`: karaoke now classifies as the social-format category (`nightlife`) at the shared rules layer instead of being hardcoded into `music`.
- Added targeted rules coverage in `crawlers/tests/test_classify_rules.py` for:
  - karaoke at a bar preserving the `nightlife` classification
  - karaoke at a `music_venue` still resolving to `nightlife` because it remains a participatory social format, not a booked act
- `python3 -m py_compile crawlers/classify.py crawlers/tests/test_classify_rules.py` passed.
- `python3 -m pytest crawlers/tests/test_classify_rules.py crawlers/tests/test_classify_pipeline.py -q` passed with 48 tests green.
- Direct classifier verification for the reproduced edge case now returns:
  - title: `Live Band Karaoke at Metalsome Live Band Karaoke`
  - result: `category='nightlife'`, `genres=['karaoke']`, `confidence=0.88`, `source='rules'`
- Additional direct validation confirms `Emo Night Karaoke` now also resolves to `category='nightlife'`, `genres=['karaoke']`, `confidence=0.88`, `source='rules'`.
- Read-only queue validation for the next source wave found:
  - `lore-atlanta`: `Tossed Salad at Lore Atlanta` currently logs `old=nightlife new=theater`, which is the desired performance-oriented shape for drag programming
  - `the-masquerade`: karaoke titles are now covered by the shared classifier fix instead of needing a source-specific exception
- The next structural blocker surfaced after those validations: `_step_classify_v2` was still additive-only, so even correct v2 category decisions would not rewrite stored event categories during re-crawls.
- Added a feature-flagged rewrite path in `crawlers/db/events.py`:
  - `CLASSIFY_V2_REWRITE_CATEGORY=1` now lets `_step_classify_v2` replace stale source categories for known noisy legacy/current buckets (`music`, `nightlife`, `community`, `other`, `family`, `learning`, `support_group`, `exercise`, `recreation`, `wellness`)
  - `smart_update_existing_event()` now applies the same rewrite rule for existing rows when the incoming event carries `classification_prompt_version`
- Added focused rewrite-path coverage:
  - `crawlers/tests/test_classify_pipeline.py::test_step_rewrites_category_when_rewrite_flag_enabled`
  - `crawlers/tests/test_db.py::TestSmartUpdateExistingEvent::test_rewrites_existing_category_from_v2_when_flag_enabled`
  - `crawlers/tests/test_db.py::TestSmartUpdateExistingEvent::test_does_not_rewrite_existing_category_from_v2_without_flag`
- Verification:
  - `python3 -m py_compile crawlers/db/events.py crawlers/tests/test_classify_pipeline.py crawlers/tests/test_db.py`
  - `python3 -m pytest crawlers/tests/test_classify_pipeline.py::test_step_rewrites_category_when_rewrite_flag_enabled crawlers/tests/test_db.py::TestSmartUpdateExistingEvent::test_rewrites_existing_category_from_v2_when_flag_enabled crawlers/tests/test_db.py::TestSmartUpdateExistingEvent::test_does_not_rewrite_existing_category_from_v2_without_flag -q` -> `3 passed`
  - `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1 python3 crawlers/main.py --source lore-atlanta --dry-run` started cleanly without import/runtime failure
- Operationally, the next production source-write wave should use both flags:
  - `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1`
  - first target remains `atlanta-recurring-social` once the crawl lock clears
- Added `crawlers/scripts/backfill_classify_v2_categories.py` as a dry-run/apply remediation script for category drift using the shared v2 classifier and the same rewrite gating logic as the crawler write path.
- Script verification:
  - `python3 -m py_compile crawlers/scripts/backfill_classify_v2_categories.py`
  - the full Supabase-backed 90-day preview is functional but slower than interactive use on large sources, so queue planning used direct DB reads plus the shared rules classifier for faster estimation
- Post-fix queue sizing using the confidence-gated rewrite rules:
  - `atlanta-recurring-social` 30-day active window: `1187` rows scanned, `155` high-confidence rule rewrites
    - representative rewrites: `music -> nightlife` for karaoke, `nightlife -> games` for trivia/bingo, `nightlife -> words` for poetry/open-mic slam hybrids
    - low-confidence `nightlife -> music` open-mic moves are now blocked by the `0.8` rewrite threshold and do not auto-apply
  - `lore-atlanta` 90-day active window: `123` rows scanned, `28` high-confidence rule rewrites
    - mostly `music -> nightlife` karaoke rows plus `Drag Bingo` → `games`
  - `boggs-social` 90-day active window: `42` rows scanned, `5` high-confidence rule rewrites
    - all sampled rows are `Karaoke Night w/ Music Mike` moving `music -> nightlife`
- Updated post-lock write order:
  1. `atlanta-recurring-social`
  2. `lore-atlanta`
  3. `boggs-social`
- Added focused library/community rules coverage in `crawlers/tests/test_classify_rules.py` for:
  - `Baby Time` -> `words`
  - `Reading Buddies` -> `words`
  - `Meet Up for Adults with Disabilities` -> `support`
  - `Language Learning | Conversations in English` -> `education`
  - `Beginner's Ukulele Series of Classes` -> `workshops`
- Verification:
  - `python3 -m py_compile crawlers/classify.py crawlers/tests/test_classify_rules.py`
  - `python3 -m pytest crawlers/tests/test_classify_rules.py -q` -> `40 passed`
- Secondary rules-only queue sizing on active library/community inventory now shows another meaningful remediation wave behind the nightlife-focused write pass:
  - `gwinnett-library` 30-day active window: `1120` rows scanned, `34` high-confidence rule rewrites
    - representative rewrites: `music -> words` for `Literacy | Reading Buddies`, `family -> words` for storytime rows
  - `cobb-library` 30-day active window: `1073` rows scanned, `28` high-confidence rule rewrites
    - representative rewrites: `music -> words` for `Baby Time`, `music -> workshops` for ukulele classes, `music -> support` for disability-support meetups
  - `fulton-library` 30-day active window: `571` rows scanned, `5` high-confidence rule rewrites
    - representative rewrites: `family -> words` for storytime/poetry rows, `support_group -> support` for caregiver support, `learning -> fitness` for `Chair Yoga`
  - `dekalb-library` 30-day active window: `865` rows scanned, `1` high-confidence rule rewrite
    - representative rewrite: `music -> dance` for `Line Dancing with Kim Armstrong`
- That gives Phase 2 a clear second rewrite queue after the current nightlife-heavy pass:
  1. `atlanta-recurring-social`
  2. `lore-atlanta`
  3. `boggs-social`
  4. `gwinnett-library`
  5. `cobb-library`
  6. `fulton-library`
- Read-only validation of `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1 python3 main.py --source atlanta-recurring-social --dry-run` stayed operationally clean, but it surfaced one remaining classifier risk: multi-format recurring open mics like `Open Mic at Joe's Coffeehouse` were falling through to the LLM and getting overconfident `comedy` rewrites.
- Shared classifier hardening landed in `crawlers/classify.py`:
  - generic `open mic` titles that also advertise `poetry`/`spoken word` in the description now resolve deterministically to `words`
  - generic `open mic` titles with explicit `stand-up`/`improv` cues now resolve deterministically to `comedy`
  - both cases now stay above the LLM threshold, so ambiguous recurring formats do not get escalated into noisy model-driven rewrites
- Added focused coverage:
  - `crawlers/tests/test_classify_rules.py` now covers literary and comedy flavored open mics
  - `crawlers/tests/test_classify_pipeline.py::test_classify_event_skips_llm_for_multiformat_open_mic` proves the Joe's-style case no longer calls the LLM fallback
- Verification:
  - `python3 -m py_compile crawlers/classify.py crawlers/tests/test_classify_rules.py crawlers/tests/test_classify_pipeline.py`
  - `python3 -m pytest crawlers/tests/test_classify_rules.py crawlers/tests/test_classify_pipeline.py -q` -> `58 passed`

### 2026-03-31

- Phase 2 moved from code-only remediation into live production rollout.
- Production rewrite waves completed successfully for:
  - `atlanta-recurring-social`: `628 found / 0 new / 591 updated`
  - `lore-atlanta`: `65 found / 1 new / 64 updated`
  - `boggs-social`: `46 found / 1 new / 45 updated`
- The rollout surfaced and fixed real production blockers rather than crawler-only defects:
  - recurring series matching was repaired in `crawlers/series.py` after the `series.place_id` mismatch surfaced
  - stale adult-event trigger functions were fixed with new database and Supabase migrations after production inserts failed on `NEW.venue_id`
  - classifier duration output was normalized in `crawlers/db/events.py` so new rows satisfy the production duration constraint
- The active production queue is now the library and community tranche:
  - `gwinnett-library` in flight
  - `cobb-library`, `fulton-library`, and `dekalb-library` next
- Remaining false-negative show and music venue cleanup should follow that tranche instead of being mixed into the library queue.
- `database/schema.sql` remains behind the live place and venue rename state and should be reconciled separately before broader Phase 4 and Phase 5 work relies on it as canonical.
- Library and community rollout update:
  - `gwinnett-library` completed successfully with `1028 found / 9 new / 1019 updated`
  - latest successful runs already exist for `cobb-library`, `fulton-library`, and `dekalb-library`, but live spot checks show some active rows still carrying stale categories
  - examples include `Reading Buddies` still stored as `music` on some upcoming Gwinnett rows, `Meet Up for Adults with Disabilities` still stored as `music` on some upcoming Cobb rows, and storytime or poetry rows still stored as `family` on some upcoming Fulton rows
  - `dekalb-library` also had two stale `crawl_logs` rows left in `running` status; those were cleaned up
  - the shared classifier was tightened so `Tummy Time` now deterministically stays in `family` instead of falling through to the LLM and drifting toward `support`
  - focused classifier verification passed after that change (`65 passed` across the targeted rules and pipeline suites)
  - a generic category-backfill attempt for the library tranche was abandoned because it was too slow and too opaque operationally for this slice
  - the remediation path switched back to source reruns with `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1`; `fulton-library` is now actively re-running under that mode
  - a deeper shared-path defect was then identified in the four library crawlers:
    - `cobb_library.py`, `gwinnett_library.py`, `fulton_library.py`, and `dekalb_library.py` were bypassing `insert_event()` on existing rows by calling `smart_update_existing_event()` directly after `find_event_by_hash(...)`
    - that meant many existing library rows never went through `_step_classify_v2`, even when reruns touched them
  - all four library crawlers were patched so existing rows now flow through the shared `insert_event()` pipeline; `find_event_by_hash(...)` remains only as bookkeeping for update/new counters
  - focused verification passed with `python3 -m py_compile` across the four patched library crawlers
  - one more shared rewrite defect surfaced immediately after that fix:
    - existing-row smart updates could rewrite `category_id`, but they were not persisting `classification_prompt_version` or the non-empty v2 derived fields on those same rows
    - the live symptom was rows getting touched while `classification_prompt_version` remained `NULL`, making the rerun look half-applied
  - `crawlers/db/events.py` was patched so existing-row rewrites now persist `classification_prompt_version` plus non-empty v2 derived fields (`duration`, `cost_tier`, `skill_level`, `booking_required`, `indoor_outdoor`, `significance`, `significance_signals`, `audience_tags`) when appropriate
  - the rewriteable legacy source-category set was widened to include `education` and `support`, which is required for stale library rows like `Baby Time`, `Reading Buddies`, and disability-support programs to move out of legacy buckets
  - targeted regression coverage was added in `crawlers/tests/test_db.py`, and focused verification passed with `68 passed`
  - the pre-patch Cobb rerun was cancelled and recorded in `crawl_logs`
  - a fresh four-source library batch was launched on the corrected process image:
    - `fulton-library`
    - `dekalb-library`
    - `cobb-library`
    - `gwinnett-library`
  - the refreshed batch is still in flight as of this log entry
  - early live Fulton logs already confirm the corrected path is active in production:
    - existing rows now persist `classification_prompt_version` and v2 derived fields during smart updates
    - update shapes now include fields like `classification_prompt_version`, `duration`, `skill_level`, `booking_required`, `indoor_outdoor`, `significance`, and `audience_tags` instead of only timestamp churn
  - the refreshed batch has advanced:
    - `fulton-library` completed successfully with `410 found / 0 new / 402 updated`
    - `dekalb-library` is the active long-running leg
    - `cobb-library` and `gwinnett-library` remain queued behind it
  - shared rewrite hardening continued while `dekalb-library` was running so the queued Cobb/Gwinnett legs can pick up the fixes without another restart:
    - the rewriteable legacy source-category set was widened again to include `art`, which is required for stale `Reading Buddies`-style rows to move out of bad art defaults
    - targeted `art -> words` regression coverage was added in `crawlers/tests/test_db.py`
    - focused DB verification passed with `69 passed`
  - a deterministic library-program rule batch landed in `crawlers/classify.py` for titles that were still leaking to the LLM in live runs:
    - `Nintendo Switch` and `Chess Club` -> `games`
    - `Kids Sewing`, `Origami`, `Papermaking`, and `Soap Making` -> `workshops`
    - `Social Work Intern` -> `support`
    - `Filmmakers Club` -> `film`
    - `Homework Help` -> `education`
    - `Read to a Pet` -> `words`
  - a second narrow rule slice landed immediately after live DeKalb validation exposed more obvious library formats still leaking to the LLM:
    - `Toddler Time` and `StoryWalk` -> `words`
    - `Friday Movies` -> `film`
    - `GED Study Time` -> `education`
    - `Sensory Play` -> `family`
    - `Blood Drive` -> `volunteer`
    - `Take & Make`, `Mah Jongg`, and `Cricut Creations` now classify deterministically in the expected craft/game buckets
  - that rules batch exposed a taxonomy mismatch:
    - `tags.py` already treated `chess` and `video-games` as valid game genres, but `genre_normalize.py` was stripping them from `GAMES_GENRES`
    - `GAMES_GENRES` now includes both slugs, so classifier output, genre validation, and tag vocabulary agree
  - focused classifier verification passed after the two rule batches, ending at `63 passed` in `crawlers/tests/test_classify_rules.py`
  - live Cobb validation then exposed a shared LLM normalization defect:
    - some library rows were returning the literal string `"null"` for `cost_tier`, which then violated `events_cost_tier_check` during smart updates
    - `crawlers/classify.py` now collapses null-like string sentinels across the LLM enrichment fields before they reach the DB write path
    - targeted regression coverage landed in `crawlers/tests/test_classify_llm.py`
    - the exact failing craft-kit title now reproduces locally with `cost_tier=None` instead of `cost_tier='null'`
    - focused verification passed after that fix with `149 passed` across `test_classify_llm.py`, `test_classify_rules.py`, and `test_db.py`
  - another deterministic Cobb-driven rule batch landed immediately after that normalization fix:
    - `Sensory Playtime` -> `family`
    - `Book-A-Librarian Tech Help` and `Computer Basics` -> `education`
    - `Creative Writing Workshop`, `Clothing Repair Clinic`, and `Shell Charm Bracelet` -> `workshops`
    - focused rules verification passed after the new batch with `76 passed` in `crawlers/tests/test_classify_rules.py`
  - one more shared rewrite-gate fix landed after live validation showed `Book-A-Librarian Tech Help` rows still keeping stale `words` categories:
    - the rewriteable legacy source-category set now also includes `words`, so existing rows can move from stale `words` into stronger v2 categories like `education`
    - targeted DB regression coverage landed for `words -> education` rewrites
  - another deterministic library rule slice then landed directly from live Cobb misses:
    - `Pokémon Club` -> `games`
    - `Crafternoon` -> `workshops`
    - focused verification passed after that batch with `148 passed` across `test_classify_rules.py` and `test_db.py`
  - the currently running Cobb production process is still the pre-patch image, so a clean follow-on rerun has been queued automatically:
    - wait for the current `cobb-library` process to exit
    - rerun `cobb-library` with `CLASSIFY_V2_ENABLED=1 CLASSIFY_V2_REWRITE_CATEGORY=1` on the corrected code
    - then rerun `gwinnett-library` with the same flags
