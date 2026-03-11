# HelpATL Structured Source Inventory Tooling 001

Date: 2026-03-10
Owner: Codex
Scope: Portal-factory manifest and validation tooling

## Why this run happened

HelpATL now has two valid source inventories:

1. `Live Event Sources`
2. `Ongoing Opportunity Sources`

Before this run, the tooling only understood the first one. That made the second inventory either invisible or incorrectly treated as a crawlability problem.

## What changed

Added a new optional manifest field:

- `structured_opportunity_sources.source_slugs`

Updated portal-factory tooling so the distinction is explicit:

- `/Users/coach/Projects/LostCity/web/scripts/portal-factory/manifest-utils.ts`
- `/Users/coach/Projects/LostCity/web/scripts/portal-factory/source-pack-utils.ts`
- `/Users/coach/Projects/LostCity/web/scripts/portal-factory/validate-source-pack.ts`
- `/Users/coach/Projects/LostCity/web/scripts/portal-factory/provision-portal.ts`

Updated the HelpATL manifest to declare its structured-opportunity backing inventory:

- `/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

Added tests:

- `/Users/coach/Projects/LostCity/web/scripts/portal-factory/manifest-utils.test.ts`

## Validation behavior now

### `Live Event Sources`

Still treated as the crawlable event pack:

- must be crawlable locally
- must exist in `sources`
- must be active

Technical key: `source_subscriptions`

### `Ongoing Opportunity Sources`

Now treated as portal-access inventory:

- do not need crawler modules or profiles
- must exist in `sources`
- must be active
- must be accessible to the portal through `portal_source_access`

Technical key: `structured_opportunity_sources`

## HelpATL inventory declared

HelpATL now explicitly declares these `Ongoing Opportunity Sources`:

- `atlanta-boards-commissions`
- `atlanta-victim-assistance`
- `avlf`
- `cobb-county-elections`
- `dekalb-county-elections`
- `dekalb-medical-reserve-corps`
- `fulton-county-elections`
- `gwinnett-county-elections`
- `new-american-pathways`
- `our-house`
- `pad-atlanta`
- `partnership-against-domestic-violence`
- `red-cross-georgia`

## Verification

Passed:

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- scripts/portal-factory/manifest-utils.test.ts
npm run lint -- 'scripts/portal-factory/manifest-utils.ts' 'scripts/portal-factory/source-pack-utils.ts' 'scripts/portal-factory/validate-source-pack.ts' 'scripts/portal-factory/provision-portal.ts' 'scripts/portal-factory/manifest-utils.test.ts'
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Observed result:

- `Live Event Sources`: `34`
- `Ongoing Opportunity Sources`: `13`
- all `13` accessible to HelpATL
- provisioning still completes with:
  - active source subscriptions: `34`
  - active channels: `20`
  - channel rules: `65`

## Strategic result

The source model is now explicit:

- `source_subscriptions` defines `Live Event Sources`
- `structured_opportunity_sources` defines `Ongoing Opportunity Sources`

That removes the pressure to fake crawlability or keep redundant subscriptions just to satisfy tooling.
