# Portal Foundation Hardening Plan

Date: 2026-02-16
Scope: Consumer portal data isolation, attribution integrity, ranking consistency, and pre-scale quality gates.

## Status Checkpoint

1. Phase 0 is in progress.
2. Completed in this pass: portal query contract wiring in feed, search, instant search, timeline, trending, and tonight routes.
3. Phase 1 is in progress.
4. Completed in this pass: shared `portal-scope` helper and refactor of duplicated portal filter logic in feed, trending, tonight, and core search library paths.
5. Phase 2 has started with resolver hardening: attribution context now resolves from body, headers, query params, and referer with slug-first precedence.
6. Completed in this pass: shared write attribution guard is wired into RSVP, saved, follow, hide, reactions, signals tracking, and onboarding completion routes.
7. Completed in this pass: attribution guard behavior is unit-tested (hinted unresolved requests fail fast; non-hinted writes remain backward-compatible).
8. Completed in this pass: admin attribution audit endpoint added at `/api/admin/analytics/portal-attribution` to monitor drift against thresholds.
9. Completed in this pass: core discovery routes now reject mismatched `portal`/`portal_id` query parameters with explicit `400` responses.
10. Completed in this pass: unified search only resolves portal city when venue results are requested; explicit `city` override bypasses portal lookup.
11. Completed in this pass: Phase 3 regression tests added for route mismatch guards and unified-search portal-city behavior.
12. Completed in this pass: shared portal context and scope helpers were extended to additional read routes (`events/[id]`, `events/live`, `around-me`, `events/search`, `calendar`, `classes`, `series/[slug]`).
13. Completed in this pass: city guard filtering added to the extended routes to reduce `portal_id IS NULL` cross-city leakage.
14. Completed in this pass: additional read paths (`spots`, `festivals/[slug]`, `venues/[id]/events`, `activities/popular`) now use canonical portal query semantics and shared scope helpers.
15. Completed in this pass: portal namespaced routes (`/api/portals/[slug]/happening-now`, `/api/portals/[slug]/explore`) were refactored to shared scope/city guard utilities.
16. Completed in this pass: federated source-aware portal visibility logic was centralized in `applyFederatedPortalScopeToQuery` and wired into `/api/portals/[slug]/feed` and `/api/portals/[slug]/destinations/specials`.
17. Completed in this pass: no inline `portal_id.eq...` / `portal_id.is.null` filters remain under `web/app/api`; regression tests were expanded to enforce this.
18. Completed in this pass: integration-style federation leakage harness added with a seeded multi-portal overlap fixture (portal/public/source/city) and deterministic assertions for shared/exclusive/no-portal visibility.

## Objective

Ship a stable federation foundation before scaling to additional portals.

Success means:
1. Portal leakage is effectively zero.
2. Portal attribution is complete on critical behavioral writes.
3. Portal ranking and search behavior are deterministic and test-covered.
4. Scale rollout is gated by measurable SLAs, not judgement calls.

## Phase 0: Lock Contract (2 days)

Deliverables:
1. Define one canonical portal context contract: `portal_slug`, `portal_id`, `portal_city`, `portal_exclusive`.
2. Standardize parameter semantics across API routes so `portal` means slug only and `portal_id` means UUID only.
3. Remove mixed interpretation paths.
4. Add a short contract doc update in `/Users/coach/Projects/LostCity/docs/portal-surfaces-contract.md`.

Acceptance criteria:
1. Every feed/search/timeline/trending/tonight route uses the same portal context shape.
2. No route resolves portal city from a field that might contain a UUID.

## Phase 1: Centralize Scope Logic (4 days)

Deliverables:
1. Add a shared portal scope helper in web lib with strict mode (`portal_id` only) and shared mode (`portal_id` plus public records allowed by city).
2. Enforce a city guard for all `portal_id is null` inclusions.
3. Refactor these routes to shared helper:
4. `/Users/coach/Projects/LostCity/web/app/api/feed/route.ts`
5. `/Users/coach/Projects/LostCity/web/app/api/tonight/route.ts`
6. `/Users/coach/Projects/LostCity/web/app/api/timeline/route.ts`
7. `/Users/coach/Projects/LostCity/web/app/api/trending/route.ts`
8. `/Users/coach/Projects/LostCity/web/app/api/search/route.ts`
9. Remove duplicated post-query leakage patchwork where possible.

Acceptance criteria:
1. Query plans remain index-friendly with current indexes.
2. Portal scope behavior is identical across all five routes.
3. City leakage checks are embedded, not optional.

## Phase 2: Attribution Hardening (3 days)

Deliverables:
1. Enforce `portal_id` write requirements in all critical behavior endpoints: RSVP, save, follow, hide, reactions, feedback, and activity writes.
2. Add a shared write guard utility and use it in every write route.
3. Strengthen attribution tests from string checks to behavior checks with route-level fixtures.
4. Add a daily attribution audit job from `portal_attribution_audit` with threshold alerts.

Acceptance criteria:
1. Missing `portal_id` on critical writes is 0.0% in staging for 7 days.
2. Failing writes without portal context return explicit 4xx where required.
3. Attribution test suite fails if any new write path bypasses guard utility.

## Phase 3: Federation and Search Consistency (4 days)

Deliverables:
1. Ensure search and ranking use consistent portal identity flow end-to-end.
2. Add integration tests for cross-portal leakage across feed, search, trending, tonight, and timeline.
3. Add a multi-portal test seed with overlapping cities and mixed `portal_id` and public records.
4. Validate `unified-search` portal filtering and city resolution behavior.

Acceptance criteria:
1. Leakage test suite passes with zero out-of-scope records.
2. Search results are stable between repeated runs for same query/context.
3. No route-specific exceptions needed for known leakage paths.

## Phase 4: Launch Gate and Rollout Protocol (2 days)

Deliverables:
1. Publish a portal quality scorecard in one place with leakage rate, attribution completeness, crawl freshness, duplicate rate, and broken ticket URL rate.
2. Define rollout gates:
3. Gate A: technical hardening complete.
4. Gate B: 14-day stability window.
5. Gate C: one portal canary expansion.
6. Gate D: scale approvals.
7. Add a runbook for rollback and incident response.

Acceptance criteria:
1. All gates have explicit numeric thresholds.
2. No new portal launch proceeds without green scorecard.

## Target Metrics

1. Leakage rate: 0 out-of-scope events in integration suite and staged spot checks.
2. Attribution completeness: 99.9%+ across critical tables, target 100%.
3. Feed/search API reliability: 99.9% success rate in staging soak.
4. P95 feed latency: under 700 ms.
5. P95 search latency: under 500 ms.
6. Duplicate canonical failures: under 0.5%.
7. Broken ticket links: under 1.0%.

## Execution Order

1. Phase 0 and Phase 1 first.
2. Phase 2 starts once Phase 1 is merged.
3. Phase 3 runs after Phase 2 test scaffolding exists.
4. Phase 4 starts only when Phases 1-3 are green in staging.

## Go/No-Go Rule

No portal scaling work starts until all Phase 4 gates are green.
