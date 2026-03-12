# HelpATL Health and Public Health Wave 3 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Close the medical/public-health gap in HelpATL's structured humanitarian
inventory and make those roles discoverable in the volunteer UI.

## Execution

Applied:

- `database/migrations/319_helpatl_health_public_health_opportunities.sql`
- `supabase/migrations/20260310007000_helpatl_health_public_health_opportunities.sql`

Updated UI filters:

- `web/app/[portal]/volunteer/opportunities/page.tsx`
- `web/components/volunteer/VolunteerProfilePanel.tsx`

What was added:

- sources:
  - `dekalb-medical-reserve-corps`
  - `red-cross-georgia`
- organizations:
  - `medshare`
  - `dekalb-medical-reserve-corps`
  - `american-red-cross-greater-atlanta`
- structured opportunities:
  - `medshare-medical-supply-volunteer`
  - `dekalb-medical-reserve-corps-volunteer`
  - `red-cross-shelter-hero`
  - `red-cross-disaster-action-team`

## Why This Shape

HelpATL's humanitarian coverage was still thinner on medical and public-health
support than on food, environment, housing, or civic engagement.

This wave adds three distinct kinds of health/public-health service:

- medical humanitarian logistics
- official public-health preparedness
- humanitarian disaster response and sheltering

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 3`
- `INSERT 0 4`
- `REFRESH MATERIALIZED VIEW`

Lint passed for the touched UI files.

Live HelpATL state after migration:

- active source subscriptions: `41`
- structured `health_wellness` opportunities: `4`

Newly visible `health_wellness` slugs:

- `medshare-medical-supply-volunteer`
- `dekalb-medical-reserve-corps-volunteer`
- `red-cross-shelter-hero`
- `red-cross-disaster-action-team`

## Notes

This makes the health/public-health lane credible instead of incidental. The
next humanitarian gap is likely survivor-support depth beyond legal pathways or
broader public-health community care roles if a strong local volunteer surface
exists.
