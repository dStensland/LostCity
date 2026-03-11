# HelpATL Volunteer Conversion Phase 1 001

- Date: 2026-03-09
- Portal: `helpatl`
- Scope: expose structured volunteer roles on the civic feed and add first engagement endpoints

## Changes Shipped

1. Added volunteer engagement write APIs:
   - `POST /api/volunteer/engagements`
   - `PATCH /api/volunteer/engagements/[id]`
2. Added signed-in volunteer impact summary:
   - `GET /api/me/volunteer-impact`
3. Added civic feed commitment discovery card:
   - [CommitmentOpportunitiesCard.tsx](/Users/coach/Projects/LostCity/web/components/feed/civic/CommitmentOpportunitiesCard.tsx)
4. Wired the commitment card into the civic feed shell for:
   - mobile inline placement
   - desktop sidebar placement

## Product Outcome

HelpATL no longer hides structured long-term volunteer roles behind organization detail pages only.

The civic feed now has a dedicated `Commit to a Cause` module that:
1. loads structured volunteer opportunities from the portal API
2. links users to apply externally
3. lets signed-in users track interest directly in-platform
4. reflects tracked role counts when available

## Verification

1. `npx eslint 'lib/volunteer-opportunities.ts' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'app/api/volunteer/engagements/route.ts' 'app/api/volunteer/engagements/[id]/route.ts' 'app/api/me/volunteer-impact/route.ts' 'app/api/organizations/by-slug/[slug]/route.ts' 'app/[portal]/community/[slug]/page.tsx' 'components/views/OrgDetailView.tsx' 'components/feed/CivicFeedShell.tsx' 'components/feed/civic/CommitmentOpportunitiesCard.tsx'`
2. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`

## Constraint

This phase adds conversion plumbing and discovery, but not a bespoke opportunity detail page. Structured commitment roles still resolve to:
1. organization detail pages
2. external application URLs

That is acceptable for phase 1 because the key gap was visibility and engagement capture, not deep editorial detail.
