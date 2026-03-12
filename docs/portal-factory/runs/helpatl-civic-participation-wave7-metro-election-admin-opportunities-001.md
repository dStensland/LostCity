# HelpATL Civic Participation Wave 7 Metro Election Admin Opportunities 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Make HelpATL materially stronger on metro Atlanta civic breadth by adding
official election-administration pathways across the core metro counties.

## Execution

Applied:

- `database/migrations/316_helpatl_metro_election_worker_opportunities.sql`
- `supabase/migrations/20260310004000_helpatl_metro_election_worker_opportunities.sql`

What was added:

- sources:
  - `fulton-county-elections`
  - `dekalb-county-elections`
  - `cobb-county-elections`
  - `gwinnett-county-elections`
- organizations:
  - `fulton-county-elections`
  - `dekalb-county-elections`
  - `cobb-county-elections`
  - `gwinnett-county-elections`
- structured civic opportunities:
  - `fulton-county-poll-worker`
  - `dekalb-county-poll-worker`
  - `cobb-county-poll-worker`
  - `gwinnett-county-poll-official`

## Why This Shape

HelpATL needed a stronger metro-wide civic lane beyond Atlanta-core meetings and
advocacy events. Official poll-worker and poll-official pathways are one of the
clearest, highest-trust ways for residents to help run democracy directly.

These are not event-feed items. They are structured civic opportunities with
training, recurring election-cycle commitment, and official county attribution.

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 4`
- `INSERT 0 4`
- `REFRESH MATERIALIZED VIEW`

Live HelpATL state after migration:

- active source subscriptions: `35`
- structured `civic_engagement` opportunities: `15`

Newly visible slugs in the portal query path:

- `fulton-county-poll-worker`
- `dekalb-county-poll-worker`
- `cobb-county-poll-worker`
- `gwinnett-county-poll-official`

## Notes

This is a real metro expansion, not an Atlanta-core leak. The four county
election sources are owned by HelpATL and subscribed only there. That keeps the
broader metro civic inventory scoped to the portal that is supposed to represent
metro Atlanta.
