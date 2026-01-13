# Lost City

AI-powered event discovery for Atlanta. We crawl, extract, and deduplicate event data from 20+ sources to produce a comprehensive, accurate event feed.

## Quick Start

### Prerequisites

- Python 3.11+
- Node.js 18+
- Supabase account (for database)
- Anthropic API key (for LLM extraction)

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
python main.py                    # Run all active crawlers
python main.py --source eventbrite  # Run specific source
```

**Web app:**
```bash
cd web
npm run dev
```

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

## Data Flow

1. **Crawl**: Fetch event listings from source websites/APIs
2. **Extract**: Use Claude to extract structured event data from raw HTML/text
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
