# HelpATL Support Gap Fill Wave 2

- Date: 2026-03-11
- Portal: `helpatl`
- Workstream: `Support Directory Gap Fill`
- Goal: raise `Work, Money & Daily Life` from `11` organizations to `20+` without adding low-trust directory noise

## What changed

Added or widened trustworthy metro Atlanta coverage for:

- workforce and job readiness
- benefits / financial coaching
- transportation access
- adult education

New or newly represented organizations in the lane:

- `Center for Working Families`
- `First Step Staffing`
- `JF&CS Atlanta`
- `Per Scholas Atlanta`
- `Operation HOPE`
- `MARTA Mobility`
- `Atlanta Technical College Adult Education`

Also widened existing lane coverage using already trusted organizations:

- `Urban League of Greater Atlanta`
- `Latin American Association`

## Implementation notes

- dedupe now uses normalized `name + url` instead of raw item IDs alone
- support-directory stats now count unique organizations by normalized identity
- this avoids overstating breadth when the same organization appears in multiple tracks

## Result

- `Work, Money & Daily Life`: `11 -> 20`
- target met without adding generic directory spam

## Verification run

1. Checked live URLs for the newly added organizations
2. Ran:
   - `npm run lint -- 'lib/support-source-policy.ts' 'lib/helpatl-support-directory.ts' 'lib/helpatl-support-directory.test.ts'`
   - `npm run test -- lib/helpatl-support-directory.test.ts lib/support-source-policy.test.ts`
3. Verified section counts with:
   - `npx tsx -e "import { getHelpAtlSupportDirectorySections } from './lib/helpatl-support-directory'; ..."`
