# HelpATL Commitment Surface Inventory Pass 004

Date: 2026-03-11
Owner: Codex

## Goal

Make `Commit to a Cause` feel like the real long-term involvement layer instead of a thin four-card teaser.

## What changed

- Added volunteer opportunity summary metadata in the shared data path:
  - `total`
  - `by_commitment_level`
  - `by_cause`
- Updated the public volunteer opportunities API to return that summary.
- Updated the HelpATL commitment browse page header to show:
  - active role count
  - ongoing role count
  - lead role count
  - strongest cause lanes
- Updated the home-feed `Commit To A Cause` card to show:
  - active commitment inventory totals
  - ongoing vs lead-role counts
  - top cause lanes
  - explicit copy that this is the structured long-term role layer, not a dated event list

## Root-cause fix

The summary data initially looked inconsistent between surfaces because the API was summarizing only the first `limit * 3` rows. With `limit=8`, the home card was summarizing just `24` roles while the browse page described the full `61`.

That is now fixed in the shared volunteer opportunity query path by fetching a wider inventory pool before:

1. filtering
2. summary generation
3. ranking and slicing for display

## Live state after fix

- `total active roles`: `61`
- `ongoing roles`: `55`
- `lead roles`: `6`
- top causes:
  - `civic_engagement`: `24`
  - `family_support`: `8`
  - `immigrant_refugee`: `6`
  - `education`: `4`
  - `health_wellness`: `4`

## Verification

- `npm run lint -- 'app/[portal]/volunteer/opportunities/page.tsx' 'app/[portal]/volunteer/opportunities/[slug]/page.tsx' 'app/api/portals/[slug]/volunteer/opportunities/route.ts' 'components/feed/civic/CommitmentOpportunitiesCard.tsx' 'lib/volunteer-opportunities.ts' 'lib/volunteer-opportunities.test.ts'`
- `npm run test -- lib/volunteer-opportunities.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`
- `curl -s 'http://127.0.0.1:3000/api/portals/helpatl/volunteer/opportunities?limit=8' | jq ...`
- `curl -s 'http://127.0.0.1:3000/helpatl/volunteer/opportunities' | rg 'Active roles'`

## Browser QA

- Browse page header verified visually:
  - `/Users/coach/Projects/LostCity/output/playwright/helpatl-volunteer-opportunities-header-focus.png`
- Home-feed card browser QA is still partially blocked in this local session by the onboarding shell intercepting feed interaction on `/helpatl`.

## Residual note

The underlying problem was not missing commitment data. It was weak presentation plus a summary query that was truncating the visible inventory for short-limit consumers.
