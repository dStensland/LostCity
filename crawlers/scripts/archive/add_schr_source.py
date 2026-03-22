#!/usr/bin/env python3
"""
Add Southern Center for Human Rights (SCHR) source to the database.

SCHR is a non-profit legal advocacy organization dedicated to defending the rights
of people in the criminal legal system, challenging mass incarceration, and fighting
for racial and economic justice in the Deep South since 1976.

2026 is their 50th anniversary.
"""

from db import get_client

SOURCE = {
    "name": "Southern Center for Human Rights",
    "slug": "schr",
    "url": "https://www.schr.org/events/",
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
