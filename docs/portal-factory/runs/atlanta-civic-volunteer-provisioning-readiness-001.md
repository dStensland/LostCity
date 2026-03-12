# Atlanta Civic + Volunteer Provisioning Readiness 001

- Date: 2026-03-07
- Operator: Codex
- Portal candidate slug: `helpatl`
- Scope: pre-execution evaluation only (no writes performed)

## What We Evaluated

1. Process maturity for repeatable provisioning.
2. Current platform capability coverage (portal, channels, groups, analytics).
3. Current civic/volunteer content pack integrity for Atlanta.
4. Readiness to execute provisioning without manual patching.

## Hard Gates

| Gate | Status | Evidence | Outcome |
|---|---|---|---|
| G1 Data pack integrity | `fail` | New validator now enforces "crawlable (module OR profile) + active DB source row", and current civic manifest fails DB active-state check for key slugs (`atlanta-city-meetings`, `fulton-county-meetings`, `dekalb-county-meetings`, `united-way-atlanta`, `atlanta-community-food-bank`, `atlanta-toolbank`). | Block execution until source activation/state is corrected and validator passes |
| G2 Seed/rule integrity | `fail` | `school-board-watch` is currently tag-only fallback (`tag=school-board`) with no dedicated school-board source family | Coverage risk is too high for target use case |
| G3 Process idempotency | `fail` | Provisioning scripts are one-off (`create-atlanta-film-portal.ts`, `create-atlanta-families-portal.ts`, `create-marietta-portal.ts`); no generic civic provisioning manifest/script | Repeatability not yet airtight |
| G4 Federation integrity | `pass` | Source federation tables and materialized access path are in place (`database/migrations/035_source_federation.sql`) | Foundation is ready |
| G5 Match readiness | `pass` | Interest channel schema, matching pipeline, cron refresh, and per-portal cadence controls exist (`web/lib/interest-channel-matches.ts`, `web/app/api/cron/interest-channel-matches/route.ts`, `web/lib/interest-channel-refresh-schedule.ts`) | Matching infrastructure is ready |
| G6 Surface readiness | `pass` | Consumer groups UI + portal groups page + admin channel management exist (`web/components/channels/PortalGroupsClient.tsx`, `web/app/[portal]/groups/page.tsx`, `web/app/[portal]/admin/channels/page.tsx`) | Consumer/admin surfaces are available |
| G7 Observability readiness | `pass` | Channel health + analytics endpoints exist (`web/app/api/admin/portals/[id]/channels/route.ts`, `web/app/api/admin/portals/[id]/channels/analytics/route.ts`) | Post-launch monitoring path exists |

## Soft-Gate Snapshot

| Area | Status | Notes |
|---|---|---|
| Launch content density | `unknown` | Requires staging/production query run; not executed in this pass |
| Channel coverage ratio | `unknown` | Requires match materialization run and event sample audit |
| Empty subscribed channels risk | `unknown` | Requires live subscription + match telemetry |
| County/school-board depth | `fail` | School-board coverage still placeholder; county coverage incomplete due missing source profile |

## Current Capability Summary

1. Portal provisioning primitives exist (admin portal create/update, source subscriptions, federation refresh).
2. Interest channel platform primitives exist (CRUD, rules, subscriptions, event-channel matching, cadence control).
3. Consumer follow/join group experience exists and is wired to analytics.
4. Admin health and adoption telemetry exist for operational tuning.

## Current Content Gaps (Blocking)

1. Multiple civic/volunteer source rows are currently inactive in DB for the target pack.
2. School-board channel is currently heuristic (tag fallback) instead of structured source-backed coverage.
3. Source-pack integrity gate exists now, but the target manifest is currently failing it.

## Opportunities (High Leverage)

1. Add a civic source-pack validator step that fails when seeded source slugs are non-crawlable.
2. Create dedicated school-board source family (Atlanta Public Schools + county boards) before activation.
3. Introduce a single reusable provisioning manifest/script for all portals instead of vertical-specific one-offs.
4. Add minimum launch thresholds for `channels_with_subscribers_but_no_matches` and `% scoped events matched`.

## Decision

- Decision: `no-go` for provisioning execution
- Why: critical data pack and repeatability gates are failing
- Earliest re-evaluation: after missing source coverage and generic provisioning manifest are in place
