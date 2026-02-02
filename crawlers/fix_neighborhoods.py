#!/usr/bin/env python3
"""
Fix missing neighborhood data for Atlanta venues.

This script:
1. Queries venues with missing neighborhood data
2. Uses lat/lng or zip codes to determine the neighborhood
3. Updates the database with the determined neighborhoods

Atlanta neighborhoods are determined by:
- Lat/lng boundaries (primary method)
- ZIP code mapping (fallback)
"""

import sys
from typing import Optional, Dict, List, Tuple
from db import get_client


# Atlanta neighborhood boundaries (approximate lat/lng bounding boxes)
# Format: (min_lat, max_lat, min_lng, max_lng)
NEIGHBORHOOD_BOUNDARIES = {
    # Core neighborhoods
    "Midtown": (33.770, 33.795, -84.395, -84.375),
    "Downtown": (33.748, 33.767, -84.400, -84.375),
    "Buckhead": (33.830, 33.875, -84.395, -84.355),
    "Virginia-Highland": (33.775, 33.795, -84.355, -84.335),
    "Little Five Points": (33.760, 33.770, -84.355, -84.340),
    "East Atlanta": (33.730, 33.750, -84.360, -84.340),

    # Decatur neighborhoods
    "Downtown Decatur": (33.7721, 33.7757, -84.3004, -84.2930),
    "Decatur Square": (33.7730, 33.7750, -84.2980, -84.2950),
    "Oakhurst": (33.7680, 33.7771, -84.2985, -84.2840),
    "Winnona Park": (33.7600, 33.7680, -84.3050, -84.2900),
    "East Lake": (33.7580, 33.7680, -84.2900, -84.2750),
    "Midway Woods": (33.7520, 33.7680, -84.2850, -84.2700),
    "MAK Historic District": (33.7700, 33.7790, -84.3000, -84.2850),
    "Clairemont-Great Lakes": (33.7700, 33.7820, -84.3050, -84.2900),
    "Ponce de Leon Court": (33.7700, 33.7720, -84.2800, -84.2750),
    "Glennwood Estates": (33.7750, 33.7900, -84.2850, -84.2700),
    "North Decatur": (33.7800, 33.8050, -84.2700, -84.2500),
    "Sycamore Ridge": (33.7700, 33.7850, -84.3000, -84.2850),

    "West Midtown": (33.775, 33.790, -84.415, -84.395),
    "Old Fourth Ward": (33.755, 33.770, -84.375, -84.355),
    "Grant Park": (33.730, 33.745, -84.380, -84.360),
    "Inman Park": (33.750, 33.765, -84.365, -84.350),
    "Reynoldstown": (33.735, 33.750, -84.360, -84.345),
    "Cabbagetown": (33.743, 33.753, -84.367, -84.352),
    "Sweet Auburn": (33.753, 33.763, -84.385, -84.370),
    "West End": (33.730, 33.745, -84.420, -84.405),
    "Castleberry Hill": (33.745, 33.755, -84.400, -84.385),
    "Poncey-Highland": (33.770, 33.780, -84.365, -84.350),
    "Edgewood": (33.750, 33.760, -84.360, -84.345),

    # Additional neighborhoods
    "Kirkwood": (33.745, 33.760, -84.320, -84.300),
    "Druid Hills": (33.765, 33.785, -84.340, -84.315),
    "Morningside": (33.785, 33.800, -84.360, -84.345),
    "Ansley Park": (33.790, 33.805, -84.385, -84.370),
    "Piedmont Heights": (33.795, 33.810, -84.380, -84.365),
    "Brookhaven": (33.850, 33.875, -84.355, -84.325),
    "Sandy Springs": (33.910, 33.950, -84.395, -84.355),
    "Dunwoody": (33.935, 33.965, -84.355, -84.315),
    "Marietta": (33.945, 33.965, -84.565, -84.525),

    # Marietta neighborhoods
    "Marietta Square": (33.945, 33.960, -84.560, -84.540),
    "Downtown Marietta": (33.943, 33.958, -84.560, -84.545),
    "Polk": (33.932, 33.944, -84.555, -84.540),
    "Whitlock": (33.920, 33.960, -84.555, -84.495),  # Extended to cover more area
    "Fort Hill": (33.940, 33.960, -84.585, -84.565),
    "North Landing": (33.910, 33.930, -84.525, -84.495),
    "Eastern Marietta": (33.950, 33.970, -84.495, -84.465),

    # East Cobb neighborhoods
    "Indian Hills": (33.990, 34.010, -84.400, -84.360),
    "Chimney Springs": (34.005, 34.025, -84.350, -84.310),
    "Windsor Oaks": (34.015, 34.035, -84.325, -84.285),
    "Chestnut Creek": (33.975, 33.995, -84.410, -84.380),
    "Northampton": (34.000, 34.020, -84.430, -84.400),
    "Somerset": (33.965, 33.985, -84.385, -84.355),
    "Brookstone": (34.020, 34.040, -84.305, -84.275),

    # West Cobb
    "Powers Park": (33.925, 33.945, -84.495, -84.470),

    # Eastside
    "Candler Park": (33.750, 33.765, -84.350, -84.335),
    "Lake Claire": (33.760, 33.770, -84.340, -84.325),
    "Ormewood Park": (33.720, 33.735, -84.365, -84.350),
    "Summerhill": (33.735, 33.748, -84.385, -84.370),

    # Westside
    "Atlantic Station": (33.790, 33.800, -84.400, -84.390),
    "Home Park": (33.775, 33.785, -84.405, -84.390),
    "Vine City": (33.755, 33.765, -84.415, -84.400),
    "English Avenue": (33.765, 33.775, -84.425, -84.410),

    # Southside
    "Pittsburgh": (33.715, 33.730, -84.395, -84.380),
    "Mechanicsville": (33.735, 33.748, -84.400, -84.385),
    "Adair Park": (33.720, 33.730, -84.415, -84.400),
    "Capitol View": (33.715, 33.730, -84.435, -84.420),

    # North
    "Chastain Park": (33.955, 33.975, -84.395, -84.375),
    "Lindbergh": (33.815, 33.830, -84.375, -84.360),
    "Lenox": (33.840, 33.855, -84.370, -84.355),

    # Northeast
    "Tucker": (33.830, 33.870, -84.250, -84.200),
    "Stone Mountain": (33.780, 33.820, -84.200, -84.150),
    "Chamblee": (33.875, 33.905, -84.320, -84.280),
    "Doraville": (33.890, 33.920, -84.295, -84.255),

    # Extended metro areas
    "Perimeter": (33.915, 33.935, -84.355, -84.330),  # Perimeter Mall area
    "Duluth": (33.950, 34.010, -84.175, -84.120),
    "Norcross": (33.920, 33.965, -84.240, -84.180),
    "Roswell": (33.995, 34.060, -84.390, -84.330),
    "Alpharetta": (34.035, 34.105, -84.325, -84.260),
    "Smyrna": (33.855, 33.905, -84.540, -84.480),

    # College Park neighborhoods
    "Historic College Park": (33.6420, 33.6560, -84.4650, -84.4480),
    "Downtown College Park": (33.6470, 33.6520, -84.4620, -84.4480),
    "Woodward Academy": (33.6350, 33.6480, -84.4550, -84.4350),
    "FAA District": (33.6380, 33.6520, -84.4700, -84.4500),
    "Camp Creek": (33.6250, 33.6450, -84.4700, -84.4300),
    "Princeton Lakes": (33.6200, 33.6350, -84.4600, -84.4350),
    "Airport District": (33.6150, 33.6380, -84.4650, -84.4100),
    "South College Park": (33.6050, 33.6250, -84.4750, -84.4300),

    "College Park": (33.620, 33.675, -84.480, -84.425),
    "East Point": (33.655, 33.705, -84.480, -84.425),
    "Hapeville": (33.645, 33.685, -84.430, -84.385),
    "Forest Park": (33.595, 33.645, -84.390, -84.335),
    "Jonesboro": (33.495, 33.545, -84.390, -84.335),
    "Morrow": (33.565, 33.615, -84.370, -84.315),
    "Riverdale": (33.545, 33.595, -84.440, -84.385),
    "Union City": (33.565, 33.615, -84.570, -84.515),
    "Fairburn": (33.535, 33.585, -84.620, -84.565),
    "Austell": (33.790, 33.840, -84.660, -84.605),
    "Powder Springs": (33.845, 33.895, -84.720, -84.665),
    "Kennesaw": (34.005, 34.055, -84.660, -84.605),
    "Acworth": (34.045, 34.095, -84.720, -84.665),
    "Woodstock": (34.085, 34.135, -84.550, -84.495),
    "Canton": (34.205, 34.255, -84.530, -84.475),
    "Cumming": (34.175, 34.235, -84.180, -84.125),
    "Buford": (34.085, 34.135, -84.005, -83.945),
    "Lawrenceville": (33.935, 33.985, -84.010, -83.955),
    "Snellville": (33.835, 33.885, -84.050, -83.995),
    "Lithonia": (33.685, 33.735, -84.140, -84.085),
    "Conyers": (33.635, 33.685, -84.040, -83.985),
    "Clarkston": (33.800, 33.820, -84.250, -84.230),
    "Avondale Estates": (33.760, 33.780, -84.275, -84.255),
    "Mableton": (33.800, 33.830, -84.585, -84.545),
    "Douglasville": (33.730, 33.770, -84.750, -84.705),
    "Villa Rica": (33.715, 33.755, -84.935, -84.895),
    "Newnan": (33.360, 33.420, -84.830, -84.770),
    "Fayetteville": (33.430, 33.470, -84.480, -84.440),
    "Peachtree City": (33.380, 33.420, -84.610, -84.570),
    "McDonough": (33.430, 33.470, -84.170, -84.130),
    "Stockbridge": (33.520, 33.560, -84.250, -84.210),
    "Covington": (33.580, 33.620, -83.870, -83.830),
    "Loganville": (33.825, 33.865, -83.920, -83.880),
    "Monroe": (33.775, 33.815, -83.735, -83.695),
    "Winder": (33.975, 34.015, -83.740, -83.700),
}


