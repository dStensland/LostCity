from sources.open_hand_atlanta import (
    _determine_category,
    _extract_tags,
    _clean_description,
    _format_time,
    _format_time_label,
)


def test_determine_category_defaults_to_community():
    assert _determine_category("Delivery Driver Volunteer") == "community"


def test_determine_category_detects_learning():
    assert _determine_category("Building Tours") == "learning"
    assert _determine_category("Orientation Training") == "learning"


def test_extract_tags_always_includes_base_tags():
    tags = _extract_tags("Some random role")
    assert "volunteer" in tags
    assert "volunteer-opportunity" in tags
    assert "open-hand-atlanta" in tags


def test_extract_tags_detects_delivery():
    tags = _extract_tags("Delivery Driver Volunteer")
    assert "delivery" in tags


def test_extract_tags_detects_food():
    tags = _extract_tags("AM Meal Packing")
    assert "food" in tags


def test_clean_description_normalizes_whitespace():
    raw = "Line one.\r\n\r\n\r\nLine two.   Extra  spaces."
    result = _clean_description(raw)
    assert "\r\n" not in result
    assert "\n\n\n" not in result
    assert "  " not in result


def test_format_time():
    # March 23 2026 07:00 EDT = 1742731200 (approximate, depends on TZ)
    # Use a known timestamp instead
    import time as _time
    from datetime import datetime

    dt = datetime(2026, 3, 23, 7, 0, 0)
    ts = int(dt.timestamp())
    assert _format_time(ts) == "07:00"


def test_format_time_label():
    from datetime import datetime

    dt = datetime(2026, 3, 23, 7, 0, 0)
    ts = int(dt.timestamp())
    label = _format_time_label(ts)
    assert "7:00" in label
    assert "AM" in label
