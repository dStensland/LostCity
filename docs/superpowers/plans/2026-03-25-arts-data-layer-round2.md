# Arts Portal Data Layer Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the arts data layer — medium inference, closing date backfill, fix 6 broken crawlers, visual artist pipeline with browse API — so the portal can be designed against real, comprehensive data.

**Architecture:** Four independent workstreams sharing the `crawlers/` Python pipeline and `web/` Next.js API layer. Medium inference and artist name validation are pure functions with TDD. Crawler fixes are diagnosis-driven (verify site, update selectors). Artist browse API uses a Supabase RPC for portal-scoped multi-table joins. Pre-flight cleanup runs first; then crawler fixes; then medium inference, closing dates, and artist pipeline in parallel.

**Tech Stack:** Python 3 (BeautifulSoup, requests, Playwright), Supabase/PostgreSQL (migrations, RPCs), Next.js 16 (API routes), pytest, Tailwind v4

**Spec:** `docs/superpowers/specs/2026-03-25-arts-data-layer-round2-design.md`

---

## File Structure

### New files

| File | Purpose |
|------|---------|
| `crawlers/medium_inference.py` | Keyword-based medium taxonomy matcher |
| `crawlers/tests/test_medium_inference.py` | Tests for medium inference |
| `crawlers/tests/test_artist_validation.py` | Tests for artist name validation gate |
| `crawlers/scripts/exhibition_medium_inference.py` | Backfill script for existing exhibitions |
| `crawlers/scripts/exhibition_closing_dates.py` | Backfill script for closing dates |
| `crawlers/scripts/artist_roster_scraper.py` | Scrape artist rosters from gallery websites |
| `crawlers/scripts/backfill_exhibition_artist_fks.py` | Resolve null artist_id FKs in exhibition_artists |
| `supabase/migrations/20260326000001_deactivate_junk_exhibitions.sql` | Deactivate ~25 junk records |
| `supabase/migrations/20260326000002_exhibition_medium_check.sql` | CHECK constraint on medium column |
| `supabase/migrations/20260326000003_get_portal_artists_rpc.sql` | RPC for portal-scoped artist listing |
| `web/app/api/artists/route.ts` | GET /api/artists — list with filters |
| `web/app/api/artists/[slug]/route.ts` | GET /api/artists/:slug — detail + exhibitions |

### Modified files

| File | Changes |
|------|---------|
| `crawlers/artists.py` | Add `validate_artist_name()`, `extra_fields` param, discipline collision |
| `crawlers/db/exhibitions.py` | Wire `infer_exhibition_medium()` into insert, add source_url validation |
| `crawlers/sources/kai_lin_art.py` | Fix rate-limit disconnects, add retry with backoff |
| `crawlers/sources/atlanta_history_center.py` | Fix intermittent connection failures |
| `crawlers/sources/whitespace_gallery.py` | Handle React SPA — try API or Playwright |
| `crawlers/sources/carlos_museum.py` | Update DOM selectors for redesigned site |
| `crawlers/sources/hammonds_house.py` | Verify site status, fix or deactivate |
| `crawlers/sources/atlanta_printmakers_studio.py` | Verify domain, update Squarespace parsing |

---

## Execution Order

```
Phase 1: Pre-flight (Task 1)
Phase 2: Crawler Fixes (Tasks 2-4) — sequential, verify sites first
Phase 3 (parallel after Phase 1):
  ├── Medium Inference (Tasks 5-7)
  ├── Closing Date Backfill (Task 8) — benefits from Phase 2
  └── Artist Pipeline (Tasks 9-14) — benefits from Phase 2
```

Tasks within each phase are sequential. Phases 3's three tracks can run in parallel.

---

### Task 1: Pre-Flight — Junk Exhibition Cleanup + Source URL Validation

**Files:**
- Create: `supabase/migrations/20260326000001_deactivate_junk_exhibitions.sql`
- Modify: `crawlers/db/exhibitions.py:108-122`

This task deactivates known junk exhibition records and adds a source_url validation gate to prevent CDN image URLs from being stored as exhibition source URLs.

- [ ] **Step 1: Query production for junk exhibitions**

