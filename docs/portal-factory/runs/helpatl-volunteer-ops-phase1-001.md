# HelpATL Volunteer Ops Phase 1 001

- Date: 2026-03-09
- Portal: `helpatl`
- Scope: volunteer action analytics and admin quality visibility

## Changes Shipped

1. Added tracked outbound apply link component:
   - [VolunteerApplyLink.tsx](/Users/coach/Projects/LostCity/web/components/volunteer/VolunteerApplyLink.tsx)
2. Instrumented volunteer interest tracking in:
   - [VolunteerInterestButton.tsx](/Users/coach/Projects/LostCity/web/components/volunteer/VolunteerInterestButton.tsx)
3. Wired volunteer analytics into:
   - civic feed commitment card
   - volunteer browse page
   - volunteer detail page
4. Added admin quality API for structured volunteer opportunities:
   - [route.ts](/Users/coach/Projects/LostCity/web/app/api/admin/portals/[id]/volunteer/quality/route.ts)

## Analytics Model

Uses existing `portal_interaction_events` infrastructure with:
1. `action_type = resource_clicked`
2. `target_kind = volunteer_interest`
3. `target_kind = volunteer_apply`

Identifiers now attached:
1. `target_id = volunteer_opportunities.id`
2. `target_label = volunteer_opportunities.slug`
3. `section_key` values by surface:
   - `volunteer_commitment_card`
   - `volunteer_browse_list`
   - `volunteer_detail`

## Admin Quality API Output

The portal-scoped volunteer quality endpoint returns:
1. total opportunities
2. stale opportunity count
3. low-conversion opportunities
4. no-interest opportunities
5. tracked engagement totals
6. interest click totals
7. apply click totals
8. per-opportunity quality rows

## Verification

1. `npx eslint 'lib/volunteer-opportunities.ts' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'app/api/me/volunteer-profile/route.ts' 'app/[portal]/volunteer/opportunities/page.tsx' 'app/[portal]/volunteer/opportunities/[slug]/page.tsx' 'components/volunteer/VolunteerProfilePanel.tsx' 'components/volunteer/VolunteerInterestButton.tsx' 'components/volunteer/VolunteerApplyLink.tsx' 'components/feed/civic/CommitmentOpportunitiesCard.tsx' 'app/api/admin/portals/[id]/volunteer/quality/route.ts'`
2. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`
3. Live DB sanity check:
   - `9` structured opportunities
   - `0` stale
   - `0` tracked/apply analytics events before user traffic

## Outcome

HelpATL now has the minimum viable volunteer ops loop:
1. user actions are tracked
2. operators can review opportunity quality with conversion-aware signals
3. structured volunteer inventory can now be managed as a product surface, not just content
