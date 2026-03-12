# Repository Guidelines

**Read `.claude/north-star.md` before every task.** It defines the mission, core bets, decision filters, and working style. If your work doesn't serve those priorities, stop and ask why.

## What We Are

LostCity is a **local discovery data infrastructure** company. Three first-class entity types: **Events** (temporal), **Destinations** (persistent), **Programs** (structured activities). The data layer is the product — portals are generated surfaces.

We build a constellation of **first-party content pillar portals** (Citizen, Family, Adventure, Arts, Sports) that each produce unique entity types, plus **distribution portals** (hotels, hospitals) for B2B customers. Each content pillar enriches the shared data layer. A portal that's just a filtered view isn't a content pillar.

**The B2B platform funds the mission. The consumer product IS the mission.** Every portal ships consumer-ready or doesn't ship.

## Project Structure

- `crawlers/` — Python ingestion pipeline. 1,000+ source crawlers in `crawlers/sources/`, orchestration in `crawlers/main.py`, shared logic in `crawlers/db.py`, `crawlers/extract.py`, `crawlers/dedupe.py`.
- `web/` — Next.js 16 frontend (App Router). Pages under `web/app/`, shared UI in `web/components/`, utilities in `web/lib/`.
- `database/` — Supabase/Postgres schema and migrations (`database/schema.sql`, `database/migrations/`).
- `.claude/north-star.md` — Mission, core bets, decision filters. **Read this first.**
- `STRATEGIC_PRINCIPLES.md` — Hypotheses and strategic principles.
- `DEV_PLAN.md` — Active phases and status.

