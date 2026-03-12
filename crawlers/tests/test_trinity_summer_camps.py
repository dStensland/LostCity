from sources.trinity_summer_camps import (
    _build_description,
    _parse_date_range,
    _parse_description_doc,
    _parse_grade_range,
    _parse_pricing_sheet,
    _parse_time_range,
)


PRICING_CSV = """Trinity Summer Camps 2026,,,
Sessions,Grade Levels,Cost,Timeframe and Lunch Information
Session 1: June 1-5,,,
Before-Camp Care,Rising Pre-K-Seventh,$60,7:30 AM-9 AM
Basketball and Flag Football Camp with Coach Cahill,Rising Second-Sixth,$340,9 AM-12 PM
Trinity Sports Camp,Rising Second-Fifth,$405,"9 AM-2 PM, includes lunch"
Session 3: June 15-18*,,,
Activities in the Afternoon,All Grades,$100,"12 PM-2 PM, includes lunch"
"""

DESCRIPTIONS_TEXT = """Session 1 | June 1-5

Basketball and Flag Football Camp with Coach Cahill
Rising Second-Sixth Grade
Monday-Friday | 9 AM-12 PM | $340
Coach Justin Cahill will lead a fun and exciting basketball and flag football combo camp.

Trinity Sports Camp
Rising Second-Fifth Grade
Monday-Friday | 9 AM-2 PM | $405, includes lunch
Campers are divided into age-appropriate groups to play hard, display sportsmanship, and have fun!

Session 3 | June 15-18

Activities in the Afternoon
All Grades
Monday-Thursday | 12 PM-2 PM | $100, includes lunch
Campers should be ready for an afternoon of fun!
"""


def test_parse_date_grade_and_time_helpers() -> None:
    assert _parse_date_range("June 15-18*", 2026) == ("2026-06-15", "2026-06-18")
    assert _parse_date_range("June 15-18* | Four-Day Camp Week", 2026) == (
        "2026-06-15",
        "2026-06-18",
    )
    assert _parse_time_range("9 AM-2 PM, includes lunch") == (
        "09:00",
        "14:00",
        "includes lunch",
    )
    assert _parse_grade_range("Rising Pre-K and Kindergarten") == (
        4,
        5,
        ["preschool", "elementary"],
    )


def test_parse_pricing_sheet_extracts_sessions() -> None:
    rows = _parse_pricing_sheet(PRICING_CSV)

    assert len(rows) == 4
    assert rows[0]["title"] == "Before-Camp Care"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[1]["title"] == "Basketball and Flag Football Camp with Coach Cahill"
    assert rows[1]["age_min"] == 7
    assert rows[1]["age_max"] == 11
    assert rows[2]["price_min"] == 405.0
    assert rows[2]["price_note"] == "includes lunch"
    assert rows[3]["start_date"] == "2026-06-15"
    assert rows[3]["end_date"] == "2026-06-18"


def test_parse_description_doc_and_build_description() -> None:
    descriptions = _parse_description_doc(DESCRIPTIONS_TEXT)
    rows = _parse_pricing_sheet(PRICING_CSV)

    row = rows[1]
    description = _build_description(row, descriptions)

    assert "Coach Justin Cahill will lead a fun and exciting basketball" in description
    assert row["session_label"] in description
