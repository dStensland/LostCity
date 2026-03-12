from sources.spruill_summer_camps import (
    _build_event_record,
    _parse_course_links,
    _parse_detail_row,
    _parse_rows,
)


LANDING_HTML = """
<html>
  <body>
    <a href="https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01CAMP">Register</a>
    <a href="https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01SPCA">Register</a>
    <a href="https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=262YCSBC">Spring Break</a>
  </body>
</html>
"""


KIDS_DETAIL_HTML = """
<html>
  <head>
    <title>WEEK 1: Under the Sea (Ages 5-10) *4-Day Camp - 26C01CAMP - Spruill Center for the Arts</title>
  </head>
  <body>
    <table>
      <tr><th>Fee:</th><td>$300.00</td></tr>
      <tr><th>Date</th><th>Time</th></tr>
      <tr><td>05/26/2026</td><td>9:30 AM to 3 PM</td></tr>
      <tr><td>05/29/2026</td><td>9:30 AM to 3 PM</td></tr>
    </table>
  </body>
</html>
"""


TEEN_DETAIL_HTML = """
<html>
  <head>
    <title>WEEK 4: Ceramics (2-Week Intensive, Rising 6th-9th Graders) - 26C04SPCE - Spruill Center for the Arts</title>
  </head>
  <body>
    <table>
      <tr><th>Fee:</th><td>$425.00</td></tr>
      <tr><th>Date</th><th>Time</th></tr>
      <tr><td>06/15/2026</td><td>1:00 PM to 4:30 PM</td></tr>
      <tr><td>06/26/2026</td><td>1:00 PM to 4:30 PM</td></tr>
    </table>
  </body>
</html>
"""


INVALID_DETAIL_HTML = """
<html>
  <head><title>Not a Valid Course - Spruill Center for the Arts</title></head>
  <body></body>
</html>
"""


def test_parse_course_links_filters_to_summer_course_status_urls() -> None:
    urls = _parse_course_links(LANDING_HTML)

    assert urls == [
        "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01CAMP",
        "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01SPCA",
    ]


def test_parse_detail_row_extracts_kids_camp_fields() -> None:
    row = _parse_detail_row(
        "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01CAMP",
        KIDS_DETAIL_HTML,
    )

    assert row is not None
    assert row["title"] == "Spruill Summer Camp: WEEK 1: Under the Sea (Ages 5-10) *4-Day Camp"
    assert row["start_date"] == "2026-05-26"
    assert row["end_date"] == "2026-05-29"
    assert row["price_min"] == 300.0
    assert row["age_min"] == 5
    assert row["age_max"] == 10


def test_parse_detail_row_maps_rising_grade_intensive_to_age_band() -> None:
    row = _parse_detail_row(
        "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C04SPCE",
        TEEN_DETAIL_HTML,
    )

    assert row is not None
    assert row["start_date"] == "2026-06-15"
    assert row["end_date"] == "2026-06-26"
    assert row["age_min"] == 11
    assert row["age_max"] == 15
    assert "teen" in row["tags"]


def test_parse_rows_skips_invalid_course_pages() -> None:
    rows = _parse_rows(
        LANDING_HTML,
        {
            "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01CAMP": KIDS_DETAIL_HTML,
            "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01SPCA": INVALID_DETAIL_HTML,
        },
    )

    assert len(rows) == 1


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_detail_row(
        "https://registration.spruillarts.org/wconnect/CourseStatus.awp?course=26C01CAMP",
        KIDS_DETAIL_HTML,
    )
    assert row is not None
    record = _build_event_record(77, 12, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "arts"
    assert record["title"].startswith("Spruill Summer Camp")
