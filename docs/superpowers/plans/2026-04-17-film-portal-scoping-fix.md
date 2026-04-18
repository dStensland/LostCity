# Film Portal Scoping Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the data-layer bug that breaks all 4 film API routes. All loaders currently query `places.portal_id` but `places` has no such column — scoping is city-level, not portal-level. Add `portal_id` directly to `screening_runs` and migrate the 4 loaders to filter there.

**Architecture:** `screening_runs` is the natural carrier of portal scoping for film (a run at Plaza Theatre belongs to Atlanta portal; runs aren't city-wide the way places are). Add `portal_id UUID REFERENCES portals(id)` to `screening_runs`, backfill existing rows to Atlanta, make the column NOT NULL, update all 4 loaders to filter `screening_runs.portal_id = {portalId}` instead of the broken `places.portal_id` filter. Add a minimal integration-style smoke test per loader that exercises the real query shape against a Supabase mock wrapped in the actual PostgREST response format.

**Tech Stack:** Supabase Postgres migration + supabase/migrations mirror, existing loader files in `web/lib/film/`, Vitest.

---

## Root cause + evidence

- All 4 film loaders (`this-week-loader.ts`, `today-playbill-loader.ts`, `date-counts-loader.ts`, `by-film-loader.ts`) include a `.eq('places.portal_id', portalId)` or in-memory filter on `places.portal_id`.
- `places` has NO `portal_id` column. This is explicitly documented:
  - `database/migrations/20260413000007_search_unified.sql:31` — *"places (not venues) has NO portal_id — venue scoping uses a subquery through events"*
  - `database/CLAUDE.md` — *"Portal scoping for places: city-based (places table has no portal_id column)"*
- Live endpoint response: `{"error":"loadThisWeek query failed: column places_1.portal_id does not exist"}`
- Seeded screening data (migrations 608, 609) inserts into `screening_runs` + `screening_times` but NOT into `events`. So scoping via `screening_times.event_id → events.portal_id` would drop all seeded rows (event_id is null).
- Tests in PRs #35, #36, #37, #39, #41 all passed because Supabase is mocked in Vitest.

## Why add `portal_id` to `screening_runs` (not places, not via events)

- `places` is city-level by explicit architectural choice — don't retrofit.
- `events.portal_id` scoping requires every screening to have `event_id`, which seeded data doesn't have, and which crawlers aren't guaranteed to populate.
- `screening_runs` is the right grain: a "run" of a film at a specific venue for a specific date range inherently belongs to one portal. This matches how `events`, `exhibitions`, `programs`, `interest_channels` all carry `portal_id` directly.
- Backfill is trivial — every current row is Atlanta.

## File structure

**Create (migrations):**
- `database/migrations/610_film_screening_runs_portal_id.sql` — ADD COLUMN + backfill + NOT NULL + index
- `supabase/migrations/20260417230000_film_screening_runs_portal_id.sql` — paired mirror (per migration parity rules)

**Modify (loaders):**
- `web/lib/film/this-week-loader.ts` — swap portal filter
- `web/lib/film/today-playbill-loader.ts` — swap portal filter
- `web/lib/film/date-counts-loader.ts` — swap portal filter
- `web/lib/film/by-film-loader.ts` — swap portal filter

**Modify (seed migrations):**
- `database/migrations/608_film_venue_classification.sql` — if it inserts into `screening_runs`, include portal_id. **Pre-check:** audit the seed. If 608 only inserts into `places`, leave it alone.
- `database/migrations/609_film_editorial_seed.sql` — ditto

**Modify (types, if needed):**
- `web/lib/film/types.ts` — no user-facing type change; `screening_runs` is an internal row shape

**Tests (create):**
- Each loader's existing test file currently uses `vi.mock` at the route level. Add one test per loader that constructs a full mock Supabase query builder and asserts the `.eq('screening_runs.portal_id', ...)` call is present (not `.eq('places.portal_id', ...)`). This is a regression test — it doesn't exercise the DB, but it does catch the exact bug pattern next time.

---

## Task 1: Audit the seed migrations

**Files:** none modified — read-only

- [ ] **Step 1: Check migration 608**

Run: `grep -n "INSERT INTO screening_runs\|INSERT INTO places\|INSERT INTO screening_times" database/migrations/608_film_venue_classification.sql`

Record which tables it writes to.

- [ ] **Step 2: Check migration 609**

Run: `grep -n "INSERT INTO screening_runs\|INSERT INTO places\|INSERT INTO screening_times" database/migrations/609_film_editorial_seed.sql`

Record which tables it writes to.

- [ ] **Step 3: Check the current on-disk Supabase state**

Run: `curl -s "http://localhost:3000/api/film/this-week?portal=atlanta"` — confirm it still returns the `places_1.portal_id does not exist` error. If someone has fixed it in-flight, this plan is obsolete.

- [ ] **Step 4: Document findings in the plan commit message**

No commit — just note findings for Task 2.

---

## Task 2: Migration adding `portal_id` to `screening_runs`

**Files:**
- Create: `database/migrations/610_film_screening_runs_portal_id.sql`
- Create: `supabase/migrations/20260417230000_film_screening_runs_portal_id.sql` (identical content; both must exist per the parity rule)

- [ ] **Step 1: Write the migration**

Both files get identical content:

```sql
-- Add portal_id to screening_runs for portal scoping.
--
-- Rationale: places has NO portal_id (city-level scoping). Film runs inherently
-- belong to one portal (a run at Plaza Theatre = Atlanta). Events-based scoping
-- would drop seeded data where event_id is null. Putting portal_id directly on
-- screening_runs matches the pattern used by events, exhibitions, programs.

BEGIN;

-- Add nullable for staged backfill
ALTER TABLE screening_runs
  ADD COLUMN IF NOT EXISTS portal_id UUID REFERENCES portals(id) ON DELETE CASCADE;

-- Backfill: all existing seeded data is Atlanta
UPDATE screening_runs
  SET portal_id = (SELECT id FROM portals WHERE slug = 'atlanta')
  WHERE portal_id IS NULL;

-- Enforce going forward
ALTER TABLE screening_runs
  ALTER COLUMN portal_id SET NOT NULL;

-- Query path: loaders filter screening_times → screening_runs by portal_id
CREATE INDEX IF NOT EXISTS idx_screening_runs_portal_id
  ON screening_runs(portal_id);

-- Composite index for date-range filtered queries by portal
CREATE INDEX IF NOT EXISTS idx_screening_runs_portal_dates
  ON screening_runs(portal_id, start_date, end_date);

COMMIT;
```

- [ ] **Step 2: Verify parity**

Run: `diff database/migrations/610_film_screening_runs_portal_id.sql supabase/migrations/20260417230000_film_screening_runs_portal_id.sql`
Expected: no diff.

- [ ] **Step 3: Apply to local Supabase**

If the project uses local Supabase CLI: `supabase db reset` or `supabase migration up`.
If not, run the SQL manually against the local dev DB. Confirm by:
```
curl -s "http://localhost:3000/api/film/this-week?portal=atlanta" | head -c 200
```
Expected: either an empty-heroes payload (means loader still needs updating — continue to Task 3) or still the column error (migration didn't apply — fix before proceeding).

If the column IS created but the loader still errors because it references `places.portal_id`, you'll see a new error like `column places_1.portal_id does not exist` — same message. That's fine; Tasks 3–6 fix the loaders.

- [ ] **Step 4: Commit**

```bash
git add database/migrations/610_film_screening_runs_portal_id.sql supabase/migrations/20260417230000_film_screening_runs_portal_id.sql
git commit -m "feat(db): add portal_id to screening_runs

Fixes the fundamental portal-scoping bug in the film data layer.
places has no portal_id (city-level scoping); scoping via events
drops seeded data (no event_id). screening_runs is the right
grain — matches how events/exhibitions/programs carry portal_id.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Fix `this-week-loader.ts`

**Files:**
- Modify: `web/lib/film/this-week-loader.ts` (single-line change in the `.from('screening_runs')...select(...).eq()` chain)

- [ ] **Step 1: Read the current query**

Run: `grep -n "places.portal_id\|screening_runs.portal_id\|portalId" web/lib/film/this-week-loader.ts`

Find the exact `.eq('places.portal_id', portalId)` line.

- [ ] **Step 2: Replace the filter**

Change:
```ts
    .eq('places.portal_id', portalId)
```
to:
```ts
    .eq('portal_id', portalId)
```

Rationale: the query is `from('screening_runs')`, so `portal_id` is a direct column on that table — no join traversal needed.

- [ ] **Step 3: Typecheck**

`cd web && npx tsc --noEmit`

- [ ] **Step 4: Run loader tests**

`cd web && npx vitest run lib/film/__tests__/this-week-loader.test.ts`

Expected: existing tests still pass (they mock at a high level and don't validate the exact filter column; this plan adds a regression test in Task 7).

- [ ] **Step 5: Verify against live data**

`curl -s "http://localhost:3000/api/film/this-week?portal=atlanta" | python3 -m json.tool | head -20`

Expected: either a real `heroes` array with seeded picks OR an empty `heroes: []` + valid `iso_week_start` / `iso_week_end` (no error object). If you still get a column error, the migration didn't fully apply OR there's a second place in the loader that references `places.portal_id`.

- [ ] **Step 6: Commit**

```bash
git add web/lib/film/this-week-loader.ts
git commit -m "fix(film): this-week loader scopes via screening_runs.portal_id

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Fix `today-playbill-loader.ts`

**Files:**
- Modify: `web/lib/film/today-playbill-loader.ts`

- [ ] **Step 1: Read the current query**

Run: `grep -n "places.portal_id\|portalId" web/lib/film/today-playbill-loader.ts`

This loader queries from `screening_times` and joins through `screening_runs!inner(..., places!inner(...))`. The current filter is `.eq('screening_runs.places.portal_id', portalId)` (dotted-path join filter).

- [ ] **Step 2: Replace the filter**

Change:
```ts
    .eq('screening_runs.places.portal_id', portalId)
```
to:
```ts
    .eq('screening_runs.portal_id', portalId)
```

- [ ] **Step 3: Typecheck + loader tests**

```bash
cd web && npx tsc --noEmit
cd web && npx vitest run lib/film/__tests__/today-playbill-loader.test.ts
```

- [ ] **Step 4: Verify against live data**

`curl -s "http://localhost:3000/api/film/today-playbill?portal=atlanta" | python3 -m json.tool | head -30`

Expected: valid `venues: [...]` or `venues: []` — no error.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/today-playbill-loader.ts
git commit -m "fix(film): today-playbill loader scopes via screening_runs.portal_id

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Fix `date-counts-loader.ts`

**Files:**
- Modify: `web/lib/film/date-counts-loader.ts`

- [ ] **Step 1: Read the current filter**

The loader queries `screening_times` with the same `!inner` join pattern. Plan 4 implementation used an in-memory filter after the query: `.filter((r) => ... places.portal_id === portalId)` (because the 3-level `.eq()` path was unreliable).

Two edits likely needed:

1. Add `.eq('screening_runs.portal_id', portalId)` to the Supabase query so the DB does the filter.
2. Remove the in-memory `.filter(...)` on `places.portal_id` — with the DB-side filter, it's redundant AND it's broken because `places.portal_id` doesn't exist, so the filter always returns `false` (the raw rows had the column read as undefined).

- [ ] **Step 2: Apply both edits**

In the Supabase query chain, add `.eq('screening_runs.portal_id', portalId)` alongside the existing `.gte('start_date', args.from)` / `.lte('start_date', args.to)` / `.eq('status', 'scheduled')` filters.

In the row-mapping section, delete the `.filter((r) => { const run = r.screening_runs as ...; return run?.places?.portal_id === portalId; })` block and use the rows directly.

- [ ] **Step 3: Typecheck + loader tests**

```bash
cd web && npx tsc --noEmit
cd web && npx vitest run lib/film/__tests__/date-counts-loader.test.ts
```

The pure `summarizeDateCounts` tests won't care about this change.

- [ ] **Step 4: Verify**

`curl -s "http://localhost:3000/api/film/date-counts?portal=atlanta&from=2026-04-17&to=2026-04-30" | python3 -m json.tool | head -30`

Expected: `counts` array of 14 entries with real counts (or zeros if DB doesn't have screenings on those dates) — no error.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/date-counts-loader.ts
git commit -m "fix(film): date-counts loader scopes via screening_runs.portal_id

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Fix `by-film-loader.ts`

**Files:**
- Modify: `web/lib/film/by-film-loader.ts`

- [ ] **Step 1: Read the current filter**

The loader queries `screening_times` with the same 3-level join. Plan 5 used the DB-side `.eq('screening_runs.places.portal_id', portalId)`.

- [ ] **Step 2: Replace the filter**

Change:
```ts
    .eq('screening_runs.places.portal_id', portalId)
```
to:
```ts
    .eq('screening_runs.portal_id', portalId)
```

- [ ] **Step 3: Typecheck + loader tests**

```bash
cd web && npx tsc --noEmit
cd web && npx vitest run lib/film/__tests__/by-film-loader.test.ts
```

- [ ] **Step 4: Verify**

`curl -s "http://localhost:3000/api/film/by-film?portal=atlanta" | python3 -m json.tool | head -30`

Expected: valid `films` array — no error.

- [ ] **Step 5: Commit**

```bash
git add web/lib/film/by-film-loader.ts
git commit -m "fix(film): by-film loader scopes via screening_runs.portal_id

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Regression test — assert the filter column in each loader

**Goal:** catch the exact pattern of this bug in the future. Each loader gets a test that builds a spy Supabase client, captures the `.eq(...)` calls made on the query builder, and asserts that `'screening_runs.portal_id'` (or `'portal_id'` for this-week which queries `screening_runs` directly) appears. If someone regresses to `places.portal_id`, the test fails.

**Files:**
- Modify: `web/lib/film/__tests__/this-week-loader.test.ts` (or create `this-week-loader.filter.test.ts` — pick whichever matches existing structure)
- Modify: `web/lib/film/__tests__/today-playbill-loader.test.ts`
- Modify: `web/lib/film/__tests__/date-counts-loader.test.ts`
- Modify: `web/lib/film/__tests__/by-film-loader.test.ts`

**Shared test helper** (define once per test file or extract to `web/lib/film/__tests__/_supabase-spy.ts`):

```ts
// web/lib/film/__tests__/_supabase-spy.ts
import { vi } from 'vitest';

export function createSupabaseSpy(rows: unknown[] = []) {
  const eqCalls: Array<[string, unknown]> = [];
  const builder: Record<string, unknown> = {};
  const finalResult = { data: rows, error: null };
  const chainFns = ['select', 'from', 'gte', 'lte', 'order', 'limit'] as const;
  for (const fn of chainFns) builder[fn] = vi.fn().mockReturnValue(builder);
  builder.eq = vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return builder;
  });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'portal-atlanta-uuid' }, error: null });
  // Thenable for `await query`
  builder.then = (resolve: (r: unknown) => void) => resolve(finalResult);

  const client = {
    from: vi.fn().mockReturnValue(builder),
  };

  return { client, eqCalls, builder };
}
```

**Pattern per loader** (example for `this-week-loader.ts`):

```ts
// web/lib/film/__tests__/this-week-loader.test.ts — append

