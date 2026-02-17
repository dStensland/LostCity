#!/usr/bin/env python3
"""
Backfill dedicated film identity fields on events.

Keeps events.title untouched (venue display title), while storing canonical
movie identity in:
  - film_title
  - film_release_year
  - film_imdb_id
  - film_external_genres
  - film_identity_source
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "crawlers"))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(ROOT / ".env")

from db import get_client  # noqa: E402
from genre_normalize import normalize_genres  # noqa: E402
from posters import extract_film_info, get_metadata_for_film_event  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


def run(limit: int, dry_run: bool, start_date: str) -> dict:
    client = get_client()
    stats = {
        "processed": 0,
        "updated": 0,
        "omdb_matches": 0,
        "wikidata_matches": 0,
        "parsed_only": 0,
        "genres_enriched": 0,
        "errors": 0,
    }

    batch_size = 250
    offset = 0
    while stats["processed"] < limit:
        end = min(offset + batch_size - 1, limit - 1)
        result = (
            client.table("events")
            .select(
                "id,title,genres,category,start_date,film_title,film_release_year,"
                "film_imdb_id,film_external_genres,film_identity_source"
            )
            .eq("category", "film")
            .gte("start_date", start_date)
            .is_("canonical_event_id", "null")
            .range(offset, end)
            .order("id")
            .execute()
        )
        rows = result.data or []
        if not rows:
            break

        for row in rows:
            if stats["processed"] >= limit:
                break
            stats["processed"] += 1

            title = row.get("title") or ""
            parsed_title, parsed_year = extract_film_info(title)
            metadata = get_metadata_for_film_event(title)

            updates: dict = {}
            if metadata:
                metadata_source = getattr(metadata, "source", None) or "omdb"
                if metadata_source == "wikidata":
                    stats["wikidata_matches"] += 1
                else:
                    stats["omdb_matches"] += 1
                if metadata.title and metadata.title != row.get("film_title"):
                    updates["film_title"] = metadata.title
                if metadata.year and metadata.year != row.get("film_release_year"):
                    updates["film_release_year"] = metadata.year
                if metadata.imdb_id and metadata.imdb_id != row.get("film_imdb_id"):
                    updates["film_imdb_id"] = metadata.imdb_id
                if metadata.genres and metadata.genres != row.get("film_external_genres"):
                    updates["film_external_genres"] = metadata.genres
                if row.get("film_identity_source") != metadata_source:
                    updates["film_identity_source"] = metadata_source

                # Optional genre enrichment for filtering/tagging.
                merged = normalize_genres((row.get("genres") or []) + (metadata.genres or []))
                if merged and merged != (row.get("genres") or []):
                    updates["genres"] = merged
                    stats["genres_enriched"] += 1
            elif parsed_title:
                stats["parsed_only"] += 1
                if parsed_title != row.get("film_title"):
                    updates["film_title"] = parsed_title
                if parsed_year:
                    try:
                        parsed_year_int = int(parsed_year)
                        if parsed_year_int != row.get("film_release_year"):
                            updates["film_release_year"] = parsed_year_int
                    except (TypeError, ValueError):
                        pass
                if row.get("film_identity_source") != "title_parse":
                    updates["film_identity_source"] = "title_parse"

            if not updates:
                continue

            if dry_run:
                continue

            try:
                client.table("events").update(updates).eq("id", row["id"]).execute()
                stats["updated"] += 1
            except Exception as e:
                stats["errors"] += 1
                logger.warning("Failed update for event %s: %s", row.get("id"), e)

        offset += batch_size

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill film identity fields on events")
    parser.add_argument("--limit", type=int, default=3000, help="Maximum film events to process")
    parser.add_argument(
        "--start-date",
        type=str,
        default="2025-01-01",
        help="Only process events with start_date >= this date (YYYY-MM-DD)",
    )
    parser.add_argument("--dry-run", action="store_true", help="Compute updates without writing")
    args = parser.parse_args()

    stats = run(limit=args.limit, dry_run=args.dry_run, start_date=args.start_date)
    logger.info("processed=%s", stats["processed"])
    logger.info("updated=%s", stats["updated"])
    logger.info("omdb_matches=%s", stats["omdb_matches"])
    logger.info("wikidata_matches=%s", stats["wikidata_matches"])
    logger.info("parsed_only=%s", stats["parsed_only"])
    logger.info("genres_enriched=%s", stats["genres_enriched"])
    logger.info("errors=%s", stats["errors"])
    if args.dry_run:
        logger.info("*** DRY RUN - no writes performed ***")


if __name__ == "__main__":
    main()
