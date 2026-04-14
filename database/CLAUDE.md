# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lost City is an AI-powered event discovery platform for Atlanta. It crawls 20+ event sources, extracts structured data using Claude, deduplicates events, and serves them via a Next.js frontend.

## Repository Structure

This is a monorepo with three main components:
- `crawlers/` - Python event crawlers with LLM extraction
- `web/` - Next.js frontend (React 19, Tailwind 4)
- `database/` - PostgreSQL schema for Supabase

## Commands

### Crawlers (Python)
```bash
cd crawlers
source venv/bin/activate

# Run all active crawlers
python main.py

# Run specific source
python main.py --source the-earl
python main.py -s eventbrite

# List available sources
python main.py --list

# Dry run (fetch but don't save)
python main.py --dry-run

# Run tests
pytest

# Lint
ruff check .
black --check .
```

### Web (Next.js)
```bash
cd web
npm run dev      # Development server
npm run build    # Production build
npm run lint     # ESLint
```

### Database
Run `database/schema.sql` in Supabase SQL Editor to initialize tables.

## Architecture

### Data Flow
1. **Crawl**: Source-specific crawlers in `crawlers/sources/` fetch raw HTML/JSON
2. **Extract**: `extract.py` sends content to Claude for structured extraction
3. **Normalize**: Venues matched, dates standardized, categories assigned
4. **Dedupe**: `dedupe.py` identifies duplicate events using content hashing
5. **Store**: `db.py` saves to Postgres via Supabase
6. **Display**: Next.js frontend queries Supabase directly

### Crawler Architecture
- Each source has a module in `crawlers/sources/` with a `crawl(source)` function
- `main.py` auto-discovers crawlers by matching source slugs to filenames (hyphens → underscores: `the-earl` → `sources/the_earl.py`). Edge cases use `SOURCE_OVERRIDES` in `main.py`.
- Crawl logs track each run in `crawl_logs` table
- Methods: HTML scraping (BeautifulSoup), JSON-LD parsing, Playwright for JS sites

### Event Extraction
- Claude extracts structured JSON from raw content
- Schema in `extract.py`: title, dates/times, venue, category, pricing
- Categories: music, art, comedy, theater, film, sports, food_drink, nightlife, community, fitness, family, other

### Database Schema (Supabase/PostgreSQL)
- `sources` - Event source configurations
- `places` - Normalized destination/venue data with aliases (renamed from `venues` in 2026-03; PostGIS `location` geography column for spatial queries)
- `events` - Core event data with foreign keys to sources/places
- `crawl_logs` - Crawler run history for monitoring

## Multi-Agent Coordination

When multiple Claude Code sessions work in parallel, check `ACTIVE_WORK.md` in the repo root before starting. It tracks which agent is working on what and which files/directories are claimed.

**Rules for parallel agents:**
1. Read `ACTIVE_WORK.md` before starting work. If another agent claims a file or directory, don't touch it.
2. When you start a task, ask the user to update `ACTIVE_WORK.md` with your assignment (or update it yourself if instructed to).
3. When you finish, ask the user to clear your entry from `ACTIVE_WORK.md`.
4. If you need to touch a claimed file, stop and tell the user — they'll coordinate.
5. Prefer generating new migration pairs with:
   `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py your_migration_name`
6. If you create files manually, always check the latest migration number before creating a new one to avoid collisions. Use `ls database/migrations/ | tail -5` to find the next number.
7. Every schema/data migration that matters to deploys must exist in both tracks: `database/migrations/` and `supabase/migrations/`.
8. Before finishing migration-heavy work, run the parity audit:
   `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched`
9. Prefer working in git worktrees (`/worktree`) for isolation when touching shared files.

See `DEV_PLAN.md` for the active execution status. (Historical roadmap archived to `docs/archive/root-strategy-2026-Q1/BACKLOG.md`.)

## Migration Numbering

`database/migrations/` files use sequential numeric prefixes (`NNN_description.sql`). 108+ numbering collisions exist from parallel agent work — they are harmless in production because Supabase runs the `supabase/migrations/` timestamp-based files, not the numbered ones. But avoid creating new collisions.

**Before creating a migration manually:**
```bash
ls /Users/coach/Projects/LostCity/database/migrations/*.sql | sort -t_ -k1 -n | tail -1
```
Use the next sequential number after whatever that returns.

**Preferred: use the scaffolding script**, which handles numbering automatically:
```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py your_migration_name
```

**Parallel agents:** Check `ACTIVE_WORK.md` before picking a number. If two agents are working simultaneously, coordinate — each agent should claim a number range or one agent should defer until the other's migration is committed.

`supabase/migrations/` uses `YYYYMMDDHHMMSS_description.sql` timestamps and does not have a collision risk.

## Environment Variables

Required in `.env`:
- `SUPABASE_URL`, `SUPABASE_KEY` - Database connection
- `ANTHROPIC_API_KEY` - For LLM extraction

Optional:
- `TICKETMASTER_API_KEY` - For Ticketmaster source
- `EVENTBRITE_API_KEY`, `MEETUP_API_KEY` - Reserved for API access

