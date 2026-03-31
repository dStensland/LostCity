# LLM Description Extraction (Festivals + Events) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Codex-compatible batch LLM description extraction to `enrich_festivals.py` for festivals and events with NULL or short descriptions.

**Architecture:** Extends `enrich_festivals.py` with three new flags (`--prepare-tasks`, `--extract-tasks`, `--apply-results`) plus `--entity festivals|events`. Shared utilities: `extract_visible_text()`, `passes_grounding_check()`, centralized prompts. Task/result files in `crawlers/llm-tasks/{entity}/` and `crawlers/llm-results/{entity}/` (gitignored). Festivals use slug as filename, events use numeric ID.

**Tech Stack:** Python 3, Supabase (via supabase-py), BeautifulSoup, `llm_client.generate_text()`

**Spec:** `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md` (Phase C.2)

**Key existing infrastructure:**
- `generate_text(system_prompt, user_message) -> str` in `crawlers/llm_client.py`
- `fetch_html(url, FetchConfig) -> (str, Optional[str])` in `crawlers/pipeline/fetch.py`
- `classify_description(desc) -> "junk"|"boilerplate"|"good"` in `crawlers/description_quality.py`
- `is_synthetic_description(desc) -> bool` in `crawlers/description_quality.py`
- DB client: `from db import get_client`
- Festivals: `id` (text slug PK), `name`, `website`, `description`
- Events: `id` (int PK), `title`, `source_url`, `description`, `source_id`

---

### Task 1: Add extraction prompts, text extractor, and grounding check

**Files:**
- Modify: `crawlers/enrich_festivals.py`
- Create: `crawlers/tests/test_enrich_festivals_llm.py`

- [ ] **Step 1: Write tests**

Create `crawlers/tests/test_enrich_festivals_llm.py`:

```python
"""Tests for LLM description extraction helpers in enrich_festivals.py."""


def test_extract_visible_text_from_html():
    from enrich_festivals import extract_visible_text
    html = """
    <html>
    <head><title>Fest</title><style>body{color:red}</style></head>
    <body>
    <nav>Home | About | Tickets</nav>
    <main>
    <h1>Dragon Con</h1>
    <p>Annual multi-media convention in Atlanta celebrating sci-fi, fantasy, and pop culture.</p>
    <p>Four days of panels, cosplay, gaming, and more.</p>
    </main>
    <script>var x = 1;</script>
    <footer>Copyright 2026</footer>
    </body>
    </html>
    """
    text = extract_visible_text(html)
    assert "Annual multi-media convention" in text
    assert "Four days of panels" in text
    assert "var x = 1" not in text
    assert "color:red" not in text


def test_extract_visible_text_truncates():
    from enrich_festivals import extract_visible_text
    html = "<html><body><main><p>" + ("word " * 2000) + "</p></main></body></html>"
    text = extract_visible_text(html, max_chars=5000)
    assert len(text) <= 5000


def test_extract_visible_text_empty():
    from enrich_festivals import extract_visible_text
    assert extract_visible_text("") == ""
    assert extract_visible_text(None) == ""


def test_festival_prompt_defined():
    from enrich_festivals import FESTIVAL_EXTRACTION_PROMPT
    assert "2-3 sentence" in FESTIVAL_EXTRACTION_PROMPT
    assert "NULL" in FESTIVAL_EXTRACTION_PROMPT


def test_event_prompt_defined():
    from enrich_festivals import EVENT_EXTRACTION_PROMPT
    assert "2-3 sentence" in EVENT_EXTRACTION_PROMPT
    assert "NULL" in EVENT_EXTRACTION_PROMPT


def test_ground_check_passes_good_description():
    from enrich_festivals import passes_grounding_check
    source_text = "Dragon Con is an annual multi-media convention in Atlanta with cosplay, gaming, panels, and sci-fi."
    description = "Annual multi-media convention celebrating sci-fi, fantasy, and pop culture with cosplay and gaming."
    assert passes_grounding_check(description, source_text) is True


def test_ground_check_rejects_hallucination():
    from enrich_festivals import passes_grounding_check
    source_text = "Dragon Con is an annual convention in Atlanta."
    description = "Three-day music festival in Piedmont Park featuring over 50 bands and craft beer tastings."
    assert passes_grounding_check(description, source_text) is False


def test_ground_check_handles_empty():
    from enrich_festivals import passes_grounding_check
    assert passes_grounding_check("", "some text") is False
    assert passes_grounding_check("Good description.", "") is False
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_enrich_festivals_llm.py -v 2>&1 | tail -15`

