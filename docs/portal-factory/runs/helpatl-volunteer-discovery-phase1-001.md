# HelpATL Volunteer Discovery Phase 1 001

- Date: 2026-03-09
- Portal: `helpatl`
- Scope: turn structured volunteer opportunities into a browseable discovery surface

## Changes Shipped

1. Added portal browse route for structured roles:
   - [page.tsx](/Users/coach/Projects/LostCity/web/app/[portal]/volunteer/opportunities/page.tsx)
2. Added dedicated opportunity detail route:
   - [page.tsx](/Users/coach/Projects/LostCity/web/app/[portal]/volunteer/opportunities/[slug]/page.tsx)
3. Added reusable interest action control:
   - [VolunteerInterestButton.tsx](/Users/coach/Projects/LostCity/web/components/volunteer/VolunteerInterestButton.tsx)
4. Extended volunteer opportunity query support in:
   - [volunteer-opportunities.ts](/Users/coach/Projects/LostCity/web/lib/volunteer-opportunities.ts)
   - [route.ts](/Users/coach/Projects/LostCity/web/app/api/portals/[slug]/volunteer/opportunities/route.ts)
5. Updated the civic feed commitment card to link into the new browse/detail routes.

## New Discovery Behavior

Users can now:
1. browse long-term roles at `/{portal}/volunteer/opportunities`
2. filter by commitment level, time horizon, onboarding level, cause, and remote availability
3. open a dedicated detail page for each role
4. track interest from the list page, detail page, and feed card

## Verification

1. `npx eslint 'lib/volunteer-opportunities.ts' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'app/api/volunteer/engagements/route.ts' 'app/api/volunteer/engagements/[id]/route.ts' 'app/api/me/volunteer-impact/route.ts' 'app/[portal]/volunteer/opportunities/page.tsx' 'app/[portal]/volunteer/opportunities/[slug]/page.tsx' 'components/volunteer/VolunteerInterestButton.tsx' 'components/feed/CivicFeedShell.tsx' 'components/feed/civic/CommitmentOpportunitiesCard.tsx'`
2. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`
3. Live helper check:
   - `commitmentLevel=ongoing` + `cause=environment` returned:
     - `green-shirt-volunteer-pathway`
     - `neighborhood-water-watch`
   - detail lookup for `volunteer-advocate` resolved to `atlanta-casa`

## Outcome

The structured volunteer layer is now a real consumer product surface, not just data plumbing:
1. feed card for discovery
2. browse page for filtering
3. detail page for trust and decision support
4. engagement endpoints for conversion tracking