## Adding a New Source

### Full flow (venue with crawlable events page)

> **Portal attribution is mandatory.** Every active source MUST have `owner_portal_id` set in the migration. The CHECK constraint on the sources table enforces this — you cannot set `is_active = true` without an owner. Use `(SELECT id FROM portals WHERE slug = 'atlanta')` for Atlanta sources. Events automatically inherit `portal_id` from their source's `owner_portal_id` via a database trigger.

1. **Research** — Fetch the site, identify platform (Shopify, Wix, WordPress, etc.), find the events/classes URL, note the HTML structure. Also look for: specials/happy hour pages, hours of operation, recurring programming (trivia, DJ nights, etc.), about/description text, hero images.
2. **Migration** — Prefer `python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py source_name` to scaffold both files, then fill in:
   - Source INSERT (`sources` table): slug, name, url, source_type (`venue` or `organization`), crawl_frequency, is_active, integration_method
   - Place INSERT (`places` table): name, slug, address, neighborhood, city, state, zip, lat, lng, place_type, spot_type, website, phone, description, vibes. Set `is_active = true`. The `location` geography column is auto-populated by trigger from lat/lng.
   - Matching `supabase/migrations/YYYYMMDDHHMMSS_source_name.sql` with the same SQL body unless there is an explicit documented reason not to
3. **Crawler** — Create `crawlers/sources/source_slug.py` (underscores, matching the source slug with hyphens → underscores). Must export `crawl(source: dict) -> tuple[int, int, int]`. See `crawlers/CLAUDE.md` for the full pattern and required fields. **The crawler should capture everything in one pass:** events, recurring programming (as series), specials (to `venue_specials`), hours, venue description/image. Don't leave data on the page for a later enrichment script to pick up.
4. **Profile** — Create `crawlers/sources/profiles/source-slug.yaml` with discovery URLs, selectors, and defaults
5. **Test** — `python main.py --source source-slug`
6. **Parity check** — `python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched`

### Venue only (no crawlable events page)

For venues where events are promoted via Instagram, Resy, or other non-scrapeable channels:

1. **Migration** — Same as above, but set `is_active = false` and `integration_method = 'none'` on the source
2. **No crawler file, no profile** — The venue record is the value. Events can be added manually or via future integrations.

### Organization (hosts events at various venues)

For orgs like community groups that host events at rotating locations:

1. **Migration** — Source with `source_type = 'organization'`. No venue INSERT (events happen at other venues).
2. **Crawler** — Set `place_id = None` on events. Use `venue_name_hint` and `venue_address_hint` fields for downstream place matching.
3. **Profile** — Same as full flow.

### Naming conventions

- Source slug: `tio-luchos` (hyphens)
- Crawler file: `tio_luchos.py` (underscores)
- Profile file: `tio-luchos.yaml` (hyphens)
- Migration file: `NNN_tio_luchos.sql` (sequential number + underscores)

## Recent Architectural Shifts (as of 2026-04-14)

When working on database changes, be aware these landed recently and older docs may not reflect them:

- **`venues` → `places` rename** (`20260328200001_places_final_rename.sql`). The table is now `places`. `venue_type` is now `place_type`. `active` is now `is_active`. All foreign keys renamed: `events.venue_id → events.place_id`, `series.venue_id → series.place_id`, etc. Code is fully migrated; if you find a doc, comment, or migration that still says `venues`, update it.
- **PostGIS spatial column** (`20260328100001_places_refactor_foundation.sql`). `places.location` is a `geography(Point, 4326)` auto-populated by trigger from `lat`/`lng`. Use it for spatial queries (`ST_DWithin`, etc.); don't recompute distance from raw lat/lng.
- **Portal isolation enforcement.** Sources have `owner_portal_id NOT NULL` enforced by CHECK constraint. Events inherit `portal_id` from their source via DB trigger. Cross-portal queries should use the portal_id column, never join through sources.
- **`search_unified()` RPC** (`20260413000007_search_unified.sql`). Single point-of-control for search across events + places. **Always pass `p_portal_id`** — portal isolation is enforced inside the RPC. Do not write new search queries that bypass this. Filter args: `p_query`, `p_portal_id`, `p_categories`, `p_neighborhoods`, `p_date_from`, `p_date_to`. Returns events and places in a unified result shape.
- **`exhibitions` table is first-class — mechanically so.** Has its own `search_vector` (`20260413100001_exhibitions_search_vector.sql`) and is wired into `search_unified()` via exhibition CTEs (commit `bd9cd223`). The `events.exhibition_id` FK shipped 2026-04-14 (`20260413100003_events_exhibition_id.sql`, commit `838b9052`) — opening nights, artist talks, and other exhibition-related events set `exhibition_id` to link to the parent exhibition. `content_kind='exhibit'` is **deprecated** (see `crawlers/ARCHITECTURE.md` and commit `89026d9b`); the filter on feed/event queries remains only as protection for legacy rows. **Do not create new `content_kind='exhibit'` rows.** New exhibitions go directly in the `exhibitions` table.
