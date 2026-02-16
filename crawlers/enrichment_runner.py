#!/usr/bin/env python3
"""
Enrichment runner — wraps any enrichment function with logging,
idempotency checks, and automatic data_quality recomputation.

Usage:
    # Dry run: preview what would be enriched
    python enrichment_runner.py --dry-run --type description --max-score 50

    # Run description enrichment on venues scoring < 60
    python enrichment_runner.py --type description --max-score 60 --limit 50
"""

import os
import sys
import json
import argparse
import logging
from pathlib import Path
from typing import Callable, Dict, List, Optional, Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from compute_data_quality import VENUE_WEIGHTS, score_record, update_scores

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# Source priority: higher index = higher priority (never clobber with lower)
SOURCE_PRIORITY = {
    "crawler": 0,
    "website_scrape": 1,
    "google_places": 2,
    "agent": 3,
    "manual": 4,
}


def _get_latest_source(client, venue_id: int, field_name: str) -> Optional[str]:
    """Check the enrichment log for the latest source that set a field."""
    resp = (
        client.table("venue_enrichment_log")
        .select("source")
        .eq("venue_id", venue_id)
        .eq("status", "success")
        .contains("fields_updated", [field_name])
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if resp.data and len(resp.data) > 0:
        return resp.data[0].get("source")
    return None


def _would_clobber(client, venue_id: int, fields: List[str], new_source: str) -> List[str]:
    """Return fields that would be clobbered by a lower-priority source."""
    new_priority = SOURCE_PRIORITY.get(new_source, 0)
    clobbered = []
    for field in fields:
        existing_source = _get_latest_source(client, venue_id, field)
        if existing_source:
            existing_priority = SOURCE_PRIORITY.get(existing_source, 0)
            if existing_priority > new_priority:
                clobbered.append(field)
    return clobbered


def _log_enrichment(
    client,
    venue_id: int,
    enrichment_type: str,
    status: str,
    *,
    source: Optional[str] = None,
    fields_updated: Optional[List[str]] = None,
    previous_values: Optional[Dict[str, Any]] = None,
    error_message: Optional[str] = None,
    ran_by: str = "enrichment_runner",
):
    """Insert a row into venue_enrichment_log."""
    row = {
        "venue_id": venue_id,
        "enrichment_type": enrichment_type,
        "status": status,
        "source": source,
        "fields_updated": fields_updated,
        "previous_values": json.dumps(previous_values) if previous_values else None,
        "error_message": error_message,
        "ran_by": ran_by,
    }
    client.table("venue_enrichment_log").insert(row).execute()


def _recompute_venue_quality(client, venue_id: int):
    """Recompute data_quality for a single venue."""
    fields = ",".join(["id"] + list(VENUE_WEIGHTS.keys()))
    resp = client.table("venues").select(fields).eq("id", venue_id).single().execute()
    if resp.data:
        score = score_record(resp.data, VENUE_WEIGHTS)
        update_scores(client, "venues", {venue_id: score})


def run_enrichment(
    venue_id: int,
    enrichment_type: str,
    enricher_fn: Callable[[dict], Optional[Dict[str, Any]]],
    *,
    source: str = "agent",
    skip_if_populated: Optional[List[str]] = None,
    ran_by: str = "enrichment_runner",
    dry_run: bool = False,
) -> str:
    """
    Run a single enrichment on one venue.

    Args:
        venue_id: Target venue ID
        enrichment_type: Label for the enrichment (e.g. 'description', 'image')
        enricher_fn: Called with venue dict, returns {field: new_value} or None
        source: Source label for priority tracking
        skip_if_populated: List of fields — skip if ALL are non-null
        ran_by: Who ran this (for audit)
        dry_run: If True, don't write anything

    Returns:
        'updated', 'skipped', or 'failed'
    """
    client = get_client()

    # 1. Fetch venue
    resp = client.table("venues").select("*").eq("id", venue_id).single().execute()
    if not resp.data:
        logger.warning(f"Venue {venue_id} not found")
        return "failed"
    venue = resp.data

    # 2. Check skip_if_populated
    if skip_if_populated:
        all_filled = all(
            venue.get(f) is not None and venue.get(f) != ""
            for f in skip_if_populated
        )
        if all_filled:
            if not dry_run:
                _log_enrichment(
                    client, venue_id, enrichment_type, "skipped",
                    source=source, ran_by=ran_by,
                )
            logger.debug(f"Venue {venue_id} ({venue.get('name')}): skipped (fields populated)")
            return "skipped"

    # 3. Call enricher
    try:
        updates = enricher_fn(venue)
    except Exception as e:
        if not dry_run:
            _log_enrichment(
                client, venue_id, enrichment_type, "failed",
                source=source, error_message=str(e), ran_by=ran_by,
            )
        logger.error(f"Venue {venue_id} ({venue.get('name')}): enricher error: {e}")
        return "failed"

    if not updates:
        if not dry_run:
            _log_enrichment(
                client, venue_id, enrichment_type, "skipped",
                source=source, ran_by=ran_by,
            )
        logger.debug(f"Venue {venue_id} ({venue.get('name')}): enricher returned nothing")
        return "skipped"

    # 4. Check source priority — never clobber higher-priority data
    clobbered = _would_clobber(client, venue_id, list(updates.keys()), source)
    if clobbered:
        for f in clobbered:
            del updates[f]
        if not updates:
            if not dry_run:
                _log_enrichment(
                    client, venue_id, enrichment_type, "skipped",
                    source=source, ran_by=ran_by,
                )
            logger.debug(f"Venue {venue_id}: all fields clobbered by higher-priority source")
            return "skipped"

    if dry_run:
        logger.info(f"[DRY RUN] Venue {venue_id} ({venue.get('name')}): would update {list(updates.keys())}")
        return "updated"

    # 5. Snapshot previous values
    previous = {f: venue.get(f) for f in updates}

    # 6. Apply update
    client.table("venues").update(updates).eq("id", venue_id).execute()

    # 7. Log
    _log_enrichment(
        client, venue_id, enrichment_type, "success",
        source=source,
        fields_updated=list(updates.keys()),
        previous_values=previous,
        ran_by=ran_by,
    )

    # 8. Recompute data_quality
    _recompute_venue_quality(client, venue_id)

    logger.info(f"Venue {venue_id} ({venue.get('name')}): updated {list(updates.keys())}")
    return "updated"


def run_batch(
    enrichment_type: str,
    enricher_fn: Callable[[dict], Optional[Dict[str, Any]]],
    *,
    source: str = "agent",
    max_score: int = 60,
    skip_if_populated: Optional[List[str]] = None,
    limit: int = 100,
    ran_by: str = "enrichment_runner",
    dry_run: bool = False,
) -> Dict[str, int]:
    """
    Run enrichment on a batch of low-quality venues.

    Args:
        enrichment_type: Label for audit
        enricher_fn: Called per venue, returns update dict or None
        source: Source label
        max_score: Only process venues with data_quality < this
        skip_if_populated: Skip venues where all these fields are non-null
        limit: Max venues to process
        ran_by: Audit label
        dry_run: Preview mode

    Returns:
        {processed, updated, skipped, failed}
    """
    client = get_client()

    # Query low-quality active venues
    resp = (
        client.table("venues")
        .select("id, name, data_quality")
        .lt("data_quality", max_score)
        .order("data_quality", desc=False)
        .limit(limit)
        .execute()
    )

    venues = resp.data or []
    logger.info(f"Found {len(venues)} venues with data_quality < {max_score}")

    stats = {"processed": 0, "updated": 0, "skipped": 0, "failed": 0}

    for v in venues:
        result = run_enrichment(
            v["id"],
            enrichment_type,
            enricher_fn,
            source=source,
            skip_if_populated=skip_if_populated,
            ran_by=ran_by,
            dry_run=dry_run,
        )
        stats["processed"] += 1
        stats[result] += 1

    logger.info(f"Batch complete: {stats}")
    return stats


def main():
    parser = argparse.ArgumentParser(description="Venue enrichment runner")
    parser.add_argument("--type", required=True, help="Enrichment type (description, image, hours, etc.)")
    parser.add_argument("--max-score", type=int, default=60, help="Only process venues below this score")
    parser.add_argument("--limit", type=int, default=100, help="Max venues to process")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    # Placeholder enricher — real enrichers would be imported based on --type
    def placeholder_enricher(venue: dict) -> Optional[Dict[str, Any]]:
        logger.warning(f"No enricher registered for type '{args.type}'. Use run_batch() programmatically.")
        return None

    stats = run_batch(
        enrichment_type=args.type,
        enricher_fn=placeholder_enricher,
        max_score=args.max_score,
        limit=args.limit,
        dry_run=args.dry_run,
    )

    print(f"\nResults: {json.dumps(stats, indent=2)}")


if __name__ == "__main__":
    main()
