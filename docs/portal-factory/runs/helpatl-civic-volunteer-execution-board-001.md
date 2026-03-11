# HelpATL Civic + Volunteer Execution Board 001

- Date: 2026-03-08
- Scope: unified roadmap for civic action + volunteer engagement capabilities
- Surfaces: `helpatl` launch first, reusable across future portals
- Sources:
  - `prds/029-civic-action-capability.md`
  - `prds/030-volunteer-engagement-capability.md`
  - `docs/portal-factory/runs/helpatl-vs-atlanta-ux-implementation-checklist-001.md`
  - `docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json`

## 1) Current State (as of 2026-03-08)

Done:
1. HelpATL portal exists and is active.
2. Groups/join flow and channel matching stack are implemented.
3. Action-first top fold and Upcoming Deadlines are implemented.
4. Impact Snapshot module is implemented.
5. Network-feed parent inheritance is implemented (`helpatl` can reuse Atlanta feed when local feed is empty).

In progress:
1. Admin civic quality rail specialization for HelpATL.

Open blockers:
1. Civic source federation gaps (some subscribed sources not accessible via `portal_source_access`).
2. Several civic/volunteer sources still produce zero upcoming events.
3. `ENABLE_INTEREST_CHANNELS_V1` must be enabled in launch environment for channels/snapshot features.

## 2) Owners

1. Product Owner: defines acceptance and launch gates.
2. Platform Eng Owner: API contracts, portal scope/attribution, feed surfaces.
3. Data Eng Owner: source activation, sharing rules, crawl health, freshness.
4. Frontend Owner: HelpATL UX modules, detail trust panel, admin quality rail UX.
5. Ops/QA Owner: readiness checks, verification matrix, go/no-go evidence pack.

## 3) Phase Plan

## Phase A: Federation + Readiness Hardening
- Target window: 2026-03-09 to 2026-03-12
- Objective: remove data-path blockers so civic/volunteer features are trustworthy.

Work items:
1. Enable `ENABLE_INTEREST_CHANNELS_V1=true` in target environment.
2. Repair HelpATL source access:
   - ensure sharing rules exist for all subscribed civic/volunteer sources
   - ensure source rows are active where intended
   - refresh `portal_source_access`
3. Validate network-feed inheritance:
   - run `npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta`
4. Re-run source-pack validation against manifest:
   - `npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json`

Phase A Gate (must pass):
1. `portal_source_access` includes all intended civic/volunteer subscriptions (or explicit documented exceptions).
2. Source-pack validator passes with no missing/inactive critical slugs.
3. Interest channel APIs respond (not disabled) in launch environment.

## Phase B: Civic Action v1 Completion
- Target window: 2026-03-13 to 2026-03-20
- Objective: finish civic workflows from feed to detail to admin operations.

Work items:
1. Add event detail trust/action panel:
   - source name/link
   - freshness timestamp
   - action window/deadline context where available
2. Ship admin civic quality rail in portal channels admin:
   - stale channels
   - zero-match channels
   - subscribers-with-no-matches
   - school-board/source-backed coverage status
3. Add `GET /api/admin/portals/[id]/channels/quality` (if existing health payload is insufficient).
4. Add/extend tests for civic reason semantics + detail trust panel rendering.

Phase B Gate (must pass):
1. HelpATL civic detail trust context is visible for target events.
2. Admin can identify stale/empty civic channels without SQL.
3. Contract tests pass:
   - `npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`

## Phase C: Volunteer Engagement v1 (Platform-first)
- Target window: 2026-03-21 to 2026-04-04
- Objective: move from volunteer listing to structured matching + conversion tracking.

Work items:
1. Schema + migrations for volunteer structures:
   - `volunteer_opportunities`
   - `user_volunteer_profile`
   - `volunteer_engagements`
2. Consumer APIs:
   - `GET /api/portals/[slug]/volunteer/opportunities`
   - `POST /api/volunteer/engagements`
   - `PATCH /api/volunteer/engagements/[id]`
   - `GET /api/me/volunteer-impact`
3. Feed modules:
   - urgent needs lane
   - commitment ladder labels (`easy start`, `ongoing`, `lead`)
4. Admin quality:
   - stale opportunities
   - capacity mismatch
   - zero-apply listings

Phase C Gate (must pass):
1. Users can express volunteer interest in <=2 clicks from HelpATL feed/detail.
2. Volunteer fit reasons are present on ranked opportunities.
3. Conversion events are recorded and queryable.

## Phase D: Launch Validation + 14-Day Monitoring
- Target window: 2026-04-05 to 2026-04-19
- Objective: controlled activation and early quality stabilization.

Work items:
1. Final provisioning readiness artifact (`Decision: go`).
2. Activate cadence for channel refresh (`daily` or `hourly`).
3. Monitor:
   - action CTR
   - channels with subscribers but no matches
   - urgent volunteer fill-rate
   - deadline module engagement
4. Rollback trigger policy: draft portal + disable cadence + channel/rule deactivation path.

Phase D Gate:
1. No blocking scope/attribution regressions.
2. No untriaged P0 data-quality failures in civic/volunteer channels.

## 4) Verification Commands (per milestone)

1. Source-pack integrity:
```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-volunteer-v1.json
```

2. Network-feed inheritance:
```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta
```

3. Portal contract tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```

4. Interest channel tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/interest-channel-refresh-schedule.test.ts
```

## 5) Sequence Rule

1. Do not start Phase C before Phase A gate is green.
2. Do not activate launch cadence before Phase B gate is green.
3. Every phase ends with a run artifact under `docs/portal-factory/runs/` with evidence and decision.
