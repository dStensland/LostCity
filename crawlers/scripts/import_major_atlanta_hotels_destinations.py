#!/usr/bin/env python3
"""
Import major Atlanta hotels as destination venues.

Follows the standard curated destination flow:
- define a destination list in-code
- skip existing slugs
- create missing venues via get_or_create_venue()

Usage:
    cd /Users/coach/Projects/LostCity/crawlers
    python3 import_major_atlanta_hotels_destinations.py
"""

import logging
import argparse

from db import get_client, get_or_create_venue, get_venue_by_slug

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)


HOTELS = [
    {
        "name": "FORTH Hotel Atlanta",
        "slug": "forth-hotel-atlanta",
        "address": "800 Rankin St NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7686692,
        "lng": -84.3637654,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://forthatlanta.com",
        "description": "Luxury boutique hotel in Old Fourth Ward with multiple dining concepts and member-driven social spaces.",
        "vibes": ["upscale", "good-for-groups", "date-spot"],
    },
    {
        "name": "Hotel Clermont",
        "slug": "hotel-clermont",
        "address": "789 Ponce De Leon Ave NE",
        "neighborhood": "Poncey-Highland",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30306",
        "lat": 33.7735458,
        "lng": -84.3614019,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hotelclermont.com",
        "description": "Historic Atlanta boutique hotel with rooftop views and a nightlife-forward local identity.",
        "vibes": ["historic", "upscale", "late-night"],
    },
    {
        "name": "The Wylie Hotel",
        "slug": "wylie-hotel",
        "address": "551 Ponce De Leon Ave NE",
        "neighborhood": "Old Fourth Ward",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30308",
        "lat": 33.7734679,
        "lng": -84.3688648,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.wyliehotel.com",
        "description": "Boutique hotel on the Ponce corridor blending historic character with modern hospitality.",
        "vibes": ["historic", "upscale", "date-spot"],
    },
    {
        "name": "The Candler Hotel Atlanta",
        "slug": "candler-hotel",
        "address": "127 Peachtree Rd NE",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7569355,
        "lng": -84.3876751,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hilton.com/en/hotels/atlcdqq-the-candler-hotel-atlanta/",
        "description": "Luxury Curio Collection hotel inside the historic Candler Building in Downtown Atlanta.",
        "vibes": ["historic", "upscale", "date-spot"],
    },
    {
        "name": "Bellyard Hotel",
        "slug": "bellyard-hotel",
        "address": "1 Interlock Ave NW",
        "neighborhood": "West Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30318",
        "lat": 33.7852,
        "lng": -84.41098,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://bellyardhotel.com",
        "description": "Design-forward West Midtown boutique hotel near The Interlock's dining and entertainment corridor.",
        "vibes": ["upscale", "good-for-groups", "date-spot"],
    },
    {
        "name": "Epicurean Atlanta",
        "slug": "epicurean-atlanta",
        "address": "1117 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7851908,
        "lng": -84.3874357,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.epicureanhotelatlanta.com",
        "description": "Food-and-wine-focused Autograph Collection hotel in Midtown with culinary programming.",
        "vibes": ["upscale", "good-for-groups", "date-spot"],
    },
    {
        "name": "Twelve Midtown",
        "slug": "twelve-midtown",
        "address": "361 17th St NW",
        "neighborhood": "Atlantic Station",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30363",
        "lat": 33.7915832,
        "lng": -84.3981112,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://twelvehotels.com/hotels/midtown",
        "description": "All-suite boutique hotel at Atlantic Station with extended-stay appeal and walkable access to Midtown.",
        "vibes": ["upscale", "good-for-groups", "family-friendly"],
    },
    {
        "name": "Hotel Granada Midtown",
        "slug": "hotel-granada-midtown",
        "address": "1302 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7902,
        "lng": -84.3884287,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hotelgranadaatlanta.com",
        "description": "Restored historic Midtown hotel with contemporary design and hospitality programming.",
        "vibes": ["historic", "upscale", "date-spot"],
    },
    {
        "name": "Kimpton Shane Hotel",
        "slug": "kimpton-shane-hotel",
        "address": "1340 W Peachtree St NW",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7908324,
        "lng": -84.388269,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.shanehotelatlanta.com",
        "description": "Culture-forward Kimpton hotel in Midtown Union, positioned for art, music, and design-minded guests.",
        "vibes": ["upscale", "date-spot", "good-for-groups"],
    },
    {
        "name": "The Whitley",
        "slug": "the-whitley",
        "address": "3434 Peachtree Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30326",
        "lat": 33.8504246,
        "lng": -84.3634195,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://thewhitleyhotel.com",
        "description": "Luxury Buckhead hotel with large-room inventory and premium business and leisure amenities.",
        "vibes": ["upscale", "good-for-groups", "date-spot"],
    },
    {
        "name": "The Tess, Atlanta Buckhead",
        "slug": "the-tess-buckhead",
        "address": "415 E Paces Ferry Rd NE",
        "neighborhood": "Buckhead",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30305",
        "lat": 33.8382008,
        "lng": -84.3743132,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.marriott.com/en-us/hotels/atlub-the-tess-atlanta-buckhead-autograph-collection/overview/",
        "description": "Buckhead luxury hotel rebranded as The Tess with rooftop dining and upscale lifestyle positioning.",
        "vibes": ["upscale", "date-spot", "good-for-groups"],
    },
    {
        "name": "Stonehurst Place",
        "slug": "stonehurst-place",
        "address": "923 Piedmont Ave NE",
        "neighborhood": "Midtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30309",
        "lat": 33.7798492,
        "lng": -84.3805684,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.stonehurstplace.com",
        "description": "Independent boutique inn in a historic mansion offering high-touch hospitality near Piedmont Park.",
        "vibes": ["historic", "upscale", "intimate"],
    },
    {
        "name": "Origin Hotel Atlanta",
        "slug": "origin-hotel-atlanta",
        "address": "110 Mitchell St SW",
        "neighborhood": "South Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7511517,
        "lng": -84.3935871,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.originhotel.com/hotels/atlanta",
        "description": "New South Downtown boutique hotel blending adaptive-reuse architecture with local dining and event space.",
        "vibes": ["historic", "upscale", "good-for-groups"],
    },
    {
        "name": "Hotel Phoenix",
        "slug": "hotel-phoenix-atlanta",
        "address": "70 Centennial Olympic Park Dr NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7550955,
        "lng": -84.3979559,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.hotelphoenix.com",
        "description": "Centennial Yards flagship hotel with large event capacity and a hospitality-led downtown experience.",
        "vibes": ["upscale", "good-for-groups", "date-spot"],
    },
    {
        "name": "The Ellis Hotel",
        "slug": "ellis-hotel",
        "address": "176 Peachtree St NW",
        "neighborhood": "Downtown",
        "city": "Atlanta",
        "state": "GA",
        "zip": "30303",
        "lat": 33.7583217,
        "lng": -84.387857,
        "venue_type": "hotel",
        "spot_type": "hotel",
        "website": "https://www.ellishotel.com",
        "description": "Historic downtown boutique hotel with independent hospitality identity and strong Peachtree Street location.",
        "vibes": ["historic", "upscale", "intimate"],
    },
]


