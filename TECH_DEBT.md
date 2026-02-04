# Tech Debt

Tracked items to address post-launch.

## 1. ~40 `(supabase as any)` casts suppress TypeScript type safety

Scattered across `lib/portal.ts`, `lib/unified-search.ts`, `lib/federation.ts`, API routes, and page components. These bypass type checking on the entire Supabase query chain, meaning schema changes (renamed columns, new tables) won't be caught at compile time.

**Fix:** Replace with the `AnySupabase` type from `lib/api-utils.ts` or generate proper Supabase types with `supabase gen types typescript`.

**Risk:** Low until you change the DB schema, then it becomes high.

## 2. No migration tracking

There's no record of which SQL migrations have been applied to the database. The `database/migrations/` directory has 115+ files with inconsistent naming. Applying migrations is manual via `psql` or `run_migration.js`.

**Fix:** Either:
- Use `supabase db push` with the Supabase CLI migration system
- Add a `schema_migrations` table that records applied migration filenames + timestamps
- Adopt a proper migration tool (Prisma, Drizzle, or just the Supabase CLI)

**Risk:** Medium. Will cause confusion and potential outages when someone forgets to run a migration or runs one twice (most are idempotent with IF NOT EXISTS, but not all).
