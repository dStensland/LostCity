#!/usr/bin/env python3
"""
Add booking-aware planning metadata to Yonder weekend destinations.

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 scripts/enrich_yonder_weekend_booking_support.py
    python3 scripts/enrich_yonder_weekend_booking_support.py --apply
"""

from __future__ import annotations

import argparse
import logging
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from db import get_client, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

GA_STATE_PARK_RESERVATIONS = "https://gastateparks.reserveamerica.com/"
UNICOI_BOOKING_URL = "https://us01.iqwebbook.com/ULGA340/"

WEEKEND_BOOKING_UPDATES = [
    {"slug": "cloudland-canyon", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "vogel-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "fort-mountain-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "black-rock-mountain", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "chattahoochee-bend-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "red-top-mountain-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "hard-labor-creek-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "fort-yargo-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "don-carter-state-park", "reservation_url": GA_STATE_PARK_RESERVATIONS, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "unicoi-state-park", "reservation_url": UNICOI_BOOKING_URL, "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "whitewater-express-columbus", "reservation_url": "https://whitewaterexpress.com/", "accepts_reservations": True, "reservation_recommended": True},
    {"slug": "springer-mountain", "accepts_reservations": False, "reservation_recommended": False},
    {"slug": "cohutta-overlook", "accepts_reservations": False, "reservation_recommended": False},
]


def main() -> None:
    parser = argparse.ArgumentParser(description="Enrich Yonder weekend booking metadata.")
    parser.add_argument("--apply", action="store_true", help="Write changes to the database.")
    args = parser.parse_args()

    client = get_client()
    updated = 0
    skipped = 0
    missing = 0

    logger.info("=" * 68)
    logger.info("Yonder Weekend Booking Support")
    logger.info("=" * 68)
    logger.info("Mode: %s", "apply" if args.apply else "dry-run")
    logger.info("")

    for payload in WEEKEND_BOOKING_UPDATES:
        row = get_venue_by_slug(payload["slug"])
        if not row:
            logger.info("MISS venue: %s", payload["slug"])
            missing += 1
            continue

        updates = {}
        for key, value in payload.items():
            if key == "slug":
                continue
            if row.get(key) != value:
                updates[key] = value

        if not updates:
            logger.info("KEEP venue: %s", payload["slug"])
            skipped += 1
            continue

        if args.apply:
            client.table("venues").update(updates).eq("id", row["id"]).execute()
        logger.info(
            "%s venue: %s (%s fields)",
            "UPDATE" if args.apply else "WOULD UPDATE",
            payload["slug"],
            len(updates),
        )
        updated += 1

    logger.info("")
    logger.info("Summary: updated=%s skipped=%s missing=%s", updated, skipped, missing)


if __name__ == "__main__":
    main()
