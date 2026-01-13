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
- `main.py` orchestrates crawling via `SOURCE_MODULES` registry
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

## Adding a New Crawler

1. Create `crawlers/sources/source_name.py` with `crawl(source)` function
2. Add mapping to `SOURCE_MODULES` in `main.py`
3. Add source record to `sources` table in database
