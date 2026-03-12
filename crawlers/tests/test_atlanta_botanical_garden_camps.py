from sources.atlanta_botanical_garden_camps import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <h3>Enchanted Creative Garden</h3>
    <p>Step into a world of garden magic where nature sparks curiosity.</p>
    <p>Ages 5 - 7: June 1 - 5 (SOLD OUT)</p>
    <p>Ages 7 - 10: June 8 - 12 (SOLD OUT)</p>
    <p>Time : 9 a.m. - 4 p.m.</p>
    <p>Fee : $375/child (Members $350/child)</p>
    <h3>Seeds to Snacks</h3>
    <p>Taste the Garden's fresh fruits, herbs, and vegetables.</p>
    <p>Ages 9 - 12: July 6 - 10</p>
    <p>Ages 7 - 9: July 13 - 17 (SOLD OUT)</p>
    <p>Time: 9 a.m. - 4 p.m.</p>
    <p>Fee : $475/child (Members $425/child)</p>
    <p>Garden Break Camp FAQs</p>
  </body>
</html>
"""


def test_parse_rows_extracts_age_banded_sessions() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 4
    assert rows[0]["title"] == "Atlanta Botanical Garden Camp: Enchanted Creative Garden"
    assert rows[0]["age_min"] == 5
    assert rows[0]["price_min"] == 350.0
    assert rows[0]["price_max"] == 375.0
    assert rows[3]["title"] == "Atlanta Botanical Garden Camp: Seeds to Snacks"
    assert "food" in rows[3]["tags"]


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(5, 6, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["source_url"] == "https://atlantabg.org/classes-education/garden-camps/"
