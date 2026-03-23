#!/usr/bin/env python3
"""
Merge known duplicate venue pairs into canonical venue records.

Repoints all FK references, deactivates the duplicate, and appends its slug
to the keeper's aliases array.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/merge_duplicate_venues.py           # dry run (default)
    python3 scripts/merge_duplicate_venues.py --apply   # execute merges
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


MERGE_PLAN = [
    {
        "kill_id": 726,
        "keep_id": 1105,
        "name": "MODA (726→1105)",
        "reason": "1105 has data, 726 inactive",
    },
    {
        "kill_id": 219,
        "keep_id": 1105,
        "name": "MODA (219→1105)",
        "reason": "219 inactive",
    },
    {
        "kill_id": 223,
        "keep_id": 984,
        "name": "Wren's Nest (223→984)",
        "reason": "984 has data, 223 inactive",
    },
    {
        "kill_id": 4109,
        "keep_id": 213,
        "name": "Delta Flight Museum",
        "reason": "213 is canonical",
    },
    {
        "kill_id": 4100,
        "keep_id": 209,
        "name": "World of Coca-Cola",
        "reason": "209 is canonical slug",
    },
    {
        "kill_id": 964,
        "keep_id": 332,
        "name": "MudFire",
        "reason": "Same address, pick one",
    },
    {
        "kill_id": 435,
        "keep_id": 241,
        "name": "Poem 88",
        "reason": "435 inactive (verify addresses first)",
    },
    # Exhibition data cleanup — 2026-03-22
    {
        "kill_id": 1079,
        "keep_id": 7076,
        "name": "One Contemporary Gallery → One Contemporary",
        "reason": "Same gallery, two venue records",
    },
    {
        "kill_id": 242,
        "keep_id": 6526,
        "name": "Besharat Gallery → Besharat Contemporary",
        "reason": "Same Castleberry Hill gallery, two records",
    },
    {
        "kill_id": 965,
        "keep_id": 329,
        "name": "Spruill Center (gallery dupe) → Spruill Center (arts_center)",
        "reason": "Same Dunwoody arts center, 965 is gallery-typed duplicate of 329",
    },
    {
        "kill_id": 1078,
        "keep_id": 329,
        "name": "Spruill Gallery → Spruill Center (arts_center)",
        "reason": "Same Dunwoody arts center, 1078 is gallery-typed duplicate of 329",
    },
    {
        "kill_id": 6530,
        "keep_id": 7077,
        "name": "Welch School of Art Gallery → Ernest G. Welch School Galleries",
        "reason": "Same GSU gallery, 7077 has better slug and more exhibitions",
    },
    # ── Batch 2: venue dedup audit 2026-03-23 ──
    # 7 Stages (3 → 1)
    {
        "kill_id": 44,
        "keep_id": 4981,
        "name": "7 Stages Theater → 7 Stages",
        "reason": "Same L5P theater, 4981 has 58 events + 36 series",
    },
    {
        "kill_id": 5338,
        "keep_id": 4981,
        "name": "7 Stages Theatre → 7 Stages",
        "reason": "Same L5P theater, 4981 has 58 events + 36 series",
    },
    # Symphony Hall (3 → 1)
    {
        "kill_id": 113,
        "keep_id": 111,
        "name": "Atlanta Symphony Hall → Symphony Hall",
        "reason": "Same Woodruff venue, 111 has 57 events",
    },
    {
        "kill_id": 1752,
        "keep_id": 111,
        "name": "Symphony Hall at Woodruff → Symphony Hall",
        "reason": "Same Woodruff venue, 111 has 57 events",
    },
    # Atlanta Film Festival (keep 200, the permanent org)
    {
        "kill_id": 6589,
        "keep_id": 200,
        "name": "Atlanta Film Festival 2026 → Atlanta Film Festival",
        "reason": "Ephemeral year-specific record; 200 is the permanent org",
    },
    # Plaza Theatre (4 → 1)
    {
        "kill_id": 2179,
        "keep_id": 197,
        "name": "The Plaza Theatre → Plaza Theatre",
        "reason": "Same Ponce cinema, 197 has 73 events + enrichment",
    },
    {
        "kill_id": 7082,
        "keep_id": 197,
        "name": "Plaza Theatre | LeFont Auditorium → Plaza Theatre",
        "reason": "Sub-auditorium, merge into main venue",
    },
    {
        "kill_id": 7079,
        "keep_id": 197,
        "name": "Plaza Theatre | Rej Auditorium → Plaza Theatre",
        "reason": "Sub-auditorium, merge into main venue",
    },
    # The Eastern
    {
        "kill_id": 131,
        "keep_id": 46,
        "name": "The Eastern-GA → The Eastern",
        "reason": "Same Memorial Dr venue, 46 has 53 events",
    },
    # Mary's
    {
        "kill_id": 4936,
        "keep_id": 571,
        "name": "Mary's Bar → Mary's",
        "reason": "Same EAV bar, 571 has 33 events + 14 series",
    },
    # Center Stage
    {
        "kill_id": 418,
        "keep_id": 127,
        "name": "Center Stage → Center Stage Theater",
        "reason": "Same W Peachtree venue, 127 has 28 events",
    },
    # Medieval Times
    {
        "kill_id": 2468,
        "keep_id": 7089,
        "name": "Medieval Times → Medieval Times Atlanta",
        "reason": "7089 has enrichment (dest_details + features + specials)",
    },
    # Jennie T. Anderson Theatre
    {
        "kill_id": 6505,
        "keep_id": 5326,
        "name": "Jennie T. Anderson Theatre (dupe) → Jennie T. Anderson Theatre",
        "reason": "Same Marietta theater, 5326 has 22 events",
    },
    # Believe Music Hall
    {
        "kill_id": 17,
        "keep_id": 417,
        "name": "Believe Music Hall (basement entrance) → Believe Music Hall",
        "reason": "Same venue, 417 has 34 events",
    },
    # Cook's Warehouse
    {
        "kill_id": 334,
        "keep_id": 2592,
        "name": "Cook's Warehouse - Midtown → Cook's Warehouse",
        "reason": "Same Piedmont location, 2592 has 52 events + 40 series",
    },
    # Petite Violette
    {
        "kill_id": 6509,
        "keep_id": 5229,
        "name": "Petite Violette Restaurant → Petite Violette",
        "reason": "Same Clairmont Rd restaurant, 5229 has 19 events",
    },
    # Banshee
    {
        "kill_id": 6481,
        "keep_id": 1022,
        "name": "Banshee (dupe) → Banshee",
        "reason": "Same Glenwood Ave bar, 1022 is original",
    },
    # Bone's Restaurant
    {
        "kill_id": 5886,
        "keep_id": 1163,
        "name": "Bone's Restaurant (Buckhead dupe) → Bone's Restaurant",
        "reason": "Same Piedmont Rd address, 1163 has cleaner slug",
    },
    # Jeju Sauna
    {
        "kill_id": 1722,
        "keep_id": 4035,
        "name": "Jeju Sauna (Duluth dupe) → Jeju Sauna",
        "reason": "Same address, 4035 has better venue_type + full address",
    },
    # Redacted Basement
    {
        "kill_id": 705,
        "keep_id": 6472,
        "name": "Redacted Basement (dupe) → Redacted Basement Drink Parlor",
        "reason": "6472 has description + fuller address",
    },
]

# Tables with a venue_id FK — ordered from highest-volume to lowest.
# Each entry: (table_name, column_name)
FK_TABLES = [
    ("events", "venue_id"),
    ("exhibitions", "venue_id"),
    ("open_calls", "venue_id"),
    ("programs", "venue_id"),
    ("venue_specials", "venue_id"),
    ("venue_features", "venue_id"),
    ("venue_highlights", "venue_id"),
    ("editorial_mentions", "venue_id"),
    ("venue_occasions", "venue_id"),
    ("venue_inventory_snapshots", "venue_id"),
    ("venue_destination_details", "venue_id"),
    ("sources", "venue_id"),
    ("series", "venue_id"),
]


def _table_exists(client: Any, table: str) -> bool:
    """Return True if the table is queryable (exists and is accessible)."""
    try:
        client.table(table).select("id").limit(1).execute()
        return True
    except Exception:
        return False


def _table_has_column(client: Any, table: str, column: str) -> bool:
    """Return True if the column exists on the table."""
    try:
        client.table(table).select(column).limit(1).execute()
        return True
    except Exception:
        return False


def _get_venue_by_id(client: Any, venue_id: int) -> Optional[Dict[str, Any]]:
    result = (
        client.table("venues")
        .select("id, slug, name, active, aliases")
        .eq("id", venue_id)
        .limit(1)
        .execute()
    )
    rows = result.data or []
    return rows[0] if rows else None


def _count_refs(client: Any, table: str, column: str, venue_id: int) -> int:
    try:
        result = (
            client.table(table)
            .select("id", count="exact")
            .eq(column, venue_id)
            .execute()
        )
        return int(result.count or 0)
    except Exception:
        return 0


def _repoint_refs(
    client: Any,
    table: str,
    column: str,
    from_venue_id: int,
    to_venue_id: int,
    dry_run: bool,
) -> int:
    count = _count_refs(client, table, column, from_venue_id)
    if count == 0:
        return 0
    if dry_run:
        return count
    try:
        client.table(table).update({column: to_venue_id}).eq(column, from_venue_id).execute()
    except Exception as exc:
        error_str = str(exc).lower()
        if "unique" in error_str or "duplicate key" in error_str or "23505" in error_str:
            # Unique constraint conflict — keeper already has equivalent rows.
            # For events: deactivate instead of delete (avoids cascade timeouts).
            # For other tables: try delete, fall back to deactivate.
            logger.info("    %s: unique conflict — deactivating %d orphan rows from kill venue", table, count)
            try:
                if table == "events":
                    client.table(table).update({"is_active": False}).eq(column, from_venue_id).execute()
                else:
                    client.table(table).delete().eq(column, from_venue_id).execute()
            except Exception:
                # Last resort: deactivate if delete fails
                try:
                    client.table(table).update({"is_active": False}).eq(column, from_venue_id).execute()
                except Exception:
                    logger.warning("    %s: could not clean up orphan rows for venue %d", table, from_venue_id)
        else:
            raise
    return count


def _append_alias_slug(
    client: Any,
    keeper: Dict[str, Any],
    slug_to_add: Optional[str],
    dry_run: bool,
) -> None:
    """Append slug_to_add to the keeper's aliases array if not already present."""
    if not slug_to_add:
        return
    existing: List[str] = keeper.get("aliases") or []
    if slug_to_add in existing:
        return
    merged = list(existing) + [slug_to_add]
    if dry_run:
        logger.info("    [dry-run] would append alias slug '%s' to keeper", slug_to_add)
        return
    client.table("venues").update({"aliases": merged}).eq("id", keeper["id"]).execute()


