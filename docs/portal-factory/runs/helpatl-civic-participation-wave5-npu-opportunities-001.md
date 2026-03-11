# HelpATL Civic Participation Wave 5 NPU Opportunities 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Deepen neighborhood-governance participation in HelpATL by adding structured
official NPU participation pathways, not just NPU meeting event rows.

## Execution

Applied:

- `database/migrations/314_helpatl_npu_participation_opportunities.sql`
- `supabase/migrations/20260310002000_helpatl_npu_participation_opportunities.sql`

What was added:

- organizations:
  - `atlanta-department-of-city-planning`
  - `atlanta-neighborhood-planning-units`
- structured civic opportunities:
  - `join-your-neighborhood-planning-unit`
  - `npu-university-community-leader`
  - `present-at-an-npu-meeting`

All three opportunities are attributed to the existing `atlanta-city-planning`
source and use official city participation URLs.

## Why This Shape

HelpATL already had a dated neighborhood-participation feed through City Planning
meeting events. The missing piece was the participation path around those
meetings:

- how to join your NPU
- how to train for neighborhood leadership
- how to formally get on an NPU agenda

Those are structured civic opportunities, not one-off events.

## Verification

Applied migration successfully:

- `INSERT 0 2`
- `INSERT 0 3`

Live HelpATL civic inventory after migration:

- structured `civic_engagement` opportunities: `8`

Newly visible slugs in the portal query path:

- `join-your-neighborhood-planning-unit`
- `npu-university-community-leader`
- `present-at-an-npu-meeting`

## Notes

This makes HelpATL meaningfully stronger on neighborhood governance without
waiting on additional meeting crawlers. The remaining official civic gap is still
fresh public-notice / appointment-calendar coverage for clerk-managed boards and
commissions activity.