# ZIP code to neighborhood mapping (fallback when lat/lng not available)
ZIP_TO_NEIGHBORHOOD = {
    # Core Atlanta
    "30303": "Downtown",
    "30308": "Midtown",
    "30309": "Midtown",
    "30313": "Downtown",
    "30314": "West End",
    "30315": "Mechanicsville",
    "30316": "East Atlanta",
    "30317": "Kirkwood",
    "30318": "West Midtown",
    "30324": "Buckhead",
    "30326": "Buckhead",
    "30327": "Buckhead",
    "30305": "Buckhead",
    "30319": "Brookhaven",
    "30322": "Druid Hills",
    "30329": "Druid Hills",

    # Eastside
    "30307": "Little Five Points",
    "30306": "Virginia-Highland",
    "30312": "Sweet Auburn",
    "30310": "Pittsburgh",
    "30312": "Downtown",
    "30311": "West End",
    "30331": "Cascade Heights",

    # Decatur
    "30030": "Downtown Decatur",
    "30031": "Downtown Decatur",
    "30032": "Decatur",
    "30033": "North Decatur",
    "30034": "Decatur",

    # North Atlanta
    "30328": "Sandy Springs",
    "30338": "Dunwoody",
    "30341": "Chamblee",
    "30340": "Doraville",
    "30350": "Marietta",
    "30342": "Sandy Springs",
    "30345": "Tucker",
    "30346": "Dunwoody",
    "30360": "Dunwoody",
    "30339": "Smyrna",

    # Perimeter/Dunwoody
    "30346": "Perimeter",
    "30338": "Perimeter",

    # Suburban areas
    "30075": "Roswell",
    "30076": "Roswell",
    "30004": "Alpharetta",
    "30005": "Alpharetta",
    "30009": "Alpharetta",
    "30022": "Alpharetta",
    "30060": "Downtown Marietta",
    "30061": "Downtown Marietta",
    "30062": "East Cobb",
    "30064": "Marietta",
    "30066": "Eastern Marietta",
    "30067": "East Cobb",
    "30068": "East Cobb",
    "30080": "Smyrna",
    "30082": "Smyrna",
    "30126": "Mableton",
    "30144": "Kennesaw",
    "30152": "Kennesaw",
    "30188": "Woodstock",
    "30189": "Woodstock",

    # South metro
    "30296": "Riverdale",
    "30274": "Riverdale",
    "30273": "Morrow",
    "30260": "Morrow",
    "30297": "Forest Park",
    "30294": "Conyers",
    "30238": "Jonesboro",
    "30236": "Jonesboro",
    "30281": "Stockbridge",
    "30213": "Fairburn",
    "30291": "Union City",
    "30337": "Historic College Park",
    "30349": "Camp Creek",
    "30344": "East Point",
    "30354": "Hapeville",

    # East metro
    "30078": "Snellville",
    "30087": "Stone Mountain",
    "30088": "Stone Mountain",
    "30083": "Stone Mountain",
    "30094": "Conyers",
    "30012": "Conyers",
    "30058": "Lithonia",
    "30038": "Lithonia",
    "30044": "Lawrenceville",
    "30045": "Lawrenceville",
    "30046": "Lawrenceville",
    "30043": "Lawrenceville",
    "30096": "Duluth",
    "30097": "Duluth",
    "30071": "Norcross",
    "30092": "Norcross",
    "30093": "Norcross",

    # North suburbs
    "30101": "Acworth",
    "30102": "Acworth",
    "30114": "Canton",
    "30115": "Canton",
    "30040": "Cumming",
    "30041": "Cumming",
    "30028": "Cumming",
    "30518": "Buford",
    "30519": "Buford",
}


