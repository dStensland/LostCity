#!/usr/bin/env python3
"""
Add Exhibition Hub Atlanta as a source.
Run from crawlers directory: python add_exhibition_hub.py
"""

from db import get_client

NEW_SOURCE = {
    "name": "Exhibition Hub Atlanta",
    "slug": "exhibition-hub",
    "url": "https://exhibitionhub.com",
    "source_type": "scrape",
    "crawl_frequency": "daily",
}


def main():
    client = get_client()

    # Check if source already exists
    existing = client.table("sources").select("id").eq("slug", NEW_SOURCE["slug"]).execute()
    if existing.data and len(existing.data) > 0:
        print(f"Source already exists: {NEW_SOURCE['name']}")
        return

    # Insert new source
    try:
        result = client.table("sources").insert(NEW_SOURCE).execute()
        print(f"Successfully added: {NEW_SOURCE['name']}")
        print(f"Source ID: {result.data[0]['id']}")
    except Exception as e:
        print(f"Error adding {NEW_SOURCE['name']}: {e}")


if __name__ == "__main__":
    main()
