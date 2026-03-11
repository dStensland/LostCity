# HelpATL Humanitarian Rights Wave 1 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Deepen HelpATL's humanitarian breadth in the legal-rights and crisis-response
lanes with strong local organizations that have clear official volunteer paths.

## Execution

Applied:

- `database/migrations/317_helpatl_humanitarian_rights_opportunities.sql`
- `supabase/migrations/20260310005000_helpatl_humanitarian_rights_opportunities.sql`

What was added:

- sources:
  - `avlf`
  - `pad-atlanta`
- organizations:
  - `atlanta-volunteer-lawyers-foundation`
  - `pad-atlanta`
- structured opportunities:
  - `avlf-saturday-lawyer-program`
  - `avlf-protective-order-advocate`
  - `pad-community-response-volunteer`
  - `pad-care-navigation-volunteer`

## Why This Shape

HelpATL was already credible on food, environment, and basic housing support,
but it was still thinner on:

- legal rights and community legal defense
- survivor-centered legal support
- non-carceral humanitarian response tied to poverty, crisis, and instability

AVLF and PAD close those gaps with real local credibility.

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 2`
- `INSERT 0 4`
- `REFRESH MATERIALIZED VIEW`

Live HelpATL state after migration:

- active source subscriptions: `37`
- structured `legal_aid` opportunities: `4`
- structured `housing` opportunities: `4`

Newly visible legal-aid slugs:

- `avlf-saturday-lawyer-program`
- `avlf-protective-order-advocate`

Newly visible housing/crisis-response slugs:

- `pad-community-response-volunteer`
- `pad-care-navigation-volunteer`

## Notes

This improves humanitarian breadth without distorting the event feed. The next
humanitarian gap to close is still family-support / survivor-support depth beyond
legal pathways, likely through a strong domestic-violence or community-stabilization
organization with a clear public volunteer surface.
