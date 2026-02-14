#!/usr/bin/env python3
"""
Add DBSA Atlanta and Ridgeview Institute sources to the database.
These are support group sources that generate events from static schedules.
"""

from db import get_client

SOURCES = [
    {
        "name": "DBSA Atlanta",
        "slug": "dbsa-atlanta",
        "url": "https://atlantamoodsupport.org",
        "source_type": "organization",
        "crawl_frequency": "weekly",
        "is_active": True,
        "rollup_behavior": "normal",
        "integration_method": "static_schedule",
        "is_sensitive": True,  # Mental health support groups
    },
    {
        "name": "Ridgeview Institute",
        "slug": "ridgeview-institute",
        "url": "https://www.ridgeviewsmyrna.com/resources/support-groups/",
        "source_type": "venue",
        "crawl_frequency": "weekly",
        "is_active": True,
        "rollup_behavior": "normal",
        "integration_method": "static_schedule",
        "is_sensitive": True,  # Mental health and addiction recovery support groups
    },
]


def main():
    supabase = get_client()

    for source_data in SOURCES:
        slug = source_data["slug"]

        # Check if already exists
        result = supabase.table("sources").select("*").eq("slug", slug).execute()

        if result.data:
            print(f"✓ {slug} already exists (id={result.data[0]['id']})")
        else:
            # Insert new source
            insert_result = supabase.table("sources").insert(source_data).execute()
            if insert_result.data:
                print(f"✓ Created {slug} (id={insert_result.data[0]['id']})")
            else:
                print(f"✗ Failed to create {slug}")


if __name__ == "__main__":
    main()
