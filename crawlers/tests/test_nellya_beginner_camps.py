from bs4 import BeautifulSoup

from sources.nellya_beginner_camps import _build_event_record, _parse_rows


NELLYA_HTML = """
<html>
  <head><title>Camps &amp; Parties 2026 - Nellya Fencers Club</title></head>
  <body>
    <h3>Beginner Camps</h3>
    <span>Summer fun starts with swords! Learn the basics of sabre fencing at Georgia's most prestigious fencing club.</span>
    <h6>WEEK 1, June 1 - 5, ages 6-9</h6>
    <h6>Week 2, July 13 - 17, ages 6-9</h6>
    <h6>Week 3, July 20 - 24, ages 6-9</h6>
    <h6>Week 1, 2 &amp; 3 - $275</h6>
    <a href="https://clients.mindbodyonline.com/classic/ws?studioid=36897&stype=-101&sTG=4&sVT=6&sView=week&sLoc=0">Click Here to Register</a>
    <h5>Week 1</h5>
    <span>May 29 - June 2: 9 am - 12 pm, ages 7-10</span>
  </body>
</html>
"""


def test_parse_rows_uses_current_beginner_week_rows_only() -> None:
    rows = _parse_rows(BeautifulSoup(NELLYA_HTML, "html.parser"))

    assert len(rows) == 3
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[1]["start_date"] == "2026-07-13"
    assert rows[2]["start_date"] == "2026-07-20"
    assert rows[0]["price_min"] == 275.0
    assert rows[0]["ticket_url"].startswith("https://clients.mindbodyonline.com")


def test_parse_rows_carries_age_fit() -> None:
    rows = _parse_rows(BeautifulSoup(NELLYA_HTML, "html.parser"))

    assert rows[0]["age_min"] == 6
    assert rows[0]["age_max"] == 9
    assert "elementary" in rows[0]["tags"]


def test_build_event_record_shapes_nellya_camp() -> None:
    row = _parse_rows(BeautifulSoup(NELLYA_HTML, "html.parser"))[0]
    record = _build_event_record(9, 14, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "fitness"
    assert record["price_min"] == 275.0
    assert record["age_min"] == 6
    assert record["ticket_url"].startswith("https://clients.mindbodyonline.com")
