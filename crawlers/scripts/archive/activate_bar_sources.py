#!/usr/bin/env python3
"""
Script to activate inactive Atlanta bar/nightlife sources and create missing ones.
"""

import sys
from db import get_client

# Sources to activate
INACTIVE_SOURCES = [
    {
        'id': 134,
        'slug': 'blakes-on-park',
        'name': "Blake's on the Park"
    },
    {
        'id': 142,
        'slug': 'joystick-gamebar',
        'name': 'Joystick Gamebar'
    },
    {
        'id': 228,
        'slug': 'monday-night-run-club',
        'name': 'Monday Night Run Club'
    },
    {
        'id': 73,
        'slug': 'opera-nightclub',
        'name': 'Opera Nightclub'
    },
    {
        'id': 199,
        'slug': 'sound-table',
        'name': 'Sound Table'
    },
]

# Sources that need to be created
MISSING_SOURCES = [
    {
        'slug': 'brick-store-pub',
        'name': 'Brick Store Pub',
        'url': 'https://www.brickstorepub.com',
        'source_type': 'venue',
        'is_active': True,
    },
    {
        'slug': 'our-bar-atl',
        'name': 'Our Bar ATL',
        'url': 'https://www.ourbaratl.com',
        'source_type': 'venue',
        'is_active': True,
    },
]


def activate_sources():
    """Activate inactive sources."""
    client = get_client()

    print("\n=== Activating Inactive Sources ===\n")

    for source in INACTIVE_SOURCES:
        try:
            result = client.table("sources").update({
                "is_active": True
            }).eq("id", source['id']).execute()

            print(f"✓ Activated: {source['slug']:30s} (ID: {source['id']:3d}) - {source['name']}")
        except Exception as e:
            print(f"✗ Failed to activate {source['slug']}: {e}")

    print(f"\nActivated {len(INACTIVE_SOURCES)} sources")


def create_missing_sources():
    """Create missing source records."""
    client = get_client()

    print("\n=== Creating Missing Sources ===\n")

    for source in MISSING_SOURCES:
        try:
            result = client.table("sources").insert(source).execute()
            source_id = result.data[0]['id'] if result.data else None
            print(f"✓ Created: {source['slug']:30s} (ID: {source_id:3d}) - {source['name']}")
        except Exception as e:
            print(f"✗ Failed to create {source['slug']}: {e}")

    print(f"\nCreated {len(MISSING_SOURCES)} sources")


def main():
    """Main function."""
    activate_sources()
    create_missing_sources()

    print("\n=== Done ===")
    print("All bar/nightlife sources have been activated!")
    print("\nNext steps:")
    print("1. Test each crawler with: python3 main.py --source <slug>")
    print("2. Check crawl_logs table for any errors")


if __name__ == "__main__":
    main()
