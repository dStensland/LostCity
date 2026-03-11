# HelpATL Workstream C Policy Watch Wave 1 Implementation 001

- Date: 2026-03-11
- Portal target: `helpatl`
- Execution scope: first-wave policy reporting sources added to the live Atlanta network-source stack
- Decision: `go`

## 1) What shipped

Added two first-wave statewide policy reporting sources to the Atlanta network feed:

1. [Georgia Recorder](https://georgiarecorder.com/)
2. [Capitol Beat](https://capitol-beat.org/)

Migration files:

- [420_atlanta_policy_watch_network_sources.sql](/Users/coach/Projects/LostCity/database/migrations/420_atlanta_policy_watch_network_sources.sql)
- [20260311131300_atlanta_policy_watch_network_sources.sql](/Users/coach/Projects/LostCity/supabase/migrations/20260311131300_atlanta_policy_watch_network_sources.sql)

Live execution:

- direct service-role upsert was used to apply the records in this environment
- [Georgia Recorder](https://georgiarecorder.com/) imported `20` recent posts
- [Capitol Beat](https://capitol-beat.org/) imported `10` recent posts
- Atlanta active network sources increased from `16` to `18`

## 2) Why Atlanta first instead of HelpATL

In the current environment:

- `atlanta` is `active`
- `helpatl` is `draft`

That means the live network-feed path can be extended safely on Atlanta immediately, while HelpATL feed inheritance or direct policy-watch scoping should wait until the portal state is clean again.

## 3) Expected product effect

These sources strengthen the existing network/news architecture with:

1. statewide legislature coverage
2. executive-branch and campaign coverage
3. policy-process reporting that is higher-signal for civic/policy-heavy users

They do **not** yet create a separate HelpATL policy-watch UI. This is a source-layer wave.

## 4) Next step

After feed ingestion is verified:

1. decide whether HelpATL should inherit the Atlanta policy/reporting stack
2. or provision a separate HelpATL-local policy-watch news surface once `helpatl` is active

## 5) Residual risk

This environment does not expose a direct Postgres connection or the `supabase_migrations` schema over the API.

That means:

1. the migration files exist in-repo
2. the source records are live in data
3. but the Supabase migration ledger was **not** updated here

This should be reconciled the next time a direct migration-apply path is available.
