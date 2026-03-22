#!/usr/bin/env python3
"""
Add LEGO Discovery Center Atlanta source to the database.
Run from crawlers directory: python add_lego_discovery_center.py
"""

from db import get_client

NEW_SOURCE = {
    "name": "LEGO Discovery Center Atlanta",
    "slug": "lego-discovery-center",
    "url": "https://www.legolanddiscoverycenter.com/atlanta/",
    "source_type": "scrape",
    "crawl_frequency": "daily",
    "is_active": True,
}


def main():
    client = get_client()

    # Check if source already exists
    existing = client.table("sources").select("id").eq("slug", NEW_SOURCE["slug"]).execute()
    if existing.data and len(existing.data) > 0:
        print(f"Source '{NEW_SOURCE['name']}' already exists with ID {existing.data[0]['id']}")
        return

    # Insert new source
    try:
        result = client.table("sources").insert(NEW_SOURCE).execute()
        print(f"Successfully added source: {NEW_SOURCE['name']}")
        print(f"Source ID: {result.data[0]['id']}")
    except Exception as e:
        print(f"Error adding source: {e}")


if __name__ == "__main__":
    main()
