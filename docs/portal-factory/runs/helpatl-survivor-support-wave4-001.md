# HelpATL Survivor Support Wave 4 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Close the survivor-support gap beyond legal pathways by adding direct victim and
domestic-violence support opportunities to HelpATL's structured humanitarian
inventory.

## Execution

Applied:

- `database/migrations/320_helpatl_survivor_support_opportunities.sql`
- `supabase/migrations/20260310008000_helpatl_survivor_support_opportunities.sql`

What was added:

- sources:
  - `partnership-against-domestic-violence`
  - `atlanta-victim-assistance`
- organizations:
  - `partnership-against-domestic-violence`
  - `atlanta-victim-assistance`
- structured opportunities:
  - `padv-crisis-line-and-shelter-volunteer`
  - `padv-childrens-program-support`
  - `ava-victim-support-volunteer`
  - `ava-closet-and-resource-drive-support`

## Why This Shape

HelpATL had legal-aid coverage and some family-support coverage, but survivor
support itself was still too thin. This wave adds:

- domestic-violence crisis and shelter support
- child and family recovery support
- victim-advocacy support
- practical victim-stability support

That makes the family-support lane much more real.

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 2`
- `INSERT 0 4`
- `REFRESH MATERIALIZED VIEW`

Live HelpATL state after migration:

- active source subscriptions: `43`
- structured `family_support` opportunities: `7`

Newly visible `family_support` slugs:

- `padv-crisis-line-and-shelter-volunteer`
- `padv-childrens-program-support`
- `ava-victim-support-volunteer`
- `ava-closet-and-resource-drive-support`

## Notes

This makes survivor and victim-support coverage much more credible. The next
major step is probably another overall scorecard pass rather than continuing to
add more lanes blindly.
