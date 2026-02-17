#!/usr/bin/env python3
"""
Add Women's Resource Center to End Domestic Violence (WRCDV) source to the database.

WRCDV is Georgia's oldest and largest domestic violence program, serving DeKalb
County and metro Atlanta since 1977. Provides crisis intervention, emergency
shelter, legal advocacy, support groups, and community education.

24/7 Crisis Hotline: 404-688-9436
"""

from db import get_client

SOURCE = {
    "name": "Women's Resource Center to End Domestic Violence",
    "slug": "wrcdv",
    "url": "https://www.wrcdv.org/events",
    "source_type": "community_center",
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