Expected: FAIL — functions not defined.

- [ ] **Step 3: Implement prompts, text extractor, and grounding check**

Add to `crawlers/enrich_festivals.py` after the existing imports (around line 41), before the date extraction section:

```python
# ---------------------------------------------------------------------------
# LLM description extraction — shared utilities for festivals + events
# ---------------------------------------------------------------------------

FESTIVAL_EXTRACTION_PROMPT = """Extract a 2-3 sentence description of this festival from the page content below.

Rules:
- Focus on what makes it distinctive — the experience, the vibe, what attendees can expect
- Do NOT include: dates, times, pricing, location addresses, ticket URLs, or schedule details (these are displayed separately in the UI)
- Do NOT start with "The {name} is..." — vary the opening
- Write in present tense, editorial voice
- If the page doesn't contain enough information for a meaningful description, respond with exactly: NULL

Respond with ONLY the description text (or NULL). No JSON, no quotes, no extra formatting."""

EVENT_EXTRACTION_PROMPT = """Extract a 2-3 sentence description of this event from the page content below.

Rules:
- Focus on what the event is about — the experience, what attendees will do or see
- Do NOT include: dates, times, pricing, venue address, ticket URLs, or registration details (these are displayed separately in the UI)
- Do NOT start with "This event is..." or "Join us for..." — vary the opening
- Write in present tense, editorial voice
- If the page doesn't contain enough information for a meaningful description, respond with exactly: NULL

Respond with ONLY the description text (or NULL). No JSON, no quotes, no extra formatting."""


def _get_extraction_prompt(entity_type: str) -> str:
    if entity_type == "festival":
        return FESTIVAL_EXTRACTION_PROMPT
    return EVENT_EXTRACTION_PROMPT


def extract_visible_text(html: Optional[str], max_chars: int = 5000) -> str:
    """Extract visible text from HTML, stripping scripts/styles/nav/footer.

    Returns clean text suitable for LLM context, truncated to max_chars.
    """
    if not html:
        return ""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    # Remove non-content elements
    for tag in soup.find_all(["script", "style", "nav", "footer", "header", "noscript"]):
        tag.decompose()

    # Prefer main content area
    main = soup.find("main") or soup.find("article") or soup.find("[role='main']")
    target = main if main else soup.find("body") or soup

    text = re.sub(r"\s+", " ", target.get_text(separator=" ")).strip()
    return text[:max_chars]


def passes_grounding_check(description: str, source_text: str, min_matches: int = 2) -> bool:
    """Check that an LLM-generated description is grounded in source text.

    Extracts 2-3 word phrases from the description and checks that at least
    min_matches appear in the source text. Catches hallucinations that
    classify_description() would pass as "good".
    """
    if not description or not source_text:
        return False

    desc_lower = description.lower()
    source_lower = source_text.lower()

    # Build bigrams and trigrams from description
    words = re.findall(r"[a-z]{3,}", desc_lower)
    phrases = []
    for i in range(len(words) - 1):
        phrases.append(f"{words[i]} {words[i+1]}")
    for i in range(len(words) - 2):
        phrases.append(f"{words[i]} {words[i+1]} {words[i+2]}")

    # Filter out common English phrases
    common = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "has", "have", "been"}
    distinctive = [p for p in phrases if not all(w in common for w in p.split())]

    if not distinctive:
        return False

    matches = sum(1 for p in distinctive if p in source_lower)
    return matches >= min_matches
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_enrich_festivals_llm.py -v`

Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity && git add crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals_llm.py
git commit -m "feat(enrichment): add LLM extraction prompts, text extractor, and grounding check

