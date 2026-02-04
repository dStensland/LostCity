#!/usr/bin/env python3
"""Verify Eater Nashville Essential 38 venue import."""

import db
import json

client = db.get_client()

# Query venues with curator tags
result = client.table('venues').select('*').contains('vibes', ['eater-nashville-38']).execute()

print(f"Total venues with 'eater-nashville-38' vibe: {len(result.data)}")
print("\nSample venues:")
print("=" * 80)

# Show first 5 venues
for i, venue in enumerate(result.data[:5], 1):
    print(f"\n{i}. {venue['name']}")
    print(f"   Slug: {venue['slug']}")
    print(f"   Address: {venue.get('address', 'N/A')}")
    print(f"   Neighborhood: {venue.get('neighborhood', 'N/A')}")
    print(f"   City: {venue.get('city', 'N/A')}, {venue.get('state', 'N/A')}")
    print(f"   Type: {venue.get('venue_type', 'N/A')}")
    print(f"   Vibes: {', '.join(venue.get('vibes', []))}")
    print(f"   Description: {venue.get('description', 'N/A')[:100]}...")

# Show neighborhood distribution
neighborhoods = {}
for venue in result.data:
    hood = venue.get('neighborhood', 'Unknown')
    neighborhoods[hood] = neighborhoods.get(hood, 0) + 1

print("\n\nNeighborhood Distribution:")
print("=" * 80)
for hood, count in sorted(neighborhoods.items(), key=lambda x: x[1], reverse=True):
    print(f"{hood:25} {count:3} venues")

# Show venue types
venue_types = {}
for venue in result.data:
    vtype = venue.get('venue_type', 'Unknown')
    venue_types[vtype] = venue_types.get(vtype, 0) + 1

print("\n\nVenue Type Distribution:")
print("=" * 80)
for vtype, count in sorted(venue_types.items(), key=lambda x: x[1], reverse=True):
    print(f"{vtype:25} {count:3} venues")
