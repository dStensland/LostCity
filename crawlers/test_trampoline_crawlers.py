#!/usr/bin/env python3
"""
Quick test script to verify trampoline park crawlers are properly configured.
Tests module imports and basic structure without running full crawl.
"""

import sys
from importlib import import_module

def test_crawler_module(module_name: str, expected_venue_count: int = 1):
    """Test that a crawler module can be imported and has correct structure."""
    print(f"\n{'='*60}")
    print(f"Testing: {module_name}")
    print('='*60)

    try:
        # Import module
        module = import_module(module_name)
        print("✓ Module imported successfully")

        # Check for crawl function
        if not hasattr(module, 'crawl'):
            print("✗ ERROR: No crawl() function found")
            return False
        print("✓ crawl() function exists")

        # Check for BASE_URL or similar
        if hasattr(module, 'BASE_URL'):
            print(f"✓ BASE_URL: {module.BASE_URL}")

        # Check for venue data
        if hasattr(module, 'DEFY_VENUE'):
            print(f"✓ DEFY_VENUE: {module.DEFY_VENUE['name']}")
        elif hasattr(module, 'URBAN_AIR_LOCATIONS'):
            print(f"✓ URBAN_AIR_LOCATIONS: {len(module.URBAN_AIR_LOCATIONS)} locations")
            for loc in module.URBAN_AIR_LOCATIONS:
                print(f"  - {loc['name']} ({loc['city']})")
        elif hasattr(module, 'SKY_ZONE_LOCATIONS'):
            print(f"✓ SKY_ZONE_LOCATIONS: {len(module.SKY_ZONE_LOCATIONS)} locations")
            for loc in module.SKY_ZONE_LOCATIONS:
                print(f"  - {loc['name']} ({loc['city']})")

        # Check helper functions
        helper_functions = [
            'parse_date_from_text',
            'parse_time_from_text',
            'determine_tags',
            'extract_price_info'
        ]

        for func_name in helper_functions:
            if hasattr(module, func_name):
                print(f"✓ {func_name}() exists")
            else:
                print(f"⚠ WARNING: {func_name}() not found")

        print("\n✅ Module structure looks good!")
        return True

    except ImportError as e:
        print(f"✗ ERROR: Failed to import module: {e}")
        return False
    except Exception as e:
        print(f"✗ ERROR: {e}")
        return False


def main():
    """Test all trampoline park crawler modules."""
    print("\n" + "="*60)
    print("TRAMPOLINE PARK CRAWLER STRUCTURE TEST")
    print("="*60)

    modules_to_test = [
        ("sources.defy_atlanta", 1),
        ("sources.urban_air_atlanta", 3),
        ("sources.sky_zone_atlanta", 2),
    ]

    results = []
    for module_name, venue_count in modules_to_test:
        success = test_crawler_module(module_name, venue_count)
        results.append((module_name, success))

    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)

    all_passed = True
    for module_name, success in results:
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {module_name}")
        if not success:
            all_passed = False

    print("\n" + "="*60)
    if all_passed:
        print("✅ All crawler modules are properly structured!")
        print("\nNext steps:")
        print("1. Run database migration: 093_trampoline_parks.sql")
        print("2. Test crawlers with:")
        print("   python main.py --source defy-atlanta --dry-run")
        print("   python main.py --source urban-air-atlanta --dry-run")
        print("   python main.py --source sky-zone-atlanta --dry-run")
    else:
        print("❌ Some tests failed. Please review errors above.")
        sys.exit(1)
    print("="*60 + "\n")


if __name__ == "__main__":
    main()
