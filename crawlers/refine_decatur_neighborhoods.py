#!/usr/bin/env python3
"""
Refine generic 'Decatur' neighborhoods to specific Decatur neighborhoods.

This script updates venues that currently have 'Decatur' as their neighborhood
to more specific Decatur neighborhoods based on their coordinates.
"""

import sys
from typing import Optional
from db import get_client


# Decatur neighborhood boundaries
# Format: (min_lat, max_lat, min_lng, max_lng)
DECATUR_NEIGHBORHOODS = {
    # Core Downtown
    "Downtown Decatur": (33.7721, 33.7757, -84.3004, -84.2930),
    "Decatur Square": (33.7730, 33.7750, -84.2980, -84.2950),

    # Major Neighborhoods
    "Oakhurst": (33.7680, 33.7771, -84.2985, -84.2840),
    "Winnona Park": (33.7600, 33.7680, -84.3050, -84.2900),
    "East Lake": (33.7580, 33.7680, -84.2900, -84.2750),
    "Midway Woods": (33.7520, 33.7680, -84.2850, -84.2700),

    # Historic Districts
    "MAK Historic District": (33.7700, 33.7790, -84.3000, -84.2850),
    "Clairemont-Great Lakes": (33.7700, 33.7820, -84.3050, -84.2900),
    "Ponce de Leon Court": (33.7700, 33.7720, -84.2800, -84.2750),

    # Northern Areas
    "Glennwood Estates": (33.7750, 33.7900, -84.2850, -84.2700),
    "North Decatur": (33.7800, 33.8050, -84.2700, -84.2500),
    "Sycamore Ridge": (33.7700, 33.7850, -84.3000, -84.2850),
}


def get_specific_decatur_neighborhood(lat: float, lng: float) -> Optional[str]:
    """Get specific Decatur neighborhood from coordinates."""
    if not lat or not lng:
        return None

    for neighborhood, (min_lat, max_lat, min_lng, max_lng) in DECATUR_NEIGHBORHOODS.items():
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return neighborhood

    return None


def refine_decatur_neighborhoods(dry_run: bool = False):
    """Refine generic Decatur neighborhoods to specific ones."""
    client = get_client()

    # Get all venues with generic "Decatur" neighborhood
    print("Fetching venues with generic 'Decatur' neighborhood...")
    result = client.table('venues').select(
        'id, name, neighborhood, lat, lng, zip'
    ).eq('neighborhood', 'Decatur').execute()

    venues = result.data
    print(f"Found {len(venues)} venues with generic 'Decatur' neighborhood\n")

    updated = 0
    no_coords = 0
    no_match = 0

    for venue in venues:
        venue_id = venue['id']
        venue_name = venue['name']
        lat = venue.get('lat')
        lng = venue.get('lng')

        if not lat or not lng:
            print(f"✗ {venue_name}")
            print(f"  No coordinates available")
            print()
            no_coords += 1
            continue

        # Get specific neighborhood
        specific_hood = get_specific_decatur_neighborhood(lat, lng)

        if specific_hood:
            print(f"✓ {venue_name}")
            print(f"  Decatur → {specific_hood}")
            print(f"  (lat={lat:.4f}, lng={lng:.4f})")

            if not dry_run:
                try:
                    client.table('venues').update({
                        'neighborhood': specific_hood
                    }).eq('id', venue_id).execute()
                    updated += 1
                except Exception as e:
                    print(f"  ERROR: Failed to update: {e}")
            else:
                updated += 1
        else:
            print(f"✗ {venue_name}")
            print(f"  No specific Decatur neighborhood match")
            print(f"  (lat={lat:.4f}, lng={lng:.4f})")
            no_match += 1

        print()

    # Summary
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total venues with 'Decatur': {len(venues)}")
    print(f"Successfully {'would be ' if dry_run else ''}updated: {updated}")
    print(f"No coordinates: {no_coords}")
    print(f"No specific match: {no_match}")
    if len(venues) > 0:
        print(f"Success rate: {updated/len(venues)*100:.1f}%")

    if dry_run:
        print("\nRun without --dry-run to apply changes")


def main():
    """Main entry point."""
    dry_run = '--dry-run' in sys.argv

    if dry_run:
        print("=== DRY RUN MODE ===")
        print("No changes will be made to the database\n")

    refine_decatur_neighborhoods(dry_run=dry_run)


if __name__ == '__main__':
    main()
