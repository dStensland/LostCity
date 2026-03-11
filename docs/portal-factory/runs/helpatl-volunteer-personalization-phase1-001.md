# HelpATL Volunteer Personalization Phase 1 001

- Date: 2026-03-09
- Portal: `helpatl`
- Scope: volunteer fit profile, ranking, and explainable match reasons

## Changes Shipped

1. Added volunteer profile API:
   - [route.ts](/Users/coach/Projects/LostCity/web/app/api/me/volunteer-profile/route.ts)
2. Added volunteer profile editor UI:
   - [VolunteerProfilePanel.tsx](/Users/coach/Projects/LostCity/web/components/volunteer/VolunteerProfilePanel.tsx)
3. Added fit scoring and reasons in:
   - [volunteer-opportunities.ts](/Users/coach/Projects/LostCity/web/lib/volunteer-opportunities.ts)
4. Updated the volunteer opportunities API to return personalized ranking metadata when a signed-in user has a profile.
5. Surfaced fit reasons in:
   - browse page
   - detail page
   - civic feed commitment card

## Scoring Behavior

Current fit score v1 uses:
1. cause match
2. skill match
3. commitment preference match
4. language overlap
5. remote-friendly boost when mobility constraints are present

Reason labels now visible to users:
1. `Cause match`
2. `Skill match`
3. `Matches your commitment level`
4. `Near your commitment preference`
5. `Language match`
6. `Remote-friendly`

## Verification

1. `npx eslint 'lib/volunteer-opportunities.ts' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'app/api/me/volunteer-profile/route.ts' 'app/[portal]/volunteer/opportunities/page.tsx' 'app/[portal]/volunteer/opportunities/[slug]/page.tsx' 'components/volunteer/VolunteerProfilePanel.tsx' 'components/volunteer/VolunteerInterestButton.tsx' 'components/feed/civic/CommitmentOpportunitiesCard.tsx'`
2. `npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`
3. Demo profile validation:
   - profile: `environment + outdoors + ongoing`
   - top ranked roles:
     - `green-shirt-volunteer-pathway` score `9`
     - `neighborhood-water-watch` score `9`
     - `park-stewardship-academy` score `8`

## Outcome

HelpATL structured volunteer discovery is now:
1. filterable
2. trackable
3. personalized
4. explainable

The remaining gap is refinement, not platform capability. Future work should focus on:
1. richer profile inputs (`availability_windows`, travel radius)
2. opportunity detail depth
3. analytics on interest-to-apply conversion
