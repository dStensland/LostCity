# HelpATL Federation Migration Ledger Reconcile 001

Date: 2026-03-10
Portal: `helpatl`
Scope: migration ledger hygiene for federation-era civic/HelpATL work

## Why this run happened

The live database had a real split between:

- SQL state, which had been advanced by direct `psql` runs
- `supabase_migrations.schema_migrations`, which still stopped at `20260310016000`

That made migration drift look worse and more ambiguous than it really was.

For HelpATL and civic federation work, this is risky because portal/source/channel changes need to remain reproducible and attributable.

## What was reconciled

I re-applied and then backfilled the federation-relevant Supabase migration versions from:

- `20260310017000`
- through `20260310025000`

Specifically:

1. `20260310017000_helpatl_georgia_equality_subscription.sql`
2. `20260310018000_helpatl_indivisible_atl_source.sql`
3. `20260310019000_indivisible_ticket_url_cleanup.sql`
4. `20260310020000_helpatl_fulton_expression_rule.sql`
5. `20260310021000_helpatl_atlanta_city_expression_rule.sql`
6. `20260310022000_helpatl_school_board_tag_rule_reactivate.sql`
7. `20260310023000_helpatl_city_fulton_expression_rule_reactivate.sql`
8. `20260310024000_helpatl_georgia_democracy_watch_channel.sql`
9. `20260310025000_lwv_runoff_title_cleanup.sql`

## Actions taken

### 1. Replayed the missing Supabase migration files

Applied directly with `psql` against the live DB.

Result:

- all 9 completed successfully
- no federation regressions surfaced

### 2. Backfilled the migration ledger

Inserted matching version/name rows into:

- `supabase_migrations.schema_migrations`

Result:

- all 9 versions are now present in the ledger

## Verification

### Ledger check

Verified the following rows now exist:

- `20260310017000 | helpatl_georgia_equality_subscription`
- `20260310018000 | helpatl_indivisible_atl_source`
- `20260310019000 | indivisible_ticket_url_cleanup`
- `20260310020000 | helpatl_fulton_expression_rule`
- `20260310021000 | helpatl_atlanta_city_expression_rule`
- `20260310022000 | helpatl_school_board_tag_rule_reactivate`
- `20260310023000 | helpatl_city_fulton_expression_rule_reactivate`
- `20260310024000 | helpatl_georgia_democracy_watch_channel`
- `20260310025000 | lwv_runoff_title_cleanup`

### Portal state check

HelpATL still resolves cleanly after replay/backfill:

- active source subscriptions: `59`
- active channels: `20`

Key active channels still present:

- `atlanta-city-government`
- `fulton-county-government`
- `dekalb-county-government`
- `school-board-watch`
- `georgia-democracy-watch`
- `neighborhood-participation-atl`
- `civic-training-action-atl`
- `volunteer-this-week-atl`

### Contract tests

Passed:

- `lib/portal-scope.test.ts`
- `lib/portal-attribution-guard.test.ts`
- `lib/portal-query-context.test.ts`
- `lib/interest-channel-matches.test.ts`
- `lib/interest-channels.test.ts`

## Important read

This run reconciles the federation-era HelpATL/civic migration subset.

It does **not** mean the entire repository's migration history is fully normalized. There are still older and unrelated migration-ledger gaps outside this scope.

But the critical civic/portal federation path is now in a much better state:

- live SQL state is aligned
- the Supabase migration ledger reflects the applied HelpATL civic versions
- future diffs in this area will be more trustworthy

## Recommended next move

Do a separate migration-hygiene audit with two explicit buckets:

1. `federation-critical`
   - portals
   - sources
   - portal_source_access
   - interest_channels
   - event_channel_matches

2. `non-federation`
   - profile
   - festival
   - kid/family
   - unrelated venue/program tracks

That keeps the migration cleanup effort proportional and avoids mixing platform trust work with unrelated backlog migrations.
