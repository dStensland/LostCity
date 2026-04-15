"""
Resolve null artist_id FKs in exhibition_artists.

For each row where artist_id IS NULL:
1. Normalize the artist_name
2. Validate it (skip garbage)
3. Look up by slug in artists table
4. Set the FK if found

Run: cd crawlers && PYTHONPATH=. python3 scripts/backfill_exhibition_artist_fks.py [--dry-run]
"""

import argparse
import logging

from artists import normalize_artist_name, slugify_artist, validate_artist_name
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition_artists.artist_id FKs")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    client = get_client()

    result = client.table("exhibition_artists").select(
        "artist_name, exhibition_id"
    ).is_("artist_id", "null").execute()

    rows = result.data or []
    logger.info("Found %d unlinked exhibition_artist rows", len(rows))

    linked = 0
    skipped_invalid = 0
    not_found = 0

    for row in rows:
        raw_name = row.get("artist_name", "")
        normalized = normalize_artist_name(raw_name)

        if not normalized or not validate_artist_name(normalized):
            skipped_invalid += 1
            logger.debug("  Skipped invalid: %r", raw_name)
            continue

        slug = slugify_artist(normalized)
        if not slug:
            skipped_invalid += 1
            continue

        artist_result = client.table("artists").select("id").eq("slug", slug).limit(1).execute()

        if not artist_result.data:
            not_found += 1
            logger.debug("  Not found: %r (slug=%s)", normalized, slug)
            continue

        artist_id = artist_result.data[0]["id"]

        if not args.dry_run:
            client.table("exhibition_artists").update(
                {"artist_id": artist_id}
            ).eq("exhibition_id", row["exhibition_id"]).eq("artist_name", row["artist_name"]).execute()

        linked += 1
        logger.debug("  Linked: %r -> %s", normalized, artist_id)

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total unlinked rows: %d", len(rows))
    logger.info("Linked: %d", linked)
    logger.info("Skipped (invalid name): %d", skipped_invalid)
    logger.info("Not found in artists table: %d", not_found)

    if args.dry_run:
        logger.info("DRY RUN — no changes written.")


if __name__ == "__main__":
    main()
