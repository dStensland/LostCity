"""
One-shot script: run the specials scraper with OpenAI on venues missing cuisine.
Queries for cuisine-NULL food venues, then calls scrape_venue_specials in batches.
"""
import os
import sys
import logging

os.environ["LLM_PROVIDER"] = "openai"

from db import get_client
from scrape_venue_specials import get_venues, scrape_venue, upsert_results, _close_browser

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

FOOD_TYPES = [
    "restaurant", "food_hall", "brewery", "bar", "coffee_shop",
    "sports_bar", "nightclub", "lounge", "distillery", "winery",
]


def main():
    client = get_client()

    # Get IDs of food venues missing cuisine that have websites
    result = (
        client.table("venues")
        .select("id")
        .eq("active", True)
        .is_("cuisine", "null")
        .not_.is_("website", "null")
        .in_("venue_type", FOOD_TYPES)
        .order("id")
        .limit(5000)
        .execute()
    )
    venue_ids = [v["id"] for v in (result.data or [])]
    logger.info(f"Found {len(venue_ids)} food venues missing cuisine with websites")

    if not venue_ids:
        logger.info("Nothing to do!")
        return

    # Fetch full venue records
    venues = get_venues(venue_ids=venue_ids, limit=len(venue_ids))
    logger.info(f"Loaded {len(venues)} venue records")
    logger.info("=" * 60)

    stats = {"scraped": 0, "cuisine_set": 0, "failed": 0, "no_data": 0}

    for i, venue in enumerate(venues, 1):
        name = venue["name"][:45]
        logger.info(f"[{i}/{len(venues)}] {name}")

        try:
            data = scrape_venue(venue, use_playwright=False)
            if not data:
                logger.info(f"  No data extracted")
                stats["no_data"] += 1
                continue

            cuisine = data.get("cuisine")
            style = data.get("service_style")
            if cuisine:
                logger.info(f"  cuisine={cuisine} service_style={style}")
                stats["cuisine_set"] += 1
            else:
                logger.info(f"  No cuisine found (style={style})")

            # Write to DB (skip specials, force venue updates)
            upsert_results(venue, data, dry_run=False, skip_specials=True, force_update=False)
            stats["scraped"] += 1

        except Exception as e:
            logger.error(f"  ERROR: {e}")
            stats["failed"] += 1

    _close_browser()

    logger.info("")
    logger.info("=" * 60)
    logger.info("CUISINE BACKFILL SUMMARY")
    logger.info("=" * 60)
    logger.info(f"  Scraped:      {stats['scraped']}")
    logger.info(f"  Cuisine set:  {stats['cuisine_set']}")
    logger.info(f"  No data:      {stats['no_data']}")
    logger.info(f"  Failed:       {stats['failed']}")


if __name__ == "__main__":
    main()
