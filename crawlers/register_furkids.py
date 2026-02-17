#!/usr/bin/env python3
"""Register Furkids Animal Rescue source in the database."""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SOURCE_DATA = {
    "slug": "furkids",  # Must match filename: furkids.py
    "name": "Furkids Animal Rescue",
    "url": "https://furkids.org/events",
    "integration_method": "playwright",
    "crawl_frequency": "24 hours",
    "source_type": "venue",
    "is_active": True,
}


def main():
    """Register Furkids Animal Rescue source in the database."""
    client = get_client()

    # Update old slug if exists
    old_slug = "furkids-animal-rescue"
    old_result = client.table("sources").select("*").eq("slug", old_slug).execute()
    if old_result.data:
        logger.info(f"Updating old source slug from '{old_slug}' to 'furkids'")
        client.table("sources").update({
            "slug": "furkids",
            "is_active": True,
        }).eq("slug", old_slug).execute()
        logger.info(f"Updated source (ID: {old_result.data[0]['id']})")
        logger.info(f"\nRun crawler with: python main.py --source furkids")
        return

    slug = SOURCE_DATA["slug"]

    # Check if source already exists
    result = client.table("sources").select("*").eq("slug", slug).execute()

    if result.data:
        logger.info(f"Source '{slug}' already exists (ID: {result.data[0]['id']})")
        # Update to ensure it's active
        update_result = client.table("sources").update({
            "is_active": True,
        }).eq("slug", slug).execute()
        logger.info(f"Updated source to active")
    else:
        # Create new source
        result = client.table("sources").insert(SOURCE_DATA).execute()
        logger.info(f"Created source '{slug}' (ID: {result.data[0]['id']})")
        logger.info(f"\nRun crawler with: python main.py --source {slug}")


if __name__ == "__main__":
    main()
