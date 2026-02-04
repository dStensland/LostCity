#!/usr/bin/env python3
"""Query examples for Eater Nashville Essential 38 venues."""

import db
import json

client = db.get_client()

print("=" * 80)
print("EATER NASHVILLE ESSENTIAL 38 - QUERY EXAMPLES")
print("=" * 80)

# Example 1: Find all award-winning restaurants
print("\n1. Award-Winning Restaurants:")
print("-" * 80)
result = client.table('venues').select('name, neighborhood, description').contains('vibes', ['award-winning']).eq('city', 'Nashville').execute()
for venue in result.data:
    print(f"   {venue['name']} ({venue.get('neighborhood', 'N/A')})")
    print(f"      {venue.get('description', '')[:80]}...")

# Example 2: Find casual spots in East Nashville
print("\n2. Casual Dining in East Nashville:")
print("-" * 80)
result = client.table('venues').select('name, address, vibes').contains('vibes', ['casual']).eq('neighborhood', 'East Nashville').eq('city', 'Nashville').execute()
for venue in result.data[:5]:
    print(f"   {venue['name']} - {venue.get('address', 'N/A')}")
    vibes = [v for v in venue.get('vibes', []) if v not in ['curator-vetted', 'eater-nashville-38', 'casual']]
    print(f"      Vibes: {', '.join(vibes)}")

# Example 3: International cuisine (non-American)
print("\n3. International Cuisine:")
print("-" * 80)
international_vibes = ['thai', 'vietnamese', 'ethiopian', 'egyptian', 'kurdish', 'turkish', 'korean', 'caribbean', 'jamaican', 'pan-asian']
result = client.table('venues').select('name, neighborhood, vibes').eq('city', 'Nashville').execute()
international_venues = [v for v in result.data if v.get('vibes') and any(vibe in v.get('vibes', []) for vibe in international_vibes)]
for venue in international_venues:
    cuisine_vibes = [v for v in venue.get('vibes', []) if v in international_vibes]
    print(f"   {venue['name']} ({venue.get('neighborhood', 'N/A')}) - {', '.join(cuisine_vibes).upper()}")

# Example 4: Chef-driven tasting menus (upscale dining)
print("\n4. Chef-Driven Tasting Menus:")
print("-" * 80)
result = client.table('venues').select('name, address, description').contains('vibes', ['tasting-menu']).eq('city', 'Nashville').execute()
for venue in result.data:
    print(f"   {venue['name']}")
    print(f"      {venue.get('address', 'N/A')}")
    print(f"      {venue.get('description', '')[:100]}...")

# Example 5: Pizza spots across Nashville
print("\n5. Pizza Restaurants:")
print("-" * 80)
result = client.table('venues').select('name, neighborhood, address').contains('vibes', ['pizza']).eq('city', 'Nashville').execute()
for venue in result.data:
    print(f"   {venue['name']} ({venue.get('neighborhood', 'N/A')})")
    print(f"      {venue.get('address', 'N/A')}")

# Example 6: Late-night spots
print("\n6. Late-Night Venues:")
print("-" * 80)
result = client.table('venues').select('name, neighborhood, description').contains('vibes', ['late-night']).eq('city', 'Nashville').execute()
for venue in result.data:
    print(f"   {venue['name']} ({venue.get('neighborhood', 'N/A')})")
    print(f"      {venue.get('description', '')}")

print("\n" + "=" * 80)
