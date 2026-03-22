#!/usr/bin/env python3
"""
Add MUST Ministries and Atlanta ToolBank sources to the database.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO, format="%(message)s")
logger = logging.getLogger(__name__)

SOURCES_DATA = [
    {
        "slug": "must-ministries",
        "name": "MUST Ministries",
        "url": "https://mustministries.volunteerhub.com/vv2/",
        "integration_method": "playwright",
        "crawl_frequency": "daily",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "atlanta-toolbank",
        "name": "Atlanta Community ToolBank",
        "url": "https://www.toolbank.org",
        "integration_method": "requests",
        "crawl_frequency": "twice_weekly",
        "source_type": "venue",
        "is_active": True,
    },
]


def add_sources():
    """Add both volunteer organization sources to the database."""
    client = get_client()

    for source_data in SOURCES_DATA:
        slug = source_data["slug"]

        # Check if source already exists
        result = client.table("sources").select("*").eq("slug", slug).execute()

        if result.data:
            logger.info(f"Source '{slug}' already exists (ID: {result.data[0]['id']})")
        else:
            # Create new source
            result = client.table("sources").insert(source_data).execute()
            logger.info(f"Created source '{slug}' (ID: {result.data[0]['id']})")

    logger.info("\nTest crawlers with:")
    for source_data in SOURCES_DATA:
        logger.info(f"  python main.py --source {source_data['slug']} --verbose")


if __name__ == "__main__":
    add_sources()