import { describe, expect, it, vi } from 'vitest';
import { createSupabaseSpy } from './_supabase-spy';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('loadThisWeek — portal scoping regression', () => {
  it('filters via screening_runs.portal_id (not places.portal_id)', async () => {
    const { client, eqCalls } = createSupabaseSpy([]);
    const { createClient } = await import('@/lib/supabase/server');
    vi.mocked(createClient).mockResolvedValue(client as never);
    const { loadThisWeek } = await import('../this-week-loader');

    await loadThisWeek({ portalSlug: 'atlanta' });

    const columns = eqCalls.map((c) => c[0]);
    expect(columns).toContain('portal_id');
    expect(columns).not.toContain('places.portal_id');
    expect(columns).not.toContain('screening_runs.places.portal_id');
  });
});
```

Repeat with the correct expected column per loader:

| Loader | Expected `.eq()` column |
|---|---|
| `this-week-loader.ts` | `portal_id` (queries `from('screening_runs')` directly) |
| `today-playbill-loader.ts` | `screening_runs.portal_id` |
| `date-counts-loader.ts` | `screening_runs.portal_id` |
| `by-film-loader.ts` | `screening_runs.portal_id` |

- [ ] **Step 1: Create the shared spy helper**

Create `web/lib/film/__tests__/_supabase-spy.ts` with the content above.

- [ ] **Step 2: Add regression test block to each loader's test file**

For each of the 4 loader test files, append a `describe(...)` block per the pattern. Use the column from the table above.

- [ ] **Step 3: Run all 4 tests**

```bash
cd web && npx vitest run lib/film/__tests__
```

Expected: all existing tests pass + 4 new regression tests pass.

- [ ] **Step 4: Commit**

```bash
git add web/lib/film/__tests__/_supabase-spy.ts web/lib/film/__tests__/this-week-loader.test.ts web/lib/film/__tests__/today-playbill-loader.test.ts web/lib/film/__tests__/date-counts-loader.test.ts web/lib/film/__tests__/by-film-loader.test.ts
git commit -m "test(film): regression tests for portal_id filter column

