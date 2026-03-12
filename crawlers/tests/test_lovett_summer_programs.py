from sources.lovett_summer_programs import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <a class="fsTagLink fsStyleDefaultButton" data-tag-id="6" href="#">Lower School</a>
    <a class="fsTagLink fsStyleDefaultButton" data-tag-id="7" href="#">Middle School</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="45" href="#">Specialty Camps</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="46" href="#">Sports</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="47" href="#">Week 1: June 1-5</a>
    <a class="fsCategoryLink fsStyleDefaultButton" data-category-id="52" href="#">Week 6: July 13-17</a>
    <div class="fsListItems fsStyleThreeColumns">
      <article class="fsBoard-17 fsCategory-45 fsCategory-47 fsTag-6" data-post-id="1">
        <div class="fsTitle">Chess Camp</div>
      </article>
      <article class="fsBoard-17 fsCategory-46 fsCategory-52 fsTag-7" data-post-id="2">
        <div class="fsTitle">Nike Soccer Co-ed Grades 1-8</div>
      </article>
    </div>
  </body>
</html>
"""


def test_parse_rows_extracts_week_and_school_level_taxonomy() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 2
    assert rows[0]["title"] == "Chess Camp"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[0]["end_date"] == "2026-06-05"
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 10
    assert rows[1]["age_min"] == 6
    assert rows[1]["age_max"] == 13
    assert rows[1]["class_category"] == "fitness"


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(88, 9, row)

    assert record["category"] == "programs"
    assert record["title"].startswith("Chess Camp")
