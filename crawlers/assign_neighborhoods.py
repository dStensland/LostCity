#!/usr/bin/env python3
"""
Assign neighborhoods to venues that have coordinates but no neighborhood.
Covers Atlanta ITP, Atlanta OTP suburbs, and Nashville.
"""

from db import get_client
from neighborhood_lookup import NEIGHBORHOODS, haversine, infer_neighborhood_from_coords


def find_neighborhood(lat, lng):
    """Find the closest matching neighborhood. Wraps infer_neighborhood_from_coords."""
    return infer_neighborhood_from_coords(lat, lng)


def main():
    client = get_client()

    # Get all venues with coords but no neighborhood (batch to avoid 1000 limit)
    all_venues = []
    offset = 0
    while True:
        r = (client.table('places')
             .select('id,name,lat,lng,city')
             .eq('active', True)
             .not_.is_('lat', 'null')
             .is_('neighborhood', 'null')
             .order('id')
             .range(offset, offset + 999)
             .execute())
        if not r.data:
            break
        all_venues.extend(r.data)
        if len(r.data) < 1000:
            break
        offset += 1000

    print(f"Found {len(all_venues)} venues with coords but no neighborhood\n")

    assigned = 0
    unmatched = []

    for v in all_venues:
        hood = find_neighborhood(v['lat'], v['lng'])
        if hood:
            client.table('places').update({'neighborhood': hood}).eq('id', v['id']).execute()
            assigned += 1
        else:
            unmatched.append(v)

    print(f"Assigned: {assigned}")
    print(f"Unmatched: {len(unmatched)}")

    if unmatched[:10]:
        print(f"\nSample unmatched:")
        for v in unmatched[:10]:
            print(f"  [{v['id']}] {v['name'][:40]:40s} city={v.get('city','?'):15s} ({v['lat']:.3f}, {v['lng']:.3f})")


if __name__ == "__main__":
    main()
