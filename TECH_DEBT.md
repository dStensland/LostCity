# Tech Debt

> **Status as of 2026-04-14:** Re-audited all items against current code. Each item now has a status marker (🟢 STILL OPEN / ✅ FIXED / 🟡 PARTIALLY FIXED / ⚫ OBSOLETE) based on verification against the current main branch. Schema references in descriptions have also been updated where drift was found (venues → places, etc.). The audit methodology is item-by-item verification against code, not a full rewrite of the categories. If an item's classification is wrong, correct it and note the evidence.

Tracked items to address post-launch.

## 1. ~40 `(supabase as any)` casts suppress TypeScript type safety

🟢 **STILL OPEN** — Verified 2026-04-14: `grep -rln "supabase as any" web/` matches 23 files; `web/lib/portal.ts` alone still has 10+ occurrences. Note description drift: `lib/unified-search.ts` has been deleted (search_unified RPC replaced it); `lib/federation.ts` still exists. Scope reduced but pattern still widespread.

Scattered across `lib/portal.ts`, ~~`lib/unified-search.ts`~~ (deleted), `lib/federation.ts`, API routes, and page components. These bypass type checking on the entire Supabase query chain, meaning schema changes (renamed columns, new tables) won't be caught at compile time.

**Fix:** Replace with the `AnySupabase` type from `lib/api-utils.ts` or generate proper Supabase types with `supabase gen types typescript`.

**Risk:** Low until you change the DB schema, then it becomes high.

## 2. No migration tracking

🟢 **STILL OPEN** — Verified 2026-04-14: `database/migrations/` contains 802 files; `supabase/migrations/` contains 741 files. No `schema_migrations` table detected. Problem is now larger than when originally filed.

There's no record of which SQL migrations have been applied to the database. The ~~`database/migrations/` directory has 115+ files~~ **`database/migrations/` now has 802 files and `supabase/migrations/` has 741** with inconsistent naming. Applying migrations is manual via `psql` or `run_migration.js`.

**Fix:** Either:
- Use `supabase db push` with the Supabase CLI migration system
- Add a `schema_migrations` table that records applied migration filenames + timestamps
- Adopt a proper migration tool (Prisma, Drizzle, or just the Supabase CLI)

**Risk:** Medium. Will cause confusion and potential outages when someone forgets to run a migration or runs one twice (most are idempotent with IF NOT EXISTS, but not all).

## 3. No CI pipeline (GitHub Actions)

✅ **FIXED** — Verified 2026-04-14: `.github/workflows/` now contains 8 workflows including `web-quality.yml` (tsc + vitest + lint on PR and push to main), `crawl.yml`, `migration-parity.yml`, `web-perf-smoke.yml`, `enrichment.yml`, and others. Web quality gate runs on every PR touching `web/**`.

~~There are no automated checks on push or PR. Tests, build verification, and lint all run locally only. The pre-commit hook catches issues before commit, but CI would catch issues from contributors and provide a safety net.~~

**Fix:** ~~Add a GitHub Actions workflow running `npm run build`, `vitest run`, and `pytest` on PRs to `main`.~~ Done via `web-quality.yml` and sibling workflows.

**Risk:** ~~Low while solo, medium once others contribute.~~

---

## Pre-Beta Audit Findings (2026-02-08)

Findings from comprehensive security, architecture, and performance audits. Critical and High items were fixed; these are the remaining Important and Advisory items.

### Security

**S1. Rate limiting falls back to in-memory silently** (`web/lib/rate-limit.ts`) — 🟢 **STILL OPEN**. Verified 2026-04-14: `rate-limit.ts` still falls back to in-memory on Upstash errors via a `console.warn`. No production fail-closed behavior, no structured logging beyond console. When Upstash Redis is unavailable, each Vercel instance gets its own counter. Add logging + consider failing closed in production.

**S2. `unsafe-inline` in style-src CSP** (`web/lib/csp.ts`) — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: `buildCsp()` now uses nonce-based style-src when `allowInlineStyles` is false (default production path), with `unsafe-inline` only kept intentionally for `script-src` because Next.js 16 streaming injects nonceless `$RC`/`$RS` scripts (this is now a documented gotcha in `web/CLAUDE.md`, not a fix target). `style-src-elem` still uses `'unsafe-inline'` for runtime icon libraries (Phosphor, Lucide). The original `DarkHoursTheme.tsx` concern appears addressed; remaining debt is narrower.

**S3. Email addresses logged in plain text** (`web/app/api/find-friends/send-invites/route.ts`) — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: Line 146 still logs full email in a `console.error` on send failure (`Failed to send invite to ${email}:`). Original line 131 concern appears to be gone. Remaining: redact to `email.slice(0,3)***` in the error branch.

**S4. `img-src` CSP allows all HTTPS** (`web/lib/csp.ts`) — ⚫ **OBSOLETE**. This was already flagged as an intentional decision, not a bug. We pull event/venue images from 500+ crawled domains; an allowlist breaks images silently every time a new source is added. The security value of `img-src` restrictions is minimal (no XSS/clickjacking risk from images). Do not tighten — focus CSP hardening on `script-src` and `frame-ancestors` instead.