def _deactivate_venue(client: Any, venue_id: int, dry_run: bool) -> None:
    if dry_run:
        logger.info("    [dry-run] would set active=false on venue %d", venue_id)
        return
    client.table("venues").update({"active": False}).eq("id", venue_id).execute()


def _probe_tables(client: Any) -> Dict[str, bool]:
    """Return a dict of table -> available for every FK_TABLES entry."""
    availability: Dict[str, bool] = {}
    for table, column in FK_TABLES:
        key = f"{table}.{column}"
        if table not in availability:
            availability[table] = _table_exists(client, table)
        if availability[table]:
            # Table exists — confirm the specific column is present
            col_key = key
            availability[col_key] = _table_has_column(client, table, column)
        else:
            availability[f"{table}.{column}"] = False
    return availability


def run(apply_changes: bool) -> None:
    dry_run = not apply_changes
    client = get_client()

    logger.info("=" * 72)
    logger.info("Venue Deduplication Merge")
    logger.info("Mode: %s", "APPLY" if apply_changes else "DRY RUN")
    logger.info("=" * 72)

    # Probe every FK table once upfront so we don't probe per-pair.
    logger.info("")
    logger.info("Probing FK tables...")
    avail = _probe_tables(client)
    for table, column in FK_TABLES:
        col_key = f"{table}.{column}"
        status = "ok" if avail.get(col_key) else "SKIP (not available)"
        logger.info("  %-45s %s", col_key, status)

    # Per-table running totals for the final summary.
    table_totals: Dict[str, int] = {f"{t}.{c}": 0 for t, c in FK_TABLES}
    venues_deactivated = 0
    pairs_processed = 0
    pairs_skipped = 0

    for item in MERGE_PLAN:
        kill_id: int = item["kill_id"]
        keep_id: int = item["keep_id"]
        name: str = item["name"]
        reason: str = item["reason"]

        logger.info("")
        logger.info("-" * 72)
        logger.info("Pair: %s", name)
        logger.info("Reason: %s", reason)
        logger.info("Kill: %d  →  Keep: %d", kill_id, keep_id)

        killer = _get_venue_by_id(client, kill_id)
        keeper = _get_venue_by_id(client, keep_id)

        if not killer:
            logger.warning("  SKIP — kill venue %d not found in DB", kill_id)
            pairs_skipped += 1
            continue
        if not keeper:
            logger.warning("  SKIP — keep venue %d not found in DB", keep_id)
            pairs_skipped += 1
            continue
        if kill_id == keep_id:
            logger.warning("  SKIP — kill_id == keep_id (%d), nothing to do", kill_id)
            pairs_skipped += 1
            continue

        logger.info(
            "  Kill: '%s' (slug=%s, active=%s)",
            killer.get("name"),
            killer.get("slug"),
            killer.get("active"),
        )
        logger.info(
            "  Keep: '%s' (slug=%s, active=%s)",
            keeper.get("name"),
            keeper.get("slug"),
            keeper.get("active"),
        )

        # Repoint every available FK table.
        for table, column in FK_TABLES:
            col_key = f"{table}.{column}"
            if not avail.get(col_key):
                continue
            moved = _repoint_refs(client, table, column, kill_id, keep_id, dry_run)
            if moved:
                logger.info("  %-45s repointed %d rows", col_key, moved)
                table_totals[col_key] += moved

        # Append the killer's slug to the keeper's aliases array.
        _append_alias_slug(client, keeper, killer.get("slug"), dry_run)

        # Deactivate the killer venue.
        if killer.get("active") is not False:
            _deactivate_venue(client, kill_id, dry_run)
            venues_deactivated += 1
        else:
            logger.info("  Kill venue %d already inactive, skipping deactivate", kill_id)

        pairs_processed += 1

    # Final summary.
    logger.info("")
    logger.info("=" * 72)
    logger.info("Summary  [%s]", "APPLIED" if apply_changes else "DRY RUN — no changes written")
    logger.info("Pairs processed: %d  |  Skipped: %d", pairs_processed, pairs_skipped)
    logger.info("Venues deactivated: %d", venues_deactivated)
    logger.info("")
    logger.info("Refs migrated per table:")
    any_moved = False
    for table, column in FK_TABLES:
        col_key = f"{table}.{column}"
        total = table_totals[col_key]
        if total:
            any_moved = True
            logger.info("  %-45s %d", col_key, total)
    if not any_moved:
        logger.info("  (none)")
    logger.info("=" * 72)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Merge duplicate venue pairs")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write changes to the database (default is dry-run).",
    )
    args = parser.parse_args()
    run(apply_changes=args.apply)
