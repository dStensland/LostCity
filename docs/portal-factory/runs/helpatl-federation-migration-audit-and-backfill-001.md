# HelpATL Federation Migration Audit And Backfill 001

Date: 2026-03-10
Owner: Codex
Scope: Federation-critical migration hygiene for HelpATL and shared portal/source/channel infrastructure

## Why this run happened

After reconciling the Supabase migration ledger through `20260310025000`, there was still a reproducibility gap: several active HelpATL federation sources existed only in `database/migrations/` and had no matching `supabase/migrations/` counterpart.

That is a real platform risk because fresh Supabase-led environments could miss source ownership, sharing, subscriptions, and channel rules that the live HelpATL portal depends on.

## Audit result

### Backfill needed

These `database/migrations` were federation-critical and had no Supabase counterpart:

- `301_aps_fulton_school_board_sources.sql`
- `302_marta_army_source.sql`
- `303_atlanta_city_planning_source.sql`
- `305_lwv_atlanta_source.sql`

### Superseded / not backfilled directly

These older HelpATL migrations are not mirrored 1:1 in Supabase, but the missing behavior is already covered by later Supabase migrations or portal provisioning:

- `288_helpatl_community_portal.sql`
  - HelpATL already exists live, and later Supabase migrations cover HelpATL settings/vertical behavior.
- `293_helpatl_civic_source_federation.sql`
  - Later HelpATL federation/channel migrations supersede its original source-transfer/channel-seed behavior.

## What changed

Added a new idempotent Supabase migration:

- `/Users/coach/Projects/LostCity/supabase/migrations/20260310027000_helpatl_federation_source_backfill.sql`

This backfills the missing Supabase-side registration for:

- `atlanta-public-schools-board`
- `fulton-county-schools-board`
- `marta-army`
- `atlanta-city-planning`
- `lwv-atlanta`

The migration ensures:

- `owner_portal_id = helpatl`
- `source_sharing_rules.share_scope = 'all'`
- active Atlanta subscriptions exist
- HelpATL channel rules exist for:
  - `school-board-watch`
  - `education`
  - `transit-mobility`
  - `atlanta-city-government`
  - `civic-engagement`
- supporting venue records exist
- `portal_source_access` is refreshed

## Live application

Applied:

- `/Users/coach/Projects/LostCity/supabase/migrations/20260310027000_helpatl_federation_source_backfill.sql`

Recorded in Supabase ledger:

- `20260310027000 | helpatl_federation_source_backfill`

## Verification

Verified live after apply:

- all five sources are active and HelpATL-owned
- all five have sharing rules
- Atlanta subscriptions exist for all five
- HelpATL channel rules exist for the expected channels

Observed live state:

- `atlanta-city-planning`
  - channels: `atlanta-city-government`, `civic-engagement`, `neighborhood-participation-atl`
- `atlanta-public-schools-board`
  - channels: `school-board-watch`, `education`
- `fulton-county-schools-board`
  - channels: `school-board-watch`, `education`
- `marta-army`
  - channels: `transit-mobility`
- `lwv-atlanta`
  - channels: `civic-engagement`

## Commands run

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f /Users/coach/Projects/LostCity/supabase/migrations/20260310027000_helpatl_federation_source_backfill.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "insert into supabase_migrations.schema_migrations(version,name,statements)
   values ('20260310027000','helpatl_federation_source_backfill',ARRAY[]::text[])
   on conflict (version) do nothing;"
```

## Residual risks

1. The repo still has duplicate Supabase migration timestamps outside this exact backfill path, including:
   - `20260310016000`
   - `20260310022000`
   These are migration-hygiene hazards even when only one of the pair is federation-critical.

2. HelpATL still has more active source subscriptions live than are declared in the current v5 manifest. That is a governance/config drift issue, separate from the migration-ledger issue.

3. Historical non-federation database migrations remain unapplied or unmirrored in Supabase. They should be audited separately so this effort stays focused on portal trust infrastructure first.

## Next move

Do a manifest-vs-live federation audit for HelpATL:

- compare live active source subscriptions to the declared manifest source pack
- classify each extra source as:
  - intentional but undeclared
  - legacy carryover
  - should be removed

That is the cleanest next step for making HelpATL federation deterministic instead of merely functional.