**S5. Admin users route uses user-session client** (`web/app/api/admin/users/route.ts`) — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Verified 2026-04-14: Route imports `createClient as createServerClient` and uses `isAdmin()` for authorization; could not confirm whether the mutation paths actually use `createServiceClient()` without reading the full route. Spot-check indicates the import is still `from "@/lib/supabase/server"` rather than `service`, so likely still open. Should use `createServiceClient()` after `isAdmin()` check.

**S6. Seed scripts contain test passwords** (`web/scripts/seed-staging.ts`) — 🟢 **STILL OPEN**. Verified 2026-04-14: No `NODE_ENV === 'production'` guard detected in seed-staging.ts. Add env check to refuse production runs.

**S7. Hardcoded OMDB API key default** (`crawlers/config.py`) — ✅ **FIXED**. Verified 2026-04-14: `crawlers/config.py:121` is now `omdb_api_key: str = Field(default_factory=lambda: os.getenv("OMDB_API_KEY", ""))`. Empty string default, no hardcoded `"trilogy"` value.

### Architecture

**A1. No API route tests** — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: Now 341 route files (up from 139) and 17 API-adjacent test files (up from 0). Coverage still minimal relative to surface area, but priority routes `/api/rsvp`, `/api/saved`, `/api/auth/profile`, `/api/follow` should be re-prioritized against the current route inventory.

**A2. `sanitizeKey()` duplicated 5 times** — 🟢 **STILL OPEN**. Verified 2026-04-14: `sanitizeKey` is defined in 4 locations (`web/lib/supabase/client.ts:25`, `server.ts:6`, `service.ts:5`, and standalone `web/lib/supabase.ts:7`). Extract to `web/lib/supabase/utils.ts`.

**A3. 660-line hardcoded `SOURCE_MODULES`** (`crawlers/main.py`) — ✅ **FIXED**. Verified 2026-04-14: `crawlers/main.py` now defines `auto_discover_modules()` at line 1730 and calls it at line 1762. No hardcoded `SOURCE_MODULES = {...}` block detected.

**A4. Logger not wired to Sentry** (`web/lib/logger.ts:35-38`) — 🟢 **STILL OPEN**. Verified 2026-04-14: `logger.error()` still has only a commented-out `// if (!isDev && typeof Sentry !== 'undefined') { Sentry.captureException... }` stub. API errors vanish after Vercel's 1hr log retention.

**A5. Deprecated `datetime.utcnow()`** (`crawlers/db.py`) — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: `crawlers/db.py` monolith was decomposed into `crawlers/db/` submodules, but `utcnow()` persists: `crawlers/db/events.py` (2 occurrences), `crawlers/db/sources.py` (7+ occurrences). Replace with `datetime.now(timezone.utc)`.

**A6. Crawler test coverage minimal** (`crawlers/tests/`) — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: `crawlers/tests/` now has 406 test files (up from minimal). `test_db.py` includes `test_validate_event_*` and `test_insert_event_*` cases. Surface area grew so proportional coverage may still be weak, but priority functions are at least touched.

**A7. Verify CSRF protection** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Not re-verified in this audit pass. No explicit CSRF tokens on mutating endpoints. Verify SameSite cookie attributes, add Origin header check for high-risk ops.

### Architecture — Advisory

**A8. Crawlers directory structural debt** — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: `crawlers/scripts/` subdir exists and contains audit/one-off scripts. `crawlers/db/` submodule structure exists (`events.py`, `sources.py`, etc.), so the `db.py` monolith decomposition is no longer "in progress" — it's live. Remaining debt: confirming nothing still imports the legacy monolith path.

**A9. `tmp/` files not in .gitignore** — ✅ **FIXED**. Verified 2026-04-14: `.gitignore` now includes `crawlers/tmp/`, `crawlers/reports/*.{html,json,csv,md,txt}`, `crawl_assessment*.txt`, `web/tmp/`, `reports/`, and `crawlers/reports/maintenance_checkpoints/`. All patterns from the original finding are covered.

**A10. Flat components directory** (`web/components/`) — 🟢 **STILL OPEN**. Verified 2026-04-14: `web/components/` now has 186 entries (grew from 170+). Some subdirs exist (`feed/`, `detail/`, `ui/`, `cards/`, `filters/`, `headers/`) but bulk of files are still in the root. Group by domain continues to be the right refactor.

**A11. `lib/supabase.ts` vs `lib/supabase/` ambiguity** — 🟢 **STILL OPEN**. Verified 2026-04-14: `web/lib/supabase.ts` still exists (305 lines) alongside `web/lib/supabase/` directory containing `client.ts`, `server.ts`, `service.ts`, `database.types.ts`. Move types into directory, eliminate standalone file.

**A12. Client/server module split inconsistency** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Not re-verified in this audit pass. Audit `lib/*.ts` for server-only imports used from client components.

### Performance — Advisory

**P1. Nunito font loaded globally** (`web/app/layout.tsx`) — ✅ **FIXED**. Verified 2026-04-14: `grep -n "Nunito" web/app/layout.tsx` returns nothing. Font is no longer loaded globally.

