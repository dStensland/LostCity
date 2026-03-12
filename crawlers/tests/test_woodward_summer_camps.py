from sources.woodward_summer_camps import (
    _build_event_record,
    _parse_csv_rows,
    _parse_rows,
    _parse_week_links,
)


LANDING_HTML = """
<html>
  <body>
    <a href="https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/edit?gid=1589715153#gid=1589715153">Week 1: May 26-29</a>
    <a href="https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/edit?gid=1475890128#gid=1475890128">Week 2: June 1-5</a>
    <a href="https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/edit?usp=sharing">Full summer offerings</a>
  </body>
</html>
"""


CSV_TEXT = """Camp Name ,Location,Director,Grades
Week 1 (May 26 - 29),,,
Golf Skills Camp (AM),Main Campus,MCGARRAH,2 to 9
Youth Football (Full Day),Main Campus,HUNT,1 to 9
Mindcraft Coding (AM),North Campus,GARDNER,3 to 7
"""


def test_parse_week_links_finds_google_sheet_week_exports() -> None:
    links = _parse_week_links(LANDING_HTML)

    assert links == [
        (
            "Week 1: May 26-29",
            "https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/export?format=csv&gid=1589715153",
        ),
        (
            "Week 2: June 1-5",
            "https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/export?format=csv&gid=1475890128",
        ),
    ]


def test_parse_csv_rows_extracts_camp_sessions() -> None:
    rows = _parse_csv_rows("Week 1 (May 26 - 29)", CSV_TEXT, "https://example.com/week1")

    assert len(rows) == 3
    assert rows[0]["title"] == "Woodward Summer Camp: Golf Skills Camp (AM)"
    assert rows[0]["start_date"] == "2026-05-26"
    assert rows[0]["end_date"] == "2026-05-29"
    assert rows[1]["is_all_day"] is True
    assert rows[1]["age_min"] == 6
    assert rows[1]["age_max"] == 14
    assert "north-campus" in rows[2]["tags"]


def test_parse_rows_combines_landing_links_with_csv_exports() -> None:
    rows = _parse_rows(
        LANDING_HTML,
        {
            "https://docs.google.com/spreadsheets/d/1q53GUbWFOccQEHdlw85PdT2gpyxwzfvSbE1nxWB7OAw/export?format=csv&gid=1589715153": CSV_TEXT
        },
    )

    assert len(rows) == 3


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_csv_rows("Week 1 (May 26 - 29)", CSV_TEXT, "https://example.com/week1")[0]
    record = _build_event_record(19, 2, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["title"].startswith("Woodward Summer Camp")
