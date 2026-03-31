# Description Pipeline Fix — Comprehensive

**Date:** 2026-03-30
**Status:** Design approved, pending implementation plan
**Expert review:** Architecture review incorporated below.

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

### Automation Context

These scripts are called by production automation:
- `run_crawl.sh` (daily cron) → `post_crawl_maintenance.py` → calls EB + non-EB enrichment scripts
- `enrichment_pipeline.py` (weekly GitHub Action) → calls EB + non-EB enrichment scripts as subprocesses
- Changes must account for both callers to avoid breaking daily/weekly pipelines.

## Design

Three phases executed in dependency-safe order: defuse synthesizers → clean data → enable real extraction.

### Phase A: Defuse the Synthesizers (Stop the Bleeding)

Must happen BEFORE data cleanup, otherwise daily automation re-pollutes cleaned data.

**A1. Quality gate — extend existing `crawlers/description_quality.py`:**

Do NOT create a new file. The codebase already has `description_quality.py` with `classify_description()` and `BOILERPLATE_MARKERS`. Add `is_synthetic_description()` and `SYNTHETIC_MARKERS` to the existing file. One source of truth.

The pattern list must be compiled systematically from all 18 template builder functions in `enrich_non_eventbrite_descriptions.py`, plus `build_eventbrite_fallback()` and `build_null_source_description()`. The spec's original 12 patterns were incomplete — the actual synthesizers produce 30+ distinct signatures.

**Complete pattern list** (to be compiled during implementation by reading every template builder):

Festival patterns:
- `is an Atlanta .* experience`
- `Timing: .* through`
- `Current listed schedule includes`
- `Program mix includes`
- `Highlighted sessions include`
- `Pricing:`
- `Admission:`
- `Use the official ticket link`
- `Check the official festival site`

Eventbrite patterns:
- `is an Eventbrite event`
- `Free registration`
- `Paid ticketing`

Non-Eventbrite patterns (extracted from all 18 builders — partial list, full extraction during implementation):
- `is a live Ticketmaster event`
- `Georgia State Panthers matchup:`
- `Emory Healthcare .* program`
- `Fulton County Library .* program`
- `Movie showtime for .* at`
- `Meetup community event:`
- `Recurring event:`
- `Recurring weekly`
- `Part of an ongoing recurring`
- `Focus areas:`
- `Meeting focus:`
- `Cover charge and specials may vary`
- `Check .* for RSVP limits`
- `Check .* for runtime, format options`
- `Check .* for latest lineup updates`
- `Confirm final game`
- `Registration required\.`
- `Registration may be required`
- `Ticket range:`
- `Tickets from`
- `Ticket price:`
- `Scheduled on \d{4}-\d{2}-\d{2}`
- `Location: .* in .*\. Scheduled on`
- `Format: Online`

**Important:** Some patterns like `Location:` can appear in legitimate descriptions. Use combination matching where needed — only truncate at `Location:` if the description also contains `Scheduled on` or other synthetic markers.

**A2. Update callers to stop invoking synthesizers:**

| File | Change |
|------|--------|
| `crawlers/scripts/post_crawl_maintenance.py` | Remove `build_null_source_description()`, `sweep_null_source_short_descriptions()`, and `run_short_description_sweep()` body (make it a no-op or delete). Keep non-description maintenance (dedup, date fixes, etc.). |
| `crawlers/enrichment_pipeline.py` | Remove/skip Phase 1 calls to `enrich_eventbrite_descriptions.py` and `enrich_non_eventbrite_descriptions.py`. Replace with no-op or use new detail extraction path. |

**A3. Delete/modify the synthesizer scripts:**

| File | Action |
|------|--------|
| `crawlers/scripts/enrich_festival_descriptions.py` | Delete entirely |
| `crawlers/scripts/enrich_eventbrite_descriptions.py` | Remove `build_eventbrite_fallback()`. Keep `enrich_description_from_detail_page()` call (verify this does real extraction, not templating). If detail extraction returns short/empty, leave as-is — don't fall back. |
| `crawlers/scripts/enrich_non_eventbrite_descriptions.py` | Remove all 18 source-specific template builders. Replace with detail page extraction via `enrich_from_detail()` for sources that have detail URLs. |

### Phase B: Clean Existing Data (Now Safe From Re-Pollution)

**B1. Backup current descriptions:**

Before any modifications, dump `{id, entity_type, current_description}` to a JSON file. This is the rollback path if patterns have false positives.

```bash
python3 crawlers/scripts/clean_synthetic_descriptions.py --backup  # writes backup.json
```

**B2. Run cleanup migration:**

```bash
python3 crawlers/scripts/clean_synthetic_descriptions.py --dry-run  # preview — dumps first 200 per pattern
python3 crawlers/scripts/clean_synthetic_descriptions.py --apply    # commit changes
```

