# Crawler Strategy Refactor — Execution Plan for Claude Code

## Objective
- Align all source profiles with the new integration-method strategy and sync that into Supabase.
- Remove “unknown” method ambiguity and make profiles consistent with the pipeline’s execution logic.
- Produce a sanity-check report and a small sampling QA run before we commit to a full re-crawl.

## Context Snapshot
- Integration methods have been inferred for all profiles using `crawlers/scripts/infer_integration_methods_from_code.py`.
- Current method distribution in profiles:
  - `aggregator`: 35
  - `api`: 4
  - `feed`: 3
  - `html`: 222
  - `jsonld_only`: 2
  - `llm_crawler`: 68
  - `llm_extraction`: 2
  - `playwright`: 190
- Sanity check found 298 method/config mismatches, mostly because profiles still reflect legacy list-based crawling.
- Key mismatch counts:
  - `playwright` with `render_js=false`: 188
  - `llm_crawler` with `discovery.type!=html`: 66
  - `aggregator` with `discovery.type!=api`: 33
  - `api` with `discovery.type!=api`: 4
  - `feed` with `discovery.type!=feed`: 3
  - `jsonld_only` without `detail.jsonld_only=true`: 2
  - `llm_extraction` without `detail.use_llm=true`: 2

## Priority Order (Strategy)
1. API if it exists
2. Structured feed if it exists
3. LLM-powered crawler
4. LLM extraction
5. Browser automation
6. User submissions

## Phase 0 — Preflight
1. Ensure dependencies are installed.
   - `cd crawlers && pip install -r requirements.txt`
2. Verify migration exists and is applied (integration method column).
   - Migration file: `database/migrations/125_sources_integration_method.sql`
3. Confirm `sources.integration_method` column exists in Supabase.

## Phase 1 — Sync Integration Methods to Supabase
1. If `crawlers/tmp/infer_report.json` exists, use it. Otherwise regenerate it.
   - `python scripts/infer_integration_methods_from_code.py --apply --output tmp/infer_report.json`
2. Sync integration methods to Supabase.
   - `python scripts/sync_integration_methods.py --apply`
3. Verify a spot check in Supabase.
   - Query a few sources by slug and confirm `integration_method` matches profiles.

## Phase 2 — Align Profiles to Integration Method
Implement a script to normalize profile configs so pipeline behavior matches the method.
- Suggested path: `crawlers/scripts/align_profiles_to_integration_method.py`

### Rules to Apply
1. `aggregator`: ensure `discovery.type = "api"` and `discovery.api.adapter = "ticketmaster"` or `"eventbrite"`.
   - If adapter missing and URL indicates which, set it.
   - If unclear, add to a “manual review” report.
2. `api`: ensure `discovery.type = "api"` and retain adapter if present.
3. `feed`: ensure `discovery.type = "feed"`.
   - Set `discovery.feed.format` to `"ics"` if URL ends in `.ics`, else `"auto"`.
4. `playwright`: set `discovery.fetch.render_js = true`.
   - If `detail.enabled = true`, set `detail.fetch.render_js = true` only if it looks required.
   - Default to just discovery-side render unless the existing profile already expects detail render.
5. `llm_crawler`: set `discovery.type = "html"`.
   - Ensure LLM crawler config is in place if required for your pipeline.
6. `llm_extraction`: set `detail.use_llm = true`.
7. `jsonld_only`: set `detail.jsonld_only = true` and keep `detail.use_jsonld = true`.
8. `html`: keep `discovery.type` as list-based (default), do not turn on JS unless explicitly required.

### Output Requirements
1. Script should produce a JSON report of changes and any manual-review items.
   - Path: `crawlers/tmp/align_profile_report.json`
2. Script should support `--dry-run` and `--apply`.

## Phase 3 — Sanity Checks
Run a mismatches report and confirm it’s close to zero (or fully explained).

Suggested check script:
- Use the current mismatch script or add a new `scripts/check_profile_consistency.py`.
- Require output count and sample mismatches.

Success threshold:
- All config mismatches resolved except those explicitly flagged for manual review.

## Phase 4 — Limited QA Crawl
Run dry-run for a representative sample to validate that each integration method actually works.

1. 5 sources per integration method.
2. Use `pipeline_main.py` with `--dry-run --limit 10` per source.
3. Collect outputs in a report file with success/fail and sample fields.

## Phase 5 — Update Source Health Panel
1. Ensure the UI already uses `integration_method` in filters and summary cards.
   - Files:
     - `web/app/api/admin/sources/health/route.ts`
     - `web/app/admin/sources/page.tsx`
     - `web/components/admin/SourceFilters.tsx`
2. Verify the health panel displays counts by method and filter works with Supabase data.

## Deliverables
1. `crawlers/scripts/align_profiles_to_integration_method.py`
2. `crawlers/tmp/align_profile_report.json`
3. `crawlers/tmp/mismatch_report.json`
4. `crawlers/tmp/qa_dry_run_report.json`
5. Supabase `sources.integration_method` fully populated.

## Acceptance Criteria
1. 0 “unknown” integration methods in profiles and Supabase.
2. 0 profile mismatches after alignment, or only manual-review exceptions.
3. At least one dry-run per method succeeds and captures key event fields.
4. Source health panel shows method distribution and can filter.

## Notes
- If `sync_integration_methods.py` fails due to YAML dependency issues, ensure `pyyaml` is installed from `requirements.txt`.
- Keep alignment changes mechanical and reversible, minimize manual edits.
