# Description Pipeline: Defuse Synthesizers + Clean Data — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop 4 scripts from generating synthetic descriptions, then clean ~31K existing records that already have them.

**Architecture:** Phase A defuses the synthesizers by updating their callers first (so daily/weekly automation doesn't break), then deletes/modifies the scripts. Phase B runs a cleanup migration on the now-safe data. The quality gate utility is built first because both phases use it.

**Tech Stack:** Python 3, Supabase (via supabase-py), regex

**Spec:** `docs/superpowers/specs/2026-03-30-description-pipeline-fix.md`

---

### Task 1: Add `is_synthetic_description()` to existing quality gate

**Files:**
- Modify: `crawlers/description_quality.py`
- Test: `crawlers/tests/test_description_quality.py`

This is the foundation — both phases depend on it.

- [ ] **Step 1: Write tests for synthetic detection**

Add to `crawlers/tests/test_description_quality.py`:

```python
# ── Synthetic description detection ──────────────────────────────────────

def test_synthetic_festival_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Great food festival. AfroPunk Atlanta is an Atlanta music festival experience. "
        "Timing: October 2026 through October 2026."
    ) is True

def test_synthetic_eventbrite_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Yoga in the Park is an Eventbrite event. Location: Piedmont Park in Midtown, Atlanta, GA. "
        "Scheduled on 2026-05-01 at 9:00 AM. Free registration."
    ) is True

def test_synthetic_ticketmaster_boilerplate():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Concert Tour 2026 is a live Ticketmaster event. Location: State Farm Arena in Downtown, Atlanta, GA. "
        "Scheduled on 2026-06-15 at 8:00 PM."
    ) is True

def test_synthetic_scheduled_on_pattern():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Fun community event. Location: Library in Decatur, GA. Scheduled on 2026-04-01 at 2:00 PM."
    ) is True

def test_synthetic_recurring_event():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Recurring event: Tuesday Trivia. Recurring weekly every Tuesday at 7:00 PM. "
        "Location: The Porter in Little Five Points."
    ) is True

def test_synthetic_meetup():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Meetup community event: Atlanta Python Users Group. Format: Online meetup. "
        "Check Meetup for RSVP limits, attendance requirements, and updates."
    ) is True

def test_synthetic_check_cta():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Great show. Check Eventbrite for full agenda details, policy updates, and current ticket availability."
    ) is True

def test_good_description_not_flagged():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(
        "Annual celebration of Atlanta's vibrant food scene featuring over 50 local restaurants, "
        "live cooking demonstrations, and craft cocktail workshops."
    ) is False

def test_short_description_not_flagged():
    from description_quality import is_synthetic_description
    # Short but real — should NOT be flagged as synthetic
    assert is_synthetic_description(
        "Jazz quartet performing original compositions and classic standards."
    ) is False

def test_none_returns_false():
    from description_quality import is_synthetic_description
    assert is_synthetic_description(None) is False
    assert is_synthetic_description("") is False

def test_truncate_at_synthetic():
    from description_quality import truncate_at_synthetic
    result = truncate_at_synthetic(
        "Great food festival with live music and tastings. "
        "AfroPunk Atlanta is an Atlanta music festival experience. Timing: October 2026."
    )
    assert result == "Great food festival with live music and tastings."

def test_truncate_all_synthetic_returns_none():
    from description_quality import truncate_at_synthetic
    result = truncate_at_synthetic(
        "AfroPunk Atlanta is an Atlanta music festival experience. Timing: October 2026."
    )
    assert result is None

def test_truncate_no_synthetic_returns_unchanged():
    from description_quality import truncate_at_synthetic
    original = "Annual celebration of Atlanta's vibrant food scene."
    assert truncate_at_synthetic(original) == original
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd crawlers && python -m pytest tests/test_description_quality.py -v -k "synthetic or truncate" 2>&1 | tail -20`

Expected: FAIL — `is_synthetic_description` and `truncate_at_synthetic` not defined.

- [ ] **Step 3: Implement `SYNTHETIC_MARKERS`, `is_synthetic_description()`, and `truncate_at_synthetic()`**

Add to `crawlers/description_quality.py` after the existing `is_junk()` function:

```python
# ── SYNTHETIC markers: template-assembled descriptions from enrichment scripts ──
# These are descriptions built by assembling structured DB fields into prose.
# They read as machine output and should be truncated or rejected.
#
# Compiled from: enrich_festival_descriptions.py, enrich_eventbrite_descriptions.py,
# enrich_non_eventbrite_descriptions.py (18 builders), post_crawl_maintenance.py.

SYNTHETIC_MARKERS: list[str] = [
    # Festival enrichment
    r"is an Atlanta \w[\w\s]* experience\.",
    r"\bTiming: .+ through ",
    r"Current listed schedule includes \d+",
    r"Program mix includes .+programming\.",
    r"Highlighted sessions include ",
    r"Pricing varies by event or ticket tier\.",
    r"Use the official ticket link for current passes",
    r"Check the official festival site for updates and full schedule",
    r"Check official organizer channels for the latest schedule",
    # Eventbrite enrichment
    r"is an Eventbrite event\.",
    r"Check Eventbrite for full agenda details",
    r"Paid ticketing; tiers and availability may change\.",
    # Ticketmaster
    r"is a live Ticketmaster event\.",
    r"Check Ticketmaster for latest lineup updates",
    # Source-specific enrichment
    r"Georgia State Panthers \w+ matchup",
    r"Kennesaw State Owls college athletics",
    r"Emory Healthcare \w+ program\.",
    r"Fulton County Library \w+ program",
    r"Meetup community event:",
    r"Movie showtime for .+ at ",
    r"peer-support meeting:",
    r"Recurring event: ",
    r"Recurring weekly ",
    r"Part of an ongoing recurring ",
    r"LGBTQ\+ nightlife program at ",
    r"cooking class at The Cook's Warehouse",
    r"paint-and-sip class at ",
    r"community run/ride program hosted by Big Peach",
    r"live music performance at Terminal West",
    r"live music event at Aisle 5",
    r"Stand-up comedy event at Laughing Skull",
    r"BYOB-friendly studio class with guided",
    r"Venue programming includes drag, karaoke",
    r"Agenda packets.+managed by the city",
    # Common patterns across all builders
    r"Scheduled on \d{4}-\d{2}-\d{2}",
    r"Location: .+ in .+, [A-Z]{2}\.",
    r"Admission: free\.",
    r"Free registration\.",
    r"Cover charge and specials may vary",
    r"Registration may be required; verify capacity",
    r"Check .+ for RSVP limits",
    r"Check .+ for runtime, format options",
    r"Check .+ for latest lineup updates",
    r"Check .+ for weekly lineup updates",
    r"Check .+ for route details, pace expectations",
    r"Check .+ for painting theme, cancellation policy",
    r"Check .+ listing for lineup updates, age policy",
    r"Check the official listing for current format and access",
    r"Check the official listing for latest entry rules",
    r"Check the official listing for current details and policy",
    r"Check the official listing for current details before attending",
    r"Check the official class listing for menu, skill level",
    r"Check the official posting for the latest agenda",
    r"Check KSU Athletics for final game time",
    r"Confirm final game details and ticket links",
    r"Confirm the latest details on the official library listing",
    r"Use the ticket link for latest availability",
    r"Ticket range: \$",
    r"Tickets from \$",
    r"Ticket price: \$",
    r"Format: Online",
    r"Meeting focus: ",
    r"Focus areas: ",
    r"Topics: .+\.",
]

SYNTHETIC_RE = [re.compile(p, re.IGNORECASE) for p in SYNTHETIC_MARKERS]


def is_synthetic_description(desc: Optional[str]) -> bool:
    """Returns True if the description contains template-assembled boilerplate.

    These are descriptions generated by enrichment scripts that assemble
    structured DB fields (dates, locations, prices) into prose.
    """
    if not desc or not isinstance(desc, str):
        return False
    return any(pattern.search(desc) for pattern in SYNTHETIC_RE)


def truncate_at_synthetic(desc: Optional[str]) -> Optional[str]:
    """Truncate a description at the first synthetic boilerplate marker.

    Returns the real content before the boilerplate, or None if the entire
    description is synthetic (nothing left after truncation).
    """
    if not desc or not isinstance(desc, str):
        return None

    earliest_pos = len(desc)
    for pattern in SYNTHETIC_RE:
        match = pattern.search(desc)
        if match and match.start() < earliest_pos:
            earliest_pos = match.start()

    if earliest_pos == 0:
        return None  # Entire description is synthetic

    if earliest_pos == len(desc):
        return desc  # No synthetic content found

    # Truncate and clean up
    cleaned = desc[:earliest_pos].rstrip()
    # Remove trailing dangling conjunctions/prepositions
    cleaned = re.sub(r"\s+(and|or|with|at|in|for|the|a|an)\s*\.?\s*$", "", cleaned, flags=re.IGNORECASE)
    cleaned = cleaned.rstrip(" .,;:-–—")
    # Add period if missing
    if cleaned and not cleaned.endswith((".", "!", "?")):
        cleaned += "."

    if len(cleaned) < 20:
        return None  # Too little real content remains

    return cleaned
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd crawlers && python -m pytest tests/test_description_quality.py -v -k "synthetic or truncate"`

Expected: All 12 new tests PASS.

- [ ] **Step 5: Run full existing test suite to verify no regressions**

Run: `cd crawlers && python -m pytest tests/test_description_quality.py -v`

Expected: All existing tests still PASS.

- [ ] **Step 6: Commit**

```bash
git add crawlers/description_quality.py crawlers/tests/test_description_quality.py
git commit -m "feat(quality): add synthetic description detection and truncation

Adds SYNTHETIC_MARKERS (60+ patterns), is_synthetic_description(), and
truncate_at_synthetic() to the existing quality gate module. Compiled
from all 22 template builder functions across 4 enrichment scripts."
```

---

### Task 2: Defuse `post_crawl_maintenance.py` — remove description sweep

**Files:**
- Modify: `crawlers/scripts/post_crawl_maintenance.py`

This is the most critical caller — runs daily via `run_crawl.sh`. We make `run_short_description_sweep()` a no-op so the daily pipeline continues running but stops invoking the synthesizers.

- [ ] **Step 1: Make `run_short_description_sweep()` a no-op**

In `crawlers/scripts/post_crawl_maintenance.py`, replace the body of `run_short_description_sweep()` (around line 447) with:

```python
def run_short_description_sweep(args: argparse.Namespace, py: str, portal_slug: Optional[str]) -> int:
    """Disabled: synthetic description enrichment removed.

    Previously invoked enrich_eventbrite_descriptions.py and
    enrich_non_eventbrite_descriptions.py to fill short descriptions
    with template-assembled metadata. This produced machine-readable
    descriptions that degraded content quality. See spec:
    docs/superpowers/specs/2026-03-30-description-pipeline-fix.md
    """
    print("\n== Short-description sweep ==")
    print("[SKIP] Synthetic description enrichment disabled (pipeline fix 2026-03-30)")
    return 0
```

- [ ] **Step 2: Verify daily pipeline still runs**

Run: `cd crawlers && python scripts/post_crawl_maintenance.py --dry-run --portal atlanta 2>&1 | grep -E "sweep|SKIP|ERROR" | head -10`

Expected: Should show `[SKIP] Synthetic description enrichment disabled` — no errors.

- [ ] **Step 3: Commit**

```bash
git add crawlers/scripts/post_crawl_maintenance.py
git commit -m "fix(pipeline): disable synthetic description sweep in daily maintenance

Makes run_short_description_sweep() a no-op. The daily crawl pipeline
continues running but no longer invokes template-based description
enrichment scripts."
```

---

### Task 3: Defuse `enrichment_pipeline.py` — skip Phase 1

**Files:**
- Modify: `crawlers/enrichment_pipeline.py`

This runs weekly via GitHub Actions. We skip Phase 1 (event description enrichment) which calls the synthesizer scripts.

- [ ] **Step 1: Skip Phase 1 in the enrichment pipeline**

In `crawlers/enrichment_pipeline.py`, replace lines 163-200 (Phase 1 block) with:

```python
    # ── Phase 1: Event description enrichment ──────────────────────────
    # Disabled: synthetic description enrichment removed (2026-03-30).
    # Previously called enrich_eventbrite_descriptions.py and
    # enrich_non_eventbrite_descriptions.py which assembled metadata into
    # prose descriptions. Future: re-enable with real extraction.
    print("\n[SKIP] Phase 1: Event description enrichment (synthetic pipeline disabled)")
    record_phase("event_descriptions", 0, skipped=True)
```

- [ ] **Step 2: Verify the pipeline still runs**

Run: `cd crawlers && python enrichment_pipeline.py --dry-run --portal atlanta 2>&1 | grep -E "Phase 1|SKIP|event_desc" | head -5`

Expected: Shows `[SKIP] Phase 1: Event description enrichment (synthetic pipeline disabled)`.

- [ ] **Step 3: Commit**

```bash
git add crawlers/enrichment_pipeline.py
git commit -m "fix(pipeline): skip synthetic description enrichment in weekly pipeline

Disables Phase 1 (event description enrichment) which called the
template-based enrichment scripts. Weekly GitHub Action continues
running for all other enrichment phases."
```

---

### Task 4: Delete `enrich_festival_descriptions.py`

**Files:**
- Delete: `crawlers/scripts/enrich_festival_descriptions.py`

- [ ] **Step 1: Verify no other callers**

Run: `cd crawlers && grep -r "enrich_festival_descriptions" --include="*.py" --include="*.sh" --include="*.yml" . | grep -v __pycache__`

Expected: Only the file itself and possibly test files. No callers from `post_crawl_maintenance.py` or `enrichment_pipeline.py` (festivals have their own enrichment path via `enrich_festivals.py`).

- [ ] **Step 2: Delete the file**

```bash
rm crawlers/scripts/enrich_festival_descriptions.py
```

- [ ] **Step 3: Commit**

```bash
git add -A crawlers/scripts/enrich_festival_descriptions.py
git commit -m "chore: delete enrich_festival_descriptions.py

Template-based description assembler that generated 'X is an Atlanta
festival experience. Timing:...' boilerplate. Replaced by LLM
extraction in the detail enrichment pipeline."
```

---

### Task 5: Remove template fallback from `enrich_eventbrite_descriptions.py`

**Files:**
- Modify: `crawlers/scripts/enrich_eventbrite_descriptions.py`

Keep the `enrich_description_from_detail_page()` call (real extraction) but remove the `build_eventbrite_fallback()` function and the code path that invokes it.

- [ ] **Step 1: Remove `build_eventbrite_fallback()` function**

Delete the entire `build_eventbrite_fallback()` function (lines 137-174).

- [ ] **Step 2: Remove the fallback invocation in `main()`**

In the main loop (around lines 230-234), replace:

```python
        enriched_desc = enrich_description_from_detail_page(current_desc, source_url).strip()
        if len(enriched_desc) < args.min_length:
            fallback_desc = build_eventbrite_fallback(event, venue, enriched_desc or current_desc)
            if len(fallback_desc) > len(enriched_desc):
                enriched_desc = fallback_desc
```

With:

```python
        enriched_desc = enrich_description_from_detail_page(current_desc, source_url).strip()
```

The script now only uses real extraction. If the extraction returns short/empty, it just moves on (the existing skip logic handles this).

- [ ] **Step 3: Remove unused imports**

Remove `format_time_label` import if it was only used by the deleted fallback function. Check with: `grep -n "format_time_label" crawlers/scripts/enrich_eventbrite_descriptions.py`

- [ ] **Step 4: Verify the script still runs**

Run: `cd crawlers && python scripts/enrich_eventbrite_descriptions.py --dry-run --portal atlanta --limit 5 2>&1 | tail -10`

Expected: Runs without import errors. May show 0 updates (dry run).

- [ ] **Step 5: Commit**

```bash
git add crawlers/scripts/enrich_eventbrite_descriptions.py
git commit -m "fix(enrichment): remove synthetic fallback from Eventbrite description enrichment

Removes build_eventbrite_fallback() which assembled 'X is an Eventbrite
event. Location:...' descriptions from metadata. Keeps real extraction
via enrich_description_from_detail_page()."
```

---

### Task 6: Remove template builders from `enrich_non_eventbrite_descriptions.py`

**Files:**
- Modify: `crawlers/scripts/enrich_non_eventbrite_descriptions.py`

This file has 18 source-specific template builder functions. All must be removed and replaced with a single detail-page extraction path.

- [ ] **Step 1: Read the file to understand the dispatch structure**

Read `crawlers/scripts/enrich_non_eventbrite_descriptions.py` — find the dispatcher function that routes to the 18 builders. It's likely a function that checks `source_slug` and calls the appropriate `enrich_*()` function.

- [ ] **Step 2: Replace all 18 builder functions with a single extraction function**

Delete all source-specific builder functions (`enrich_gsu()`, `enrich_emory()`, `enrich_recurring_event()`, `enrich_meetup_event()`, `enrich_ticketmaster_event()`, `enrich_support_group_event()`, `enrich_amc_showtime_event()`, `enrich_fulton_library_event()`, `enrich_truist_park_event()`, `enrich_laughing_skull_event()`, `enrich_lore_event()`, `enrich_cooks_warehouse_event()`, `enrich_big_peach_event()`, `enrich_terminal_west_event()`, `enrich_aisle5_event()`, `enrich_ksu_event()`, `enrich_painting_with_a_twist_event()`, `enrich_city_meeting_event()`, `enrich_generic_event()`).

Replace the dispatcher with a single function that:
1. Takes the event + source_url
2. Calls `enrich_from_detail()` from the detail enrichment pipeline (or fetches the page and extracts via heuristic/OG)
3. Returns the extracted description or empty string
4. Never falls back to template assembly

If importing `enrich_from_detail` creates circular dependencies, use a simpler approach: fetch the page URL and extract the `og:description` or `meta description` tag. This is a minimal real-extraction path that avoids the template pattern.

- [ ] **Step 3: Verify the script still runs**

Run: `cd crawlers && python scripts/enrich_non_eventbrite_descriptions.py --dry-run --portal atlanta --limit 5 --all-sources 2>&1 | tail -10`

Expected: Runs without errors. May produce fewer enrichments than before (expected — real extraction is harder than templating).

- [ ] **Step 4: Commit**

```bash
git add crawlers/scripts/enrich_non_eventbrite_descriptions.py
git commit -m "fix(enrichment): replace 18 template builders with detail-page extraction

Removes all source-specific template functions (GSU, Emory, AMC,
Ticketmaster, etc.) that assembled metadata into prose. Replaces with
real extraction from source URLs."
```

---

### Task 7: Backup + cleanup migration script

**Files:**
- Create: `crawlers/scripts/clean_synthetic_descriptions.py`

- [ ] **Step 1: Create the cleanup script**

Write `crawlers/scripts/clean_synthetic_descriptions.py`:

```python
#!/usr/bin/env python3
"""
Clean synthetic descriptions from festivals and events.

Truncates descriptions at the first synthetic boilerplate pattern.
If nothing meaningful remains, sets description to NULL.

Usage:
    python3 scripts/clean_synthetic_descriptions.py --backup           # backup current state
    python3 scripts/clean_synthetic_descriptions.py --dry-run          # preview changes
    python3 scripts/clean_synthetic_descriptions.py --apply            # commit changes
    python3 scripts/clean_synthetic_descriptions.py --apply --festivals-only
    python3 scripts/clean_synthetic_descriptions.py --apply --events-only
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

# Add parent dir to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config import get_client
from description_quality import is_synthetic_description, truncate_at_synthetic


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Clean synthetic descriptions")
    parser.add_argument("--apply", action="store_true", help="Write changes to DB")
    parser.add_argument("--dry-run", action="store_true", help="Preview changes without writing")
    parser.add_argument("--backup", action="store_true", help="Backup current descriptions to JSON")
    parser.add_argument("--festivals-only", action="store_true")
    parser.add_argument("--events-only", action="store_true")
    parser.add_argument("--limit", type=int, default=50000, help="Max records to process")
    parser.add_argument("--preview", type=int, default=20, help="Number of examples to print per entity type")
    return parser.parse_args()


def backup_descriptions(client, args: argparse.Namespace) -> None:
    """Dump current descriptions to JSON for rollback."""
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_dir = Path(__file__).parent.parent / "backups"
    backup_dir.mkdir(exist_ok=True)

    if not args.events_only:
        print("Backing up festival descriptions...")
        festivals = (
            client.table("festivals")
            .select("id, name, description")
            .not_.is_("description", "null")
            .limit(10000)
            .execute()
            .data or []
        )
        path = backup_dir / f"festival_descriptions_{timestamp}.json"
        path.write_text(json.dumps(festivals, indent=2, ensure_ascii=False))
        print(f"  Saved {len(festivals)} festival descriptions to {path}")

    if not args.festivals_only:
        print("Backing up event descriptions (this may take a moment)...")
        events = []
        offset = 0
        page_size = 5000
        while True:
            batch = (
                client.table("events")
                .select("id, title, description")
                .not_.is_("description", "null")
                .range(offset, offset + page_size - 1)
                .execute()
                .data or []
            )
            events.extend(batch)
            if len(batch) < page_size:
                break
            offset += page_size
        path = backup_dir / f"event_descriptions_{timestamp}.json"
        path.write_text(json.dumps(events, indent=2, ensure_ascii=False))
        print(f"  Saved {len(events)} event descriptions to {path}")


def clean_entity_type(
    client,
    table: str,
    entity_label: str,
    args: argparse.Namespace,
) -> tuple[int, int, int]:
    """Clean synthetic descriptions for one entity type.

    Returns (scanned, cleaned, nulled).
    """
    print(f"\n{'='*60}")
    print(f"Cleaning {entity_label} descriptions")
    print(f"{'='*60}")

    # Fetch all records with descriptions
    records = []
    offset = 0
    page_size = 5000
    while len(records) < args.limit:
        batch = (
            client.table(table)
            .select("id, description" + (", name" if table == "festivals" else ", title"))
            .not_.is_("description", "null")
            .range(offset, offset + page_size - 1)
            .execute()
            .data or []
        )
        records.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    scanned = 0
    cleaned = 0
    nulled = 0
    examples_shown = 0

    for record in records:
        desc = record.get("description") or ""
        if not is_synthetic_description(desc):
            continue

        scanned += 1
        truncated = truncate_at_synthetic(desc)
        name = record.get("name") or record.get("title") or record["id"]

        if truncated is None:
            nulled += 1
            if examples_shown < args.preview:
                print(f"\n  [{entity_label}] {name}")
                print(f"    BEFORE: {desc[:120]}...")
                print(f"    AFTER:  NULL (entire description was synthetic)")
                examples_shown += 1
            if args.apply:
                client.table(table).update({"description": None}).eq("id", record["id"]).execute()
        else:
            cleaned += 1
            if examples_shown < args.preview:
                print(f"\n  [{entity_label}] {name}")
                print(f"    BEFORE: {desc[:120]}...")
                print(f"    AFTER:  {truncated[:120]}...")
                examples_shown += 1
            if args.apply:
                client.table(table).update({"description": truncated}).eq("id", record["id"]).execute()

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"\n  [{mode}] {entity_label}: scanned={len(records)}, synthetic={scanned}, "
          f"truncated={cleaned}, nulled={nulled}, unchanged={len(records) - scanned}")
    return (scanned, cleaned, nulled)


def main() -> int:
    args = parse_args()
    client = get_client()

    if args.backup:
        backup_descriptions(client, args)
        return 0

    if not args.apply and not args.dry_run:
        print("Usage: specify --dry-run to preview or --apply to commit changes.")
        print("       Use --backup first to save current state for rollback.")
        return 1

    total_scanned = 0
    total_cleaned = 0
    total_nulled = 0

    if not args.events_only:
        s, c, n = clean_entity_type(client, "festivals", "Festival", args)
        total_scanned += s
        total_cleaned += c
        total_nulled += n

    if not args.festivals_only:
        s, c, n = clean_entity_type(client, "events", "Event", args)
        total_scanned += s
        total_cleaned += c
        total_nulled += n

    mode = "APPLIED" if args.apply else "DRY-RUN"
    print(f"\n{'='*60}")
    print(f"[{mode}] TOTAL: synthetic={total_scanned}, truncated={total_cleaned}, nulled={total_nulled}")
    print(f"{'='*60}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Run backup**

```bash
cd crawlers && python scripts/clean_synthetic_descriptions.py --backup
```

Expected: Creates `crawlers/backups/festival_descriptions_YYYYMMDD_HHMMSS.json` and `crawlers/backups/event_descriptions_YYYYMMDD_HHMMSS.json`.

- [ ] **Step 3: Run dry-run on festivals first**

```bash
cd crawlers && python scripts/clean_synthetic_descriptions.py --dry-run --festivals-only --preview 30
```

Expected: Shows before/after for ~86 festivals with synthetic descriptions. Review the output to verify truncation is correct — real content preserved, boilerplate removed.

- [ ] **Step 4: Apply to festivals**

```bash
cd crawlers && python scripts/clean_synthetic_descriptions.py --apply --festivals-only
```

Expected: `synthetic=~86, truncated=~70, nulled=~10-15`.

- [ ] **Step 5: Run dry-run on events**

```bash
cd crawlers && python scripts/clean_synthetic_descriptions.py --dry-run --events-only --preview 30
```

Expected: Shows before/after for thousands of events. Many will become NULL (entire description was synthetic). Review a sample.

- [ ] **Step 6: Apply to events**

```bash
cd crawlers && python scripts/clean_synthetic_descriptions.py --apply --events-only
```

Expected: Large numbers — `synthetic=~20K+, truncated=~5-8K, nulled=~12-18K`.

- [ ] **Step 7: Commit**

```bash
git add crawlers/scripts/clean_synthetic_descriptions.py
git commit -m "feat(data): add synthetic description cleanup migration script

Backup + truncation tool for removing template-assembled boilerplate
from festival and event descriptions. Uses SYNTHETIC_MARKERS from
description_quality.py."
```

---

### Task 8: Verify festival detail pages look correct after cleanup

**Files:** None — verification checkpoint.

- [ ] **Step 1: Check GA Food & Wine Festival**

```bash
curl -s 'http://localhost:3000/api/festivals/ga-food-wine-festival?portal=atlanta' | python3 -c "
import sys, json
d = json.load(sys.stdin)
desc = d['festival'].get('description') or 'NULL'
print('Description:', desc[:200] if desc != 'NULL' else 'NULL')
"
```

Expected: Clean description without "Timing:", "Location:", "Pricing:", "Use the official ticket link" boilerplate.

- [ ] **Step 2: Check AfroPunk Atlanta**

```bash
curl -s 'http://localhost:3000/api/festivals/afropunk-atlanta?portal=atlanta' | python3 -c "
import sys, json
d = json.load(sys.stdin)
desc = d['festival'].get('description') or 'NULL'
print('Description:', desc[:200] if desc != 'NULL' else 'NULL')
"
```

Expected: Either a clean 1-2 sentence description or NULL (if entire description was boilerplate).

- [ ] **Step 3: Browser-test the festival detail page**

Open `http://localhost:3000/atlanta?festival=ga-food-wine-festival` in browser.

Verify: Description in the About section is clean prose, not a metadata dump. Or if NULL, the About section is hidden (progressive disclosure).

- [ ] **Step 4: Commit any fixes**

If the cleanup revealed issues (e.g., a pattern that was too aggressive), fix the patterns in `description_quality.py` and re-run.

---

### Task 9: Enable `use_llm=True` in festival enrichment

**Files:**
- Modify: `crawlers/enrich_festivals.py`

- [ ] **Step 1: Change `use_llm=False` to `use_llm=True`**

In `crawlers/enrich_festivals.py`, find the `DetailConfig` instantiation (around line 422-427) and change:

```python
detail_cfg = DetailConfig(
    use_jsonld=True,
    use_open_graph=True,
    use_heuristic=True,
    use_llm=True,  # was False — enable LLM fallback for description extraction
)
```

- [ ] **Step 2: Commit**

```bash
git add crawlers/enrich_festivals.py
git commit -m "feat(enrichment): enable LLM extraction for festival descriptions

Changes use_llm=False to True in festival detail enrichment config.
LLM fires only when JSON-LD, OG, and heuristic extraction all fail.
Cost: ~$3 for 100 festivals."
```
