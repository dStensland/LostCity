# Remaining Gaps — Future Session Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the last edges identified in the Atlanta content audit — Instagram handle discovery, unmatched Eater restaurants, schema.sql cleanup, and nightclub coverage.

**Architecture:** Five independent tasks. Each follows an established pattern. No new infrastructure needed.

**Tech Stack:** Python, Google Places API, Google Custom Search, PostgreSQL

---

### Task 1: Automated Instagram Handle Discovery

**Context:** 55% of bars (167/310) and 71% of nightclubs (27/38) have no Instagram handle. Foursquare hydration only added 2 handles — it's not a reliable source. Need automated Google search to find handles.

**Files:**
- Create: `crawlers/scripts/discover_instagram_handles.py`

- [ ] **Step 1: Build a handle discovery script**

The script should:
1. Query places missing Instagram handles (`places.instagram IS NULL`)
2. For each, Google search `site:instagram.com "{venue_name}" "{city}"` 
3. Parse the first Instagram profile URL from results
4. Extract the handle from the URL
5. Validate it's a real venue account (not a personal account or aggregator)
6. Update `places.instagram` with the handle

Use either:
- Google Custom Search API (if key available in config)
- OR `requests` + BeautifulSoup to parse Google search results (rate-limited, may get blocked)
- OR the existing `WebSearch` pattern if one exists in the codebase

CLI: `--venue-type bar --limit 50 --dry-run`

- [ ] **Step 2: Run on bars**

```bash
python -m scripts.discover_instagram_handles --venue-type bar --limit 100 --dry-run
# If looks good:
python -m scripts.discover_instagram_handles --venue-type bar --limit 100
```

- [ ] **Step 3: Run on nightclubs**

```bash
python -m scripts.discover_instagram_handles --venue-type nightclub --limit 38
```

- [ ] **Step 4: Re-run Instagram scraper on newly-handled venues**

```bash
python3 scrape_instagram_specials.py --venue-type bar --no-specials --limit 100 --vision --chrome-cookies
python3 scrape_instagram_specials.py --venue-type nightclub --no-specials --limit 30 --vision --chrome-cookies
```

- [ ] **Step 5: Commit**

```bash
git add crawlers/scripts/discover_instagram_handles.py
git commit -m "feat(scripts): automated Instagram handle discovery via Google search"
```

**Target:** Get bar Instagram coverage from 55% to 80%+. Get nightclub coverage from 29% to 60%+.

---

### Task 2: Seed Unmatched Eater Restaurants

**Context:** The Eater Atlanta crawler matched 121 of 181 editorial mentions. 60 restaurants in Eater guides don't exist in our DB. These are high-signal restaurants (Eater featured them) that should be in the system.

**Files:**
- Modify: `crawlers/sources/eater_atlanta_guides.py`
- OR Create: `crawlers/scripts/seed_eater_unmatched.py`

- [ ] **Step 1: Extract the 60 unmatched restaurant names and addresses**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
# Run the Eater crawler in dry-run and capture unmatched names
# OR query the crawl logs for the last run's skip list
"
```

The Eater crawler logs which restaurants it skipped. Extract those names + addresses.

- [ ] **Step 2: Seed them via Google Places API**

For each unmatched restaurant:
1. Search Google Places for the name + "Atlanta"
2. If found with high confidence, create the place record via `get_or_create_place()`
3. Then re-run the Eater crawler to attach editorial mentions

```bash
# Use the existing restaurant seed script with targeted names
python -m scripts.seed_atlanta_restaurants --names-file /tmp/eater_unmatched.txt
```

Or build a targeted variant that takes a list of restaurant names instead of neighborhood queries.

- [ ] **Step 3: Re-run Eater crawler to attach mentions**

```bash
python3 main.py --source eater-atlanta-guides --allow-production-writes --skip-run-lock
```

- [ ] **Step 4: Verify match rate improved**

Target: 90%+ match rate (up from 67%).

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(scripts): seed unmatched Eater Atlanta restaurants and re-attach editorial mentions"
```

---

### Task 3: Fix schema.sql Stale venue_id References

**Context:** The `places_final_rename` migration renamed `venue_id` to `place_id` across tables, but `database/schema.sql` still shows `venue_id` in several places. Agents reading schema.sql get wrong column names.

**Files:**
- Modify: `database/schema.sql`

- [ ] **Step 1: Find all stale venue_id references**

```bash
grep -n "venue_id" database/schema.sql
```

- [ ] **Step 2: Replace with place_id where appropriate**

