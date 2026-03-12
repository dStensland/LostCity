# Portal Factory Structured Source Contract Docs 001

Date: 2026-03-10
Owner: Codex
Scope: Shared portal-factory process documentation

## Why this run happened

HelpATL now uses two distinct source inventories:

1. `Live Event Sources`
2. `Ongoing Opportunity Sources`

The portal-factory tooling already supports that distinction. The shared docs needed to catch up so future portal work does not collapse the two models back together.

## Updated docs

- `/Users/coach/Projects/LostCity/docs/portal-factory/PROVISIONING_PROCESS.md`
- `/Users/coach/Projects/LostCity/docs/portal-factory/README.md`
- `/Users/coach/Projects/LostCity/docs/portal-factory/templates/06-provisioning-readiness-gate.md`
- `/Users/coach/Projects/LostCity/docs/portal-factory/PORTAL_CAPABILITY_CATALOG.md`

## Contract now documented

### `Live Event Sources`

- declared in `source_subscriptions`
- must be crawlable
- must be active in `sources`
- is provisioned as subscriptions

### `Ongoing Opportunity Sources`

- declared in `structured_opportunity_sources`
- does not need crawlability
- must be active in `sources`
- must be accessible through `portal_source_access`
- is not treated as an event source-pack subscription requirement

## Verification

Docs-only change. No code/test execution was required in this step.

## Next move

When another portal gains structured opportunities, use the same explicit manifest split instead of allowing live owned sources to drift outside the declared provisioning contract.
