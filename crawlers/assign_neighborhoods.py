#!/usr/bin/env python3
"""
Assign neighborhoods to venues that have coordinates but no neighborhood.
Covers Atlanta ITP, Atlanta OTP suburbs, and Nashville.
"""

import math
from db import get_client

# Neighborhood zones: name, lat, lng, radius_meters
NEIGHBORHOODS = [
    # ── Atlanta ITP ──
    ("Downtown", 33.749, -84.388, 2000),
    ("Midtown", 33.784, -84.383, 2000),
    ("Buckhead", 33.838, -84.379, 2500),
    ("Old Fourth Ward", 33.769, -84.362, 1500),
    ("East Atlanta Village", 33.740, -84.341, 1000),
    ("Little Five Points", 33.764, -84.349, 1000),
    ("Decatur", 33.775, -84.296, 2500),
    ("West Midtown", 33.791, -84.422, 2000),
    ("Virginia Highland", 33.774, -84.356, 1200),
    ("Inman Park", 33.761, -84.352, 1200),
    ("Grant Park", 33.738, -84.370, 1500),
    ("Cabbagetown", 33.749, -84.353, 800),
    ("Reynoldstown", 33.749, -84.340, 1000),
    ("Kirkwood", 33.756, -84.318, 1500),
    ("Candler Park", 33.764, -84.336, 1200),
    ("Edgewood", 33.752, -84.331, 1000),
    ("West End", 33.736, -84.413, 1500),
    ("Atlantic Station", 33.791, -84.395, 1000),
    ("Poncey-Highland", 33.772, -84.348, 1000),
    ("Castleberry Hill", 33.748, -84.401, 800),
    ("Sweet Auburn", 33.755, -84.376, 1000),
    # Additional Atlanta ITP
    ("Vine City", 33.756, -84.410, 1000),
    ("Home Park", 33.790, -84.405, 1000),
    ("Westside", 33.770, -84.425, 1500),
    ("East Lake", 33.750, -84.307, 1500),
    ("Ormewood Park", 33.730, -84.347, 1200),
    ("Summerhill", 33.737, -84.382, 1000),
    ("Peoplestown", 33.728, -84.388, 1000),
    ("Mechanicsville", 33.737, -84.400, 1000),
    ("Capitol View", 33.720, -84.412, 1200),
    ("Collier Hills", 33.810, -84.405, 1200),
    ("Brookwood", 33.800, -84.385, 1000),
    ("Ansley Park", 33.793, -84.375, 1000),
    ("Piedmont Heights", 33.800, -84.365, 1000),
    ("Morningside", 33.790, -84.350, 1500),
    ("Druid Hills", 33.780, -84.330, 2000),
    ("Lake Claire", 33.768, -84.325, 1000),
    ("Chosewood Park", 33.723, -84.372, 1000),
    ("Pittsburgh", 33.730, -84.408, 1200),
    ("Adair Park", 33.730, -84.415, 1000),
    ("Bankhead", 33.770, -84.445, 2000),

    # ── Atlanta OTP / Suburbs ──
    ("Sandy Springs", 33.924, -84.379, 4000),
    ("Dunwoody", 33.946, -84.334, 3000),
    ("Brookhaven", 33.860, -84.340, 3000),
    ("Chamblee", 33.890, -84.305, 2500),
    ("Doraville", 33.898, -84.283, 2000),
    ("Tucker", 33.855, -84.217, 3000),
    ("Avondale Estates", 33.772, -84.267, 1500),
    ("Clarkston", 33.810, -84.260, 2000),
    ("Stone Mountain", 33.808, -84.170, 3000),
    ("Marietta", 33.953, -84.550, 5000),
    ("Smyrna", 33.884, -84.514, 3000),
    ("Vinings", 33.864, -84.470, 2000),
    ("Kennesaw", 34.023, -84.616, 4000),
    ("Roswell", 34.023, -84.362, 4000),
    ("Alpharetta", 34.075, -84.294, 4000),
    ("Johns Creek", 34.029, -84.198, 4000),
    ("Duluth", 34.000, -84.145, 3000),
    ("Lawrenceville", 33.956, -84.000, 4000),
    ("Buford", 34.118, -84.004, 3000),
    ("Snellville", 33.857, -84.020, 3000),
    ("Norcross", 33.941, -84.213, 3000),
    ("Peachtree Corners", 33.970, -84.215, 3000),
    ("East Point", 33.680, -84.439, 3000),
    ("College Park", 33.653, -84.449, 3000),
    ("Hapeville", 33.660, -84.410, 2000),
    ("Fayetteville", 33.449, -84.455, 4000),
    ("Peachtree City", 33.397, -84.596, 4000),
    ("Newnan", 33.381, -84.800, 4000),
    ("Conyers", 33.668, -84.018, 3000),
    ("Covington", 33.597, -83.860, 3000),
    ("McDonough", 33.447, -84.147, 3000),
    ("Woodstock", 34.101, -84.519, 3000),
    ("Canton", 34.237, -84.491, 3000),
    ("Acworth", 34.066, -84.676, 3000),
    ("Powder Springs", 33.859, -84.684, 3000),
    ("Dacula", 33.988, -83.898, 3000),
    ("Lithonia", 33.713, -84.105, 2500),

    # ── Nashville ──
    ("Downtown Nashville", 36.162, -86.781, 2000),
    ("Broadway", 36.158, -86.776, 800),
    ("The Gulch", 36.153, -86.787, 1000),
    ("Germantown", 36.174, -86.789, 1200),
    ("East Nashville", 36.175, -86.755, 2500),
    ("Five Points", 36.172, -86.748, 1000),
    ("Music Row", 36.152, -86.798, 1200),
    ("Midtown Nashville", 36.153, -86.804, 1500),
    ("Vanderbilt", 36.145, -86.805, 1500),
    ("Hillsboro Village", 36.135, -86.802, 1000),
    ("12 South", 36.121, -86.793, 1000),
    ("The Nations", 36.167, -86.826, 2000),
    ("Sylvan Park", 36.150, -86.830, 1500),
    ("West Nashville", 36.148, -86.850, 2500),
    ("Berry Hill", 36.108, -86.773, 1200),
    ("Melrose", 36.112, -86.767, 1500),
    ("Wedgewood-Houston", 36.133, -86.775, 1500),
    ("Edgehill", 36.139, -86.790, 1000),
    ("Marathon Village", 36.168, -86.800, 800),
    ("SoBro", 36.155, -86.775, 1000),
    ("Printer's Alley", 36.163, -86.777, 500),
    ("Opryland", 36.209, -86.694, 3000),
    ("Donelson", 36.185, -86.700, 3000),
    ("Bellevue", 36.075, -86.895, 4000),
    ("Green Hills", 36.105, -86.818, 2000),
    ("Belle Meade", 36.105, -86.860, 2500),
    ("Madison", 36.260, -86.710, 4000),
    ("Hendersonville", 36.305, -86.620, 4000),
    ("Franklin", 35.925, -86.869, 5000),
    ("Murfreesboro", 35.845, -86.390, 5000),
    ("Clarksville", 36.530, -87.359, 5000),
    ("Gallatin", 36.388, -86.447, 4000),
    ("Lebanon", 36.208, -86.292, 4000),
    ("Mt. Juliet", 36.200, -86.519, 3000),
    ("Hermitage", 36.190, -86.618, 3000),
    ("Antioch", 36.060, -86.670, 4000),
    ("Brentwood", 36.033, -86.783, 3000),
    ("Cool Springs", 35.956, -86.810, 3000),
    ("Nolensville", 35.952, -86.669, 3000),

    # ── Other Georgia Cities ──
    ("Macon", 32.837, -83.633, 8000),
    ("Augusta", 33.474, -81.975, 8000),
    ("Savannah", 32.081, -81.091, 8000),
    ("Athens", 33.951, -83.357, 6000),
    ("Columbus", 32.461, -84.988, 6000),
    ("Warner Robins", 32.620, -83.624, 5000),
    ("Rome", 34.257, -85.165, 5000),
    ("Valdosta", 30.832, -83.279, 5000),
    ("Gainesville", 34.298, -83.824, 4000),
    ("Hampton", 33.386, -84.284, 3000),
    ("Riverdale", 33.573, -84.413, 3000),
]


def haversine(lat1, lng1, lat2, lng2):
    """Distance in meters between two points."""
    R = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def find_neighborhood(lat, lng):
    """Find the closest matching neighborhood."""
    best = None
    best_ratio = float('inf')
    for name, nlat, nlng, radius in NEIGHBORHOODS:
        dist = haversine(lat, lng, nlat, nlng)
        if dist <= radius:
            # Use distance/radius ratio to find best match (most specific)
            ratio = dist / radius
            if ratio < best_ratio:
                best = name
                best_ratio = ratio
    return best


def main():
    client = get_client()

    # Get all venues with coords but no neighborhood (batch to avoid 1000 limit)
    all_venues = []
    offset = 0
    while True:
        r = (client.table('venues')
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
            client.table('venues').update({'neighborhood': hood}).eq('id', v['id']).execute()
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
