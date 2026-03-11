# HelpATL Activation And Atlanta Network Tone Pass 001

- Date: 2026-03-11
- Scope: activate `helpatl` and keep the Atlanta city feed lighter while HelpATL continues to inherit the broader network source pool
- Decision: `go`

## What changed

### 1. HelpATL is active again

Activated from:

- [atlanta-civic-humanitarian-v5.json](/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json)

Verification after provision:

- `helpatl`: `active`
- `atlanta`: `active`
- `helpatl` active source subscriptions: `34`
- `helpatl` active channels: `20`

### 2. HelpATL network-feed inheritance is working

Current network-feed resolution:

- `helpatl` local active network sources: `0`
- `helpatl` inherited parent sources: `18`
- resolved feed portal: `atlanta`
- resolved posts in last `30` days: `180`

### 3. Atlanta now promotes a lighter network tone on the home feed

Files changed:

- [CityPulseShell.tsx](/Users/coach/Projects/LostCity/web/components/feed/CityPulseShell.tsx)
- [NetworkFeedSection.tsx](/Users/coach/Projects/LostCity/web/components/feed/sections/NetworkFeedSection.tsx)

Behavior:

- Atlanta’s city feed network section now defaults to `culture`
- Atlanta’s visible network tabs on the home feed are narrowed to:
  - `news`
  - `culture`
  - `arts`
  - `food`
  - `music`
  - `community`
- This keeps Atlanta’s top teaser less policy-heavy without changing HelpATL inheritance

## Why this shape

Today’s network-feed architecture does not merge local child-portal news sources with parent-portal news sources. It resolves to:

1. local sources if the child has any
2. otherwise the parent’s sources

So the pragmatic move was:

1. keep the broader source pool on Atlanta for now
2. let HelpATL inherit it
3. make Atlanta’s top feed presentation lighter through category defaults

## Verification

Commands run:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json --activate
npx tsx scripts/portal-factory/validate-network-feed-inheritance.ts helpatl,atlanta
npm run lint -- 'components/feed/CityPulseShell.tsx' 'components/feed/sections/NetworkFeedSection.tsx'
```

## Residual limitation

This does **not** give Atlanta and HelpATL fully independent source sets yet.

If we want:

- Atlanta = lighter lifestyle/city mix
- HelpATL = heavier civic/policy mix

at the source level, not just presentation level, we need a network-source access/merge model instead of the current local-or-parent resolution.