Adds FESTIVAL_EXTRACTION_PROMPT, EVENT_EXTRACTION_PROMPT, extract_visible_text()
for preparing clean page text, and passes_grounding_check() to verify LLM
output is grounded in source material. Supports both festivals and events."
```

---

### Task 2: Add `--prepare-tasks` mode with entity support

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Add `prepare_llm_tasks()` with entity support**

Add before the `if __name__` block in `crawlers/enrich_festivals.py`:

```python
def _fetch_festivals_needing_descriptions(client, slug: Optional[str] = None) -> list[dict]:
    """Fetch festivals with NULL or short descriptions."""
    query = (
        client.table("festivals")
        .select("id,slug,name,website,description")
        .not_.is_("website", "null")
    )
    if slug:
        query = query.eq("slug", slug)
    all_rows = query.order("name").execute().data or []
    return [
        f for f in all_rows
        if not f.get("description") or len(str(f.get("description", ""))) < 50
    ]


def _fetch_events_needing_descriptions(client, limit: int = 5000) -> list[dict]:
    """Fetch events with NULL or short descriptions that have a source_url."""
    records = []
    offset = 0
    page_size = 1000
    while len(records) < limit:
        batch = (
            client.table("events")
            .select("id,title,source_url,description")
            .not_.is_("source_url", "null")
            .is_("canonical_event_id", "null")
            .range(offset, offset + page_size - 1)
            .execute()
            .data or []
        )
        for row in batch:
            desc = row.get("description") or ""
            if len(str(desc)) < 50:
                records.append(row)
                if len(records) >= limit:
                    break
        if len(batch) < page_size:
            break
        offset += page_size
    return records


