# HelpATL Family and Refugee Wave 2 001

Date: 2026-03-10
Portal: `helpatl`

## Objective

Deepen HelpATL's humanitarian breadth in the `immigrant_refugee` and
`family_support` lanes with strong Atlanta organizations that publish real
volunteer pathways.

## Execution

Applied:

- `database/migrations/318_helpatl_family_refugee_opportunities.sql`

What was added:

- sources:
  - `new-american-pathways`
  - `our-house`
- organizations:
  - `new-american-pathways`
  - `our-house`
- structured opportunities:
  - `new-ap-bright-futures-volunteer`
  - `new-ap-job-ready-english-volunteer`
  - `our-house-meal-host`
  - `our-house-virtual-storyteller`

## Why This Shape

HelpATL was still lighter on:

- refugee-support pathways beyond IRC
- family-support pathways beyond CASA

New American Pathways adds recurring refugee and immigrant-support work. Our
House adds direct family-stability and early-childhood support roles tied to
family homelessness response.

## Verification

Applied migration successfully:

- `DO`
- `INSERT 0 2`
- `INSERT 0 4`
- `REFRESH MATERIALIZED VIEW`

Live HelpATL state after migration:

- active source subscriptions: `39`
- structured `immigrant_refugee` opportunities: `6`
- structured `family_support` opportunities: `3`

Newly visible immigrant/refugee slugs:

- `new-ap-bright-futures-volunteer`
- `new-ap-job-ready-english-volunteer`

Newly visible family-support slugs:

- `our-house-meal-host`
- `our-house-virtual-storyteller`

## Notes

This makes the humanitarian side more balanced across legal aid, housing,
family support, and immigrant/refugee support. The next likely humanitarian
gap is medical / public-health support depth or a stronger survivor-support lane
outside legal services.
