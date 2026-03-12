from sources.fernbank_summer_camp import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <h2>2026 Summer Camps</h2>
    <p>June 1 - July 31, 2026</p>
    <p>Fernbank’s Summer Camp runs Monday through Friday from 9 a.m. to 4 p.m.</p>
    <p>Extended care is available as early as 8:15 a.m. and as late as 5:30 p.m. each week. Extended care is $100 for the week.</p>
    <p>Cost: $330 for members; $380 for nonmembers.</p>
    <p>Camp groups are divided into ages 5-7 and ages 8-10.</p>
    <p>Themes repeat weekly, so we encourage you to select the week that best meets your summer needs.</p>
  </body>
</html>
"""


def test_parse_rows_generates_weekly_age_group_sessions() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 18
    assert rows[0]["title"] == "Fernbank Summer Camp (Ages 5-7)"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[0]["end_date"] == "2026-06-05"
    assert rows[1]["title"] == "Fernbank Summer Camp (Ages 8-10)"
    assert rows[-1]["start_date"] == "2026-07-27"
    assert rows[-1]["end_date"] == "2026-07-31"
    assert rows[0]["price_min"] == 330.0
    assert rows[0]["price_max"] == 380.0


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(18, 2, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["title"].startswith("Fernbank Summer Camp")
