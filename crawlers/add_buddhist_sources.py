#!/usr/bin/env python3
"""
Add 2 Buddhist meditation center sources to the database.
Run from crawlers directory: python3 add_buddhist_sources.py
"""

from db import get_client

NEW_SOURCES = [
    {
        "name": "Drepung Loseling Monastery",
        "slug": "drepung-loseling-monastery",
        "url": "https://www.drepung.org/changing/Calendar/Current.htm",
        "source_type": "scrape",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "name": "Shambhala Meditation Center of Atlanta",
        "slug": "shambhala-meditation-center-atlanta",
        "url": "https://atlanta.shambhala.org/monthly-calendar/",
        "source_type": "scrape",
        "crawl_frequency": "daily",
        "is_active": True,
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
