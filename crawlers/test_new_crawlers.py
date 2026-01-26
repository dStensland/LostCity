#!/usr/bin/env python3
"""
Quick test script for new university/community crawlers.
Tests crawlers without requiring database access.
"""

import sys
import logging
from sources import georgia_state_university, georgia_tech_arts, emory_schwartz_center, ymca_atlanta

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


def test_crawler(crawler_module, source_name):
    """Test a crawler module."""
    print(f"\n{'='*60}")
    print(f"Testing: {source_name}")
    print('='*60)

    # Mock source dict
    mock_source = {
        'id': 999,
        'slug': 'test',
        'name': source_name,
    }

    try:
        found, new, updated = crawler_module.crawl(mock_source)
        print(f"✓ Success: {found} events found, {new} new, {updated} updated")
        return True
    except Exception as e:
        print(f"✗ Failed: {e}")
        logger.exception(f"Error testing {source_name}")
        return False


def main():
    """Run tests for all new crawlers."""
    crawlers = [
        (georgia_state_university, "Georgia State University"),
        (georgia_tech_arts, "Georgia Tech Arts"),
        (emory_schwartz_center, "Emory Schwartz Center"),
        (ymca_atlanta, "YMCA Atlanta"),
    ]

    results = []
    for module, name in crawlers:
        success = test_crawler(module, name)
        results.append((name, success))

    # Summary
    print(f"\n{'='*60}")
    print("TEST SUMMARY")
    print('='*60)
    for name, success in results:
        status = "✓ PASS" if success else "✗ FAIL"
        print(f"{status}: {name}")

    total = len(results)
    passed = sum(1 for _, success in results if success)
    print(f"\nTotal: {passed}/{total} passed")

    return 0 if passed == total else 1


if __name__ == "__main__":
    sys.exit(main())
