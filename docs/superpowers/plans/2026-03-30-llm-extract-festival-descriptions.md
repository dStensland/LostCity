# LLM Festival Description Extraction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Codex-compatible batch LLM extraction to `enrich_festivals.py` for festivals with NULL or short descriptions.

**Architecture:** Extends the existing `enrich_festivals.py` with three new flags: `--prepare-tasks` (serialize festivals + page text to JSON task files), `--extract-tasks` (API mode: read tasks, call Claude, write results), and `--apply-results` (read results, quality-gate, write to DB). The extraction prompt lives as a module constant. Task/result files use `crawlers/llm-tasks/` and `crawlers/llm-results/` directories (gitignored).

**Tech Stack:** Python 3, Supabase (via supabase-py), BeautifulSoup, `llm_client.generate_text()`

**Spec:** `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md` (Phase C.2)

---

### Task 1: Add extraction prompt constant and text extraction helper

**Files:**
- Modify: `crawlers/enrich_festivals.py`
- Test: `crawlers/tests/test_enrich_festivals_llm.py`

- [ ] **Step 1: Write tests for the text extraction helper**

Create `crawlers/tests/test_enrich_festivals_llm.py`:

```python
"""Tests for LLM description extraction helpers in enrich_festivals.py."""
import pytest


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
    # Should NOT include script, style, nav, or footer content
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


def test_extraction_prompt_is_defined():
    from enrich_festivals import DESCRIPTION_EXTRACTION_PROMPT
    assert "2-3 sentence" in DESCRIPTION_EXTRACTION_PROMPT
    assert "NULL" in DESCRIPTION_EXTRACTION_PROMPT


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

- [ ] **Step 3: Implement the prompt constant, text extractor, and grounding check**

Add to `crawlers/enrich_festivals.py` after the existing imports (around line 41), before the date extraction section:

```python
# ---------------------------------------------------------------------------
# LLM description extraction
# ---------------------------------------------------------------------------