**P2. ClientEffects on every page** — 🟢 **STILL OPEN**. Verified 2026-04-14: `web/app/layout.tsx:16` still imports `ClientEffects` and renders it at line 153 in the root layout. RainEffect/CursorGlow payload on every page. Move to home/feed pages only.

**P3. 5,495-line globals.css** — 🟢 **STILL OPEN — WORSE**. Verified 2026-04-14: `wc -l web/app/globals.css` now returns 7602 lines, up from 5495. The file has grown, not shrunk. Split portal themes and animations into route-level imports.

**P4. Home page ScrollReveal observers** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Not re-verified in this audit pass; the hero home page structure has shifted since the finding was filed and IntersectionObserver usage may have moved. Use single parent with CSS animation-delay.

**P5. No hero image preload** (`web/app/page.tsx`) — 🟢 **STILL OPEN — NEEDS VERIFICATION**. No `priority` prop or `<link rel="preload">` detected on quick scan, but the hero structure has changed substantially. Verify against current landing hero before fixing.

**P6. date-fns not in optimizePackageImports** — ✅ **FIXED**. Verified 2026-04-14: `web/next.config.ts:170` contains `optimizePackageImports: ["@phosphor-icons/react", "date-fns"]`.

**P7. qrcode.react in main bundle** — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: `FindFriendsContent.tsx` uses dynamic import (`() => import("qrcode.react").then(...)`), but `OutingShareModal.tsx`, `ItineraryShareModal.tsx`, and `app/[portal]/admin/qr/page.tsx` still use static imports. Convert remaining three to dynamic.

**P8. Crawler parallelism capped at 2** (`crawlers/main.py`) — 🟢 **STILL OPEN**. Verified 2026-04-14: `crawlers/main.py:80` still has `MAX_WORKERS = 2  # Number of concurrent crawlers (reduced to avoid macOS socket limits)`. Adaptive worker logic exists (`get_recommended_workers()`) but the ceiling is still 2. Increase to 5-8 on prod server.

**P9. insert_event 3-5 DB roundtrips per event** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Reference path changed (`crawlers/db.py` → `crawlers/db/events.py`) with the db module decomposition. Not re-profiled in this audit pass. Batch inserts, pre-fetch place data.

**P10. Conservative CDN caching** — 🟡 **PARTIALLY FIXED**. Verified 2026-04-14: Newer API routes already use longer windows (`/api/series/[slug]` and `/api/organizations` use `s-maxage=300, stale-while-revalidate=600`). Not all public APIs audited — likely uneven. Continue increasing `s-maxage` for stable public APIs.

**P11. Portal layout double-fetch** (`web/app/[portal]/layout.tsx`) — 🟢 **STILL OPEN**. Known Next.js limitation. Remove fallback retry logic post-B2B migration.

**P12. Service client singleton persistence** (`web/lib/supabase/service.ts`) — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Monitoring item; no evidence of stale-connection incident, but no new mitigation either.

---

## Crawler & Pipeline Health

Migrated from SYSTEM_HEALTH_ROADMAP.md. Not urgent — the system works. But this is the investment that makes 500+ sources sustainably maintainable. Address after initial sales push.

> **Audit note:** This section was spot-checked rather than fully re-verified. Items CH1–CH4, PV1–PV3, and SM1–SM4 were not individually grepped against the current crawler code. Based on recent commits and `docs/superpowers/` plan inventory, no dedicated source-health dashboard has shipped, so these are most likely still open. If you're fixing one of them, re-verify first.

**Principle**: Every time we touch the database to fix data by hand, ask: "What validation rule or crawler fix would prevent this from happening again?" Then do that instead.

### Crawler-Level Health

**CH1. Zero-event runs silently succeed** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Should warn, not pass silently.

**CH2. No per-source output baselines** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Track events_found over time. Significant drops = site likely changed.

**CH3. No auto-disable for broken crawlers** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Auto-disable after N consecutive failures, surface for repair.

**CH4. Silent garbage production** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Crawler output should fail loudly with clear errors, not silently produce garbage.

### Pipeline-Level Validation

**PV1. Weak pre-insert validation** (`crawlers/db/events.py` — formerly `crawlers/db.py`) — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Validate date sanity, place existence (formerly "venue existence"), category validity before `insert_event()`, not just title. Note path drift: `crawlers/db.py` is now `crawlers/db/events.py` after the db module decomposition.

**PV2. No rejection logging with attribution** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Log "crawler X produced Y rejected events" as signal to fix crawler.

**PV3. Validation rules not additive** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Every manual data fix should produce a new validation rule preventing that class of error upstream.

### System-Level Monitoring

**SM1. No source health dashboard** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Need: active / degrading / broken / disabled per source.

**SM2. No trend tracking** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. events_found, events_new, rejection_rate over time per source.

**SM3. No anomaly alerts** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. Source that usually finds 50 events now finds 3 should trigger alert.

**SM4. No weekly digest** — 🟢 **STILL OPEN — NEEDS VERIFICATION**. "5 sources degraded, 2 broke, 488 healthy" summary.