Tables that were renamed:
- `events.venue_id` → `events.place_id`
- `place_specials.venue_id` → `place_specials.place_id`  
- `exhibitions.venue_id` → `exhibitions.place_id`
- `venue_features.venue_id` → `venue_features.place_id`

Be careful: some references may be correct (e.g., FK constraint names that weren't renamed). Check the live DB column names before changing.

- [ ] **Step 3: Verify the schema file is consistent**

```bash
# Check that all renamed columns match the live DB
cd /Users/coach/Projects/LostCity/crawlers
python3 -c "
from db.client import get_client
client = get_client()
for table in ['events', 'place_specials', 'exhibitions', 'venue_features']:
    try:
        result = client.table(table).select('place_id').limit(1).execute()
        print(f'{table}.place_id: OK')
    except Exception as e:
        print(f'{table}.place_id: FAILED — {e}')
    try:
        result = client.table(table).select('venue_id').limit(1).execute()
        print(f'{table}.venue_id: still exists (unexpected)')
    except:
        pass
"
```

- [ ] **Step 4: Commit**

```bash
git add database/schema.sql
git commit -m "docs(schema): fix stale venue_id references → place_id"
```

---

### Task 4: Run Hours Enrichment on Remaining Venue Types

**Context:** Hours enrichment was run on restaurants (86 enriched). Other venue types still have poor hours coverage: bars (unknown), museums, music venues, galleries.

**Files:**
- No code changes — operational runs using existing `hydrate_hours_google.py`

- [ ] **Step 1: Run on bars**

```bash
cd /Users/coach/Projects/LostCity/crawlers
python3 hydrate_hours_google.py --venue-type bar --limit 200
```

- [ ] **Step 2: Run on music venues**

```bash
python3 hydrate_hours_google.py --venue-type music_venue --limit 100
```

- [ ] **Step 3: Run on museums and galleries**

```bash
python3 hydrate_hours_google.py --venue-type museum --limit 100
python3 hydrate_hours_google.py --venue-type gallery --limit 100
```

- [ ] **Step 4: Check overall hours coverage**

```bash
python3 -c "
from db.client import get_client
client = get_client()
total = client.table('places').select('id', count='exact').eq('is_active', True).execute()
hours = client.table('places').select('id', count='exact').eq('is_active', True).not_.is_('hours', 'null').execute()
print(f'Hours coverage: {hours.count}/{total.count} ({100*hours.count/total.count:.1f}%)')
"
```

Target: >50% overall hours coverage (up from 42.4%).

---

### Task 5: Surface Editorial Mentions in Restaurant Detail

**Context:** 121 editorial mentions from Eater Atlanta are in the DB but not rendered anywhere. Need a UI component on the place detail view.

**Files:**
- Modify: `web/components/views/PlaceDetailView.tsx` or `web/lib/spot-detail.ts`

- [ ] **Step 1: Check if editorial mentions are already fetched in spot detail**

Read `web/lib/spot-detail.ts` — does the place detail query include `editorial_mentions`?

- [ ] **Step 2: Add editorial mentions to the detail query if missing**

Query `editorial_mentions` table for the place, join on `place_id`.

- [ ] **Step 3: Render editorial mentions on the place detail page**

Add a section after features/specials that shows:
- Source name (e.g., "Eater Atlanta")
- Guide name (e.g., "The 38 Essential Atlanta Restaurants")
- Snippet/blurb
- Link to the article

Use the existing `SectionHeader` component for consistency. Style with the editorial/press pattern from `PressQuote.tsx` if it exists.

- [ ] **Step 4: Verify and commit**

```bash
cd /Users/coach/Projects/LostCity/web && npx tsc --noEmit
git commit -m "feat(detail): render editorial mentions on place detail pages"
```

---

## Priority Order

1. **Task 3: schema.sql cleanup** — 10 minutes, prevents wrong column names in future agent work
2. **Task 5: Editorial mentions UI** — makes the 121 Eater mentions visible to users
3. **Task 4: Hours enrichment** — operational, improves coverage with no code
4. **Task 1: Instagram handle discovery** — highest impact for nightlife depth
5. **Task 2: Eater unmatched seed** — improves editorial match rate from 67% to 90%+

## What's Explicitly Out of Scope

- **Venue feature images at scale** — already designed, decided against og:image fallback. Only crawler-extracted images. The 3.1% coverage improves naturally as crawlers are updated.
- **Instagram cron automation** — requires persistent Chrome cookie store. Not worth building until handle coverage is >80%.
- **Additional restaurant seed cities** — Atlanta only for now. The script generalizes but expansion is a strategic decision.
