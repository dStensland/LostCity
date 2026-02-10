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

## 3. No CI pipeline (GitHub Actions)

There are no automated checks on push or PR. Tests, build verification, and lint all run locally only. The pre-commit hook catches issues before commit, but CI would catch issues from contributors and provide a safety net.

**Fix:** Add a GitHub Actions workflow running `npm run build`, `vitest run`, and `pytest` on PRs to `main`.

**Risk:** Low while solo, medium once others contribute.

---

## Pre-Beta Audit Findings (2026-02-08)

Findings from comprehensive security, architecture, and performance audits. Critical and High items were fixed; these are the remaining Important and Advisory items.

### Security

**S1. Rate limiting falls back to in-memory silently** (`web/lib/rate-limit.ts:167`) — When Upstash Redis is unavailable, each Vercel instance gets its own counter. Add logging + consider failing closed in production.

**S2. `unsafe-inline` in style-src CSP** (`web/lib/csp.ts:28`) — `DarkHoursTheme.tsx` uses `dangerouslySetInnerHTML` without nonce. Add nonce support, then remove `unsafe-inline`.

**S3. Email addresses logged in plain text** (`web/app/api/find-friends/send-invites/route.ts:131`) — Redact to `email.slice(0,3)***`.

**S4. `img-src` CSP allows all HTTPS** (`web/lib/csp.ts`) — Intentional decision. We pull event/venue images from 500+ crawled domains; an allowlist breaks images silently every time a new source is added. The security value of `img-src` restrictions is minimal (no XSS/clickjacking risk from images). Do not tighten — focus CSP hardening on `script-src` and `frame-ancestors` instead.

**S5. Admin users route uses user-session client** (`web/app/api/admin/users/route.ts`) — Should use `createServiceClient()` after `isAdmin()` check.

**S6. Seed scripts contain test passwords** (`web/scripts/seed-staging.ts:531`) — Add env check to refuse production runs.

**S7. Hardcoded OMDB API key default** (`crawlers/config.py:40`) — Default to empty string instead of `"trilogy"`.

### Architecture

**A1. No API route tests** — 139 route files, zero coverage. Prioritize: `/api/rsvp`, `/api/saved`, `/api/auth/profile`, `/api/follow`.

**A2. `sanitizeKey()` duplicated 5 times** — Extract to `web/lib/supabase/utils.ts`.

**A3. 660-line hardcoded `SOURCE_MODULES`** (`crawlers/main.py:56`) — Switch to `auto_discover_modules()` with small override dict.

**A4. Logger not wired to Sentry** (`web/lib/logger.ts:33`) — API errors vanish after Vercel's 1hr log retention.

**A5. Deprecated `datetime.utcnow()`** (`crawlers/db.py`) — Replace with `datetime.now(timezone.utc)`.

**A6. Crawler test coverage minimal** (`crawlers/tests/`) — Prioritize `insert_event()`, `validate_event()`, `generate_content_hash()`.

**A7. Verify CSRF protection** — No explicit CSRF tokens on mutating endpoints. Verify SameSite cookie attributes, add Origin header check for high-risk ops.

### Architecture — Advisory

**A8. Crawlers directory structural debt** — 150+ files in root, many one-off scripts. Reorganize into `scripts/` subdirs.

**A9. `tmp/` files not in .gitignore** — Add `crawlers/tmp/`, `crawlers/reports/`, `crawl_assessment_*.txt`.

**A10. Flat components directory** (`web/components/`) — 170+ files. Group by domain (events/, filters/, etc).

**A11. `lib/supabase.ts` vs `lib/supabase/` ambiguity** — Move types into directory, eliminate standalone file.

**A12. Client/server module split inconsistency** — Audit `lib/*.ts` for server-only imports used from client components.

### Performance — Advisory

**P1. Nunito font loaded globally** (`web/app/layout.tsx:35`) — Only used by ATLittle portal (50-80KB waste). Move to conditional loading.

**P2. ClientEffects on every page** — RainEffect/CursorGlow in root layout. Move to home/feed pages only.

**P3. 5,495-line globals.css** — Split portal themes and animations into route-level imports.

**P4. Home page ScrollReveal observers** — ~15 IntersectionObservers. Use single parent with CSS animation-delay.

**P5. No hero image preload** (`web/app/page.tsx:63`) — Add `priority` prop or `<link rel="preload">`.

**P6. date-fns not in optimizePackageImports** — Add to `next.config.ts`.

**P7. qrcode.react in main bundle** — Ensure dynamic import.

**P8. Crawler parallelism capped at 2** (`crawlers/main.py:51`) — Increase to 5-8 on prod server.

**P9. insert_event 3-5 DB roundtrips per event** (`crawlers/db.py:693`) — Batch inserts, pre-fetch venue data.

**P10. Conservative CDN caching** — Increase `s-maxage` from 30s to 60-120s for public APIs.

**P11. Portal layout double-fetch** (`web/app/[portal]/layout.tsx`) — Known Next.js limitation. Remove fallback retry logic post-B2B migration.

**P12. Service client singleton persistence** (`web/lib/supabase/service.ts:24`) — Monitor for stale connections.

---

## Crawler & Pipeline Health

Migrated from SYSTEM_HEALTH_ROADMAP.md. Not urgent — the system works. But this is the investment that makes 500+ sources sustainably maintainable. Address after initial sales push.

**Principle**: Every time we touch the database to fix data by hand, ask: "What validation rule or crawler fix would prevent this from happening again?" Then do that instead.

### Crawler-Level Health

**CH1. Zero-event runs silently succeed** — Should warn, not pass silently.

**CH2. No per-source output baselines** — Track events_found over time. Significant drops = site likely changed.

**CH3. No auto-disable for broken crawlers** — Auto-disable after N consecutive failures, surface for repair.

**CH4. Silent garbage production** — Crawler output should fail loudly with clear errors, not silently produce garbage.

### Pipeline-Level Validation

**PV1. Weak pre-insert validation** (`crawlers/db.py`) — Validate date sanity, venue existence, category validity before `insert_event()`, not just title.

**PV2. No rejection logging with attribution** — Log "crawler X produced Y rejected events" as signal to fix crawler.

**PV3. Validation rules not additive** — Every manual data fix should produce a new validation rule preventing that class of error upstream.

### System-Level Monitoring

**SM1. No source health dashboard** — Need: active / degrading / broken / disabled per source.

**SM2. No trend tracking** — events_found, events_new, rejection_rate over time per source.

**SM3. No anomaly alerts** — Source that usually finds 50 events now finds 3 should trigger alert.

**SM4. No weekly digest** — "5 sources degraded, 2 broke, 488 healthy" summary.
