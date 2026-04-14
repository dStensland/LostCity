# Crawler findings surfaced during Search Elevation Phase 0

Running log of data quality issues discovered while implementing the search rebuild. These are **not** blocking Phase 0 search ship (they don't fail the coverage gate in spec §1.6), but they affect search quality or feature completeness and belong to crawler-dev / data-specialist workstreams.

Track and close as separate efforts. Search Phase 0 ships without fixing any of these.

---

## Finding 1 — Event price coverage 54.2% (Atlanta)

**Discovered:** 2026-04-13, Task 1 data coverage audit
**Severity:** Medium
**Gating:** NO — not in the three bold thresholds
**Affects:** "Free events tonight", "Events under $20", price filter chips on result cards

### Numbers
- `events.price` populated: **54.2%** of active Atlanta events
- Spec target (non-gating): **≥80%**
- Gap: **~25 percentage points**, roughly 14,700 events missing price data

### Impact on search
- Result cards for ~46% of events render the "unknown price" fallback, which looks incomplete
- `?free=true` filter query under-recalls — users searching for free events miss events where crawlers haven't captured price
- Cannot satisfy "cheap eats" / "$$ brunch" type intents with precision
- Phase 1 synonym map won't help; this is a data extraction gap, not a query understanding gap

### Recommended owners
- **crawler-dev** — audit which sources are dropping price during extraction. Likely suspects: sources that link out to external ticketing (Eventbrite, DICE, Ticketmaster) where price sits one click deeper than the event landing page
- **data-specialist** — quantify per-source price coverage to prioritize the fix list

### Suggested next step
Run a "top 10 sources by missing price" query similar to the audit's place_id gap query, then file per-source crawler fixes.

---

## Finding 2 — ~~Venues may not have `search_vector`~~ **RESOLVED — places already has it**

**Discovered:** 2026-04-13, Task 7 plan correction
**Resolved:** 2026-04-13, Task 7 implementation — implementer verified during schema inspection that the table is actually `places` (renamed from `venues`) and `places.search_vector tsvector` is populated at 100% (6,785/6,785 rows). Phase 0 still ships trigram-only for places to match the committed migration, but **Phase 1 can add an `fts_places` CTE trivially** — the underlying data is ready. This is not a gap; it's an opportunity.

### Phase 1 follow-up (not blocking anything)
Add an `fts_places` CTE to `search_unified` using `ts_rank_cd(p.search_vector, v_tsq)`. Same structure as `fts_events`. One small migration, no crawler work, no data fix.

---

## Finding 3 — Supabase pre-provisions `anon` grant on functions that survives `REVOKE ALL FROM PUBLIC`

**Discovered:** 2026-04-14, Sprint A (search_unified hardening)
**Severity:** Medium — platform gotcha, not a data issue
**Gating:** NO
**Affects:** Any future migration that defines a function intended to be non-public

### Issue
When a function is created in a Supabase Postgres instance, Supabase platform tooling pre-provisions an explicit `EXECUTE` grant to the `anon` role. This grant is **not** removed by `REVOKE ALL ON FUNCTION ... FROM PUBLIC`. It must be explicitly revoked with:

```sql
REVOKE EXECUTE ON FUNCTION public.fn_name(arg_types) FROM anon;
```

If omitted, the function is publicly callable via PostgREST at `/rest/v1/rpc/fn_name`, bypassing any Next.js route-level validation, rate limiting, or origin checks.

### Why it matters for search
The `search_unified` function was initially granted only to `authenticated, service_role` via `GRANT EXECUTE ... TO authenticated, service_role`, with `REVOKE ALL FROM PUBLIC` as the sole revocation. Security reviewer flagged that `anon` could still invoke it; the Sprint A implementer reproduced the behavior and added the explicit `REVOKE EXECUTE ... FROM anon` line. Final migration 20260413000008 has both revocations.

### Recommended pattern for future functions
Every new RPC migration that handles sensitive data or must enforce route-level validation should include BOTH lines:

```sql
REVOKE ALL ON FUNCTION public.fn_name(arg_types) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_name(arg_types) FROM anon;
GRANT EXECUTE ON FUNCTION public.fn_name(arg_types) TO authenticated, service_role;
```

Add to the team's migration checklist and consider a CI lint rule that flags `CREATE FUNCTION` without a corresponding `REVOKE EXECUTE ... FROM anon` when the function is in the `public` schema and takes sensitive parameters.

### Recommended owners
- **search-dev** / **data-specialist** — add to migration review checklist
- **devops** — consider a lint rule or DB audit query that enumerates all `public` functions grantable to `anon`

### Suggested next step
Run a one-time audit query against the dev + prod DBs:

```sql
SELECT p.proname, pg_get_function_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND has_function_privilege('anon', p.oid, 'execute');
```

Review any unexpected entries. Functions that should NOT be anon-callable get an explicit `REVOKE EXECUTE ... FROM anon` migration.

---

## Finding 4 — Midtown query "525ms overhead" was dev-server cold start, not a structural bug

**Discovered:** 2026-04-13, Sprint E-1.3 (performance diagnosis)
**Severity:** Low — not a production concern
**Gating:** NO
**Affects:** Local dev experience only

### Numbers

Timing instrumentation added to the route handler + search-service revealed:

| Phase | midtown (1st req) | midtown (2nd req) | jazz (warm) | brunch (warm) |
|---|---|---|---|---|
| resolvePortal | 539.9ms | 0.6ms | 1.3ms | 1.4ms |
| parseInput | 1.9ms | 0.1ms | 0.1ms | 0.1ms |
| search() | 191.7ms | 320.8ms | 340.6ms | 140.2ms |
| serialize | 0.8ms | 0.2ms | 0.3ms | 0.1ms |
| **TOTAL** | **738.2ms** | **322.3ms** | **343.1ms** | **142.3ms** |

The 539.9ms was entirely `resolvePortalRequest` — a DB lookup on first invocation
with a cold Supabase client pool. Not related to the query token "midtown".
The Next.js compile time for the route added another 602ms on top (shown in
Next.js's own log as "compile: 602ms").

### Root cause
`resolvePortalRequest` hits the DB to look up the portal record by slug on first
call. The Supabase JS client pool is cold on the first request after server start.
All subsequent calls show `resolvePortal` at 0.6–1.4ms.

### Why midtown looked special
The performance reviewer benchmarked midtown at 644ms HTTP after starting the dev
server, then compared to 117ms direct psql (which was a **warm** query on an
already-connected psql client). The comparison was cold vs warm.

### Production impact
None. Vercel serverless: the route handler module is warm after the first Lambda
invocation per region. Connection pooling via PgBouncer/Supavisor means the DB
pool is pre-warmed. Phase 1 Redis caching will further amortize cold starts.

### Warm performance (what matters)
Warm midtown: 142ms total. Well inside the p95 target of 415ms for warm-miss
queries. All filter variants verified live:
- baseline (no filter): 40 results
- categories=music: 24 results (narrowed)
- free=true: 31 results (narrowed)
- types=event: sections=['event'] only
- date=weekend: 20 results (narrowed)

### Recommended owners
No action needed for production. If local dev cold starts are annoying, a
`resolvePortalRequest` in-memory cache for dev mode would help — but this is
not worth engineering time.

---

## Finding 5 — Legacy search stack has broader surface than Tasks 41/42/43 assumed

**Status:** ✅ **CLOSED by PR #16 on 2026-04-14** (`search-elevation-phase-0-5`)
**Discovered:** 2026-04-14, Task 47 attempt
**Severity:** Medium — non-portal surfaces still run the old search experience
**Gating:** NO — Phase 0 still ships; this is Phase 0.5 cleanup
**Affects:** `/community`, `/happening-now`, and the portal `ExploreHomeScreen` sub-tree

### Situation
Task 47 tried to delete `web/lib/unified-search.ts` + `web/app/api/search/*`.
Subagent stopped when Grep enumeration found 20 import sites, including live
UI consumers that Tasks 41/42/43 did not migrate:

1. **`GlassHeader.tsx`** (used by `app/community/page.tsx`, `app/happening-now/page.tsx`)
   still renders `HeaderSearchButton` + `MobileSearchOverlay`. Task 42
   migrated the 8 portal-specific headers but missed `GlassHeader`.
2. **`ExploreHomeScreen.tsx`** / **`ExploreSearchHero.tsx`** render
   `FindSearchInput` + `ExploreSearchResults` internally. Task 41 replaced
   the outer `ExploreShellClient` hero with `UnifiedSearchShell`, but the
   home-screen sub-tree mounted underneath it still uses the old stack.
3. **`components/find/ExploreHome.tsx`** (distinct from `ExploreHomeScreen`)
   is used by `app/[portal]/explore/_components/ExploreSurface.tsx` and also
   consumes `FindSearchInput`. Task 43 swapped the lane filter bars only.
4. **Shared types** (`SearchResult`, `SearchFacet`, `UnifiedSearchResponse`)
   live in `lib/unified-search.ts` and are re-exported by
   `lib/explore-platform/types.ts`. Moving them to a neutral module is a
   prerequisite to deleting the source file.
5. **`lib/portal-attribution.test.ts:163-176`** reads `unified-search.ts`
   from disk as a portal-isolation sentinel test and would fail on deletion
   regardless of the UI state.

### Impact
- Portal pages (`/atlanta`, `/atlanta/explore`, etc. outside the Explore
  sub-tree) use the new unified search stack. The original unmount bug is
  fixed; filters flow end-to-end; observability, security, retrieval, and
  ranking are production-quality on those surfaces.
- Non-portal community pages (`/community`, `/happening-now`) still run the
  old HeaderSearchButton/MobileSearchOverlay experience.
- The portal Explore surface mounts both the new `UnifiedSearchShell` (hero)
  AND the old `ExploreSearchHero` inside `ExploreHomeScreen` below it.
  Whether this is visually broken in the browser is untested — worth a QA pass.

### Deferred scope (Phase 0.5) — now CLOSED by PR #16
Tasks 47 and 48 were deferred from Phase 0 and executed in the
`search-elevation-phase-0-5` branch:
1. ✅ Shared types lifted into `lib/search/legacy-result-types.ts` as a
   temporary bridge, 14 consumers repointed, bridge deleted once the
   cascade eliminated every consumer. Commits `4f325813`, `dd399aa2`,
   `782a5395`.
2. ✅ `GlassHeader.tsx` migrated from `HeaderSearchButton` to
   `LaunchButton`. Commit `9bfb986a`.
3. ✅ Explore home-screen sub-tree — `ExploreSearchHero`,
   `ExploreSearchResults`, `find/ExploreHome`, `FindSearchInput` —
   all deleted. `ExploreHomeScreen` confirmed live but no longer
   renders any of the legacy search components. Commit `38fdc561`.
4. ✅ `lib/unified-search.ts` + the four `/api/search/*` routes
   (`route`, `preview`, `suggestions`, `instant`) deleted alongside
   `instant-search-service`, `search-preview`, `search-suggestions`,
   `search-navigation`, `search-ranking`, `search-suggestion-results`,
   `useInstantSearch`, and `search-presearch`. Commit `38fdc561`.
5. ✅ `lib/portal-attribution.test.ts:163-176` disk sentinel updated
   to drop the deleted-file references. pgTAP portal-isolation test
   (`database/tests/search_unified.pgtap.sql`) is now the authoritative
   regression gate. Commit `04ddea2f`.

**Net cleanup:** 31 legacy files deleted, 10,221 LoC removed, 201 LoC
added (the `RootSearchOverlay` component + the personalize portal-scope
fix + supporting bridge code).

**Bonus fix (not in original scope):** pre-merge QA caught a regression
where `LaunchButton` on `/community` + `/happening-now` became a silent
no-op after GlassHeader migration, because no `UnifiedSearchShell`
overlay was mounted outside `[portal]/layout.tsx`. Commit `f07e695b`
promoted the overlay to the root layout via a new `RootSearchOverlay`
client component that derives the portal slug reactively from
`usePathname()` and falls back to "atlanta" for non-portal routes.
Commit `c2a82a25` added a useEffect that resets the store on
cross-portal navigation to prevent stale-result flash on reopen.

**Also fixed in Phase 0.5:**
- Architect Important #1 (Phase 0): `personalize` route now portal-scopes
  both events AND venues (using the same `portal_venues` rule
  `search_unified` enforces) before querying `saved_items`. Commits
  `58db3203`, `c2a82a25`. Cross-portal `savedByMe` probe closed.
- Architect Important #2: `search-service.ts` returns a fresh
  `PresentedResults` via shallow spread instead of mutating the
  presenter's output. Commit `58db3203`.
- Security H1 follow-up: `createServiceClient()` throw path now wrapped
  in try/catch returning a sanitized 503 instead of leaking a stack.
  Commit `c2a82a25`.
- Security delete-cascade straggler: `web/scripts/perf-audit.ts` and
  `prewarm-cache.ts` retargeted from deleted `/api/search/instant`
  routes to the new `/{portal}/api/search/unified` stack.
  `web/scripts/search-audit.ts` deleted entirely — it depended on
  Phase 1 capabilities (alias canonicalization, venue-first ranking)
  that the Phase 0 architecture intentionally defers. Fresh search
  quality harness ships with Phase 1. Commit `ff6ab801`.
- Spec Appendix A drift: commented out Phase-1 entries (`lib/search/cache.ts`,
  `presenting/mmr.ts`). Commit `58db3203`.

### Phase 0 acceptance
The Phase 0 ship goal was "rebuild search on the portal surface." That's
achieved on the home and header surfaces. The non-portal community pages and
the Explore sub-tree weren't explicitly in scope — they were assumed to fall
out of the reshuffle, but didn't. Ship Phase 0 as-is; file this as a
Phase 0.5 cleanup ticket.

---

## Template for future findings

```markdown
## Finding N — [short title]

**Discovered:** YYYY-MM-DD, Task X [description]
**Severity:** Low / Medium / High
**Gating:** YES / NO — [which threshold it fails, if any]
**Affects:** [what the user sees]

### Numbers
[concrete coverage / count / percentage]

### Impact on search
[bulleted list of user-visible effects]

### Recommended owners
[specific role, e.g., crawler-dev, data-specialist, portal-config]

### Suggested next step
[concrete first action]
```
