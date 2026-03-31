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

from db import get_client
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
