#!/usr/bin/env python3
"""Check remaining venues without neighborhoods."""

from db import get_client

client = get_client()

# Get venues without neighborhoods
result = client.table('venues').select('id, name, address, city, state, lat, lng, zip').execute()
all_venues = result.data
missing_venues = [v for v in all_venues if not v.get('neighborhood')]

print(f'Remaining venues without neighborhoods: {len(missing_venues)}')
print('')
print('Sample venues (first 20):')
print('=' * 80)

for i, venue in enumerate(missing_venues[:20]):
    name = venue.get('name', 'Unknown')[:50]
    city = venue.get('city', 'N/A')
    lat = venue.get('lat')
    lng = venue.get('lng')
    zip_code = venue.get('zip', 'N/A')

    location_info = []
    if lat and lng:
        location_info.append(f'coords: {lat:.4f},{lng:.4f}')
    if zip_code != 'N/A':
        location_info.append(f'zip: {zip_code}')
    if city:
        location_info.append(f'city: {city}')

    location_str = ', '.join(location_info) if location_info else 'No location data'
    print(f'{i+1:2}. {name:50} ({location_str})')
