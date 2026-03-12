# HelpATL Manifest Live Source Reconcile 001

Date: 2026-03-10
Owner: Codex
Scope: HelpATL federation determinism and source-pack governance

## Why this run happened

After the active-only baseline reset, HelpATL had more live active source subscriptions than the current source-pack manifest declared.

That is a governance problem because the portal was functional but no longer declarative:

- manifest source pack: `34`
- live active HelpATL subscriptions: `48`

## Audit result

### Declared and live

The manifest was not missing any live crawlable source-pack slug.

### Live extras

There were `14` extra live subscriptions:

- `atlanta-boards-commissions`
- `atlanta-toolbank`
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

### Classification

1. `atlanta-toolbank`
   - legacy carryover
   - active future events: `0`
   - active structured opportunities: `0`
   - should be removed from HelpATL subscriptions

2. Remaining `13` extras
   - not crawlable source-pack dependencies
   - all are HelpATL-owned sources
   - all remain accessible to HelpATL through `portal_source_access` via ownership
   - these are structured-opportunity backing sources, not event-source-pack subscriptions
   - they should **not** be declared in the manifest source pack
   - they should **not** remain as redundant HelpATL self-subscriptions

## What changed

### Manifest

Kept the source-pack manifest scoped to the real crawlable pack:

- `/Users/coach/Projects/LostCity/docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json`

### Cleanup migrations

Added:

- `/Users/coach/Projects/LostCity/database/migrations/364_helpatl_manifest_live_source_reconcile.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310028000_helpatl_manifest_live_source_reconcile.sql`

This deactivates the dead `atlanta-toolbank` HelpATL subscription.

Added:

- `/Users/coach/Projects/LostCity/database/migrations/365_helpatl_redundant_owned_source_subscriptions_cleanup.sql`
- `/Users/coach/Projects/LostCity/supabase/migrations/20260310029000_helpatl_redundant_owned_source_subscriptions_cleanup.sql`

This deactivates the `13` redundant owned-source self-subscriptions.

## Live apply

Applied:

- `20260310028000 | helpatl_manifest_live_source_reconcile`
- `20260310029000 | helpatl_redundant_owned_source_subscriptions_cleanup`

Both were inserted into `supabase_migrations.schema_migrations`.

## Verification

### Source-pack validation

Validated:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Result: passed with `34` crawlable source slugs.

### Provisioning

Reprovisioned:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json
```

Result:

- active source subscriptions: `34`
- active channels: `20`
- channel rules: `65`
- event-channel matches: `2783`

### Determinism restored

After cleanup:

- live active HelpATL subscriptions: `34`
- manifest source-pack slugs: `34`
- diff: none

### Structured opportunity safety check

The `13` removed self-subscription sources remain accessible through ownership and still back active HelpATL structured opportunities:

- all `13` remain present in `portal_source_access` for HelpATL
- active HelpATL structured opportunities remain `61`
- those `13` sources still back `22` active structured roles total

## Strategic read

This is the correct shape:

- `source_subscriptions` in the manifest define the crawlable event source pack
- HelpATL-owned structured-opportunity sources should rely on ownership, not redundant self-subscriptions

That keeps the portal declarative without teaching the event source-pack tooling to accept non-crawlable placeholders.

## Next move

Split HelpATL source governance into two explicit inventories:

1. event source pack
   - crawlable
   - provisioned via manifest `source_subscriptions`

2. structured opportunity backing sources
   - owned source registry
   - not validated as crawlable source-pack entries

That would make this distinction explicit in tooling instead of implicit in runtime behavior.
