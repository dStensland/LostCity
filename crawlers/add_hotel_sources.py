#!/usr/bin/env python3
"""
Add hotel venue sources to the database.
Run this script to register the new hotel crawlers.
"""

from db import get_client

HOTEL_SOURCES = [
    {
        "slug": "hotel-clermont",
        "name": "Hotel Clermont",
        "url": "https://www.hotelclermont.com",
        "source_type": "venue",
        "is_active": True,
        "crawl_frequency": "daily",
    },
    {
        "slug": "georgian-terrace-hotel",
        "name": "The Georgian Terrace Hotel",
        "url": "https://thegeorgianterrace.com",
        "source_type": "venue",
        "is_active": True,
        "crawl_frequency": "daily",
    },
    {
        "slug": "skylounge-glenn-hotel",
        "name": "Skylounge at Glenn Hotel",
        "url": "https://glennhotel.com/skylounge",
        "source_type": "venue",
        "is_active": False,  # Monitoring only - no regular events calendar
        "crawl_frequency": "weekly",
    },
]


def main():
    """Add hotel sources to database."""
    client = get_client()

    for source_data in HOTEL_SOURCES:
        # Check if source already exists
        result = client.table("sources").select("id, slug").eq("slug", source_data["slug"]).execute()

        if result.data:
            print(f"Source already exists: {source_data['slug']}")
            # Update if needed
            client.table("sources").update(source_data).eq("slug", source_data["slug"]).execute()
            print(f"  Updated: {source_data['name']}")
        else:
            # Insert new source
            result = client.table("sources").insert(source_data).execute()
            print(f"Added new source: {source_data['name']} ({source_data['slug']})")


if __name__ == "__main__":
    main()
