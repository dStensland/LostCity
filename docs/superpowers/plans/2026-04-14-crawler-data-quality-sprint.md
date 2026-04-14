# Crawler Data Quality Sprint — Split into Sprint A (Discovery) + Sprint B (Execution)

> **For agentic workers:** The original single-sprint plan had Tasks 2-6 as empty templates waiting for Task 1's output — a plan that couldn't be specified without executing part of itself. Code-quality review flagged this and recommended a split. Sprint A is a short discovery sprint that produces Sprint B as its output. Sprint B is authored AFTER Sprint A runs and its targets/tasks are replaced with concrete source names.

**Goal:** Close the per-source data quality gaps that undercut the search card UX. Search results render cards with title, image, venue name, time, price, and category chips. Every missing field visibly degrades the premium positioning, and the best ranking in the world can't hide "unknown price" on half the cards.

**North star signal:** A user looking at a search result should never see "unknown price", a generic placeholder image, an unlabeled venue, or an empty category chip. The most common reason they do today is per-source extraction gaps, not architectural flaws in the classifier or geocoder.

**Architecture:** Changes live entirely under `crawlers/` (Python pipeline). No `web/` changes. Fixes are per-source parser updates. Data improvements land immediately in the `events` table which the new search stack reads from — no web deploy needed.

---

## Prerequisites (both sprints)

