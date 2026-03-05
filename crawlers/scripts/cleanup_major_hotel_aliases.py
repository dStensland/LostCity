#!/usr/bin/env python3
"""
Merge known major-hotel alias/rebrand venue records into canonical slugs.

This is intentionally scoped to high-confidence hotel mappings so we avoid
broad, risky merges.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 cleanup_major_hotel_aliases.py          # dry run
    python3 cleanup_major_hotel_aliases.py --apply  # execute merge + deactivate aliases
"""

import argparse
import logging
from typing import Any, Dict, List, Optional

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


MERGE_PLAN = [
    {
        "keeper_slug": "bellyard-hotel",
        "alias_slugs": ["bellyard-west-midtown-atlanta-a-tribute-portfolio-hotel"],
        "reason": "Same property naming variant",
    },
    {
        "keeper_slug": "candler-hotel",
        "alias_slugs": ["the-candler-hotel-atlanta-curio-collection-by-hilton"],
        "reason": "Same property naming variant",
    },
    {
        "keeper_slug": "epicurean-atlanta",
        "alias_slugs": ["epicurean-hotel-atlanta", "epicurean-atlanta-hotel"],
        "reason": "Same property naming variants",
    },
    {
        "keeper_slug": "the-tess-buckhead",
        "alias_slugs": ["thompson-buckhead"],
        "reason": "Confirmed rebrand (Thompson Buckhead -> The Tess)",
    },
    {
        "keeper_slug": "the-whitley",
        "alias_slugs": ["ritz-carlton-buckhead"],
        "reason": "Same address, post-rebrand naming",
    },
]


def _table_has_column(client: Any, table: str, column: str) -> bool:
    try:
        client.table(table).select(column).limit(1).execute()
        return True
    except Exception:
        return False


def _get_venue_by_slug(client: Any, slug: str) -> Optional[Dict[str, Any]]:
    result = client.table("venues").select("*").eq("slug", slug).limit(1).execute()
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
    enabled: bool = True,
) -> int:
    if not enabled:
        return 0
    count = _count_refs(client, table, column, from_venue_id)
    if count == 0:
        return 0
    if dry_run:
        return count

    client.table(table).update({column: to_venue_id}).eq(column, from_venue_id).execute()
    return count


def _append_aliases(client: Any, keeper: Dict[str, Any], aliases: List[str], dry_run: bool) -> None:
    existing = keeper.get("aliases") or []
    merged = list(existing)
    for alias in aliases:
        if alias not in merged:
            merged.append(alias)
    if merged == existing:
        return
    if dry_run:
        return
    client.table("venues").update({"aliases": merged}).eq("id", keeper["id"]).execute()


def _deactivate_alias(client: Any, alias_id: int, dry_run: bool) -> None:
    if dry_run:
        return
    client.table("venues").update({"active": False}).eq("id", alias_id).execute()


def run(apply_changes: bool) -> None:
    dry_run = not apply_changes
    client = get_client()
    sources_has_venue_id = _table_has_column(client, "sources", "venue_id")

    logger.info("=" * 72)
    logger.info("Major Hotel Alias Cleanup")
    logger.info("Mode: %s", "APPLY" if apply_changes else "DRY RUN")
    logger.info("sources.venue_id available: %s", sources_has_venue_id)
    logger.info("=" * 72)

    totals = {
        "alias_rows_seen": 0,
        "events_repointed": 0,
        "source_links_repointed": 0,
        "specials_repointed": 0,
        "aliases_deactivated": 0,
    }

    for item in MERGE_PLAN:
        keeper_slug = item["keeper_slug"]
        alias_slugs = item["alias_slugs"]
        reason = item["reason"]

        keeper = _get_venue_by_slug(client, keeper_slug)
        if not keeper:
            logger.warning("SKIP keeper missing: %s", keeper_slug)
            continue

        logger.info("")
        logger.info("Keeper: %s (%s)", keeper_slug, keeper["id"])
        logger.info("Reason: %s", reason)

        found_alias_slugs: List[str] = []
        for alias_slug in alias_slugs:
            alias = _get_venue_by_slug(client, alias_slug)
            if not alias:
                logger.info("  Alias missing: %s", alias_slug)
                continue

            if alias["id"] == keeper["id"]:
                logger.info("  Alias is keeper already: %s", alias_slug)
                continue

            totals["alias_rows_seen"] += 1
            found_alias_slugs.append(alias_slug)

            events_moved = _repoint_refs(
                client, "events", "venue_id", alias["id"], keeper["id"], dry_run
            )
            sources_moved = _repoint_refs(
                client,
                "sources",
                "venue_id",
                alias["id"],
                keeper["id"],
                dry_run,
                enabled=sources_has_venue_id,
            )
            specials_moved = _repoint_refs(
                client, "venue_specials", "venue_id", alias["id"], keeper["id"], dry_run
            )

            totals["events_repointed"] += events_moved
            totals["source_links_repointed"] += sources_moved
            totals["specials_repointed"] += specials_moved

            logger.info(
                "  Alias: %s (%s) -> events:%d sources:%d specials:%d active:%s",
                alias_slug,
                alias["id"],
                events_moved,
                sources_moved,
                specials_moved,
                alias.get("active"),
            )

            if alias.get("active"):
                _deactivate_alias(client, alias["id"], dry_run)
                totals["aliases_deactivated"] += 1

        if found_alias_slugs:
            _append_aliases(client, keeper, found_alias_slugs, dry_run)

    logger.info("")
    logger.info("=" * 72)
    logger.info("Summary")
    logger.info("Alias rows processed: %d", totals["alias_rows_seen"])
    logger.info("Events repointed: %d", totals["events_repointed"])
    logger.info("Source venue links repointed: %d", totals["source_links_repointed"])
    logger.info("Venue specials repointed: %d", totals["specials_repointed"])
    logger.info("Aliases deactivated: %d", totals["aliases_deactivated"])
    logger.info("=" * 72)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cleanup major-hotel alias venues")
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply updates (default is dry-run).",
    )
    args = parser.parse_args()
    run(apply_changes=args.apply)
