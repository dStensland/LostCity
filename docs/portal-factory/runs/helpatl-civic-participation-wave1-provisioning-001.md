# HelpATL Civic Participation Wave 1 Provisioning 001

- Date: 2026-03-09
- Portal slug: `helpatl`
- Manifest: `docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json`
- Decision: `go`

## What Shipped

Added the first civic participation source wave to HelpATL:

1. `atlanta-city-planning`
2. `marta-army`
3. `civic-innovation-atl`
4. `lwv-atlanta`

Added two new visible sections:

1. `Neighborhood Participation`
2. `Civic Training & Action`

Added two new channels:

1. `neighborhood-participation-atl`
2. `civic-training-action-atl`

## Validation

Passed:

```bash
python3 -m json.tool /Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json --skip-db
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json --dry-run
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v3.json
```

Dry-run diff:

- source subscriptions `insert=4`
- sections `insert=2, update=5`
- channels `insert=2, update=7`

## Resulting HelpATL State

After provisioning:

- active source subscriptions: `28`
- active channels: `19`
- channel rules: `51`

After channel refresh:

- `eventsScanned: 1530`
- `matchesWritten: 3077`

Previous total event-channel matches: `2906`

Net new matched inventory after refresh: `+171`

## Section Stack

Visible HelpATL sections after Wave 1:

1. `Volunteer This Week`
2. `Ongoing Opportunities`
3. `Commit to a Cause`
4. `Neighborhood Participation`
5. `Civic Training & Action`
6. `Government Meetings`
7. `School Board Watch`

## New Channel Inventory

### `neighborhood-participation-atl`

- total matches: `138`
- source attribution:
  - `atlanta-city-planning: 138`

### `civic-training-action-atl`

- total matches: `21`
- source attribution:
  - `marta-army: 14`
  - `civic-innovation-atl: 5`
  - `lwv-atlanta: 2`

## Measured Source Signal Used For Rollout

Next-30-day source counts before provisioning:

- `atlanta-city-planning: 37`
- `marta-army: 7`
- `civic-innovation-atl: 2`
- `lwv-atlanta: 0`

## Read

Wave 1 is successful.

HelpATL now has a real civic participation layer without waiting on the full NPU or boards-and-commissions system. The strongest immediate gain is `Neighborhood Participation`, driven by the Atlanta city planning source and its NPU / hearing inventory. `Civic Training & Action` is smaller, but it is already multi-source and clearly distinct from the government-meeting lanes.

## Next Move

The next highest-leverage source owner is `atlanta-municipal-clerk`, followed by `common-cause-georgia` and `canopy-atlanta-documenters`.
