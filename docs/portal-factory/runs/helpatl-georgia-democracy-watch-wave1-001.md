# HelpATL Georgia Democracy Watch Wave 1

Date: 2026-03-10
Portal: `helpatl`
Surface: `consumer`
Scope: statewide civic-process discovery

## Why this run happened

HelpATL already had strong city, county, neighborhood, and school-board institutional lanes, but Georgia-level democracy-process events were still landing only in generic civic-action channels.

The live audit showed a narrow but real set of statewide process items that Atlanta users should be able to follow explicitly:

- State Election Board meetings
- statewide election days

That was enough to justify a dedicated institutional lane, but not a vague catch-all for every Georgia government event.

## Changes shipped

### 1. Added `georgia-democracy-watch` to the source pack

Updated:

- `/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

Channel:

- slug: `georgia-democracy-watch`
- name: `Georgia Democracy Watch`
- type: `jurisdiction`
- sort order: `42`

Rule:

- `expression`
- `any_tags = ["election"]`
- title terms:
  - `state election board`
  - `general primary election`
  - `nonpartisan election`
  - `runoff election`
  - `special election`

This keeps the lane narrow and avoids turning generic activism into fake state-government coverage.

### 2. Added live migration support

Added:

- `/Users/coach/Projects/LostCity/database/migrations/353_helpatl_georgia_democracy_watch_channel.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310024000_helpatl_georgia_democracy_watch_channel.sql`

Behavior:

- inserts or updates the `georgia-democracy-watch` channel on HelpATL
- inserts or reactivates its expression rule

## Verification

### Manifest validation

```bash
python3 -m json.tool docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json >/dev/null

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Result:

- validation passed

### Live apply / provision

```bash
cd /Users/coach/Projects/LostCity
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f /Users/coach/Projects/LostCity/database/migrations/353_helpatl_georgia_democracy_watch_channel.sql

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Result:

- HelpATL active channels: `20`
- HelpATL channel rules: `60`

### Match refresh

Refreshed via `refreshEventChannelMatchesForPortal(...)`.

Result:

- events scanned: `1738`
- matches written: `3563`

## Live outcome

`georgia-democracy-watch` immediately picked up `3` live statewide democracy-process events:

1. `Join us at the March 18 State Election Board Meeting`
2. `General Primary Election/Nonpartisan Election`
3. `General Primary Election/Nonpartisan Eunoff`

This is the right initial scope. It gives HelpATL a real statewide democracy lane without pretending to cover all Georgia institutions yet.

## Current read

HelpATL now has institutional civic lanes for:

- City of Atlanta government
- Fulton County government
- DeKalb County government
- school boards
- neighborhood participation
- Georgia democracy/election process

That is materially closer to “definitive civic participation” than a generic action feed.

## Residual risk

The LWV event title `General Primary Election/Nonpartisan Eunoff` contains a source-side typo. The channel still catches it because `nonpartisan election` is present, but title cleanup should happen upstream if this source continues to matter at the top surface.