def import_hotels() -> None:
    """Import major Atlanta hotels to the destinations dataset."""
    client = get_client()
    added = 0
    skipped = 0
    patched = 0

    logger.info("=" * 68)
    logger.info("Importing Major Atlanta Hotels (Destination Flow)")
    logger.info("=" * 68)
    logger.info(f"Processing {len(HOTELS)} hotels...")
    logger.info("")

    for hotel in HOTELS:
        existing = get_venue_by_slug(hotel["slug"])
        if existing:
            updates = {}
            for field in [
                "address",
                "neighborhood",
                "city",
                "state",
                "zip",
                "lat",
                "lng",
                "website",
                "description",
                "vibes",
                "spot_type",
                "venue_type",
            ]:
                incoming = hotel.get(field)
                current = existing.get(field)
                if incoming is None:
                    continue
                if current in (None, "", []) and incoming not in (None, "", []):
                    updates[field] = incoming

            if updates:
                client.table("venues").update(updates).eq("id", existing["id"]).execute()
                patched += 1
                logger.info(
                    f"  PATCH:{hotel['name']} (filled {len(updates)} missing fields)"
                )
            else:
                logger.info(f"  SKIP: {hotel['name']} (already exists)")
            skipped += 1
            continue

        try:
            venue_id = get_or_create_venue(hotel)
            logger.info(f"  ADD:  {hotel['name']} -> ID {venue_id}")
            added += 1
        except Exception as exc:
            logger.error(f"  ERROR: {hotel['name']}: {exc}")

    logger.info("")
    logger.info("=" * 68)
    logger.info(f"Done! Added {added} hotels, skipped {skipped} existing.")
    logger.info(f"Patched existing records: {patched}")
    logger.info(f"Total curated major hotels: {len(HOTELS)}")
    logger.info("=" * 68)


def main():
    parser = argparse.ArgumentParser(
        description="Import major Atlanta hotel destinations and run enrichment"
    )
    parser.add_argument(
        "--skip-enrich",
        action="store_true",
        help="Import only; skip post-import enrichment pass.",
    )
    parser.add_argument(
        "--enrich-dry-run",
        action="store_true",
        help="Run enrichment in dry-run mode after import.",
    )
    args = parser.parse_args()

    import_hotels()

    if args.skip_enrich:
        logger.info("Skipping enrichment (--skip-enrich set).")
        return

    # Keep enrichment as part of destination onboarding to avoid stub records.
    from enrich_destination_slugs import enrich_slugs

    logger.info("")
    logger.info("=" * 68)
    logger.info("Running Post-Import Enrichment")
    logger.info("=" * 68)
    stats = enrich_slugs(
        slugs=[hotel["slug"] for hotel in HOTELS],
        dry_run=args.enrich_dry_run,
    )
    logger.info(
        "Enrichment summary: found=%d updated=%d missing=%d",
        stats["found"],
        stats["updated"],
        stats["missing"],
    )


if __name__ == "__main__":
    main()
