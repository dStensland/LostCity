# HelpATL Civic Participation Wave 4 Official Boards Opportunities 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Deepen the official boards-and-commissions participation layer without pretending
that the blocked Atlanta municipal clerk pages are a usable live event source.

## Execution

Applied:

- `database/migrations/313_helpatl_official_boards_commissions_opportunities.sql`
- `supabase/migrations/20260310001000_helpatl_official_boards_commissions_opportunities.sql`

What was added:

- source: `atlanta-boards-commissions`
- organizations:
  - `city-of-atlanta-boards-commissions`
  - `city-of-atlanta-commission-on-aging`
- structured civic opportunities:
  - `atlanta-board-commission-seat-applicant`
  - `atlanta-bace-appointment-process`
  - `atlanta-commission-on-aging-public-meetings`

## Why This Shape

The official Atlanta boards-and-commissions pages remain blocked to crawler
runtime with `403 Access Denied`, including the municipal clerk chrome and
direct published-document endpoints. That makes a fresh event-feed integration
non-defensible right now.

The city still exposes enough official public information to model real
participation pathways:

- board membership application flow
- BACE appointment materials
- recurring public Commission on Aging meetings

These belong in HelpATL as structured civic opportunities, not fake event rows.

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 2`
- `INSERT 0 3`
- `REFRESH MATERIALIZED VIEW`

Live state after migration:

- HelpATL active source subscriptions: `31`
- HelpATL structured civic engagement opportunities returned by portal query: `5`

Current `civic_engagement` structured inventory:

- `atlanta-board-commission-seat-applicant`
- `atlanta-bace-appointment-process`
- `atlanta-commission-on-aging-public-meetings`
- `canopy-atlanta-documenter`
- `common-cause-georgia-volunteer-team`

## Notes

This closes part of the official boards-and-commissions gap in a truthful way,
but it does not replace a live official meetings feed. The remaining high-value
official gap is still a crawlable public-notice or meeting-calendar path for
municipal clerk / BACE activity.
