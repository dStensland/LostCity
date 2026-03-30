# Description Pipeline Fix — Comprehensive

**Date:** 2026-03-30
**Status:** Design approved, pending implementation plan

## Problem

Four enrichment scripts synthesize descriptions from structured metadata instead of extracting from source websites. The result reads as machine output across ~31,000 records:

| Script | Entity | Records | Output Pattern |
|--------|--------|---------|----------------|
| `enrich_festival_descriptions.py` | Festivals | ~86 | "X is an Atlanta festival experience. Timing:..." |
| `enrich_eventbrite_descriptions.py` | Events | ~400/run | "X is an Eventbrite event. Location:..." |
| `enrich_non_eventbrite_descriptions.py` | Events | ~10,800/run | 18 source-specific templates |
| `post_crawl_maintenance.py` | Events | up to 20,000/sweep | Orchestrates above + null-source builder |

Root cause: crawlers don't capture descriptions on first pass → enrichment scripts "fix" the gap by assembling metadata into prose.

Good patterns already exist in the codebase: `backfill_descriptions.py` (fetches from real sources or leaves NULL) and `detail_enrich.py` (hierarchical extraction from pages).

## Design

Two independent workstreams + LLM extraction infrastructure.

### Workstream 1: Data Cleanup Migration (One-Time)

Python script that cleans existing synthetic descriptions across all entity types.

**Approach:** Pattern-based truncation. Synthetic descriptions consistently follow: 1-2 good sentences (scraped from source) → boilerplate metadata. Truncate at the first boilerplate match. If nothing remains, set to NULL.

**Festival boilerplate patterns:**
- `is an Atlanta .* experience`
- `Timing:`
- `Current listed schedule includes`
- `Program mix includes`
- `Highlighted sessions include`
- `Pricing:`
- `Admission:`
- `Use the official ticket link`
- `Check the official festival site`

**Event boilerplate patterns (Eventbrite):**
- `is an Eventbrite event`
- `Free registration`
- `Paid ticketing`

**Event boilerplate patterns (source-specific):**
- `Georgia State Panthers matchup:`
- `Emory Healthcare .* program`
- `Scheduled on \d{4}-\d{2}-\d{2}`
- `Location: .* in .*\. Scheduled on`

**Logic per record:**
1. Find earliest boilerplate match position
2. Truncate there
3. Trim trailing whitespace, periods, and dangling conjunctions
4. If remaining text < 20 chars → set to NULL
5. If no boilerplate found → leave unchanged

**Execution:**
```bash
python3 crawlers/scripts/clean_synthetic_descriptions.py --dry-run  # preview
python3 crawlers/scripts/clean_synthetic_descriptions.py --apply    # commit
```

Logs before/after for every changed record. Separate counts per entity type.

**Venues:** Skip. The venue description pipeline (`generate_descriptions.py` → `hydrate_descriptions.py`) is working correctly — templates only fill NULLs and get replaced by real content.

### Workstream 2: Pipeline Fix (Permanent)

Four changes to prevent synthetic descriptions from being generated again.

**1. Delete the synthesizers:**

