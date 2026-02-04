#!/usr/bin/env python3
"""
Script to check which Atlanta bar/nightlife crawlers exist and their status.
"""

import sys
from pathlib import Path
from db import get_client

# Bar/nightlife crawler slugs based on filenames
BAR_CRAWLERS = [
    'marys-bar',
    'marys',
    'opera-nightclub',
    'joystick-gamebar',
    'star-community-bar',
    'our-bar-atl',
    'smiths-olde-bar',
    'hawks-bars',
    'blakes-on-park',
    'blakes-on-the-park',
    'church-atlanta',
    'johnnys-hideaway',
    'monday-night',
    'monday-night-run-club',
    'my-sisters-room',
    'painted-duck',
    'painted-pin',
    'sound-table',
    'woofs-atlanta',
    'brick-store-pub',
    'the-earl',
    'the-porter',
]

def main():
    client = get_client()

    print("\n=== Atlanta Bar/Nightlife Crawler Status ===\n")

    active = []
    inactive = []
    missing = []

    for slug in sorted(BAR_CRAWLERS):
        try:
            result = client.table("sources").select("*").eq("slug", slug).execute()

            if result.data and len(result.data) > 0:
                source = result.data[0]
                if source.get('is_active'):
                    active.append((slug, source.get('id'), source.get('name')))
                    print(f"✓ ACTIVE:   {slug:30s} (ID: {source.get('id'):3d}) - {source.get('name')}")
                else:
                    inactive.append((slug, source.get('id'), source.get('name')))
                    print(f"✗ INACTIVE: {slug:30s} (ID: {source.get('id'):3d}) - {source.get('name')}")
            else:
                # Check if file exists
                file_path = Path(__file__).parent / "sources" / f"{slug.replace('-', '_')}.py"
                if file_path.exists():
                    missing.append(slug)
                    print(f"! MISSING:  {slug:30s} (file exists, no DB record)")
        except Exception as e:
            print(f"✗ ERROR:    {slug:30s} - {e}")

    print(f"\n=== Summary ===")
    print(f"Active:   {len(active)}")
    print(f"Inactive: {len(inactive)}")
    print(f"Missing:  {len(missing)}")
    print(f"Total:    {len(active) + len(inactive) + len(missing)}")

    if inactive:
        print(f"\n=== Inactive Sources to Activate ===")
        for slug, source_id, name in inactive:
            print(f"  {slug} (ID: {source_id})")

    if missing:
        print(f"\n=== Missing Sources (need DB records) ===")
        for slug in missing:
            print(f"  {slug}")

if __name__ == "__main__":
    main()