def get_neighborhood_from_coordinates(lat: float, lng: float) -> Optional[str]:
    """Determine neighborhood from lat/lng coordinates."""
    if not lat or not lng:
        return None

    # Check each neighborhood boundary
    for neighborhood, (min_lat, max_lat, min_lng, max_lng) in NEIGHBORHOOD_BOUNDARIES.items():
        if min_lat <= lat <= max_lat and min_lng <= lng <= max_lng:
            return neighborhood

    return None


def get_neighborhood_from_zip(zip_code: str) -> Optional[str]:
    """Determine neighborhood from ZIP code."""
    if not zip_code:
        return None

    # Clean ZIP code (take first 5 digits)
    clean_zip = zip_code.strip().split('-')[0][:5]
    return ZIP_TO_NEIGHBORHOOD.get(clean_zip)


def get_neighborhood_for_venue(venue: Dict) -> Optional[str]:
    """Determine the neighborhood for a venue using available data."""
    venue_name = venue.get('name', '').lower()

    # Skip virtual venues - they shouldn't have a neighborhood
    if 'online' in venue_name or 'virtual' in venue_name:
        return None

    # Try lat/lng first (most accurate)
    lat = venue.get('lat')
    lng = venue.get('lng')
    if lat and lng:
        neighborhood = get_neighborhood_from_coordinates(lat, lng)
        if neighborhood:
            return neighborhood

        # If we have coordinates but no match, check if it's way outside Atlanta metro
        # Atlanta metro is roughly 33.5-34.2 lat, -84.8 to -83.9 lng
        if not (33.4 <= lat <= 34.3 and -84.9 <= lng <= -83.8):
            # Outside Atlanta metro area - skip it
            return None

    # Fall back to ZIP code
    zip_code = venue.get('zip')
    if zip_code:
        neighborhood = get_neighborhood_from_zip(zip_code)
        if neighborhood:
            return neighborhood

    # Last resort: try to extract city from address
    city = venue.get('city', '').lower()
    if city:
        # Map common city names to neighborhoods
        city_map = {
            'atlanta': None,  # Too generic, need more specific data
            'decatur': 'Decatur',
            'buckhead': 'Buckhead',
            'midtown': 'Midtown',
            'marietta': 'Marietta',
            'roswell': 'Roswell',
            'alpharetta': 'Alpharetta',
            'sandy springs': 'Sandy Springs',
            'dunwoody': 'Dunwoody',
            'smyrna': 'Smyrna',
            'chamblee': 'Chamblee',
            'doraville': 'Doraville',
            'tucker': 'Tucker',
            'stone mountain': 'Stone Mountain',
            'lithonia': 'Lithonia',
            'conyers': 'Conyers',
            'college park': 'College Park',
            'east point': 'East Point',
            'hapeville': 'Hapeville',
            'forest park': 'Forest Park',
            'jonesboro': 'Jonesboro',
            'morrow': 'Morrow',
            'riverdale': 'Riverdale',
            'union city': 'Union City',
            'fairburn': 'Fairburn',
        }
        if city in city_map and city_map[city]:
            return city_map[city]

    # No neighborhood could be determined
    return None


