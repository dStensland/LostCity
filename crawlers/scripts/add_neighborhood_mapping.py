#!/usr/bin/env python3
"""
Add new neighborhood mappings to the fix_neighborhoods.py script.

This utility helps you add new lat/lng boundaries or ZIP code mappings
without manually editing the script.
"""

import sys

def print_usage():
    print("Usage:")
    print("  python3 add_neighborhood_mapping.py lat <name> <min_lat> <max_lat> <min_lng> <max_lng>")
    print("  python3 add_neighborhood_mapping.py zip <zip_code> <neighborhood>")
    print()
    print("Examples:")
    print('  python3 add_neighborhood_mapping.py lat "East Lake" 33.755 33.770 -84.315 -84.300')
    print('  python3 add_neighborhood_mapping.py zip 30307 "Little Five Points"')
    print()

def add_lat_lng_boundary():
    if len(sys.argv) < 7:
        print("Error: Missing arguments for lat/lng boundary")
        print_usage()
        return

    name = sys.argv[2]
    min_lat = float(sys.argv[3])
    max_lat = float(sys.argv[4])
    min_lng = float(sys.argv[5])
    max_lng = float(sys.argv[6])

    print(f'\nAdd this to NEIGHBORHOOD_BOUNDARIES in fix_neighborhoods.py:')
    print(f'    "{name}": ({min_lat}, {max_lat}, {min_lng}, {max_lng}),')
    print()

def add_zip_mapping():
    if len(sys.argv) < 4:
        print("Error: Missing arguments for ZIP mapping")
        print_usage()
        return

    zip_code = sys.argv[2]
    neighborhood = sys.argv[3]

    print(f'\nAdd this to ZIP_TO_NEIGHBORHOOD in fix_neighborhoods.py:')
    print(f'    "{zip_code}": "{neighborhood}",')
    print()

def main():
    if len(sys.argv) < 2:
        print_usage()
        return

    command = sys.argv[1].lower()

    if command == 'lat':
        add_lat_lng_boundary()
    elif command == 'zip':
        add_zip_mapping()
    else:
        print(f"Error: Unknown command '{command}'")
        print_usage()

if __name__ == '__main__':
    main()
