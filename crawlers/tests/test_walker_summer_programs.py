from bs4 import BeautifulSoup

from sources.walker_summer_programs import (
    _build_event_record,
    _parse_date_range,
    _parse_grade_range,
    _parse_tables,
    _parse_time_range,
)


WALKER_HTML = """
<h5>PRIMARY SCHOOL SUMMER CAMPS</h5>
<table>
  <tr><th>Full Day Camps</th></tr>
  <tr><td>
    <p>Primary School Full Day Camp<br/>
    <strong>Week 1</strong>: June 1-5 - Blast Off to Outer Space &amp; Summer Fun<br/>
    <strong>Week 2</strong>: June 8-12 - Under the Sea</p>
    <p><strong>Camp hours: </strong>9 a.m. to 4 p.m.</p>
  </td></tr>
  <tr><th>Primary school bonus 8th week</th></tr>
  <tr><td><p>Week 8: Magic and Science</p><p><strong>Camp hours: </strong>9 a.m. to 4 p.m.</p></td></tr>
  <tr><th>AUG. 3-6, Walker Cheer Camp, 9 a.m. - 12 p.m. (Grades K-5)</th></tr>
  <tr><td><p>Cheer Camp description.</p><p><strong>Camp Leader:</strong> Beth Moore</p></td></tr>
</table>
<h5>LOWER SCHOOL SUMMER CAMPS</h5>
<table>
  <tr><th>Summer Explorers</th></tr>
  <tr><td>
    <p>Register Today</p>
    <p>June 1-5<br/>June 8-12</p>
    <p>The Summer Explorers Day Camp offers a week filled with fun and adventures.</p>
  </td></tr>
  <tr><th>June 1-5 - Fun and Games, 9 a.m. - 12 p.m. (Grades 1-5)</th></tr>
  <tr><td><p>Games description.</p><p><strong>Camp Leader:</strong> Julio Barrios</p></td></tr>
  <tr><th>June 8-12 - Creative Engineering (Grades 4-8)</th></tr>
  <tr><td><p>Creative engineering description.</p><p><strong>Camp hours:</strong> 1 - 4 p.m.</p></td></tr>
</table>
<h5>MIDDLE SCHOOL SUMMER CAMPS</h5>
<table>
  <tr><th>June 1-5 - Fun and Games, 9 a.m. - 12 p.m. (Grades 1-5)</th></tr>
  <tr><td><p>Duplicate listing in another section.</p></td></tr>
</table>
"""


def test_parse_date_grade_and_time_helpers() -> None:
    assert _parse_date_range("Aug. 3-6", 2026) == ("2026-08-03", "2026-08-06")
    assert _parse_time_range("9 a.m. - 12 p.m.") == ("09:00", "12:00", False)
    assert _parse_time_range("1 - 4 p.m.") == ("13:00", "16:00", False)
    assert _parse_time_range("FULL DAY") == (None, None, True)
    assert _parse_grade_range("Grades K-5") == (
        5,
        10,
        ["preschool", "elementary", "tween"],
    )


def test_parse_tables_expands_multiweek_and_dedupes_generic_rows() -> None:
    rows = _parse_tables(BeautifulSoup(WALKER_HTML, "html.parser"))

    titles = [row["title"] for row in rows]
    assert len(rows) == 8
    assert (
        "Primary School Full Day Camp: Blast Off to Outer Space & Summer Fun" in titles
    )
    assert "Primary School Full Day Camp: Under the Sea" in titles
    assert "Primary School Full Day Camp: Magic and Science" in titles
    assert titles.count("Summer Explorers") == 2
    assert titles.count("Fun and Games") == 1
    creative = next(row for row in rows if row["title"] == "Creative Engineering")
    assert creative["start_time"] == "13:00"
    assert creative["end_time"] == "16:00"


def test_build_event_record_for_generic_walker_row() -> None:
    row = {
        "title": "Fun and Games",
        "section": "Lower School Summer Camps",
        "description": "Fun and Games Games description. Camp leader: Julio Barrios.",
        "start_date": "2026-06-01",
        "end_date": "2026-06-05",
        "start_time": "09:00",
        "end_time": "12:00",
        "is_all_day": False,
        "age_min": 6,
        "age_max": 10,
        "tags": [
            "kids",
            "family-friendly",
            "educational",
            "seasonal",
            "rsvp-required",
            "elementary",
        ],
        "class_category": "education",
        "price_min": None,
        "price_max": None,
        "price_note": None,
    }

    record = _build_event_record(14, 24, row)

    assert record["title"] == "Fun and Games"
    assert (
        record["ticket_url"] == "https://walkersummerprograms.campbrainregistration.com"
    )
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
