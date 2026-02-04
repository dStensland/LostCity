"""
Script to set up and run new bar venue crawlers.
Creates source records and runs crawlers to populate venues.
"""

import logging
from db import get_client

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Source records to create
SOURCES = [
    {
        "slug": "the-porter",
        "name": "The Porter Beer Bar",
        "url": "https://theporterbeerbar.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "the-painted-duck",
        "name": "The Painted Duck",
        "url": "https://thepaintedduck.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "johnnys-hideaway",
        "name": "Johnny's Hideaway",
        "url": "https://johnnyshideaway.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "the-earl",
        "name": "The EARL",
        "url": "https://badearl.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "northside-tavern",
        "name": "Northside Tavern",
        "url": "https://northsidetavern.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "torched-hop",
        "name": "Torched Hop Brewing",
        "url": "https://torchedhop.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "wrecking-bar",
        "name": "Wrecking Bar Brewpub",
        "url": "https://wreckingbarbrewpub.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "manuels-tavern",
        "name": "Manuel's Tavern",
        "url": "https://manuelstavern.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "midway-pub",
        "name": "Midway Pub",
        "url": "https://midwaypub.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "argosy",
        "name": "Argosy",
        "url": "https://argosyeastatlanta.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "monday-night-garage",
        "name": "Monday Night Garage",
        "url": "https://mondaynightbrewing.com",
        "source_type": "venue",
        "is_active": True,
    },
    {
        "slug": "wild-heaven",
        "name": "Wild Heaven Beer",
        "url": "https://wildheavenbeer.com",
        "source_type": "venue",
        "is_active": True,
    },
]


def create_sources():
    """Create source records in the database."""
    client = get_client()
    
    for source_data in SOURCES:
        slug = source_data["slug"]
        
        # Check if source already exists
        result = client.table("sources").select("*").eq("slug", slug).execute()
        
        if result.data:
            logger.info(f"Source '{slug}' already exists (ID: {result.data[0]['id']})")
        else:
            # Create new source
            result = client.table("sources").insert(source_data).execute()
            logger.info(f"Created source '{slug}' (ID: {result.data[0]['id']})")


if __name__ == "__main__":
    create_sources()
    logger.info("\nAll sources created! Now run each crawler:")
    for source in SOURCES:
        logger.info(f"  python main.py --source {source['slug']}")
