# HelpATL Volunteer Breadth Execution

Date: 2026-03-09

## Goal

Tighten HelpATL back to the original mission:

- excellent metro Atlanta volunteer discovery
- strongest on drop-in opportunities
- still credible on longer-term commitments
- broader humanitarian and civic breadth

## Changes

- Expanded the HelpATL manifest source pack to include:
  - `medshare`
  - `atlanta-humane-society`
  - `lifeline-animal-project`
  - `marta-board`
- Broadened:
  - `Volunteer This Week`
  - `Ongoing Opportunities`
- Updated `Government Meetings` copy to explicitly include transit boards.

## Federation Fix

Found and fixed a root-cause federation problem:

- `medshare` was subscribed by HelpATL
- but lacked a `source_sharing_rules` row
- so it did not materialize into `portal_source_access`

Added mirrored migrations:

- `database/migrations/307_medshare_source_federation.sql`
- `supabase/migrations/20260309910000_medshare_source_federation.sql`

Applied the DB migration and refreshed `portal_source_access`.

## Verification

- source-pack validation passed
- portal provisioning dry run passed
- write provisioning completed
- MedShare access confirmed in `portal_source_access`
- event-channel refresh completed:
  - `eventsScanned: 1516`
  - `channelsConsidered: 17`
  - `matchesWritten: 2902`

## Outcome

HelpATL active subscriptions:

- before: `19`
- after: `23`

New next-30-day accessible breadth counts:

- `medshare`: `24`
- `marta-board`: `7`
- `atlanta-humane-society`: `6`
- `lifeline-animal-project`: `2`

Updated lane totals after refresh:

- `volunteer-this-week-atl`: `1176`
- `ongoing-opportunities-atl`: `62`
- `commit-to-a-cause-atl`: `8`

## Remaining Breadth Gaps

Still not live in HelpATL:

- `hope-atlanta`
- `irc-atlanta`
- `atlanta-legal-aid`

These are the next strongest breadth additions because they would add:

- homelessness and housing-system support
- refugee and immigrant support
- legal clinics and rights-oriented community service