| File | Action |
|------|--------|
| `crawlers/scripts/enrich_festival_descriptions.py` | Delete entirely |
| `crawlers/scripts/enrich_eventbrite_descriptions.py` | Remove `build_eventbrite_fallback()`. Keep `enrich_description_from_detail_page()` call. If detail extraction returns short/empty, leave as-is (don't fall back to template). |
| `crawlers/scripts/enrich_non_eventbrite_descriptions.py` | Remove all 18 source-specific template builders (`enrich_gsu()`, `enrich_emory()`, `enrich_recurring_event()`, etc.). Replace with detail page extraction via `enrich_from_detail()`. |
| `crawlers/scripts/post_crawl_maintenance.py` | Remove `build_null_source_description()`. Remove `sweep_null_source_short_descriptions()`. Remove calls to the above enrichment scripts. Keep non-description maintenance tasks (dedup, date fixes, etc.). |

**2. Enable LLM extraction in the detail enrichment pipeline:**

In `crawlers/enrich_festivals.py`:
```python
detail_cfg = DetailConfig(
    use_jsonld=True,
    use_open_graph=True,
    use_heuristic=True,
    use_llm=True,  # was False
)
```

Same change for any event enrichment paths that disable LLM.

**3. Description quality gate:**

Add `is_synthetic_description(text: str) -> bool` utility in `crawlers/lib/description_quality.py`:

```python
SYNTHETIC_PATTERNS = [
    r"is an Atlanta .* experience",
    r"is an Eventbrite event",
    r"Timing: .* through",
    r"Current listed schedule includes",
    r"Scheduled on \d{4}-\d{2}-\d{2}",
    r"Location: .* in .*\. Scheduled on",
    # ... full pattern list
]

def is_synthetic_description(text: str) -> bool:
    """Returns True if the description appears to be template-generated."""
    if not text or len(text.strip()) < 30:
        return True
    return any(re.search(p, text) for p in SYNTHETIC_PATTERNS)
```

Use this gate:
- After any extraction in the enrichment pipeline — reject synthetic results
- In the quality gate before DB writes — never write a synthetic description
- In the cleanup script — identify records to clean

**4. Improve first-pass crawlers:**

Update `DetailConfig` defaults in `crawlers/pipeline/models.py`:
- `use_llm: bool = True` (was `True` but overridden to `False` in several callers)
- Remove `use_llm=False` overrides in caller scripts

This means: when a crawler visits a page and JSON-LD / OG / heuristic extraction all fail to get a description, the LLM fallback kicks in and extracts one from the page content. Cost is minimal — only fires when structured methods fail.

### LLM Extraction Infrastructure

Two execution modes for LLM-powered description extraction:

**API mode** (`--llm api`): Script calls Claude API directly via `generate_text()`. For automated crawls, cron jobs, CI. Uses API credits.

**Codex mode** (`--llm codex`): Batch processing via Codex agent. No API cost — uses existing subscription. Three-phase pattern:

1. **Prepare phase** (Python script):
   - Fetch target pages (festivals/events with NULL or synthetic descriptions)
   - Write task files: `crawlers/llm-tasks/{entity-type}/{slug}.json`
   - Each task contains: `{ page_content, extraction_prompt, entity_id, entity_type }`

2. **Extract phase** (Codex agent):
   - Reads task files
   - Processes each through the model
   - Writes result files: `crawlers/llm-results/{entity-type}/{slug}.json`
   - Each result contains: `{ description, confidence, source_url }`

3. **Apply phase** (Python script):
   - Reads result files
   - Runs quality gate (`is_synthetic_description()` + length check + punctuation check)
   - Writes approved descriptions to DB
   - Logs rejections with reasons

**Task file format:**
```json
{
  "entity_id": "afropunk-atlanta",
  "entity_type": "festival",
  "source_url": "https://afropunk.com/atlanta",
  "page_content": "...(fetched HTML/text)...",
  "extraction_prompt": "Extract a 2-3 sentence description of this festival from the page content. Focus on what makes it distinctive — the experience, the vibe, what attendees can expect. Do not include dates, pricing, location, or ticket information (those are displayed separately in the UI). Return only the description text, nothing else.",
  "current_description": "Celebrates Black culture and diversity...(current value for reference)"
}
```

**Extraction prompt** (shared between API and Codex modes):
```
Extract a 2-3 sentence description of this {entity_type} from the page content below.

Rules:
- Focus on what makes it distinctive — the experience, the vibe, what attendees can expect
- Do NOT include: dates, times, pricing, location, ticket URLs, or schedule details (these are displayed separately in the UI)
- Do NOT start with "The {name} is..." — vary the opening
- Write in present tense, editorial voice
- If the page doesn't contain enough information for a meaningful description, respond with NULL

Page content:
{page_content}
```

**CLI interface:**
```bash
# Prepare tasks for festivals with bad descriptions
python3 crawlers/scripts/llm_extract_descriptions.py prepare --entity festivals --dry-run
python3 crawlers/scripts/llm_extract_descriptions.py prepare --entity festivals

# API mode — process immediately
python3 crawlers/scripts/llm_extract_descriptions.py extract --llm api

# Codex mode — just prints instructions for the Codex agent
python3 crawlers/scripts/llm_extract_descriptions.py extract --llm codex
# (Codex agent processes tasks externally)

# Apply results after Codex finishes
python3 crawlers/scripts/llm_extract_descriptions.py apply --dry-run
python3 crawlers/scripts/llm_extract_descriptions.py apply
```

## Files Changed

### Workstream 1 (Migration)
| File | Action |
|------|--------|
| `crawlers/scripts/clean_synthetic_descriptions.py` | Create — one-time cleanup script |

### Workstream 2 (Pipeline Fix)
| File | Action |
|------|--------|
| `crawlers/scripts/enrich_festival_descriptions.py` | Delete |
| `crawlers/scripts/enrich_eventbrite_descriptions.py` | Remove template fallback, keep detail extraction |
| `crawlers/scripts/enrich_non_eventbrite_descriptions.py` | Remove 18 template builders, replace with detail extraction |
| `crawlers/scripts/post_crawl_maintenance.py` | Remove description synthesis functions + sweeps |
| `crawlers/enrich_festivals.py` | Change `use_llm=False` → `use_llm=True` |
| `crawlers/lib/description_quality.py` | Create — quality gate utility |

### LLM Extraction Infrastructure
| File | Action |
|------|--------|
| `crawlers/scripts/llm_extract_descriptions.py` | Create — prepare/extract/apply CLI |
| `crawlers/llm-tasks/` | Directory for task files (gitignored) |
| `crawlers/llm-results/` | Directory for result files (gitignored) |

## Out of Scope

- Venue descriptions — pipeline is working correctly (template → hydrate pattern)
- Rewriting individual source crawlers to capture descriptions better (long-term, per-crawler effort)
- Event description quality for non-enrichment sources (events that were never enriched)
- Changing how `extract.py` LLM extraction works (already good)

## Execution Order

1. **Workstream 1** first — clean existing data immediately
2. **Quality gate utility** — needed by both workstreams
3. **LLM extraction infrastructure** — prepare/extract/apply CLI
4. **Workstream 2** — delete synthesizers, enable LLM extraction
5. **Run LLM extraction** on cleaned records (via Codex for festivals, API for events if desired)

## Success Criteria

- Zero descriptions in the DB match synthetic boilerplate patterns
- `enrich_festival_descriptions.py` deleted and never runs again
- Template builders in Eventbrite/non-Eventbrite scripts removed
- LLM extraction available in both API and Codex modes
- Quality gate prevents any future synthetic descriptions from being written
