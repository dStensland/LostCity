#!/usr/bin/env python3
"""
Add Nashville suburban sources to database.
Run this once to register the new crawlers.
"""

from db import get_client

sources_to_add = [
    # Franklin - Tier 1 (86K population)
    {
        "slug": "visit-franklin",
        "name": "Visit Franklin",
        "url": "https://visitfranklin.com/things-to-do-events/",
        "source_type": "tourism_board",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "slug": "downtown-franklin",
        "name": "Downtown Franklin Association",
        "url": "https://downtownfranklintn.com/events",
        "source_type": "downtown_org",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "slug": "factory-franklin",
        "name": "Factory at Franklin",
        "url": "https://factoryatfranklin.com/events/",
        "source_type": "venue",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    # Murfreesboro - Tier 1 (157K population)
    {
        "slug": "murfreesboro-city",
        "name": "City of Murfreesboro",
        "url": "https://www.murfreesborotn.gov/Calendar.aspx",
        "source_type": "government",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "slug": "main-street-murfreesboro",
        "name": "Main Street Murfreesboro",
        "url": "https://www.mainstreetmurfreesboro.org/calendar/",
        "source_type": "downtown_org",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "slug": "mtsu-events",
        "name": "MTSU Events",
        "url": "https://www.mtsu.edu/calendar/",
        "source_type": "university",
        "crawl_frequency": "daily",
        "is_active": True,
    },
]


def add_sources():
    """Add sources to database."""
    client = get_client()

    for source in sources_to_add:
        # Check if source already exists
        existing = client.table("sources").select("id").eq("slug", source["slug"]).execute()

        if existing.data:
            print(f"✓ Source already exists: {source['slug']}")
        else:
            result = client.table("sources").insert(source).execute()
            print(f"+ Added source: {source['slug']} - {source['name']}")


if __name__ == "__main__":
    print("Adding Nashville suburban sources to database...")
    add_sources()
    print("\nDone! You can now run these crawlers with:")
    print("  python main.py --source visit-franklin")
    print("  python main.py --source downtown-franklin")
    print("  python main.py --source factory-franklin")
    print("  python main.py --source murfreesboro-city")
    print("  python main.py --source main-street-murfreesboro")
    print("  python main.py --source mtsu-events")
