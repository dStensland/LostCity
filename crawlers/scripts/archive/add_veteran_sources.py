#!/usr/bin/env python3
"""
Add three veteran service organization sources to the database.

1. VETLANTA - Downtown-based veteran networking and professional development org
2. The Warrior Alliance - Battery-based veteran fitness and community org
3. ATLVets (Advancing The Line) - Veteran entrepreneurship nonprofit
"""

from db import get_client

SOURCES = [
    {
        "name": "VETLANTA",
        "slug": "vetlanta",
        "url": "https://vetlanta.org/events/",
        "source_type": "organization",
        "crawl_frequency": "weekly",
        "is_active": True,
        "rollup_behavior": "normal",
        "integration_method": "crawler",
    },
    {
        "name": "The Warrior Alliance",
        "slug": "warrior-alliance",
        "url": "https://thewarrioralliance.org/events/",
        "source_type": "organization",
        "crawl_frequency": "weekly",
        "is_active": True,
        "rollup_behavior": "normal",
        "integration_method": "crawler",
    },
    {
        "name": "ATLVets",
        "slug": "atlvets",
        "url": "https://atlvets.org/calendar/",
        "source_type": "organization",
        "crawl_frequency": "weekly",
        "is_active": True,
        "rollup_behavior": "normal",
        "integration_method": "crawler",
    },
]


def main():
    supabase = get_client()

    print("Adding veteran service organization sources to database...\n")

    for source in SOURCES:
        slug = source["slug"]

        # Check if already exists
        result = supabase.table("sources").select("*").eq("slug", slug).execute()

        if result.data:
            print(f"✓ {source['name']:30s} already exists (id={result.data[0]['id']})")
        else:
            # Insert new source
            insert_result = supabase.table("sources").insert(source).execute()
            if insert_result.data:
                print(f"✓ {source['name']:30s} created (id={insert_result.data[0]['id']})")
            else:
                print(f"✗ {source['name']:30s} failed to create")

    print("\nDone!")


if __name__ == "__main__":
    main()
