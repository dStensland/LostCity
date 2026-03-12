# Portal Provisioning Process (Repeatable + Airtight)

This process is the required path for provisioning any new portal before activation.

## Principles

1. Draft-first: never activate on first write.
2. Idempotent execution: every step must be safe to re-run.
3. Evidence-driven gates: every gate must include command/query evidence.
4. No manual hotfix provisioning: if the process fails, fix root cause and rerun.
5. Preserve contracts: portal scope, attribution, and consumer/admin boundaries are non-negotiable.

## Inputs

1. Completed templates `00` through `05` in `docs/portal-factory/templates/`.
2. Candidate `Live Event Sources` inventory, `Ongoing Opportunity Sources` inventory when applicable, and channel pack for the target portal.
3. Named operator + target environment (`staging` first, then production).

## Stage 1: Readiness Gate (No Writes)

Create a run artifact from:
- `docs/portal-factory/templates/06-provisioning-readiness-gate.md`

Run required checks:

1. `Live Event Sources` integrity (repo-level):
```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts \
  --manifest ../docs/portal-factory/manifests/<portal-manifest>.json
```
2. Source row integrity (DB-level):
   - every `source_subscriptions.source_slugs` entry (`Live Event Sources`) exists, is active, and is crawlable
   - every `structured_opportunity_sources.source_slugs` entry (`Ongoing Opportunity Sources`) exists, is active, and is accessible through `portal_source_access`
3. Channel rule integrity (DB-level): verify every rule payload selector points to existing entities.
4. Match pipeline integrity: verify `/api/cron/interest-channel-matches` auth key is set and schedule intent is defined.
5. Adventure inventory integrity when applicable: verify Yonder inventory execution mode is chosen and `YONDER_INVENTORY_CRON_API_KEY` is set for route-trigger mode.
6. Surface integrity: verify both consumer and admin routes exist for the feature.
7. Consumer dead-end integrity:
   - primary empty states must include recovery copy + CTA
   - glossary for key user-facing nouns is defined and consistent
   - no disabled cards/tabs/routes without a redirect path or explicit not-found behavior
8. Portal write integrity:
   - any portal-attributed write route introduced by the portal uses `resolvePortalAttributionForWrite`
   - route-level tests exist for create/update paths on portal-attributed user actions
9. City scope integrity:
   - portal-scoped discovery/feed paths honor both `filters.city` and `filters.cities`
   - shared city-allowlist helpers are used instead of route-local string checks

Hard-stop rule:
- If any hard gate fails, do not execute provisioning writes.

## Stage 2: Provisioning Plan Freeze

Before writes, freeze an execution plan with:

1. Portal identity + ownership (`slug`, `name`, `portal_type`, `parent_portal_id`, `plan`).
2. Portal nav semantics (`settings.nav_labels`) using canonical keys:
   - `feed`
   - `find`
   - `community`
   Legacy compatibility keys (`events`, `spots`) may be set in parallel.
3. `Live Event Sources` spec (`source_subscriptions`: explicit crawlable source slugs and scope).
4. `Ongoing Opportunity Sources` spec (`structured_opportunity_sources`: active, portal-accessible backing sources that do not need crawlability).
5. Interest channel spec (channel slugs, types, rules, priorities).
6. Refresh cadence (`hourly` | `daily` | `disabled`, and `hour_utc` when daily).
7. Activation criteria and rollback triggers.

Use either:
- Admin APIs (`/api/admin/portals/...`), or
- A deterministic script in `web/scripts/` that supports `--dry-run`:
```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/<portal-manifest>.json \
  --dry-run
```

## Stage 3: Controlled Provisioning (Draft Only)

Execution order:

1. Create/update portal in `draft` status.
2. Upsert source subscriptions.
3. Refresh `portal_source_access`.
4. Validate `Ongoing Opportunity Sources` accessibility.
5. Upsert interest channels and rules.
6. Run one manual channel match refresh for verification window.
7. Configure cadence (default `disabled` until verification passes).

## Stage 4: Post-Write Verification

Required checks:

1. API-level:
- Admin channels endpoint returns health + opportunities.
- Groups endpoint/page loads channels and supports join/leave.
2. Data-level:
- No channels with zero active rules.
- No channels with subscribers and zero matches.
- Distinct matched events above launch floor.
3. Contract tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```
4. Feature tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/interest-channel-refresh-schedule.test.ts
```
5. Portal action trust tests:
```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- lib/portal-attribution-guard.test.ts lib/portal-attribution.test.ts
```
6. Cold-start QA:
   - manually verify the top 2-3 real user tasks for the portal
   - examples:
     - hotel: open portal, save/build itinerary, open a canonical directions/ticket/action CTA
     - civic: browse volunteer/support flows, express interest, recover from empty states

## Stage 5: Activation Decision

Activate only when:

1. All Stage 1 hard gates are pass.
2. Stage 4 checks pass with no blocking regressions.
3. Readiness artifact explicitly records `Decision: go`.
4. Cold-start task walkthrough passes without explanation or operator intervention.

Activation actions:

1. Set portal `status=active`.
2. Enable refresh cadence (`hourly` or `daily`) only after baseline match quality is verified.
3. Start launch monitoring for 14 days (health + analytics).

## Rollback

If launch verification fails:

1. Set portal to `draft`.
2. Set interest-channel refresh cadence to `disabled`.
3. Deactivate problematic channels/rules or subscriptions.
4. Record failure mode and process fix in the run artifact.

## Required Evidence Pack

Each run must store:

1. Readiness scorecard.
2. Commands/queries executed.
3. Provisioning payload/spec used.
4. Verification outputs and decision.
5. Follow-up actions with owners and dates.
