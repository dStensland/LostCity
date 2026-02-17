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
- `venues` - Normalized venue data with aliases
- `events` - Core event data with foreign keys to sources/venues
- `crawl_logs` - Crawler run history for monitoring

## Environment Variables

Required in `.env`:
- `SUPABASE_URL`, `SUPABASE_KEY` - Database connection
- `ANTHROPIC_API_KEY` - For LLM extraction

Optional:
- `TICKETMASTER_API_KEY` - For Ticketmaster source
- `EVENTBRITE_API_KEY`, `MEETUP_API_KEY` - Reserved for API access

## Adding a New Source

### Full flow (venue with crawlable events page)

1. **Research** — Fetch the site, identify platform (Shopify, Wix, WordPress, etc.), find the events/classes URL, note the HTML structure
2. **Migration** — Create `database/migrations/NNN_source_name.sql` with:
   - Source INSERT (`sources` table): slug, name, url, source_type (`venue` or `organization`), crawl_frequency, is_active, integration_method
   - Venue INSERT (`venues` table): name, slug, address, neighborhood, city, state, zip, lat, lng, venue_type, spot_type, website, phone, description, vibes
3. **Crawler** — Create `crawlers/sources/source_slug.py` (underscores, matching the source slug with hyphens → underscores). Must export `crawl(source: dict) -> tuple[int, int, int]`. See `crawlers/CLAUDE.md` for the full pattern and required fields.
4. **Profile** — Create `crawlers/sources/profiles/source-slug.yaml` with discovery URLs, selectors, and defaults
5. **Test** — `python main.py --source source-slug`

### Venue only (no crawlable events page)

For venues where events are promoted via Instagram, Resy, or other non-scrapeable channels:

1. **Migration** — Same as above, but set `is_active = false` and `integration_method = 'none'` on the source
2. **No crawler file, no profile** — The venue record is the value. Events can be added manually or via future integrations.

### Organization (hosts events at various venues)

For orgs like community groups that host events at rotating locations:

1. **Migration** — Source with `source_type = 'organization'`. No venue INSERT (events happen at other venues).
2. **Crawler** — Set `venue_id = None` on events. Use `venue_name_hint` and `venue_address_hint` fields for downstream venue matching.
3. **Profile** — Same as full flow.

### Naming conventions

- Source slug: `tio-luchos` (hyphens)
- Crawler file: `tio_luchos.py` (underscores)
- Profile file: `tio-luchos.yaml` (hyphens)
- Migration file: `NNN_tio_luchos.sql` (sequential number + underscores)
