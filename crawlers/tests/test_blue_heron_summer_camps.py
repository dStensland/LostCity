from sources.blue_heron_summer_camps import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <h4>Little Blue Herons (4-6 yrs.)</h4>
    <p>Half Day (9am - 1pm): $295/ week Full Day (9am - 4pm): $425/ week</p>
    <h3>GBH JUNE DETAILS:</h3>
    <h4>Great Blue Herons (7-12 yrs.)</h4>
    <p>Full Day (9am - 4pm): $425/Week</p>
    <h2>Bringing Back the Favorites During June!</h2>
    <p>WEEK 1: Creek Week, June 1st - June 5th</p>
    <h3>June 1st - June 5th</h3>
    <p>Cool off this summer with water games and creek exploration.</p>
    <h2>New and Exciting Themes in July!</h2>
    <p>WEEK 5: Diggin' in the Dirt, July 6th - July 10th</p>
    <h3>July 6th - July 10th</h3>
    <p>Campers will dig, scoop, plant and investigate soil and worms.</p>
    <h2>New Opportunities at Great Blue Heron Outdoor Skills Camp!</h2>
    <p>WEEK 1: Introduction to Wilderness Skills, July 6th - July 10th</p>
    <h3>July 6th - July 10th</h3>
    <p>Learn shelter building, basic safety practices, and wildlife awareness.</p>
  </body>
</html>
"""


def test_parse_rows_expands_track_variants() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 4
    assert rows[0]["title"] == "Blue Heron Summer Camp - Great Blue Herons: Creek Week"
    assert rows[0]["age_min"] == 7
    assert rows[1]["title"] == "Blue Heron Summer Camp - Little Blue Herons: Creek Week"
    assert rows[1]["price_min"] == 295.0
    assert rows[2]["title"] == "Blue Heron Summer Camp - Great Blue Heron Outdoor Skills: Introduction to Wilderness Skills"
    assert "adventure" in rows[2]["tags"]
    assert rows[3]["title"] == "Blue Heron Summer Camp - Little Blue Herons: Diggin' in the Dirt"


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(11, 22, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["source_url"] == "https://bhnp.org/summer-camps/"
