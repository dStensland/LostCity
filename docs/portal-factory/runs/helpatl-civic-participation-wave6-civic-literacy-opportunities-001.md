# HelpATL Civic Participation Wave 6 Civic Literacy Opportunities 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Deepen civic literacy, recurring observer work, and democracy-support pathways
inside HelpATL's structured civic inventory.

## Execution

Applied:

- `database/migrations/315_helpatl_civic_literacy_opportunities.sql`
- `supabase/migrations/20260310003000_helpatl_civic_literacy_opportunities.sql`

What was added:

- organizations:
  - `lwv-atlanta-fulton`
  - `center-for-civic-innovation`
- structured civic opportunities:
  - `lwv-observer-corps`
  - `lwv-deputy-registrar`
  - `atlanta-civics-academy`

## Why This Shape

HelpATL's civic feed already had events from League of Women Voters and the
Center for Civic Innovation. What it lacked was the durable participation layer
behind those events:

- recurring government observation
- voter-registration support training
- civic-literacy training that helps residents understand City Hall and local process

These are structured civic pathways, not calendar-only items.

## Verification

Applied migration successfully:

- `INSERT 0 2`
- `INSERT 0 3`

Live HelpATL civic inventory after migration:

- structured `civic_engagement` opportunities: `11`

Newly visible slugs in the portal query path:

- `lwv-observer-corps`
- `lwv-deputy-registrar`
- `atlanta-civics-academy`

## Notes

This materially improves HelpATL's civic literacy and watchdog coverage. The
remaining biggest official civic gap is still a live public-notices / appointment
calendar path for clerk-managed boards and commissions activity.
