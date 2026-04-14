# Shared Architecture Context

**For all LostCity agents.** This file captures the load-bearing architectural realities every agent should know before starting work. Read this in addition to `.claude/north-star.md` and the relevant `CLAUDE.md` files.

**Last refreshed:** 2026-04-14

## First-class entity types

The platform models four first-class nouns. All agent work should respect these distinctions; collapsing them is a category error.

- **Events** — Temporal. Stored in `events`. Crawled comprehensively. The `events.place_id` FK links to a place. The `events.exhibition_id` FK links an event to a parent exhibition (opening nights, artist talks, guided tours).
- **Places** — Persistent destinations. Stored in `places` (renamed from `venues` in March 2026). PostGIS `location` column auto-populated from `lat`/`lng`. The `place_type` field replaces `venue_type`. `place_specials` holds operating offers (happy hours, deals) — that table was co-renamed from `venue_specials`.
- **Programs** — Structured activities with sessions, age ranges, registration. Stored in their own table with cohort-aware fields. Swim lessons, summer camps, rec leagues, pottery classes.
- **Exhibitions** — Persistent experiences at a place, with optional run dates. Stored in `exhibitions`. Has its own `search_vector` and exhibition CTEs in `search_unified()`. **Cross-vertical, NOT Arts-specific.** Models gallery shows (Arts), aquarium habitats (Family), zoo exhibits (Family), museum attractions (all portals), historic site displays (civic/historic), park attractions (Adventure), permanent installations. Any portal with museums, aquariums, historic sites, or parks should be producing exhibitions, not events with `content_kind='exhibit'`.

## Canonical patterns

- **URL building → `web/lib/entity-urls.ts`.** Public API: `buildEventUrl(id, portal, context)`, `buildSpotUrl(slug, portal, context)`, `buildSeriesUrl(slug, portal, seriesType?)`, `buildFestivalUrl(slug, portal)`, `buildExhibitionUrl(slug, portal)`, `buildArtistUrl(slug, portal)`, `buildOrgUrl(slug, portal)`. Only `buildEventUrl` and `buildSpotUrl` take a `LinkContext` arg (`'feed' | 'page'`); `'feed'` returns an overlay URL, `'page'` returns the canonical detail page URL. Standalone detail pages must pass `'page'`. Other builders are always canonical (no overlay mode). Civic events pre-check via `getCivicEventHref()` from `lib/civic-routing.ts` before calling `buildEventUrl`.
- **Search → `search_unified()` RPC.** Single point of entry. Pass `p_portal_id` always (required, NOT NULL) — portal isolation is enforced inside the RPC. The `p_types` arg is also required (e.g. `ARRAY['events','places']`). Optional args: `p_categories`, `p_neighborhoods`, `p_date_from`, `p_date_to`, `p_free_only`, `p_limit_per_retriever`. The legacy unified-search stack was deleted; do not write code against it.
- **Mutations → API routes only.** Never client-side Supabase mutations from React components. Use `withAuth` / `withAuthAndParams` wrappers in `lib/api-middleware.ts`.
- **Portal attribution → `sources.owner_portal_id` is `NOT NULL` + CHECK-constrained.** Events inherit `portal_id` via DB trigger. Cross-portal data leakage is a P0 trust failure.
- **Server-loader pattern → mandatory.** Pages and RSCs import server loaders directly. API routes wrap the same loaders. Never fetch your own API from the server.

## Transitional state (verify before extending)

- **`content_kind='exhibit'` is deprecated.** The `events.exhibition_id` FK shipped 2026-04-14 (commit `838b9052`); exhibitions are now first-class end-to-end. The feed-query filter on `content_kind='exhibit'` remains as protection for legacy rows, but **new code must never set this flag**. Link exhibition-related events via `exhibition_id`. New exhibitions — whether arts, family, adventure, or civic/historic — go directly in the `exhibitions` table.
- **`exhibition_type` enum is arts-biased.** Currently `('solo','group','installation','retrospective','popup','permanent')`. Works for Arts-portal exhibitions; will need expansion (`attraction`, `habitat`, `interactive`, `historical_display`) as non-arts portals start producing exhibitions. Track as follow-up.
- **TECH_DEBT.md** was last audited 2026-03-05 and may be partially stale. Verify before treating any item as current.

## Where to look

- **Mission and priorities:** `.claude/north-star.md` (always check before starting work)
- **Active execution status:** `DEV_PLAN.md`
- **Strategic principles:** `STRATEGIC_PRINCIPLES.md`
- **Live agent claims (parallel work):** `ACTIVE_WORK.md`
- **Decision records:** `docs/decisions/`
- **In-flight plans:** `docs/superpowers/plans/` (excluding `shipped/` subfolder)
- **Web frontend conventions:** `web/CLAUDE.md`
- **Crawler conventions:** `crawlers/CLAUDE.md` + `crawlers/ARCHITECTURE.md` (the data-model contract)
- **Database conventions:** `database/CLAUDE.md`
- **Archived/historical strategy docs:** `docs/archive/root-strategy-2026-Q1/`