def fix_venue_neighborhoods(dry_run: bool = False) -> Tuple[int, int, int]:
    """
    Fix missing neighborhood data for venues.

    Returns:
        Tuple of (total_missing, updated, failed)
    """
    client = get_client()

    # Get venues missing neighborhood data with pagination
    print("Fetching venues with missing neighborhood data...")
    all_venues = []
    page_size = 1000
    offset = 0

    while True:
        result = client.table('venues').select(
            'id, name, neighborhood, address, city, state, lat, lng, zip'
        ).range(offset, offset + page_size - 1).execute()

        if not result.data:
            break

        all_venues.extend(result.data)

        if len(result.data) < page_size:
            break

        offset += page_size

    # Filter to venues with missing neighborhood
    missing_venues = [v for v in all_venues if not v.get('neighborhood')]

    print(f"\nFound {len(missing_venues)} venues missing neighborhood data out of {len(all_venues)} total")
    print(f"Percentage missing: {len(missing_venues)/len(all_venues)*100:.1f}%\n")

    updated = 0
    failed = 0

    for venue in missing_venues:
        venue_id = venue['id']
        venue_name = venue['name']

        # Determine neighborhood
        neighborhood = get_neighborhood_for_venue(venue)

        if neighborhood:
            print(f"✓ {venue_name}")
            print(f"  → {neighborhood}")
            if venue.get('lat') and venue.get('lng'):
                print(f"  (lat={venue['lat']:.4f}, lng={venue['lng']:.4f})")
            elif venue.get('zip'):
                print(f"  (zip={venue['zip']})")

            if not dry_run:
                try:
                    client.table('venues').update({
                        'neighborhood': neighborhood
                    }).eq('id', venue_id).execute()
                    updated += 1
                except Exception as e:
                    print(f"  ERROR: Failed to update: {e}")
                    failed += 1
            else:
                updated += 1
        else:
            print(f"✗ {venue_name}")
            print(f"  No neighborhood match (lat={venue.get('lat')}, lng={venue.get('lng')}, zip={venue.get('zip')})")
            failed += 1

        print()

    return len(missing_venues), updated, failed


