# PRD 028A: Interest Channels Phase 0 Execution Board

**Parent:** `PRD 028`
**Date:** 2026-03-07
**Objective:** Hardening before feature delivery (schema/type consistency + scoped read primitives)

---

## Workstream A: Schema and Type Integrity

### A1. Reconcile `follows.portal_id` type drift
- **Outcome:** App-level DB types represent `follows.portal_id` consistently.
- **Acceptance criteria:**
  - `web/lib/supabase/database.types.ts` includes `portal_id` in `follows` row/insert/update.
  - `web/lib/types.ts` includes `portal_id` in follows row/insert.
  - No TypeScript errors in touched files.

### A2. Add CI guard for schema/type drift
- **Outcome:** Schema-affecting changes cannot merge with stale generated types.
- **Acceptance criteria:**
  - CI step or script verifies generated DB types are current.
  - Contributor docs updated with regeneration command.

---

## Workstream B: Portal-Scoped Behavioral Read Helpers

### B1. Create shared follows read utility
- **Outcome:** One helper for portal-aware follow reads with migration-safe fallback behavior.
- **Acceptance criteria:**
  - Helper supports `portalId` + `includeUnscoped` option.
  - Returns deduped venue/org IDs.
  - Unit tests cover scoped/unscoped behavior.

### B2. Apply helper to high-traffic feed surfaces
- **Outcome:** Core personalization paths use one scoped read implementation.
- **Target routes:**
  - `/api/feed`
  - `/api/events/following`
  - `/api/portals/[slug]/city-pulse`
- **Acceptance criteria:**
  - Direct follow table reads are removed from target routes.
  - Portal mismatch handling remains correct where applicable.
  - Existing route behavior preserved for non-portal calls.

### B3. Align follow status endpoint behavior
- **Outcome:** `/api/follow` status checks and unfollow deletes respect portal-aware scoping.
- **Acceptance criteria:**
  - Follow status uses same portal scope semantics as feed personalization.
  - Unfollow removes portal-scoped or unscoped rows for the current portal context.

---

## Workstream C: Readiness Validation

### C1. Test and smoke checks
- **Outcome:** No regressions in portal attribution/scope contracts.
- **Commands:**
  - `cd web && npm run test -- lib/follows.test.ts lib/portal-attribution.test.ts lib/portal-scope.test.ts lib/portal-query-context.test.ts`
- **Acceptance criteria:**
  - All listed tests pass.
  - No new lint/type errors in touched modules.

---

## Exit Gate (Phase 0 Complete)

1. `follows.portal_id` type drift addressed.
2. Shared follows read helper exists and is used by core feed paths.
3. Follow status endpoint semantics are scoped consistently.
4. Targeted test suite passes.

