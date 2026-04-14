# Database tests (pgTAP)

Run inside a Supabase local dev Postgres with the `pgtap` extension enabled.

## Running

```bash
./run-pgtap.sh search_unified.pgtap.sql
```

## Conventions

- One file per tested RPC/function/trigger
- Filename: `<function_name>.pgtap.sql`
- Begin with `BEGIN; SELECT plan(N);` where N is the number of assertions
- End with `SELECT * FROM finish(); ROLLBACK;` to auto-clean
- Use `gen_random_uuid()` for test fixtures where UUIDs are needed
- Every schema migration or data migration that includes a new RPC MUST ship a matching pgTAP test before the migration merges
