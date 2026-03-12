from sources.greater_atlanta_christian_specialty_camps import (
    _build_event_record,
    _parse_rows,
)


HTML = """
<html>
  <body>
    <a class="fsTagLink fsStyleDefaultButton" data-tag-id="193" href="#">June 1-5</a>
    <a class="fsTagLink fsStyleDefaultButton" data-tag-id="197" href="#">June 22-26</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="86" href="#">1st</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="87" href="#">2nd</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="91" href="#">6th-8th</a>
    <div class="fsListItems fsStyleFiveColumns">
      <article class="fsBoard-43 fsCategory-86 fsCategory-87 fsTag-193" data-post-id="1">
        <div class="fsTitle">Baseball Camp</div>
      </article>
      <article class="fsBoard-43 fsCategory-91 fsTag-197" data-post-id="2">
        <div class="fsTitle">Esports Camp</div>
      </article>
    </div>
  </body>
</html>
"""


def test_parse_rows_extracts_weeks_and_grade_ranges() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 2
    assert rows[0]["title"] == "Baseball Camp"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[0]["end_date"] == "2026-06-05"
    assert rows[0]["age_min"] == 6
    assert rows[0]["age_max"] == 7
    assert "sports" in rows[0]["tags"]
    assert rows[1]["age_min"] == 11
    assert rows[1]["age_max"] == 13
    assert rows[1]["class_category"] == "mixed"


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(77, 8, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["title"].startswith("Baseball Camp")
