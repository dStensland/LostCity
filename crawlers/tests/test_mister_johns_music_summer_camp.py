from sources.mister_johns_music_summer_camp import (
    _build_event_record,
    _parse_weeks,
)


HTML = """
<html>
  <body>
    <p>Registration Opens for MJM Summer Camp 2026 on 1/12!</p>
    <p>Summer Camp at Mister John's Music presents 4 uniquely-crafted weeks for your 5 to 10-year-old.</p>
    <p>TIMES: Camp runs 9am-3pm, Monday through Friday. Early drop-offs at 8am and late pick-ups at 5pm are available for additional fees.</p>
    <p>COST - $425/camper per 5-day week (shorter weeks are prorated)</p>
    <p>Early-arrival - $50/camper per week</p>
    <p>Late pick-up - $100/camper per week</p>
    <p>Week 1: 6/8-6/12 - Witches and Wizards - All the Wicked, All the Hufflepuffs!</p>
    <p>Week 2: 6/22-6/26 - Taylor Swift!</p>
    <p>Week 3: 7/13-7/17 - K Pop Demon Hunters</p>
    <p>Week 4: 7/20-7/24 - K Pop Demon Hunters (the remix!)</p>
    <p>Summer Camp is held at our Avondale Estates location at Olive and Pine 6 Olive Street, Avondale Estates, GA 30002</p>
  </body>
</html>
"""


def test_parse_weeks_extracts_four_2026_rows() -> None:
    rows = _parse_weeks(HTML)

    assert len(rows) == 4
    assert rows[0]["title"] == "Mister John's Music Summer Camp: Witches and Wizards - All the Wicked, All the Hufflepuffs!"
    assert rows[0]["start_date"] == "2026-06-08"
    assert rows[0]["end_date"] == "2026-06-12"
    assert rows[0]["price_min"] == 425.0
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 10
    assert rows[0]["start_time"] == "09:00"
    assert rows[0]["end_time"] == "15:00"


def test_parse_weeks_derives_theme_tags() -> None:
    rows = _parse_weeks(HTML)

    assert "taylor-swift" in rows[1]["tags"]
    assert "k-pop" in rows[2]["tags"]
    assert "themed-camp" in rows[0]["tags"]


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_weeks(HTML)[0]
    record = _build_event_record(9, 21, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "arts"
    assert record["title"].startswith("Mister John's Music Summer Camp:")
    assert record["ticket_url"] == row["source_url"]
