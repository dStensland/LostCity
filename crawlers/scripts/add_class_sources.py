#!/usr/bin/env python3
"""
Add new class venue sources for Lost City crawlers.
Run from crawlers directory: python add_class_sources.py
"""

from db import get_client

NEW_SOURCES = [
    {
        "name": "Candlelit ATL",
        "slug": "candlelit-atl",
        "url": "https://www.candlelitatlanta.com",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    },
    {
        "name": "Rockler Woodworking - Sandy Springs",
        "slug": "rockler-woodworking",
        "url": "https://www.rockler.com",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    },
    {
        "name": "Halls Atlanta Floral Design School",
        "slug": "halls-floral",
        "url": "https://hallsatlanta.com",
        "source_type": "scrape",
        "crawl_frequency": "weekly",
    },
    {
        "name": "REI Atlanta",
        "slug": "rei-atlanta",
        "url": "https://www.rei.com",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    },
    {
        "name": "All Fired Up Art",
        "slug": "all-fired-up-art",
        "url": "https://allfiredupart.com",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    },
    {
        "name": "Central Rock Gym Atlanta",
        "slug": "stone-summit",
        "url": "https://centralrockgym.com",
        "source_type": "scrape",
        "crawl_frequency": "daily",
    },
]


def main():
    client = get_client()
    added = 0
    skipped = 0

    for source in NEW_SOURCES:
        # Check if source already exists
        existing = client.table("sources").select("id").eq("slug", source["slug"]).execute()
        if existing.data and len(existing.data) > 0:
            print(f"  Skipped (exists): {source['name']}")
            skipped += 1
            continue

        # Insert new source
        try:
            client.table("sources").insert(source).execute()
            print(f"  Added: {source['name']}")
            added += 1
        except Exception as e:
            print(f"  Error adding {source['name']}: {e}")

    print(f"\nDone! Added {added} new sources, skipped {skipped} existing.")


if __name__ == "__main__":
    main()
