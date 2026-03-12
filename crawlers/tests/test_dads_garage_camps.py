from bs4 import BeautifulSoup

from sources.dads_garage_camps import (
    _build_event_record,
    _parse_date_range,
    _parse_sections,
)


DADS_GARAGE_HTML = """
<h3>May-July for rising grades 3-6 and 7-12!</h3>
<p>All camps are five days (Monday-Friday), last from 9 a.m. to 3 p.m., and include a Friday showcase for friends and family to join in the laughter!</p>
<p><strong>Drop-off is at 8:50 a.m. Pick up is at 3 p.m.</strong></p>
<h4><strong>Kids’ Camps (rising grades 3-6)</strong></h4>
<p><a href="https://dadsgarage.my.salesforce-sites.com/ticket/#/instances/kids1">Week 1: May 26-29 - Improv</a></p>
<p><a href="https://dadsgarage.my.salesforce-sites.com/ticket/#/instances/kids2">Week 2: June 1-5 - Comedy Bootcamp</a></p>
<h4><strong>Teen Camps (rising grades 7-12)</strong></h4>
<p><a href="https://dadsgarage.my.salesforce-sites.com/ticket/#/instances/teen1">Week 1: May 26-29 - Improv</a></p>
<p><a href="https://dadsgarage.my.salesforce-sites.com/ticket/#/instances/teen2">Week 2: June 1-5 - Comedy Bootcamp</a></p>
"""


def test_parse_date_range_handles_same_month_and_cross_month() -> None:
    assert _parse_date_range("June 1-5", 2026) == ("2026-06-01", "2026-06-05")
    assert _parse_date_range("June 29-July 3", 2026) == ("2026-06-29", "2026-07-03")


def test_parse_sections_extracts_kids_and_teen_rows() -> None:
    rows = _parse_sections(BeautifulSoup(DADS_GARAGE_HTML, "html.parser"))

    assert len(rows) == 4
    assert rows[0]["title"] == "Improv"
    assert rows[0]["grade_text"] == "rising grades 3-6"
    assert rows[2]["grade_text"] == "rising grades 7-12"
    assert rows[1]["ticket_url"].endswith("kids2")
    assert rows[3]["ticket_url"].endswith("teen2")


def test_build_event_record_shapes_dads_garage_camp() -> None:
    row = _parse_sections(BeautifulSoup(DADS_GARAGE_HTML, "html.parser"))[0]
    record = _build_event_record(7, 11, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "mixed"
    assert record["ticket_url"].endswith("kids1")
    assert record["age_min"] == 8
    assert record["age_max"] == 12