Ensures future edits don't revert to the broken places.portal_id
filter pattern that slipped through mocked Supabase tests.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Full checkpoint

- [ ] **Step 1: Full verification**

```bash
cd web
npx tsc --noEmit
npx vitest run
npm run lint
```

Expected: all green.

- [ ] **Step 2: Live-data sanity check across all 3 endpoints**

```bash
for ep in this-week today-playbill by-film; do
  echo "=== /api/film/$ep ==="
  curl -s "http://localhost:3000/api/film/$ep?portal=atlanta" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"error: {d[\"error\"]}" if d.get("error") else f"OK — keys: {list(d.keys())}")'
done
echo "=== /api/film/date-counts ==="
curl -s "http://localhost:3000/api/film/date-counts?portal=atlanta&from=2026-04-17&to=2026-04-30" | python3 -c 'import json,sys; d=json.load(sys.stdin); print(f"error: {d[\"error\"]}" if d.get("error") else f"OK — {len(d.get(\"counts\",[]))} days")'
```

Expected: 4 "OK" lines, zero "error" lines.

---

## Task 9: Push + PR (not draft — this is a fix, not a feature)

- [ ] **Step 1: Push**

```bash
git push -u origin fix/film-portal-scoping
```

- [ ] **Step 2: Open PR**

