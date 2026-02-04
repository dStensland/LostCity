#!/usr/bin/env python3
"""
Test script for event validation layer.
Tests various validation scenarios without hitting the database.
"""

import sys
from datetime import datetime, timedelta
from db import validate_event, reset_validation_stats, get_validation_stats


def test_validation():
    """Run validation tests."""
    print("Testing Event Validation Layer")
    print("=" * 60)

    reset_validation_stats()

    # Test 1: Valid event
    print("\n1. Valid event:")
    valid_event = {
        "title": "Live Music at Terminal West",
        "description": "Great show!",
        "start_date": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(valid_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert is_valid, "Valid event should pass"

    # Test 2: Missing title
    print("\n2. Missing title:")
    no_title = {
        "title": "",
        "start_date": "2026-03-01",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(no_title)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert not is_valid, "Event without title should be rejected"
    assert "title" in reason.lower(), "Reason should mention title"

    # Test 3: Missing start_date
    print("\n3. Missing start_date:")
    no_date = {
        "title": "Test Event",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(no_date)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert not is_valid, "Event without start_date should be rejected"

    # Test 4: Invalid date format
    print("\n4. Invalid date format:")
    bad_date = {
        "title": "Test Event",
        "start_date": "03/01/2026",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(bad_date)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert not is_valid, "Event with invalid date format should be rejected"

    # Test 5: Missing source_id
    print("\n5. Missing source_id:")
    no_source = {
        "title": "Test Event",
        "start_date": "2026-03-01",
    }
    is_valid, reason, warnings = validate_event(no_source)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert not is_valid, "Event without source_id should be rejected"

    # Test 6: Title too long
    print("\n6. Title too long:")
    long_title = {
        "title": "A" * 501,
        "start_date": "2026-03-01",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(long_title)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert not is_valid, "Event with title > 500 chars should be rejected"

    # Test 7: All-caps title (should fix)
    print("\n7. All-caps title:")
    caps_event = {
        "title": "LIVE MUSIC TONIGHT",
        "start_date": "2026-03-01",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(caps_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    print(f"   Fixed title: {caps_event['title']}")
    assert is_valid, "All-caps title should be fixed and accepted"
    assert caps_event["title"] != "LIVE MUSIC TONIGHT", "Title should be converted to title case"

    # Test 8: Past date (warning only)
    print("\n8. Past date (should warn):")
    past_event = {
        "title": "Past Event",
        "start_date": (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d"),
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(past_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert is_valid, "Past event should be accepted with warning"
    assert len(warnings) > 0, "Should have warnings"

    # Test 9: Far future date (warning only)
    print("\n9. Far future date (should warn):")
    future_event = {
        "title": "Future Event",
        "start_date": (datetime.now() + timedelta(days=400)).strftime("%Y-%m-%d"),
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(future_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    assert is_valid, "Future event should be accepted with warning"
    assert len(warnings) > 0, "Should have warnings"

    # Test 10: Long description (should truncate)
    print("\n10. Long description (should truncate):")
    long_desc_event = {
        "title": "Test Event",
        "description": "A" * 6000,
        "start_date": "2026-03-01",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(long_desc_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    print(f"   Description length after: {len(long_desc_event['description'])}")
    assert is_valid, "Event with long description should be accepted"
    assert len(long_desc_event["description"]) <= 5000, "Description should be truncated"

    # Test 11: Invalid price (should null out)
    print("\n11. Invalid price:")
    bad_price_event = {
        "title": "Test Event",
        "start_date": "2026-03-01",
        "source_id": 1,
        "price_min": 50000,  # Unrealistic price
    }
    is_valid, reason, warnings = validate_event(bad_price_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    print(f"   price_min after: {bad_price_event.get('price_min')}")
    assert is_valid, "Event with bad price should be accepted"
    assert bad_price_event.get("price_min") is None, "Price should be nulled out"

    # Test 12: HTML in title (should sanitize)
    print("\n12. HTML in title:")
    html_event = {
        "title": "  <b>Live Music</b> Tonight  ",
        "description": "  <p>Join us for <strong>great</strong> music!</p>\n\n\n  ",
        "start_date": "2026-03-01",
        "source_id": 1,
    }
    is_valid, reason, warnings = validate_event(html_event)
    print(f"   Valid: {is_valid}, Reason: {reason}, Warnings: {warnings}")
    print(f"   Title: '{html_event['title']}'")
    print(f"   Description: '{html_event['description']}'")
    assert is_valid, "Event with HTML should be accepted"
    assert "<" not in html_event["title"], "HTML should be removed from title"
    assert "<" not in html_event["description"], "HTML should be removed from description"

    # Print final stats
    print("\n" + "=" * 60)
    print("VALIDATION STATISTICS:")
    print("=" * 60)
    stats = get_validation_stats()
    print(stats.get_summary())

    print("\n✓ All tests passed!")


if __name__ == "__main__":
    try:
        test_validation()
        sys.exit(0)
    except AssertionError as e:
        print(f"\n✗ Test failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"\n✗ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
