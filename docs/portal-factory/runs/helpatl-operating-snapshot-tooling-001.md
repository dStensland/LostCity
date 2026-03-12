# HelpATL Operating Snapshot Tooling 001

- Date: 2026-03-11
- Portal: `helpatl`
- Goal: replace ad hoc portal-health SQL checks with a repeatable snapshot script

## What shipped

Added a reusable portal-health snapshot script:

- [snapshot-portal-health.ts](/Users/coach/Projects/LostCity/web/scripts/portal-factory/snapshot-portal-health.ts)

The script reports:
- portal status
- `Live Event Sources`
- accessible live-event-source count
- active channels
- materialized event-channel matches
- `Volunteer This Week` next-7-day and next-30-day counts
- `Georgia Democracy Watch` next-30-day count
- active ongoing opportunities and role mix
- top ongoing-opportunity causes
- local and resolved policy/news post counts
- local/parent policy-source counts and feed inheritance shape

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npm run lint -- 'scripts/portal-factory/snapshot-portal-health.ts'
npx tsx scripts/portal-factory/snapshot-portal-health.ts helpatl
```

## Current HelpATL snapshot

Script output:

```text
Portal health snapshot: helpatl
  Status: active
  Live Event Sources: 37
  Accessible Live Event Sources: 66
  Active Channels: 20
  Event-Channel Matches: 2960
  Volunteer This Week (next 7d): 336
  Volunteer This Week (next 30d): 992
  Georgia Democracy Watch (next 30d): 21
  Active Ongoing Opportunities: 61
  Ongoing Role Mix: total=61, ongoing=55, lead=6
  Top Causes: civic_engagement 24, family_support 8, immigrant_refugee 6, education 4, housing 4
  Local Policy Posts (30d): 51
  Resolved Policy Posts (30d): 229
  Local Policy Sources: 4
  Parent Policy Sources: 21
  Policy Feed Portals: helpatl, atlanta
```

## Read

This is the first clean “operate mode” snapshot for HelpATL after closing the statewide-process authority gap. It gives the portal a stable baseline for future content-health reviews without needing one-off SQL work each time.