```bash
gh pr create --title "fix(film): portal scoping via screening_runs.portal_id" --body "$(cat <<'EOF'
## Summary

**Critical fix for the film data layer.** All 4 film API routes (\`/api/film/this-week\`, \`/api/film/today-playbill\`, \`/api/film/date-counts\`, \`/api/film/by-film\`) have been 500'ing since PR #35 because they query \`places.portal_id\` — a column that doesn't exist. \`places\` is city-level by architectural design (see \`database/CLAUDE.md\` + \`20260413000007_search_unified.sql:31\`).

This PR adds \`portal_id\` directly to \`screening_runs\` (matches \`events\`/\`exhibitions\`/\`programs\` pattern), backfills to Atlanta, and updates all 4 loaders to filter there.

## Why this slipped

- Every loader test mocks Supabase at the client level — no integration test exercises the real query shape
- CI passes tsc + lint + vitest with 100% mocked Supabase
- Vercel build is a compile check, not a runtime check
- Live endpoints were never curl'd during PR verification

## What's included

- \`database/migrations/610_film_screening_runs_portal_id.sql\` + paired \`supabase/migrations/20260417230000_*\` — ADD COLUMN + backfill + NOT NULL + 2 indexes
- All 4 loaders updated to \`.eq('screening_runs.portal_id', ...)\` (or \`'portal_id'\` for this-week which queries \`screening_runs\` directly)
- 4 regression tests: each loader asserts the filter column is \`screening_runs.portal_id\`, not \`places.portal_id\`
- Shared \`__tests__/_supabase-spy.ts\` helper

## Test plan

- [ ] CI green
- [ ] After deploy: \`curl lostcity.vercel.app/api/film/this-week?portal=atlanta\` returns a valid \`heroes\` payload (not an error object)
- [ ] Same for \`/today-playbill\`, \`/date-counts?from=...&to=...\`, \`/by-film\`
- [ ] Visit \`/atlanta/explore/film\` — page renders with real venues, not a 500
- [ ] Visit \`/atlanta\` — Now Showing feed widget appears (not silently hidden)
- [ ] Toggle By Film and Schedule views — both render

## Follow-ups (separate PRs)

- Add a true integration-test harness that exercises loaders against a seeded test Supabase (current mocks let this bug through).
- Audit other film feature work for similar \`places.portal_id\` references.
- Consider: should crawlers that insert \`screening_runs\` now require a \`portal_id\`? (This PR makes the column NOT NULL — any crawler inserting without it will 500.)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Poll for CI + Vercel green**

Once green, merge with `gh pr merge <N> --squash --admin` and clean up the worktree.

---

## Self-review notes

- **Spec coverage:** N/A — this is a bug fix, not a feature. But:
  - ✅ Every failing loader gets fixed
  - ✅ Schema change follows existing portal_id pattern (events, exhibitions, programs)
  - ✅ Backfill + NOT NULL means future inserts must specify portal_id
  - ✅ Regression tests catch the specific bug pattern
  - ✅ Live-data verification step in Task 8 before push
- **No placeholders.** Every code block is complete.
- **Type consistency:** all loaders use `portalId: string` (UUID); schema column is `UUID REFERENCES portals(id)`.
- **Migration parity:** both `database/migrations/` and `supabase/migrations/` tracks present.
- **Crawler impact:** NOT NULL means any crawler inserting into `screening_runs` must now specify `portal_id`. This is an explicit followup — this plan does NOT audit crawler code. If a crawler run is happening concurrently, it will break on this migration. Consider flagging the crawler team.
- **Rollback plan:** if the migration causes issues in prod, the revert is `ALTER TABLE screening_runs DROP COLUMN portal_id;` (standalone reversible change).

## Execution order matters

Tasks MUST run in this order: 1 (audit) → 2 (migration must apply before loader changes) → 3, 4, 5, 6 (loader fixes — order among them doesn't matter) → 7 (regression tests) → 8 (checkpoint) → 9 (PR). Do NOT parallelize Tasks 3-6 on fresh subagents — they all touch the same directory and may conflict on staging. Sequential is fine, each is ~2 minutes of work.
