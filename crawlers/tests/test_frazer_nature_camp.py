from sources.frazer_nature_camp import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <h3>Inclusion Nature-Based Camps for rising Kindergarteners/1st Graders (ages 4-6)</h3>
    <p>Every day of Frazer's Nature Camp brings new adventures rooted in discovery, inclusion, and fun!</p>
    <p>Campers explore the wonders of Frazer Forest and Cator Woolford Gardens.</p>
    <p>Session 1: May 27-29, 2026* • 8am-5:30pm Session 2: June 1-5, 2026 • 8am-5:30pm Session 3: July 20-24, 2025 • 8am-5:30pm</p>
  </body>
</html>
"""


def test_parse_rows_extracts_sessions_and_holiday_pricing() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 3
    assert rows[0]["title"] == "Frazer Nature Camp Session 1"
    assert rows[0]["price_min"] is None
    assert rows[1]["price_min"] == 420.0
    assert rows[2]["start_date"] == "2026-07-20"
    assert rows[2]["age_min"] == 4


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[1]
    record = _build_event_record(3, 4, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["ticket_url"].startswith("https://thefrazercenter.formstack.com/")
