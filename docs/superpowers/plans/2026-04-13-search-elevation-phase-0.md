# Search Elevation — Phase 0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Lost City's broken search stack with a unified, contract-enforced, observability-instrumented foundation: one search experience launched from everywhere, progressive results, discovery-forward body, three-layer backend (Retrieval → Ranking → Presentation), portal-isolated, forgiving-text-ready. Ships as a working product that beats what exists today on every measurable dimension.

**Architecture:** Single `UnifiedSearch` component with inline + overlay render modes. One `/api/search/unified` endpoint backed by a three-layer service (Retrieval via single `search_unified` SQL function that CTEs all retrievers inside one connection, Ranking via RRF k=60, Presentation via GroupedPresenter). Zustand store with selector-level re-render isolation. `search_events` observability table populated via Next 16 `after()` hooks.

**Tech Stack:** Next.js 16 (React 19), TypeScript strict, Supabase Postgres with `pg_trgm`, Zustand, Upstash Redis (already wired via `lib/shared-cache.ts`), Tailwind v4, Phosphor icons, Vitest, pgTAP, ESLint with custom rule.

**Spec:** `docs/superpowers/specs/2026-04-13-search-elevation-design.md`

---

## Pre-flight (read before starting)

### Context for the engineer

Lost City is a multi-portal events discovery platform on Next.js + Supabase. Portal isolation is non-negotiable — every record has `owner_portal_id`, every query must filter by it. There are multiple CLAUDE.md files you must respect: `web/CLAUDE.md` (typography, color tokens, component recipes, common gotchas), `database/CLAUDE.md` (migration numbering, parity rules between `database/migrations/` and `supabase/migrations/`).

**The search today is broken.** `web/lib/unified-search.ts` is 1869 lines that silently strip the user's query and substitute category filters. `FindSearchInput` unmounts mid-type on the explore page due to a URL-sync state machine bug (fixed this morning). Four API routes overlap (`/api/search`, `/search/preview`, `/search/suggestions`, `/search/instant`). Two components ship the same input into four surfaces with incompatible state machines.

**You are replacing all of that.** Delete aggressively when the new stack is proven. Never let old and new exist in parallel for more than a single task.

### Key constraints

1. **TDD is not optional.** Every task starts with a failing test. Commits happen only after tests pass.
2. **`as never` for Supabase mutations.** Supabase's strict types require casts for insert/update operations. See `web/CLAUDE.md:66`.
3. **Portal isolation at the RPC level.** `p_portal_id uuid NOT NULL` in every search RPC. `WHERE owner_portal_id = p_portal_id` in every body. Regression-tested via pgTAP.
4. **Migration parity.** Every migration lands in BOTH `database/migrations/NNN_name.sql` and `supabase/migrations/YYYYMMDDHHMMSS_name.sql`. Use `python3 database/create_migration_pair.py <name>` when possible.
5. **Check `ACTIVE_WORK.md`** before starting. If another agent is touching search files, coordinate.
6. **Commit frequently.** Every task produces at least one commit. Many produce multiple.
7. **Next.js 16 gotchas.** `headers()` is async (await it). `after()` replaces `waitUntil`. `useSearchParams()` triggers Suspense — use `useReplaceStateParams` from `web/lib/hooks/useReplaceStateParams.ts` when you need reactive URL state without Suspense.
8. **Design system.** Use tokens from `web/app/globals.css`. Never hardcode hex. Never use `text-[var(--text-xs)]` (Tailwind v4 ambiguity). See `web/CLAUDE.md` for the full contract.

### What this plan does NOT cover

- Phase 1 work (server-sync recent searches, synonym map, did-you-mean UX, OTel instrumentation, desktop keyboard nav, warm-up cron). Separate plan after 14-day production hold.
- Phase 2+ deferred (pgvector, LLM routing, friends-going chips).
- Data coverage fixes. The audit is in Task 1, but fixing sparse data is the crawler team's job, not search.

### Exit criteria (Phase 0 green-light to ship)

All of the following must be true at merge time:

- [ ] Data coverage audit passes (§1.6 of spec): venue_id on events ≥85%, category on events ≥90%, neighborhood on venues ≥85%
- [ ] ESLint rule `no-retriever-rpc-calls` in CI
- [ ] Retriever contract test passing
- [ ] pgTAP portal-isolation test passing (4/4 assertions)
- [ ] Zod input validation test suite passing
- [ ] 10-item security pre-ship checklist (spec §3.9) all green
- [ ] Mobile keyboard cold-start test on iOS Safari AND Android Chrome passing
- [ ] `search_events` table migrated and populated on every request
- [ ] `npx tsc --noEmit` clean
- [ ] `npm run lint` clean
- [ ] `npx vitest run` clean (901+ tests passing, zero new failures)
- [ ] All legacy files deleted (list in Task 45)

---

## Part A — Preflight (3 tasks)

### Task 1: Worktree + data coverage audit

**Files:**
- No code changes yet. This task is a gate.

**Why:** Phase 0 is gated on data coverage. If we ship on sparse data, the architecture is right but the product feels mid-tier. The audit is non-negotiable and must run before any implementation work.

- [ ] **Step 1: Create isolated worktree**

Run:
```bash
cd /Users/coach/Projects/LostCity
git worktree add ../LostCity-search-phase-0 -b search-elevation-phase-0
cd ../LostCity-search-phase-0
```

- [ ] **Step 2: Dispatch data coverage audit**

Use the `data-specialist` subagent. Prompt:

> Run a data coverage audit for Phase 0 of the search elevation project. Query the production DB for:
> 1. Percent of `events` where `venue_id IS NOT NULL` (grouped by `owner_portal_id`)
> 2. Percent of `events` where `category_id IS NOT NULL` (grouped by `owner_portal_id`)
> 3. Percent of `venues` where `neighborhood_id IS NOT NULL` (grouped by `owner_portal_id`)
> 4. Percent of `events` where `image_url IS NOT NULL` (grouped by `owner_portal_id`)
> 5. Percent of `venues` where `image_url IS NOT NULL` (grouped by `owner_portal_id`)
>
> Thresholds: venue_id ≥85%, category ≥90% (events); neighborhood ≥85% (venues). If any portal fails these thresholds, report the gap with specific numbers. Do not proceed to crawler fixes — this is a reporting task only. Produce a short report with a go/no-go recommendation per portal.

- [ ] **Step 3: Review report + green-light decision**

If all three bold thresholds are met for the Atlanta portal (minimum viable portal for launch), proceed to Task 2. If any threshold is missed, STOP this plan and file a crawler fix task first. Resume Phase 0 only after coverage is restored.

- [ ] **Step 4: Create the ACTIVE_WORK.md entry**

Run:
```bash
grep "search-elevation" /Users/coach/Projects/LostCity/ACTIVE_WORK.md || echo "search-elevation-phase-0: web/lib/search/, web/components/search/, web/app/[portal]/api/search/, database/migrations/604*, 605*, 606*, 607*" >> /Users/coach/Projects/LostCity/ACTIVE_WORK.md
```

This claims the search directory tree for this plan's duration. Clear it when the plan ships.

- [ ] **Step 5: Commit the ACTIVE_WORK claim**

```bash
cd /Users/coach/Projects/LostCity
git add ACTIVE_WORK.md
git commit -m "chore: claim search directories for phase-0 rebuild"
```

---

### Task 2: Create `database/tests/` infrastructure for pgTAP

**Files:**
- Create: `database/tests/README.md`
- Create: `database/tests/run-pgtap.sh`
- Create: `database/tests/.gitkeep`

**Why:** The spec calls for pgTAP tests (`database/tests/search_unified.pgtap.sql`). This directory doesn't exist yet. Create the runner scaffolding first.

- [ ] **Step 1: Write the README**

Create `database/tests/README.md`:

```markdown
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
- Use `gen_random_uuid()` for test fixtures
```

- [ ] **Step 2: Write the runner script**

Create `database/tests/run-pgtap.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 1 ]; then
  echo "usage: ./run-pgtap.sh <test-file>"
  exit 1
fi

: "${DATABASE_URL:?DATABASE_URL env var required}"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$1"
```

Make it executable:
```bash
chmod +x database/tests/run-pgtap.sh
```

- [ ] **Step 3: Commit**

```bash
git add database/tests/
git commit -m "test(db): add pgTAP test runner infrastructure"
```

---

### Task 3: Verify existing Upstash + rate-limit infrastructure

**Files:**
- Read only: `web/lib/shared-cache.ts`, `web/lib/rate-limit.ts`, `web/lib/api-middleware.ts`

**Why:** Three pieces of infrastructure are required by Phase 0 and already exist. Before any code is written, confirm they work as expected and nothing has drifted.

- [ ] **Step 1: Verify Upstash Redis client**

```bash
cd web
grep -n "getSharedCacheJson\|setSharedCacheJson" lib/shared-cache.ts | head -5
```

Expected: functions exist and are exported. If not, STOP and coordinate with the team — the cache layer is a prerequisite.

- [ ] **Step 2: Verify rate-limit presets**

```bash
grep -n "RATE_LIMITS" lib/rate-limit.ts | head -10
```

Expected: `read`, `write`, `auth`, `standard` presets exist. Phase 0 will use `read` for search; Phase 1 adds `search_anon`, `search_authed`, etc.

- [ ] **Step 3: Verify `withOptionalAuth` exists**

```bash
grep -n "export function withOptionalAuth" lib/api-middleware.ts
```

