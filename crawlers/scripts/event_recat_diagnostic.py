"""
Diagnostic: find events at arts venues that are miscategorized.

Checks events in 'community', 'learning', 'family' categories at
gallery/museum/studio venues. Flags probable arts events.

Run: cd crawlers && python3 scripts/event_recat_diagnostic.py
     cd crawlers && python3 scripts/event_recat_diagnostic.py --apply
"""

import argparse
import logging
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

ARTS_VENUE_TYPES = ("gallery", "museum", "studio")
CHECK_CATEGORIES = ("community", "learning", "family")

ARTS_SIGNALS = re.compile(
    r"(exhibition|gallery|opening\s+reception|art\s+walk|artist\s+talk|"
    r"curator|studio\s+tour|public\s+tour|art\s+show|vernissage|"
    r"sculpture|painting|photography|printmaking|ceramics|drawing\s+class|"
    r"watercolor|portrait|sketch)",
    re.IGNORECASE,
)


def run_diagnostic():
    client = get_client()

    venues = (
        client.table("places")
        .select("id, name, venue_type")
        .in_("place_type", list(ARTS_VENUE_TYPES))
        .execute()
    )
    venue_ids = [v["id"] for v in venues.data]
    venue_names = {v["id"]: v["name"] for v in venues.data}

    logger.info("Arts venues: %d", len(venue_ids))

    candidates = []

    for cat in CHECK_CATEGORIES:
        events = (
            client.table("events")
            .select("id, title, venue_id, category_id, start_date")
            .eq("category_id", cat)
            .eq("is_active", True)
            .in_("venue_id", venue_ids)
            .limit(500)
            .execute()
        )

        for ev in events.data:
            title = ev.get("title", "")
            if ARTS_SIGNALS.search(title):
                candidates.append(
                    {
                        "id": ev["id"],
                        "title": title,
                        "venue": venue_names.get(ev["venue_id"], "unknown"),
                        "current_category": cat,
                        "suggested": "art",
                        "start_date": ev.get("start_date"),
                    }
                )

    logger.info("--- Candidates for re-categorization to 'art' ---")
    for c in candidates:
        logger.info(
            "  [%s] %r at %s (currently: %s, date: %s)",
            c["id"],
            c["title"],
            c["venue"],
            c["current_category"],
            c["start_date"],
        )
    logger.info("Total candidates: %d", len(candidates))

    return candidates


def apply_recategorization(candidates, dry_run=True):
    """Re-categorize confirmed candidates from community/learning/family to art."""
    client = get_client()
    updated = 0
    for c in candidates:
        logger.info(
            "Re-categorizing: %r at %s -> art (was %s)",
            c["title"],
            c["venue"],
            c["current_category"],
        )
        if not dry_run:
            client.table("events").update({"category_id": "art"}).eq(
                "id", c["id"]
            ).execute()
            updated += 1
    logger.info("Re-categorized %d events", updated)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Arts event re-categorization diagnostic"
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apply re-categorization (default: diagnostic only)",
    )
    args = parser.parse_args()

    candidates = run_diagnostic()
    if args.apply and candidates:
        apply_recategorization(candidates, dry_run=False)
    elif not args.apply:
        logger.info("Review these manually. Use --apply to re-categorize.")
