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

## Shared Conflict Zones

Coordinate before touching these shared areas:

- `database/migrations/*`
- `database/schema.sql`
- `crawlers/source_goals.py`
- `crawlers/pipeline/models.py`
- `crawlers/tests/`
- `ACTIVE_WORK.md`
