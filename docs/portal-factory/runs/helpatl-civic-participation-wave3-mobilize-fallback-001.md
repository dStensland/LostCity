# HelpATL Civic Participation Wave 3 Mobilize Fallback 001

- Date: 2026-03-09
- Portal slug: `helpatl`
- Manifest: `docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`
- Decision: `go`

## Objective

Deepen the civic participation lane while the official `atlanta-municipal-clerk` source remains blocked by `403 Access Denied`.

Rather than waiting on an inaccessible official page, this wave adds `mobilize-us` to the HelpATL civic participation surface as a fallback source for action days, hearings, rallies, and civic mobilization.

## Why Mobilize

Measured next-30-day signal before rollout:

- `mobilize-us: 14`

Representative upcoming inventory:

1. `Young People's Hearing`
2. `Fulton County: Join us for the Board of Registrations and Elections Meeting`
3. `Youth at the Capitol`
4. `Hands Off Africa March and Rally`
5. `NO KINGS Atlanta`

This is not a substitute for official boards-and-commissions coverage, but it is a strong participation-layer fallback.

## What Changed

Updated HelpATL manifest to add `mobilize-us` to:

1. source subscriptions
2. `Civic Training & Action` section
3. `civic-training-action-atl` channel rule family

Files:

1. `docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

## Validation

Passed:

```bash
python3 -m json.tool /Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json

cd /Users/coach/Projects/LostCity/crawlers
python3 main.py --source mobilize-us --dry-run

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --dry-run
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

## Resulting HelpATL State

After provisioning:

- active source subscriptions: `30`
- active channels: `19`
- channel rules: `53`

After refresh:

- `eventsScanned: 1534`
- `matchesWritten: 3083`

## Read

This wave improves the source-backed civic participation surface, but it did not materially change the stored `civic-training-action-atl` channel count.

Current channel count remains:

- `civic-training-action-atl: 24`

The source mix there still shows:

- `marta-army: 14`
- `civic-innovation-atl: 5`
- `common-cause-georgia: 3`
- `lwv-atlanta: 2`

## Important Note

`mobilize-us` events are already matching the older `civic-engagement` cause channel, but they are not yet materializing into `civic-training-action-atl` despite the updated source rule.

That points to a legacy channel/matcher inconsistency, not a source-pack problem.

This does **not** block the source-backed section rollout, but it does mean the channel taxonomy now has technical debt:

1. source-backed portal sections are more current than some legacy interest channels
2. `civic-engagement` and `civic-training-action-atl` overlap in practice

## Remaining Blocker

The official `atlanta-municipal-clerk` source remains blocked:

- public notices page: `403`
- BACE meeting agendas page: `403`
- BACE landing page: `403`

## Next Move

Two valid next steps:

1. fix the legacy channel matcher/taxonomy so `mobilize-us` flows into `civic-training-action-atl` cleanly
2. keep pushing on an official municipal-clerk access path and onboard boards/commissions once the source is crawlable
