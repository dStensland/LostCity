# HelpATL Live Restore 001

- Date: 2026-03-11
- Portal slug: `helpatl`
- Scope: restore the missing live HelpATL portal row and re-provision current portal config

## Trigger

Wave 1 competitive-health QA found:

1. `https://lostcity.ai/helpatl` renders a not-found page
2. `https://lostcity.ai/helpatl/support` returns `404`
3. `https://lostcity.ai/api/portals/helpatl/city-pulse` returns `404`

Repo diagnosis:

1. local page route is generic and only 404s when portal lookup fails
2. current database state contains `atlanta` and `forth`, but no `helpatl` row
3. repo has an older database migration that creates HelpATL
4. current Supabase migration chain contains later HelpATL updates and subscriptions, but no matching portal-creation migration

## Root Cause

Migration/provisioning drift.

Fresh or partially synced environments can apply later HelpATL follow-on migrations while never creating the base `portals.slug = 'helpatl'` row.

## Repo Fix

Added idempotent backfill migrations:

1. `/Users/coach/Projects/LostCity/database/migrations/376_helpatl_portal_backfill.sql`
2. `/Users/coach/Projects/LostCity/supabase/migrations/20260311120000_helpatl_portal_backfill.sql`

These restore the base portal row and minimum current settings required for route resolution.

## Required Operational Restore

After applying migrations, rerun provisioning so the skipped source/channel work is restored:

```bash
cd /Users/coach/Projects/LostCity/web
npx tsx scripts/portal-factory/provision-portal.ts \
  --manifest ../docs/portal-factory/manifests/atlanta-civic-humanitarian-v5.json \
  --activate
```

## Verification

After apply + re-provision:

```bash
curl -I https://lostcity.ai/helpatl
curl -I https://lostcity.ai/helpatl/support
curl -I https://lostcity.ai/api/portals/helpatl/city-pulse
```

Expected:

1. portal route returns `200`
2. support route no longer returns `404`
3. city-pulse endpoint no longer returns `404`

Recommended follow-up:

```bash
cd /Users/coach/Projects/LostCity/web
npm run test -- \
  lib/portal-attribution-guard.test.ts \
  lib/portal-attribution.test.ts \
  app/api/volunteer/engagements/route.test.ts \
  app/api/volunteer/engagements/[id]/route.test.ts \
  lib/forth-data.test.ts \
  app/api/itineraries/route.test.ts
```

## Notes

This repair restores the missing base portal row, but the real product fix is the re-provisioning step. Later HelpATL subscriptions/channels/settings migrations were already written assuming the portal existed.
