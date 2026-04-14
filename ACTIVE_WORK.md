# Active Work — Current Sessions Only

This file tracks the live Codex sessions in the workspace. Old planning splits
and stale claims were removed because they no longer reflect the actual active
workstreams.

**How to use:**
- Check this file before editing shared areas.
- Only list live sessions and their current claimed paths.
- If you need a claimed path, coordinate with the user first.
- For new database migrations, always `ls database/migrations/ | tail -5`.

---

## Active Sessions

### Session 1 — Crawler Strategy And Profile-Contract Ops
**Scope:** strategy, operational reporting, rollout tooling, and profile-contract execution support.

**Claimed paths:**
- `ACTIVE_WORK.md`
- `crawlers/CRAWLER_STRATEGY.md`
- `crawlers/source_goals.py`
- `crawlers/pipeline/models.py`
- `crawlers/scripts/goal_alignment_queue.py`
- `crawlers/scripts/profile_contract_*.py`
- `crawlers/scripts/profile_goal_patch_*.py`
- `crawlers/scripts/profile_schema_drift_*.py`
- `crawlers/scripts/source_activation_gate.py`
- `crawlers/scripts/weekly_ops_queue.py`
- `crawlers/scripts/weekly_source_review.py`
- `crawlers/tests/test_goal_alignment_queue.py`
- `crawlers/tests/test_profile_contract_*.py`
- `crawlers/tests/test_profile_goal_patch_*.py`
- `crawlers/tests/test_profile_schema_drift_*.py`
- `crawlers/tests/test_source_activation_gate.py`
- `crawlers/tests/test_weekly_ops_queue.py`
- `crawlers/tests/test_weekly_source_review.py`
- `crawlers/reports/profile_*`
- `crawlers/reports/weekly_*`
- `crawlers/reports/source_activation_gate_*`
- `crawlers/reports/goal_alignment_queue_*`

### Session 2 — Product/Data Workstream
**Scope:** crawler data quality, extraction/classification, destination/event quality, and current web/API product work.

**Claimed paths:**
- `crawlers/classify.py`
- `crawlers/db/`
- `crawlers/description_quality.py`
- `crawlers/extract.py`
- `crawlers/llm_client.py`
- `crawlers/series.py`
- `crawlers/tag_inference.py`
- `crawlers/tags.py`
- `crawlers/sources/`
- `crawlers/scripts/README_DATA_QUALITY.md`
- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`
- `crawlers/scripts/enrich_eventbrite_descriptions.py`
- `crawlers/scripts/enrich_non_eventbrite_descriptions.py`
- `crawlers/scripts/backfill_classify_v2_categories.py`
- `crawlers/scripts/backfill_is_show.py`
- `crawlers/tests/test_classify_pipeline.py`
- `crawlers/tests/test_classify_rules.py`
- `crawlers/tests/test_cooks_warehouse.py`
- `crawlers/tests/test_db.py`
- `crawlers/tests/test_llm_client.py`
- `crawlers/tests/test_series_venue_scoping.py`
- `crawlers/tests/test_source_goals.py`
- `crawlers/tests/test_tag_inference.py`
- `crawlers/tests/test_wave2_description_helpers.py`
- `database/schema.sql`
- `database/migrations/20260330010001_event_is_show.sql`
- `supabase/migrations/20260330010001_event_is_show.sql`
- `web/app/api/goblinday/sessions/[id]/route.ts`
- `web/app/api/portals/[slug]/shows/route.ts`
- `web/app/api/portals/[slug]/shows/route.test.ts`
- `web/components/goblin/`
- `web/scripts/enrich-log-movies.mjs`

---

### Session 3 — Search Elevation (Phase 0)
**Scope:** unified search rebuild — three-layer architecture (Retrieval / Ranking / Presentation), single `search_unified` SQL function, `UnifiedSearchShell` component, `search_events` observability, delete legacy `lib/unified-search.ts`.

**Worktree:** `../LostCity-search-phase-0` on branch `search-elevation-phase-0`

**Plan:** `docs/superpowers/plans/2026-04-13-search-elevation-phase-0.md`

**Claimed paths:**
- `web/lib/search/` (new)
- `web/lib/unified-search.ts` (scheduled for deletion)
- `web/lib/shared-cache.ts` (read-only, verified only)
- `web/lib/rate-limit.ts` (read-only in Phase 0)
- `web/app/[portal]/api/search/unified/` (new)
- `web/app/api/user/recent-searches/` (new)
- `web/app/api/search/` (scheduled for deletion)
- `web/components/search/` (new + scheduled deletions)
- `web/components/HeaderSearchButton.tsx` (scheduled for deletion)
- `web/components/find/FindSearchInput.tsx` (scheduled for deletion)
- `web/components/find/LaneFilterInput.tsx` (new)
- `web/components/find/ExploreHome.tsx` (scheduled for deletion)
- `web/components/explore-platform/ExploreShellClient.tsx` (modify)
- `web/components/explore-platform/ExploreSearchHero.tsx` (scheduled for deletion)
- `web/components/explore-platform/ExploreSearchResults.tsx` (scheduled for deletion)
- `web/components/headers/*.tsx` (modify — HeaderSearchButton → LaunchButton)
- `web/components/find/EventsFinder.tsx` (modify — FindSearchInput → LaneFilterInput)
- `web/components/find/PlaceFilterBar.tsx` (modify — FindSearchInput → LaneFilterInput)
- `web/app/[portal]/layout.tsx` (modify — mount overlay shell)
- `web/lib/hooks/useVisualViewportHeight.ts` (new)
- `web/next.config.ts` (modify — add Referrer-Policy header)
- `web/eslint.config.mjs` (modify — register custom rule)
- `web/tools/eslint-rules/` (new)
- `database/migrations/604_search_log_salt.sql` (new)
- `database/migrations/605_search_events.sql` (new)
- `database/migrations/606_user_recent_searches.sql` (new)
- `database/migrations/607_search_unified.sql` (new)
- `database/tests/` (new — pgTAP infrastructure)
- `supabase/migrations/*search_log_salt*.sql` (new)
- `supabase/migrations/*search_events*.sql` (new)
- `supabase/migrations/*user_recent_searches*.sql` (new)
- `supabase/migrations/*search_unified*.sql` (new)

---

## Shared Conflict Zones

Coordinate before touching these shared areas:

- `database/migrations/*`
- `database/schema.sql`
- `crawlers/source_goals.py`
- `crawlers/pipeline/models.py`
- `crawlers/tests/`
- `ACTIVE_WORK.md`
