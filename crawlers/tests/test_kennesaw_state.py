from sources.kennesaw_state import (
    _clean_description,
    _parse_ovation_datetime,
    _should_skip_production,
)


def test_parse_ovation_datetime_parses_date_and_time():
    start_date, start_time = _parse_ovation_datetime("2026-03-20 18:00")

    assert start_date == "2026-03-20"
    assert start_time == "18:00"


def test_clean_description_strips_html_and_collapses_whitespace():
    text = _clean_description("<div>Hello <strong>world</strong><br />  from   KSU</div>")

    assert text == "Hello world from KSU"


def test_should_skip_production_skips_generic_admission_but_not_opening():
    assert _should_skip_production("Spring 2026 Zuckerman Museum of Art Admission") is True
    assert _should_skip_production("Spring 2026 SOAAD Capstone Exhibition I Opening Reception") is False
