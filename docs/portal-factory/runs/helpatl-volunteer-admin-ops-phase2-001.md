# HelpATL Volunteer Admin Ops Phase 2

Date: 2026-03-09

## Goal

Expose structured volunteer quality metrics inside the portal admin surface and complete a minimal volunteer funnel for `detail view -> track interest -> apply click`.

## What Changed

- Added `volunteer_detail_view` interaction tracking on structured volunteer detail pages.
- Extended `/api/admin/portals/[id]/volunteer/quality` with:
  - `detail_views`
  - `detail_to_interest_rate`
  - `detail_to_apply_rate`
  - `interest_to_apply_rate`
  - per-opportunity funnel metrics
- Added portal admin route:
  - `/{portal}/admin/volunteer`
- Added portal admin navigation entry for `Volunteer`.
- Added volunteer ops quick action and volunteer role stat to the portal admin dashboard.

## Operator Outcome

Portal operators can now review:

- stale structured volunteer roles
- low-conversion structured volunteer roles
- no-interest roles
- aggregate funnel performance from detail page to apply click
- per-role funnel performance and freshness

## Verification

- `cd web && npm run lint -- app/[portal]/admin/page.tsx app/[portal]/admin/layout.tsx app/[portal]/admin/volunteer/page.tsx app/[portal]/volunteer/opportunities/[slug]/page.tsx app/api/admin/portals/[id]/volunteer/quality/route.ts components/volunteer/VolunteerDetailTracker.tsx`
- `cd web && npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`

## Notes

- Detail-view funnel counts start at zero until users hit structured volunteer detail pages after this rollout.
- This keeps volunteer ops in the portal-admin surface, which fits the operational boundary better than the global portal editor.
