#!/usr/bin/env python3
"""
Test script for Atlanta Parks & Recreation crawler.
Tests the crawler logic without requiring database access.
"""

import sys
import re

# Test the parsing functions
def test_parse_time():
    """Test time parsing."""
    print("\n" + "=" * 70)
    print("Testing time parsing")
    print("=" * 70)

    # Import after path is set
    from sources.atlanta_parks_rec import parse_time

    test_cases = [
        ("7:00 PM", "19:00"),
        ("07:30 AM", "07:30"),
        ("12:00 PM", "12:00"),
        ("12:30 AM", "00:30"),
        ("11:59 PM", "23:59"),
        ("invalid", None),
    ]

    passed = 0
    for input_str, expected in test_cases:
        result = parse_time(input_str)
        status = "PASS" if result == expected else "FAIL"
        print(f"  [{status}] {input_str:15} -> {result} (expected: {expected})")
        if result == expected:
            passed += 1

    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_parse_date():
    """Test date parsing."""
    print("\n" + "=" * 70)
    print("Testing date parsing")
    print("=" * 70)

    from sources.atlanta_parks_rec import parse_date

    test_cases = [
        "January 25, 2026",
        "February 15",
        "2/20/2026",
        "March 1",
    ]

    passed = 0
    for date_str in test_cases:
        result = parse_date(date_str)
        # Just check that we got a valid date format back
        is_valid = result and re.match(r"\d{4}-\d{2}-\d{2}", result)
        status = "PASS" if is_valid else "FAIL"
        print(f"  [{status}] {date_str:20} -> {result}")
        if is_valid:
            passed += 1

    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_event_filtering():
    """Test Parks/Recreation event detection."""
    print("\n" + "=" * 70)
    print("Testing Parks/Recreation event filtering")
    print("=" * 70)

    from sources.atlanta_parks_rec import is_parks_recreation_event

    test_cases = [
        ("Youth Basketball League", "After-school basketball program", True),
        ("City Council Meeting", "Discuss zoning ordinance", False),
        ("Yoga in the Park", "Free outdoor fitness class at Piedmont Park", True),
        ("Senior Fitness Class", "Recreation center fitness program", True),
        ("Budget Hearing", "Annual budget presentation", False),
        ("Community Picnic", "Family fun day at Grant Park", True),
        ("Permit Application", "Special events permit process", False),
        ("Swimming Lessons", "Youth aquatics program", True),
    ]

    passed = 0
    for title, desc, should_match in test_cases:
        result = is_parks_recreation_event(title, desc)
        status = "PASS" if result == should_match else "FAIL"
        match_str = "MATCH" if result else "SKIP"
        print(f"  [{status}] [{match_str}] {title}")
        if result == should_match:
            passed += 1

    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_categorization():
    """Test event categorization."""
    print("\n" + "=" * 70)
    print("Testing event categorization")
    print("=" * 70)

    from sources.atlanta_parks_rec import categorize_event

    test_cases = [
        ("Youth Basketball", "Kids sports program", "sports"),
        ("Yoga Class", "Outdoor fitness at the park", "sports"),
        ("Senior Bingo", "Social activity for seniors", "community"),
        ("Family Fun Day", "Kids activities and games", "community"),
        ("Nature Walk", "Guided hike through the park", "community"),
    ]

    passed = 0
    for title, desc, expected_category in test_cases:
        category, subcategory, tags = categorize_event(title, desc)
        status = "PASS" if category == expected_category else "FAIL"
        print(f"  [{status}] {title}")
        print(f"         Category: {category} (expected: {expected_category})")
        print(f"         Subcategory: {subcategory}")
        print(f"         Tags: {', '.join(tags)}")
        if category == expected_category:
            passed += 1

    print(f"\nPassed: {passed}/{len(test_cases)}")
    return passed == len(test_cases)


def test_calendar_fetch():
    """Test fetching the calendar page."""
    print("\n" + "=" * 70)
    print("Testing calendar page fetch")
    print("=" * 70)

    import requests
    from bs4 import BeautifulSoup

    url = "https://www.atlantaga.gov/Home/Components/Calendar/Event/Index"

    try:
        print(f"Fetching: {url}")
        response = requests.get(
            url,
            headers={"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"},
            timeout=15
        )
        print(f"Status: {response.status_code}")

        if response.status_code != 200:
            print("  [FAIL] Non-200 status code")
            return False

        soup = BeautifulSoup(response.text, "html.parser")
        event_links = soup.find_all("a", href=lambda x: x and "/Home/Components/Calendar/Event/" in x and x.count('/') >= 5)

        print(f"Found {len(event_links)} event links")

        if len(event_links) == 0:
            print("  [FAIL] No event links found")
            return False

        print("\nFirst 5 events:")
        for i, link in enumerate(event_links[:5], 1):
            href = link.get("href")
            text = link.get_text(strip=True)[:60]
            print(f"  {i}. {text}")
            print(f"     URL: {href}")

        print("\n  [PASS] Calendar page fetched successfully")
        return True

    except Exception as e:
        print(f"  [FAIL] Error: {e}")
        return False


def main():
    """Run all tests."""
    print("\n" + "=" * 70)
    print("Atlanta Parks & Recreation Crawler Tests")
    print("=" * 70)

    results = []

    # Run tests
    results.append(("Time Parsing", test_parse_time()))
    results.append(("Date Parsing", test_parse_date()))
    results.append(("Event Filtering", test_event_filtering()))
    results.append(("Categorization", test_categorization()))
    results.append(("Calendar Fetch", test_calendar_fetch()))

    # Summary
    print("\n" + "=" * 70)
    print("Test Summary")
    print("=" * 70)

    passed = sum(1 for _, result in results if result)
    total = len(results)

    for name, result in results:
        status = "PASS" if result else "FAIL"
        print(f"  [{status}] {name}")

    print(f"\nTotal: {passed}/{total} test groups passed")

    if passed == total:
        print("\nAll tests passed! Crawler is ready to use.")
        print("\nNext steps:")
        print("1. Run database migration: database/migrations/053_parks_family_sources.sql")
        print("2. Test crawler: python main.py -s atlanta-parks-rec")
        return 0
    else:
        print("\nSome tests failed. Please review the errors above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
