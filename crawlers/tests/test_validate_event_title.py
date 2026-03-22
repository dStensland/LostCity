from db import validate_event_title, infer_content_kind


def test_rejects_prefixed_weekday_month_titles():
    assert validate_event_title("23Monday, February 23") is False
    assert validate_event_title("7Tue, Mar 7") is False


def test_accepts_normal_event_titles():
    assert validate_event_title("Evensong with Concert Choir") is True
    assert validate_event_title("Atlanta Jazz Festival Opening Night") is True


# --- Permanent attraction titles pass validation (they're captured, not rejected) ---


def test_attraction_titles_pass_validation():
    """Attraction titles are valid — they get classified as exhibits downstream."""
    assert validate_event_title("Summit Skyride") is True
    assert validate_event_title("Scenic Railroad") is True
    assert validate_event_title("General Admission") is True
    assert validate_event_title("Play at the Museum") is True
    assert validate_event_title("Permanent Collection") is True


# --- infer_content_kind classifies attractions as exhibits ---


def test_infer_content_kind_attractions():
    """Known permanent attraction titles should be classified as exhibit."""
    assert infer_content_kind({"title": "Summit Skyride"}) == "exhibit"
    assert infer_content_kind({"title": "Scenic Railroad"}) == "exhibit"
    assert infer_content_kind({"title": "Dinosaur Explore"}) == "exhibit"
    assert infer_content_kind({"title": "SkyHike"}) == "exhibit"
    assert infer_content_kind({"title": "Mini Golf"}) == "exhibit"
    assert infer_content_kind({"title": "General Admission"}) == "exhibit"
    assert infer_content_kind({"title": "Play at the Museum"}) == "exhibit"
    assert infer_content_kind({"title": "Geyser Tower"}) == "exhibit"
    assert infer_content_kind({"title": "Farmyard"}) == "exhibit"
    assert infer_content_kind({"title": "4-D Theater"}) == "exhibit"
    assert infer_content_kind({"title": "Duck Adventures"}) == "exhibit"
    assert infer_content_kind({"title": "Adventure Golf"}) == "exhibit"
    assert infer_content_kind({"title": "Gemstone Mining"}) == "exhibit"
    assert infer_content_kind({"title": "Nature Playground"}) == "exhibit"
    assert infer_content_kind({"title": "Splash Pad"}) == "exhibit"
    assert infer_content_kind({"title": "Permanent Collection"}) == "exhibit"
    assert infer_content_kind({"title": "River Roots Science Stations"}) == "exhibit"
    assert infer_content_kind({"title": "Weekend Activities"}) == "exhibit"
    assert infer_content_kind({"title": "Birdseed Fundraiser Pick Up"}) == "exhibit"


def test_infer_content_kind_general_admission_regex():
    """General admission variants caught by regex."""
    assert infer_content_kind({"title": "General Admission - Adults"}) == "exhibit"
    assert infer_content_kind({"title": "general admission tickets"}) == "exhibit"


def test_infer_content_kind_daily_operation_regex():
    """Daily operation variants caught by regex."""
    assert infer_content_kind({"title": "Daily Operations"}) == "exhibit"
    assert infer_content_kind({"title": "Daily Operation Hours"}) == "exhibit"


def test_infer_content_kind_legitimate_events():
    """Titles with overlapping words that are real events stay as events."""
    assert infer_content_kind({"title": "Summit Music Festival"}) == "event"
    assert infer_content_kind({"title": "Railroad Days Festival"}) == "event"
    assert infer_content_kind({"title": "Mini Golf Tournament"}) == "event"
    assert infer_content_kind({"title": "General Assembly Keynote"}) == "event"
    assert infer_content_kind({"title": "Nature Playground Grand Opening"}) == "event"
    assert infer_content_kind({"title": "Splash Pad Party"}) == "event"


def test_infer_content_kind_explicit_override():
    """Explicit content_kind='event' is respected even for attraction titles."""
    assert infer_content_kind({"title": "Summit Skyride", "content_kind": "event"}) == "event"


def test_infer_content_kind_no_longer_auto_classifies_exhibits():
    """Exhibitions are routed by crawlers, not auto-classified from tags/signals."""
    # Tags and title keywords no longer trigger exhibit classification
    assert infer_content_kind({"title": "Foo", "tags": ["exhibit"]}) == "event"
    assert infer_content_kind({"title": "Winter Exhibition at Gallery"}) == "event"
    assert infer_content_kind({"title": "On View: Modern Art"}) == "event"
    # But explicit content_kind='exhibit' is still respected
    assert infer_content_kind({"title": "Foo", "content_kind": "exhibit"}) == "exhibit"
