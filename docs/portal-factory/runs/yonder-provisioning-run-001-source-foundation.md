# Yonder Provisioning Run 001 — Source Foundation

- Date: 2026-03-10
- Portal slug: `yonder`
- Manifest: `docs/portal-factory/manifests/yonder-adventure-v1.json`
- Decision: `provisioned as draft, core source pack viable, REI still blocked`

## What Shipped

1. Registered four missing Atlanta-owned adventure sources through migration:
   - `atlanta-outdoor-club`
   - `blk-hiking-club`
   - `rei-atlanta`
   - `atlanta-parks-rec`
2. Ensured source-sharing rules so future child portals can consume them.
3. Provisioned the first draft `yonder` portal from the portal-factory manifest.

## Validation

Passed:

```bash
python3 -m json.tool /Users/coach/Projects/LostCity/docs/portal-factory/manifests/yonder-adventure-v1.json

cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/yonder-adventure-v1.json --skip-db
npx tsx scripts/portal-factory/validate-source-pack.ts --manifest ../docs/portal-factory/manifests/yonder-adventure-v1.json
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/yonder-adventure-v1.json --dry-run
npx tsx scripts/portal-factory/provision-portal.ts --manifest ../docs/portal-factory/manifests/yonder-adventure-v1.json
```

Migration execution:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /Users/coach/Projects/LostCity/database/migrations/342_yonder_source_pack_foundation.sql
```

## Provisioning Result

Provisioned state after follow-up cleanup:

- portal status: `draft`
- parent portal: `atlanta`
- active source subscriptions: `11`
- active channels: `6`
- channel rules: `17`

Manifest structure is valid and the portal-factory path is working.

## Dry-Run Crawler Quality

The newly registered source rows are no longer the main problem. Three were recovered to usable state.

### `atlanta-outdoor-club`

- result: recovered
- read: crawler rewritten to parse the server-rendered event table plus detail pages
- observed signal: `125` future event rows on the live listing

### `blk-hiking-club`

- result: `2 found, 2 new, 0 updated`
- read: crawler rewritten to use schema.org `Event` JSON-LD from Squarespace detail pages, then hardened to synthesize usable event titles when Squarespace only exposed the venue name

### `rei-atlanta`

- result: hard failure
- error: `Page.goto: net::ERR_HTTP2_PROTOCOL_ERROR`
- read: crawler needs transport / browser hardening before inclusion in any live promise
- action taken: removed from the v1 manifest, then the draft Yonder portal was re-provisioned and the subscription was deactivated

### `atlanta-parks-rec`

- result: recovered
- read: source now delegates to the stronger `atlanta_dpr.py` ACTIVENet crawler rather than the weak calendar scraper
- follow-up decision: removed from the active Yonder v1 pack because qualification showed broad rec-program inventory that does not fit the core adventure thesis

## Strategic Read

This run successfully solved the provisioning problem.

It solved most of the first-pass source-quality problem too.

That distinction matters:

1. Yonder can now be provisioned repeatably through the portal-factory system.
2. Yonder still should remain a draft portal until REI is either fixed or replaced.
3. The next highest-leverage work is narrow crawler hardening, not more portal configuration.

## Immediate Next Moves

1. Repair or replace `rei-atlanta`.
2. Improve venue completeness for:
   - `crawlers/sources/atlanta_outdoor_club.py`
   - `crawlers/sources/blk_hiking_club.py`
3. Re-provision Yonder only when a deliberate activation decision is made.