DESCRIPTION_EXTRACTION_PROMPT = """Extract a 2-3 sentence description of this festival from the page content below.

Rules:
- Focus on what makes it distinctive — the experience, the vibe, what attendees can expect
- Do NOT include: dates, times, pricing, location addresses, ticket URLs, or schedule details (these are displayed separately in the UI)
- Do NOT start with "The {name} is..." — vary the opening
- Write in present tense, editorial voice
- If the page doesn't contain enough information for a meaningful description, respond with exactly: NULL

Respond with ONLY the description text (or NULL). No JSON, no quotes, no extra formatting."""


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

    Extracts noun phrases (2+ word sequences) from the description and checks
    that at least min_matches appear in the source text. This catches
    hallucinations that classify_description() would pass as "good".
    """
    if not description or not source_text:
        return False

    # Extract meaningful 2-3 word phrases from the description
    desc_lower = description.lower()
    source_lower = source_text.lower()

    # Split into words, build bigrams and trigrams
    words = re.findall(r"[a-z]{3,}", desc_lower)
    phrases = []
    for i in range(len(words) - 1):
        phrases.append(f"{words[i]} {words[i+1]}")
    for i in range(len(words) - 2):
        phrases.append(f"{words[i]} {words[i+1]} {words[i+2]}")

    # Filter to phrases that are distinctive (not common English)
    common = {"the", "and", "for", "with", "that", "this", "from", "are", "was", "has", "have", "been"}
    distinctive = [p for p in phrases if not all(w in common for w in p.split())]

    if not distinctive:
        return False

    matches = sum(1 for p in distinctive if p in source_lower)
    return matches >= min_matches
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -m pytest tests/test_enrich_festivals_llm.py -v`

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
cd /Users/coach/Projects/LostCity && git add crawlers/enrich_festivals.py crawlers/tests/test_enrich_festivals_llm.py
git commit -m "feat(festivals): add LLM extraction prompt, text extractor, and grounding check

Adds DESCRIPTION_EXTRACTION_PROMPT constant, extract_visible_text() for
preparing clean page text for LLM context, and passes_grounding_check()
to verify LLM output is grounded in source material."
```

---

### Task 2: Add `--prepare-tasks` mode

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Add the `--prepare-tasks` flag and implementation**

Add to argparse section at the bottom of `enrich_festivals.py` (around line 605):

```python
    parser.add_argument("--prepare-tasks", action="store_true",
                        help="Fetch pages and write LLM task files to llm-tasks/festivals/")
```

Add a new function before the `if __name__` block:

```python
def prepare_llm_tasks(slug: Optional[str] = None, render_js: bool = False) -> None:
    """Fetch festival pages and write LLM task files for batch extraction.

    Targets festivals with NULL or short (<50 char) descriptions that have a website.
    Writes one JSON file per festival to crawlers/llm-tasks/festivals/{slug}.json.
    """
    import json as _json

    client = get_client()
    query = (
        client.table("festivals")
        .select("id,slug,name,website,description")
        .not_.is_("website", "null")
    )
    if slug:
        query = query.eq("slug", slug)

    all_festivals = query.order("name").execute().data or []

    # Filter to those needing descriptions
    festivals = [
        f for f in all_festivals
        if not f.get("description") or len(str(f.get("description", ""))) < 50
    ]

    task_dir = Path(__file__).parent / "llm-tasks" / "festivals"
    task_dir.mkdir(parents=True, exist_ok=True)

    fetch_cfg = FetchConfig(timeout_ms=20000, render_js=render_js, wait_until="domcontentloaded")

    logger.info(f"Preparing LLM tasks for {len(festivals)} festivals")
    logger.info(f"{'=' * 70}")

    written = 0
    failed = 0

    for i, f in enumerate(festivals, 1):
        name = f["name"]
        website = f["website"]
        prefix = f"[{i:3d}/{len(festivals)}] {name[:35]:<35}"

        html, err = fetch_html(website, fetch_cfg)
        if err or not html:
            # Retry with JS
            html, err = fetch_html(website, FetchConfig(timeout_ms=20000, render_js=True, wait_until="domcontentloaded"))
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
            "entity_id": f["slug"],
            "entity_type": "festival",
            "name": name,
            "source_url": website,
            "page_content": page_text,
            "current_description": f.get("description"),
        }

        task_path = task_dir / f"{f['slug']}.json"
        task_path.write_text(_json.dumps(task, indent=2, ensure_ascii=False))
        logger.info(f"{prefix} wrote task ({len(page_text)} chars)")
        written += 1
        time.sleep(1.0)

    logger.info(f"\n{'=' * 70}")
    logger.info(f"Tasks written: {written} | Failed: {failed}")
    logger.info(f"Task directory: {task_dir}")
```

Update the `if __name__` block to handle the new flag:

```python
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Enrich festivals from their websites")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    parser.add_argument("--slug", type=str, help="Enrich a single festival by slug")
    parser.add_argument("--force", action="store_true", help="Re-enrich even if fields populated")
    parser.add_argument("--stale", action="store_true", help="Re-enrich stale/low-confidence data")
    parser.add_argument("--render-js", action="store_true", help="Use Playwright for JS-heavy sites")
    parser.add_argument("--prepare-tasks", action="store_true",
                        help="Fetch pages and write LLM task files to llm-tasks/festivals/")
    parser.add_argument("--extract-tasks", action="store_true",
                        help="Read task files, call LLM API, write result files")
    parser.add_argument("--apply-results", action="store_true",
                        help="Read LLM result files, quality-gate, and write to DB")
    args = parser.parse_args()

    if args.prepare_tasks:
        prepare_llm_tasks(slug=args.slug, render_js=args.render_js)
    elif args.extract_tasks:
        extract_llm_tasks(slug=args.slug)
    elif args.apply_results:
        apply_llm_results(slug=args.slug, dry_run=args.dry_run)
    else:
        enrich_festivals(
            dry_run=args.dry_run,
            slug=args.slug,
            force=args.force,
            stale=args.stale,
            render_js=args.render_js,
        )
```

- [ ] **Step 2: Verify the script still imports cleanly**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -c "import enrich_festivals; print('Import OK')"`

Expected: `Import OK` (the `extract_llm_tasks` and `apply_llm_results` functions don't exist yet, but they're only called at runtime).

- [ ] **Step 3: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(festivals): add --prepare-tasks mode for batch LLM extraction

Fetches festival pages, extracts visible text, and writes JSON task
files to crawlers/llm-tasks/festivals/ for processing by API or Codex."
```

---

### Task 3: Add `--extract-tasks` mode (API)

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Implement `extract_llm_tasks()`**

Add to `crawlers/enrich_festivals.py` after `prepare_llm_tasks()`:

```python
def extract_llm_tasks(slug: Optional[str] = None) -> None:
    """Read task files and extract descriptions via LLM API.

    Reads from crawlers/llm-tasks/festivals/, calls generate_text() for each,
    writes results to crawlers/llm-results/festivals/{slug}.json.
    """
    import json as _json
    from llm_client import generate_text

    task_dir = Path(__file__).parent / "llm-tasks" / "festivals"
    result_dir = Path(__file__).parent / "llm-results" / "festivals"
    result_dir.mkdir(parents=True, exist_ok=True)

    if slug:
        task_files = [task_dir / f"{slug}.json"]
        task_files = [f for f in task_files if f.exists()]
    else:
        task_files = sorted(task_dir.glob("*.json"))

    if not task_files:
        logger.info("No task files found.")
        return

    logger.info(f"Extracting descriptions for {len(task_files)} festivals via API")
    logger.info(f"{'=' * 70}")

    extracted = 0
    failed = 0

    for i, task_path in enumerate(task_files, 1):
        task = _json.loads(task_path.read_text())
        name = task.get("name", task_path.stem)
        prefix = f"[{i:3d}/{len(task_files)}] {name[:35]:<35}"

        page_content = task.get("page_content", "")
        if not page_content:
            logger.info(f"{prefix} SKIP (no page content)")
            failed += 1
            continue

        user_message = f"Festival: {name}\nURL: {task.get('source_url', '')}\n\nPage content:\n{page_content}"

        try:
            response = generate_text(DESCRIPTION_EXTRACTION_PROMPT, user_message)
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
git commit -m "feat(festivals): add --extract-tasks mode for API-based LLM extraction

Reads task files from llm-tasks/festivals/, calls generate_text() with
the centralized extraction prompt, writes result JSONs to llm-results/."
```

---

### Task 4: Add `--apply-results` mode

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Implement `apply_llm_results()`**

Add to `crawlers/enrich_festivals.py` after `extract_llm_tasks()`:

```python
def apply_llm_results(slug: Optional[str] = None, dry_run: bool = False) -> None:
    """Read LLM result files, quality-gate, and write accepted descriptions to DB.

    Reads from crawlers/llm-results/festivals/, runs each description through:
    1. classify_description() — must return "good"
    2. Length check — must be >= 50 chars
    3. Grounding check — key phrases must appear in source text
    Then writes accepted descriptions to the festivals table.
    """
    import json as _json
    from description_quality import classify_description

    client = get_client()
    result_dir = Path(__file__).parent / "llm-results" / "festivals"
    task_dir = Path(__file__).parent / "llm-tasks" / "festivals"

    if slug:
        result_files = [result_dir / f"{slug}.json"]
        result_files = [f for f in result_files if f.exists()]
    else:
        result_files = sorted(result_dir.glob("*.json"))

    if not result_files:
        logger.info("No result files found.")
        return

    logger.info(f"Applying {len(result_files)} LLM results ({'DRY RUN' if dry_run else 'LIVE'})")
    logger.info(f"{'=' * 70}")

    accepted = 0
    rejected = 0
    skipped = 0

    for i, result_path in enumerate(result_files, 1):
        festival_slug = result_path.stem
        result = _json.loads(result_path.read_text())
        description = result.get("description")
        prefix = f"[{i:3d}/{len(result_files)}] {festival_slug[:35]:<35}"

        # Skip NULL results
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

        # Quality gate 2: length check
        if len(description) < 50:
            logger.info(f"{prefix} REJECT (too short: {len(description)} chars)")
            rejected += 1
            continue

        # Quality gate 3: grounding check
        task_path = task_dir / f"{festival_slug}.json"
        if task_path.exists():
            task = _json.loads(task_path.read_text())
            source_text = task.get("page_content", "")
            if source_text and not passes_grounding_check(description, source_text):
                logger.info(f"{prefix} REJECT (grounding): {description[:80]}...")
                rejected += 1
                continue

        # Accept
        if not dry_run:
            client.table("festivals").update(
                {"description": description[:2000]}
            ).eq("slug", festival_slug).execute()

        logger.info(f"{prefix} ACCEPT ({len(description)} chars): {description[:80]}...")
        accepted += 1

    mode = "DRY RUN" if dry_run else "APPLIED"
    logger.info(f"\n{'=' * 70}")
    logger.info(f"[{mode}] Accepted: {accepted} | Rejected: {rejected} | Skipped: {skipped}")
```

- [ ] **Step 2: Verify import and dry-run**

Run: `cd /Users/coach/Projects/LostCity/crawlers && python3 -c "import enrich_festivals; print('Import OK')"`

- [ ] **Step 3: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(festivals): add --apply-results mode with quality gates

Reads LLM result files, runs each through classify_description(),
length check, and grounding check. Writes accepted descriptions to DB.
Supports --dry-run for preview."
```

---

### Task 5: Gitignore task/result directories

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Add task and result directories to gitignore**

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
cd /Users/coach/Projects/LostCity/crawlers && python3 enrich_festivals.py --prepare-tasks --slug dragon-con
```

Expected: Creates `crawlers/llm-tasks/festivals/dragon-con.json` with `entity_id`, `name`, `source_url`, `page_content` (clean text, ~1-5K chars), and `current_description`.

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

Expected: Clean visible text from the Dragon Con website, no HTML tags, no script content.

- [ ] **Step 3: Run extract on the single festival (requires ANTHROPIC_API_KEY)**

```bash
python3 enrich_festivals.py --extract-tasks --slug dragon-con
```

Expected: Creates `crawlers/llm-results/festivals/dragon-con.json` with a 2-3 sentence description.

- [ ] **Step 4: Run apply in dry-run mode**

```bash
python3 enrich_festivals.py --apply-results --slug dragon-con --dry-run
```

Expected: Shows ACCEPT with the description — passes quality gates.

- [ ] **Step 5: If verification passes, run apply for real**

```bash
python3 enrich_festivals.py --apply-results --slug dragon-con
```

Expected: Description written to festivals table.

- [ ] **Step 6: Verify via API**

```bash
curl -s "http://localhost:3000/api/festivals/dragon-con?portal=atlanta" | python3 -c "
import sys, json
d = json.load(sys.stdin)
print('Description:', d['festival'].get('description', 'NULL')[:200])
"
```
