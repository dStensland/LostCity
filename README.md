# Lost City

AI-powered event discovery for Atlanta. We crawl, extract, and deduplicate event data from 20+ sources to produce a comprehensive, accurate event feed.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (for database)
- OpenAI or Anthropic API key (for LLM extraction)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/yourusername/lostcity.git
cd lostcity
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
lostcity/
├── crawlers/           # Python event crawlers
│   ├── sources/        # Individual source crawlers
│   ├── config.py       # Configuration management
│   ├── extract.py      # LLM-based event extraction
│   ├── dedupe.py       # Deduplication logic
│   ├── db.py           # Database operations
│   └── main.py         # CLI entry point
├── web/                # Next.js frontend
│   ├── app/            # App router pages
│   ├── components/     # React components
│   └── lib/            # Utilities
├── database/           # SQL schemas
└── .github/workflows/  # GitHub Actions
```

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

1. **Crawl**: Fetch event listings from source websites/APIs
2. **Extract**: Use the configured LLM provider to extract structured event data from raw HTML/text
3. **Normalize**: Standardize venues, dates, categories
4. **Dedupe**: Identify and merge duplicate events
5. **Store**: Save to Postgres via Supabase
6. **Display**: Serve via Next.js frontend

## Event Categories

- `music` - Concerts, live performances
- `art` - Gallery openings, exhibitions
- `comedy` - Stand-up, improv
- `theater` - Plays, musicals
- `film` - Screenings, festivals
- `sports` - Games, matches
- `food_drink` - Tastings, pop-ups
- `nightlife` - Club events, DJ sets
- `community` - Meetups, markets
- `fitness` - Classes, runs
- `family` - Kid-friendly events
- `other` - Everything else

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT
