# Repository Guidelines

## Project Structure & Module Organization
- `crawlers/` houses the Python ingestion pipeline. Source-specific crawlers live in `crawlers/sources/`, orchestration is in `crawlers/main.py`, and shared logic is in `crawlers/extract.py`, `crawlers/dedupe.py`, and `crawlers/db.py`.
- `web/` is the Next.js frontend (App Router). Pages are under `web/app/`, shared UI in `web/components/`, and utilities in `web/lib/`.
- `database/` contains Supabase/Postgres schema and migrations (e.g., `database/schema.sql`, `database/migrations/`).
- Repo-level docs: `README.md`, `SOURCES.md`, and crawler playbooks.

## Build, Test, and Development Commands
### Crawlers
```bash
cd crawlers
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
python main.py              # run all crawlers
python main.py --source the-earl  # run one source
python main.py --list        # list sources
python main.py --dry-run     # fetch without saving
pytest                       # tests
ruff check .                 # lint
black --check .              # formatting
```

### Web
```bash
cd web
npm install
npm run dev    # local dev server
npm run build  # production build
npm run lint   # ESLint
npm run seed   # seed staging data
npm run seed:clear  # clear seeded data
```

## Coding Style & Naming Conventions
- Python: 4-space indentation, follow `black` formatting and `ruff` rules. Source modules use snake_case filenames (e.g., `atlanta_opera.py`).
- TypeScript/React: 2-space indentation, follow ESLint defaults. Components use PascalCase (e.g., `EventCard.tsx`).
- Keep crawler source IDs consistent with `SOURCE_MODULES` in `crawlers/main.py`.

## Testing Guidelines
- Python tests live in `crawlers/tests/` and use `pytest`. Name tests `test_*.py` with clear, behavior-focused test names.
- No frontend test suite is configured; for UI changes, add manual verification steps and screenshots in PRs.
- No explicit coverage target; add tests for new extraction, dedupe, or DB logic when feasible.

## Commit & Pull Request Guidelines
- Commit messages in history follow short, imperative summaries (e.g., `Add Special Events page to Plaza Theatre crawler`, `Implement Phase 1-2 UX audit fixes`). Keep them concise and action-oriented.
- PRs should include: a brief summary, testing notes (commands run), and screenshots for UI changes. Link related issues or backlog items when available.

## Configuration & Secrets
- Copy `.env.example` to `.env` at the repo root and set `SUPABASE_URL`, `SUPABASE_KEY`, and `ANTHROPIC_API_KEY`. Optional API keys (e.g., Ticketmaster) unlock specific sources.
- Initialize Supabase with `database/schema.sql` before running crawlers.
