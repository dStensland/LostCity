#!/usr/bin/env python3
"""
Backfill existing film series with OMDB metadata.

Finds series where series_type='film' and key metadata fields are NULL,
then fetches from OMDB and updates.

Usage:
    python backfill_film_metadata.py              # Dry run (report only)
    python backfill_film_metadata.py --execute    # Actually update DB
    python backfill_film_metadata.py --limit 10   # Process at most 10 series
"""

import argparse
import logging
import sys
import time

from db import get_client
from posters import extract_film_info, fetch_film_metadata
from series import update_series_metadata

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


def get_series_needing_metadata(client, limit: int = 0) -> list[dict]:
    """Find film series missing director or description."""
    query = (
        client.table("series")
        .select("id, title, year, director, description, runtime_minutes, rating, imdb_id, genres, image_url")
        .eq("series_type", "film")
        .or_("director.is.null,description.is.null")
    )
    if limit > 0:
        query = query.limit(limit)
    result = query.execute()
    return result.data or []


def backfill(execute: bool = False, limit: int = 0) -> None:
    client = get_client()
    series_list = get_series_needing_metadata(client, limit)

    if not series_list:
        logger.info("No film series need metadata backfill.")
        return

    logger.info(f"Found {len(series_list)} film series needing metadata.\n")

    updated = 0
    skipped = 0

    for series in series_list:
        title = series["title"]
        year_str = str(series["year"]) if series.get("year") else None

        film_title, parsed_year = extract_film_info(title)
        if not film_title:
            # Fall back to using the series title directly
            film_title = title

        # Prefer series year over parsed year
        lookup_year = year_str or parsed_year

        metadata = fetch_film_metadata(film_title, lookup_year)

        if not metadata:
            logger.info(f"  SKIP  {title} -- not found in OMDB")
            skipped += 1
            time.sleep(1)
            continue

        # Build updates dict (only fields currently NULL)
        updates = {
            "director": metadata.director,
            "runtime_minutes": metadata.runtime_minutes,
            "year": metadata.year,
            "rating": metadata.rating,
            "imdb_id": metadata.imdb_id,
            "genres": metadata.genres,
            "description": metadata.plot,
            "image_url": metadata.poster_url,
        }

        # Filter to only fields that are currently NULL on the series
        fields_to_fill = {
            k: v for k, v in updates.items()
            if v is not None and series.get(k) is None
        }

        if not fields_to_fill:
            logger.info(f"  OK    {title} -- already complete")
            skipped += 1
        elif execute:
            update_series_metadata(client, series["id"], fields_to_fill)
            logger.info(f"  UPDATE {title} -- set {list(fields_to_fill.keys())}")
            updated += 1
        else:
            logger.info(f"  WOULD UPDATE {title} -- {list(fields_to_fill.keys())}")
            updated += 1

        # Rate limit: OMDB free tier = 1,000 requests/day
        time.sleep(1)

    logger.info(f"\nDone. {'Updated' if execute else 'Would update'}: {updated}, Skipped: {skipped}")
    if not execute and updated > 0:
        logger.info("Run with --execute to apply changes.")


def main():
    parser = argparse.ArgumentParser(description="Backfill film series with OMDB metadata")
    parser.add_argument("--execute", action="store_true", help="Actually update the database (default: dry run)")
    parser.add_argument("--limit", type=int, default=0, help="Max number of series to process (0 = all)")
    args = parser.parse_args()

    backfill(execute=args.execute, limit=args.limit)


if __name__ == "__main__":
    main()
