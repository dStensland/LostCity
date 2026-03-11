# HelpATL Volunteer Admin Ops Phase 2.2

Date: 2026-03-09

## Goal

Make the volunteer ops dashboard usable for real triage by giving operators a sortable queue instead of a flat inventory table.

## What Changed

- Added client-side queue controls to `/{portal}/admin/volunteer`:
  - search by role, organization, or source
  - quality-state filter
  - commitment-level filter
  - source filter
  - sort options led by `needs attention first`
- Reworked the `Needs Attention` list to respect queue filters and sort order.
- Added per-role recommended action copy for:
  - stale
  - low-conversion
  - no-interest

## Operator Outcome

Portal operators can now quickly answer:

- Which roles are stale right now?
- Which roles are getting interest but failing to convert to apply clicks?
- Which source or commitment lane is weakest?
- Which specific role should I fix first?

## Verification

- `cd web && npm run lint -- app/[portal]/admin/volunteer/page.tsx`
- `cd web && npm run test -- lib/interest-channels.test.ts lib/interest-channel-matches.test.ts lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts`