Connect to the database and identify junk titles. The known offenders include "View fullsize" (x19) and other UI/navigation strings.

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -c "
from db.client import get_client
client = get_client()
result = client.table('exhibitions').select('id, title').eq('is_active', True).execute()
junk = [r for r in result.data if r['title'] in (
    'View fullsize', 'View Fullsize', 'Download Press Release',
    'Click Here', 'Read More', 'Learn More'
) or r['title'].strip().isdigit() or len(r['title'].strip()) < 3]
for j in junk:
    print(f\"  '{j['title']}'\")
print(f'Total junk: {len(junk)}')
"
```

- [ ] **Step 2: Write the junk cleanup migration**

Create `supabase/migrations/20260326000001_deactivate_junk_exhibitions.sql`:

```sql
-- Deactivate junk exhibition records: UI artifacts, bare numbers, and
-- sub-3-char titles that passed through before title validation was tightened.

UPDATE exhibitions
SET is_active = false
WHERE is_active = true
  AND (
    -- Known UI artifact strings
    title IN (
      'View fullsize', 'View Fullsize',
      'Download Press Release', 'Click Here',
      'Read More', 'Learn More'
    )
    -- Bare numeric titles (years, IDs)
    OR title ~ '^\d+$'
    -- Sub-3-char titles (noise)
    OR length(trim(title)) < 3
  );
```

- [ ] **Step 3: Add source_url validation to insert_exhibition()**

In `crawlers/db/exhibitions.py`, add a CDN URL rejection check after the junk title check (around line 122). CDN image URLs stored as source_url provide no exhibition detail page.

```python
# Add this regex near the top of the file, after _JUNK_TITLE_RE
_CDN_URL_RE = re.compile(
    r"https?://[^/]*\.(cloudinary\.com|s3\.amazonaws\.com|wp-content/uploads|imgix\.net|cloudfront\.net)/",
    re.IGNORECASE,
)
```

In `insert_exhibition()`, after the junk title check and before venue_id check:

```python
    source_url = exhibition_data.get("source_url", "")
    if source_url and _CDN_URL_RE.search(source_url):
        logger.debug("Skipping exhibition %r — source_url is a CDN image URL: %s", title, source_url[:80])
        return None
```

- [ ] **Step 4: Write test for source_url validation**

Add to `crawlers/tests/test_exhibition_dedup.py`:

```python
def test_cdn_url_regex_matches_cdn_urls():
    """CDN image URLs should be caught by the regex pattern."""
    from db.exhibitions import _CDN_URL_RE

    cdn_urls = [
        "https://res.cloudinary.com/gallery/image/upload/v123/photo.jpg",
        "https://bucket.s3.amazonaws.com/exhibitions/img.png",
        "https://gallery.com/wp-content/uploads/2026/03/show.jpg",
        "https://cdn.imgix.net/photos/exhibit.jpg",
        "https://d1234.cloudfront.net/images/show.jpg",
    ]
    for url in cdn_urls:
        assert _CDN_URL_RE.search(url), f"CDN URL {url!r} should match"


def test_cdn_url_regex_does_not_match_real_urls():
    """Real exhibition page URLs should not match the CDN pattern."""
    from db.exhibitions import _CDN_URL_RE

    real_urls = [
        "https://gallery.com/exhibitions/my-show",
        "https://www.mocaga.org/2026-exhibitions/",
        "https://high.org/exhibition/radcliffe-bailey",
        "https://atlantacontemporary.org/exhibitions/current",
    ]
    for url in real_urls:
        assert not _CDN_URL_RE.search(url), f"Real URL {url!r} should not match CDN pattern"
```

- [ ] **Step 5: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_exhibition_dedup.py -v
```

Expected: All tests pass including the two new ones.

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add supabase/migrations/20260326000001_deactivate_junk_exhibitions.sql crawlers/db/exhibitions.py crawlers/tests/test_exhibition_dedup.py
git commit -m "fix: pre-flight junk exhibition cleanup + source_url CDN validation"
```

---

### Task 2: Fix Kai Lin Art + Atlanta History Center Crawlers

**Files:**
- Modify: `crawlers/sources/kai_lin_art.py`
- Modify: `crawlers/sources/atlanta_history_center.py`

Both crawlers have intermittent "server disconnected" errors. Kai Lin Art uses Playwright; Atlanta History Center has a multi-surface approach (Tribe API + static HTML).

**Context:** Read `crawlers/CLAUDE.md` for crawler patterns. Read `crawlers/sources/_exhibitions_base.py` for the exhibition base class. Read `crawlers/exhibition_utils.py` for `build_exhibition_record()`.

- [ ] **Step 1: Verify Kai Lin Art site is up**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.kailinart.com/exhibitions
```

If 200, the site is up and the issue is rate-limiting or anti-bot. If not, check if the domain redirected.

- [ ] **Step 2: Fix Kai Lin Art crawler**

The crawler at `crawlers/sources/kai_lin_art.py` uses Playwright. Known issues:
- Rate-limit / anti-bot causing disconnects
- Date-ordering bug (sorts by opening_date but some records lack it)

Fix approach:
1. Add retry logic with exponential backoff to `page.goto()`
2. Add request interception to block unnecessary resources (images, fonts, tracking)
3. Add a random delay between 2-5s instead of fixed 1s waits
4. Per pipeline redesign direction, consider converting to static HTTP if the exhibitions page has a JSON API or renders server-side

If converting to HTTP/BS4, use the `GenericExhibitionCrawler` base from `sources/_exhibitions_base.py` and parse the HTML directly. If the site requires JS rendering, keep Playwright but add retry logic.

- [ ] **Step 3: Test Kai Lin Art**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 main.py --source kai-lin-art --dry-run
```

Expected: >0 exhibitions found. Log output shows exhibition titles with dates.

- [ ] **Step 4: Verify Atlanta History Center site**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.atlantahistorycenter.com
```

- [ ] **Step 5: Fix Atlanta History Center crawler**

The crawler at `crawlers/sources/atlanta_history_center.py` is a multi-surface hybrid. Known issue: intermittent Cloudflare-style protection.

Fix approach:
1. Add retry with backoff to the static HTML exhibition page fetches
2. Add proper error handling for partial failures (Tribe API works but exhibition pages don't)
3. Ensure the crawler still produces exhibitions even if one surface fails

Check the exhibition scraping section specifically — it fetches individual exhibition detail pages. Add try/except around each page fetch with retries.

- [ ] **Step 6: Test Atlanta History Center**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 main.py --source atlanta-history-center --dry-run
```

Expected: >0 exhibitions found.

- [ ] **Step 7: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/kai_lin_art.py crawlers/sources/atlanta_history_center.py
git commit -m "fix: Kai Lin Art + Atlanta History Center crawler connection issues"
```

---

### Task 3: Fix Whitespace Gallery + Carlos Museum Crawlers

**Files:**
- Modify: `crawlers/sources/whitespace_gallery.py`
- Modify: `crawlers/sources/carlos_museum.py`

Both return "success but 0 found" — different root causes.

**Context:** Read each crawler file first. Read `crawlers/sources/_exhibitions_base.py` for the base class. Read `crawlers/exhibition_utils.py` for `build_exhibition_record()`.

- [ ] **Step 1: Diagnose Whitespace Gallery**

```bash
curl -s https://whitespace814.com/ | head -100
```

The crawler notes the site uses ArtCloud (React SPA). Check if:
1. There's a JSON API endpoint (e.g., `?format=json`, `/api/exhibitions`)
2. The page has embedded JSON data in `<script>` tags (Next.js `__NEXT_DATA__`, React state)
3. Playwright is needed for client-side rendering

If the site is genuinely React-only with no accessible data:
- Try Playwright as a last resort
- If Playwright works, convert the crawler to use it
- If the site is down or has no exhibitions, mark the source `is_active=false`

- [ ] **Step 2: Fix Whitespace Gallery crawler**

Based on diagnosis from Step 1, update `crawlers/sources/whitespace_gallery.py`. The fix depends on what you find:

**If JSON API exists:** Use `requests` to fetch it, parse exhibitions from JSON. Extend `GenericExhibitionCrawler`.

**If embedded JSON:** Extract from `<script>` tags with regex, parse with `json.loads()`.

**If Playwright needed:** Add Playwright rendering, wait for content, extract exhibitions.

**If site is down/no data:** Update crawler to return (0, 0, 0) with a log message and mark source inactive.

- [ ] **Step 3: Test Whitespace Gallery**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 main.py --source whitespace-gallery --dry-run
```

- [ ] **Step 4: Diagnose Carlos Museum**

```bash
curl -s https://carlos.emory.edu/exhibitions | head -200
```

The crawler at `crawlers/sources/carlos_museum.py` uses Playwright. The issue is outdated DOM selectors after a site redesign. Check the current page structure.

- [ ] **Step 5: Fix Carlos Museum crawler**

Update the selectors in `crawlers/sources/carlos_museum.py` to match the current DOM structure. The museum's exhibition page likely has:
- Exhibition titles in headings (h2, h3, or similar)
- Date ranges near the title
- Exhibition images
- Links to detail pages

If the site now serves content without JS, convert from Playwright to HTTP/BS4 (preferred per pipeline direction).

- [ ] **Step 6: Test Carlos Museum**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 main.py --source carlos-museum --dry-run
```

- [ ] **Step 7: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/whitespace_gallery.py crawlers/sources/carlos_museum.py
git commit -m "fix: Whitespace Gallery + Carlos Museum exhibition crawlers"
```

---

### Task 4: Fix Hammonds House + Atlanta Printmakers Crawlers

**Files:**
- Modify: `crawlers/sources/hammonds_house.py`
- Modify: `crawlers/sources/atlanta_printmakers_studio.py`

Both are smaller galleries (2 exhibitions each) returning 0 results.

**Context:** Read each crawler file first. These are lower-priority fixes — if a site is genuinely offline, mark it inactive rather than investing time.

- [ ] **Step 1: Verify Hammonds House site status**

```bash
curl -s -o /dev/null -w "%{http_code}" https://www.hammondshouse.org
curl -s -o /dev/null -w "%{http_code}" https://hammondshouse.org
```

If the site is down (non-200/301/302), mark the source `is_active=false` in the database and move on. Don't invest time fixing a crawler for a dead site.

- [ ] **Step 2: Fix or deactivate Hammonds House**

If site is up: Read the current crawler code, check the page structure, and update the multi-path fallback parsing. The crawler tries `/events`, `/programs`, `/calendar`, `/whats-on`, and root. One of these should have exhibition data.

If site is down: Create a migration or use the CLI to deactivate:

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -c "
from db.client import get_client
client = get_client()
client.table('sources').update({'is_active': False}).eq('slug', 'hammonds-house').execute()
print('Deactivated hammonds-house source')
"
```

- [ ] **Step 3: Verify Atlanta Printmakers Studio**

```bash
curl -s -o /dev/null -w "%{http_code}" https://atlantaprintmakersstudio.com
curl -s -o /dev/null -w "%{http_code}" https://www.atlantaprintmakersstudio.com
```

Check if the domain has changed. The crawler uses Squarespace block-stream parsing.

- [ ] **Step 4: Fix or deactivate Atlanta Printmakers**

If site is up: Check the Squarespace `?format=json` endpoint first (faster than HTML parsing). Update block selectors if the structure changed.

If domain changed: Update the URL in the crawler and source record.

If site is down: Deactivate the source.

- [ ] **Step 5: Test both crawlers (if active)**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 main.py --source hammonds-house --dry-run
PYTHONPATH=. python3 main.py --source atlanta-printmakers-studio --dry-run
```

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/sources/hammonds_house.py crawlers/sources/atlanta_printmakers_studio.py
git commit -m "fix: Hammonds House + Atlanta Printmakers exhibition crawlers"
```

---

### Task 5: Medium Inference Engine — Module + Tests

**Files:**
- Create: `crawlers/medium_inference.py`
- Create: `crawlers/tests/test_medium_inference.py`

Build the keyword-matching medium inference function. This is a pure function with no DB calls — ideal for TDD.

- [ ] **Step 1: Write the failing tests**

Create `crawlers/tests/test_medium_inference.py`:

```python
"""Tests for exhibition medium inference from title/description keywords."""

from medium_inference import infer_exhibition_medium


class TestTitleMatching:
    def test_painting_keywords(self):
        assert infer_exhibition_medium("Oil Paintings by Jane Doe") == "painting"
        assert infer_exhibition_medium("Watercolor Landscapes") == "painting"

    def test_photography_keywords(self):
        assert infer_exhibition_medium("Photographs of the American South") == "photography"
        assert infer_exhibition_medium("Cyanotype Dreams") == "photography"

    def test_sculpture_keywords(self):
        assert infer_exhibition_medium("Bronze Sculptures: A Retrospective") == "sculpture"
        assert infer_exhibition_medium("Carved in Stone") == "sculpture"

    def test_printmaking_keywords(self):
        assert infer_exhibition_medium("Lithographs and Etchings") == "printmaking"
        assert infer_exhibition_medium("Screenprint Workshop Show") == "printmaking"

    def test_drawing_keywords(self):
        assert infer_exhibition_medium("Charcoal Drawings") == "drawing"
        assert infer_exhibition_medium("Works in Graphite") == "drawing"

    def test_textile_keywords(self):
        assert infer_exhibition_medium("Fiber Arts: Weaving Traditions") == "textile"
        assert infer_exhibition_medium("Contemporary Quilts") == "textile"

    def test_digital_keywords(self):
        assert infer_exhibition_medium("Generative Art: Code as Canvas") == "digital"
        assert infer_exhibition_medium("Video Installation") == "digital"

    def test_ceramics_keywords(self):
        assert infer_exhibition_medium("Pottery and Porcelain") == "ceramics"
        assert infer_exhibition_medium("Stoneware Forms") == "ceramics"

    def test_installation_keywords(self):
        assert infer_exhibition_medium("Site-Specific Installation") == "installation"
        assert infer_exhibition_medium("Immersive Experience") == "installation"

    def test_mixed_media_keywords(self):
        assert infer_exhibition_medium("Mixed Media Assemblage") == "mixed_media"
        assert infer_exhibition_medium("Collage and Found Objects") == "mixed_media"


class TestMultipleMedia:
    def test_multiple_media_returns_mixed(self):
        """When multiple distinct media detected, return mixed_media."""
        assert infer_exhibition_medium("Paintings and Sculptures") == "mixed_media"
        assert infer_exhibition_medium("Photography, Drawing, and Printmaking") == "mixed_media"


class TestNoMatch:
    def test_ambiguous_title_returns_none(self):
        assert infer_exhibition_medium("New Horizons") is None
        assert infer_exhibition_medium("Group Exhibition") is None
        assert infer_exhibition_medium("The Great Migration") is None

    def test_empty_input(self):
        assert infer_exhibition_medium("") is None
        assert infer_exhibition_medium("", "") is None


class TestDescriptionFallback:
    def test_description_used_when_title_has_no_match(self):
        result = infer_exhibition_medium(
            "New Horizons",
            "A collection of watercolor and gouache paintings."
        )
        assert result == "painting"

    def test_title_takes_precedence_over_description(self):
        result = infer_exhibition_medium(
            "Bronze Sculptures",
            "The artist also works in photography."
        )
        assert result == "sculpture"


class TestWordBoundary:
    def test_print_does_not_match_in_printmakers(self):
        """'print' should match as a medium keyword but not inside 'printmakers' venue name."""
        # 'print' as standalone word should match printmaking
        assert infer_exhibition_medium("Fine Art Prints") == "printmaking"

    def test_ink_does_not_match_inside_thinking(self):
        """'ink' should only match as a word boundary, not inside 'thinking'."""
        assert infer_exhibition_medium("Thinking About Art") is None
        assert infer_exhibition_medium("Works in Ink") == "drawing"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_medium_inference.py -v
```

Expected: ImportError — `medium_inference` module doesn't exist yet.

- [ ] **Step 3: Implement the medium inference module**

Create `crawlers/medium_inference.py`:

```python
"""
Keyword-based medium inference for exhibitions.

Matches exhibition titles and descriptions against a curated taxonomy
of art media. Returns the most likely medium or None if ambiguous.

Taxonomy (10 values):
  painting, photography, sculpture, mixed_media, printmaking,
  drawing, textile, digital, ceramics, installation
"""

import re
from typing import Optional

# Each medium maps to a list of keyword patterns (matched with word boundaries)
_MEDIUM_KEYWORDS: dict[str, list[str]] = {
    "painting": [
        "painting", "paintings", "oil on canvas", "acrylic", "watercolor",
        "watercolour", "gouache", "tempera", "fresco", "oil paint",
    ],
    "photography": [
        "photograph", "photographs", "photography", "photo",
        "daguerreotype", "cyanotype", "darkroom", "photographic",
    ],
    "sculpture": [
        "sculpture", "sculptures", "bronze", "marble", "carved",
        "statue", "statues", "sculptural",
    ],
    "mixed_media": [
        "mixed media", "assemblage", "collage", "multimedia",
        "multi-media", "found objects",
    ],
    "printmaking": [
        "printmaking", "lithograph", "lithographs", "screenprint",
        "screenprints", "etching", "etchings", "woodcut", "woodcuts",
        "intaglio", "monoprint", "monoprints", "prints",
        "linocut", "linocuts", "engraving",
    ],
    "drawing": [
        "drawing", "drawings", "charcoal", "pencil", "graphite",
        "pastel", "pastels",
    ],
    "textile": [
        "textile", "textiles", "fiber art", "fiber arts", "fibre",
        "weaving", "quilt", "quilts", "tapestry", "embroidery",
    ],
    "digital": [
        "digital art", "video art", "video installation",
        "projection", "new media", "generative", "generative art",
        "AI art", "nft",
    ],
    "ceramics": [
        "ceramics", "ceramic", "pottery", "porcelain",
        "stoneware", "glaze", "glazed",
    ],
    "installation": [
        "installation", "site-specific", "site specific",
        "immersive", "environment", "environmental art",
    ],
}

# Pre-compile word-boundary regex for each keyword
_COMPILED_PATTERNS: dict[str, list[re.Pattern]] = {}

for medium, keywords in _MEDIUM_KEYWORDS.items():
    _COMPILED_PATTERNS[medium] = [
        re.compile(r"\b" + re.escape(kw) + r"s?\b", re.IGNORECASE)
        for kw in keywords
    ]

# Special case: "ink" needs careful handling to avoid matching inside words
_COMPILED_PATTERNS["drawing"].append(
    re.compile(r"\bink\b", re.IGNORECASE)
)

# Valid medium values (for CHECK constraint alignment)
VALID_MEDIA = frozenset(_MEDIUM_KEYWORDS.keys())


def infer_exhibition_medium(
    title: str,
    description: str = "",
) -> Optional[str]:
    """Infer exhibition medium from title and/or description keywords.

    Rules:
    - Match keywords in title first (highest confidence)
    - Fall back to description if title has no match
    - If multiple distinct media detected, return 'mixed_media'
    - If no match, return None (don't guess)
    """
    if not title and not description:
        return None

    # Try title first
    title_media = _match_media(title)
    if title_media:
        return title_media

    # Fall back to description
    if description:
        desc_media = _match_media(description)
        if desc_media:
            return desc_media

    return None


def _match_media(text: str) -> Optional[str]:
    """Find matching media in text. Returns medium name or None."""
    if not text:
        return None

    matched: set[str] = set()

    for medium, patterns in _COMPILED_PATTERNS.items():
        for pattern in patterns:
            if pattern.search(text):
                matched.add(medium)
                break  # One match per medium is enough

    if not matched:
        return None

    # If mixed_media was explicitly matched, return it
    if "mixed_media" in matched:
        return "mixed_media"

    # If multiple distinct media detected, return mixed_media
    if len(matched) > 1:
        return "mixed_media"

    return matched.pop()
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_medium_inference.py -v
```

Expected: All tests PASS. Fix any failing tests by adjusting keyword patterns or word boundary logic.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/medium_inference.py crawlers/tests/test_medium_inference.py
git commit -m "feat: medium inference engine with 10-value taxonomy + tests"
```

---

### Task 6: Medium Pipeline Integration + CHECK Constraint

**Files:**
- Create: `supabase/migrations/20260326000002_exhibition_medium_check.sql`
- Modify: `crawlers/db/exhibitions.py:108-188` (insert_exhibition) and `237-259` (update_exhibition)

Wire the medium inference function into the exhibition insert/update pipeline and add a database CHECK constraint.

**Context:** Read `crawlers/db/exhibitions.py` first. Read `crawlers/medium_inference.py` (created in Task 5). The inference function is called `infer_exhibition_medium(title, description)` and returns a string or None.

- [ ] **Step 1: Create the CHECK constraint migration**

Create `supabase/migrations/20260326000002_exhibition_medium_check.sql`:

```sql
-- Add CHECK constraint on exhibitions.medium to enforce the 10-value taxonomy.
-- Prevents typos and undocumented values.

ALTER TABLE exhibitions
ADD CONSTRAINT exhibitions_medium_check
CHECK (
  medium IS NULL
  OR medium IN (
    'painting', 'photography', 'sculpture', 'mixed_media',
    'printmaking', 'drawing', 'textile', 'digital',
    'ceramics', 'installation'
  )
);
```

- [ ] **Step 2: Wire medium inference into insert_exhibition()**

In `crawlers/db/exhibitions.py`, add the inference call after the source_url validation and before the content hash generation. Only infer when `medium` is not already set.

At the top of the file, add the import:

```python
from medium_inference import infer_exhibition_medium
```

In `insert_exhibition()`, after the source_url CDN check and before `opening_date = exhibition_data.get("opening_date")`:

```python
    # Infer medium from title/description if not already set
    if not exhibition_data.get("medium"):
        description = exhibition_data.get("description", "")
        inferred = infer_exhibition_medium(title, description)
        if inferred:
            exhibition_data["medium"] = inferred
            logger.debug("Inferred medium=%s for %r", inferred, title)
```

- [ ] **Step 3: Note on update_exhibition()**

Do NOT wire medium inference into `update_exhibition()`. The function doesn't fetch the existing record's title/description — it only receives the update payload. Medium inference for existing records is handled by the backfill script (Task 7). The `insert_exhibition()` path handles new records. When `insert_exhibition()` detects a duplicate (hash or title+venue match), it calls `update_exhibition()` — but the title is already in the `exhibition_data` dict, so the medium inference in the insert path already ran before the dedup check.

- [ ] **Step 4: Run existing tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_exhibition_dedup.py tests/test_medium_inference.py -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add supabase/migrations/20260326000002_exhibition_medium_check.sql crawlers/db/exhibitions.py
git commit -m "feat: wire medium inference into exhibition pipeline + CHECK constraint"
```

---

### Task 7: Medium Backfill Script

**Files:**
- Create: `crawlers/scripts/exhibition_medium_inference.py`

Backfill medium on existing exhibitions that have null medium.

**Context:** Read `crawlers/medium_inference.py` for the `infer_exhibition_medium()` function. Read `crawlers/db/client.py` for `get_client()` and `writes_enabled()`.

- [ ] **Step 1: Write the backfill script**

Create `crawlers/scripts/exhibition_medium_inference.py`:

```python
"""
Backfill exhibitions.medium using keyword inference from title + description.

Run: cd crawlers && PYTHONPATH=. python3 scripts/exhibition_medium_inference.py [--dry-run]
"""

import argparse
import logging
import sys

from db.client import get_client
from medium_inference import infer_exhibition_medium

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition medium")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    args = parser.parse_args()

    client = get_client()

    # Fetch all active exhibitions with null medium
    result = client.table("exhibitions").select(
        "id, title, description, medium"
    ).eq("is_active", True).is_("medium", "null").execute()

    exhibitions = result.data or []
    logger.info("Found %d exhibitions with null medium", len(exhibitions))

    inferred_count = 0
    medium_counts: dict[str, int] = {}

    for ex in exhibitions:
        title = ex.get("title", "")
        description = ex.get("description", "")
        medium = infer_exhibition_medium(title, description)

        if medium:
            inferred_count += 1
            medium_counts[medium] = medium_counts.get(medium, 0) + 1

            if not args.dry_run:
                client.table("exhibitions").update(
                    {"medium": medium}
                ).eq("id", ex["id"]).execute()

            logger.debug("  %s → %s: %s", medium, title[:60], ex["id"])

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total with null medium: %d", len(exhibitions))
    logger.info("Inferred: %d (%.0f%%)", inferred_count,
                100 * inferred_count / max(len(exhibitions), 1))
    logger.info("Remaining null: %d", len(exhibitions) - inferred_count)
    logger.info("")
    logger.info("Medium distribution:")
    for medium, count in sorted(medium_counts.items(), key=lambda x: -x[1]):
        logger.info("  %-15s %d", medium, count)

    if args.dry_run:
        logger.info("")
        logger.info("DRY RUN — no changes written. Remove --dry-run to apply.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test with dry-run**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/exhibition_medium_inference.py --dry-run
```

Expected: Shows count of exhibitions, how many got medium inferred, and the distribution. Target: 50%+ of exhibitions get a medium value.

- [ ] **Step 3: Run for real (if dry-run looks good)**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/exhibition_medium_inference.py
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/exhibition_medium_inference.py
git commit -m "feat: medium backfill script for existing exhibitions"
```

---

### Task 8: Closing Date Extraction + Backfill Script

**Files:**
- Create: `crawlers/scripts/exhibition_closing_dates.py`
- Create: `crawlers/tests/test_closing_date_extraction.py`

Extract closing dates from exhibition source pages and infer defaults for exhibitions without them.

**Context:** Read `crawlers/sources/exhibitions_moca_ga.py` for the `_parse_date_range()` pattern — it already handles "Month DD, YYYY - Month DD, YYYY" formats. Reuse/adapt this approach.

- [ ] **Step 1: Write tests for date extraction**

Create `crawlers/tests/test_closing_date_extraction.py`:

```python
"""Tests for closing date extraction from exhibition page text."""

import pytest


def test_import():
    """Verify the extract function exists."""
    from scripts.exhibition_closing_dates import extract_closing_date
    assert callable(extract_closing_date)


class TestDateRangeExtraction:
    def test_standard_range(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("January 15 – April 30, 2026") == "2026-04-30"
        assert extract_closing_date("Jan 15, 2026 - Mar 30, 2026") == "2026-03-30"

    def test_through_pattern(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("On view through May 15, 2026") == "2026-05-15"
        assert extract_closing_date("Through June 1, 2026") == "2026-06-01"

    def test_closes_pattern(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("Closes March 31, 2026") == "2026-03-31"
        assert extract_closing_date("Closing April 15, 2026") == "2026-04-15"

    def test_json_ld_end_date(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        html = '<script type="application/ld+json">{"endDate": "2026-05-01"}</script>'
        assert extract_closing_date(html) == "2026-05-01"

    def test_no_date_found(self):
        from scripts.exhibition_closing_dates import extract_closing_date
        assert extract_closing_date("Welcome to our gallery") is None
        assert extract_closing_date("") is None
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_closing_date_extraction.py -v
```

- [ ] **Step 3: Write the closing date backfill script**

Create `crawlers/scripts/exhibition_closing_dates.py`:

```python
"""
Backfill exhibitions.closing_date by scraping source_url pages and inferring defaults.

Strategy:
1. For each exhibition with null closing_date, fetch source_url
2. Extract closing date from page text using patterns:
   - Date range: "Month DD – Month DD, YYYY"
   - Through: "through Month DD", "on view through"
   - Closes: "closes Month DD", "closing Month DD"
   - JSON-LD: endDate in structured data
3. If no date found and exhibition_type != 'permanent':
   - Infer 3-month default from opening_date
   - Tag with metadata.closing_date_inferred = true

Run: cd crawlers && PYTHONPATH=. python3 scripts/exhibition_closing_dates.py [--dry-run]
"""

import argparse
import json
import logging
import re
import sys
import time
from datetime import date, timedelta
from typing import Optional

import requests
from bs4 import BeautifulSoup

from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)

_MONTHS = {
    "january": 1, "february": 2, "march": 3, "april": 4,
    "may": 5, "june": 6, "july": 7, "august": 8,
    "september": 9, "october": 10, "november": 11, "december": 12,
    "jan": 1, "feb": 2, "mar": 3, "apr": 4,
    "jun": 6, "jul": 7, "aug": 8,
    "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

_MONTH_NAMES = "|".join(_MONTHS.keys())

# Pattern: "through May 15, 2026" or "on view through May 15"
_THROUGH_RE = re.compile(
    rf"(?:through|thru|until|closes?|closing)\s+({_MONTH_NAMES})\s+(\d{{1,2}}),?\s*(\d{{4}})?",
    re.IGNORECASE,
)

# Pattern: "Month DD – Month DD, YYYY" (date range with end date)
_RANGE_END_RE = re.compile(
    rf"[-–—]\s*({_MONTH_NAMES})\s+(\d{{1,2}}),?\s*(\d{{4}})",
    re.IGNORECASE,
)

# JSON-LD endDate
_JSON_LD_RE = re.compile(r'"endDate"\s*:\s*"(\d{4}-\d{2}-\d{2})"')


def _parse_month_day_year(month_str: str, day_str: str, year_str: Optional[str]) -> Optional[str]:
    month = _MONTHS.get(month_str.lower())
    if not month:
        return None
    day = int(day_str)
    year = int(year_str) if year_str else date.today().year
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def extract_closing_date(text: str) -> Optional[str]:
    """Extract a closing date from page text or HTML."""
    if not text:
        return None

    # Try JSON-LD first (most structured)
    m = _JSON_LD_RE.search(text)
    if m:
        return m.group(1)

    # Try "through/closes Month DD, YYYY"
    m = _THROUGH_RE.search(text)
    if m:
        return _parse_month_day_year(m.group(1), m.group(2), m.group(3))

    # Try date range end "– Month DD, YYYY"
    m = _RANGE_END_RE.search(text)
    if m:
        return _parse_month_day_year(m.group(1), m.group(2), m.group(3))

    return None


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition closing dates")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int, default=0, help="Max exhibitions to process")
    args = parser.parse_args()

    client = get_client()
    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})

    # Fetch exhibitions with null closing_date
    query = client.table("exhibitions").select(
        "id, title, source_url, opening_date, closing_date, exhibition_type, metadata"
    ).eq("is_active", True).is_("closing_date", "null")

    result = query.execute()
    exhibitions = result.data or []

    if args.limit:
        exhibitions = exhibitions[:args.limit]

    logger.info("Processing %d exhibitions with null closing_date", len(exhibitions))

    scraped = 0
    inferred = 0
    failed = 0

    for ex in exhibitions:
        source_url = ex.get("source_url", "")
        title = ex.get("title", "")

        closing_date = None
        source_url_yielded_date = False

        # Try to scrape from source_url
        if source_url and source_url.startswith("http"):
            try:
                resp = session.get(source_url, timeout=15)
                if resp.status_code == 200:
                    closing_date = extract_closing_date(resp.text)
                    if closing_date:
                        source_url_yielded_date = True
                        scraped += 1
                        logger.info("  Scraped: %s → %s", title[:50], closing_date)
                time.sleep(1)  # Rate limit
            except Exception as e:
                logger.debug("  Failed to fetch %s: %s", source_url[:60], e)

        # Infer 3-month default if no scraped date
        if not closing_date and ex.get("opening_date") and ex.get("exhibition_type") != "permanent":
            try:
                opening = date.fromisoformat(ex["opening_date"])
                closing_date = (opening + timedelta(days=90)).isoformat()
                inferred += 1
                logger.debug("  Inferred: %s → %s (3-month default)", title[:50], closing_date)
            except ValueError:
                failed += 1
                continue

        if not closing_date:
            failed += 1
            continue

        # Track whether this was scraped or inferred
        was_inferred = closing_date and not source_url_yielded_date
        # (we set this flag based on which branch produced the date)

        if not args.dry_run:
            update_data: dict = {"closing_date": closing_date}

            # Tag inferred dates with provenance metadata
            if was_inferred:
                metadata = ex.get("metadata") or {}
                metadata["closing_date_inferred"] = True
                update_data["metadata"] = metadata

            client.table("exhibitions").update(update_data).eq("id", ex["id"]).execute()

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total processed: %d", len(exhibitions))
    logger.info("Scraped from source_url: %d", scraped)
    logger.info("Inferred (3-month default): %d", inferred)
    logger.info("No date found: %d", failed)

    if args.dry_run:
        logger.info("DRY RUN — no changes written.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_closing_date_extraction.py -v
```

- [ ] **Step 5: Test with dry-run**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/exhibition_closing_dates.py --dry-run --limit 10
```

Expected: Shows scraping attempts and inferred dates. Check that date formats are correct.

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/exhibition_closing_dates.py crawlers/tests/test_closing_date_extraction.py
git commit -m "feat: closing date backfill — scrape source pages + 3-month inference"
```

---

### Task 9: Artist Name Validation Gate

**Files:**
- Modify: `crawlers/artists.py:64-92`
- Create: `crawlers/tests/test_artist_validation.py`

Add a validation gate to `get_or_create_artist()` that rejects garbage names before creating records. This prevents the ~30% junk data in `exhibition_artists` from polluting the artists table.

**Context:** Read `crawlers/artists.py`. The `exhibition_artists` table has known garbage: "ARTISTS" x13, exhibition titles stored as names, bare dates ("2016"), pipe-separated strings, UI elements. The validation function must catch these patterns.

- [ ] **Step 1: Write the failing tests**

Create `crawlers/tests/test_artist_validation.py`:

```python
"""Tests for artist name validation gate."""

from artists import validate_artist_name


class TestRejectGarbage:
    def test_blocklist_names(self):
        assert not validate_artist_name("ARTISTS")
        assert not validate_artist_name("Various Artists")
        assert not validate_artist_name("Group Exhibition")
        assert not validate_artist_name("TBD")
        assert not validate_artist_name("TBA")

    def test_all_caps_single_word(self):
        assert not validate_artist_name("ARTISTS")
        assert not validate_artist_name("EXHIBITION")
        assert not validate_artist_name("GALLERY")

    def test_pipe_characters(self):
        assert not validate_artist_name("Artist One | Artist Two")
        assert not validate_artist_name("Name|Other")

    def test_purely_numeric(self):
        assert not validate_artist_name("2016")
        assert not validate_artist_name("12345")

    def test_too_short(self):
        assert not validate_artist_name("")
        assert not validate_artist_name("  ")
        assert not validate_artist_name("AB")

    def test_too_long(self):
        assert not validate_artist_name("A" * 201)


class TestAcceptValid:
    def test_normal_names(self):
        assert validate_artist_name("Jean Shon")
        assert validate_artist_name("Radcliffe Bailey")
        assert validate_artist_name("Kara Walker")

    def test_hyphenated_names(self):
        assert validate_artist_name("Jean-Michel Basquiat")

    def test_single_word_names_not_all_caps(self):
        assert validate_artist_name("Banksy")
        assert validate_artist_name("Christo")

    def test_names_with_suffixes(self):
        assert validate_artist_name("John Smith Jr.")
        assert validate_artist_name("Jane Doe III")

    def test_all_caps_multi_word_names(self):
        """Multi-word all-caps names are OK (some galleries format names this way)."""
        assert validate_artist_name("KARA WALKER")
        assert validate_artist_name("JEAN SHON")
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_artist_validation.py -v
```

Expected: ImportError — `validate_artist_name` doesn't exist yet.

- [ ] **Step 3: Implement validate_artist_name()**

In `crawlers/artists.py`, add the validation function after `normalize_artist_name()`:

```python
# Blocklist of known non-person strings
_ARTIST_BLOCKLIST = frozenset(s.lower() for s in [
    "ARTISTS", "Various Artists", "Group Exhibition", "TBD", "TBA",
    "Unknown", "Unknown Artist", "Anonymous", "N/A", "None",
    "Staff", "Volunteer", "View fullsize", "Read More",
])


def validate_artist_name(name: str) -> bool:
    """Check whether a string is a plausible artist name.

    Returns True if valid, False if it should be rejected.
    Rejects: blocklist matches, pipe chars, purely numeric,
    all-caps single words, too short (<3), too long (>200).
    """
    name = name.strip()

    # Length checks
    if len(name) < 3 or len(name) > 200:
        return False

    # Blocklist (case-insensitive)
    if name.lower() in _ARTIST_BLOCKLIST:
        return False

    # Pipe characters (concatenated lists)
    if "|" in name:
        return False

    # Purely numeric
    if name.isdigit():
        return False

    # All-caps single word (generic labels like "ARTISTS", "GALLERY")
    words = name.split()
    if len(words) == 1 and name.isupper():
        return False

    return True
```

- [ ] **Step 4: Wire validation into get_or_create_artist()**

In `get_or_create_artist()`, add a validation check before the slug generation:

```python
def get_or_create_artist(
    name: str,
    discipline: str = "musician",
) -> dict:
    """Find artist by slug or create a new record."""
    from db import get_client

    if not validate_artist_name(name):
        raise ValueError(f"Invalid artist name rejected by validation: {name!r}")

    # ... rest of function unchanged
```

- [ ] **Step 5: Run all artist tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_artist_validation.py tests/test_artist_normalization.py -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/artists.py crawlers/tests/test_artist_validation.py
git commit -m "feat: artist name validation gate — reject garbage before record creation"
```

---

### Task 10: Artist extra_fields + Discipline Collision Handling

**Files:**
- Modify: `crawlers/artists.py:64-92`
- Modify: `crawlers/tests/test_artist_validation.py` (add new test class)

Extend `get_or_create_artist()` with `extra_fields` parameter and discipline collision resolution.

**Context:** Read `crawlers/artists.py`. The spec requires:
1. `extra_fields: dict = None` parameter merged into insert payload (bio, image_url, website)
2. On "get" path: update null fields with provided extra_fields (don't overwrite existing data)
3. If existing record has `discipline='musician'` and caller passes `discipline='visual_artist'`, overwrite

- [ ] **Step 1: Add tests for extra_fields and discipline collision**

Append to `crawlers/tests/test_artist_validation.py`:

```python
class TestExtraFieldsSignature:
    """Verify get_or_create_artist accepts extra_fields parameter."""

    def test_extra_fields_param_exists(self):
        import inspect
        from artists import get_or_create_artist
        sig = inspect.signature(get_or_create_artist)
        assert "extra_fields" in sig.parameters
        assert sig.parameters["extra_fields"].default is None
```

- [ ] **Step 2: Implement extra_fields and discipline collision**

Modify `get_or_create_artist()` in `crawlers/artists.py`:

```python
def get_or_create_artist(
    name: str,
    discipline: str = "musician",
    extra_fields: dict | None = None,
) -> dict:
    """Find artist by slug or create a new record.

    extra_fields: optional dict merged into insert payload (e.g., bio, image_url, website).
    On the "get" path: updates null fields with extra_fields values (backfill-safe).
    Discipline collision: if existing record has discipline='musician' and caller
    passes 'visual_artist', overwrites — resolves slug collisions from event pipeline.
    """
    from db import get_client

    if not validate_artist_name(name):
        raise ValueError(f"Invalid artist name rejected by validation: {name!r}")

    slug = slugify_artist(name)
    if not slug:
        raise ValueError(f"Cannot slugify artist name: {name!r}")

    client = get_client()

    # Try to find existing
    result = client.table("artists").select("*").eq("slug", slug).execute()
    if result.data:
        artist = result.data[0]
        updates: dict = {}

        # Discipline collision: musician → visual_artist upgrade
        if (
            artist.get("discipline") == "musician"
            and discipline == "visual_artist"
        ):
            updates["discipline"] = "visual_artist"

        # Backfill null fields from extra_fields
        if extra_fields:
            for key, value in extra_fields.items():
                if value and not artist.get(key):
                    updates[key] = value

        if updates:
            from datetime import datetime, timezone
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            client.table("artists").update(updates).eq("id", artist["id"]).execute()
            artist.update(updates)

        return artist

    # Create new
    payload = {
        "name": name.strip(),
        "slug": slug,
        "discipline": discipline,
    }
    if extra_fields:
        for key, value in extra_fields.items():
            if value:
                payload[key] = value

    result = client.table("artists").insert(payload).execute()
    return result.data[0]
```

- [ ] **Step 3: Run tests**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/test_artist_validation.py tests/test_artist_normalization.py -v
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/artists.py crawlers/tests/test_artist_validation.py
git commit -m "feat: artist extra_fields parameter + discipline collision handling"
```

---

### Task 11: Artist Roster Scraper

**Files:**
- Create: `crawlers/scripts/artist_roster_scraper.py`

Scrape artist profiles from gallery websites — roster pages for commercial galleries, exhibition detail pages for institutions.

**Context:** Read `crawlers/artists.py` for `get_or_create_artist()`, `normalize_artist_name()`, `validate_artist_name()`. Read the artist roster sources table in the spec. Read `crawlers/sources/_exhibitions_base.py` for `_USER_AGENT` and `_DETAIL_DELAY_S`.

**Important:** Before building each gallery scraper, fetch the page to verify it exists and has artist data. Rate-limit to 1s between requests per domain. Target: 200+ artist profiles.

- [ ] **Step 1: Build the scraper framework**

Create `crawlers/scripts/artist_roster_scraper.py`:

```python
"""
Scrape visual artist profiles from gallery websites.

For each gallery:
1. Fetch artist roster page or exhibition detail pages
2. Extract artist names, bios, images, websites
3. Create artist records via get_or_create_artist(discipline="visual_artist")

Run: cd crawlers && PYTHONPATH=. python3 scripts/artist_roster_scraper.py [--dry-run] [--gallery SLUG]
"""

import argparse
import logging
import re
import time
from typing import Optional

import requests
from bs4 import BeautifulSoup

from artists import get_or_create_artist, normalize_artist_name, validate_artist_name
from db.client import get_client, writes_enabled

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
)
_DELAY = 1.0


def _make_session() -> requests.Session:
    session = requests.Session()
    session.headers.update({"User-Agent": _USER_AGENT})
    return session


# -----------------------------------------------------------------------
# Gallery-specific scrapers
# -----------------------------------------------------------------------

def scrape_kai_lin_art(session: requests.Session) -> list[dict]:
    """Scrape artist roster from kailinart.com."""
    artists = []
    url = "https://www.kailinart.com/artists"
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Look for artist name links in the roster page
        # Kai Lin Art typically lists artists with headshots and names
        for link in soup.find_all("a", href=True):
            href = link.get("href", "")
            if "/artists/" not in href or href.endswith("/artists") or href.endswith("/artists/"):
                continue

            name = link.get_text(strip=True)
            if not name or not validate_artist_name(name):
                continue

            artist_url = href if href.startswith("http") else f"https://www.kailinart.com{href}"

            # Try to get image from nearby img tag
            img = link.find("img")
            image_url = img.get("src") if img else None

            artists.append({
                "name": normalize_artist_name(name),
                "website": artist_url,
                "image_url": image_url,
            })

            time.sleep(_DELAY)

    except Exception as e:
        logger.warning("Failed to scrape Kai Lin Art artists: %s", e)

    return artists


def scrape_atlanta_contemporary(session: requests.Session) -> list[dict]:
    """Scrape artist archive from atlantacontemporary.org."""
    artists = []
    url = "https://atlantacontemporary.org/exhibitions"
    try:
        resp = session.get(url, timeout=15)
        resp.raise_for_status()
        soup = BeautifulSoup(resp.text, "html.parser")

        # Atlanta Contemporary lists artists per exhibition
        # Extract artist names from exhibition descriptions
        for ex in soup.find_all(["h2", "h3", "h4"]):
            text = ex.get_text(strip=True)
            # Look for "Artist Name: Exhibition Title" pattern
            if ":" in text:
                name_part = text.split(":")[0].strip()
                if validate_artist_name(name_part):
                    artists.append({
                        "name": normalize_artist_name(name_part),
                    })

    except Exception as e:
        logger.warning("Failed to scrape Atlanta Contemporary: %s", e)

    return artists


def scrape_exhibition_artists_from_db() -> list[dict]:
    """Extract unique artist names from exhibition_artists table.

    This is the most reliable source — these names are already associated
    with exhibitions in our database, just missing artist_id FKs.
    """
    client = get_client()
    result = client.table("exhibition_artists").select(
        "artist_name"
    ).is_("artist_id", "null").execute()

    seen = set()
    artists = []
    for row in result.data or []:
        name = normalize_artist_name(row.get("artist_name", ""))
        if not name or name.lower() in seen:
            continue
        if not validate_artist_name(name):
            continue
        seen.add(name.lower())
        artists.append({"name": name})

    return artists


# Registry of gallery scrapers
GALLERY_SCRAPERS = {
    "kai-lin-art": scrape_kai_lin_art,
    "atlanta-contemporary": scrape_atlanta_contemporary,
    # Add more gallery scrapers here as they're built:
    # "besharat": scrape_besharat,
    # "high-museum": scrape_high_museum,
    # "moda": scrape_moda,
    # "welch-gsu": scrape_welch_gsu,
    # "adam": scrape_adam,
}


def main():
    parser = argparse.ArgumentParser(description="Scrape artist rosters from galleries")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--gallery", help="Scrape only this gallery (slug)")
    parser.add_argument("--include-db", action="store_true",
                        help="Also process names from exhibition_artists table")
    args = parser.parse_args()

    session = _make_session()
    all_artists: list[dict] = []

    # Scrape galleries
    galleries = GALLERY_SCRAPERS
    if args.gallery:
        if args.gallery not in galleries:
            logger.error("Unknown gallery: %s. Available: %s",
                         args.gallery, ", ".join(galleries.keys()))
            return
        galleries = {args.gallery: galleries[args.gallery]}

    for slug, scraper in galleries.items():
        logger.info("Scraping %s...", slug)
        if scraper.__code__.co_varnames[0] == "session":
            artists = scraper(session)
        else:
            artists = scraper()
        logger.info("  Found %d artists", len(artists))
        all_artists.extend(artists)

    # Also process exhibition_artists table names
    if args.include_db:
        logger.info("Processing exhibition_artists table...")
        db_artists = scrape_exhibition_artists_from_db()
        logger.info("  Found %d valid artist names", len(db_artists))
        all_artists.extend(db_artists)

    # Deduplicate by normalized name
    seen = set()
    unique = []
    for a in all_artists:
        key = a["name"].lower()
        if key not in seen:
            seen.add(key)
            unique.append(a)

    logger.info("")
    logger.info("Total unique artists: %d", len(unique))

    if args.dry_run:
        for a in unique[:20]:
            logger.info("  %s", a["name"])
        if len(unique) > 20:
            logger.info("  ... and %d more", len(unique) - 20)
        logger.info("DRY RUN — no records created.")
        return

    # Create artist records
    created = 0
    updated = 0
    failed = 0

    for a in unique:
        try:
            extra_fields = {}
            if a.get("bio"):
                extra_fields["bio"] = a["bio"][:500]
            if a.get("image_url"):
                extra_fields["image_url"] = a["image_url"]
            if a.get("website"):
                extra_fields["website"] = a["website"]

            result = get_or_create_artist(
                a["name"],
                discipline="visual_artist",
                extra_fields=extra_fields or None,
            )
            if result:
                created += 1
        except ValueError as e:
            logger.debug("Skipped %s: %s", a["name"], e)
            failed += 1
        except Exception as e:
            logger.warning("Failed to create %s: %s", a["name"], e)
            failed += 1

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Created/updated: %d", created)
    logger.info("Failed/skipped: %d", failed)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the scraper with --include-db --dry-run first**

The `--include-db` flag processes names already in `exhibition_artists` — these are the lowest-hanging fruit since they're already associated with exhibitions.

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/artist_roster_scraper.py --include-db --dry-run
```

- [ ] **Step 3: Run for real**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/artist_roster_scraper.py --include-db
```

- [ ] **Step 4: Add more gallery scrapers**

For each gallery in the spec table, verify the roster page exists and add a scraper function to the `GALLERY_SCRAPERS` registry. Priority order:
1. Kai Lin Art (36 exhibitions)
2. High Museum of Art (23 exhibitions)
3. Atlanta Contemporary (14 exhibitions)
4. Besharat Contemporary (14 exhibitions)
5. MODA (12 exhibitions)
6. ADAM (6 exhibitions)

Skip College Football HoF (not visual art).

Each scraper follows the same pattern: fetch page → parse artist names → return list of dicts with name, bio, image_url, website.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/artist_roster_scraper.py
git commit -m "feat: artist roster scraper — gallery websites + exhibition_artists backfill"
```

---

### Task 12: Exhibition Artist FK Backfill

**Files:**
- Create: `crawlers/scripts/backfill_exhibition_artist_fks.py`

Resolve null `artist_id` FKs in `exhibition_artists` table by matching `artist_name` against the artists table.

**Context:** Read `crawlers/artists.py` for `normalize_artist_name()`, `slugify_artist()`, `validate_artist_name()`. After Task 11 runs, the artists table should have visual artist records. This script links them to their exhibition appearances.

- [ ] **Step 1: Write the backfill script**

Create `crawlers/scripts/backfill_exhibition_artist_fks.py`:

```python
"""
Resolve null artist_id FKs in exhibition_artists.

For each row where artist_id IS NULL:
1. Normalize the artist_name
2. Validate it (skip garbage)
3. Look up by slug in artists table
4. Set the FK if found

Run: cd crawlers && PYTHONPATH=. python3 scripts/backfill_exhibition_artist_fks.py [--dry-run]
"""

import argparse
import logging

from artists import normalize_artist_name, slugify_artist, validate_artist_name
from db.client import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition_artists.artist_id FKs")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    client = get_client()

    # Get all unlinked exhibition_artists
    result = client.table("exhibition_artists").select(
        "id, artist_name, exhibition_id"
    ).is_("artist_id", "null").execute()

    rows = result.data or []
    logger.info("Found %d unlinked exhibition_artist rows", len(rows))

    linked = 0
    skipped_invalid = 0
    not_found = 0

    for row in rows:
        raw_name = row.get("artist_name", "")
        normalized = normalize_artist_name(raw_name)

        if not normalized or not validate_artist_name(normalized):
            skipped_invalid += 1
            logger.debug("  Skipped invalid: %r", raw_name)
            continue

        slug = slugify_artist(normalized)
        if not slug:
            skipped_invalid += 1
            continue

        # Look up artist by slug
        artist_result = client.table("artists").select("id").eq("slug", slug).limit(1).execute()

        if not artist_result.data:
            not_found += 1
            logger.debug("  Not found: %r (slug=%s)", normalized, slug)
            continue

        artist_id = artist_result.data[0]["id"]

        if not args.dry_run:
            client.table("exhibition_artists").update(
                {"artist_id": artist_id}
            ).eq("id", row["id"]).execute()

        linked += 1
        logger.debug("  Linked: %r → %s", normalized, artist_id)

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total unlinked rows: %d", len(rows))
    logger.info("Linked: %d", linked)
    logger.info("Skipped (invalid name): %d", skipped_invalid)
    logger.info("Not found in artists table: %d", not_found)

    if args.dry_run:
        logger.info("DRY RUN — no changes written.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test with dry-run**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/backfill_exhibition_artist_fks.py --dry-run
```

- [ ] **Step 3: Run for real**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 scripts/backfill_exhibition_artist_fks.py
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add crawlers/scripts/backfill_exhibition_artist_fks.py
git commit -m "feat: backfill exhibition_artists FK links to artists table"
```

---

### Task 13: Portal Artists RPC Migration

**Files:**
- Create: `supabase/migrations/20260326000003_get_portal_artists_rpc.sql`

Create the `get_portal_artists` Supabase RPC function. This does the multi-table join that the API route will call: `artists` → `exhibition_artists` → `exhibitions` → `sources` (filtered by portal-accessible sources).

**Context:** Read `supabase/migrations/20260325900001_exhibition_source_registrations.sql` for how sources are registered. The `portal_source_access` materialized view provides the source IDs accessible to each portal. The RPC returns artists with `exhibition_count` (portal-scoped) and `total_count` via window function.

- [ ] **Step 1: Write the RPC migration**

Create `supabase/migrations/20260326000003_get_portal_artists_rpc.sql`:

```sql
-- RPC: get_portal_artists
-- Returns visual artists visible to a portal, with portal-scoped exhibition counts.
-- Join path: artists → exhibition_artists → exhibitions (filtered by source_id).

CREATE OR REPLACE FUNCTION get_portal_artists(
  p_portal_id UUID,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_discipline TEXT DEFAULT 'visual_artist',
  p_q TEXT DEFAULT NULL,
  p_medium TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  discipline TEXT,
  bio TEXT,
  image_url TEXT,
  website TEXT,
  is_verified BOOLEAN,
  exhibition_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH accessible_sources AS (
    SELECT psa.source_id
    FROM portal_source_access psa
    WHERE psa.portal_id = p_portal_id
  ),
  portal_exhibitions AS (
    SELECT e.id AS exhibition_id, ea.artist_id
    FROM exhibitions e
    JOIN exhibition_artists ea ON ea.exhibition_id = e.id
    WHERE e.source_id IN (SELECT source_id FROM accessible_sources)
      AND e.is_active = true
      AND ea.artist_id IS NOT NULL
      AND (p_medium IS NULL OR e.medium = p_medium)
  ),
  artist_stats AS (
    SELECT
      pe.artist_id,
      COUNT(DISTINCT pe.exhibition_id) AS ex_count
    FROM portal_exhibitions pe
    GROUP BY pe.artist_id
  )
  SELECT
    a.id,
    a.name,
    a.slug,
    a.discipline,
    a.bio,
    a.image_url,
    a.website,
    a.is_verified,
    COALESCE(ast.ex_count, 0) AS exhibition_count,
    COUNT(*) OVER() AS total_count
  FROM artists a
  JOIN artist_stats ast ON ast.artist_id = a.id
  WHERE (p_discipline IS NULL OR a.discipline = p_discipline)
    AND (p_q IS NULL OR a.name ILIKE '%' || p_q || '%')
  ORDER BY ast.ex_count DESC, a.name ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION get_portal_artists TO anon, authenticated;
```

- [ ] **Step 2: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add supabase/migrations/20260326000003_get_portal_artists_rpc.sql
git commit -m "feat: get_portal_artists RPC — portal-scoped artist listing with exhibition counts"
```

---

### Task 14: Artists List API Route

**Files:**
- Create: `web/app/api/artists/route.ts`

Build `GET /api/artists` — list artists with filters, portal-scoped via the RPC.

**Context:** Read `web/app/api/exhibitions/route.ts` for the exact API pattern to follow (portal resolution, rate limiting, response format). Read `web/lib/api-utils.ts` for validation helpers. Read `web/CLAUDE.md` for API route requirements.

The route calls the `get_portal_artists` RPC created in Task 13. The RPC handles the complex multi-table join and portal scoping.

- [ ] **Step 1: Create the API route**

Create `web/app/api/artists/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  errorResponse,
  isValidString,
  parseIntParam,
  escapeSQLPattern,
} from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { resolvePortalQueryContext, getVerticalFromRequest } from "@/lib/portal-query-context";

export const dynamic = "force-dynamic";

// GET /api/artists?portal=arts-atlanta&discipline=visual_artist&medium=photography&q=search&limit=20&offset=0
export async function GET(request: NextRequest) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { searchParams } = new URL(request.url);
  const portalParam = searchParams.get("portal");
  if (!portalParam || !isValidString(portalParam, 1, 50)) {
    return NextResponse.json(
      { error: "portal parameter is required" },
      { status: 400 }
    );
  }

  const limit = Math.min(parseIntParam(searchParams.get("limit")) ?? 20, 100);
  const offset = Math.max(parseIntParam(searchParams.get("offset")) ?? 0, 0);
  const discipline = searchParams.get("discipline") ?? "visual_artist";
  const medium = searchParams.get("medium");
  const q = searchParams.get("q");

  try {
    const supabase = await createClient();
    const portalContext = await resolvePortalQueryContext(
      supabase,
      searchParams,
      getVerticalFromRequest(request)
    );
    if (!portalContext.portalId) {
      return NextResponse.json({ error: "Portal not found" }, { status: 404 });
    }

    // Call the RPC
    const { data, error } = await supabase.rpc("get_portal_artists", {
      p_portal_id: portalContext.portalId,
      p_limit: limit,
      p_offset: offset,
      p_discipline: isValidString(discipline, 1, 50) ? discipline : "visual_artist",
      p_medium: medium && isValidString(medium, 1, 50) ? medium : null,
      p_q: q && isValidString(q, 1, 200) ? escapeSQLPattern(q) : null,
    });

    if (error) {
      return errorResponse(error, "GET /api/artists");
    }

    type ArtistRow = {
      id: string;
      name: string;
      slug: string;
      discipline: string;
      bio: string | null;
      image_url: string | null;
      website: string | null;
      is_verified: boolean;
      exhibition_count: number;
      total_count: number;
    };

    const rows = (data ?? []) as ArtistRow[];
    const total = rows.length > 0 ? rows[0].total_count : 0;

    // Strip total_count from individual rows (it's a window function artifact)
    const artists = rows.map(({ total_count, ...artist }) => artist);

    return NextResponse.json(
      { artists, total, offset, limit },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/artists");
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web
npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors from the new file. If there are type issues with the RPC call, cast with `as never` per project convention.

- [ ] **Step 3: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/app/api/artists/route.ts
git commit -m "feat: GET /api/artists — portal-scoped artist listing via RPC"
```

---

### Task 15: Artists Detail API Route

**Files:**
- Create: `web/app/api/artists/[slug]/route.ts`

Build `GET /api/artists/:slug` — full artist profile with exhibition history.

**Context:** Read `web/app/api/exhibitions/[slug]/route.ts` for the detail route pattern. Read `web/lib/artists.ts` for the existing `getArtistExhibitions()` function — it already does the exhibition_artists → exhibitions join with venue data. The detail route uses this existing function.

- [ ] **Step 1: Create the detail API route**

Create `web/app/api/artists/[slug]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse, isValidString } from "@/lib/api-utils";
import { applyRateLimit, RATE_LIMITS, getClientIdentifier } from "@/lib/rate-limit";
import { getArtistExhibitions } from "@/lib/artists";

export const dynamic = "force-dynamic";

// GET /api/artists/:slug
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const rateLimitResult = await applyRateLimit(
    request,
    RATE_LIMITS.read,
    getClientIdentifier(request)
  );
  if (rateLimitResult) return rateLimitResult;

  const { slug } = await params;
  if (!isValidString(slug, 1, 200)) {
    return NextResponse.json({ error: "Invalid slug" }, { status: 400 });
  }

  try {
    const supabase = await createClient();

    // Fetch artist profile
    const { data: artist, error } = await supabase
      .from("artists")
      .select(
        "id, name, slug, discipline, bio, image_url, website, is_verified, created_at"
      )
      .eq("slug", slug)
      .maybeSingle();

    if (error) return errorResponse(error, "GET /api/artists/:slug");
    if (!artist) {
      return NextResponse.json({ error: "Artist not found" }, { status: 404 });
    }

    const artistData = artist as {
      id: string;
      name: string;
      slug: string;
      discipline: string;
      bio: string | null;
      image_url: string | null;
      website: string | null;
      is_verified: boolean;
      created_at: string;
    };

    // Fetch exhibition history using existing function
    const exhibitions = await getArtistExhibitions(artistData.id);

    return NextResponse.json(
      {
        artist: {
          ...artistData,
          exhibitions,
        },
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    return errorResponse(error, "GET /api/artists/:slug");
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/coach/Projects/LostCity/web
npx tsc --noEmit 2>&1 | head -30
```

- [ ] **Step 3: Run full test suite**

```bash
cd /Users/coach/Projects/LostCity/crawlers
PYTHONPATH=. python3 -m pytest tests/ -v
```

```bash
cd /Users/coach/Projects/LostCity/web
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
cd /Users/coach/Projects/LostCity
git add web/app/api/artists/[slug]/route.ts
git commit -m "feat: GET /api/artists/:slug — artist detail with exhibition history"
```

---

## Verification Checklist

After all tasks complete, verify the following success criteria from the spec:

| Criteria | How to verify |
|----------|---------------|
| All 6 crawlers produce >0 exhibitions | `python3 main.py --source <slug> --dry-run` for each |
| Medium populated on 50%+ exhibitions | `python3 scripts/exhibition_medium_inference.py --dry-run` |
| Closing date coverage <25% null | `python3 scripts/exhibition_closing_dates.py --dry-run` |
| 200+ visual artist profiles | Query `artists` table where `discipline='visual_artist'` |
| Artist browse API returns data | `curl localhost:3000/api/artists?portal=arts-atlanta` |
| Artist detail API returns exhibitions | `curl localhost:3000/api/artists/artist-slug?portal=arts-atlanta` |
| TypeScript builds clean | `cd web && npx tsc --noEmit` |
| Python tests pass | `cd crawlers && PYTHONPATH=. python3 -m pytest tests/ -v` |
