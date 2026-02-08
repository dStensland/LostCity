#!/usr/bin/env python3
"""
Compute per-record data_quality scores (0-100) for all entity tables.

Scores are deterministic, based on field completeness with weighted scoring.
Higher scores = richer records suitable for feed promotion, search ranking, etc.

Usage:
    python3 compute_data_quality.py              # All tables
    python3 compute_data_quality.py --table venues  # Single table
    python3 compute_data_quality.py --dry-run     # Preview without writing
"""

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import Dict, List, Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

# ── Scoring weights per entity type ──
# Each dict maps field_name -> points. Points sum to 100.

VENUE_WEIGHTS = {
    "address": 10,
    "lat": 8,
    "lng": 8,
    "neighborhood": 10,
    "city": 5,
    "state": 3,
    "zip": 4,
    "venue_type": 10,
    "website": 7,
    "image_url": 15,
    "description": 15,
    "vibes": 5,
}  # 100 pts total

EVENT_WEIGHTS = {
    "description": 20,
    "start_time": 8,
    "venue_id": 15,
    "category": 10,
    "image_url": 20,
    "source_url": 5,
    "is_free": 5,
    "price_min": 7,
    "end_date": 5,
    "end_time": 5,
}  # 100 pts total

SERIES_WEIGHTS = {
    "series_type": 10,
    "description": 25,
    "image_url": 25,
    "category": 10,
    "frequency": 10,
    "genres": 10,
    "festival_id": 10,
}  # 100 pts total

FESTIVAL_WEIGHTS = {
    "description": 20,
    "website": 10,
    "image_url": 20,
    "announced_start": 15,
    "neighborhood": 8,
    "organization_id": 10,
    "categories": 7,
    "typical_month": 5,
    "ticket_url": 5,
}  # 100 pts total

ORG_WEIGHTS = {
    "description": 20,
    "website": 15,
    "logo_url": 20,
    "org_type": 10,
    "city": 8,
    "neighborhood": 12,
    "is_verified": 5,
    "events_per_month_avg": 5,
    "total_events_tracked": 5,
}  # 100 pts total


def score_record(record: dict, weights: Dict[str, int]) -> int:
    """Compute quality score for a single record."""
    score = 0
    for field, points in weights.items():
        value = record.get(field)
        if value is not None and value != "" and value != [] and value != {}:
            # For boolean fields, True counts as filled
            if isinstance(value, bool):
                score += points if value else 0
            # For numeric fields like events_per_month_avg, > 0 counts
            elif isinstance(value, (int, float)):
                score += points if value > 0 else 0
            # For arrays/lists
            elif isinstance(value, list):
                score += points if len(value) > 0 else 0
            else:
                score += points
    return min(score, 100)


def fetch_all(client, table: str, select: str, extra_filters=None) -> list:
    """Fetch all records from a table with pagination."""
    all_records = []
    offset = 0
    batch_size = 1000
    while True:
        q = client.table(table).select(select)
        if extra_filters:
            for method, args in extra_filters:
                q = getattr(q, method)(*args)
        q = q.order("id").range(offset, offset + batch_size - 1)
        r = q.execute()
        if not r.data:
            break
        all_records.extend(r.data)
        if len(r.data) < batch_size:
            break
        offset += batch_size
    return all_records


def update_scores(client, table: str, scores: Dict[str, int], dry_run: bool = False):
    """Batch-update data_quality scores via direct Postgres for speed."""
    if dry_run:
        return

    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL not set")

    conn = psycopg2.connect(database_url)
    cur = conn.cursor()

    # Use executemany with batched updates for efficiency
    items = list(scores.items())
    batch_size = 500
    for i in range(0, len(items), batch_size):
        batch = items[i:i+batch_size]
        psycopg2.extras.execute_batch(
            cur,
            f"UPDATE {table} SET data_quality = %s WHERE id = %s",
            [(score, record_id) for record_id, score in batch],
            page_size=100,
        )
        conn.commit()

    cur.close()
    conn.close()


def compute_venues(client, dry_run: bool = False) -> dict:
    """Compute and store venue quality scores."""
    fields = ",".join(["id"] + list(VENUE_WEIGHTS.keys()))
    records = fetch_all(client, "venues", fields)
    logger.info(f"Venues: scoring {len(records)} records")

    scores = {}
    distribution = {0: 0, 25: 0, 50: 0, 75: 0, 90: 0}

    for r in records:
        s = score_record(r, VENUE_WEIGHTS)
        scores[r["id"]] = s
        for threshold in sorted(distribution.keys(), reverse=True):
            if s >= threshold:
                distribution[threshold] += 1
                break

    update_scores(client, "venues", scores, dry_run)
    return {"count": len(records), "scores": scores, "distribution": distribution}


