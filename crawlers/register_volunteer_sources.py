"""
Register new volunteer sources in the database.
Run this to add Keep Atlanta Beautiful, Second Helpings Atlanta, and Grant Park Conservancy.
"""

import sys
from db import get_client

def register_sources():
    """Register the three volunteer sources."""
    client = get_client()

    sources_to_add = [
        {
            "slug": "keep-atlanta-beautiful",
            "name": "Keep Atlanta Beautiful",
            "url": "https://keepatlantabeautiful.org",
            "is_active": True,
            "source_type": "venue",
            "is_sensitive": False,
        },
        {
            "slug": "second-helpings-atlanta",
            "name": "Second Helpings Atlanta",
            "url": "https://secondhelpingsatlanta.org",
            "is_active": True,
            "source_type": "venue",
            "is_sensitive": False,
        },
        {
            "slug": "grant-park-conservancy",
            "name": "Grant Park Conservancy",
            "url": "https://grantpark.org",
            "is_active": True,
            "source_type": "venue",
            "is_sensitive": False,
        },
    ]

    for source_data in sources_to_add:
        slug = source_data["slug"]

        # Check if source already exists
        existing = client.table("sources").select("id, slug").eq("slug", slug).execute()

        if existing.data:
            print(f"✓ Source already exists: {slug} (id={existing.data[0]['id']})")
        else:
            # Insert new source
            try:
                result = client.table("sources").insert(source_data).execute()
                print(f"✓ Created new source: {slug} (id={result.data[0]['id']})")
            except Exception as e:
                print(f"✗ Failed to create {slug}: {e}")

    print("\nAll sources registered. You can now run:")
    print("  python3 main.py --source keep-atlanta-beautiful")
    print("  python3 main.py --source second-helpings-atlanta")
    print("  python3 main.py --source grant-park-conservancy")


if __name__ == "__main__":
    register_sources()
