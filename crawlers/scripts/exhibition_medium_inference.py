"""
Backfill exhibitions.medium using keyword inference from title + description.

Run: cd crawlers && PYTHONPATH=. python3 scripts/exhibition_medium_inference.py [--dry-run]
"""

import argparse
import logging
import sys

from db.client import get_client
from medium_inference import infer_exhibition_medium

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)


def main():
    parser = argparse.ArgumentParser(description="Backfill exhibition medium")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to DB")
    args = parser.parse_args()

    client = get_client()

    # Fetch all active exhibitions with null medium
    result = client.table("exhibitions").select(
        "id, title, description, medium"
    ).eq("is_active", True).is_("medium", "null").execute()

    exhibitions = result.data or []
    logger.info("Found %d exhibitions with null medium", len(exhibitions))

    inferred_count = 0
    medium_counts: dict[str, int] = {}

    for ex in exhibitions:
        title = ex.get("title", "")
        description = ex.get("description", "")
        medium = infer_exhibition_medium(title, description)

        if medium:
            inferred_count += 1
            medium_counts[medium] = medium_counts.get(medium, 0) + 1

            if not args.dry_run:
                client.table("exhibitions").update(
                    {"medium": medium}
                ).eq("id", ex["id"]).execute()

            logger.debug("  %s → %s: %s", medium, title[:60], ex["id"])

    logger.info("")
    logger.info("=== Results ===")
    logger.info("Total with null medium: %d", len(exhibitions))
    logger.info("Inferred: %d (%.0f%%)", inferred_count,
                100 * inferred_count / max(len(exhibitions), 1))
    logger.info("Remaining null: %d", len(exhibitions) - inferred_count)
    logger.info("")
    logger.info("Medium distribution:")
    for medium, count in sorted(medium_counts.items(), key=lambda x: -x[1]):
        logger.info("  %-15s %d", medium, count)

    if args.dry_run:
        logger.info("")
        logger.info("DRY RUN — no changes written. Remove --dry-run to apply.")


if __name__ == "__main__":
    main()
