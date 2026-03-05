#!/usr/bin/env python3
"""
Add PAWS Atlanta source to the database.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SOURCE_DATA = {
    "slug": "paws-atlanta",
    "name": "PAWS Atlanta",
    "url": "https://pawsatlanta.org/events/",
    "integration_method": "playwright",
    "crawl_frequency": "24 hours",  # Using the correct field name
    "source_type": "venue",
    "is_active": True,
}


def add_source():
    """Add PAWS Atlanta source to the database."""
    client = get_client()
    slug = SOURCE_DATA["slug"]

    # Check if source already exists
    result = client.table("sources").select("*").eq("slug", slug).execute()

    if result.data:
        logger.info(f"Source '{slug}' already exists (ID: {result.data[0]['id']})")
    else:
        # Create new source
        result = client.table("sources").insert(SOURCE_DATA).execute()
        logger.info(f"Created source '{slug}' (ID: {result.data[0]['id']})")
        logger.info(f"\nRun crawler with: python main.py --source {slug}")


if __name__ == "__main__":
    add_source()
