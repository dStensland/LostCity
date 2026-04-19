# ADR: Portal Isolation for Non-Event Entities (Festivals, Organizations, Series)

**Date:** 2026-04-18
**Status:** Accepted (2026-04-18)
**Related:** [2026-02-14 portal data isolation](2026-02-14-portal-data-isolation.md), explore-overlay Phase 5 (commit f114a045)

## Context

The Phase 5 P0 fix added `getCanonicalPortalRedirect` to `/api/events/[id]` so the
overlay path matches the canonical-page guard. That left a question on the table:
do the same protections need to exist for festivals, organizations, and series?

Audit findings (2026-04-18):

| Entity | Direct portal column | Canonical-page guard | Overlay/API guard | Behavior today |
|---|---|---|---|---|
| Events | via `source_id` → `portal_source_access` | `getCanonicalPortalRedirect` | ✅ Phase 5 | Federated, redirects on miss |
| Festivals | `festivals.portal_id` (mig 147) | none | none | Cross-portal slug fetch returns the row |
| Organizations | `organizations.portal_id` (mig 123) | (no canonical page) | none | Same as festivals |
| Series | none — scoped via events | none | none | Header leaks, events list is portal-scoped |
| Spots (places) | none — portal-agnostic by design | n/a | n/a | Not a leak: places are global |
| Neighborhoods | none — geographic | n/a | n/a | Not a leak: geography |

So the structurally identical leak class exists for festivals and orgs, and
partially for series. Unlike events, neither path enforces — meaning a fix
to the overlay alone wouldn't be parity, it would be *adding new behavior*.

The architect-flagged P0 was specifically about events because events have
an explicit federation contract (`portal_source_access`). For festivals/orgs,
the contract isn't documented anywhere and behavior is inconsistent.

## Decision (proposed)

Three things to decide before writing any code:

### 1. Contract: federated like events ✅

Add `portal_festival_access` / `portal_organization_access` join tables.
Owner portal (`portal_id` on festivals/organizations) is the source of
truth; federation rows in the join table grant additional access. Mirrors
the events contract via `portal_source_access`. Future-proofs for
shared-vertical orgs (e.g., a regional cultural org producing for both
Atlanta and Arts portals).

Cost accepted: migrations, RLS, eventual admin UI for managing federation.

### 2. Behavior on miss: 404 for overlays, 308 for canonical ✅

Same pattern Phase 5 established. Overlays close on 404 via the existing
detail-view error path; canonical pages benefit from the redirect because
they're shareable URLs.

### 3. Scope: single workstream, no partial fixes ✅

Mismatched enforcement is worse than no enforcement (it makes one path the
"escape hatch" for any leak the other catches). The fix lands as a single
workstream per entity that touches the overlay API + canonical page (where
one exists) + tests, with the migration as the foundation.

### Series — separate carve-out

Series doesn't have a portal column and gets implicit scoping via the
events list inside the response. The "header leaks" finding is real but
arguably benign — the header just labels what's in the (correctly scoped)
events list. If the events list is empty for the current portal, the
overlay shows a series with zero events, which is self-policing.

**Recommendation:** **No action for series.** Document as expected
behavior. Revisit if user research shows confusion.

## Consequences (if proposal accepted)

- New migration: `getCanonicalPortalRedirect`-equivalent helper for festivals
  and organizations (`getCanonicalFestivalPortal`, `getCanonicalOrgPortal`)
  reading `portal_id` directly.
- New checks in `/api/festivals/[slug]/route.ts`, `/api/organizations/by-slug/[slug]/route.ts`,
  and `/[portal]/festivals/[slug]/page.tsx`.
- No DB schema changes (uses existing `portal_id` columns).
- Test coverage matching the Phase 5 portal-access tests.

## Open questions

- Does Atlanta-Magazine-style cross-portal federation apply to organizations?
  (e.g., a regional cultural org producing events for Atlanta + Arts portals.)
  If yes, Option A becomes a regression — revisit before committing.
- Festivals frequently span multiple cities (Music Midtown does Atlanta-only;
  Bonnaroo is Tennessee). Strict `portal_id` is fine for the first; for the
  second, the festival probably *shouldn't* surface in Atlanta at all and
  this fix correctly excludes it.

## Implementation plan

Two stacked workstreams (festivals first, organizations second), each
self-contained:

**Workstream A — Festivals**
1. Migration pair: `portal_festival_access` table + indexes + backfill
   (every festival's owner portal gets an implicit row).
2. Helper: `getCanonicalFestivalPortal(festivalId, currentPortalId)` in
   `web/lib/portal-access.ts`.
3. Update `app/api/festivals/[slug]/route.ts` — 404 + `canonical_url`
   on miss.
4. Update `app/[portal]/festivals/[slug]/page.tsx` — 308 redirect on miss.
5. Tests mirroring `lib/__tests__/portal-access.test.ts`.

**Workstream B — Organizations**
Same shape. No canonical page to update (orgs are overlay-only today).

Each workstream is one PR. Order: A then B.

## Status

Accepted. Implementation begins after the explore-overlay stack (PRs
#62-#68) lands so we don't keep stacking on an already-deep tower.