def prepare_llm_tasks(entity_type: str = "festival", slug: Optional[str] = None,
                      render_js: bool = False, limit: int = 5000) -> None:
    """Fetch pages and write LLM task files for batch extraction.

    Writes one JSON file per entity to crawlers/llm-tasks/{entity_type}s/{key}.json.
    For festivals: key = slug, URL = website.
    For events: key = id, URL = source_url.
    """
    import json as _json

    client = get_client()

    if entity_type == "festival":
        entities = _fetch_festivals_needing_descriptions(client, slug)
    else:
        entities = _fetch_events_needing_descriptions(client, limit)

    task_dir = Path(__file__).parent / "llm-tasks" / f"{entity_type}s"
    task_dir.mkdir(parents=True, exist_ok=True)

    fetch_cfg = FetchConfig(timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded")

    logger.info(f"Preparing LLM tasks for {len(entities)} {entity_type}s")
    logger.info(f"{'=' * 70}")

    written = 0
    failed = 0

    for i, entity in enumerate(entities, 1):
        if entity_type == "festival":
            name = entity["name"]
            url = entity["website"]
            file_key = entity["slug"]
        else:
            name = entity.get("title", str(entity["id"]))
            url = entity["source_url"]
            file_key = str(entity["id"])

        prefix = f"[{i:3d}/{len(entities)}] {name[:40]:<40}"

        html, err = fetch_html(url, fetch_cfg)
        if err or not html:
            if not render_js:
                html, err = fetch_html(url, FetchConfig(timeout_ms=20000, render_js=True, wait_until="domcontentloaded"))
            if err or not html:
                logger.info(f"{prefix} FAIL ({err or 'empty'})")
                failed += 1
                time.sleep(0.5)
                continue

        page_text = extract_visible_text(html)
        if len(page_text) < 50:
            logger.info(f"{prefix} SKIP (page text too short: {len(page_text)} chars)")
            failed += 1
            time.sleep(0.5)
            continue

        task = {
            "entity_id": file_key,
            "entity_type": entity_type,
            "name": name,
            "source_url": url,
            "page_content": page_text,
            "current_description": entity.get("description"),
        }

        task_path = task_dir / f"{file_key}.json"
        task_path.write_text(_json.dumps(task, indent=2, ensure_ascii=False))
        logger.info(f"{prefix} wrote task ({len(page_text)} chars)")
        written += 1
        time.sleep(0.5)

    logger.info(f"\n{'=' * 70}")
    logger.info(f"Tasks written: {written} | Failed: {failed}")
    logger.info(f"Task directory: {task_dir}")
```

- [ ] **Step 2: Update argparse**

Replace the `if __name__` block:

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich festivals from their websites")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--slug", type=str, help="Enrich a single festival by slug")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if fields populated")
    parser.add_argument("--stale", action="store_true", help="Re-enrich stale/low-confidence data")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright for JS-heavy sites")
    parser.add_argument("--entity", choices=["festival", "event"], default="festival",
                        help="Entity type for LLM extraction (default: festival)")
    parser.add_argument("--limit", type=int, default=5000,
                        help="Max events to process (default: 5000, festivals ignored)")
    parser.add_argument("--prepare-tasks", action="store_true",
                        help="Fetch pages and write LLM task files")
    parser.add_argument("--extract-tasks", action="store_true",
                        help="Read task files, call LLM API, write result files")
    parser.add_argument("--apply-results", action="store_true",
                        help="Read LLM result files, quality-gate, and write to DB")
    args = parser.parse_args()

    if args.prepare_tasks:
        prepare_llm_tasks(entity_type=args.entity, slug=args.slug,
                          render_js=args.render_js, limit=args.limit)
    elif args.extract_tasks:
        extract_llm_tasks(entity_type=args.entity, slug=args.slug)
    elif args.apply_results:
        apply_llm_results(entity_type=args.entity, slug=args.slug, dry_run=args.dry_run)
    else:
        enrich_festivals(
            dry_run=args.dry_run,
            slug=args.slug,
            force=args.force,
            stale=args.stale,
            render_js=args.render_js,
        )
```

- [ ] **Step 3: Verify import**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -c "import enrich_festivals; print('Import OK')"`

- [ ] **Step 4: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(enrichment): add --prepare-tasks with --entity festival|event support

Fetches pages for festivals or events with NULL/short descriptions,
extracts visible text, writes JSON task files for LLM processing."
```

---

### Task 3: Add `--extract-tasks` mode (API)

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Implement `extract_llm_tasks()`**

Add after `prepare_llm_tasks()`:

```python
def extract_llm_tasks(entity_type: str = "festival", slug: Optional[str] = None) -> None:
    """Read task files and extract descriptions via LLM API.

    Reads from crawlers/llm-tasks/{entity_type}s/, calls generate_text(),
    writes results to crawlers/llm-results/{entity_type}s/{key}.json.
    """
    import json as _json
    from llm_client import generate_text

    task_dir = Path(__file__).parent / "llm-tasks" / f"{entity_type}s"
    result_dir = Path(__file__).parent / "llm-results" / f"{entity_type}s"
    result_dir.mkdir(parents=True, exist_ok=True)

    if slug:
        task_files = [task_dir / f"{slug}.json"]
        task_files = [f for f in task_files if f.exists()]
    else:
        task_files = sorted(task_dir.glob("*.json"))

    if not task_files:
        logger.info(f"No task files found in {task_dir}")
        return

    prompt = _get_extraction_prompt(entity_type)

    logger.info(f"Extracting descriptions for {len(task_files)} {entity_type}s via API")
    logger.info(f"{'=' * 70}")

    extracted = 0
    failed = 0

    for i, task_path in enumerate(task_files, 1):
        task = _json.loads(task_path.read_text())
        name = task.get("name", task_path.stem)
        prefix = f"[{i:3d}/{len(task_files)}] {name[:40]:<40}"

        page_content = task.get("page_content", "")
        if not page_content:
            logger.info(f"{prefix} SKIP (no page content)")
            failed += 1
            continue

        label = "Festival" if entity_type == "festival" else "Event"
        user_message = f"{label}: {name}\nURL: {task.get('source_url', '')}\n\nPage content:\n{page_content}"

        try:
            response = generate_text(prompt, user_message)
            response = response.strip()

            if not response or response.upper() == "NULL":
                logger.info(f"{prefix} LLM returned NULL")
                result = {"description": None, "confidence": 0.0, "source_url": task.get("source_url", "")}
            else:
                result = {"description": response, "confidence": 0.8, "source_url": task.get("source_url", "")}
                logger.info(f"{prefix} extracted ({len(response)} chars)")
                extracted += 1
        except Exception as e:
            logger.info(f"{prefix} FAIL ({e})")
            result = {"description": None, "confidence": 0.0, "source_url": task.get("source_url", ""), "error": str(e)}
            failed += 1

        result_path = result_dir / f"{task_path.stem}.json"
        result_path.write_text(_json.dumps(result, indent=2, ensure_ascii=False))

    logger.info(f"\n{'=' * 70}")
    logger.info(f"Extracted: {extracted} | Failed/NULL: {failed}")
    logger.info(f"Results directory: {result_dir}")
```

- [ ] **Step 2: Verify import**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -c "import enrich_festivals; print('Import OK')"`

- [ ] **Step 3: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(enrichment): add --extract-tasks mode for API-based LLM extraction

Reads task files, calls generate_text() with entity-appropriate prompt,
writes result JSONs. Supports both festival and event entity types."
```

---

### Task 4: Add `--apply-results` mode

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Implement `apply_llm_results()`**

Add after `extract_llm_tasks()`:

```python
def apply_llm_results(entity_type: str = "festival", slug: Optional[str] = None,
                      dry_run: bool = False) -> None:
    """Read LLM result files, quality-gate, and write to DB.

    Quality gates:
    1. classify_description() must return "good"
    2. Length >= 50 chars
    3. Grounding check — key phrases must appear in source text
    """
    import json as _json
    from description_quality import classify_description

    client = get_client()
    result_dir = Path(__file__).parent / "llm-results" / f"{entity_type}s"
    task_dir = Path(__file__).parent / "llm-tasks" / f"{entity_type}s"

    if slug:
        result_files = [result_dir / f"{slug}.json"]
        result_files = [f for f in result_files if f.exists()]
    else:
        result_files = sorted(result_dir.glob("*.json"))

    if not result_files:
        logger.info(f"No result files found in {result_dir}")
        return

    table = "festivals" if entity_type == "festival" else "events"
    id_column = "slug" if entity_type == "festival" else "id"

    logger.info(f"Applying {len(result_files)} {entity_type} results ({'DRY RUN' if dry_run else 'LIVE'})")
    logger.info(f"{'=' * 70}")

    accepted = 0
    rejected = 0
    skipped = 0

    for i, result_path in enumerate(result_files, 1):
        entity_key = result_path.stem
        result = _json.loads(result_path.read_text())
        description = result.get("description")
        prefix = f"[{i:3d}/{len(result_files)}] {entity_key[:40]:<40}"

        if not description:
            logger.info(f"{prefix} SKIP (no description)")
            skipped += 1
            continue

        # Quality gate 1: classify_description
        quality = classify_description(description)
        if quality != "good":
            logger.info(f"{prefix} REJECT (quality={quality}): {description[:80]}...")
            rejected += 1
            continue

        # Quality gate 2: length
        if len(description) < 50:
            logger.info(f"{prefix} REJECT (too short: {len(description)} chars)")
            rejected += 1
            continue

        # Quality gate 3: grounding check
        task_path = task_dir / f"{entity_key}.json"
        if task_path.exists():
            task = _json.loads(task_path.read_text())
            source_text = task.get("page_content", "")
            if source_text and not passes_grounding_check(description, source_text):
                logger.info(f"{prefix} REJECT (grounding): {description[:80]}...")
                rejected += 1
                continue

        # Accept — write to DB
        if not dry_run:
            # For events, id is an integer
            eq_value = entity_key if entity_type == "festival" else int(entity_key)
            client.table(table).update(
                {"description": description[:2000]}
            ).eq(id_column, eq_value).execute()

        logger.info(f"{prefix} ACCEPT ({len(description)} chars): {description[:80]}...")
        accepted += 1

    mode = "DRY RUN" if dry_run else "APPLIED"
    logger.info(f"\n{'=' * 70}")
    logger.info(f"[{mode}] Accepted: {accepted} | Rejected: {rejected} | Skipped: {skipped}")
```

- [ ] **Step 2: Verify import**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -c "import enrich_festivals; print('Import OK')"`

- [ ] **Step 3: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(enrichment): add --apply-results with quality gates for festivals and events

Reads LLM results, runs classify_description(), length, and grounding
checks. Writes accepted descriptions to festivals or events table.
Supports --dry-run and --entity festival|event."
```

---

### Task 5: Gitignore task/result directories

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add directories to gitignore**

Add to `/Users/coach/Projects/LostCity/.gitignore`:

```
# LLM extraction task/result files
crawlers/llm-tasks/
crawlers/llm-results/
crawlers/backups/
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore LLM task/result directories and crawler backups"
```

---

### Task 6: End-to-end verification

**Files:** None — verification checkpoint.

- [ ] **Step 1: Run prepare on a single festival**

```bash
cd /Users/coach/Projects/LostCity/crawlers && python3 enrich_festivals.py --prepare-tasks --entity festival --slug dragon-con
```

Expected: Creates `crawlers/llm-tasks/festivals/dragon-con.json`.

- [ ] **Step 2: Inspect the task file**

```bash
python3 -c "
import json
task = json.loads(open('llm-tasks/festivals/dragon-con.json').read())
print(f'Name: {task[\"name\"]}')
print(f'URL: {task[\"source_url\"]}')
print(f'Content length: {len(task[\"page_content\"])} chars')
print(f'First 200 chars: {task[\"page_content\"][:200]}')
"
```

Expected: Clean text, no HTML tags.

- [ ] **Step 3: Run extract (requires ANTHROPIC_API_KEY in .env)**

```bash
python3 enrich_festivals.py --extract-tasks --entity festival --slug dragon-con
```

Expected: Creates `crawlers/llm-results/festivals/dragon-con.json` with a description.

- [ ] **Step 4: Dry-run apply**

```bash
python3 enrich_festivals.py --apply-results --entity festival --slug dragon-con --dry-run
```

Expected: ACCEPT with description — passes quality gates.

- [ ] **Step 5: Apply for real**

```bash
python3 enrich_festivals.py --apply-results --entity festival --slug dragon-con
```

- [ ] **Step 6: Test events prepare (small batch)**

```bash
python3 enrich_festivals.py --prepare-tasks --entity event --limit 5
```

Expected: Creates 5 task files in `crawlers/llm-tasks/events/`.

- [ ] **Step 7: Verify event task file**

```bash
ls llm-tasks/events/ | head -5
python3 -c "
import json, glob
f = sorted(glob.glob('llm-tasks/events/*.json'))[0]
task = json.loads(open(f).read())
print(f'ID: {task[\"entity_id\"]}')
print(f'Name: {task[\"name\"]}')
print(f'URL: {task[\"source_url\"]}')
print(f'Content: {len(task[\"page_content\"])} chars')
"
```

## Codex Usage

After implementation, the Codex workflow is:

```bash
# Festivals
python3 enrich_festivals.py --prepare-tasks --entity festival
python3 enrich_festivals.py --extract-tasks --entity festival
python3 enrich_festivals.py --apply-results --entity festival --dry-run
python3 enrich_festivals.py --apply-results --entity festival

# Events (larger batch — use --limit to control)
python3 enrich_festivals.py --prepare-tasks --entity event --limit 1000
python3 enrich_festivals.py --extract-tasks --entity event
python3 enrich_festivals.py --apply-results --entity event --dry-run
python3 enrich_festivals.py --apply-results --entity event
```

Each step is independent. You can run `--prepare-tasks`, inspect the task files, then hand off `--extract-tasks` to Codex, then run `--apply-results` yourself.
