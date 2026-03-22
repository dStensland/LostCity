#!/usr/bin/env python3
"""
Add Empowerline source to the database.

Empowerline is brought to you by the Aging and Independence Services Group
of the Atlanta Regional Commission (ARC), serving metro Atlanta seniors and
disabled adults.
"""

from db import get_client

SOURCE = {
    "name": "Empowerline",
    "slug": "empowerline",
    "url": "https://empowerline.org/events/",
    "source_type": "organization",
    "crawl_frequency": "weekly",
    "is_active": True,
    "rollup_behavior": "normal",
    "integration_method": "crawler",
}


def main():
    supabase = get_client()
    slug = SOURCE["slug"]

    # Check if already exists
    result = supabase.table("sources").select("*").eq("slug", slug).execute()

    if result.data:
        print(f"✓ {slug} already exists (id={result.data[0]['id']})")
    else:
        # Insert new source
        insert_result = supabase.table("sources").insert(SOURCE).execute()
        if insert_result.data:
            print(f"✓ Created {slug} (id={insert_result.data[0]['id']})")
        else:
            print(f"✗ Failed to create {slug}")


if __name__ == "__main__":
    main()
