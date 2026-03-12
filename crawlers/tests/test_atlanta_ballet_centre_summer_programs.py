from sources.atlanta_ballet_centre_summer_programs import (
    _build_event_record,
    _parse_age_range,
    _parse_dance_program_rows,
    _parse_intensive_rows,
    _parse_location_sessions,
)


SUMMER_DANCE_HTML = """
<html>
  <body>
    <h2>Summer Dance Programs - For ages 2 and up</h2>
    <p>No Audition Required</p>
    <p>Overview</p>

    <h2>Summer Creative Movement (ages 2-6)</h2>
    <p>Virginia-Highland Centre (Saturdays): June 13-July 25 Buckhead Centre (Saturdays): June 13-July 25 Students must be aged 2-6 as of June 1, 2026</p>
    <p>Creative Movement classes introduce your child to dance while developing body awareness. Each class meets for 45 minutes each week.</p>

    <h2>Dance for Joy (ages 5-7)</h2>
    <p>Virginia-Highland Centre: June 15-19 | June 22-26 Buckhead Centre: July 6-10 | July 13-17 Students must be aged 5-7 as of June 1, 2026</p>
    <p>Each week-long program meets M - F from 10:00 am to 1:00 pm and ends with an in-class performance.</p>

    <h2>Young Dancer Summer Experience (ages 8-10)</h2>
    <p>Virginia-Highland Centre: June 8-12 | June 15-19 | June 22-26 Buckhead Centre: July 6-10 | July 13-17 | July 20-24 Students must be aged 8-10 as of June 1, 2026</p>
    <p>Classes meet M - F for three hours from 10:00 am to 1:00 pm.</p>
  </body>
</html>
"""


SUMMER_INTENSIVES_HTML = """
<html>
  <body>
    <p>Ages 11 and up (as of June 22, 2026)</p>

    <h2>2026 Summer Intensives</h2>
    <p>Ages 11 and up (as of June 22, 2026)</p>
    <p>Summer Intensive 5-Week Program 5-Week Program: June 22 - July 24, 2026</p>
    <p>Summer Intensive 2-Week Program 2-Week Program: June 22 - July 3, 2026</p>
    <p>Summer Intensive 3-Week Program 3-Week Program: July 6 - July 24, 2026</p>
    <p>Dancers who attend the full programs will have the opportunity to learn repertoire and perform at the end of the program.</p>

    <h2>2026 Professional Intensive</h2>
    <p>Professional Summer Intensive 5-Week Program</p>
    <p>5-Week Program: June 22 - July 24, 2026</p>
    <p>Acceptance into this program is by invitation only from the Centre Dean or Artistic Director.</p>
    <p>Our programs offer a diverse, challenging curriculum taught by experienced and motivating faculty.</p>
  </body>
</html>
"""


def test_parse_age_range_handles_closed_and_open_ranges() -> None:
    assert _parse_age_range("Summer Creative Movement (ages 2-6)") == (2, 6)
    assert _parse_age_range("Ages 11 and up (as of June 22, 2026)") == (11, None)


def test_parse_location_sessions_handles_weekly_and_weeklong_entries() -> None:
    sessions = _parse_location_sessions(
        "Virginia-Highland Centre (Saturdays): June 13-July 25 "
        "Buckhead Centre: July 6-10 | July 13-17 "
        "Students must be aged 2-6 as of June 1, 2026",
        2026,
    )

    assert sessions[0] == {
        "venue_key": "virginia-highland centre",
        "start_date": "2026-06-13",
        "end_date": "2026-07-25",
        "is_weekly": True,
    }
    assert sessions[1]["venue_key"] == "buckhead centre"
    assert sessions[1]["start_date"] == "2026-07-06"
    assert sessions[2]["end_date"] == "2026-07-17"


def test_parse_dance_program_rows_expands_locations_and_times() -> None:
    rows = _parse_dance_program_rows(SUMMER_DANCE_HTML)

    assert len(rows) == 12
    creative = rows[0]
    dance_for_joy = rows[2]

    assert creative["title"] == "Summer Creative Movement"
    assert creative["is_recurring"] is True
    assert creative["recurrence_rule"] == "FREQ=WEEKLY;BYDAY=SA"
    assert creative["venue_data"]["name"] == "Atlanta Ballet Centre - Virginia-Highland"

    assert dance_for_joy["title"] == "Dance for Joy"
    assert dance_for_joy["start_time"] == "10:00"
    assert dance_for_joy["end_time"] == "13:00"
    assert dance_for_joy["age_min"] == 5
    assert dance_for_joy["age_max"] == 7


def test_parse_intensive_rows_extracts_main_programs() -> None:
    rows = _parse_intensive_rows(SUMMER_INTENSIVES_HTML)

    assert len(rows) == 4
    assert rows[0]["title"] == "Summer Intensive 5-Week Program"
    assert rows[0]["start_date"] == "2026-06-22"
    assert rows[0]["end_date"] == "2026-07-24"
    assert rows[-1]["title"] == "Professional Summer Intensive 5-Week Program"
    assert rows[-1]["price_note"] == "Invitation only."


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_dance_program_rows(SUMMER_DANCE_HTML)[0]
    record = _build_event_record(12, 44, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "arts"
    assert record["title"].startswith("Summer Creative Movement at Atlanta Ballet Centre")
