# HelpATL Volunteer Opportunities Phase 1 001

- Date: 2026-03-09
- Portal: `helpatl`
- Scope: first structured volunteer opportunity slice for long-term commitments

## Objective

Represent commitment-style volunteer roles that do not fit the event feed model, while preserving the existing drop-in event backbone.

## Changes Shipped

1. Added structured volunteer data tables:
   - `volunteer_opportunities`
   - `user_volunteer_profile`
   - `volunteer_engagements`
2. Seeded `9` active long-term opportunity records for:
   - `big-brothers-big-sisters-atl`
   - `everybody-wins-atlanta`
   - `atlanta-casa`
   - `laamistad`
   - `trees-atlanta`
   - `chattahoochee-riverkeeper`
   - `open-hand-atlanta`
   - `park-pride`
   - `atlanta-community-food-bank`
3. Inserted missing organization rows needed for volunteer opportunity detail surfaces:
   - `big-brothers-big-sisters-atl`
   - `everybody-wins-atlanta`
   - `atlanta-casa`
   - `laamistad`
   - `chattahoochee-riverkeeper`
   - `atlanta-community-food-bank`
4. Added `GET /api/portals/[slug]/volunteer/opportunities`.
5. Extended organization detail data to include `volunteer_opportunities`.
6. Added ongoing-opportunity rendering to:
   - organization detail page
   - organization detail overlay

## Data Shape Decision

The PRD originally described `volunteer_opportunities` as event-linked. That is insufficient for the current HelpATL source mix because core commitment sources like `atlanta-casa` and `laamistad` publish program roles without dated event rows.

Phase 1 therefore ships `event_id` as optional and requires `organization_id`. This supports both:
1. event-backed volunteer shifts
2. evergreen commitment roles

## Verification

### Web checks

1. `npx eslint 'lib/volunteer-opportunities.ts' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'app/api/organizations/by-slug/[slug]/route.ts' 'app/[portal]/community/[slug]/page.tsx' 'components/views/OrgDetailView.tsx'`
2. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`

### Database checks

1. Applied [306_volunteer_opportunities_phase1.sql](/Users/coach/Projects/LostCity/database/migrations/306_volunteer_opportunities_phase1.sql).
2. Verified `volunteer_opportunities` counts:
   - `ongoing`: `7`
   - `lead_role`: `2`
3. Verified HelpATL helper read:
   - portal resolved: `helpatl`
   - active opportunities returned: `9`

## Outcome

HelpATL now has two distinct volunteer layers:
1. event-backed drop-in coverage in the feed and channel system
2. structured long-term opportunities for commitment roles on org detail and portal volunteer opportunity APIs

This removes the need to force non-event programs into fake event inventory just to make them visible.
