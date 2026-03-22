#!/usr/bin/env python3
"""
Add environmental and animal welfare organization sources.
Run from crawlers directory: python add_environmental_sources.py
"""

from db import get_client

NEW_SOURCES = [
    {
        "name": "Chattahoochee Riverkeeper",
        "slug": "chattahoochee-riverkeeper",
        "url": "https://chattahoochee.org",
        "source_type": "scrape",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "name": "Concrete Jungle",
        "slug": "concrete-jungle",
        "url": "https://www.concrete-jungle.org",
        "source_type": "scrape",
        "crawl_frequency": "daily",
        "is_active": True,
    },
    {
        "name": "LifeLine Animal Project",
        "slug": "lifeline-animal-project",
        "url": "https://lifelineanimal.org",
        "source_type": "scrape",
        "crawl_frequency": "daily",
        "is_active": True,
    },
]


def main():
    client = get_client()
    added = 0
    skipped = 0

    print("Adding environmental and animal welfare organization sources...")

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
            print(f"  ✓ Added: {source['name']}")
            added += 1
        except Exception as e:
            print(f"  ✗ Error adding {source['name']}: {e}")

    print(f"\nDone! Added {added} new sources, skipped {skipped} existing.")


if __name__ == "__main__":
    main()
