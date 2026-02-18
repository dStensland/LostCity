# AI Base Instructions v1 (LostCity)

Date: 2026-02-18
Owner: Product + Engineering
Scope: Any AI-assisted code or content change in this repository.

## Purpose

Reduce repeat regressions, enforce federation architecture, and maintain premium quality as we scale.

## Decision Order (Always)

1. Protect portal federation and attribution contracts.
2. Preserve consumer/admin surface boundaries.
3. Fix root causes in code paths, not downstream data patches.
4. Maintain performance and visual clarity under real load.
5. Ship with tests and measurable verification.

## Non-Negotiable Rules

### 1) Portal Contract and Scope

1. `portal` is a slug only; `portal_id` is UUID only.
2. If both are present, they must resolve to the same portal or return `400`.
3. Use shared portal scope helpers (no ad-hoc inline `portal_id` filters).
4. Public records (`portal_id IS NULL`) require explicit city guardrails.
5. Any behavior write route must resolve attribution via shared guard (`resolvePortalAttributionForWrite`).

### 2) Surface Separation

1. Every change must declare surface: `consumer`, `admin`, or `both`.
2. Consumer screens cannot expose admin concepts (configuration, orchestration, governance internals).
3. If feature is `both`, acceptance criteria must be separate per surface.
4. Follow `/Users/coach/Projects/LostCity/docs/portal-surfaces-contract.md`.

### 3) Data Ownership and Federation

1. Facts are global; preferences are portal-local.
2. Never silo enrichment that should benefit the network.
3. Do not fix recurring data defects manually in DB if ingestion logic can be corrected upstream.
4. Schema changes require:
5. New migration(s) in `/Users/coach/Projects/LostCity/database/migrations/`
6. Matching migration(s) in `/Users/coach/Projects/LostCity/supabase/migrations/`
7. Updated `/Users/coach/Projects/LostCity/database/schema.sql`

### 4) Event Presentation Contract (Premium Quality)

1. Participant sections are event-type aware, not generic:
2. Music: artists/bands
3. Sports: teams/opponents
4. Comedy: comics/headliners
5. Talks/Panels: speakers/guests
6. Do not synthesize participants from event title tokenization.
7. If structured participant data is missing, omit participant section rather than fabricating.
8. When participants exist, show role labels, per-entity genres/tags when available, and stable links (internal detail + external website when present).
9. Ticket CTA/pill must navigate to canonical ticket URL when available.

### 5) Metadata Consistency and Readability

1. Keep card/detail metadata order consistent across the same event type.
2. Text over imagery must include readability treatment (scrim/overlay + sufficient contrast).
3. Header/menu stacking must not reintroduce trapped dropdown z-index contexts.
4. Loading surfaces must preserve route-level skeleton markers.

### 6) Quality and Performance Gates

1. No new N+1 query patterns in feed/find/detail endpoints.
2. Prefer shared utility paths over duplicated business logic.
3. Keep changes scoped and atomic; split mega changes into reviewable commits by domain.

## Required Delivery Checklist (Per Change)

1. State surface (`consumer`/`admin`/`both`) and affected portal context.
2. List impacted contracts (scope, attribution, schema, UI skeleton, z-index, participant model).
3. Implement using shared helpers first; avoid route-local re-implementation.
4. Add or update tests for each changed contract.
5. Run verification commands relevant to the change.
6. Report residual risks and explicit follow-ups.

## Verification Matrix

### Portal scope / attribution / API behavior changes

```bash
cd web
npm run test -- lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```

### Header/menu/dropdown layering changes

```bash
cd web
npm run test -- components/__tests__/header-z-index.test.ts
```

### Portal loading/view-routing changes

```bash
cd web
npm run test -- app/[portal]/_components/__tests__/skeleton-process.test.ts
```

### Crawler extraction/dedupe/normalization changes

```bash
cd crawlers
pytest
python3 -m py_compile scripts/content_health_audit.py
```

### Broad web changes or release candidates

```bash
cd web
npm run lint
npm run test
```

## Default No-Go Conditions

1. Any portal leakage path is introduced or unresolved.
2. Attribution guard is bypassed on behavior writes.
3. Surface boundaries are mixed in IA/copy/routes.
4. Participant data is fabricated from event names.
5. UI regressions in menu stacking or skeleton routing are untested.
