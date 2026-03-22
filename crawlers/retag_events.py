#!/usr/bin/env python3
"""
Backfill script: re-run tag inference with corrected rules on events that have
known bad tags from two specific bugs:

  1. Faith-tagged community events where "church" in the title/description was
     the only reason — "church" is a venue name, not an activity keyword.

  2. Events tagged both "21+" and "family-friendly" where the family-friendly
     tag came from venue inheritance, not from explicit family language.

Usage:
  python3 retag_events.py --dry-run    # show what would change, no writes
  python3 retag_events.py              # apply changes to production
"""

import argparse
import logging
import sys
from typing import Any

from db import get_client
from tag_inference import infer_tags

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Keywords whose presence in title+description would still justify "faith" tag
# even after removing "church" from the keyword list.
# ---------------------------------------------------------------------------
_FAITH_KEYWORDS = {
    "faith", "spiritual", "worship", "prayer", "bible study",
    "torah", "dharma", "puja", "vespers", "shabbat",
}

# Explicit family language required to keep "family-friendly" alongside "21+"
_FAMILY_EXPLICIT_PHRASES = [
    "bring the kids", "kid-friendly", "children welcome",
    "for families", "family event", "all ages welcome",
    "family-friendly", "for all ages",
]

PAGE_SIZE = 500


def _fetch_all(client, query) -> list[dict[str, Any]]:
    """Fetch all rows from a Supabase query using range-based pagination."""
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        result = query.range(offset, offset + PAGE_SIZE - 1).execute()
        batch = result.data or []
        rows.extend(batch)
        if len(batch) < PAGE_SIZE:
            break
        offset += PAGE_SIZE
    return rows


def fetch_faith_candidates(client) -> list[dict[str, Any]]:
    """
    Community events tagged 'faith' where the only faith signal was the word
    'church'.  The corrected rule no longer maps 'church' -> faith, so these
    events may have the tag spuriously.
    """
    logger.info("Fetching community events with 'faith' tag...")
    query = (
        client.table("events")
        .select("id, title, description, tags, category_id, is_free, price_min, ticket_url")
        .eq("category_id", "community")
        .contains("tags", ["faith"])
    )
    return _fetch_all(client, query)


def fetch_conflict_candidates(client) -> list[dict[str, Any]]:
    """
    Events tagged both '21+' and 'family-friendly'.
    """
    logger.info("Fetching events tagged both '21+' and 'family-friendly'...")
    query = (
        client.table("events")
        .select("id, title, description, tags, category_id, is_free, price_min, ticket_url")
        .contains("tags", ["21+", "family-friendly"])
    )
    return _fetch_all(client, query)


def _has_faith_signal(event: dict) -> bool:
    """Return True if the event has a genuine faith keyword (excluding 'church')."""
    text = f"{event.get('title', '')} {event.get('description', '')}".lower()
    return any(kw in text for kw in _FAITH_KEYWORDS)


def _has_explicit_family_language(event: dict) -> bool:
    """Return True if the event has explicit family-inclusive language."""
    text = f"{event.get('title', '')} {event.get('description', '')}".lower()
    return any(phrase in text for phrase in _FAMILY_EXPLICIT_PHRASES)


def compute_tag_changes(
    events: list[dict], reason: str
) -> list[tuple[int, list[str], list[str]]]:
    """
    Return a list of (event_id, old_tags, new_tags) for events that need updates.
    Uses the corrected infer_tags logic with preserve_existing=False so we start
    fresh from what was stored minus the bad tags.
    """
    changes = []
    for event in events:
        old_tags = list(event.get("tags") or [])

        if reason == "faith":
            if "faith" not in old_tags:
                continue
            # Remove faith if there's no genuine faith keyword (only "church" was)
            if _has_faith_signal(event):
                continue  # Faith tag is legitimate — keep it
            new_tags = [t for t in old_tags if t != "faith"]

        elif reason == "conflict":
            if "21+" not in old_tags or "family-friendly" not in old_tags:
                continue
            if _has_explicit_family_language(event):
                continue  # Both tags are legitimate — keep them
            new_tags = [t for t in old_tags if t != "family-friendly"]

        else:
            continue

        if set(new_tags) != set(old_tags):
            changes.append((event["id"], old_tags, new_tags))

    return changes


def apply_changes(
    client, changes: list[tuple[int, list[str], list[str]]], dry_run: bool
) -> int:
    """Write updated tag arrays back to the events table."""
    updated = 0
    for event_id, old_tags, new_tags in changes:
        removed = sorted(set(old_tags) - set(new_tags))
        added = sorted(set(new_tags) - set(old_tags))
        log_parts = []
        if removed:
            log_parts.append(f"remove {removed}")
        if added:
            log_parts.append(f"add {added}")
        logger.info(f"  event {event_id}: {', '.join(log_parts)}")

        if not dry_run:
            client.table("events").update({"tags": new_tags}).eq("id", event_id).execute()
            updated += 1

    return updated


def main() -> None:
    parser = argparse.ArgumentParser(description="Re-tag events with corrected inference rules")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Log what would change without writing to the database",
    )
    args = parser.parse_args()

    dry_run: bool = args.dry_run
    if dry_run:
        logger.info("[DRY RUN] No changes will be written.")

    client = get_client()

    total_updated = 0
    total_candidates = 0

    # --- Fix 1: spurious "faith" tags from "church" venue names ---
    faith_events = fetch_faith_candidates(client)
    logger.info(f"Found {len(faith_events)} community+faith events to evaluate")
    faith_changes = compute_tag_changes(faith_events, reason="faith")
    total_candidates += len(faith_events)
    logger.info(f"  {len(faith_changes)} events will lose the 'faith' tag")
    updated = apply_changes(client, faith_changes, dry_run)
    total_updated += updated if not dry_run else len(faith_changes)

    # --- Fix 2: 21+ / family-friendly conflicts ---
    conflict_events = fetch_conflict_candidates(client)
    logger.info(f"Found {len(conflict_events)} events tagged both '21+' and 'family-friendly'")
    conflict_changes = compute_tag_changes(conflict_events, reason="conflict")
    total_candidates += len(conflict_events)
    logger.info(f"  {len(conflict_changes)} events will lose the 'family-friendly' tag")
    updated = apply_changes(client, conflict_changes, dry_run)
    total_updated += updated if not dry_run else len(conflict_changes)

    # --- Summary ---
    print()
    print("=" * 60)
    print(f"Candidates evaluated : {total_candidates}")
    if dry_run:
        print(f"Would update         : {total_updated}")
        print("[DRY RUN] No changes written.")
    else:
        print(f"Events updated       : {total_updated}")
    print("=" * 60)


if __name__ == "__main__":
    main()