**Domain-specific guidance:**
- `web/CLAUDE.md` — Auth patterns, API routes, security, **design system contract**, **shipping standards**. Read before any web work.
- `crawlers/CLAUDE.md` — Crawler patterns, data requirements, **first-pass capture rules**. Read before any crawler work.

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
npx tsc --noEmit  # MUST pass before any PR
npx vitest run    # tests
```

## Coding Style & Naming Conventions

- **Python**: 4-space indentation, `black` formatting, `ruff` rules. Source modules use snake_case (e.g., `atlanta_opera.py`).
- **TypeScript/React**: 2-space indentation, ESLint defaults. Components use PascalCase (e.g., `EventCard.tsx`).
- Keep crawler source IDs consistent with `SOURCE_MODULES` in `crawlers/main.py`.

## Testing Guidelines

- Python tests in `crawlers/tests/`, use `pytest`. Name tests `test_*.py`.
- Frontend tests use Vitest from `web/`. Run targeted tests for touched contracts.
- No coverage target; add tests for new extraction, dedupe, DB logic, and API routes.

## Commit & Pull Request Guidelines

- Commit messages: short, imperative summaries (e.g., `Add Special Events page to Plaza Theatre crawler`).
- PRs: brief summary, testing notes, screenshots for UI changes. Link related issues.

## Configuration & Secrets

- Copy `.env.example` to `.env` and set `SUPABASE_URL`, `SUPABASE_KEY`, `ANTHROPIC_API_KEY`. Optional API keys unlock specific sources.
- Initialize Supabase with `database/schema.sql` before running crawlers.

---

## Shipping Standards (No Smoke and Mirrors)

**The #1 failure mode is code that compiles but doesn't actually work.** Components that reference non-existent APIs, sections with hardcoded data, CSS that looks right in code but renders wrong in the browser.

### Before ANY Work Is "Done"

1. **Data layer exists and returns real data.** Before building UI, verify the API route exists, the DB columns exist, and the query returns actual rows. If the data layer doesn't exist, build it first or don't build the UI.

2. **No hardcoded or placeholder data in production components.** No `const MOCK_DATA = [...]` outside test files. No fallback data masking empty API responses. If a section has no data, render nothing or a proper empty state.

3. **Browser-verified.** Load the page in a browser. Check text renders at expected size (not 16px fallback). Check colors match tokens. Check mobile viewport (375px). Check empty states.

4. **TypeScript builds clean.** Run `npx tsc --noEmit` for the FULL project.

5. **Portal-aware.** Works on Atlanta (base), FORTH (hotel), HelpATL (civic). No cross-portal data leakage.

### Data-First Rule

Never build a UI section before its data layer is confirmed working. The correct order:
1. Verify the database has the data (query it)
2. Verify the API route returns it (curl it)
3. Build the component that renders it
4. Browser-test the result

---

## Crawler Standards (First-Pass Capture)

**Do not build a crawler that only grabs events.** Every time we touch a venue's website, extract ALL available signal in one pass:

1. Events
2. Programs (classes, camps, lessons — with age ranges)
3. Recurring programming (trivia, DJ nights, open mic → series)
4. Specials & deals (→ `venue_specials`, NOT events)
5. Hours of operation
6. Venue metadata (description, og:image, vibes, cuisine, price range)

**If you're about to write an enrichment script, stop.** Ask why the crawler didn't capture this. We've built 20+ enrichment scripts for data that crawlers should have captured originally. Fix the crawler instead.

---

## Design System Contract (Web)

Full reference in `web/CLAUDE.md`. Key rules:

### Typography (Tailwind v4)

| Class | Size | Use |
|-------|------|-----|
| `text-2xs` | 10px | Count badges only (custom `@utility`) |
| `text-xs` | 11px | Section headers, metadata |
| `text-sm` | 13px | Secondary content, descriptions |
| `text-base` | 15px | Card titles, body text |
| `text-lg` | 18px | Prominent titles |
| `text-xl`–`text-3xl` | 20–30px | Section/page headers |

**CRITICAL:** Never use `text-[var(--text-xs)]`. In Tailwind v4, `text-` with CSS variables generates `color:` not `font-size:`. Use bare classes: `text-xs`, `text-sm`, etc.

### Color Tokens

- **Surfaces** (bg/border only, NEVER text): `--void`, `--night`, `--dusk`, `--twilight`
- **Text hierarchy**: `--cream` (primary), `--soft` (secondary), `--muted` (tertiary minimum)
- **Accents**: `--coral` (CTA), `--gold` (featured), `--neon-green` (free/success)
- Never hardcode hex colors. Never use `text-white` or `bg-gray-*` when tokens exist.

### Component Reuse

Check `components/ui/` (Badge, Dot, CountBadge, Button, DialogFooter), `components/detail/`, `components/feed/` before building from scratch. Copy proven patterns from `web/CLAUDE.md` component recipes.

---

## Non-Negotiable Rules

### Portal Contract and Scope

1. `portal` is a slug only; `portal_id` is UUID only.
2. If both present, must resolve to same portal or return `400`.
3. Use shared portal scope helpers (no ad-hoc inline filters).
4. Public records (`portal_id IS NULL`) require explicit city guardrails.
5. Any behavior write route must resolve attribution via shared guard.

### Surface Separation

1. Every change must declare surface: `consumer`, `admin`, or `both`.
2. Consumer screens cannot expose admin concepts.
3. If `both`, acceptance criteria must be separate per surface.

### Data Ownership and Federation

1. Facts are global; preferences are portal-local.
2. Never silo enrichment that should benefit the network.
3. Fix recurring data defects upstream, not manually in DB.
4. Schema changes require: new migration in `database/migrations/`, matching migration in `supabase/migrations/`, updated `database/schema.sql`.

### Event Presentation Contract

1. Participant sections are event-type aware (music→artists, sports→teams, comedy→comics).
2. Never synthesize participants from event title tokenization.
3. If structured participant data missing, omit section rather than fabricating.

---

## Working Style

- **Be a critical partner.** Challenge ideas that don't serve the north star. No sycophancy.
- **Challenge the strategy, not just the code.** If a principle in `north-star.md`, `STRATEGIC_PRINCIPLES.md`, or `DEV_PLAN.md` isn't working in practice or has diverged from reality — flag it and propose a specific update. Strategy that doesn't match reality sends agents in the wrong direction.
- **Surface decisions at the strategic level.** Handle technical details autonomously unless there's a meaningful tradeoff.
- **Scope discipline.** Do what was asked. Don't gold-plate. Note adjacent issues separately.
- **No planning-as-progress.** Docs and roadmaps don't substitute for shipping.

---

## Verification Matrix (Run What Applies)

### Portal scope / attribution / API behavior
```bash
cd web && npx vitest run lib/portal-scope.test.ts lib/portal-attribution-guard.test.ts lib/portal-query-context.test.ts
```

### Header/menu layering regressions
```bash
cd web && npx vitest run components/__tests__/header-z-index.test.ts
```

### Crawler extraction/dedupe/normalization
```bash
cd crawlers && pytest
```

### Full web checks
```bash
cd web && npm run lint && npx tsc --noEmit && npx vitest run
```
