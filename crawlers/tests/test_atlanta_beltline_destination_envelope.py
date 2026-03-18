from datetime import date

from sources.atlanta_beltline import _build_destination_envelope, _resolve_card_event_date


def test_build_destination_envelope_projects_family_trail_destination() -> None:
    envelope = _build_destination_envelope(2401)

    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "connected-trails-and-parks",
        "free-public-art-and-explore-stops",
    }


def test_resolve_card_event_date_keeps_same_day_in_current_year() -> None:
    assert _resolve_card_event_date("Mar", "16", now=date(2026, 3, 16)) == "2026-03-16"


def test_resolve_card_event_date_skips_past_dates_that_roll_too_far_forward() -> None:
    assert _resolve_card_event_date("Mar", "15", now=date(2026, 3, 16)) is None


def test_resolve_card_event_date_skips_implausibly_far_future_dates() -> None:
    assert _resolve_card_event_date("Mar", "15", now=date(2026, 6, 16)) is None