**Logic per record:**
1. Find earliest boilerplate match position (using `SYNTHETIC_MARKERS` from quality gate)
2. Truncate there
3. Trim trailing whitespace, periods, and dangling conjunctions
4. If remaining text < 20 chars → set to NULL
5. If no boilerplate found → leave unchanged

**Expected outcomes:**
- **Festivals (~86 records):** Most will retain a shorter real description (the first 1-2 sentences). ~10-15 may become NULL (entire description was synthetic).
- **Events (~31,000 records):** Estimated ~60-70% will be set to NULL because the entire description was synthetic with no real content before the boilerplate. This is correct — NULL is better than synthetic text, and triggers re-enrichment on next crawl.
- **Venues:** Skipped. Pipeline is working correctly.

### Phase C: Enable Real Extraction

**C1. Enable LLM extraction in festival enrichment:**

In `crawlers/enrich_festivals.py`, change `use_llm=False` → `use_llm=True`. Cost: ~86 API calls at ~$0.01-0.03 each = under $3 total.

**C2. LLM extraction infrastructure (festivals only):**

Two execution modes for batch description extraction. Scoped to festivals (86 records, high value, worth auditing). Events should get good descriptions from improved first-pass crawling with `use_llm=True`, not from a separate batch backfill.

**API mode** (`--llm api`): Script calls Claude API directly via `generate_text()`. For automated use.

**Codex mode** (`--llm codex`): Batch processing via Codex agent. No API cost — uses existing subscription. Three-phase pattern:

1. **Prepare phase** (Python script):
   - Fetch target pages (festivals with NULL or synthetic descriptions)
   - Write task files: `crawlers/llm-tasks/festivals/{slug}.json`
   - Each task: `{ entity_id, entity_type, source_url, page_content, extraction_prompt, current_description }`

2. **Extract phase** (Codex agent):
   - Reads task files, processes through model
   - Writes result files: `crawlers/llm-results/festivals/{slug}.json`
   - Each result: `{ description, confidence, source_url }`

3. **Apply phase** (Python script):
   - Reads results, runs quality gate, writes to DB
   - Logs rejections with reasons

**Extraction prompt** (shared between modes):
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

**C3. Improve first-pass crawlers:**

Remove `use_llm=False` overrides in caller scripts. The `DetailConfig` default is already `use_llm=True` — it was being overridden in specific callers to save cost. The cost is minimal since the LLM only fires when JSON-LD + OG + heuristic all fail.

## Files Changed

### Phase A (Defuse)
| File | Action |
|------|--------|
| `crawlers/description_quality.py` | Extend — add `is_synthetic_description()` + `SYNTHETIC_MARKERS` |
| `crawlers/scripts/post_crawl_maintenance.py` | Remove description synthesis functions + sweeps |
| `crawlers/enrichment_pipeline.py` | Remove/skip Phase 1 calls to EB + non-EB enrichment scripts |
| `crawlers/scripts/enrich_festival_descriptions.py` | Delete |
| `crawlers/scripts/enrich_eventbrite_descriptions.py` | Remove template fallback, keep detail extraction |
| `crawlers/scripts/enrich_non_eventbrite_descriptions.py` | Remove 18 template builders, replace with detail extraction |

### Phase B (Clean)
| File | Action |
|------|--------|
| `crawlers/scripts/clean_synthetic_descriptions.py` | Create — backup + cleanup script |

### Phase C (Enable)
| File | Action |
|------|--------|
| `crawlers/enrich_festivals.py` | Change `use_llm=False` → `use_llm=True` |
| `crawlers/scripts/llm_extract_descriptions.py` | Create — prepare/extract/apply CLI (festivals only) |
| `crawlers/llm-tasks/` | Directory for task files (gitignored) |
| `crawlers/llm-results/` | Directory for result files (gitignored) |

## Out of Scope (But Required Follow-Ups)

- **Source crawler fixes for 18 sources** whose template builders are being removed. These sources (ticketmaster, meetup, gsu-athletics, emory, AMC, etc.) need their crawlers updated to capture descriptions on first pass, or their events will have NULL descriptions indefinitely. Track as required follow-up per source.
- Venue descriptions — pipeline is working correctly.
- Changing how `extract.py` LLM extraction works — already good.
- Event batch backfill via Codex — events should get descriptions from improved first-pass crawling, not a separate batch process.

## Success Criteria

- Zero descriptions in the DB match synthetic boilerplate patterns
- `enrich_festival_descriptions.py` deleted
- Template builders removed from EB + non-EB scripts
- Daily cron (`run_crawl.sh`) and weekly GitHub Action (`enrichment.yml`) run without errors
- Quality gate prevents any future synthetic descriptions from being written
- LLM extraction available in API + Codex modes for festivals
- Backup JSON exists for rollback if needed