def refine_college_park_neighborhoods(dry_run: bool = False) -> Tuple[int, int, int]:
    """
    Refine generic 'College Park' neighborhoods to specific sub-neighborhoods.

    Returns:
        Tuple of (total_candidates, updated, unchanged)
    """
    client = get_client()

    print("Fetching venues with generic 'College Park' neighborhood...")
    all_venues = []
    page_size = 1000
    offset = 0

    while True:
        result = client.table('venues').select(
            'id, name, neighborhood, address, city, state, lat, lng, zip'
        ).eq('neighborhood', 'College Park').range(offset, offset + page_size - 1).execute()

        if not result.data:
            break

        all_venues.extend(result.data)

        if len(result.data) < page_size:
            break

        offset += page_size

    print(f"\nFound {len(all_venues)} venues with generic 'College Park' neighborhood\n")

    updated = 0
    unchanged = 0

    for venue in all_venues:
        venue_id = venue['id']
        venue_name = venue['name']

        # Only refine if we have coordinates
        if not venue.get('lat') or not venue.get('lng'):
            unchanged += 1
            continue

        # Get more specific neighborhood
        new_neighborhood = get_neighborhood_from_coordinates(venue['lat'], venue['lng'])

        # Only update if we got a more specific neighborhood (not the generic College Park)
        if new_neighborhood and new_neighborhood != 'College Park':
            print(f"✓ {venue_name}")
            print(f"  College Park → {new_neighborhood}")
            print(f"  (lat={venue['lat']:.4f}, lng={venue['lng']:.4f})")

            if not dry_run:
                try:
                    client.table('venues').update({
                        'neighborhood': new_neighborhood
                    }).eq('id', venue_id).execute()
                    updated += 1
                except Exception as e:
                    print(f"  ERROR: Failed to update: {e}")
                    unchanged += 1
            else:
                updated += 1
        else:
            # Keep College Park neighborhood
            unchanged += 1

        print()

    return len(all_venues), updated, unchanged


def main():
    """Main entry point."""
    dry_run = '--dry-run' in sys.argv
    refine_only = '--refine-college-park' in sys.argv

    if dry_run:
        print("=== DRY RUN MODE ===")
        print("No changes will be made to the database\n")

    if refine_only:
        print("=== REFINING COLLEGE PARK NEIGHBORHOODS ===\n")
        total_candidates, updated, unchanged = refine_college_park_neighborhoods(dry_run=dry_run)

        print("\n" + "="*60)
        print("COLLEGE PARK REFINEMENT SUMMARY")
        print("="*60)
        print(f"Total venues with generic College Park: {total_candidates}")
        print(f"Successfully {'would be ' if dry_run else ''}updated: {updated}")
        print(f"Kept as College Park: {unchanged}")

        if dry_run:
            print("\nRun without --dry-run to apply changes")
        return

    total_missing, updated, failed = fix_venue_neighborhoods(dry_run=dry_run)

    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total venues missing neighborhood: {total_missing}")
    print(f"Successfully {'would be ' if dry_run else ''}updated: {updated}")
    print(f"Could not determine neighborhood: {failed}")
    print(f"Success rate: {updated/total_missing*100:.1f}%" if total_missing > 0 else "N/A")

    if dry_run:
        print("\nRun without --dry-run to apply changes")


if __name__ == '__main__':
    main()