- [ ] Service-role Supabase credentials in `crawlers/.env` or environment (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`). `crawlers/db/client.py:279` `get_client()` reads these via `config.py`.
- [ ] `crawlers/db/client.py` API confirmed: `get_client()` returns a configured Supabase client. **The symbol `supabase` is NOT exported** — any reference to `from crawlers.db.client import supabase` is wrong.
- [ ] The previous draft referenced `crawlers/profiles/<source>.yaml` as a profile-contract pipeline location. **This directory does NOT exist on main.** Source parsers live in `crawlers/sources/*.py` only. Drop any mention of profiles.
- [ ] A place to run arbitrary SQL against prod: either direct `psycopg2` with service-role credentials, or the ability to create a Postgres function + call it via Supabase RPC. **Direct psycopg is the lower-ceremony path** for one-shot audits.
- [ ] Read access to production events data (not a dev-DB sample — the audit needs real coverage numbers).

---

## Non-goals (apply to both sprints)

- **Activating new sources.** Fixing existing sources only.
- **Crawler pipeline rewrite.** Playwright conversion and profile-first work is tracked as `project_playwright_conversion.md` in user memory.
- **Wholesale LLM-assisted extraction at runtime.** Rule-based parser improvements only in this sprint.
- **Category taxonomy refinement.** If extraction fills `category_id` correctly per the existing taxonomy, the sprint is done.
- **Downstream enrichment scripts.** User memory's `feedback_enrichment_debt.md` is explicit: enrichment scripts are crawler failures. Fix the crawler. Do NOT add a nightly backfill.
- **Category + neighborhood field fixes** — these gaps usually live in `classify.py` and geocoding, not per-source parsers. Explicitly out of this sprint's scope. See "Architectural-gap escape hatch" below.

---

# Sprint A — Discovery

**Goal:** Produce a concrete, executable Sprint B plan. Sprint A itself is small (3 tasks) but its output determines Sprint B's shape.

**Scope:** Real schema verification, a one-shot coverage audit via direct psycopg, and a Sprint B plan file with actual source names in place of the current templates.

---

## Sprint A — Task 1: Verify schema and column names

**Why:** The previous draft assumed columns like `events.source`, `events.image_url`, `events.venue_name`, `events.category_id`, `events.neighborhood`. Some may not exist on the live schema after the venue→place rename. Sprint A starts by confirming what's real.

### Files

- Modify: `docs/superpowers/plans/2026-04-14-crawler-data-quality-sprint.md` (this file — update Sprint B's schema assumptions block after verification)

### Steps

- [ ] **Step 1: Pull the live `events` table column list**

```bash
cd crawlers
python -c "
from db.client import get_client
client = get_client()
# List events columns via information_schema
res = client.rpc('exec_sql', {'sql': \"\"\"
  SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'events'
  ORDER BY ordinal_position
\"\"\"}).execute()
for row in res.data:
    print(row)
" 2>&1 | head -60
```

If `exec_sql` RPC doesn't exist (it usually doesn't on Supabase), fall back to direct psycopg:

```bash
cd crawlers
python -c "
import os
import psycopg2
url = os.environ['SUPABASE_URL'].replace('https://', '').split('.')[0]
conn = psycopg2.connect(
    host=f'db.{url}.supabase.co',
    port=5432,
    dbname='postgres',
    user='postgres',
    password=os.environ['SUPABASE_DB_PASSWORD']
)
with conn.cursor() as cur:
    cur.execute('''
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'events'
        ORDER BY ordinal_position
    ''')
    for row in cur.fetchall():
        print(row)
"
```

Note: production Supabase may block direct Postgres connections to the pooler. If so, use the Supabase Dashboard's SQL editor to run the query manually and paste results into a verification file.

- [ ] **Step 2: Confirm columns used in the audit**

From the column list, verify these fields exist on `events`:
- `source` (or similar — maybe `source_id`, `crawler_source`, etc. — use whatever actually exists)
- `price` (or `price_min`, `price_max`)
- `image_url` (or `primary_image_url`, `cover_image`)
- `place_id` (we know this exists post-rename; use a JOIN to `places.name` for venue name)
- `category_id` (or `category`)
- `portal_id`
- `is_active`

Update Sprint B's query template (Task B1) with the actual column names. If any field the sprint targeted doesn't exist, SKIP that field in Sprint B's targets (drop it from the coverage table).

- [ ] **Step 3: Document findings inline**

Create `crawlers/reports/schema_verify_2026-04-14.md` with:

```markdown
# events Schema Verification — 2026-04-14

## Live column list
[paste from Step 1]

## Sprint B target fields (kept)
- price → column `<name>`, nullable <bool>
- image → column `<name>`, nullable <bool>
- venue_name → JOIN places.name via events.place_id
- category → column `<name>`, nullable <bool>

## Dropped from Sprint B
- <field>: reason (e.g., column doesn't exist, or belongs to classify.py not per-source)
```

Commit: `docs(crawler): 2026-04-14 events schema verification for data quality sprint`.

**Acceptance:**
- Schema report committed
- Sprint B's query in the next task uses confirmed column names, not the placeholders from the previous draft

---

## Sprint A — Task 2: Write and run the coverage audit

**Why:** Before fixing sources, identify which ones account for the bulk of the missing data. Per-source coverage with missing-row-weighted scoring tells you which 5-10 sources to target.

### Files

- Create: `crawlers/scripts/coverage_gap_audit.py`
- Create: `crawlers/reports/coverage_gap_2026-04-14.md`

### Steps

- [ ] **Step 1: Write the audit script**

`crawlers/scripts/coverage_gap_audit.py`:

```python
"""
Per-source coverage audit for Atlanta portal active events.

Identifies top offender sources by missing-row-weighted score. Use the output
to prioritize Sprint B task targets. Run this ONCE per sprint, commit the
report, then base Sprint B on the concrete source names.

Usage:
    python -m crawlers.scripts.coverage_gap_audit

Requires:
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY in env
    (or SUPABASE_DB_PASSWORD for direct psycopg fallback)

Output: writes crawlers/reports/coverage_gap_<date>.md
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from pathlib import Path

from db.client import get_client

# NOTE: Sprint A Task 1 confirmed these column names. Update here if the
# schema differs on your instance.
EVENTS_TABLE_COLUMNS = {
    "source": "source",        # ← replace if Sprint A found a different name
    "price": "price",          # ← replace if Sprint A found price_min/price_max
    "image": "image_url",      # ← replace if Sprint A found primary_image_url
    "category": "category_id", # ← replace if Sprint A found category
}


def main() -> None:
    atlanta_portal_id = os.environ.get("ATLANTA_PORTAL_ID")
    if not atlanta_portal_id:
        print("ERROR: set ATLANTA_PORTAL_ID env var", file=sys.stderr)
        sys.exit(1)

    client = get_client()

    # PostgREST doesn't support GROUP BY directly via supabase-py.
    # Workaround: pull rows in chunks and aggregate in Python.
    # At ~30k Atlanta active events this is fine for a one-shot audit.
    print("Pulling active events...", file=sys.stderr)

    all_rows = []
    page_size = 1000
    offset = 0
    while True:
        res = (
            client.table("events")
            .select(
                f"id, {EVENTS_TABLE_COLUMNS['source']}, "
                f"{EVENTS_TABLE_COLUMNS['price']}, "
                f"{EVENTS_TABLE_COLUMNS['image']}, "
                f"{EVENTS_TABLE_COLUMNS['category']}, "
                f"place_id, places(name, neighborhood)"
            )
            .eq("portal_id", atlanta_portal_id)
            .eq("is_active", True)
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = res.data or []
        if not rows:
            break
        all_rows.extend(rows)
        if len(rows) < page_size:
            break
        offset += page_size
        print(f"  ...fetched {len(all_rows)}", file=sys.stderr)

    print(f"Total active events: {len(all_rows)}", file=sys.stderr)

    # Aggregate by source
    by_source: dict[str, dict[str, int]] = {}
    for row in all_rows:
        source = row.get(EVENTS_TABLE_COLUMNS["source"]) or "(null)"
        stats = by_source.setdefault(source, {
            "total": 0,
            "missing_price": 0,
            "missing_image": 0,
            "missing_venue": 0,
            "missing_category": 0,
            "missing_neighborhood": 0,
        })
        stats["total"] += 1
        if row.get(EVENTS_TABLE_COLUMNS["price"]) is None:
            stats["missing_price"] += 1
        if not row.get(EVENTS_TABLE_COLUMNS["image"]):
            stats["missing_image"] += 1
        place = row.get("places") or {}
        if not place.get("name"):
            stats["missing_venue"] += 1
        if not row.get(EVENTS_TABLE_COLUMNS["category"]):
            stats["missing_category"] += 1
        if not place.get("neighborhood"):
            stats["missing_neighborhood"] += 1

    # Rank sources by missing-row-weighted impact
    # Weight: price=3, image=2, venue=3, category=1, neighborhood=1
    # (price and venue are most visible; category/neighborhood are often architectural)
    WEIGHTS = {
        "missing_price": 3,
        "missing_image": 2,
        "missing_venue": 3,
        "missing_category": 1,
        "missing_neighborhood": 1,
    }
    sources_ranked = sorted(
        by_source.items(),
        key=lambda kv: sum(kv[1][k] * w for k, w in WEIGHTS.items()),
        reverse=True,
    )[:20]  # top 20

    # Write report
    report_path = Path("crawlers/reports/coverage_gap_2026-04-14.md")
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with report_path.open("w") as f:
        f.write(f"# Coverage Gap Audit — Atlanta — {datetime.now().strftime('%Y-%m-%d')}\n\n")
        f.write(f"Total active events: **{len(all_rows)}**\n\n")

        # Aggregate totals
        agg_missing = {k: 0 for k in WEIGHTS}
        for stats in by_source.values():
            for k in WEIGHTS:
                agg_missing[k] += stats[k]
        f.write("## Aggregate coverage\n\n")
        f.write("| Field | Missing | % Missing |\n")
        f.write("|---|---:|---:|\n")
        for field, missing in agg_missing.items():
            pct = (missing / len(all_rows)) * 100 if all_rows else 0
            f.write(f"| {field.replace('missing_', '')} | {missing} | {pct:.1f}% |\n")

        f.write("\n## Top 20 sources by missing-row-weighted score\n\n")
        f.write("Scoring: price=3, image=2, venue=3, category=1, neighborhood=1\n\n")
        f.write("| Rank | Source | Total | Missing Price | Missing Image | Missing Venue | Missing Cat | Missing Hood | Weight Score |\n")
        f.write("|---:|---|---:|---:|---:|---:|---:|---:|---:|\n")
        for rank, (source, stats) in enumerate(sources_ranked, 1):
            score = sum(stats[k] * w for k, w in WEIGHTS.items())
            f.write(
                f"| {rank} | `{source}` | {stats['total']} | "
                f"{stats['missing_price']} | {stats['missing_image']} | "
                f"{stats['missing_venue']} | {stats['missing_category']} | "
                f"{stats['missing_neighborhood']} | {score} |\n"
            )

        f.write("\n## Sprint B target selection (to be filled in Task 3)\n\n")
        f.write("After reviewing this table, pick 8-10 sources for Sprint B.\n")
        f.write("Prefer sources where:\n")
        f.write("- Price or venue is the dominant gap (most visible)\n")
        f.write("- Total event count is >100 (high-impact)\n")
        f.write("- The source is a known per-source parser (not classify.py territory)\n")

    print(f"Report written to {report_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

```bash
cd crawlers
ATLANTA_PORTAL_ID="<uuid from Supabase dashboard>" python -m scripts.coverage_gap_audit
```

Commit: `docs(crawler): 2026-04-14 per-source coverage gap audit`.

**Acceptance:**
- `crawlers/reports/coverage_gap_2026-04-14.md` exists and contains real numbers
- Aggregate coverage percentages are reported (e.g., "price 45.8% missing")
- Top 20 sources ranked by weighted score

---

## Sprint A — Task 3: Author Sprint B with concrete source names

**Why:** Sprint B's Tasks 1-N are template placeholders in this file. Replace them with real source names from the Task 2 audit, calibrate target thresholds against the aggregate coverage, and commit the authored Sprint B.

### Files

- Modify: `docs/superpowers/plans/2026-04-14-crawler-data-quality-sprint.md` (this file — fill in the Sprint B section below with concrete tasks)

### Steps

- [ ] **Step 1: Pick 8-10 target sources**

From the top 20 in the audit report, select 8-10 fix targets by this rubric:

- **Total events ≥ 100** — fixing low-volume sources has negligible aggregate impact
- **Missing field is parser territory** — price and image are usually per-source parser bugs; category and neighborhood are usually classify/geocode. Prefer the former.
- **Multi-field gaps on the same source** are GOOD targets — fixing the parser root cause (e.g., "this source only scrapes the listing page, never the detail page") closes multiple fields in one pass.
- **Avoid sources where the missing field is semantically absent** — if a recurring meetup has no price because it's free, the fix is to set price=0 in the parser, not to enrich.

Front-load 10 targets, not 5. Per the agentic lens, fix cost is linear and "stop and re-plan" after missing targets wastes discovery work.

- [ ] **Step 2: Calibrate target thresholds**

Use the **aggregate coverage** from the audit report. If current aggregate price coverage is 46%, a target of 80% is a +34 point swing — not necessarily reachable depending on source availability. Calibrate:

- If aggregate missing rate is <30% → target 90% filled (10% missing)
- If aggregate missing rate is 30-60% → target 75% filled (25% missing)
- If aggregate missing rate is >60% → target current + 20 points (realistic)

Drop fields from targets where the fix is architectural, not per-source:
- Category fixes usually belong in `crawlers/classify.py` — explicitly excluded
- Neighborhood fixes usually belong in geocoding — explicitly excluded

- [ ] **Step 3: Replace the Sprint B template below**

The current Sprint B section has a template `Task B-TEMPLATE` that needs to become `Task B-1` through `Task B-10` with concrete source names, concrete field targets, and concrete before-numbers from the audit.

Edit this file in place. Commit: `docs(crawler): author Sprint B from coverage audit findings`.

**Acceptance:**
- 8-10 concrete Sprint B tasks, each with a real source name, a field (or root-cause path), and a measured baseline
- Calibrated target thresholds against the audit
- No mention of category/neighborhood fields as per-source targets (they're architectural)

---

# Sprint B — Execution (TEMPLATE — REPLACE AFTER SPRINT A)

> **NOTE:** This section is a template until Sprint A Task 3 replaces it with concrete per-source tasks. Do NOT attempt to execute Sprint B while this section is still template-shaped.

## Sprint B non-goals

- One-field-per-task rule is **not** in effect. Per the agentic lens re-triage: one SOURCE per task, multi-field fixes allowed when the root cause is shared (e.g., chasing the detail page fixes price + image + venue_name in one pass). **Commit fields separately for bisectability, but diagnose and fix together.**
- Do NOT refactor the source's unrelated code paths.
- Do NOT open a PR per task — batch commits into one PR or small groups.

## Architectural-gap escape hatch

If Sprint A Task 2's audit shows that category/neighborhood account for large missing-field volume, do NOT add per-source fixes for them. Instead:

1. Flag the architectural nature in a `crawlers/reports/architectural_gaps_2026-04-14.md` file
2. Name the actual fix location (e.g., "category fixes live in `crawlers/classify.py` — see project memory `project_taxonomy_v2.md`")
3. Spawn a separate plan for that architectural work; don't bundle it here

## Sprint B Task B-TEMPLATE (REPLACE per target source)

> **Each target source from the audit becomes one task following this template.**
>
> Replace `<source>` with the source identifier from the audit. Replace `<fields>` with the specific fields this source's parser is dropping. Replace `<root_cause>` with the diagnosed parser path.

### Task B-N: `<source>` — fix `<fields>` via `<root_cause>`

**Baseline (from Sprint A audit):**
- Total active events: N
- Missing price: X% | Missing image: Y% | Missing venue: Z% | ...

**Targets (calibrated per Sprint A Task 3):**
- Field F: current X% → target Y%

**Files:**
- Modify: `crawlers/sources/<source>.py`
- Test: `crawlers/tests/test_<source>.py`
- Fixture: `crawlers/tests/fixtures/<source>/<new_case>.html` (if HTML-based source)

**Steps:**

- [ ] **Step 1: Sample failing events**

```bash
cd crawlers
python -c "
from db.client import get_client
import os
client = get_client()
res = client.table('events').select('id, title, price, image_url, place_id, url').eq('source', '<source>').eq('is_active', True).is_('price', 'null').limit(10).execute()
for row in res.data:
    print(row)
"
```

Pick 5-10 failing events. Visit their `url` field to confirm the data is present on the live source page (if absent on source too, the gap isn't fixable — drop the source from Sprint B).

- [ ] **Step 2: Diagnose the parser path**

Open `crawlers/sources/<source>.py`. Identify the extraction logic for the missing field(s). Common root causes:

- **Price:** source shows price on detail page, crawler only scrapes listing. Fix: chase the detail URL or scrape JSON-LD / data attributes on the listing.
- **Image:** source uses `data-src` (lazy-load), crawler grabs `src` which is a 1x1 placeholder. Fix: prefer `data-src`.
- **Venue name:** source nests venue inside JSON-LD blob the parser ignores, OR parser grabs a "presented by" field instead of the actual location. Fix: prefer JSON-LD structured data.
- **Multiple fields missing on same source:** almost always a shallow-listing-page problem. Chasing the detail URL fixes them all. This is when the multi-field-per-task rule pays off.

- [ ] **Step 3: Write the failing test(s)**

One test per field that will be fixed. Use a checked-in HTML fixture if the source is HTML-based:

```python
# crawlers/tests/test_<source>.py
def test_extracts_price():
    fixture = load_fixture("<source>/sample_with_price.html")
    event = parse_detail_page(fixture)
    assert event.price is not None
    assert event.price == 25.00

def test_extracts_image():
    # ... same pattern
    pass
```

Run: `pytest crawlers/tests/test_<source>.py -v` → FAIL.

- [ ] **Step 4: Implement the fix**

Edit the parser. Keep the fix narrow — if the root cause is "listing page only", the fix is "chase detail URL" and it fixes price + image + venue together. Do NOT refactor unrelated code.

- [ ] **Step 5: Run tests → PASS**

- [ ] **Step 6: Force a re-crawl of the fixed source against 5+ staging URLs**

```bash
cd crawlers
python -m crawlers.run --source <source> --limit 5 --dry-run
```

Verify the fields are populated in the dry-run output for at least 4 of 5 samples. If only 2 of 5, the fix is partial — iterate once, then flag as source-limited if still failing.

- [ ] **Step 7: Commit with before/after**

Use one commit per FIELD for bisectability, even when diagnosed together. Example sequence:

```bash
git add crawlers/sources/<source>.py crawlers/tests/test_<source>.py crawlers/tests/fixtures/<source>/
git commit -m "fix(crawler/<source>): chase detail URL to extract price

Before: price filled in X% of N events (Sprint A audit 2026-04-14)
After:  price filled in Y% of N events (dry-run 5/5)

Root cause: parser only hit the listing page where price is behind a
'View details' link. Added a detail-page chase that scrapes the final
price from the target page's JSON-LD."
```

Second commit for image if same root cause fixed it:

```bash
git commit -m "fix(crawler/<source>): same detail-chase extracts image

The fix in <prev commit> inherently populates image_url because the
detail page has a data-src attribute the listing page doesn't. No
additional parser changes — this commit is the fixture test proving
the image field is now populated."
```

**Acceptance for each task:**
- Failing tests now pass
- Dry-run shows ≥80% fill rate (or the calibrated target from Sprint A) on the sampled URLs
- No regression in the source's other extracted fields
- Each commit message includes before/after numbers from the audit

---

## Sprint B — Task B-FINAL: Force re-crawl + re-audit

**Why (strategy review flag):** Parser fixes sit in code but the `events` table numbers don't move until the source is re-crawled. Without a force-re-crawl step, the re-audit produces misleading "nothing changed" numbers and the team wastes hours debugging a non-problem.

### Files

- No new files.

### Steps

- [ ] **Step 1: Force re-crawl every fixed source against production**

```bash
cd crawlers
python -m crawlers.run --source <source-1> --mode full
python -m crawlers.run --source <source-2> --mode full
# ... one per fixed source
```

Or if there's a batch command:

```bash
python -m crawlers.run --sources source-1,source-2,... --mode full
```

Verify via the crawler output that each source actually re-ran and produced rows.

- [ ] **Step 2: Re-run the coverage audit**

```bash
ATLANTA_PORTAL_ID="<uuid>" python -m scripts.coverage_gap_audit
```

This overwrites `crawlers/reports/coverage_gap_2026-04-14.md`. Save the OLD report first:

```bash
cp crawlers/reports/coverage_gap_2026-04-14.md crawlers/reports/coverage_gap_2026-04-14_baseline.md
```

Then re-run. Now rename the new report to the final date:

```bash
mv crawlers/reports/coverage_gap_2026-04-14.md crawlers/reports/coverage_gap_2026-04-14_after.md
```

- [ ] **Step 3: Compare baseline vs after, compute deltas**

Create `crawlers/reports/coverage_gap_2026-04-14_summary.md`:

```markdown
# Coverage Gap Summary — Sprint B Results

## Aggregate deltas

| Field | Before | After | Target | Met? |
|---|---:|---:|---:|:---:|
| price | X% | Y% | <Z>% | ✅/❌ |
| image | ... | ... | ... | ... |
| venue | ... | ... | ... | ... |

## Per-source deltas (top 10)
...
```

- [ ] **Step 4: Close out or extend**

- **All targets met:** sprint complete. Commit the summary. Open the PR.
- **1-2 targets missed:** pick the next top source from the audit, extend by ONE task, re-run Step 1-3, close.
- **3+ targets missed:** STOP. Write a post-mortem in `coverage_gap_2026-04-14_summary.md` answering:
  - What was tried (list the fixes shipped)
  - What moved (actual deltas achieved)
  - What didn't move (fields still under target)
  - Hypothesis for why (source-limited? architectural gap in classify/geocode? wrong target calibration?)
  - Rollback or next experiment
  - Whether a second Sprint B is warranted or whether an architectural-gap plan is needed

The post-mortem template goes in the summary file. Do NOT silently adjust targets to make the sprint "pass" — honest failure is a useful signal for Phase 2.

**Acceptance:**
- Baseline and after reports both committed
- Summary file with computed deltas
- All targets met OR an honest post-mortem explaining why not

---

## Sprint B acceptance (overall)

- [ ] Sprint A completed and committed (schema verify + audit + Sprint B authored)
- [ ] 8-10 per-source fix tasks shipped
- [ ] Each task has before/after numbers in the commit message
- [ ] Force re-crawl executed for every fixed source
- [ ] Re-audit produces a concrete summary with deltas
- [ ] All calibrated coverage targets met OR honest post-mortem documented
- [ ] Existing crawler test suite green (`pytest crawlers/` clean)
- [ ] No enrichment-script additions (per memory: enrichment scripts are crawler failures)
- [ ] Sprint ships as one PR bundling all source fixes + the summary

## Coordination with the search sprint

**This sprint is fully parallel-safe with the Search Phase 1 critical path.** The two sprints touch completely different file trees:

- Search Phase 1: `web/lib/search/**`, `web/components/search/**`, `web/app/**`
- Crawler sprint: `crawlers/**`, `database/migrations/**` (if adding audit RPC), `supabase/migrations/**` (mirror)

Dispatch them simultaneously under different subagents. Data improvements land in the `events` table and surface in search UI immediately without a web deploy — the two sprints compound each other from day one.

**Revised ordering recommendation (from planner's original crawler-first):** the architect, strategy, AND code-quality reviewers all flipped the crawler-first argument. Run in parallel. Search-side wins (alias/entity linking) are visible in the dev UI immediately and don't depend on crawler fills. Crawler-side wins (filled price/image fields) show up on search result cards the moment each parser fix re-crawls. No sequencing benefit; full compounding benefit.

## Signals both sprints are off-track

- **Search sprint:** any task's fixture requires per-query special-casing, or MMR lambda drifts above 0.4 → stop, re-think the abstraction
- **Crawler sprint:** Task 2 reveals no single source accounts for >5% of any gap → the problem is architectural, not per-source. Rescope into a classify.py / geocoding sprint.
- **Both sprints:** subagent dispatch starts to grow unrelated fixes ("while I'm here") → push back on scope creep hard. The agentic-dev cost model makes scope discipline MORE important, not less.
