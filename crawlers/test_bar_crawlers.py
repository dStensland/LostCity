#!/usr/bin/env python3
"""
Test script for activated Atlanta bar/nightlife crawlers.
"""

import sys
import time
from utils import setup_logging
from main import run_source

# List of all activated bar sources
BAR_SOURCES = [
    'joystick-gamebar',
    'opera-nightclub',
    'sound-table',
    'brick-store-pub',
    'our-bar-atl',
]

def test_crawler(slug: str) -> tuple[bool, str]:
    """Test a single crawler. Returns (success, message)."""
    print(f"\n{'=' * 60}")
    print(f"Testing: {slug}")
    print('=' * 60)

    try:
        success = run_source(slug, skip_circuit_breaker=True)
        if success:
            return True, f"✓ {slug} succeeded"
        else:
            return False, f"✗ {slug} failed (see logs above)"
    except Exception as e:
        return False, f"✗ {slug} crashed: {str(e)}"


def main():
    """Test all activated bar crawlers."""
    setup_logging()

    print("\n" + "=" * 60)
    print("TESTING ACTIVATED ATLANTA BAR CRAWLERS")
    print("=" * 60)

    results = []

    for slug in BAR_SOURCES:
        success, message = test_crawler(slug)
        results.append((slug, success, message))
        # Brief pause between tests
        time.sleep(2)

    # Summary
    print("\n\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)

    passed = 0
    failed = 0

    for slug, success, message in results:
        print(message)
        if success:
            passed += 1
        else:
            failed += 1

    print("\n" + "=" * 60)
    print(f"Passed: {passed}/{len(BAR_SOURCES)}")
    print(f"Failed: {failed}/{len(BAR_SOURCES)}")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