def compute_events(client, dry_run: bool = False) -> dict:
    """Compute and store event quality scores."""
    fields = ",".join(["id"] + list(EVENT_WEIGHTS.keys()))
    records = fetch_all(client, "events", fields)
    logger.info(f"Events: scoring {len(records)} records")

    scores = {}
    distribution = {0: 0, 25: 0, 50: 0, 75: 0, 90: 0}

    for r in records:
        s = score_record(r, EVENT_WEIGHTS)
        scores[r["id"]] = s
        for threshold in sorted(distribution.keys(), reverse=True):
            if s >= threshold:
                distribution[threshold] += 1
                break

    update_scores(client, "events", scores, dry_run)
    return {"count": len(records), "scores": scores, "distribution": distribution}


def compute_series(client, dry_run: bool = False) -> dict:
    """Compute and store series quality scores."""
    fields = ",".join(["id"] + list(SERIES_WEIGHTS.keys()))
    records = fetch_all(client, "series", fields)
    logger.info(f"Series: scoring {len(records)} records")

    scores = {}
    distribution = {0: 0, 25: 0, 50: 0, 75: 0, 90: 0}

    for r in records:
        s = score_record(r, SERIES_WEIGHTS)
        scores[r["id"]] = s
        for threshold in sorted(distribution.keys(), reverse=True):
            if s >= threshold:
                distribution[threshold] += 1
                break

    update_scores(client, "series", scores, dry_run)
    return {"count": len(records), "scores": scores, "distribution": distribution}


def compute_festivals(client, dry_run: bool = False) -> dict:
    """Compute and store festival quality scores."""
    fields = ",".join(["id"] + list(FESTIVAL_WEIGHTS.keys()))
    records = fetch_all(client, "festivals", fields)
    logger.info(f"Festivals: scoring {len(records)} records")

    scores = {}
    distribution = {0: 0, 25: 0, 50: 0, 75: 0, 90: 0}

    for r in records:
        s = score_record(r, FESTIVAL_WEIGHTS)
        scores[r["id"]] = s
        for threshold in sorted(distribution.keys(), reverse=True):
            if s >= threshold:
                distribution[threshold] += 1
                break

    update_scores(client, "festivals", scores, dry_run)
    return {"count": len(records), "scores": scores, "distribution": distribution}


def compute_organizations(client, dry_run: bool = False) -> dict:
    """Compute and store organization quality scores."""
    fields = ",".join(["id"] + list(ORG_WEIGHTS.keys()))
    records = fetch_all(client, "organizations", fields)
    logger.info(f"Organizations: scoring {len(records)} records")

    scores = {}
    distribution = {0: 0, 25: 0, 50: 0, 75: 0, 90: 0}

    for r in records:
        s = score_record(r, ORG_WEIGHTS)
        scores[r["id"]] = s
        for threshold in sorted(distribution.keys(), reverse=True):
            if s >= threshold:
                distribution[threshold] += 1
                break

    update_scores(client, "organizations", scores, dry_run)
    return {"count": len(records), "scores": scores, "distribution": distribution}


def print_results(name: str, result: dict):
    """Print scoring results with distribution."""
    scores = result["scores"]
    if not scores:
        logger.info(f"  {name}: no records")
        return

    vals = list(scores.values())
    avg = sum(vals) / len(vals)
    low = min(vals)
    high = max(vals)

    # Distribution buckets
    buckets = {"90-100": 0, "75-89": 0, "50-74": 0, "25-49": 0, "0-24": 0}
    for v in vals:
        if v >= 90:
            buckets["90-100"] += 1
        elif v >= 75:
            buckets["75-89"] += 1
        elif v >= 50:
            buckets["50-74"] += 1
        elif v >= 25:
            buckets["25-49"] += 1
        else:
            buckets["0-24"] += 1

    logger.info(f"\n  {name}: {len(vals)} records  avg={avg:.0f}  min={low}  max={high}")
    for bucket, count in buckets.items():
        pct = count / len(vals) * 100
        bar = "#" * int(pct / 2)
        logger.info(f"    {bucket:>6}: {count:>5} ({pct:5.1f}%) {bar}")


def main():
    parser = argparse.ArgumentParser(description="Compute data_quality scores")
    parser.add_argument("--table", choices=["venues", "events", "series", "festivals", "organizations"],
                        help="Only compute for a specific table")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()

    client = get_client()
    logger.info("Computing data_quality scores...")
    if args.dry_run:
        logger.info("[DRY RUN — no writes]")

    computors = {
        "venues": ("Venues", compute_venues),
        "events": ("Events", compute_events),
        "series": ("Series", compute_series),
        "festivals": ("Festivals", compute_festivals),
        "organizations": ("Organizations", compute_organizations),
    }

    results = {}
    for key, (name, fn) in computors.items():
        if args.table and args.table != key:
            continue
        results[name] = fn(client, dry_run=args.dry_run)
        print_results(name, results[name])

    total_records = sum(r["count"] for r in results.values())
    total_sum = sum(sum(r["scores"].values()) for r in results.values())
    overall_avg = total_sum / total_records if total_records else 0

    logger.info(f"\n{'='*60}")
    logger.info(f"Total records scored: {total_records}")
    logger.info(f"Overall average quality: {overall_avg:.0f}/100")
    if args.dry_run:
        logger.info("[DRY RUN — nothing written]")
    else:
        logger.info("All scores written to data_quality column")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    main()
