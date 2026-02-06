# Crawler Migration Plan (v3)

This plan describes the phased migration from legacy crawlers to the new architecture described in `ARCHITECTURE.md`.

## Phase 0: Lock Spec + Harness
- Finalize the v3 architecture spec.
- Add validation harness for snapshot + compare.
- Define quality gates for migration (coverage + accuracy).

## Phase 1: Pilot Sources
Target sources:
- The Earl
- Ticketmaster
- Dad’s Garage

Steps:
1. Run legacy crawlers and capture a baseline snapshot.
2. Run v3 pipeline for the same sources.
3. Compare snapshots and spot-check 10-20 events.
4. Iterate on profiles and extraction until gates are met.

Quality gates (minimum):
- ticket_url coverage >= 85%
- image coverage >= 75%
- description coverage >= 80%
- artist accuracy >= 80% (sample)

## Phase 2: Data Model Upgrades
Add or confirm the following tables/columns:
- `event_images` table
- `event_links` table
- `events.field_provenance` JSONB
- `events.field_confidence` JSONB
- `events.extraction_version` TEXT
- `event_artists` adds `billing_order`, `role`, `is_headliner`

Migration approach:
- Add new tables/columns without removing old fields.
- Keep `events.image_url` as primary display image for compatibility.
- Backfill where feasible, otherwise let new runs populate.

## Phase 3: Expand Source Coverage
- Convert sources in batches by category or city.
- Require each source to pass quality gates before disabling legacy.
- Mark LLM-required sources explicitly and review separately.

## Phase 4: Cutover and Cleanup
- Disable legacy crawlers for migrated sources.
- Remove or archive unused modules.
- Monitor coverage weekly and track regressions.

## Rollout Controls
- Daily runs only; no real-time requirements.
- LLM usage only on fallback or required sources.
- Track coverage trends by source after every run.

