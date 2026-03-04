from sources.eventbrite import _normalize_eventbrite_venue_name
from sources.mobilize_api import _normalize_mobilize_venue_name


def test_eventbrite_drops_instructional_parenthetical_suffix() -> None:
    raw = "South Peachtree Creek Trail (Course Map will be emailed)"
    assert _normalize_eventbrite_venue_name(raw) == "South Peachtree Creek Trail"


def test_eventbrite_keeps_non_instructional_parenthetical_suffix() -> None:
    raw = "The Atrium (Level 2)"
    assert _normalize_eventbrite_venue_name(raw) == "The Atrium (Level 2)"


def test_mobilize_infers_venue_from_near_clause_in_title() -> None:
    normalized = _normalize_mobilize_venue_name(
        "Meet us in the parking lot located at",
        title="Sign Waving for Shawn Harris NEAR Ben Robertson Community Center",
        address=None,
    )
    assert normalized == "Ben Robertson Community Center"


def test_mobilize_placeholder_falls_back_to_address() -> None:
    normalized = _normalize_mobilize_venue_name(
        "Meet us in the parking lot located at",
        title="Neighborhood outreach meetup",
        address="123 Main St",
    )
    assert normalized == "123 Main St"


def test_mobilize_tbd_defaults_to_generic_location() -> None:
    assert _normalize_mobilize_venue_name("TBD", title="", address=None) == "Community Location"
