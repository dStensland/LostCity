from sources.mobilize_api import (
    _haversine_miles,
    _is_in_atlanta_metro,
    infer_civic_process_tags,
)


# ---------------------------------------------------------------------------
# _haversine_miles
# ---------------------------------------------------------------------------


def test_haversine_miles_same_point_is_zero() -> None:
    dist = _haversine_miles(33.749, -84.388, 33.749, -84.388)
    assert dist == 0.0


def test_haversine_miles_downtown_to_marietta_is_roughly_17mi() -> None:
    # Marietta, GA is approximately 16-18 miles NW of downtown Atlanta
    dist = _haversine_miles(33.749, -84.388, 33.9526, -84.5499)
    assert 14 <= dist <= 20


def test_haversine_miles_downtown_to_nyc_is_roughly_746mi() -> None:
    dist = _haversine_miles(33.749, -84.388, 40.7128, -74.006)
    assert 730 <= dist <= 770


# ---------------------------------------------------------------------------
# _is_in_atlanta_metro
# ---------------------------------------------------------------------------


def test_is_in_atlanta_metro_accepts_downtown_coordinates() -> None:
    # Exactly downtown Atlanta
    assert _is_in_atlanta_metro(33.749, -84.388, "") is True


def test_is_in_atlanta_metro_accepts_decatur_coordinates() -> None:
    # Decatur is ~5 miles from downtown
    assert _is_in_atlanta_metro(33.7748, -84.2963, "30030") is True


def test_is_in_atlanta_metro_rejects_coordinates_far_away() -> None:
    # Macon, GA is ~75 miles south — outside 40-mile org pass radius
    assert _is_in_atlanta_metro(32.8407, -83.6324, "31201") is False


def test_is_in_atlanta_metro_accepts_borderline_40mi_within() -> None:
    # Monroe, GA (Boldly Blue) — ~38 miles from downtown
    assert _is_in_atlanta_metro(33.7940, -83.7135, "30655") is True


def test_is_in_atlanta_metro_rejects_coordinate_just_outside_radius() -> None:
    # Athens, GA is ~58 miles from downtown
    assert _is_in_atlanta_metro(33.9519, -83.3576, "30601") is False


def test_is_in_atlanta_metro_accepts_ga_zip_when_no_coordinates() -> None:
    # Private-address events have no lat/lng but have GA zip starting with '30'
    assert _is_in_atlanta_metro(None, None, "30307") is True


def test_is_in_atlanta_metro_accepts_ga_zip_zero_coordinates() -> None:
    # Zero lat/lng treated same as None (falsy)
    assert _is_in_atlanta_metro(0.0, 0.0, "30316") is True


def test_is_in_atlanta_metro_rejects_non_ga_zip_no_coordinates() -> None:
    # Non-GA zip with no coordinates should be rejected
    assert _is_in_atlanta_metro(None, None, "10001") is False  # NYC zip


def test_is_in_atlanta_metro_rejects_empty_zip_no_coordinates() -> None:
    assert _is_in_atlanta_metro(None, None, "") is False


# ---------------------------------------------------------------------------
# infer_civic_process_tags
# ---------------------------------------------------------------------------


def test_infer_civic_process_tags_marks_fulton_elections_meeting() -> None:
    tags = infer_civic_process_tags(
        "Fulton County: Join us for the Board of Registrations and Elections Meeting",
        "Join us to monitor election administration and support voters.",
    )

    assert "government" in tags
    assert "public-meeting" in tags
    assert "election" in tags


def test_infer_civic_process_tags_marks_school_board_event() -> None:
    tags = infer_civic_process_tags(
        "Public School Strong: Atlanta School Board Meeting",
        "Show up at the school board meeting to support public schools.",
    )

    assert "school-board" in tags
    assert "government" in tags
    assert "public-meeting" in tags


def test_infer_civic_process_tags_adds_jurisdiction_tags() -> None:
    tags = infer_civic_process_tags(
        "Join the Fulton County Board of Commissioners Meetings",
        "Learn how to show up for Fulton County government process.",
    )

    assert "government" in tags
    assert "public-meeting" in tags
    assert "fulton" in tags


def test_infer_civic_process_tags_is_empty_for_general_activist_event() -> None:
    tags = infer_civic_process_tags(
        "Hands Off Africa March and Rally",
        "Join the rally downtown.",
    )

    assert tags == []
