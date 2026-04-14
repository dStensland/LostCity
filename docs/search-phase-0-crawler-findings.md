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
