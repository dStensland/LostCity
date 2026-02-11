#!/usr/bin/env python3
"""
Register the NA Georgia source in the database as INACTIVE.

Support group crawlers should be marked as inactive to prevent them from
being run automatically and from surfacing in public feeds.
"""

from db import get_client

def register_na_georgia_source():
    """Register NA Georgia source as inactive."""
    client = get_client()

    # Check if source already exists
    result = client.table("sources").select("*").eq("slug", "na-georgia").execute()

    if result.data:
        print(f"Source 'na-georgia' already exists with ID: {result.data[0]['id']}")
        print(f"is_active: {result.data[0]['is_active']}")
        return result.data[0]['id']

    # Create new source
    source_data = {
        "slug": "na-georgia",
        "name": "Narcotics Anonymous Metro Atlanta",
        "url": "https://midtownatlantana.com",
        "source_type": "support_group",
        "crawl_frequency": "weekly",
        "is_active": False,  # INACTIVE - support group content
    }

    result = client.table("sources").insert(source_data).execute()

    if result.data:
        print(f"Created NA Georgia source with ID: {result.data[0]['id']}")
        print(f"Slug: {result.data[0]['slug']}")
        print(f"is_active: {result.data[0]['is_active']}")
        return result.data[0]['id']
    else:
        print("Failed to create source")
        return None

if __name__ == "__main__":
    register_na_georgia_source()
