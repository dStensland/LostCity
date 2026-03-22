#!/usr/bin/env python3
"""
One-time backfill: reclassify existing network_posts using keyword matching.

After migration 265 copies source-level categories to every post, this script
refines them by running classify_post() on each post's title + summary. Posts
that match specific keywords get narrower, more accurate categories instead of
inheriting the full source category list.

Usage:
    # Preview changes without writing
    python3 backfill_post_categories.py --dry-run

    # Backfill all posts
    python3 backfill_post_categories.py

    # Backfill a specific source
    python3 backfill_post_categories.py --source rough-draft-atlanta

    # Show verbose output
    python3 backfill_post_categories.py --verbose
"""

import sys
import logging
import argparse
from pathlib import Path

env_path = Path(__file__).parent.parent / ".env"
from dotenv import load_dotenv
load_dotenv(env_path)

sys.path.insert(0, str(Path(__file__).parent))
from db import get_client
from scrape_network_feeds import classify_post

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

BATCH_SIZE = 500


def backfill(source_slug=None, dry_run=False, verbose=False):
    """Reclassify all network_posts using keyword matching."""
    client = get_client()

    # Load source categories for fallback
    sources_q = client.table("network_sources").select("id, slug, categories")
    if source_slug:
        sources_q = sources_q.eq("slug", source_slug)
    sources_result = sources_q.execute()
    sources = {s["id"]: s for s in (sources_result.data or [])}

    if source_slug and not sources:
        logger.error(f"Source '{source_slug}' not found")
        sys.exit(1)

    source_ids = list(sources.keys())
    logger.info(f"Backfill post categories")
    logger.info(f"  Sources: {len(source_ids)}")
    if dry_run:
        logger.info(f"  Mode: DRY RUN")

    total = 0
    changed = 0
    unchanged = 0
    offset = 0

    while True:
        q = (
            client.table("network_posts")
            .select("id, title, summary, source_id, categories")
            .order("id")
            .range(offset, offset + BATCH_SIZE - 1)
        )
        if source_ids:
            q = q.in_("source_id", source_ids)

        result = q.execute()
        rows = result.data or []

        if not rows:
            break

        for row in rows:
            total += 1
            source = sources.get(row["source_id"], {})
            source_cats = source.get("categories") or []

            # No RSS entry available for existing posts — pass empty dict
            new_cats = classify_post({}, source_cats, row["title"] or "", row.get("summary"))
            old_cats = sorted(row.get("categories") or [])

            if new_cats != old_cats:
                changed += 1
                if verbose:
                    logger.info(f"  [{row['id']}] {(row['title'] or '')[:60]}")
                    logger.info(f"    {old_cats} -> {new_cats}")

                if not dry_run:
                    try:
                        client.table("network_posts").update(
                            {"categories": new_cats}
                        ).eq("id", row["id"]).execute()
                    except Exception as e:
                        logger.error(f"  Update error for post {row['id']}: {e}")
            else:
                unchanged += 1

        offset += BATCH_SIZE
        if len(rows) < BATCH_SIZE:
            break

    logger.info(f"\nDone!")
    logger.info(f"  Posts processed: {total}")
    logger.info(f"  Changed: {changed}")
    logger.info(f"  Unchanged: {unchanged}")
    if dry_run:
        logger.info(f"  (dry run — nothing written)")


def main():
    parser = argparse.ArgumentParser(
        description="Backfill per-post categories on network_posts"
    )
    parser.add_argument("--source", type=str, metavar="SLUG",
                        help="Only backfill posts from this source")
    parser.add_argument("--dry-run", action="store_true",
                        help="Preview changes without writing to DB")
    parser.add_argument("--verbose", action="store_true",
                        help="Show each post that would change")
    args = parser.parse_args()

    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    backfill(
        source_slug=args.source,
        dry_run=args.dry_run,
        verbose=args.verbose,
    )


if __name__ == "__main__":
    main()
