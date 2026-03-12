from sources.georgia_stand_up import (
    _body_has_no_events,
    _parse_date,
    _parse_time,
)


def test_body_has_no_events_detects_wix_empty_state():
    assert _body_has_no_events("Volunteer\nEvents\nNo events at the moment\nDonate")


def test_parse_date_handles_long_month_format():
    assert _parse_date("Friday, March 14, 2026") == "2026-03-14"


def test_parse_time_handles_ampm():
    assert _parse_time("6:30 PM") == "18:30"
