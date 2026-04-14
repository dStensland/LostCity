# Lost City

Local discovery data infrastructure. Lost City crawls, extracts, and deduplicates data from 1000+ sources to produce comprehensive feeds of **events**, **places**, **programs**, and **exhibitions** across multiple portals (Atlanta is the primary consumer portal; Nashville and other cities are incremental). The data layer is the product — portals, APIs, widgets, and AI integrations are distribution surfaces. See `.claude/north-star.md` for the mission and `STRATEGIC_PRINCIPLES.md` for the principles.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 20+ (Next.js 16 / React 19)
- Supabase account (for database)
- Anthropic API key (Claude is the default LLM for extraction; OpenAI is optional)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/dStensland/LostCity.git
cd LostCity
```

2. Copy environment variables:
```bash
cp .env.example .env
# Edit .env with your API keys
```

3. Set up the database:
   - Create a new Supabase project
   - Run `database/schema.sql` in the SQL editor
   - For migration-heavy changes, keep `database/migrations/` and `supabase/migrations/` in parity and verify with:
```bash
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

4. Install crawler dependencies:
```bash
cd crawlers
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
playwright install chromium
```

5. Install web dependencies:
```bash
cd web
npm install
```

### Running

**Crawlers:**
```bash
cd crawlers
python main.py --db-target staging --dry-run            # Safe validation crawl (no DB writes)
python main.py --db-target production --allow-production-writes  # Live crawl
python main.py --source eventbrite --db-target staging  # Run specific source on staging
```

**Web app:**
```bash
cd web
npm run dev
```

## Launch Data Health Operations (Atlanta)

Primary operator runbook:
- `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md`

Fast path after crawler runs:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/post_crawl_maintenance.py --city Atlanta
```

Launch gate decision check:

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 scripts/launch_health_check.py --city Atlanta
```

Adding new venues/sources/crawlers:
- Use onboarding flow in `crawlers/scripts/RUNBOOK_LAUNCH_DATA_HEALTH.md` ("Onboard New Venues/Sources/Crawlers")

## Project Structure

```
LostCity/
├── crawlers/           # Python event/place/exhibition crawlers (1000+)
│   ├── sources/        # Individual source crawlers (~1200 files)
│   ├── db/             # Supabase operations package (places, events, exhibitions, place_specials, programs, …)
│   ├── config.py       # Configuration management
│   ├── extract.py      # LLM-based extraction (Claude)
│   ├── dedupe.py       # Deduplication logic
│   ├── ARCHITECTURE.md # Crawler data-model contract (authoritative)
│   └── main.py         # CLI entry point
├── web/                # Next.js 16 / React 19 frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   ├── lib/            # Utilities (entity-urls.ts, civic-routing.ts, …)
│   └── CLAUDE.md       # Frontend conventions and shipping standards
├── database/           # SQL schemas + migrations (repo track)
├── supabase/migrations/ # Supabase deploy track (mirror of database/migrations/)
├── docs/decisions/     # ADRs — see README in that folder for superseding convention
├── .claude/            # Agent definitions, shared architecture context, north star
└── .github/workflows/  # GitHub Actions
```

See the relevant `CLAUDE.md` file in each subdirectory (`web/`, `crawlers/`, `database/`) for domain-specific conventions. Agents should also load `.claude/north-star.md` and `.claude/agents/_shared-architecture-context.md` before any task.

## Migration Parity

LostCity uses two migration tracks:
- `database/migrations/` for repo-local database history
- `supabase/migrations/` for Supabase deploy history

When adding schema, source registration, portal provisioning, or data-healing migrations, mirror the change in both tracks in the same workstream. Use:

```bash
python3 /Users/coach/Projects/LostCity/database/create_migration_pair.py your_migration_name
python3 /Users/coach/Projects/LostCity/database/audit_migration_parity.py --fail-on-unmatched
```

The current cleanup status is documented in [reports/migration-front-cleanup-2026-03-11.md](/Users/coach/Projects/LostCity/reports/migration-front-cleanup-2026-03-11.md).

## Data Flow

1. **Crawl**: Fetch event/place/exhibition listings from source websites/APIs
2. **Extract**: Use Claude to extract structured data from raw HTML/text
3. **Normalize**: Standardize places (formerly `venues`), dates, categories, taxonomy
4. **Dedupe**: Identify and merge duplicate events via content hashing
5. **Store**: Save to Postgres via Supabase, with portal attribution enforced at the DB layer
6. **Display**: Serve via Next.js frontend using the `search_unified()` RPC as the single search entry point

## Entity Types

Lost City models four first-class entities:

- **Events** — temporal happenings (concerts, screenings, meetups). Stored in `events`.
- **Places** — persistent destinations (restaurants, bars, parks, museums, trails). Stored in `places` (renamed from `venues` in March 2026; PostGIS `location` column).
- **Programs** — structured activities with sessions and registration (swim lessons, summer camps, rec leagues).
- **Exhibitions** — persistent experiences at a place (gallery shows, museum exhibitions, aquarium habitats, historic site displays, park attractions). Cross-vertical, not Arts-specific. Stored in `exhibitions`.

Event taxonomy lives in `web/lib/` constants; see `.claude/north-star.md` and `docs/decisions/` for the categorization rationale.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