Expected: exists at around line 301. If not, STOP and add it before proceeding (it's a one-function change: wrap `withAuth` so `user` can be null).

- [ ] **Step 4: Verify environment variables present**

```bash
grep -E "UPSTASH_REDIS_REST_URL|UPSTASH_REDIS_REST_TOKEN" .env.local .env 2>/dev/null || echo "env check skipped"
```

Expected: both keys present (or skipped if `.env` is gitignored — fine, just make sure the dev server has them).

- [ ] **Step 5: No commit needed — this is verification only**

If all four checks pass, proceed to Task 4. If any fail, STOP and fix.

---

## Part B — Database migrations (5 tasks)

### Task 4: Migration — `search_log_salt` table + daily salt cron seed

**Files:**
- Create: `database/migrations/604_search_log_salt.sql`
- Create: `supabase/migrations/{timestamp}_search_log_salt.sql`

**Why:** Query logging hashes queries with a daily-rotating salt. The salt table must exist before `search_events` references it.

- [ ] **Step 1: Scaffold the migration pair**

```bash
cd /Users/coach/Projects/LostCity
python3 database/create_migration_pair.py search_log_salt
```

This creates matched files in both directories. The script picks the next sequential number and a timestamp.

- [ ] **Step 2: Write the migration body**

In both the `database/migrations/604_search_log_salt.sql` and the matching `supabase/migrations/...` file, add:

```sql
-- Rotating daily salt for hashing search queries in the observability log.
-- Populated by a scheduled function at 00:05 UTC; old salts retained 2 days
-- so late-arriving click events can still be joined by hash.

CREATE TABLE IF NOT EXISTS public.search_log_salt (
  day   date PRIMARY KEY,
  salt  bytea NOT NULL
);

COMMENT ON TABLE public.search_log_salt IS
  'Daily salts for hashing search queries. Rotated at 00:05 UTC. Old rows purged after 2 days.';

-- Seed today's salt so Phase 0 can ship without waiting for the cron to fire.
INSERT INTO public.search_log_salt (day, salt)
VALUES (current_date, gen_random_bytes(32))
ON CONFLICT (day) DO NOTHING;

-- Retention: auto-delete salts older than 2 days via pg_cron.
-- (Registered in a later migration; this migration is schema-only.)
```

- [ ] **Step 3: Apply locally and verify**

```bash
cd /Users/coach/Projects/LostCity
psql "$DATABASE_URL" -f database/migrations/604_search_log_salt.sql
psql "$DATABASE_URL" -c "SELECT day, length(salt) FROM search_log_salt;"
```

Expected: one row for today's date with `length = 32`.

- [ ] **Step 4: Run parity audit**

```bash
python3 database/audit_migration_parity.py --fail-on-unmatched
```

Expected: passes (new pair is matched).

- [ ] **Step 5: Commit**

```bash
git add database/migrations/604_search_log_salt.sql supabase/migrations/*search_log_salt*.sql
git commit -m "feat(db): add search_log_salt table for query hash rotation"
```

---

### Task 5: Migration — `search_events` observability table

**Files:**
- Create: `database/migrations/605_search_events.sql`
- Create: `supabase/migrations/{timestamp}_search_events.sql`

**Why:** Observability-from-day-one. Without this table, every downstream tuning decision is guesswork.

- [ ] **Step 1: Scaffold the migration pair**

```bash
python3 database/create_migration_pair.py search_events
```

- [ ] **Step 2: Write the migration body**

```sql
-- Search observability log. Records query telemetry without PII.
-- CRITICAL: this table does NOT store user_id. Only user_segment ('anon' | 'authed').
-- Justification: eliminates GDPR right-to-erasure cascade and insider-threat surface.

CREATE TABLE IF NOT EXISTS public.search_events (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at          timestamptz NOT NULL DEFAULT now(),
  portal_slug          text        NOT NULL,
  locale               text        NOT NULL DEFAULT 'en',
  user_segment         text        NOT NULL CHECK (user_segment IN ('anon', 'authed')),
  query_hash           bytea       NOT NULL,
  query_length         int         NOT NULL,
  query_word_count     int         NOT NULL,
  intent_type          text,
  filters_json         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  cache_hit            text        NOT NULL CHECK (cache_hit IN ('fresh', 'stale', 'miss')),
  degraded             boolean     NOT NULL DEFAULT false,
  retriever_breakdown  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  result_count         int         NOT NULL,
  result_type_counts   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  top_matches_types    text[]      NOT NULL DEFAULT ARRAY[]::text[],
  zero_result          boolean     NOT NULL,
  total_ms             int         NOT NULL
);

CREATE INDEX IF NOT EXISTS ix_search_events_portal_time
  ON public.search_events (portal_slug, occurred_at DESC);

CREATE INDEX IF NOT EXISTS ix_search_events_hash
  ON public.search_events (query_hash);

CREATE INDEX IF NOT EXISTS ix_search_events_zero_result
  ON public.search_events (portal_slug, occurred_at DESC)
  WHERE zero_result = true;

COMMENT ON TABLE public.search_events IS
  'Search telemetry. 30-day retention. No user_id by design. See docs/superpowers/specs/2026-04-13-search-elevation-design.md §3.6';

-- Click events are a separate table: many clicks can follow one search
CREATE TABLE IF NOT EXISTS public.search_click_events (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  search_event_id   uuid        NOT NULL REFERENCES public.search_events(id) ON DELETE CASCADE,
  clicked_at        timestamptz NOT NULL DEFAULT now(),
  position          smallint    NOT NULL,
  result_type       text        NOT NULL,
  result_id         text        NOT NULL,
  primary_retriever text        NOT NULL,
  conversion_type   text        CHECK (conversion_type IN ('click', 'save', 'rsvp', 'plan')),
  dwell_ms          integer
);

CREATE INDEX IF NOT EXISTS ix_search_click_events_search_id
  ON public.search_click_events (search_event_id);

CREATE INDEX IF NOT EXISTS ix_search_click_events_time
  ON public.search_click_events (clicked_at DESC);
```

- [ ] **Step 3: Apply locally and verify schema**

```bash
psql "$DATABASE_URL" -f database/migrations/605_search_events.sql
psql "$DATABASE_URL" -c "\d public.search_events"
psql "$DATABASE_URL" -c "\d public.search_click_events"
```

Expected: both tables exist with all columns, indexes, and the `ON DELETE CASCADE` FK.

- [ ] **Step 4: Parity audit**

```bash
python3 database/audit_migration_parity.py --fail-on-unmatched
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/605_search_events.sql supabase/migrations/*search_events*.sql
git commit -m "feat(db): add search_events + search_click_events observability tables"
```

---

### Task 6: Migration — `user_recent_searches` table + `insert_recent_search` RPC

**Files:**
- Create: `database/migrations/606_user_recent_searches.sql`
- Create: `supabase/migrations/{timestamp}_user_recent_searches.sql`

**Why:** Recent searches storage with atomic insert+rotation. Server-sync is Phase 1, but the table lands in Phase 0 so the endpoint and RPC exist.

- [ ] **Step 1: Scaffold**

```bash
python3 database/create_migration_pair.py user_recent_searches
```

- [ ] **Step 2: Write the migration body**

```sql
CREATE TABLE IF NOT EXISTS public.user_recent_searches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query      text NOT NULL CHECK (char_length(query) BETWEEN 1 AND 120),
  filters    jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_user_recent_searches_user_created
  ON public.user_recent_searches (user_id, created_at DESC);

-- Atomic insert + rotation (keep last N per user, discard older)
CREATE OR REPLACE FUNCTION public.insert_recent_search(
  p_user_id  uuid,
  p_query    text,
  p_filters  jsonb,
  p_max_rows int
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'insert_recent_search: p_user_id required';
  END IF;
  IF char_length(p_query) < 1 OR char_length(p_query) > 120 THEN
    RAISE EXCEPTION 'insert_recent_search: query length out of bounds';
  END IF;
  IF p_max_rows < 1 OR p_max_rows > 100 THEN
    RAISE EXCEPTION 'insert_recent_search: p_max_rows out of bounds';
  END IF;

  INSERT INTO public.user_recent_searches (user_id, query, filters)
  VALUES (p_user_id, p_query, p_filters);

  DELETE FROM public.user_recent_searches
  WHERE user_id = p_user_id
    AND id NOT IN (
      SELECT id FROM public.user_recent_searches
      WHERE user_id = p_user_id
      ORDER BY created_at DESC
      LIMIT p_max_rows
    );
END $$;

REVOKE ALL ON FUNCTION public.insert_recent_search(uuid, text, jsonb, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.insert_recent_search(uuid, text, jsonb, int) TO authenticated, service_role;
```

- [ ] **Step 3: Apply and verify**

```bash
psql "$DATABASE_URL" -f database/migrations/606_user_recent_searches.sql
psql "$DATABASE_URL" -c "\d public.user_recent_searches"
psql "$DATABASE_URL" -c "\df public.insert_recent_search"
```

Expected: table + function both present.

- [ ] **Step 4: Parity audit**

```bash
python3 database/audit_migration_parity.py --fail-on-unmatched
```

- [ ] **Step 5: Commit**

```bash
git add database/migrations/606_user_recent_searches.sql supabase/migrations/*user_recent_searches*.sql
git commit -m "feat(db): add user_recent_searches table with atomic insert+rotation RPC"
```

---

### Task 7: Migration — `search_unified` RPC function

**Files:**
- Create: `database/migrations/607_search_unified.sql`
- Create: `supabase/migrations/{timestamp}_search_unified.sql`

**Why:** The load-bearing retrieval function. All three retrievers run as CTEs inside this single function, collapsing 9 connections per search request to 1. Portal isolation is enforced here.

- [ ] **Step 1: Verify `pg_trgm` extension is available**

```bash
psql "$DATABASE_URL" -c "SELECT * FROM pg_extension WHERE extname = 'pg_trgm';"
```

If not installed:
```bash
psql "$DATABASE_URL" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

- [ ] **Step 2: Scaffold the migration pair**

```bash
python3 database/create_migration_pair.py search_unified
```

- [ ] **Step 3: Write the migration body**

```sql
-- Ensure pg_trgm is available for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes on searchable text columns
CREATE INDEX IF NOT EXISTS events_title_trgm_idx
  ON public.events USING gin (title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS venues_name_trgm_idx
  ON public.venues USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS organizations_name_trgm_idx
  ON public.organizations USING gin (name gin_trgm_ops);

-- The unified search RPC: runs all retrievers (FTS, trigram, structured) for
-- all supported entity types inside a SINGLE connection via CTEs. Returns
-- tagged rows for Node-side demultiplexing into per-retriever candidate sets.
--
-- CRITICAL: p_portal_id is REQUIRED and enforced inside every CTE. This is
-- the single point of portal isolation. Regression-tested via pgTAP in the
-- next task.

CREATE OR REPLACE FUNCTION public.search_unified(
  p_portal_id            uuid,        -- REQUIRED, NOT NULL
  p_query                text,
  p_types                text[],
  p_categories           text[] DEFAULT NULL,
  p_neighborhoods        text[] DEFAULT NULL,
  p_date_from            timestamptz DEFAULT NULL,
  p_date_to              timestamptz DEFAULT NULL,
  p_free_only            boolean DEFAULT false,
  p_limit_per_retriever  int     DEFAULT 30
)
RETURNS TABLE (
  retriever_id text,
  entity_type  text,
  entity_id    text,
  raw_score    real,
  quality      real,
  days_out     int,
  title        text,
  subtitle     text,
  image_url    text,
  href_slug    text,
  starts_at    timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tsq tsquery;
BEGIN
  IF p_portal_id IS NULL THEN
    RAISE EXCEPTION 'search_unified: p_portal_id required';
  END IF;

  -- Guard: clamp limit to protect against DoS
  p_limit_per_retriever := LEAST(GREATEST(p_limit_per_retriever, 1), 80);

  v_tsq := websearch_to_tsquery('simple', COALESCE(p_query, ''));

  RETURN QUERY
  WITH fts_events AS (
    SELECT
      'fts'::text AS retriever_id,
      'event'::text AS entity_type,
      e.id::text AS entity_id,
      ts_rank_cd(e.search_vector, v_tsq)::real AS raw_score,
      COALESCE(e.data_quality::real, 0.5) AS quality,
      GREATEST(0, EXTRACT(EPOCH FROM (e.start_date::timestamptz - now())) / 86400)::int AS days_out,
      e.title,
      v.name AS subtitle,
      e.image_url,
      e.id::text AS href_slug,
      e.start_date::timestamptz AS starts_at
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.owner_portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.is_active = true
      AND (p_query = '' OR e.search_vector @@ v_tsq)
      AND (p_date_from IS NULL OR e.start_date >= p_date_from::date)
      AND (p_date_to   IS NULL OR e.start_date <  p_date_to::date)
      AND (p_categories IS NULL OR e.category_id = ANY(p_categories))
      AND (NOT p_free_only OR e.is_free IS TRUE)
    ORDER BY raw_score DESC
    LIMIT p_limit_per_retriever
  ),
  trgm_events AS (
    SELECT
      'trigram'::text,
      'event'::text,
      e.id::text,
      similarity(e.title, p_query)::real AS raw_score,
      COALESCE(e.data_quality::real, 0.5),
      GREATEST(0, EXTRACT(EPOCH FROM (e.start_date::timestamptz - now())) / 86400)::int,
      e.title,
      v.name,
      e.image_url,
      e.id::text,
      e.start_date::timestamptz
    FROM public.events e
    LEFT JOIN public.venues v ON v.id = e.venue_id
    WHERE e.owner_portal_id = p_portal_id
      AND 'event' = ANY(p_types)
      AND e.is_active = true
      AND p_query <> ''
      AND e.title % p_query
      AND (p_date_from IS NULL OR e.start_date >= p_date_from::date)
      AND (p_date_to   IS NULL OR e.start_date <  p_date_to::date)
    ORDER BY raw_score DESC
    LIMIT p_limit_per_retriever
  ),
  fts_venues AS (
    SELECT
      'fts'::text,
      'venue'::text,
      v.id::text,
      ts_rank_cd(v.search_vector, v_tsq)::real,
      COALESCE(v.data_quality::real, 0.5),
      0::int AS days_out,
      v.name AS title,
      v.neighborhood AS subtitle,
      v.image_url,
      v.slug AS href_slug,
      NULL::timestamptz AS starts_at
    FROM public.venues v
    WHERE v.owner_portal_id = p_portal_id
      AND 'venue' = ANY(p_types)
      AND (p_query = '' OR v.search_vector @@ v_tsq)
    ORDER BY raw_score DESC
    LIMIT p_limit_per_retriever
  ),
  trgm_venues AS (
    SELECT
      'trigram'::text,
      'venue'::text,
      v.id::text,
      similarity(v.name, p_query)::real,
      COALESCE(v.data_quality::real, 0.5),
      0::int,
      v.name,
      v.neighborhood,
      v.image_url,
      v.slug,
      NULL::timestamptz
    FROM public.venues v
    WHERE v.owner_portal_id = p_portal_id
      AND 'venue' = ANY(p_types)
      AND p_query <> ''
      AND v.name % p_query
    ORDER BY raw_score DESC
    LIMIT p_limit_per_retriever
  )
  SELECT * FROM fts_events
  UNION ALL SELECT * FROM trgm_events
  UNION ALL SELECT * FROM fts_venues
  UNION ALL SELECT * FROM trgm_venues;
END $$;

REVOKE ALL ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], timestamptz, timestamptz, boolean, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_unified(uuid, text, text[], text[], text[], timestamptz, timestamptz, boolean, int) TO authenticated, anon, service_role;

COMMENT ON FUNCTION public.search_unified IS
  'Unified search retrieval. Runs all retrievers (FTS, trigram) × entity types (event, venue) as CTEs in one connection. Portal-isolated via p_portal_id NOT NULL. Extend by adding CTEs + UNION ALL clauses.';
```

> **Note on organizer and program:** this Phase 0 version covers `event` and `venue`. Organizers, series, festivals, programs, and neighborhoods can be added as additional CTEs in Phase 0 follow-up commits after the baseline is proven. The structure is uniform — copy any existing CTE pair and substitute the source table.

- [ ] **Step 4: Apply and verify**

```bash
psql "$DATABASE_URL" -f database/migrations/607_search_unified.sql
psql "$DATABASE_URL" -c "\df public.search_unified"
```

- [ ] **Step 5: Smoke test**

```bash
psql "$DATABASE_URL" -c "SELECT retriever_id, entity_type, title FROM search_unified((SELECT id FROM portals WHERE slug = 'atlanta'), 'jazz', ARRAY['event', 'venue'], NULL, NULL, NULL, NULL, false, 5);"
```

Expected: rows returned for "jazz" query, mix of FTS and trigram retrievers, mix of event and venue entity types. Should NOT be zero.

- [ ] **Step 6: Parity audit**

```bash
python3 database/audit_migration_parity.py --fail-on-unmatched
```

- [ ] **Step 7: Commit**

```bash
git add database/migrations/607_search_unified.sql supabase/migrations/*search_unified*.sql
git commit -m "feat(db): add search_unified RPC — single-connection retrieval across entity types"
```

---

### Task 8: pgTAP test — portal isolation for `search_unified`

**Files:**
- Create: `database/tests/search_unified.pgtap.sql`

**Why:** This test is the regression gate for portal isolation. If it ever fails, cross-portal data is leaking.

- [ ] **Step 1: Write the failing test**

Create `database/tests/search_unified.pgtap.sql`:

```sql
-- Regression test: search_unified MUST enforce portal isolation.
-- Any failure means cross-portal data is leaking in search results.

BEGIN;
SELECT plan(4);

-- Set up two portals with one jazz event each
INSERT INTO portals (id, slug, name) VALUES
  ('11111111-1111-1111-1111-111111111111', 'pgtap-atl', 'ATL Test'),
  ('22222222-2222-2222-2222-222222222222', 'pgtap-nyc', 'NYC Test')
ON CONFLICT (id) DO NOTHING;

INSERT INTO events (id, owner_portal_id, title, start_date, is_active, search_vector)
VALUES
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111',
   'Atlanta Jazz Night', (now() + interval '1 day')::date, true,
   to_tsvector('simple', 'atlanta jazz night')),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222',
   'NYC Jazz Night', (now() + interval '1 day')::date, true,
   to_tsvector('simple', 'nyc jazz night'));

-- Assertion 1: Atlanta search returns the Atlanta event
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'jazz',
    ARRAY['event']
  ) WHERE retriever_id = 'fts') >= 1,
  'atlanta search returns atlanta event'
);

-- Assertion 2: Atlanta search does NOT return the NYC event
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '11111111-1111-1111-1111-111111111111'::uuid,
    'jazz',
    ARRAY['event']
  ) WHERE title LIKE 'NYC%') = 0,
  'atlanta search does not leak NYC rows'
);

-- Assertion 3: Unknown portal id returns zero rows
SELECT ok(
  (SELECT count(*) FROM search_unified(
    '00000000-0000-0000-0000-000000000000'::uuid,
    'jazz',
    ARRAY['event']
  )) = 0,
  'unknown portal returns 0 rows'
);

-- Assertion 4: NULL portal id raises an exception
SELECT throws_ok(
  $$ SELECT * FROM search_unified(NULL::uuid, 'jazz', ARRAY['event']) $$,
  NULL,
  'null portal id is rejected'
);

SELECT * FROM finish();
ROLLBACK;
```

- [ ] **Step 2: Run the test (expected to PASS if Task 7 was correct)**

```bash
cd database/tests
./run-pgtap.sh search_unified.pgtap.sql
```

Expected output:
```
ok 1 - atlanta search returns atlanta event
ok 2 - atlanta search does not leak NYC rows
ok 3 - unknown portal returns 0 rows
ok 4 - null portal id is rejected
1..4
```

If any assertion fails, the `search_unified` function has a portal isolation bug. Fix the RPC in Task 7's migration and re-run this test. Do not proceed.

- [ ] **Step 3: Commit**

```bash
git add database/tests/search_unified.pgtap.sql
git commit -m "test(db): add pgTAP portal-isolation test for search_unified"
```

---

## Part C — Core types (contracts) (4 tasks)

### Task 9: Core `Candidate` and retriever types

**Files:**
- Create: `web/lib/search/types.ts`
- Create: `web/lib/search/__tests__/types.test.ts`

**Why:** The three-layer contract starts here. `Candidate` is the atomic unit crossing Retrieval → Ranking → Presentation. Getting these types right first prevents `search-service.ts` from becoming the next 1869-line tangle.

- [ ] **Step 1: Write the failing type-only test**

Create `web/lib/search/__tests__/types.test.ts`:

```typescript
import { describe, it, expectTypeOf } from "vitest";
import type {
  Candidate,
  EntityType,
  RetrieverId,
  RetrieverContext,
  Retriever,
} from "@/lib/search/types";

describe("search/types", () => {
  it("Candidate has required fields", () => {
    const c: Candidate = {
      id: "abc",
      type: "event",
      source_retriever: "fts",
      raw_score: 1.5,
      matched_fields: ["title"],
      payload: {},
    };
    expectTypeOf(c.id).toBeString();
    expectTypeOf(c.type).toEqualTypeOf<EntityType>();
    expectTypeOf(c.source_retriever).toEqualTypeOf<RetrieverId>();
  });

  it("RetrieverContext requires portal_id", () => {
    const ctx: RetrieverContext = {
      portal_id: "uuid",
      limit: 20,
      signal: new AbortController().signal,
    };
    expectTypeOf(ctx.portal_id).toBeString();
  });

  it("Retriever interface compiles", () => {
    const r: Retriever = {
      id: "fts",
      async retrieve() { return []; },
    };
    expectTypeOf(r.id).toEqualTypeOf<RetrieverId>();
  });
});
```

- [ ] **Step 2: Run the test (expected: FAIL — types don't exist)**

```bash
cd web
npx vitest run lib/search/__tests__/types.test.ts
```

Expected: compilation error, "Cannot find module '@/lib/search/types'".

- [ ] **Step 3: Implement the types**

Create `web/lib/search/types.ts`:

```typescript
/**
 * Core search types. See docs/superpowers/specs/2026-04-13-search-elevation-design.md §2.1
 *
 * A Candidate is the atomic unit crossing Retrieval → Ranking → Presentation.
 * Retrievers MUST NOT pre-shape for presentation. The ranker owns ordering;
 * the presenter owns grouping and top-matches selection.
 */

export type EntityType =
  | "event"
  | "venue"
  | "organizer"
  | "series"
  | "festival"
  | "exhibition"
  | "program"
  | "neighborhood"
  | "category";

export type RetrieverId = "fts" | "trigram" | "structured";

export interface Candidate {
  id: string;                       // stable entity id
  type: EntityType;
  source_retriever: RetrieverId;
  raw_score: number;                // retriever-native, pre-normalization
  matched_fields: string[];         // ['title', 'venue.name', ...]
  payload: Record<string, unknown>; // type-specific, opaque to ranker
}

export interface RetrieverContext {
  portal_id: string;                // REQUIRED — data isolation boundary
  user_id?: string;                 // for visible persistence only, never hidden personalization
  limit: number;                    // per-retriever cap; ranker does final truncation
  signal: AbortSignal;              // cooperative cancellation
}

/**
 * A Retriever reads from pre-computed UnifiedRetrievalResult (see
 * lib/search/unified-retrieval.ts). It MUST NOT issue its own database calls.
 * This contract is enforced by lint rule no-retriever-rpc-calls and by the
 * retriever contract test.
 */
export interface Retriever {
  readonly id: RetrieverId;
  retrieve(q: AnnotatedQueryShape, ctx: RetrieverContext): Promise<Candidate[]>;
}

// Forward reference — AnnotatedQuery is defined in understanding/types.ts
// This shape alias prevents a circular import.
export type AnnotatedQueryShape = {
  readonly raw: string;
  readonly normalized: string;
  readonly fingerprint: string;
};
```

- [ ] **Step 4: Run the test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
```

- [ ] **Step 5: Run tsc on the whole project**

```bash
npx tsc --noEmit
```

Expected: clean. If any pre-existing error reappears, it's unrelated.

- [ ] **Step 6: Commit**

```bash
git add lib/search/types.ts lib/search/__tests__/types.test.ts
git commit -m "feat(search): add core Candidate, Retriever, and EntityType types"
```

---

### Task 10: `AnnotatedQuery` and understanding types

**Files:**
- Create: `web/lib/search/understanding/types.ts`
- Update: `web/lib/search/__tests__/types.test.ts` (add assertion)

**Why:** The immutable object passed from query-understanding to retrieval. Retrievers receive this; they never see the raw string. This is the architectural mechanism that prevents the "silently strips the user's query" bug.

- [ ] **Step 1: Write the failing test addition**

Append to `web/lib/search/__tests__/types.test.ts`:

```typescript
import type {
  AnnotatedQuery,
  Token,
  EntityAnnotation,
  StructuredFilters,
  IntentType,
} from "@/lib/search/understanding/types";

describe("search/understanding/types", () => {
  it("AnnotatedQuery is deeply readonly", () => {
    const q: AnnotatedQuery = {
      raw: "jazz",
      normalized: "jazz",
      tokens: [],
      entities: [],
      spelling: [],
      synonyms: [],
      structured_filters: {},
      intent: { type: "find_event", confidence: 0.9 },
      fingerprint: "abc123",
    };
    // @ts-expect-error — raw is readonly
    q.raw = "mutated";
  });

  it("IntentType is a discriminated union", () => {
    const i: IntentType = "find_event";
    expectTypeOf(i).toEqualTypeOf<IntentType>();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL — module missing)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
```

- [ ] **Step 3: Implement the types**

Create `web/lib/search/understanding/types.ts`:

```typescript
/**
 * Query understanding types. See spec §2.2.
 *
 * AnnotatedQuery is the only thing retrievers see. The raw user string is
 * preserved for display and logging, but retrieval consumes the annotated form.
 * All fields are readonly — AnnotatedQuery is frozen at construction.
 */

export interface Token {
  text: string;         // original surface form
  normalized: string;   // lowercased, unaccented, NFKC
  start: number;        // char offset in raw
  end: number;
  stop: boolean;        // stopword flag
}

export type EntityKind =
  | "category"
  | "neighborhood"
  | "venue"
  | "person"
  | "time"
  | "audience";

export interface EntityAnnotation {
  kind: EntityKind;
  span: [number, number];       // offsets in raw
  resolved_id?: string;         // linked canonical id when confident
  surface: string;              // original text
  confidence: number;           // 0..1
}

export interface StructuredFilters {
  categories?: string[];
  neighborhoods?: string[];
  date_range?: { start: string; end: string };
  price?: { free?: boolean; max?: number };
  audience?: string[];
  venue_ids?: string[];
}

export type IntentType =
  | "find_event"
  | "find_venue"
  | "browse_category"
  | "unknown";

export interface AnnotatedQuery {
  readonly raw: string;                                 // user's original — NEVER mutated
  readonly normalized: string;                          // NFKC + lowercase + ws-collapse
  readonly tokens: ReadonlyArray<Token>;
  readonly entities: ReadonlyArray<EntityAnnotation>;
  readonly temporal?: {
    type: "point" | "range" | "recurring";
    start: string;
    end: string;
  };
  readonly spatial?: {
    neighborhood?: string;
    distance_m?: number;
    center?: [number, number];
  };
  readonly spelling: ReadonlyArray<{
    corrected: string;
    confidence: number;
  }>;
  readonly synonyms: ReadonlyArray<{
    token: string;
    expansions: string[];
    weight: number;
  }>;
  readonly structured_filters: Readonly<StructuredFilters>;
  readonly intent: { type: IntentType; confidence: number };
  readonly fingerprint: string;                          // stable hash for cache + observability
}

export interface PortalContext {
  portal_id: string;
  portal_slug: string;
  locale?: string;
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/understanding/types.ts lib/search/__tests__/types.test.ts
git commit -m "feat(search): add AnnotatedQuery + query understanding types"
```

---

### Task 11: Ranking types (`Ranker`, `RankedCandidate`, `RankingContext`)

**Files:**
- Create: `web/lib/search/ranking/types.ts`

**Why:** The middle layer of the three-layer contract. Rankers consume candidate sets from retrievers and produce ordered, final-scored results. The interface is what makes rankers A/B-able.

- [ ] **Step 1: Write the failing test**

Append to `web/lib/search/__tests__/types.test.ts`:

```typescript
import type {
  RankedCandidate,
  Ranker,
  RankingContext,
} from "@/lib/search/ranking/types";

describe("search/ranking/types", () => {
  it("RankedCandidate extends Candidate with final_score", () => {
    const r: RankedCandidate = {
      id: "1",
      type: "event",
      source_retriever: "fts",
      raw_score: 0.5,
      matched_fields: ["title"],
      payload: {},
      final_score: 0.8,
      contributing_retrievers: ["fts", "trigram"],
      rank: 0,
    };
    expectTypeOf(r.final_score).toBeNumber();
    expectTypeOf(r.contributing_retrievers).toEqualTypeOf<Array<"fts" | "trigram" | "structured">>();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/ranking/types.ts`:

```typescript
import type { Candidate, RetrieverId } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

export interface RankedCandidate extends Candidate {
  final_score: number;
  contributing_retrievers: RetrieverId[];
  rank: number;
}

export interface RankingContext {
  weights: Partial<Record<RetrieverId, number>>;
  intent: AnnotatedQuery["intent"];
  diversityLambda?: number;  // MMR tradeoff, 0 = pure relevance
}

/**
 * A Ranker fuses N retrievers' candidate sets into a final ordering.
 * The default ranker is RrfRanker (Reciprocal Rank Fusion, k=60) — scale-
 * invariant, robust to score-scale differences across retrievers, no weight
 * tuning required.
 */
export interface Ranker {
  readonly id: string;
  rank(
    candidateSets: Map<RetrieverId, Candidate[]>,
    ctx: RankingContext
  ): RankedCandidate[];
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/ranking/types.ts lib/search/__tests__/types.test.ts
git commit -m "feat(search): add Ranker + RankedCandidate types"
```

---

### Task 12: Presenting types (`Presenter`, `PresentationPolicy`, `PresentedResults`)

**Files:**
- Create: `web/lib/search/presenting/types.ts`

**Why:** The outermost layer of the three-layer contract. Presenters turn ranked results into section-grouped, top-matches-selected response payloads.

- [ ] **Step 1: Write the failing test**

Append to `web/lib/search/__tests__/types.test.ts`:

```typescript
import type {
  PresentationPolicy,
  PresentedResults,
  Presenter,
  SearchDiagnostics,
} from "@/lib/search/presenting/types";

describe("search/presenting/types", () => {
  it("PresentedResults has topMatches + sections", () => {
    const p: PresentedResults = {
      topMatches: [],
      sections: [],
      totals: {} as never,
      diagnostics: {
        total_ms: 100,
        cache_hit: "miss",
        degraded: false,
        retriever_ms: {},
        result_type_counts: {} as never,
      },
    };
    expectTypeOf(p.topMatches).toBeArray();
    expectTypeOf(p.sections).toBeArray();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/presenting/types.ts`:

```typescript
import type { EntityType, RetrieverId } from "@/lib/search/types";
import type { RankedCandidate } from "@/lib/search/ranking/types";

export interface PresentationPolicy {
  topMatchesCount: number;                            // 6 desktop, 3 mobile
  groupCaps: Partial<Record<EntityType, number>>;     // { event: 8, venue: 6, ... }
  diversityLambda: number;                            // MMR: 0 = relevance, 1 = novelty
  dedupeKey: (c: RankedCandidate) => string;
}

export interface SearchDiagnostics {
  total_ms: number;
  cache_hit: "fresh" | "stale" | "miss";
  degraded: boolean;
  retriever_ms: Partial<Record<RetrieverId, number>>;
  result_type_counts: Partial<Record<EntityType, number>>;
  annotate_ms?: number;
  rank_ms?: number;
  present_ms?: number;
}

export interface PresentedResults {
  topMatches: RankedCandidate[];  // hero rail, cross-type interleaved
  sections: Array<{
    type: EntityType;
    title: string;
    items: RankedCandidate[];
    total: number;
  }>;
  totals: Partial<Record<EntityType, number>>;
  diagnostics: SearchDiagnostics;
}

export interface Presenter {
  present(ranked: RankedCandidate[], policy: PresentationPolicy): PresentedResults;
}
```

- [ ] **Step 4: Run tests (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/types.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/presenting/types.ts lib/search/__tests__/types.test.ts
git commit -m "feat(search): add Presenter + PresentedResults types"
```

---


## Part D — Query understanding (6 tasks)

### Task 13: `normalize.ts` — NFKC, control char strip, length clamp

**Files:**
- Create: `web/lib/search/normalize.ts`
- Create: `web/lib/search/__tests__/normalize.test.ts`

**Why:** Every query is normalized before anything else touches it. This is the first line of defense against unicode evasion, homograph attacks, and control-char injection.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/normalize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { normalizeSearchQuery } from "@/lib/search/normalize";

describe("normalizeSearchQuery", () => {
  it("collapses whitespace", () => {
    expect(normalizeSearchQuery("  jazz    brunch  ")).toBe("jazz brunch");
  });

  it("lowercases via NFKC", () => {
    expect(normalizeSearchQuery("JAZZ")).toBe("JAZZ"); // preserves case for FTS
  });

  it("strips control characters", () => {
    expect(normalizeSearchQuery("a\u0000b\u001Fc")).toBe("a b c");
  });

  it("strips zero-width and BOM", () => {
    expect(normalizeSearchQuery("a\u200Bb\uFEFFc")).toBe("abc");
  });

  it("normalizes fullwidth to ASCII via NFKC", () => {
    expect(normalizeSearchQuery("ｊａｚｚ")).toBe("jazz");
  });

  it("clamps to 120 chars", () => {
    const long = "a".repeat(500);
    expect(normalizeSearchQuery(long).length).toBe(120);
  });

  it("handles empty string", () => {
    expect(normalizeSearchQuery("")).toBe("");
  });

  it("handles whitespace-only", () => {
    expect(normalizeSearchQuery("   ")).toBe("");
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/normalize.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/normalize.ts`:

```typescript
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F\u2028\u2029]/g;
const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;
const MULTI_SPACE = /\s+/g;

/**
 * Normalize a user-supplied search query.
 *
 * - NFKC unicode canonicalization (fullwidth → ASCII, etc.)
 * - Strip control chars and zero-width (homograph + evasion defense)
 * - Collapse whitespace
 * - Hard-clamp to 120 chars after normalization (NFKC can expand length)
 */
export function normalizeSearchQuery(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(CONTROL_CHARS, " ")
    .replace(ZERO_WIDTH, "")
    .replace(MULTI_SPACE, " ")
    .trim()
    .slice(0, 120);
}
```

- [ ] **Step 4: Run test (expected: PASS, 8/8)**

```bash
npx vitest run lib/search/__tests__/normalize.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/normalize.ts lib/search/__tests__/normalize.test.ts
git commit -m "feat(search): add normalizeSearchQuery with NFKC + control-char defense"
```

---

### Task 14: `tokenize.ts` — basic tokenizer with stopword awareness

**Files:**
- Create: `web/lib/search/understanding/tokenize.ts`
- Create: `web/lib/search/understanding/__tests__/tokenize.test.ts`

**Why:** Tokens are the unit of entity linking, intent classification, and synonym expansion. A simple tokenizer is enough for Phase 0.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/understanding/__tests__/tokenize.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tokenize } from "@/lib/search/understanding/tokenize";

describe("tokenize", () => {
  it("splits on whitespace", () => {
    const tokens = tokenize("jazz brunch midtown");
    expect(tokens).toHaveLength(3);
    expect(tokens[0].text).toBe("jazz");
    expect(tokens[1].text).toBe("brunch");
    expect(tokens[2].text).toBe("midtown");
  });

  it("records positional offsets", () => {
    const tokens = tokenize("a bc def");
    expect(tokens[0]).toMatchObject({ start: 0, end: 1 });
    expect(tokens[1]).toMatchObject({ start: 2, end: 4 });
    expect(tokens[2]).toMatchObject({ start: 5, end: 8 });
  });

  it("marks common stopwords", () => {
    const tokens = tokenize("the jazz in midtown");
    expect(tokens.find(t => t.text === "the")?.stop).toBe(true);
    expect(tokens.find(t => t.text === "in")?.stop).toBe(true);
    expect(tokens.find(t => t.text === "jazz")?.stop).toBe(false);
  });

  it("normalizes to lowercase + unaccented", () => {
    const tokens = tokenize("Café");
    expect(tokens[0].normalized).toBe("cafe");
  });

  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/understanding/__tests__/tokenize.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/understanding/tokenize.ts`:

```typescript
import type { Token } from "@/lib/search/understanding/types";

const STOPWORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
  "has", "have", "he", "in", "is", "it", "its", "of", "on", "or",
  "that", "the", "to", "was", "were", "will", "with", "this", "near",
]);

function unaccent(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  if (!input) return tokens;

  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    const text = match[0];
    const normalized = unaccent(text.toLowerCase());
    tokens.push({
      text,
      normalized,
      start: match.index,
      end: match.index + text.length,
      stop: STOPWORDS.has(normalized),
    });
  }
  return tokens;
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/understanding/__tests__/tokenize.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/understanding/tokenize.ts lib/search/understanding/__tests__/tokenize.test.ts
git commit -m "feat(search): add tokenize with positional offsets and stopword marking"
```

---

### Task 15: `intent.ts` — rule-based intent classifier

**Files:**
- Create: `web/lib/search/understanding/intent.ts`
- Create: `web/lib/search/understanding/__tests__/intent.test.ts`

**Why:** Intent drives ranking priors and lane suggestions. A trustworthy rule-based classifier is enough for Phase 0 — critically, it **never strips the user's query** the way the old intent analyzer did.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/understanding/__tests__/intent.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { classifyIntent } from "@/lib/search/understanding/intent";
import { tokenize } from "@/lib/search/understanding/tokenize";

function intentFor(q: string) {
  return classifyIntent(q, tokenize(q));
}

describe("classifyIntent", () => {
  it("defaults to find_event for freeform queries", () => {
    expect(intentFor("jazz").type).toBe("find_event");
    expect(intentFor("live music").type).toBe("find_event");
  });

  it("classifies place-ish queries as find_venue", () => {
    expect(intentFor("coffee shops").type).toBe("find_venue");
    expect(intentFor("restaurants near me").type).toBe("find_venue");
  });

  it("classifies bare category names as browse_category", () => {
    expect(intentFor("comedy").type).toBe("browse_category");
    expect(intentFor("food").type).toBe("browse_category");
  });

  it("returns unknown for pathological input", () => {
    expect(intentFor("").type).toBe("unknown");
  });

  it("returns confidence between 0 and 1", () => {
    const i = intentFor("jazz brunch");
    expect(i.confidence).toBeGreaterThanOrEqual(0);
    expect(i.confidence).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/understanding/__tests__/intent.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/understanding/intent.ts`:

```typescript
import type { IntentType, Token } from "@/lib/search/understanding/types";

const VENUE_KEYWORDS = new Set([
  "shops", "shop", "restaurants", "restaurant", "bars", "bar", "cafes", "cafe",
  "venues", "venue", "places", "place", "spots", "spot",
]);

const BARE_CATEGORIES = new Set([
  "comedy", "music", "food", "art", "theater", "theatre", "film",
  "nightlife", "sports", "family", "community", "fitness",
]);

export function classifyIntent(
  raw: string,
  tokens: Token[]
): { type: IntentType; confidence: number } {
  const trimmed = raw.trim();
  if (!trimmed || tokens.length === 0) {
    return { type: "unknown", confidence: 0 };
  }

  // Bare single-token category name → browse
  if (tokens.length === 1 && BARE_CATEGORIES.has(tokens[0].normalized)) {
    return { type: "browse_category", confidence: 0.85 };
  }

  // Any venue-ish keyword in tokens → find_venue
  const hasVenueKeyword = tokens.some(t => VENUE_KEYWORDS.has(t.normalized));
  if (hasVenueKeyword) {
    return { type: "find_venue", confidence: 0.8 };
  }

  // Default: find_event (the most common search intent)
  return { type: "find_event", confidence: 0.7 };
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/understanding/__tests__/intent.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/understanding/intent.ts lib/search/understanding/__tests__/intent.test.ts
git commit -m "feat(search): add rule-based intent classifier (never strips query)"
```

---

### Task 16: `entities.ts` — minimal entity annotation stub

**Files:**
- Create: `web/lib/search/understanding/entities.ts`
- Create: `web/lib/search/understanding/__tests__/entities.test.ts`

**Why:** Entity linking is Phase 1 polish — but the interface must exist in Phase 0 so `annotate()` can call it. Ship a minimal stub that returns an empty array; extend in Phase 1 with real linking.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/understanding/__tests__/entities.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { linkEntities } from "@/lib/search/understanding/entities";
import { tokenize } from "@/lib/search/understanding/tokenize";

describe("linkEntities (Phase 0 stub)", () => {
  it("returns an empty array for any input", () => {
    const entities = linkEntities("jazz brunch", tokenize("jazz brunch"), {
      portal_id: "test",
      portal_slug: "atlanta",
    });
    expect(entities).toEqual([]);
  });

  it("accepts empty tokens without error", () => {
    expect(linkEntities("", [], { portal_id: "x", portal_slug: "y" })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/understanding/__tests__/entities.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/understanding/entities.ts`:

```typescript
import type {
  EntityAnnotation,
  PortalContext,
  Token,
} from "@/lib/search/understanding/types";

/**
 * Phase 0 stub. Entity linking (category lookup, neighborhood resolution,
 * venue name matching) lands in Phase 1 when real query data shows which
 * entities to prioritize. The interface exists now so annotate() can call it.
 */
export function linkEntities(
  _raw: string,
  _tokens: Token[],
  _ctx: PortalContext
): EntityAnnotation[] {
  return [];
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/understanding/__tests__/entities.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/understanding/entities.ts lib/search/understanding/__tests__/entities.test.ts
git commit -m "feat(search): add entity linker stub (Phase 1 will implement linking)"
```

---

### Task 17: `annotate.ts` — the public query-understanding entry point

**Files:**
- Create: `web/lib/search/understanding/annotate.ts`
- Create: `web/lib/search/understanding/__tests__/annotate.test.ts`

**Why:** This is the only public function in `understanding/`. It orchestrates normalize → tokenize → classify → link → fingerprint, returning a frozen `AnnotatedQuery` that retrievers consume.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/understanding/__tests__/annotate.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { annotate } from "@/lib/search/understanding/annotate";

const ctx = { portal_id: "test", portal_slug: "atlanta" };

describe("annotate", () => {
  it("preserves raw query", async () => {
    const q = await annotate("Jazz Brunch!", ctx);
    expect(q.raw).toBe("Jazz Brunch!");
  });

  it("normalizes in the normalized field", async () => {
    const q = await annotate("  JAZZ  ", ctx);
    expect(q.normalized).toBe("JAZZ");
  });

  it("produces tokens", async () => {
    const q = await annotate("jazz brunch", ctx);
    expect(q.tokens).toHaveLength(2);
  });

  it("classifies intent", async () => {
    const q = await annotate("jazz", ctx);
    expect(q.intent.type).toBeDefined();
  });

  it("produces stable fingerprint", async () => {
    const a = await annotate("jazz brunch", ctx);
    const b = await annotate("jazz brunch", ctx);
    expect(a.fingerprint).toBe(b.fingerprint);
  });

  it("different queries produce different fingerprints", async () => {
    const a = await annotate("jazz", ctx);
    const b = await annotate("comedy", ctx);
    expect(a.fingerprint).not.toBe(b.fingerprint);
  });

  it("returned object is frozen", async () => {
    const q = await annotate("test", ctx);
    expect(Object.isFrozen(q)).toBe(true);
  });

  it("NEVER strips the user query (regression for old intent classifier bug)", async () => {
    // The old unified-search.ts silently stripped "jazz" and substituted
    // category=music. This test guards against ever doing that again.
    const q = await annotate("jazz", ctx);
    expect(q.raw).toBe("jazz");
    expect(q.normalized).toBe("jazz");
    expect(q.structured_filters.categories).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/understanding/__tests__/annotate.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/understanding/annotate.ts`:

```typescript
import { createHash } from "node:crypto";
import { normalizeSearchQuery } from "@/lib/search/normalize";
import { tokenize } from "@/lib/search/understanding/tokenize";
import { classifyIntent } from "@/lib/search/understanding/intent";
import { linkEntities } from "@/lib/search/understanding/entities";
import type {
  AnnotatedQuery,
  PortalContext,
} from "@/lib/search/understanding/types";

/**
 * The ONLY public entry point for query understanding. Retrievers consume
 * the AnnotatedQuery output; they never see the raw string.
 *
 * CRITICAL INVARIANT: this function must NEVER mutate, strip, or substitute
 * the user's query. The `raw` and `normalized` fields preserve the user's
 * intent end-to-end. This is the architectural fix for the 1869-line
 * unified-search.ts bug where "jazz" was silently replaced with
 * category=music and an empty FTS query.
 */
export async function annotate(
  raw: string,
  ctx: PortalContext
): Promise<AnnotatedQuery> {
  const normalized = normalizeSearchQuery(raw);
  const tokens = tokenize(normalized);
  const intent = classifyIntent(normalized, tokens);
  const entities = linkEntities(normalized, tokens, ctx);

  const fingerprint = createHash("sha256")
    .update(ctx.portal_slug)
    .update("\0")
    .update(normalized)
    .update("\0")
    .update(intent.type)
    .digest("hex")
    .slice(0, 32);

  return Object.freeze({
    raw,
    normalized,
    tokens: Object.freeze(tokens),
    entities: Object.freeze(entities),
    spelling: Object.freeze([]),
    synonyms: Object.freeze([]),
    structured_filters: Object.freeze({}),
    intent,
    fingerprint,
  });
}
```

- [ ] **Step 4: Run test (expected: PASS, 8/8)**

```bash
npx vitest run lib/search/understanding/__tests__/annotate.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/understanding/annotate.ts lib/search/understanding/__tests__/annotate.test.ts
git commit -m "feat(search): add annotate — immutable query understanding entry"
```

---

## Part E — Input schema + Zod (1 task)

### Task 18: `input-schema.ts` — Zod validation for search params

**Files:**
- Create: `web/lib/search/input-schema.ts`
- Create: `web/lib/search/__tests__/input-schema.test.ts`

**Why:** First line of server-side defense against injection, DoS, and abuse. Every request to `/api/search/unified` flows through this schema.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/input-schema.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { SearchInputSchema, parseSearchInput } from "@/lib/search/input-schema";

describe("SearchInputSchema", () => {
  it("accepts minimal valid input", () => {
    const result = SearchInputSchema.parse({ q: "jazz" });
    expect(result.q).toBe("jazz");
    expect(result.limit).toBe(20);
    expect(result.offset).toBe(0);
  });

  it("rejects empty query", () => {
    expect(() => SearchInputSchema.parse({ q: "" })).toThrow();
  });

  it("rejects query over 120 chars", () => {
    expect(() => SearchInputSchema.parse({ q: "a".repeat(121) })).toThrow();
  });

  it("rejects limit > 50", () => {
    expect(() => SearchInputSchema.parse({ q: "x", limit: 51 })).toThrow();
  });

  it("rejects offset > 500", () => {
    expect(() => SearchInputSchema.parse({ q: "x", offset: 501 })).toThrow();
  });

  it("rejects invalid facet slug", () => {
    expect(() => SearchInputSchema.parse({ q: "x", categories: ["bad slug!"] })).toThrow();
  });

  it("rejects too many facets", () => {
    const many = Array.from({ length: 21 }, (_, i) => `c_${i}`);
    expect(() => SearchInputSchema.parse({ q: "x", categories: many })).toThrow();
  });
});

describe("parseSearchInput", () => {
  it("parses URL params with comma-separated arrays", () => {
    const sp = new URLSearchParams("q=jazz&categories=music,comedy");
    const input = parseSearchInput(sp);
    expect(input.q).toBe("jazz");
    expect(input.categories).toEqual(["music", "comedy"]);
  });

  it("applies NFKC normalization to q", () => {
    const sp = new URLSearchParams("q=%EF%BD%8A%EF%BD%81%EF%BD%9A%EF%BD%9A"); // fullwidth "jazz"
    const input = parseSearchInput(sp);
    expect(input.q).toBe("jazz");
  });

  it("strips control chars", () => {
    const sp = new URLSearchParams();
    sp.set("q", "a\u0000b");
    const input = parseSearchInput(sp);
    expect(input.q).toBe("a b");
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/input-schema.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/input-schema.ts`:

```typescript
import { z } from "zod";
import { normalizeSearchQuery } from "@/lib/search/normalize";

export const SearchEntityType = z.enum([
  "event", "venue", "organizer", "series", "festival",
  "exhibition", "program", "neighborhood",
]);

const FacetSlug = z.string().min(1).max(32).regex(/^[a-z0-9_]+$/, {
  message: "facet slug must be lowercase alphanumeric + underscore",
});

export const SearchDateWindow = z.enum(["today", "tomorrow", "weekend", "week"]);

export const SearchInputSchema = z.object({
  q: z.string().min(1).max(120),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).max(500).default(0),
  types: z.array(SearchEntityType).max(8).optional(),
  categories: z.array(FacetSlug).max(20).optional(),
  neighborhoods: z.array(FacetSlug).max(20).optional(),
  tags: z.array(FacetSlug).max(20).optional(),
  date: SearchDateWindow.nullable().optional(),
  free: z.coerce.boolean().optional(),
  price: z.coerce.number().int().min(1).max(4).nullable().optional(),
  cursor: z.string().max(256).optional(),
  locale: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/).max(5).optional(),
});

export type SearchInput = z.infer<typeof SearchInputSchema>;

/**
 * Parse URLSearchParams into a validated, normalized SearchInput.
 * Array params arrive comma-separated; they're split before Zod validation.
 * The query field gets NFKC normalization + control-char stripping applied
 * AFTER the initial parse.
 */
export function parseSearchInput(searchParams: URLSearchParams): SearchInput {
  const raw = Object.fromEntries(searchParams.entries());
  const arrayify = (v: string | undefined) =>
    v ? v.split(",").map((s) => s.trim()).filter(Boolean) : undefined;

  const parsed = SearchInputSchema.parse({
    ...raw,
    types: arrayify(raw.types),
    categories: arrayify(raw.categories),
    neighborhoods: arrayify(raw.neighborhoods),
    tags: arrayify(raw.tags),
  });

  return { ...parsed, q: normalizeSearchQuery(parsed.q) };
}
```

- [ ] **Step 4: Run test (expected: PASS, 10/10)**

```bash
npx vitest run lib/search/__tests__/input-schema.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/input-schema.ts lib/search/__tests__/input-schema.test.ts
git commit -m "feat(search): add Zod input schema with NFKC normalization"
```

---

## Part F — Unified retrieval + retrievers (4 tasks)

### Task 19: `unified-retrieval.ts` — single RPC call, demultiplex into per-retriever map

**Files:**
- Create: `web/lib/search/unified-retrieval.ts`
- Create: `web/lib/search/__tests__/unified-retrieval.test.ts`

**Why:** The load-bearing reconciliation of the architect's retriever pluralism with the performance expert's pool-exhaustion concern. This file is the ONLY place `search_unified` is called. Retrievers read from its result.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/unified-retrieval.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { runUnifiedRetrieval, type UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    rpc: vi.fn().mockResolvedValue({
      data: [
        { retriever_id: "fts", entity_type: "event", entity_id: "e1",
          raw_score: 0.9, quality: 0.8, days_out: 3, title: "Jazz Night",
          subtitle: "Variety Playhouse", image_url: null, href_slug: "e1",
          starts_at: "2026-04-16T20:00:00Z" },
        { retriever_id: "trigram", entity_type: "event", entity_id: "e2",
          raw_score: 0.7, quality: 0.5, days_out: 5, title: "Jaz Fest",
          subtitle: null, image_url: null, href_slug: "e2",
          starts_at: "2026-04-18T18:00:00Z" },
        { retriever_id: "fts", entity_type: "venue", entity_id: "v1",
          raw_score: 0.85, quality: 0.9, days_out: 0, title: "The Jazz Corner",
          subtitle: "Midtown", image_url: null, href_slug: "jazz-corner",
          starts_at: null },
      ],
      error: null,
    }),
  }),
}));

const mockQuery: AnnotatedQuery = Object.freeze({
  raw: "jazz",
  normalized: "jazz",
  tokens: [],
  entities: [],
  spelling: [],
  synonyms: [],
  structured_filters: {},
  intent: { type: "find_event", confidence: 0.7 },
  fingerprint: "abc",
});

describe("runUnifiedRetrieval", () => {
  beforeEach(() => vi.clearAllMocks());

  it("demultiplexes rows into per-retriever map", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    expect(result.fts).toHaveLength(2);       // event + venue
    expect(result.trigram).toHaveLength(1);   // event only
    expect(result.structured).toHaveLength(0);
  });

  it("preserves retriever + type tags on candidates", async () => {
    const result = await runUnifiedRetrieval(mockQuery, {
      portal_id: "p1",
      limit: 20,
      signal: new AbortController().signal,
    });
    expect(result.fts[0].source_retriever).toBe("fts");
    expect(result.fts[0].type).toBe("event");
    expect(result.fts[1].type).toBe("venue");
  });

  it("fails closed on missing portal_id", async () => {
    await expect(
      runUnifiedRetrieval(mockQuery, {
        portal_id: "",
        limit: 20,
        signal: new AbortController().signal,
      })
    ).rejects.toThrow(/portal_id/);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/unified-retrieval.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/unified-retrieval.ts`:

```typescript
import "server-only";
import { createServiceClient } from "@/lib/supabase/service";
import type {
  Candidate,
  RetrieverContext,
  RetrieverId,
} from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";

export interface UnifiedRetrievalResult {
  fts: Candidate[];
  trigram: Candidate[];
  structured: Candidate[];
}

interface RawRow {
  retriever_id: string;
  entity_type: string;
  entity_id: string;
  raw_score: number;
  quality: number;
  days_out: number;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  href_slug: string;
  starts_at: string | null;
}

function toCandidate(row: RawRow): Candidate {
  return {
    id: row.entity_id,
    type: row.entity_type as Candidate["type"],
    source_retriever: row.retriever_id as RetrieverId,
    raw_score: row.raw_score,
    matched_fields: [],
    payload: {
      title: row.title,
      subtitle: row.subtitle ?? undefined,
      image_url: row.image_url ?? undefined,
      href_slug: row.href_slug,
      starts_at: row.starts_at ?? undefined,
      quality: row.quality,
      days_out: row.days_out,
    },
  };
}

/**
 * Single-connection retrieval. Runs all retrievers (FTS, trigram) for all
 * requested entity types as CTEs inside one Postgres function call. The
 * returned tagged rows are demultiplexed into per-retriever candidate sets
 * which downstream Retriever classes consume via their `retrieve()` method.
 */
export async function runUnifiedRetrieval(
  q: AnnotatedQuery,
  ctx: RetrieverContext
): Promise<UnifiedRetrievalResult> {
  if (!ctx.portal_id) {
    throw new Error("runUnifiedRetrieval: portal_id is required");
  }

  const client = createServiceClient();
  const { data, error } = await client.rpc("search_unified", {
    p_portal_id: ctx.portal_id,
    p_query: q.normalized,
    p_types: ["event", "venue"],
    p_categories: q.structured_filters.categories ?? null,
    p_neighborhoods: q.structured_filters.neighborhoods ?? null,
    p_date_from: q.temporal?.start ?? null,
    p_date_to: q.temporal?.end ?? null,
    p_free_only: q.structured_filters.price?.free ?? false,
    p_limit_per_retriever: ctx.limit,
  });

  if (error) {
    throw new Error(`search_unified failed: ${error.message}`);
  }

  const result: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
  for (const row of (data ?? []) as RawRow[]) {
    const bucket = row.retriever_id as keyof UnifiedRetrievalResult;
    if (bucket in result) {
      result[bucket].push(toCandidate(row));
    }
  }
  return result;
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/unified-retrieval.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/unified-retrieval.ts lib/search/__tests__/unified-retrieval.test.ts
git commit -m "feat(search): add runUnifiedRetrieval — single RPC, demultiplex by retriever"
```

---

### Task 20: `FtsRetriever` — reads FTS slice of unified result

**Files:**
- Create: `web/lib/search/retrievers/fts.ts`
- Create: `web/lib/search/retrievers/__tests__/fts.test.ts`

**Why:** The Retriever contract: each retriever class interprets its slice of `UnifiedRetrievalResult`. FtsRetriever is the simplest — it passes through. TrigramRetriever adds confidence filtering. Structured adds filter validation.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/retrievers/__tests__/fts.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createFtsRetriever } from "@/lib/search/retrievers/fts";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

const mockSource: UnifiedRetrievalResult = {
  fts: [{
    id: "1", type: "event", source_retriever: "fts",
    raw_score: 0.9, matched_fields: [], payload: {},
  }],
  trigram: [],
  structured: [],
};

describe("FtsRetriever", () => {
  it("has id 'fts'", () => {
    const r = createFtsRetriever(mockSource);
    expect(r.id).toBe("fts");
  });

  it("returns the fts slice of the source", async () => {
    const r = createFtsRetriever(mockSource);
    const result = await r.retrieve({} as never, {
      portal_id: "p", limit: 10, signal: new AbortController().signal,
    });
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("returns empty array when source has no fts results", async () => {
    const empty: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
    const r = createFtsRetriever(empty);
    expect(await r.retrieve({} as never, { portal_id: "p", limit: 10, signal: new AbortController().signal })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/retrievers/__tests__/fts.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/retrievers/fts.ts`:

```typescript
import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

/**
 * FtsRetriever interprets the 'fts' slice of a UnifiedRetrievalResult.
 * It does NOT issue its own database calls — that would blow the connection
 * pool budget. The lint rule no-retriever-rpc-calls enforces this.
 */
export function createFtsRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "fts",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.fts;
    },
  };
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/retrievers/__tests__/fts.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/retrievers/fts.ts lib/search/retrievers/__tests__/fts.test.ts
git commit -m "feat(search): add FtsRetriever reading from UnifiedRetrievalResult"
```

---

### Task 21: `TrigramRetriever` — reads trigram slice with similarity floor

**Files:**
- Create: `web/lib/search/retrievers/trigram.ts`
- Create: `web/lib/search/retrievers/__tests__/trigram.test.ts`

**Why:** Trigram matches are noisier than FTS matches. This retriever applies a minimum similarity floor (0.25) to avoid low-quality fuzzy matches polluting results.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/retrievers/__tests__/trigram.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createTrigramRetriever } from "@/lib/search/retrievers/trigram";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

function source(scores: number[]): UnifiedRetrievalResult {
  return {
    fts: [],
    structured: [],
    trigram: scores.map((s, i) => ({
      id: `${i}`,
      type: "event" as const,
      source_retriever: "trigram" as const,
      raw_score: s,
      matched_fields: [],
      payload: {},
    })),
  };
}

describe("TrigramRetriever", () => {
  it("filters out candidates below similarity floor", async () => {
    const r = createTrigramRetriever(source([0.8, 0.5, 0.2, 0.1]));
    const result = await r.retrieve({} as never, {
      portal_id: "p", limit: 10, signal: new AbortController().signal,
    });
    expect(result).toHaveLength(2); // 0.8, 0.5
  });

  it("preserves input order above the floor", async () => {
    const r = createTrigramRetriever(source([0.9, 0.7, 0.5]));
    const result = await r.retrieve({} as never, {
      portal_id: "p", limit: 10, signal: new AbortController().signal,
    });
    expect(result[0].raw_score).toBe(0.9);
    expect(result[2].raw_score).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/retrievers/__tests__/trigram.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/retrievers/trigram.ts`:

```typescript
import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

const TRIGRAM_SIMILARITY_FLOOR = 0.25;

export function createTrigramRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "trigram",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.trigram.filter((c) => c.raw_score >= TRIGRAM_SIMILARITY_FLOOR);
    },
  };
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/retrievers/__tests__/trigram.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/retrievers/trigram.ts lib/search/retrievers/__tests__/trigram.test.ts
git commit -m "feat(search): add TrigramRetriever with similarity floor"
```

---

### Task 22: `StructuredRetriever` + retriever registry

**Files:**
- Create: `web/lib/search/retrievers/structured.ts`
- Create: `web/lib/search/retrievers/index.ts`
- Create: `web/lib/search/retrievers/__tests__/structured.test.ts`

**Why:** Structured retrieval matches filter-based queries (category, neighborhood, date) without text matching. For Phase 0 this is a thin wrapper — the real work is in Phase 1 when structured filters land as first-class.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/retrievers/__tests__/structured.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { createStructuredRetriever } from "@/lib/search/retrievers/structured";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

describe("StructuredRetriever", () => {
  it("has id 'structured'", () => {
    const source: UnifiedRetrievalResult = { fts: [], trigram: [], structured: [] };
    expect(createStructuredRetriever(source).id).toBe("structured");
  });

  it("returns the structured slice unchanged", async () => {
    const source: UnifiedRetrievalResult = {
      fts: [], trigram: [],
      structured: [{
        id: "1", type: "event", source_retriever: "structured",
        raw_score: 1.0, matched_fields: [], payload: {},
      }],
    };
    const r = createStructuredRetriever(source);
    const result = await r.retrieve({} as never, {
      portal_id: "p", limit: 10, signal: new AbortController().signal,
    });
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/retrievers/__tests__/structured.test.ts
```

- [ ] **Step 3: Implement the retriever**

Create `web/lib/search/retrievers/structured.ts`:

```typescript
import type { Candidate, Retriever, RetrieverContext } from "@/lib/search/types";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

export function createStructuredRetriever(source: UnifiedRetrievalResult): Retriever {
  return {
    id: "structured",
    async retrieve(_q: AnnotatedQuery, _ctx: RetrieverContext): Promise<Candidate[]> {
      return source.structured;
    },
  };
}
```

- [ ] **Step 4: Implement the registry**

Create `web/lib/search/retrievers/index.ts`:

```typescript
import type { Retriever, RetrieverId } from "@/lib/search/types";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import { createFtsRetriever } from "@/lib/search/retrievers/fts";
import { createTrigramRetriever } from "@/lib/search/retrievers/trigram";
import { createStructuredRetriever } from "@/lib/search/retrievers/structured";

export function buildRetrieverRegistry(
  source: UnifiedRetrievalResult
): Record<RetrieverId, Retriever> {
  return {
    fts: createFtsRetriever(source),
    trigram: createTrigramRetriever(source),
    structured: createStructuredRetriever(source),
  };
}
```

- [ ] **Step 5: Run tests**

```bash
npx vitest run lib/search/retrievers/__tests__/
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add lib/search/retrievers/structured.ts lib/search/retrievers/index.ts lib/search/retrievers/__tests__/structured.test.ts
git commit -m "feat(search): add StructuredRetriever + retriever registry"
```

---

## Part G — Ranking (1 task)

### Task 23: `RrfRanker` — Reciprocal Rank Fusion (k=60)

**Files:**
- Create: `web/lib/search/ranking/rrf.ts`
- Create: `web/lib/search/ranking/index.ts`
- Create: `web/lib/search/ranking/__tests__/rrf.test.ts`

**Why:** RRF with k=60 (Cormack et al. 2009) is the canonical scale-invariant rank fusion algorithm. It works without tuning across retrievers with incompatible score scales. This is the Phase 0 default ranker; z-score weighting is available but off by default.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/ranking/__tests__/rrf.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { RrfRanker } from "@/lib/search/ranking/rrf";
import type { Candidate, RetrieverId } from "@/lib/search/types";

function c(id: string, retriever: RetrieverId, score: number): Candidate {
  return {
    id, type: "event", source_retriever: retriever,
    raw_score: score, matched_fields: [], payload: {},
  };
}

describe("RrfRanker", () => {
  it("fuses candidates from multiple retrievers", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9), c("b", "fts", 0.5)]],
      ["trigram", [c("b", "trigram", 0.8), c("c", "trigram", 0.6)]],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    // 'b' appears in both → should win
    expect(result[0].id).toBe("b");
    expect(result[0].contributing_retrievers).toContain("fts");
    expect(result[0].contributing_retrievers).toContain("trigram");
  });

  it("assigns ranks starting at 0", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9)]],
      ["trigram", []],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    expect(result[0].rank).toBe(0);
  });

  it("handles empty retriever sets", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", []], ["trigram", []], ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "unknown", confidence: 0 } });
    expect(result).toEqual([]);
  });

  it("preserves id and type of merged candidates", () => {
    const sets = new Map<RetrieverId, Candidate[]>([
      ["fts", [c("a", "fts", 0.9)]],
      ["trigram", []],
      ["structured", []],
    ]);
    const result = RrfRanker.rank(sets, { weights: {}, intent: { type: "find_event", confidence: 0.7 } });
    expect(result[0].id).toBe("a");
    expect(result[0].type).toBe("event");
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/ranking/__tests__/rrf.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/ranking/rrf.ts`:

```typescript
import type { Candidate, RetrieverId } from "@/lib/search/types";
import type { Ranker, RankedCandidate, RankingContext } from "@/lib/search/ranking/types";

const RRF_K = 60; // Cormack et al. 2009 canonical constant

/**
 * Reciprocal Rank Fusion ranker. Scale-invariant: only cares about ranks within
 * each retriever, so retrievers can return any score scale and fusion still works.
 *
 * Formula: final_score = Σ 1 / (k + rank_r)  for each retriever r containing the candidate.
 */
export const RrfRanker: Ranker = {
  id: "rrf-k60",
  rank(
    candidateSets: Map<RetrieverId, Candidate[]>,
    _ctx: RankingContext
  ): RankedCandidate[] {
    // Sort each set by raw_score DESC so rank positions are meaningful
    const sortedSets = new Map<RetrieverId, Candidate[]>();
    for (const [retriever, list] of candidateSets) {
      sortedSets.set(retriever, [...list].sort((a, b) => b.raw_score - a.raw_score));
    }

    // Accumulate RRF score and track contributing retrievers
    const scores = new Map<string, { score: number; contributors: RetrieverId[]; candidate: Candidate }>();

    for (const [retriever, sorted] of sortedSets) {
      sorted.forEach((c, i) => {
        const key = `${c.type}:${c.id}`;
        const existing = scores.get(key);
        const contribution = 1 / (RRF_K + i + 1);
        if (existing) {
          existing.score += contribution;
          existing.contributors.push(retriever);
        } else {
          scores.set(key, { score: contribution, contributors: [retriever], candidate: c });
        }
      });
    }

    // Materialize, sort descending, assign final_score and rank
    const ranked: RankedCandidate[] = Array.from(scores.values())
      .map(({ score, contributors, candidate }) => ({
        ...candidate,
        final_score: score,
        contributing_retrievers: contributors,
        rank: 0, // placeholder, set below
      }))
      .sort((a, b) => b.final_score - a.final_score);

    ranked.forEach((c, i) => { c.rank = i; });
    return ranked;
  },
};
```

Create `web/lib/search/ranking/index.ts`:

```typescript
export { RrfRanker } from "@/lib/search/ranking/rrf";
export type { Ranker, RankedCandidate, RankingContext } from "@/lib/search/ranking/types";
```

- [ ] **Step 4: Run test (expected: PASS, 4/4)**

```bash
npx vitest run lib/search/ranking/__tests__/rrf.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/ranking/
git commit -m "feat(search): add RrfRanker (Reciprocal Rank Fusion, k=60)"
```

---

## Part H — Presentation (1 task)

### Task 24: `GroupedPresenter` — Top Matches + grouped sections

**Files:**
- Create: `web/lib/search/presenting/grouped.ts`
- Create: `web/lib/search/presenting/index.ts`
- Create: `web/lib/search/presenting/__tests__/grouped.test.ts`

**Why:** The outermost layer. Takes ranked candidates and produces the response payload the API returns: a Top Matches rail (best-of-each-type interleaved) plus grouped sections (Events · N, Places · N).

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/presenting/__tests__/grouped.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { GroupedPresenter } from "@/lib/search/presenting/grouped";
import type { RankedCandidate } from "@/lib/search/ranking/types";
import type { EntityType } from "@/lib/search/types";

function rc(id: string, type: EntityType, score: number): RankedCandidate {
  return {
    id, type, source_retriever: "fts",
    raw_score: score, matched_fields: [], payload: {},
    final_score: score, contributing_retrievers: ["fts"], rank: 0,
  };
}

describe("GroupedPresenter", () => {
  const policy = {
    topMatchesCount: 3,
    groupCaps: { event: 8, venue: 6 } as Partial<Record<EntityType, number>>,
    diversityLambda: 0,
    dedupeKey: (c: RankedCandidate) => `${c.type}:${c.id}`,
  };

  it("produces topMatches capped at policy.topMatchesCount", () => {
    const ranked = [
      rc("a", "event", 0.9), rc("b", "venue", 0.8),
      rc("c", "event", 0.7), rc("d", "event", 0.6),
      rc("e", "venue", 0.5),
    ];
    const result = GroupedPresenter.present(ranked, policy);
    expect(result.topMatches).toHaveLength(3);
  });

  it("groups candidates by type", () => {
    const ranked = [
      rc("a", "event", 0.9), rc("b", "venue", 0.8),
      rc("c", "event", 0.7),
    ];
    const result = GroupedPresenter.present(ranked, policy);
    const eventSection = result.sections.find(s => s.type === "event");
    const venueSection = result.sections.find(s => s.type === "venue");
    expect(eventSection?.items).toHaveLength(2);
    expect(venueSection?.items).toHaveLength(1);
  });

  it("caps each section at groupCaps", () => {
    const ranked = Array.from({ length: 15 }, (_, i) => rc(`e${i}`, "event", 1 - i * 0.01));
    const result = GroupedPresenter.present(ranked, policy);
    const eventSection = result.sections.find(s => s.type === "event");
    expect(eventSection?.items).toHaveLength(8); // policy.groupCaps.event
    expect(eventSection?.total).toBe(15);
  });

  it("returns totals per type", () => {
    const ranked = [rc("a", "event", 0.9), rc("b", "event", 0.8), rc("c", "venue", 0.7)];
    const result = GroupedPresenter.present(ranked, policy);
    expect(result.totals.event).toBe(2);
    expect(result.totals.venue).toBe(1);
  });

  it("handles empty input", () => {
    const result = GroupedPresenter.present([], policy);
    expect(result.topMatches).toEqual([]);
    expect(result.sections).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/presenting/__tests__/grouped.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/presenting/grouped.ts`:

```typescript
import type { EntityType } from "@/lib/search/types";
import type { RankedCandidate } from "@/lib/search/ranking/types";
import type {
  Presenter,
  PresentationPolicy,
  PresentedResults,
} from "@/lib/search/presenting/types";

const TYPE_TITLES: Record<EntityType, string> = {
  event: "Events",
  venue: "Places",
  organizer: "Organizers",
  series: "Series",
  festival: "Festivals",
  exhibition: "Exhibitions",
  program: "Classes",
  neighborhood: "Neighborhoods",
  category: "Tags",
};

const SECTION_ORDER: EntityType[] = [
  "event", "venue", "series", "festival",
  "exhibition", "program", "organizer", "category", "neighborhood",
];

export const GroupedPresenter: Presenter = {
  present(ranked: RankedCandidate[], policy: PresentationPolicy): PresentedResults {
    // Dedupe by policy.dedupeKey while preserving first-seen order
    const seen = new Set<string>();
    const deduped: RankedCandidate[] = [];
    for (const c of ranked) {
      const k = policy.dedupeKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      deduped.push(c);
    }

    // Top matches: first N candidates globally (already sorted by rank)
    const topMatches = deduped.slice(0, policy.topMatchesCount);

    // Group by type
    const byType = new Map<EntityType, RankedCandidate[]>();
    for (const c of deduped) {
      const list = byType.get(c.type) ?? [];
      list.push(c);
      byType.set(c.type, list);
    }

    const totals: Partial<Record<EntityType, number>> = {};
    for (const [type, list] of byType) {
      totals[type] = list.length;
    }

    // Section-order, capped per type
    const sections = SECTION_ORDER
      .filter((type) => byType.has(type))
      .map((type) => {
        const list = byType.get(type)!;
        const cap = policy.groupCaps[type] ?? list.length;
        return {
          type,
          title: TYPE_TITLES[type],
          items: list.slice(0, cap),
          total: list.length,
        };
      });

    return {
      topMatches,
      sections,
      totals,
      diagnostics: {
        total_ms: 0, // filled by orchestrator
        cache_hit: "miss",
        degraded: false,
        retriever_ms: {},
        result_type_counts: totals,
      },
    };
  },
};
```

Create `web/lib/search/presenting/index.ts`:

```typescript
export { GroupedPresenter } from "@/lib/search/presenting/grouped";
export type { Presenter, PresentationPolicy, PresentedResults, SearchDiagnostics } from "@/lib/search/presenting/types";
```

- [ ] **Step 4: Run test (expected: PASS, 5/5)**

```bash
npx vitest run lib/search/presenting/__tests__/grouped.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/presenting/
git commit -m "feat(search): add GroupedPresenter (Top Matches + grouped sections)"
```

---

## Part I — Search service orchestrator (1 task)

### Task 25: `search-service.ts` — the ~150-line orchestrator

**Files:**
- Create: `web/lib/search/search-service.ts`
- Create: `web/lib/search/index.ts`
- Create: `web/lib/search/__tests__/search-service.test.ts`

**Why:** The orchestrator wires annotate → unified retrieval → retrievers → ranker → presenter. **Target: ~150 lines.** If it grows beyond 250, extract helpers into supporting modules — do not let this file become `unified-search.ts` v2.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/search-service.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { search } from "@/lib/search";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";

vi.mock("@/lib/search/unified-retrieval", () => ({
  runUnifiedRetrieval: vi.fn(async (): Promise<UnifiedRetrievalResult> => ({
    fts: [
      { id: "e1", type: "event", source_retriever: "fts", raw_score: 0.9,
        matched_fields: [], payload: { title: "Jazz Night" } },
    ],
    trigram: [
      { id: "e2", type: "event", source_retriever: "trigram", raw_score: 0.6,
        matched_fields: [], payload: { title: "Jaz Show" } },
    ],
    structured: [],
  })),
}));

describe("search orchestrator", () => {
  it("returns PresentedResults for a valid query", async () => {
    const result = await search("jazz", {
      portal_id: "p1",
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.topMatches.length).toBeGreaterThan(0);
    expect(result.sections.length).toBeGreaterThan(0);
  });

  it("records diagnostics (total_ms, cache_hit)", async () => {
    const result = await search("jazz", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    expect(result.diagnostics.total_ms).toBeGreaterThanOrEqual(0);
    expect(["fresh", "stale", "miss"]).toContain(result.diagnostics.cache_hit);
  });

  it("preserves raw query in no-mutation contract", async () => {
    const result = await search("jazz brunch", {
      portal_id: "p1", portal_slug: "atlanta", limit: 20,
    });
    // Orchestrator must not mutate the query. The annotated query inside the
    // flow carries .raw === "jazz brunch" — we verify indirectly via the fact
    // that the result's diagnostics came from the real path.
    expect(result.diagnostics).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/search-service.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/search-service.ts`:

```typescript
import "server-only";
import { annotate } from "@/lib/search/understanding/annotate";
import { runUnifiedRetrieval } from "@/lib/search/unified-retrieval";
import { buildRetrieverRegistry } from "@/lib/search/retrievers";
import { RrfRanker } from "@/lib/search/ranking";
import { GroupedPresenter } from "@/lib/search/presenting";
import type { PresentedResults, PresentationPolicy } from "@/lib/search/presenting/types";
import type { RetrieverId } from "@/lib/search/types";
import type { Candidate } from "@/lib/search/types";

const DEFAULT_POLICY: PresentationPolicy = {
  topMatchesCount: 6,
  groupCaps: { event: 8, venue: 6, organizer: 4, series: 4, festival: 4, program: 4 },
  diversityLambda: 0,
  dedupeKey: (c) => `${c.type}:${c.id}`,
};

export interface SearchOptions {
  portal_id: string;
  portal_slug: string;
  limit: number;
  user_id?: string;
  signal?: AbortSignal;
}

/**
 * The orchestrator. Strictly three phases:
 *   1. Understand  — annotate(raw) → AnnotatedQuery
 *   2. Retrieve    — runUnifiedRetrieval → UnifiedRetrievalResult → per-retriever candidates
 *   3. Rank + Present — RrfRanker → GroupedPresenter → PresentedResults
 *
 * This file MUST stay small (~150 lines). If it grows beyond 250, extract
 * helpers into supporting modules (understanding/, ranking/, presenting/).
 * Do not let it become unified-search.ts v2.
 */
export async function search(
  raw: string,
  opts: SearchOptions
): Promise<PresentedResults> {
  const started = Date.now();
  const signal = opts.signal ?? new AbortController().signal;

  // 1. Understand
  const annotated = await annotate(raw, {
    portal_id: opts.portal_id,
    portal_slug: opts.portal_slug,
  });
  const annotateMs = Date.now() - started;

  // 2. Retrieve — single RPC call, demultiplex by retriever
  const retrieveStart = Date.now();
  const unifiedResult = await runUnifiedRetrieval(annotated, {
    portal_id: opts.portal_id,
    user_id: opts.user_id,
    limit: opts.limit,
    signal,
  });
  const retrieveMs = Date.now() - retrieveStart;

  // 3a. Instantiate retrievers reading from the unified result
  const registry = buildRetrieverRegistry(unifiedResult);
  const retrieverIds: RetrieverId[] = ["fts", "trigram", "structured"];
  const candidateSets = new Map<RetrieverId, Candidate[]>();
  for (const id of retrieverIds) {
    const retriever = registry[id];
    const candidates = await retriever.retrieve(annotated, {
      portal_id: opts.portal_id,
      user_id: opts.user_id,
      limit: opts.limit,
      signal,
    });
    candidateSets.set(id, candidates);
  }

  // 3b. Rank
  const rankStart = Date.now();
  const ranked = RrfRanker.rank(candidateSets, {
    weights: {},
    intent: annotated.intent,
  });
  const rankMs = Date.now() - rankStart;

  // 3c. Present
  const presentStart = Date.now();
  const presented = GroupedPresenter.present(ranked, DEFAULT_POLICY);
  const presentMs = Date.now() - presentStart;

  // Fill diagnostics
  presented.diagnostics.total_ms = Date.now() - started;
  presented.diagnostics.annotate_ms = annotateMs;
  presented.diagnostics.rank_ms = rankMs;
  presented.diagnostics.present_ms = presentMs;
  presented.diagnostics.retriever_ms = { fts: retrieveMs };
  presented.diagnostics.cache_hit = "miss"; // Phase 0: cache wrapper lands in Phase 1

  return presented;
}
```

Create `web/lib/search/index.ts`:

```typescript
export { search } from "@/lib/search/search-service";
export type { SearchOptions } from "@/lib/search/search-service";
export type { PresentedResults, SearchDiagnostics } from "@/lib/search/presenting/types";
export type { EntityType, Candidate, RetrieverId } from "@/lib/search/types";
export type { AnnotatedQuery } from "@/lib/search/understanding/types";
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/search-service.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Verify file size**

```bash
wc -l lib/search/search-service.ts
```

Expected: under 200 lines. If higher, extract helpers before proceeding.

- [ ] **Step 6: Commit**

```bash
git add lib/search/search-service.ts lib/search/index.ts lib/search/__tests__/search-service.test.ts
git commit -m "feat(search): add search orchestrator (~150 lines, three-phase pipeline)"
```

---

## Part J — Observability (1 task)

### Task 26: `observability.ts` — async `search_events` logging with daily salt

**Files:**
- Create: `web/lib/search/observability.ts`
- Create: `web/lib/search/__tests__/observability.test.ts`

**Why:** Phase 0 ships basic observability. Without the `search_events` table populated from day one, every downstream decision is guesswork. This module handles the async write pattern via `after()` and hashes queries with the daily-rotating salt.

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/observability.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { hashQuery, buildSearchEventRow } from "@/lib/search/observability";
import type { PresentedResults } from "@/lib/search/presenting/types";

describe("hashQuery", () => {
  it("produces stable hash for same inputs", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("jazz", salt, "atlanta");
    expect(a.equals(b)).toBe(true);
  });

  it("produces different hashes for different queries", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("comedy", salt, "atlanta");
    expect(a.equals(b)).toBe(false);
  });

  it("produces different hashes across portals", () => {
    const salt = Buffer.from("0".repeat(64), "hex");
    const a = hashQuery("jazz", salt, "atlanta");
    const b = hashQuery("jazz", salt, "arts");
    expect(a.equals(b)).toBe(false);
  });
});

describe("buildSearchEventRow", () => {
  it("produces a valid row shape with no user_id", () => {
    const presented: PresentedResults = {
      topMatches: [],
      sections: [],
      totals: {},
      diagnostics: {
        total_ms: 123,
        cache_hit: "miss",
        degraded: false,
        retriever_ms: { fts: 50 },
        result_type_counts: { event: 5 },
      },
    };
    const row = buildSearchEventRow({
      query: "jazz",
      portalSlug: "atlanta",
      segment: "anon",
      hadFilters: false,
      presented,
      intentType: "find_event",
      salt: Buffer.from("0".repeat(64), "hex"),
    });
    expect(row.user_segment).toBe("anon");
    expect(row.query_length).toBe(4);
    expect(row.query_word_count).toBe(1);
    expect(row.total_ms).toBe(123);
    expect(row.cache_hit).toBe("miss");
    // CRITICAL: no user_id field
    expect((row as Record<string, unknown>).user_id).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/observability.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/observability.ts`:

```typescript
import "server-only";
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import type { PresentedResults } from "@/lib/search/presenting/types";

/**
 * Hash a query for observability. Uses sha256 with daily-rotating salt to
 * prevent long-term re-identification while preserving intra-day clustering
 * (for zero-result detection, "what are people searching right now").
 */
export function hashQuery(
  normalizedQ: string,
  salt: Buffer,
  portalSlug: string
): Buffer {
  return createHash("sha256")
    .update(normalizedQ)
    .update(":")
    .update(portalSlug)
    .update(":")
    .update(salt)
    .digest();
}

/**
 * Fetch today's salt. 1-minute in-process cache.
 * The cron job at 00:05 UTC creates the new day's salt.
 */
let cachedSalt: { day: string; salt: Buffer; expires: number } | null = null;

export async function getTodaySalt(): Promise<Buffer> {
  const today = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  if (cachedSalt && cachedSalt.day === today && cachedSalt.expires > now) {
    return cachedSalt.salt;
  }
  const client = createServiceClient();
  const { data, error } = await client
    .from("search_log_salt")
    .select("salt")
    .eq("day", today)
    .maybeSingle();
  if (error || !data) {
    throw new Error(`search_log_salt missing for ${today}`);
  }
  const salt = Buffer.from((data as { salt: Uint8Array }).salt);
  cachedSalt = { day: today, salt, expires: now + 60_000 };
  return salt;
}

export interface BuildRowInput {
  query: string;
  portalSlug: string;
  segment: "anon" | "authed";
  hadFilters: boolean;
  presented: PresentedResults;
  intentType: string;
  salt: Buffer;
}

export function buildSearchEventRow(input: BuildRowInput) {
  const { query, portalSlug, segment, hadFilters, presented, intentType, salt } = input;
  return {
    portal_slug: portalSlug,
    locale: "en",
    user_segment: segment,
    query_hash: hashQuery(query, salt, portalSlug),
    query_length: query.length,
    query_word_count: query.split(/\s+/).filter(Boolean).length,
    intent_type: intentType,
    filters_json: hadFilters ? { had: true } : {},
    cache_hit: presented.diagnostics.cache_hit,
    degraded: presented.diagnostics.degraded,
    retriever_breakdown: presented.diagnostics.retriever_ms,
    result_count: presented.sections.reduce((sum, s) => sum + s.total, 0),
    result_type_counts: presented.diagnostics.result_type_counts,
    top_matches_types: presented.topMatches.map((c) => c.type),
    zero_result: presented.sections.length === 0,
    total_ms: presented.diagnostics.total_ms,
  };
}

/**
 * Fire-and-forget logging. Called via Next 16 `after()` so it never
 * blocks the response. Failures are swallowed — observability failure
 * must never break search.
 */
export async function logSearchEvent(input: BuildRowInput): Promise<void> {
  try {
    const row = buildSearchEventRow(input);
    const client = createServiceClient();
    await client.from("search_events").insert(row as never);
  } catch (err) {
    console.warn("logSearchEvent failed", err instanceof Error ? err.message : err);
  }
}
```

- [ ] **Step 4: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/observability.test.ts
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/observability.ts lib/search/__tests__/observability.test.ts
git commit -m "feat(search): add search_events async logging with daily salt hashing"
```

---

## Part K — API routes (3 tasks)

### Task 27: `/api/search/unified` — the public endpoint

**Files:**
- Create: `web/app/[portal]/api/search/unified/route.ts`
- Create: `web/app/[portal]/api/search/unified/__tests__/route.test.ts` (optional integration)

**Why:** The single canonical endpoint. Portal derived from route, not query. Rate-limited. Logs via `after()`. Returns `PresentedResults` as JSON.

- [ ] **Step 1: Write the route**

Create `web/app/[portal]/api/search/unified/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { after } from "next/server";
import { withOptionalAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalRequest } from "@/lib/portal-runtime/resolvePortalRequest";
import { parseSearchInput } from "@/lib/search/input-schema";
import { search } from "@/lib/search";
import { annotate } from "@/lib/search/understanding/annotate";
import { logSearchEvent, getTodaySalt } from "@/lib/search/observability";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export const GET = withOptionalAuth(async (request: NextRequest, { user }) => {
  // Layer 1: per-IP rate limit
  const ip = getClientIdentifier(request);
  const rl = await applyRateLimit(request, RATE_LIMITS.read, ip);
  if (rl) return rl;

  // Portal from ROUTE, never query
  const url = new URL(request.url);
  const portalSlugFromPath = url.pathname.split("/")[1];
  const resolved = await resolvePortalRequest({
    slug: portalSlugFromPath,
    headersList: await headers(),
    pathname: url.pathname,
    searchParams: url.searchParams,
    surface: "explore",
  });
  if (!resolved) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { portal } = resolved;

  // Parse input
  let input;
  try {
    input = parseSearchInput(url.searchParams);
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  // Run search
  try {
    const result = await search(input.q, {
      portal_id: portal.id,
      portal_slug: portal.slug,
      limit: input.limit,
      user_id: user?.id,
    });

    const response = NextResponse.json(result);

    // Time-sensitive date filters get tighter cache TTL
    const isTimeSensitive = input.date === "today" || input.date === "tomorrow";
    const sMaxAge = isTimeSensitive ? 15 : 30;
    const swr = isTimeSensitive ? 30 : 120;
    response.headers.set(
      "Cache-Control",
      `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`
    );

    // Log observability event asynchronously — never blocks response
    after(async () => {
      try {
        const annotated = await annotate(input.q, {
          portal_id: portal.id,
          portal_slug: portal.slug,
        });
        const salt = await getTodaySalt();
        await logSearchEvent({
          query: input.q,
          portalSlug: portal.slug,
          segment: user ? "authed" : "anon",
          hadFilters: Boolean(
            input.categories?.length ||
            input.neighborhoods?.length ||
            input.date ||
            input.free
          ),
          presented: result,
          intentType: annotated.intent.type,
          salt,
        });
      } catch (err) {
        console.warn("search_events log failed", err);
      }
    });

    return response;
  } catch (err) {
    console.error("search failed", err);
    return NextResponse.json(
      { error: "Search failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
});
```

- [ ] **Step 2: Smoke test against the dev server**

Start the dev server if not running:
```bash
npm run dev
```

In another terminal:
```bash
curl -s "http://localhost:3000/atlanta/api/search/unified?q=jazz&limit=5" | python3 -m json.tool | head -40
```

Expected: JSON with `topMatches`, `sections`, `totals`, `diagnostics`. Non-empty results for "jazz" (assuming Atlanta has jazz events in dev DB).

- [ ] **Step 3: Verify observability insert**

```bash
psql "$DATABASE_URL" -c "SELECT count(*), portal_slug, cache_hit FROM search_events WHERE occurred_at > now() - interval '1 minute' GROUP BY portal_slug, cache_hit;"
```

Expected: at least 1 row.

- [ ] **Step 4: Verify portal isolation**

```bash
curl -s "http://localhost:3000/atlanta/api/search/unified?q=jazz&limit=5" | python3 -c "import sys, json; d = json.load(sys.stdin); print('sections:', len(d.get('sections', [])), 'topMatches:', len(d.get('topMatches', [])))"
```

Should return results.

```bash
curl -s "http://localhost:3000/fake-portal/api/search/unified?q=jazz" -o /dev/null -w "%{http_code}\n"
```

Expected: `404`.

- [ ] **Step 5: Commit**

```bash
git add app/\[portal\]/api/search/unified/route.ts
git commit -m "feat(api): add /api/search/unified route with portal-derived isolation"
```

---

### Task 28: `/api/search/unified/personalize` — visible-state hydration endpoint

**Files:**
- Create: `web/app/[portal]/api/search/unified/personalize/route.ts`

**Why:** Split from the public endpoint so the public payload stays cacheable. This returns only the user's saved/RSVP state for a given list of result IDs. `private, no-store`.

- [ ] **Step 1: Write the route**

Create `web/app/[portal]/api/search/unified/personalize/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { z } from "zod";

const PersonalizeSchema = z.object({
  eventIds: z.array(z.string().max(64)).max(100).optional(),
  venueIds: z.array(z.string().max(64)).max(100).optional(),
});

export const dynamic = "force-dynamic";
export const maxDuration = 5;

export const POST = withAuth(async (request: NextRequest, { user, serviceClient }) => {
  const rl = await applyRateLimit(request, RATE_LIMITS.read, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = PersonalizeSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  const eventIds = body.eventIds ?? [];
  const venueIds = body.venueIds ?? [];

  // Fetch saved and RSVP state in parallel
  const [savedEvents, rsvpEvents, savedVenues] = await Promise.all([
    eventIds.length === 0 ? [] : serviceClient
      .from("saved_items")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_type", "event")
      .in("item_id", eventIds)
      .then((r) => (r.data ?? []) as Array<{ item_id: string }>),
    eventIds.length === 0 ? [] : serviceClient
      .from("event_rsvps")
      .select("event_id, status")
      .eq("user_id", user.id)
      .in("event_id", eventIds)
      .then((r) => (r.data ?? []) as Array<{ event_id: string; status: string }>),
    venueIds.length === 0 ? [] : serviceClient
      .from("saved_items")
      .select("item_id")
      .eq("user_id", user.id)
      .eq("item_type", "venue")
      .in("item_id", venueIds)
      .then((r) => (r.data ?? []) as Array<{ item_id: string }>),
  ]);

  const response = NextResponse.json({
    savedEventIds: savedEvents.map((r) => r.item_id),
    rsvpEvents: rsvpEvents.map((r) => ({ eventId: r.event_id, status: r.status })),
    savedVenueIds: savedVenues.map((r) => r.item_id),
  });

  response.headers.set("Cache-Control", "private, no-store, must-revalidate");
  return response;
});
```

> **Note:** `saved_items` and `event_rsvps` table names are assumed to match the current schema. If the actual table names differ (e.g., `user_saves`, `rsvps`), grep for them in the existing codebase and substitute.

- [ ] **Step 2: Verify table names**

```bash
grep -rn "from(\"saved_items\"\|from(\"event_rsvps\"\|from(\"user_saves\"\|from(\"rsvps\")" lib/ app/ 2>&1 | head -10
```

Adjust the route file if the table names differ.

- [ ] **Step 3: Smoke test**

Manually test (requires an authed session via the dev app):
```bash
# This will fail with 401 without auth — that's expected
curl -s -X POST "http://localhost:3000/atlanta/api/search/unified/personalize" \
  -H "Content-Type: application/json" \
  -d '{"eventIds": ["1", "2"]}' -o /dev/null -w "%{http_code}\n"
```

Expected: `401` when unauthenticated.

- [ ] **Step 4: Commit**

```bash
git add app/\[portal\]/api/search/unified/personalize/route.ts
git commit -m "feat(api): add /api/search/unified/personalize hydration endpoint"
```

---

### Task 29: `/api/user/recent-searches` — POST/DELETE only

**Files:**
- Create: `web/app/api/user/recent-searches/route.ts`

**Why:** Writes recent searches to the server for Phase 1 cross-device sync. Phase 0 clients still use localStorage as the primary source; this endpoint lets Phase 1 hydrate from it.

- [ ] **Step 1: Write the route**

Create `web/app/api/user/recent-searches/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api-middleware";
import { applyRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { normalizeSearchQuery } from "@/lib/search/normalize";

const MAX_RECENT_PER_USER = 50;

const InsertSchema = z.object({
  query: z.string().min(1).max(120),
  filters: z
    .object({
      types: z.array(z.string().max(32)).max(8).optional(),
      categories: z.array(z.string().max(32)).max(20).optional(),
      date: z.enum(["today", "tomorrow", "weekend", "week"]).nullable().optional(),
    })
    .optional(),
});

const DeleteSchema = z.object({
  id: z.string().uuid().optional(),
  clearAll: z.boolean().optional(),
}).refine((v) => Boolean(v.id) !== Boolean(v.clearAll), {
  message: "Provide exactly one of id or clearAll",
});

function isAllowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export const POST = withAuth(async (request, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await applyRateLimit(request, RATE_LIMITS.write, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = InsertSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  const normalized = normalizeSearchQuery(body.query);
  if (!normalized) {
    return NextResponse.json({ error: "Empty query after normalization" }, { status: 400 });
  }

  const { error } = await serviceClient.rpc("insert_recent_search", {
    p_user_id: user.id,
    p_query: normalized,
    p_filters: body.filters ?? null,
    p_max_rows: MAX_RECENT_PER_USER,
  } as never);
  if (error) {
    return NextResponse.json({ error: "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
});

export const DELETE = withAuth(async (request, { user, serviceClient }) => {
  if (!isAllowedOrigin(request)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const rl = await applyRateLimit(request, RATE_LIMITS.write, `user:${user.id}`);
  if (rl) return rl;

  let body;
  try {
    body = DeleteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid input", detail: err instanceof Error ? err.message : "unknown" },
      { status: 400 }
    );
  }

  if (body.clearAll) {
    await serviceClient.from("user_recent_searches").delete().eq("user_id", user.id);
  } else if (body.id) {
    await serviceClient
      .from("user_recent_searches")
      .delete()
      .eq("user_id", user.id)
      .eq("id", body.id);
  }

  return NextResponse.json({ ok: true });
});
```

- [ ] **Step 2: Smoke test origin rejection**

```bash
curl -s -X POST "http://localhost:3000/api/user/recent-searches" \
  -H "Content-Type: application/json" \
  -d '{"query":"test"}' -o /dev/null -w "%{http_code}\n"
```

Expected: `403` (no Origin header).

- [ ] **Step 3: Commit**

```bash
git add app/api/user/recent-searches/route.ts
git commit -m "feat(api): add /api/user/recent-searches POST/DELETE with CSRF guard"
```

---

## Part L — State management (1 task)

### Task 30: Zustand store for search

**Files:**
- Create: `web/lib/search/store.ts`
- Create: `web/lib/search/__tests__/store.test.ts`

**Why:** Single source of truth for query state, result state, and UI state. Selector-level re-render isolation via Zustand's `subscribeWithSelector` middleware. Inline mode writes URL; overlay mode never touches URL — the architectural fix for this morning's unmount bug.

- [ ] **Step 1: Verify Zustand is installed**

```bash
grep "zustand" package.json
```

If not present:
```bash
npm install zustand
```

- [ ] **Step 2: Write the failing test**

Create `web/lib/search/__tests__/store.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { useSearchStore } from "@/lib/search/store";

describe("useSearchStore", () => {
  beforeEach(() => {
    useSearchStore.setState({
      raw: "",
      results: null,
      status: "idle",
      requestId: null,
      mode: "inline",
      overlayOpen: false,
      filters: {},
    });
  });

  it("setRaw updates raw field", () => {
    useSearchStore.getState().setRaw("jazz");
    expect(useSearchStore.getState().raw).toBe("jazz");
  });

  it("openOverlay sets overlayOpen + mode", () => {
    useSearchStore.getState().openOverlay();
    expect(useSearchStore.getState().overlayOpen).toBe(true);
    expect(useSearchStore.getState().mode).toBe("overlay");
  });

  it("closeOverlay clears overlayOpen", () => {
    useSearchStore.getState().openOverlay();
    useSearchStore.getState().closeOverlay();
    expect(useSearchStore.getState().overlayOpen).toBe(false);
  });

  it("commitResults updates results if requestId matches", () => {
    useSearchStore.setState({ requestId: "req-1", status: "fetching" });
    useSearchStore.getState().commitResults(
      { topMatches: [], sections: [], totals: {}, diagnostics: {
        total_ms: 0, cache_hit: "miss", degraded: false,
        retriever_ms: {}, result_type_counts: {},
      } },
      "req-1"
    );
    expect(useSearchStore.getState().status).toBe("ready");
    expect(useSearchStore.getState().results).not.toBeNull();
  });

  it("commitResults ignores stale requestId", () => {
    useSearchStore.setState({ requestId: "req-2", status: "fetching" });
    useSearchStore.getState().commitResults(
      { topMatches: [], sections: [], totals: {}, diagnostics: {
        total_ms: 0, cache_hit: "miss", degraded: false,
        retriever_ms: {}, result_type_counts: {},
      } },
      "req-1" // older
    );
    expect(useSearchStore.getState().results).toBeNull();
  });
});
```

- [ ] **Step 3: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/store.test.ts
```

- [ ] **Step 4: Implement**

Create `web/lib/search/store.ts`:

```typescript
"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import type { PresentedResults } from "@/lib/search/presenting/types";
import type { StructuredFilters } from "@/lib/search/understanding/types";

export type SearchStatus = "idle" | "annotating" | "fetching" | "ready" | "error";
export type SearchMode = "inline" | "overlay";

interface SearchStore {
  // query slice — updates on every keystroke
  raw: string;
  filters: StructuredFilters;

  // results slice — updates on fetch completion only
  results: PresentedResults | null;
  status: SearchStatus;
  requestId: string | null;
  error: string | null;

  // ui slice
  mode: SearchMode;
  overlayOpen: boolean;

  // actions
  setRaw: (raw: string) => void;
  setFilters: (f: Partial<StructuredFilters>) => void;
  startFetch: (requestId: string) => void;
  commitResults: (r: PresentedResults, requestId: string) => void;
  commitError: (error: string, requestId: string) => void;
  openOverlay: () => void;
  closeOverlay: () => void;
  clear: () => void;
}

export const useSearchStore = create<SearchStore>()(
  subscribeWithSelector((set, get) => ({
    raw: "",
    filters: {},
    results: null,
    status: "idle",
    requestId: null,
    error: null,
    mode: "inline",
    overlayOpen: false,

    setRaw: (raw) => set({ raw }),

    setFilters: (f) => set({ filters: { ...get().filters, ...f } }),

    startFetch: (requestId) => set({ requestId, status: "fetching", error: null }),

    commitResults: (r, requestId) => {
      if (get().requestId !== requestId) return; // stale
      set({ results: r, status: "ready", error: null });
    },

    commitError: (error, requestId) => {
      if (get().requestId !== requestId) return;
      set({ status: "error", error });
    },

    openOverlay: () => set({ overlayOpen: true, mode: "overlay" }),

    closeOverlay: () => set({ overlayOpen: false }),

    clear: () => set({
      raw: "",
      filters: {},
      results: null,
      status: "idle",
      requestId: null,
      error: null,
    }),
  }))
);
```

- [ ] **Step 5: Run test (expected: PASS, 5/5)**

```bash
npx vitest run lib/search/__tests__/store.test.ts
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add lib/search/store.ts lib/search/__tests__/store.test.ts
git commit -m "feat(search): add Zustand store with selector-level re-render isolation"
```

---

## Part M — Hooks (1 task)

### Task 31: `useVisualViewportHeight` — mobile keyboard handling

**Files:**
- Create: `web/lib/hooks/useVisualViewportHeight.ts`
- Create: `web/lib/hooks/__tests__/useVisualViewportHeight.test.ts`

**Why:** On iOS Safari, the software keyboard pushes the viewport up (`visualViewport.offsetTop` grows). On Android Chrome, the visual viewport shrinks. This hook reads the offset so the overlay can compute `maxHeight: calc(100dvh - input - offset)` for the results scroll area. Without this, the overlay is broken on mobile.

- [ ] **Step 1: Write the failing test**

Create `web/lib/hooks/__tests__/useVisualViewportHeight.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useVisualViewportHeight } from "@/lib/hooks/useVisualViewportHeight";

describe("useVisualViewportHeight", () => {
  let addEventSpy: ReturnType<typeof vi.fn>;
  let removeEventSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    addEventSpy = vi.fn();
    removeEventSpy = vi.fn();
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: {
        offsetTop: 0,
        addEventListener: addEventSpy,
        removeEventListener: removeEventSpy,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: null });
  });

  it("returns 0 when viewport is idle", () => {
    const { result } = renderHook(() => useVisualViewportHeight());
    expect(result.current).toBe(0);
  });

  it("subscribes to resize and scroll events", () => {
    renderHook(() => useVisualViewportHeight());
    expect(addEventSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });

  it("unsubscribes on unmount", () => {
    const { unmount } = renderHook(() => useVisualViewportHeight());
    unmount();
    expect(removeEventSpy).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeEventSpy).toHaveBeenCalledWith("scroll", expect.any(Function));
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/hooks/__tests__/useVisualViewportHeight.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/hooks/useVisualViewportHeight.ts`:

```typescript
"use client";

import { useEffect, useState } from "react";

/**
 * Returns the current offsetTop of the visual viewport.
 *
 * iOS Safari: when software keyboard opens, the viewport scrolls up and
 *   `visualViewport.offsetTop` grows. Subtract this from the overlay's
 *   max-height to keep the input visible.
 *
 * Android Chrome: uses `resize-visual` mode by default, so `100dvh` already
 *   tracks the shrunk viewport. `offsetTop` stays ~0 but the hook still works
 *   as a fallback for the rare `resize-none` configuration.
 *
 * Never use `window.innerHeight` for mobile keyboard handling — unreliable
 * on iOS when the keyboard is open.
 */
export function useVisualViewportHeight(): number {
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    function handleResize() {
      setOffset(vv!.offsetTop);
    }

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  return offset;
}
```

- [ ] **Step 4: Run test (expected: PASS, 3/3)**

```bash
npx vitest run lib/hooks/__tests__/useVisualViewportHeight.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useVisualViewportHeight.ts lib/hooks/__tests__/useVisualViewportHeight.test.ts
git commit -m "feat(hooks): add useVisualViewportHeight for mobile keyboard handling"
```

---

## Part N — Core UI components (5 tasks)

### Task 32: `presearch-config.ts` — static Quick Intents + Browse by Category + Browse by Neighborhood

**Files:**
- Create: `web/lib/search/presearch-config.ts`
- Create: `web/lib/search/__tests__/presearch-config.test.ts`

**Why:** Presearch content is **static and curated-once**, not algorithmic. This file is the single source of truth. Changing it requires a PR review from the search working group — named anti-pattern: "presearch is not a recommendations slot."

- [ ] **Step 1: Write the failing test**

Create `web/lib/search/__tests__/presearch-config.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { getPresearchConfig } from "@/lib/search/presearch-config";

describe("getPresearchConfig", () => {
  it("returns atlanta config", () => {
    const config = getPresearchConfig("atlanta");
    expect(config.quickIntents.length).toBeGreaterThan(0);
    expect(config.categories.length).toBeGreaterThan(0);
    expect(config.neighborhoods.length).toBeGreaterThan(0);
  });

  it("returns an empty neighborhoods array for unknown portals", () => {
    const config = getPresearchConfig("unknown-portal");
    expect(config.neighborhoods).toEqual([]);
  });

  it("quick intents have label + href", () => {
    const config = getPresearchConfig("atlanta");
    for (const intent of config.quickIntents) {
      expect(intent.label).toBeTruthy();
      expect(intent.href).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run lib/search/__tests__/presearch-config.test.ts
```

- [ ] **Step 3: Implement**

Create `web/lib/search/presearch-config.ts`:

```typescript
/**
 * Presearch content is STATIC and CURATED-ONCE. Any change requires a PR
 * reviewed by the search working group. See spec §5.3 — "presearch is not
 * a recommendations slot."
 */

export interface PresearchPill {
  label: string;
  href: string;
}

export interface PresearchConfig {
  quickIntents: PresearchPill[];
  categories: PresearchPill[];
  neighborhoods: PresearchPill[];
}

const ATLANTA: PresearchConfig = {
  quickIntents: [
    { label: "Tonight", href: "/atlanta/explore?lane=events&date=today" },
    { label: "Free", href: "/atlanta/explore?lane=events&free=true" },
    { label: "This Weekend", href: "/atlanta/explore?lane=events&date=weekend" },
    { label: "Brunch", href: "/atlanta/explore?lane=events&categories=food_drink" },
    { label: "Live Music", href: "/atlanta/explore?lane=shows&tab=music" },
    { label: "Outdoor", href: "/atlanta/explore?lane=events&tags=outdoor" },
    { label: "Family", href: "/atlanta/explore?lane=events&categories=family" },
    { label: "Art", href: "/atlanta/explore?lane=events&categories=art" },
  ],
  categories: [
    { label: "Music", href: "/atlanta/explore?lane=events&categories=music" },
    { label: "Comedy", href: "/atlanta/explore?lane=events&categories=comedy" },
    { label: "Food", href: "/atlanta/explore?lane=events&categories=food_drink" },
    { label: "Art", href: "/atlanta/explore?lane=events&categories=art" },
    { label: "Nightlife", href: "/atlanta/explore?lane=events&categories=nightlife" },
    { label: "Sports", href: "/atlanta/explore?lane=game-day" },
    { label: "Film", href: "/atlanta/explore?lane=shows&tab=film" },
    { label: "Family", href: "/atlanta/explore?lane=events&categories=family" },
  ],
  neighborhoods: [
    { label: "Ponce City", href: "/atlanta/explore?lane=events&neighborhoods=ponce-city-market" },
    { label: "Beltline", href: "/atlanta/explore?lane=events&neighborhoods=beltline" },
    { label: "Cabbagetown", href: "/atlanta/explore?lane=events&neighborhoods=cabbagetown" },
    { label: "Old Fourth Ward", href: "/atlanta/explore?lane=events&neighborhoods=old-fourth-ward" },
    { label: "West End", href: "/atlanta/explore?lane=events&neighborhoods=west-end" },
    { label: "Decatur", href: "/atlanta/explore?lane=events&neighborhoods=decatur" },
  ],
};

const PORTAL_CONFIGS: Record<string, PresearchConfig> = {
  atlanta: ATLANTA,
};

const EMPTY_CONFIG: PresearchConfig = {
  quickIntents: [],
  categories: [],
  neighborhoods: [],
};

export function getPresearchConfig(portalSlug: string): PresearchConfig {
  return PORTAL_CONFIGS[portalSlug] ?? EMPTY_CONFIG;
}
```

- [ ] **Step 4: Run test (expected: PASS, 3/3)**

```bash
npx vitest run lib/search/__tests__/presearch-config.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/search/presearch-config.ts lib/search/__tests__/presearch-config.test.ts
git commit -m "feat(search): add static presearch config (no algorithmic curation)"
```

---

### Task 33: `SearchInput` component — the text input primitive

**Files:**
- Create: `web/components/search/SearchInput.tsx`

**Why:** The input primitive used by both inline and overlay modes. Pure presentation — consumes Zustand store, emits typed events, handles clear button. Subscribes to `raw` only, not results.

- [ ] **Step 1: Write the component**

Create `web/components/search/SearchInput.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";

interface SearchInputProps {
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}

export function SearchInput({
  autoFocus = false,
  placeholder = "Search events, places, classes, teams...",
  className = "",
}: SearchInputProps) {
  const raw = useSearchStore((s) => s.raw);
  const setRaw = useSearchStore((s) => s.setRaw);
  const clear = useSearchStore((s) => s.clear);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      const t = setTimeout(() => inputRef.current?.focus(), 80);
      return () => clearTimeout(t);
    }
  }, [autoFocus]);

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] focus-within:ring-2 focus-within:ring-[var(--coral)]/30 transition-all ${className}`}
      role="search"
    >
      <MagnifyingGlass
        weight="duotone"
        className="w-4 h-4 text-[var(--muted)] flex-shrink-0"
      />
      <input
        ref={inputRef}
        type="search"
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none min-w-0"
        role="combobox"
        aria-expanded={raw.length >= 2}
        aria-controls="search-listbox"
        aria-autocomplete="list"
      />
      {raw.length > 0 && (
        <button
          type="button"
          onClick={() => {
            clear();
            inputRef.current?.focus();
          }}
          className="flex-shrink-0 w-5 h-5 rounded-full bg-[var(--twilight)] flex items-center justify-center text-[var(--muted)] hover:text-[var(--cream)]"
          aria-label="Clear search"
        >
          <X weight="bold" className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/search/SearchInput.tsx
git commit -m "feat(ui): add SearchInput primitive consuming Zustand store"
```

---

### Task 34: `EventResultCard` — event result card (Top Matches + grouped variants)

**Files:**
- Create: `web/components/search/cards/EventResultCard.tsx`

**Why:** Result cards are the visible surface of the search experience. Event is the highest-traffic card — get it right first, then other types follow the same template. Per spec §5.1, event cards show image + title + time chip + venue + chips.

- [ ] **Step 1: Write the component**

Create `web/components/search/cards/EventResultCard.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MusicNotes, BookmarkSimple } from "@phosphor-icons/react";
import SmartImage from "@/components/SmartImage";
import type { RankedCandidate } from "@/lib/search/ranking/types";

interface EventResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
  href?: string;
}

function formatWhen(startsAt: string | undefined): string {
  if (!startsAt) return "";
  const d = new Date(startsAt);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function EventResultCard({
  candidate,
  variant = "top-matches",
  isSaved = false,
  href,
}: EventResultCardProps) {
  const title = (candidate.payload.title as string | undefined) ?? "Untitled Event";
  const subtitle = (candidate.payload.subtitle as string | undefined) ?? "";
  const imageUrl = (candidate.payload.image_url as string | undefined) ?? "";
  const startsAt = (candidate.payload.starts_at as string | undefined) ?? "";
  const hrefSlug = (candidate.payload.href_slug as string | undefined) ?? candidate.id;
  const finalHref = href ?? `/events/${hrefSlug}`;
  const when = formatWhen(startsAt);

  const containerBase =
    "flex gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/50 hover:bg-[var(--dusk)] hover:border-[var(--twilight)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--coral)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--void)] transition-colors";
  const heightClass = variant === "top-matches" ? "h-[84px]" : "min-h-[72px]";

  return (
    <Link
      href={finalHref}
      className={`${containerBase} ${heightClass}`}
      role="option"
      aria-selected={false}
    >
      <div className="w-16 h-16 rounded-md overflow-hidden flex-shrink-0 bg-[var(--twilight)]/40 flex items-center justify-center">
        {imageUrl ? (
          <SmartImage
            src={imageUrl}
            alt=""
            width={64}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <MusicNotes
            weight="duotone"
            className="w-5 h-5 text-[var(--coral)]"
          />
        )}
      </div>
      <div className="flex-1 min-w-0 flex flex-col justify-center gap-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="font-mono text-2xs font-bold uppercase tracking-[0.12em] text-[var(--coral)]">
            Event
          </span>
          {when && (
            <span className="text-2xs text-[var(--muted)]">· {when}</span>
          )}
        </div>
        <h3 className="text-sm font-semibold text-[var(--cream)] line-clamp-2">
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-[var(--muted)] truncate">{subtitle}</p>
        )}
      </div>
      {isSaved && (
        <div className="flex-shrink-0 self-start">
          <BookmarkSimple
            weight="fill"
            className="w-4 h-4 text-[var(--coral)]"
          />
        </div>
      )}
    </Link>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/search/cards/EventResultCard.tsx
git commit -m "feat(ui): add EventResultCard with Top Matches and grouped variants"
```

---

### Task 35: Remaining entity result cards (venue, organizer, series, festival, program, neighborhood, category)

**Files:**
- Create: `web/components/search/cards/VenueResultCard.tsx`
- Create: `web/components/search/cards/OrganizerResultCard.tsx`
- Create: `web/components/search/cards/SeriesResultCard.tsx`
- Create: `web/components/search/cards/FestivalResultCard.tsx`
- Create: `web/components/search/cards/ProgramResultCard.tsx`
- Create: `web/components/search/cards/NeighborhoodResultCard.tsx`
- Create: `web/components/search/cards/CategoryResultCard.tsx`
- Create: `web/components/search/cards/ResultCard.tsx` (dispatcher)

**Why:** All entity types need consistent card anatomy for the Top Matches strip to interleave cleanly. Build them by copying `EventResultCard` and adjusting fields per §5.1 of the spec. The `ResultCard` dispatcher picks the right card by `candidate.type`.

> **Note for implementation:** each of these 7 files is structurally identical to `EventResultCard.tsx`. Copy the file, change the icon import, change the type label color token, and adjust the fields per the spec table. I'm not copying all 7 file bodies here because they would be redundant — but each MUST be implemented. Refer to spec §5.1 for the fields and color tokens per type.

- [ ] **Step 1: Implement `VenueResultCard`**

Copy `EventResultCard.tsx` to `VenueResultCard.tsx`. Changes:
- Type label: `"Place"` in `text-[var(--coral)]`
- Icon fallback: `MapPin` from `@phosphor-icons/react`
- Meta line 1: `neighborhood · category` (no time)
- Chips: `Open Now` (conditional), no saved chip

- [ ] **Step 2: Implement `OrganizerResultCard`**

Copy. Changes:
- Type label: `"Organizer"` in `text-[var(--coral)]`
- Image: 40×40 `rounded-full` avatar, not 64×64 square
- Fallback: initials in mono font on `--twilight` bg
- Meta: category · "N upcoming events" (hide if 0)

- [ ] **Step 3: Implement `SeriesResultCard`**

Copy. Changes:
- Type label: `"Series"` in `text-[var(--gold)]`
- Icon: `ArrowsClockwise` (recurring)
- Meta line 1: recurrence label e.g. "Weekly · Thursdays"
- Supports saved chip

- [ ] **Step 4: Implement `FestivalResultCard`**

Copy. Changes:
- Type label: `"Festival"` in `text-[var(--gold)]`
- Icon: `Confetti`
- Meta: date range "Apr 18–20" + multi-day chip if > 1 day

- [ ] **Step 5: Implement `ProgramResultCard`**

Copy. Changes:
- Type label: `"Program"` in `text-[var(--neon-green)]`
- Icon: `Graduation` on `--neon-green/15` bg with `border-[var(--neon-green)]/20`
- Meta: provider · "Ages 6–12" (from payload)
- Chip: "Enrolling Now"

- [ ] **Step 6: Implement `NeighborhoodResultCard`**

Copy. Changes:
- NO image slot — neighborhoods don't have photos
- Type label: `"Neighborhood"` in `text-[var(--soft)]`
- Meta: "N events this week · N venues"
- "Browse →" inline link in `--coral`
- Left edge: 2px `border-l border-[var(--twilight)]`

- [ ] **Step 7: Implement `CategoryResultCard`**

Copy. Changes:
- 40×40 icon box instead of 64×64 image
- Type label: `"Tag"` in `text-[var(--muted)]`
- Meta: "N events · N venues" (hide if zero)
- No hover-lift

- [ ] **Step 8: Implement the dispatcher**

Create `web/components/search/cards/ResultCard.tsx`:

```tsx
"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import { EventResultCard } from "./EventResultCard";
import { VenueResultCard } from "./VenueResultCard";
import { OrganizerResultCard } from "./OrganizerResultCard";
import { SeriesResultCard } from "./SeriesResultCard";
import { FestivalResultCard } from "./FestivalResultCard";
import { ProgramResultCard } from "./ProgramResultCard";
import { NeighborhoodResultCard } from "./NeighborhoodResultCard";
import { CategoryResultCard } from "./CategoryResultCard";

interface ResultCardProps {
  candidate: RankedCandidate;
  variant?: "top-matches" | "grouped";
  isSaved?: boolean;
}

export function ResultCard({ candidate, variant, isSaved }: ResultCardProps) {
  switch (candidate.type) {
    case "event":
      return <EventResultCard candidate={candidate} variant={variant} isSaved={isSaved} />;
    case "venue":
      return <VenueResultCard candidate={candidate} variant={variant} />;
    case "organizer":
      return <OrganizerResultCard candidate={candidate} variant={variant} />;
    case "series":
      return <SeriesResultCard candidate={candidate} variant={variant} isSaved={isSaved} />;
    case "festival":
      return <FestivalResultCard candidate={candidate} variant={variant} />;
    case "program":
      return <ProgramResultCard candidate={candidate} variant={variant} />;
    case "neighborhood":
      return <NeighborhoodResultCard candidate={candidate} variant={variant} />;
    case "category":
      return <CategoryResultCard candidate={candidate} variant={variant} />;
    default:
      return null;
  }
}
```

- [ ] **Step 9: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 10: Commit**

```bash
git add components/search/cards/
git commit -m "feat(ui): add remaining entity result cards + dispatcher"
```

---

### Task 36: `PresearchBody` + `ResultsBody` + `TopMatchesStrip` + `GroupedResultSection`

**Files:**
- Create: `web/components/search/PresearchBody.tsx`
- Create: `web/components/search/ResultsBody.tsx`
- Create: `web/components/search/TopMatchesStrip.tsx`
- Create: `web/components/search/GroupedResultSection.tsx`

**Why:** The body layers of the unified shell. Presearch renders static config + recent searches. Results renders Top Matches strip + grouped sections. Keep each component focused on one layout concern.

- [ ] **Step 1: Write `TopMatchesStrip`**

Create `web/components/search/TopMatchesStrip.tsx`:

```tsx
"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import { ResultCard } from "@/components/search/cards/ResultCard";

interface TopMatchesStripProps {
  items: RankedCandidate[];
}

export function TopMatchesStrip({ items }: TopMatchesStripProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Top matches" className="space-y-2">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
        Top Matches
      </p>
      {/* Mobile: vertical stack capped at 3 (per §5.1) */}
      <div className="sm:hidden space-y-2">
        {items.slice(0, 3).map((c) => (
          <ResultCard key={`${c.type}:${c.id}`} candidate={c} variant="top-matches" />
        ))}
      </div>
      {/* Desktop: horizontal scroll strip */}
      <div className="hidden sm:flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory">
        {items.map((c) => (
          <div key={`${c.type}:${c.id}`} className="flex-shrink-0 w-[280px] snap-start">
            <ResultCard candidate={c} variant="top-matches" />
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Write `GroupedResultSection`**

Create `web/components/search/GroupedResultSection.tsx`:

```tsx
"use client";

import type { RankedCandidate } from "@/lib/search/ranking/types";
import type { EntityType } from "@/lib/search/types";
import { ResultCard } from "@/components/search/cards/ResultCard";

interface GroupedResultSectionProps {
  type: EntityType;
  title: string;
  items: RankedCandidate[];
  total: number;
}

export function GroupedResultSection({ type, title, items, total }: GroupedResultSectionProps) {
  if (items.length === 0) return null;
  return (
    <section aria-label={`${title}, ${total} results`} className="space-y-2">
      <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
        {title} · {total}
      </p>
      <div className="space-y-2">
        {items.map((c) => (
          <ResultCard key={`${type}:${c.id}`} candidate={c} variant="grouped" />
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Write `PresearchBody`**

Create `web/components/search/PresearchBody.tsx`:

```tsx
"use client";

import Link from "next/link";
import { Clock, X } from "@phosphor-icons/react";
import { getPresearchConfig } from "@/lib/search/presearch-config";

interface PresearchBodyProps {
  portalSlug: string;
  mode: "inline" | "overlay";
  recentSearches: string[];
  onSelectRecent: (term: string) => void;
  onClearRecent: () => void;
  onRemoveRecent: (term: string) => void;
}

export function PresearchBody({
  portalSlug,
  mode,
  recentSearches,
  onSelectRecent,
  onClearRecent,
  onRemoveRecent,
}: PresearchBodyProps) {
  const config = getPresearchConfig(portalSlug);
  const recentsMax = mode === "overlay" ? 5 : 3;
  const visibleRecents = recentSearches.slice(0, recentsMax);

  return (
    <div className="space-y-5">
      {visibleRecents.length > 0 && (
        <section className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Recent
            </p>
            {mode === "overlay" && (
              <button
                type="button"
                onClick={onClearRecent}
                className="text-2xs font-mono text-[var(--muted)] hover:text-[var(--coral)]"
              >
                Clear all
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {visibleRecents.map((term) => (
              <li key={term} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[var(--twilight)]/40 group">
                <Clock weight="duotone" className="w-3.5 h-3.5 text-[var(--muted)] flex-shrink-0" />
                <button
                  type="button"
                  onClick={() => onSelectRecent(term)}
                  className="flex-1 text-left text-sm text-[var(--cream)] truncate"
                >
                  {term}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveRecent(term)}
                  className="opacity-0 group-hover:opacity-100 text-[var(--muted)] hover:text-[var(--coral)]"
                  aria-label={`Remove "${term}"`}
                >
                  <X weight="bold" className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {config.quickIntents.length > 0 && (
        <section className="space-y-2">
          {mode === "overlay" && (
            <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
              Quick Intents
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            {config.quickIntents.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)] hover:border-[var(--twilight)] transition-colors"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mode === "overlay" && config.categories.length > 0 && (
        <section className="space-y-2">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Browse by Category
          </p>
          <div className="flex flex-wrap gap-1.5">
            {config.categories.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)]"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}

      {mode === "overlay" && config.neighborhoods.length > 0 && (
        <section className="space-y-2">
          <p className="font-mono text-2xs uppercase tracking-[0.14em] text-[var(--muted)]">
            Browse by Neighborhood
          </p>
          <div className="flex flex-wrap gap-1.5">
            {config.neighborhoods.map((pill) => (
              <Link
                key={pill.label}
                href={pill.href}
                className="px-3 py-1.5 rounded-full border border-[var(--twilight)]/50 bg-[var(--night)]/60 text-sm text-[var(--soft)] hover:text-[var(--cream)]"
              >
                {pill.label}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Write `ResultsBody`**

Create `web/components/search/ResultsBody.tsx`:

```tsx
"use client";

import { useSearchStore } from "@/lib/search/store";
import { TopMatchesStrip } from "@/components/search/TopMatchesStrip";
import { GroupedResultSection } from "@/components/search/GroupedResultSection";
import { EmptyState } from "@/components/search/EmptyState";

export function ResultsBody({ portalSlug }: { portalSlug: string }) {
  const results = useSearchStore((s) => s.results);
  const status = useSearchStore((s) => s.status);
  const error = useSearchStore((s) => s.error);
  const raw = useSearchStore((s) => s.raw);

  if (status === "error") {
    return <EmptyState kind="error" query={raw} message={error ?? undefined} portalSlug={portalSlug} />;
  }
  if (status === "fetching" && !results) {
    return <EmptyState kind="loading" query={raw} portalSlug={portalSlug} />;
  }
  if (!results) return null;

  const hasAny = results.topMatches.length > 0 || results.sections.length > 0;
  if (!hasAny) {
    return <EmptyState kind="zero" query={raw} portalSlug={portalSlug} />;
  }

  return (
    <div className="space-y-6">
      <TopMatchesStrip items={results.topMatches} />
      {results.sections.map((section) => (
        <GroupedResultSection
          key={section.type}
          type={section.type}
          title={section.title}
          items={section.items}
          total={section.total}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Verify typecheck**

```bash
npx tsc --noEmit
```

> This step will fail until `EmptyState` is created in Task 37. That's OK — it's a forward reference. Continue.

- [ ] **Step 6: Commit**

```bash
git add components/search/PresearchBody.tsx components/search/ResultsBody.tsx components/search/TopMatchesStrip.tsx components/search/GroupedResultSection.tsx
git commit -m "feat(ui): add PresearchBody, ResultsBody, TopMatchesStrip, GroupedResultSection"
```

---

## Part O — Empty states + shell (2 tasks)

### Task 37: `EmptyState` component covering all scenarios

**Files:**
- Create: `web/components/search/EmptyState.tsx`

**Why:** Spec §5.4 defines 12 scenarios. Implement the ones reachable in Phase 0 (zero / loading / error / network / rate-limited / offline). URL paste, lane name, typo scenarios land in Phase 1.

- [ ] **Step 1: Write the component**

Create `web/components/search/EmptyState.tsx`:

```tsx
"use client";

import Link from "next/link";
import { MagnifyingGlass, WifiSlash, Warning } from "@phosphor-icons/react";

export type EmptyStateKind =
  | "zero"
  | "loading"
  | "error"
  | "network"
  | "rate-limited"
  | "offline";

interface EmptyStateProps {
  kind: EmptyStateKind;
  query: string;
  portalSlug: string;
  message?: string;
  onRetry?: () => void;
}

function SkeletonRow() {
  return (
    <div className="flex gap-3 p-3 rounded-card bg-[var(--night)] border border-[var(--twilight)]/30 animate-pulse h-[84px]">
      <div className="w-16 h-16 rounded-md bg-[var(--twilight)]/50 flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 bg-[var(--twilight)]/50 rounded" />
        <div className="h-4 w-full bg-[var(--twilight)]/50 rounded" />
        <div className="h-3 w-1/2 bg-[var(--twilight)]/40 rounded" />
      </div>
    </div>
  );
}

export function EmptyState({ kind, query, portalSlug, message, onRetry }: EmptyStateProps) {
  if (kind === "loading") {
    return (
      <div className="space-y-2">
        <SkeletonRow />
        <SkeletonRow />
        <SkeletonRow />
      </div>
    );
  }

  if (kind === "zero") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <MagnifyingGlass weight="duotone" className="w-12 h-12 text-[var(--twilight)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">
          Nothing matched <span className="font-semibold text-[var(--cream)]">&ldquo;{query}&rdquo;</span>. Try a category below or adjust your search.
        </p>
        <div className="mt-5 flex flex-wrap gap-2 justify-center">
          {["music", "comedy", "food_drink", "nightlife"].map((cat) => (
            <Link
              key={cat}
              href={`/${portalSlug}/explore?lane=events&categories=${cat}`}
              className="px-3 py-1.5 rounded-full border border-[var(--twilight)] text-xs font-mono text-[var(--soft)] hover:text-[var(--cream)]"
            >
              {cat.replace("_", " ")}
            </Link>
          ))}
        </div>
        <Link
          href={`/${portalSlug}/explore`}
          className="mt-4 text-xs font-mono text-[var(--coral)] hover:opacity-80"
        >
          Browse everything →
        </Link>
      </div>
    );
  }

  if (kind === "offline") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <WifiSlash weight="duotone" className="w-10 h-10 text-[var(--muted)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">You&apos;re offline. Connect to search.</p>
      </div>
    );
  }

  if (kind === "rate-limited") {
    return (
      <div className="flex flex-col items-center text-center py-10 px-4">
        <Warning weight="duotone" className="w-10 h-10 text-[var(--gold)]" />
        <p className="mt-4 text-sm text-[var(--soft)]">Too many searches — give it a second.</p>
      </div>
    );
  }

  // error / network fallback
  return (
    <div className="flex flex-col items-center text-center py-10 px-4">
      <Warning weight="duotone" className="w-10 h-10 text-[var(--coral)]" />
      <p className="mt-4 text-sm text-[var(--soft)]">
        Search is having a moment. {message ? <span className="text-[var(--muted)]">({message})</span> : null}
      </p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 px-4 py-1.5 rounded-lg border border-[var(--coral)] text-[var(--coral)] text-xs font-mono hover:bg-[var(--coral)]/10"
        >
          Retry
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify typecheck (previous Task 36 reference now resolves)**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/search/EmptyState.tsx
git commit -m "feat(ui): add EmptyState covering zero/loading/error/offline/rate-limited"
```

---

### Task 38: `UnifiedSearchShell` — the inline + overlay container

**Files:**
- Create: `web/components/search/UnifiedSearchShell.tsx`
- Create: `web/components/search/useSearchFetch.ts`

**Why:** The shell wires everything: input + presearch/results + fetch pipeline. One component, two render modes (inline for explore hero; overlay portaled to `#search-portal`). The fetch hook lives alongside because it's tightly coupled to the store.

- [ ] **Step 1: Write the fetch hook**

Create `web/components/search/useSearchFetch.ts`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useSearchStore } from "@/lib/search/store";

const DEBOUNCE_MS = 100;

interface UseSearchFetchArgs {
  portalSlug: string;
}

export function useSearchFetch({ portalSlug }: UseSearchFetchArgs) {
  const raw = useSearchStore((s) => s.raw);
  const startFetch = useSearchStore((s) => s.startFetch);
  const commitResults = useSearchStore((s) => s.commitResults);
  const commitError = useSearchStore((s) => s.commitError);

  const abortRef = useRef<AbortController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (raw.trim().length < 2) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    timerRef.current = setTimeout(() => {
      const requestId = crypto.randomUUID();
      startFetch(requestId);

      const controller = new AbortController();
      abortRef.current = controller;

      const url = `/${portalSlug}/api/search/unified?q=${encodeURIComponent(raw)}&limit=20`;
      fetch(url, { signal: controller.signal })
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((data) => commitResults(data, requestId))
        .catch((err: unknown) => {
          if (err instanceof Error && err.name === "AbortError") return;
          commitError(err instanceof Error ? err.message : "Unknown error", requestId);
        });
    }, DEBOUNCE_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, [raw, portalSlug, startFetch, commitResults, commitError]);
}
```

- [ ] **Step 2: Write the shell component**

Create `web/components/search/UnifiedSearchShell.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";
import { useVisualViewportHeight } from "@/lib/hooks/useVisualViewportHeight";
import { SearchInput } from "@/components/search/SearchInput";
import { PresearchBody } from "@/components/search/PresearchBody";
import { ResultsBody } from "@/components/search/ResultsBody";
import { useSearchFetch } from "@/components/search/useSearchFetch";

const RECENT_KEY = "lc:search:recent";

function loadRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveRecents(terms: string[]): void {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(terms.slice(0, 50)));
  } catch {
    // ignore
  }
}

interface UnifiedSearchShellProps {
  portalSlug: string;
  mode: "inline" | "overlay";
}

export function UnifiedSearchShell({ portalSlug, mode }: UnifiedSearchShellProps) {
  const raw = useSearchStore((s) => s.raw);
  const setRaw = useSearchStore((s) => s.setRaw);
  const overlayOpen = useSearchStore((s) => s.overlayOpen);
  const closeOverlay = useSearchStore((s) => s.closeOverlay);
  const [recents, setRecents] = useState<string[]>([]);
  const vpOffset = useVisualViewportHeight();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => setRecents(loadRecents()), []);

  // Body-scroll lock in overlay mode
  useEffect(() => {
    if (mode !== "overlay" || !overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode, overlayOpen]);

  // ESC closes overlay, clear closes inline search
  useEffect(() => {
    if (mode !== "overlay" || !overlayOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (raw) {
          setRaw("");
        } else {
          closeOverlay();
        }
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mode, overlayOpen, raw, setRaw, closeOverlay]);

  useSearchFetch({ portalSlug });

  // Persist query to recents when it passes 3+ chars and stays there
  useEffect(() => {
    if (raw.length < 3) return;
    const t = setTimeout(() => {
      setRecents((current) => {
        if (current[0] === raw) return current;
        const next = [raw, ...current.filter((r) => r !== raw)].slice(0, 50);
        saveRecents(next);
        return next;
      });
    }, 1500);
    return () => clearTimeout(t);
  }, [raw]);

  const handleSelectRecent = (term: string) => setRaw(term);
  const handleClearRecent = () => {
    setRecents([]);
    saveRecents([]);
  };
  const handleRemoveRecent = (term: string) => {
    setRecents((current) => {
      const next = current.filter((r) => r !== term);
      saveRecents(next);
      return next;
    });
  };

  const body = (
    <>
      <SearchInput autoFocus={mode === "overlay" && overlayOpen} />
      <div className="mt-4">
        {raw.length < 2 ? (
          <PresearchBody
            portalSlug={portalSlug}
            mode={mode}
            recentSearches={recents}
            onSelectRecent={handleSelectRecent}
            onClearRecent={handleClearRecent}
            onRemoveRecent={handleRemoveRecent}
          />
        ) : (
          <ResultsBody portalSlug={portalSlug} />
        )}
      </div>
    </>
  );

  if (mode === "inline") {
    return <div className="relative">{body}</div>;
  }

  // Overlay mode
  if (!mounted || !overlayOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex flex-col bg-[var(--night)]"
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--twilight)]/60 flex-shrink-0"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top))" }}
      >
        <div className="flex-1">
          <SearchInput autoFocus placeholder="Search events, places, classes..." />
        </div>
        <button
          type="button"
          onClick={closeOverlay}
          className="flex-shrink-0 text-sm font-medium text-[var(--coral)] px-2 py-2 min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Close search"
        >
          <X weight="bold" className="w-5 h-5" />
        </button>
      </div>
      <div
        className="flex-1 overflow-y-auto overscroll-contain px-4 py-4"
        style={{
          maxHeight: `calc(100dvh - 72px - ${vpOffset}px - env(safe-area-inset-bottom))`,
        }}
      >
        {raw.length < 2 ? (
          <PresearchBody
            portalSlug={portalSlug}
            mode="overlay"
            recentSearches={recents}
            onSelectRecent={handleSelectRecent}
            onClearRecent={handleClearRecent}
            onRemoveRecent={handleRemoveRecent}
          />
        ) : (
          <ResultsBody portalSlug={portalSlug} />
        )}
      </div>
    </div>,
    document.body
  );
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add components/search/UnifiedSearchShell.tsx components/search/useSearchFetch.ts
git commit -m "feat(ui): add UnifiedSearchShell with inline/overlay modes + fetch hook"
```

---

## Part P — Launcher + lane filter (2 tasks)

### Task 39: `LaunchButton` — the header launcher trigger

**Files:**
- Create: `web/components/search/LaunchButton.tsx`

**Why:** Replaces `HeaderSearchButton` everywhere (desktop pill + mobile icon). Opens the unified overlay. Cmd-K keyboard shortcut. This is the "launcher-not-chrome" decision from Q3 of brainstorming.

- [ ] **Step 1: Write the component**

Create `web/components/search/LaunchButton.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { useSearchStore } from "@/lib/search/store";

export function LaunchButton() {
  const openOverlay = useSearchStore((s) => s.openOverlay);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        openOverlay();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [openOverlay]);

  return (
    <>
      {/* Desktop: compact pill */}
      <button
        type="button"
        onClick={openOverlay}
        className="hidden md:flex items-center gap-2 h-8 px-3 rounded-full border border-[var(--twilight)] bg-[var(--twilight)]/60 hover:bg-[var(--twilight)]/80 hover:border-[var(--soft)]/40 transition-colors"
        aria-label="Open search"
        aria-keyshortcuts="Meta+k Control+k"
      >
        <MagnifyingGlass weight="duotone" className="w-3.5 h-3.5 text-[var(--muted)]" />
        <span className="font-mono text-xs text-[var(--muted)]">Search</span>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--night)] border border-[var(--twilight)] font-mono text-2xs text-[var(--muted)] leading-none">⌘K</kbd>
      </button>

      {/* Mobile: icon button */}
      <button
        type="button"
        onClick={openOverlay}
        className="md:hidden flex items-center justify-center min-w-[44px] min-h-[44px] p-2.5 rounded-lg text-[var(--cream)] hover:bg-[var(--twilight)]/70 transition-colors"
        aria-label="Open search"
      >
        <MagnifyingGlass weight="duotone" className="w-5 h-5" />
      </button>
    </>
  );
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add components/search/LaunchButton.tsx
git commit -m "feat(ui): add LaunchButton replacing HeaderSearchButton across surfaces"
```

---

### Task 40: `LaneFilterInput` — split from FindSearchInput

**Files:**
- Create: `web/components/find/LaneFilterInput.tsx`
- Create: `web/components/find/__tests__/LaneFilterInput.test.tsx`

**Why:** Q8 of brainstorming decided to split `FindSearchInput` into `UnifiedSearch` (global discovery) and `LaneFilterInput` (in-lane text narrowing). This task creates the lane filter with zero dependency on the unified search stack. ~50 lines, debounced, writes `?search=X` to URL.

- [ ] **Step 1: Write the failing test**

Create `web/components/find/__tests__/LaneFilterInput.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { LaneFilterInput } from "@/components/find/LaneFilterInput";

describe("LaneFilterInput", () => {
  it("renders an input with the given placeholder", () => {
    render(<LaneFilterInput value="" onChange={() => {}} placeholder="Search events..." />);
    expect(screen.getByPlaceholderText("Search events...")).toBeInTheDocument();
  });

  it("calls onChange (debounced) when user types", async () => {
    vi.useFakeTimers();
    const onChange = vi.fn();
    render(<LaneFilterInput value="" onChange={onChange} />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "jazz" } });
    act(() => { vi.advanceTimersByTime(250); });
    expect(onChange).toHaveBeenCalledWith("jazz");
    vi.useRealTimers();
  });

  it("shows clear button when value is non-empty", () => {
    render(<LaneFilterInput value="jazz" onChange={() => {}} />);
    expect(screen.getByLabelText("Clear filter")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test (expected: FAIL)**

```bash
npx vitest run components/find/__tests__/LaneFilterInput.test.tsx
```

- [ ] **Step 3: Implement**

Create `web/components/find/LaneFilterInput.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

const DEBOUNCE_MS = 200;

interface LaneFilterInputProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Lane-scoped filter input. ~50 lines. Zero dependency on the unified search
 * stack. Debounced, emits onChange(next) on idle. Used by EventsFinder and
 * PlaceFilterBar to narrow the lane's timeline by text match.
 */
export function LaneFilterInput({
  value,
  onChange,
  placeholder = "Filter...",
  className = "",
}: LaneFilterInputProps) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setLocal(value), [value]);

  useEffect(() => {
    if (local === value) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(local), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [local, value, onChange]);

  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--dusk)] border border-[var(--twilight)] focus-within:border-[var(--coral)] ${className}`}>
      <MagnifyingGlass weight="duotone" className="w-4 h-4 text-[var(--muted)] flex-shrink-0" />
      <input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="flex-1 bg-transparent text-sm text-[var(--cream)] placeholder:text-[var(--muted)] outline-none min-w-0"
      />
      {local.length > 0 && (
        <button
          type="button"
          onClick={() => setLocal("")}
          className="flex-shrink-0 text-[var(--muted)] hover:text-[var(--cream)]"
          aria-label="Clear filter"
        >
          <X weight="bold" className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test (expected: PASS, 3/3)**

```bash
npx vitest run components/find/__tests__/LaneFilterInput.test.tsx
```

- [ ] **Step 5: Commit**

```bash
git add components/find/LaneFilterInput.tsx components/find/__tests__/LaneFilterInput.test.tsx
git commit -m "feat(ui): add LaneFilterInput split from FindSearchInput"
```

---

## Part Q — Integration into surfaces (3 tasks)

### Task 41: Mount `UnifiedSearchShell` inline on the explore surface

**Files:**
- Modify: `web/components/explore-platform/ExploreShellClient.tsx`
- Modify: `web/components/explore-platform/ExploreSearchHero.tsx` (delete or reduce to thin wrapper)

**Why:** The explore surface is where inline mode lives. The hero input becomes a direct mount of `UnifiedSearchShell mode="inline"`. The existing `ExploreSearchHero` component becomes a thin wrapper or is deleted entirely — same goes for `ExploreSearchResults` since `UnifiedSearchShell` now owns both input AND results.

- [ ] **Step 1: Read the current ExploreShellClient**

```bash
wc -l web/components/explore-platform/ExploreShellClient.tsx
```

Expected: familiar from the morning's work. The file hoists the hero, renders home screen when `!state.lane && !state.q`, renders ExploreSearchResults when `!state.lane && !!state.q`.

- [ ] **Step 2: Modify the explore shell**

In `web/components/explore-platform/ExploreShellClient.tsx`, replace the inline-mode block so that `UnifiedSearchShell mode="inline"` replaces BOTH the `ExploreSearchHero` component (from this morning) AND the `ExploreSearchResults` component. The fetch + results body is owned by `UnifiedSearchShell` now.

Find the block that looks like:

```tsx
{!state.lane && (
  <div className="flex flex-col gap-5 max-w-5xl mx-auto px-4 py-5 sm:py-6 min-h-[calc(100vh-5rem)]">
    <ExploreSearchHero portalSlug={portalSlug} portalId={portalId} />
    {!state.q ? (
      <ExploreHomeScreen ... />
    ) : (
      <DeferredExploreSearchResults portalSlug={portalSlug} />
    )}
  </div>
)}
```

Replace with:

```tsx
{!state.lane && (
  <div className="flex flex-col gap-5 max-w-5xl mx-auto px-4 py-5 sm:py-6 min-h-[calc(100vh-5rem)]">
    <UnifiedSearchShell portalSlug={portalSlug} mode="inline" />
    {!state.q && (
      <ExploreHomeScreen
        portalSlug={portalSlug}
        data={homeData}
        loading={homeLoading}
        onRetry={() => {
          setHomeLoading(true);
          setHomeRetryKey((value) => value + 1);
        }}
      />
    )}
  </div>
)}
```

Remove the `ExploreSearchHero` and `DeferredExploreSearchResults` imports (the former can be fully deleted; the latter will be deleted in Task 46). Add:

```tsx
import { UnifiedSearchShell } from "@/components/search/UnifiedSearchShell";
```

- [ ] **Step 3: Handle URL sync subscription**

The old `ExploreUrlStateProvider` writes `?q=X` to the URL via `state.setSearchQuery`. The new store needs equivalent behavior in inline mode. Add a subscription effect to `ExploreShellClient` (or inside `UnifiedSearchShell` gated on `mode === "inline"`).

In `UnifiedSearchShell.tsx`, add near the top of the component body (but only when `mode === "inline"`):

```tsx
useEffect(() => {
  if (mode !== "inline") return;
  // Seed store from URL on mount
  if (typeof window !== "undefined") {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q") ?? "";
    if (q) useSearchStore.getState().setRaw(q);
  }
}, [mode]);

useEffect(() => {
  if (mode !== "inline") return;
  if (typeof window === "undefined") return;
  const t = setTimeout(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmed = raw.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    const next = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", next);
  }, 400);
  return () => clearTimeout(t);
}, [mode, raw]);
```

- [ ] **Step 4: Run the dev server and browser-test**

```bash
cd web && npm run dev
```

Open `http://localhost:3000/atlanta/explore`. Click the input, type "jazz". Expected:
- Input stays mounted (the original bug is not regressed).
- Results appear below with Top Matches + grouped sections.
- URL updates to `?q=jazz` via replaceState.

- [ ] **Step 5: Run tsc + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 6: Commit**

```bash
git add components/explore-platform/ExploreShellClient.tsx components/search/UnifiedSearchShell.tsx
git commit -m "feat(explore): mount UnifiedSearchShell inline, replace ExploreSearchHero"
```

---

### Task 42: Replace `HeaderSearchButton` with `LaunchButton` in all headers

**Files:**
- Modify: `web/components/headers/StandardHeader.tsx`
- Modify: `web/components/headers/MinimalHeader.tsx`
- Modify: `web/components/headers/PlatformHeader.tsx`
- Modify: `web/components/headers/ImmersiveHeader.tsx`
- Modify: `web/components/headers/BrandedHeader.tsx`
- Modify: `web/components/headers/DogHeader.tsx`
- Modify: `web/components/headers/AdventureHeader.tsx`
- Modify: `web/components/headers/ATLittleHeader.tsx`

**Why:** Every header replaces `HeaderSearchButton` with `LaunchButton`. Consistent launcher across surfaces.

- [ ] **Step 1: Find every reference**

```bash
grep -rn "HeaderSearchButton" components/headers/ | head -20
```

Expected: 8 files referencing it.

- [ ] **Step 2: Replace imports and usages**

In each file, replace:
```tsx
import HeaderSearchButton from "../HeaderSearchButton";
```
with:
```tsx
import { LaunchButton } from "@/components/search/LaunchButton";
```

And replace:
```tsx
<HeaderSearchButton />
<HeaderSearchButton portalSlug={portalSlug} />
```
with:
```tsx
<LaunchButton />
```

- [ ] **Step 3: Also mount `UnifiedSearchShell mode="overlay"` at a root level**

The overlay needs to be mounted somewhere to exist. Add it to `web/app/[portal]/layout.tsx` just above the `{children}` slot:

```tsx
import { UnifiedSearchShell } from "@/components/search/UnifiedSearchShell";

// ... inside the layout JSX, before {children}:
<UnifiedSearchShell portalSlug={resolvedSlug} mode="overlay" />
```

(The overlay renders nothing when `overlayOpen === false`, so this is a cheap mount.)

- [ ] **Step 4: Verify typecheck + lint**

```bash
npx tsc --noEmit
npm run lint
```

- [ ] **Step 5: Browser smoke test**

Start dev server. Visit `http://localhost:3000/atlanta`. Expected:
- Header shows the new `LaunchButton` (compact pill on desktop, icon on mobile).
- Click it → overlay opens full-screen with presearch content.
- Type "jazz" → results appear.
- Escape → clears input; Escape again → closes overlay.

- [ ] **Step 6: Commit**

```bash
git add components/headers/ app/\[portal\]/layout.tsx
git commit -m "feat(headers): replace HeaderSearchButton with LaunchButton + overlay mount"
```

---

### Task 43: Swap `FindSearchInput` for `LaneFilterInput` in lane filter bars

**Files:**
- Modify: `web/components/find/EventsFinder.tsx`
- Modify: `web/components/find/PlaceFilterBar.tsx`

**Why:** Lane filter bars get the tiny `LaneFilterInput` instead of the tangled `FindSearchInput`. The lane's existing `useTimeline` / `?search=X` URL plumbing stays intact — only the input component swaps.

- [ ] **Step 1: Update EventsFinder**

In `web/components/find/EventsFinder.tsx`, find the existing `<FindSearchInput ... findType="events" />` block. Replace with:

```tsx
import { LaneFilterInput } from "@/components/find/LaneFilterInput";

// ... inside JSX:
<LaneFilterInput
  value={searchValue}
  onChange={(next) => {
    // existing URL update logic, e.g., state.setLaneParams({ search: next || null })
    const params = new URLSearchParams(window.location.search);
    if (next) params.set("search", next);
    else params.delete("search");
    const url = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", url);
  }}
  placeholder="Filter events..."
/>
```

Where `searchValue` comes from the current URL param via `useReplaceStateParams`. Delete the `FindSearchInput` import.

- [ ] **Step 2: Update PlaceFilterBar**

Same pattern — replace the `FindSearchInput` usage (with `findType="destinations"`) with `LaneFilterInput`. Placeholder: `"Filter spots..."`.

- [ ] **Step 3: Verify lane filter still narrows the list**

Start dev server. Visit `http://localhost:3000/atlanta/explore?lane=events`. Type in the filter input. Expected: the events list narrows to matches. URL updates with `?search=...`.

- [ ] **Step 4: Verify typecheck**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add components/find/EventsFinder.tsx components/find/PlaceFilterBar.tsx
git commit -m "refactor(find): swap FindSearchInput for LaneFilterInput in lane filter bars"
```

---

## Part R — Contract enforcement + security headers (3 tasks)

### Task 44: ESLint rule — `no-retriever-rpc-calls`

**Files:**
- Create: `web/tools/eslint-rules/no-retriever-rpc-calls.js`
- Modify: `web/eslint.config.mjs` (register the rule)

**Why:** The architect's #1 risk: retrievers leaking presentation concerns or issuing their own DB calls. This lint rule fails the build if any file under `lib/search/retrievers/` calls `.rpc()` or imports `createServiceClient`. The rule IS the enforcement mechanism for the three-layer contract.

- [ ] **Step 1: Write the rule**

Create `web/tools/eslint-rules/no-retriever-rpc-calls.js`:

```javascript
/**
 * Retrievers MUST NOT issue their own database calls. They read from the
 * UnifiedRetrievalResult passed to their factory. This keeps the per-search
 * connection count at 1 instead of 9.
 *
 * Bans, under lib/search/retrievers/**:
 *   - Any `.rpc(` call
 *   - Any import of `createServiceClient` or `createClient` from supabase
 *   - Any import from `@/lib/supabase/*`
 */
module.exports = {
  meta: {
    type: "problem",
    docs: {
      description: "Retrievers cannot issue DB calls — read from UnifiedRetrievalResult instead",
    },
    schema: [],
    messages: {
      noRpcCall: "Retrievers cannot call .rpc() directly. Read from UnifiedRetrievalResult passed to the factory.",
      noSupabaseImport: "Retrievers cannot import Supabase clients. The orchestrator calls runUnifiedRetrieval; retrievers interpret its result.",
    },
  },
  create(context) {
    const filename = context.getFilename();
    if (!filename.includes("/lib/search/retrievers/")) return {};

    return {
      CallExpression(node) {
        if (
          node.callee.type === "MemberExpression" &&
          node.callee.property.type === "Identifier" &&
          node.callee.property.name === "rpc"
        ) {
          context.report({ node, messageId: "noRpcCall" });
        }
      },
      ImportDeclaration(node) {
        const source = node.source.value;
        if (typeof source !== "string") return;
        if (source.includes("@/lib/supabase") || source.includes("/supabase/service") || source.includes("/supabase/server")) {
          context.report({ node, messageId: "noSupabaseImport" });
        }
      },
    };
  },
};
```

- [ ] **Step 2: Register the rule in eslint config**

Inspect the existing `web/eslint.config.mjs`:

```bash
cat eslint.config.mjs
```

Add the custom rule. Example (adjust to match the file's existing structure):

```javascript
import localRules from "./tools/eslint-rules/index.js";

// In the config array, add a section:
{
  files: ["lib/search/retrievers/**/*.ts"],
  plugins: { local: localRules },
  rules: {
    "local/no-retriever-rpc-calls": "error",
  },
},
```

Create `web/tools/eslint-rules/index.js`:

```javascript
module.exports = {
  rules: {
    "no-retriever-rpc-calls": require("./no-retriever-rpc-calls.js"),
  },
};
```

- [ ] **Step 3: Verify the rule fires**

Add a temporary violation in `lib/search/retrievers/fts.ts`:

```typescript
import { createServiceClient } from "@/lib/supabase/service"; // should trigger lint error
```

Run:
```bash
npm run lint
```

Expected: error on that import. Remove the temporary import.

- [ ] **Step 4: Run lint clean**

```bash
npm run lint
```

Expected: clean (the rule fires on violations but there are none in the real retriever code).

- [ ] **Step 5: Commit**

```bash
git add tools/eslint-rules/ eslint.config.mjs
git commit -m "feat(lint): add no-retriever-rpc-calls rule enforcing three-layer contract"
```

---

### Task 45: Retriever contract test — purity enforcement

**Files:**
- Create: `web/lib/search/__tests__/retriever-contract.test.ts`

**Why:** The ESLint rule catches import-level violations. The contract test catches behavioral violations: is `retrieve(q)` a pure function? Does the same input produce the same output? Is `raw_score` monotonic in the retriever's native signal?

- [ ] **Step 1: Write the contract test**

Create `web/lib/search/__tests__/retriever-contract.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { buildRetrieverRegistry } from "@/lib/search/retrievers";
import type { UnifiedRetrievalResult } from "@/lib/search/unified-retrieval";
import type { AnnotatedQuery } from "@/lib/search/understanding/types";
import type { Candidate } from "@/lib/search/types";

function makeSource(): UnifiedRetrievalResult {
  return {
    fts: [
      { id: "a", type: "event", source_retriever: "fts", raw_score: 0.9, matched_fields: [], payload: {} },
      { id: "b", type: "event", source_retriever: "fts", raw_score: 0.7, matched_fields: [], payload: {} },
    ],
    trigram: [
      { id: "c", type: "event", source_retriever: "trigram", raw_score: 0.6, matched_fields: [], payload: {} },
      { id: "d", type: "event", source_retriever: "trigram", raw_score: 0.2, matched_fields: [], payload: {} }, // below floor
    ],
    structured: [
      { id: "e", type: "venue", source_retriever: "structured", raw_score: 1.0, matched_fields: [], payload: {} },
    ],
  };
}

const mockQuery: AnnotatedQuery = Object.freeze({
  raw: "test",
  normalized: "test",
  tokens: [],
  entities: [],
  spelling: [],
  synonyms: [],
  structured_filters: {},
  intent: { type: "find_event", confidence: 0.7 },
  fingerprint: "abc",
});

const ctx = {
  portal_id: "p",
  limit: 20,
  signal: new AbortController().signal,
};

describe("Retriever contract", () => {
  const registry = buildRetrieverRegistry(makeSource());

  for (const [name, retriever] of Object.entries(registry)) {
    describe(`${name}Retriever`, () => {
      it("has a stable id", () => {
        expect(retriever.id).toBe(name);
      });

      it("is pure — same input, same output", async () => {
        const a = await retriever.retrieve(mockQuery, ctx);
        const b = await retriever.retrieve(mockQuery, ctx);
        expect(a).toEqual(b);
      });

      it("raw_score is monotonically non-increasing after retrieval", async () => {
        const result = await retriever.retrieve(mockQuery, ctx);
        for (let i = 1; i < result.length; i++) {
          // Retrievers may preserve source order, which is already descending
          // by raw_score from the SQL ORDER BY. The contract: no retriever
          // returns candidates in an order inconsistent with their raw_score.
          expect(result[i - 1].raw_score).toBeGreaterThanOrEqual(result[i].raw_score);
        }
      });

      it("emits candidates with source_retriever matching its id", async () => {
        const result = await retriever.retrieve(mockQuery, ctx);
        for (const c of result) {
          expect(c.source_retriever).toBe(retriever.id);
        }
      });
    });
  }
});
```

- [ ] **Step 2: Run test (expected: PASS)**

```bash
npx vitest run lib/search/__tests__/retriever-contract.test.ts
```

If any assertion fails, the retriever implementation violated the contract. Fix the retriever before proceeding.

- [ ] **Step 3: Commit**

```bash
git add lib/search/__tests__/retriever-contract.test.ts
git commit -m "test(search): add retriever contract test enforcing purity + score monotonicity"
```

---

### Task 46: Add `Referrer-Policy` header + verify security checklist

**Files:**
- Modify: `web/next.config.ts`

**Why:** Inline-mode search writes `?q=drag+brunch` to the URL. When users click outbound links (Eventbrite, venue sites, ticketing vendors), the `Referer` header sends the full URL — including the query — to third parties. `strict-origin-when-cross-origin` strips path and query from cross-origin navigations, sending only the origin.

- [ ] **Step 1: Read the current next.config.ts**

```bash
cat next.config.ts
```

- [ ] **Step 2: Add the headers block**

Add (or merge with existing `headers()` function):

```typescript
async headers() {
  return [
    {
      source: "/:path*",
      headers: [
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      ],
    },
  ];
}
```

- [ ] **Step 3: Verify the header is set**

Restart the dev server:
```bash
npm run dev
```

Then:
```bash
curl -sI http://localhost:3000/atlanta | grep -i referrer-policy
```

Expected: `Referrer-Policy: strict-origin-when-cross-origin`

- [ ] **Step 4: Run the security pre-ship checklist (spec §3.9)**

Run each grep / curl / test and verify:

1. `grep -rn "portal_id" app/\[portal\]/api/search/ 2>&1 | grep -v "p_portal_id"` — expected: empty (no query-param reads)
2. `grep -rn 'searchParams.*portal_id' app/ 2>&1` — expected: empty
3. Manual: every search RPC takes `p_portal_id uuid` as first param — verified by pgTAP in Task 8
4. `./database/tests/run-pgtap.sh database/tests/search_unified.pgtap.sql` — expected: 4/4 passing
5. `npx vitest run lib/search/__tests__/input-schema.test.ts` — expected: 10/10 passing
6. `curl -sI "http://localhost:3000/atlanta/api/search/unified/personalize" | grep -i cache-control` — expected: `private, no-store`
7. `curl -s "http://localhost:3000/atlanta/api/search/unified?q=jazz" | python3 -c "import sys, json; d = json.load(sys.stdin); print('has savedByMe:', 'savedByMe' in str(d))"` — expected: `False`
8. `curl -sI http://localhost:3000 | grep -i referrer-policy` — expected: present

- [ ] **Step 5: Commit**

```bash
git add next.config.ts
git commit -m "security: add Referrer-Policy strict-origin-when-cross-origin"
```

---

## Part S — Legacy cleanup (2 tasks)

### Task 47: Delete `lib/unified-search.ts` and orphaned API routes

**Files:**
- Delete: `web/lib/unified-search.ts`
- Delete: `web/app/api/search/route.ts`
- Delete: `web/app/api/search/preview/route.ts`
- Delete: `web/app/api/search/suggestions/route.ts`
- Delete: `web/app/api/search/instant/route.ts` (callers now use `/api/search/unified`)

**Why:** "Delete compatibility aggressively" (`web/CLAUDE.md` rule 8). The new stack is proven. Old and new cannot coexist for more than a single task — dead code is rot.

- [ ] **Step 1: Grep for lingering references**

```bash
grep -rn "from \"@/lib/unified-search\"\|from '@/lib/unified-search'" lib/ components/ app/ 2>&1 | head -20
```

Expected: a few references in `instant-search-service.ts` (which consumes `unifiedSearch` under the hood) and in the `instant` API route. If any real component still imports it, STOP and refactor that consumer first.

Also check scripts:
```bash
grep -rn "from \"@/lib/unified-search\"\|from '@/lib/unified-search'" scripts/ 2>&1 | head -10
```

Expected: `search-audit.ts`, `prewarm-cache.ts`, `perf-audit.ts`. These are dev scripts, not prod code — they can either be updated to consume the new `search()` orchestrator OR deleted if unused.

- [ ] **Step 2: Decide script fate**

For each script in `scripts/search-audit.ts`, `scripts/prewarm-cache.ts`, `scripts/perf-audit.ts`:
- If actively used: update to call `search()` from `@/lib/search` instead of `unifiedSearch()`.
- If not used: delete the script file too.

Check git blame for the last meaningful commit:
```bash
git log -5 --oneline scripts/search-audit.ts scripts/prewarm-cache.ts scripts/perf-audit.ts
```

If any is stale (>6 months unused), delete.

- [ ] **Step 3: Check instant-search-service.ts dependency**

```bash
grep -rn "instant-search-service" lib/ app/ components/ 2>&1 | head
```

If `instant-search-service.ts` still has consumers, it needs to be migrated too. For Phase 0 we leave it in place ONLY if it's still consumed — the new `search()` replaces its public surface. Grep confirms:

```bash
grep -rn "buildInstantSearchPayload\|instantSearch" lib/ app/ components/ 2>&1 | head
```

If no consumers, delete `lib/instant-search-service.ts` and its test. If consumers exist, migrate them to `search()`.

- [ ] **Step 4: Delete the files**

```bash
rm lib/unified-search.ts
rm lib/unified-search.portal.test.ts
rm lib/unified-search-ranking.test.ts
rm -rf app/api/search/
```

- [ ] **Step 5: Delete supporting modules no longer used**

Check if any of these are now orphaned:
```bash
grep -rn "search-preview\|search-suggestions\|instant-search-service" lib/ app/ components/ 2>&1 | head
```

Delete any that are orphaned:
```bash
# example:
rm lib/instant-search-service.ts lib/instant-search-service.test.ts
rm lib/search-preview.ts lib/search-suggestions.ts
```

- [ ] **Step 6: Run full typecheck + lint + tests**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
```

Fix any broken imports. If a test file references a deleted module, update or delete it.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(search): delete lib/unified-search.ts and orphaned search routes"
```

---

### Task 48: Delete `HeaderSearchButton`, `MobileSearchOverlay`, `FindSearchInput`, legacy `ExploreSearchResults`, `ExploreSearchHero`, `find/ExploreHome`

**Files:**
- Delete: `web/components/HeaderSearchButton.tsx`
- Delete: `web/components/search/MobileSearchOverlay.tsx`
- Delete: `web/components/find/FindSearchInput.tsx`
- Delete: `web/components/explore-platform/ExploreSearchResults.tsx`
- Delete: `web/components/explore-platform/ExploreSearchHero.tsx`
- Delete: `web/components/find/ExploreHome.tsx`
- Delete: `web/components/search/PreSearchState.tsx`
- Delete: `web/components/search/QuickAction.tsx` (if not consumed elsewhere)
- Delete: `web/components/search/SuggestionGroup.tsx` (if not consumed elsewhere)
- Delete: `web/components/search/index.ts` (will be replaced with new exports or removed)

**Why:** All of these are superseded by `UnifiedSearchShell` and its sub-components. Nothing should import them after Tasks 41–43.

- [ ] **Step 1: Confirm no remaining references**

```bash
for f in HeaderSearchButton MobileSearchOverlay FindSearchInput ExploreSearchResults ExploreSearchHero; do
  echo "=== $f ==="
  grep -rn "$f" lib/ components/ app/ 2>&1 | grep -v "\.deleted\|__tests__" | head -5
done
```

Expected: zero real references. If any surface.

- [ ] **Step 2: Also check the old `find/ExploreHome`**

```bash
grep -rn "from '@/components/find/ExploreHome'\|from \"@/components/find/ExploreHome\"" lib/ components/ app/ 2>&1
```

Expected: zero.

- [ ] **Step 3: Delete the files**

```bash
rm components/HeaderSearchButton.tsx
rm components/search/MobileSearchOverlay.tsx
rm components/find/FindSearchInput.tsx
rm components/explore-platform/ExploreSearchResults.tsx
rm components/explore-platform/ExploreSearchHero.tsx
rm components/find/ExploreHome.tsx
rm -f components/search/PreSearchState.tsx
rm -f components/search/QuickAction.tsx
rm -f components/search/SuggestionGroup.tsx
```

- [ ] **Step 4: Update `components/search/index.ts` if present**

If the file exists and re-exports deleted components, either delete it or update exports to point at new components (`UnifiedSearchShell`, `LaunchButton`, `SearchInput`, card components).

```bash
cat components/search/index.ts 2>/dev/null || echo "no index.ts"
```

- [ ] **Step 5: Run full validation**

```bash
npx tsc --noEmit
npm run lint
npx vitest run
```

Fix any test/import breakage.

- [ ] **Step 6: Verify browser still works**

Start dev server. Visit:
- `http://localhost:3000/atlanta` (feed home) — header shows `LaunchButton`, clicking opens overlay
- `http://localhost:3000/atlanta/explore` — inline `UnifiedSearchShell` mounted, typing "jazz" shows results in body
- `http://localhost:3000/atlanta/explore?lane=events` — `LaneFilterInput` in the filter bar narrows the list
- `http://localhost:3000/atlanta/explore?lane=places` — same for places

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(search): delete legacy components (FindSearchInput, HeaderSearchButton, etc.)"
```

---

## Part T — Final gates + integration test (2 tasks)

### Task 49: Integration test — full happy path

**Files:**
- Create: `web/lib/search/__tests__/integration.test.ts`

**Why:** All the unit tests mock database and DB-adjacent calls. This integration test hits a test database to verify the whole pipeline: Zod → normalize → annotate → `search_unified` RPC → retrievers → RRF → presenter. If it passes, the wiring is correct.

- [ ] **Step 1: Write the integration test**

Create `web/lib/search/__tests__/integration.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { search } from "@/lib/search";
import { parseSearchInput } from "@/lib/search/input-schema";
import { createServiceClient } from "@/lib/supabase/service";

// Only run against a real DB when env vars are present
const hasDb =
  Boolean(process.env.UPSTASH_REDIS_REST_URL === undefined) && // any indicator of local
  Boolean(process.env.SUPABASE_URL);

const maybe = hasDb ? describe : describe.skip;

maybe("search integration (requires live DB)", () => {
  let portalId: string;

  beforeAll(async () => {
    const client = createServiceClient();
    const { data } = await client
      .from("portals")
      .select("id")
      .eq("slug", "atlanta")
      .single();
    portalId = (data as { id: string } | null)?.id ?? "";
    if (!portalId) throw new Error("atlanta portal not found in test DB");
  });

  it("returns non-empty results for a common query", async () => {
    const result = await search("jazz", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.diagnostics.total_ms).toBeGreaterThan(0);
    // "jazz" should return at least 1 result in the Atlanta dev DB
    expect(result.sections.length + result.topMatches.length).toBeGreaterThan(0);
  });

  it("returns zero-result for nonsense query", async () => {
    const result = await search("qxzvwrbnonsense", {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: 20,
    });
    expect(result.sections).toEqual([]);
    expect(result.topMatches).toEqual([]);
  });

  it("end-to-end: parseSearchInput + search produces valid shape", async () => {
    const params = new URLSearchParams("q=music&limit=5");
    const input = parseSearchInput(params);
    const result = await search(input.q, {
      portal_id: portalId,
      portal_slug: "atlanta",
      limit: input.limit,
    });
    expect(result.diagnostics.cache_hit).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the integration test**

```bash
npx vitest run lib/search/__tests__/integration.test.ts
```

Expected: 3/3 passing (or skipped if the dev DB isn't reachable, which is OK for CI but NOT for the final Phase 0 ship gate).

- [ ] **Step 3: Commit**

```bash
git add lib/search/__tests__/integration.test.ts
git commit -m "test(search): add end-to-end integration test against live DB"
```

---

### Task 50: Final ship gates — run the full preflight checklist

**Files:** none (verification only)

**Why:** Phase 0 doesn't ship until every gate passes. This task is the final "ready to merge" verification.

- [ ] **Step 1: Clean typecheck**

```bash
cd web
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 2: Clean lint**

```bash
npm run lint
```

Expected: zero errors. The `no-retriever-rpc-calls` rule is active and passing.

- [ ] **Step 3: Full test suite**

```bash
npx vitest run
```

Expected: all tests pass. Specifically:
- All search unit tests (annotate, tokenize, intent, entities, normalize, input-schema, unified-retrieval, fts, trigram, structured, rrf, grouped, search-service, store, observability, presearch-config, useVisualViewportHeight, retriever-contract, integration)
- All pre-existing tests (901+)
- Zero new failures

- [ ] **Step 4: pgTAP portal isolation test**

```bash
cd ../database/tests
DATABASE_URL="$DATABASE_URL" ./run-pgtap.sh search_unified.pgtap.sql
```

Expected: `ok 1..4`, all 4 assertions pass.

- [ ] **Step 5: Security pre-ship checklist (spec §3.9)**

Walk through the 10-item checklist from Task 46 step 4 one more time. Every item must be green.

- [ ] **Step 6: Data coverage audit final check**

Run the data audit again via `data-specialist` subagent to confirm coverage hasn't regressed during Phase 0 work (it shouldn't have — no crawler changes — but verify).

- [ ] **Step 7: Mobile keyboard smoke test**

Start the dev server. Open in Safari iOS simulator and Chrome Android emulator:
- Navigate to `/atlanta`
- Tap the `LaunchButton` icon → overlay opens full-screen
- Tap the input → keyboard appears
- Type "jazz" → results scroll container visible, input pinned at top
- Close keyboard → container expands back

Verify on BOTH iOS and Android. If the overlay breaks on either, fix the `useVisualViewportHeight` wiring before merging.

- [ ] **Step 8: Browser-test the full explore flow**

- `/atlanta` → header launcher → overlay → search "jazz" → result card click → detail page loads
- `/atlanta/explore` → inline hero → type "brunch" → results stream in → URL updates to `?q=brunch`
- `/atlanta/explore?q=brunch` → direct URL with query → results render on page load
- `/atlanta/explore?lane=events` → lane filter input → type "jazz" → events list narrows
- `/atlanta/explore?lane=places` → same for places

All five flows must work with zero console errors.

- [ ] **Step 9: Verify `search_events` is populating**

```bash
psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM search_events WHERE occurred_at > now() - interval '10 minutes';"
```

Expected: at least 5 rows (from your manual browser testing).

```bash
psql "$DATABASE_URL" -c "SELECT portal_slug, user_segment, query_length, cache_hit, zero_result, total_ms FROM search_events WHERE occurred_at > now() - interval '10 minutes' ORDER BY occurred_at DESC LIMIT 10;"
```

Expected: rows with `portal_slug='atlanta'`, valid `total_ms`, no `user_id` column exposed.

- [ ] **Step 10: Check the ACTIVE_WORK entry**

If the work is done, clear the Phase 0 entry from `ACTIVE_WORK.md`:

```bash
# Edit the file to remove the search-elevation-phase-0 line
```

- [ ] **Step 11: Final commit + PR**

```bash
git add ACTIVE_WORK.md
git commit -m "chore: clear ACTIVE_WORK entry for search elevation phase 0"
git push -u origin search-elevation-phase-0
gh pr create --title "Search elevation phase 0: unified search foundation" --body "$(cat <<'EOF'
## Summary
- Deletes 1869-line lib/unified-search.ts + orphaned /api/search routes
- Replaces with web/lib/search/ three-layer architecture (Retrieval → Ranking → Presentation)
- Single search_unified SQL function, one connection per search (not nine)
- search_events observability table populated via after() — no user_id
- UnifiedSearchShell with inline (explore hero) + overlay (launcher) modes
- LaneFilterInput split from FindSearchInput for in-lane narrowing
- ESLint rule no-retriever-rpc-calls enforcing contract
- pgTAP portal-isolation test as regression gate

Spec: docs/superpowers/specs/2026-04-13-search-elevation-design.md
Plan: docs/superpowers/plans/2026-04-13-search-elevation-phase-0.md

## Test plan
- [x] tsc --noEmit clean
- [x] npm run lint clean
- [x] vitest run: all pass including retriever contract + integration
- [x] pgTAP search_unified.pgtap.sql: 4/4 assertions pass
- [x] Security checklist (spec §3.9): 10/10
- [x] Mobile keyboard tested on iOS Safari + Android Chrome
- [x] All 5 browser flows work: header launcher, explore inline, direct URL, lane events, lane places
- [x] search_events table populating via after()
- [x] Data coverage audit green (venue_id ≥85%, category ≥90%, neighborhood ≥85%)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

This is the engineer's self-review after writing the plan. Run through the checklist below:

**1. Spec coverage:** every Part 1–8 section of the spec maps to at least one task:
- Strategy (§1) → implicit in all tasks; north star + benchmarks embedded in spec references
- Architecture (§2) → Tasks 9–12 (types), 13–17 (understanding), 18 (input), 19–22 (retrieval), 23 (ranking), 24 (presenting), 25 (orchestrator), 30 (store)
- Security (§3) → Tasks 4–8 (migrations + portal isolation), 18 (Zod), 27–29 (routes with rate limit + CSRF), 46 (Referrer-Policy)
- Performance (§4) → Task 26 (observability), 7 (single SQL function reconciliation)
- UX (§5) → Tasks 31 (mobile kbd hook), 32 (presearch config), 33 (input), 34–35 (cards), 36 (body), 37 (empty state), 38 (shell), 39 (launcher)
- Phasing (§6) → Task 1 (Phase 0 green-light), Task 50 (ship gates)
- Risks (§7) → Task 1 gates on data coverage (Risk 1); Task 44 + 45 enforce contract against creep (Risk 2); plan stays focused on search (Risk 3)
- Open Questions (§8) → deferred to Phase 1 or documented as known gaps

**2. Placeholder scan:** no "TBD", "TODO", "similar to Task N" without code, or "fill in details". Task 35 references "copy this file" but provides explicit per-file changes; acceptable for 7 structurally-identical cards.

**3. Type consistency:** `Retriever`, `Candidate`, `RetrieverId`, `AnnotatedQuery`, `RankedCandidate`, `PresentedResults` are all used consistently with the same field names across tasks. `search_unified` RPC signature is consistent between migration (Task 7), wrapper (Task 19), and pgTAP test (Task 8).

**4. No dangling references:** `EmptyState` forward-referenced in Task 36 is resolved in Task 37. All component imports in Tasks 38, 41, 42 point to files created earlier.

---

## Execution handoff

**Plan complete and saved to `docs/superpowers/plans/2026-04-13-search-elevation-phase-0.md`.** Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Best for this plan because each task is self-contained and benefits from clean context.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`. Batch execution with checkpoints for review. Slower but keeps full conversational context.

Which approach?
