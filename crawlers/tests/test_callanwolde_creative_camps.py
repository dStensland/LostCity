from sources.callanwolde_creative_camps import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <div class="fl-module-rich-text">
      <p>Have you ever dreamed of writing your own comic book or designing your own superhero? Now is your chance to bring your characters to life!</p>
      <p>Dates: June 1 - 5<br />Registration Code: CCMP 01<br />Location: Callanwolde Mansion</p>
    </div>
    <div class="fl-module-rich-text">
      <p>This 4-day camp introduces campers to the magical world of miniatures. Make mini figures, design mini objects, decorate mini rooms, and more!</p>
      <p>Dates: June 15 - 18<br />Registration Code: CCMP 03<br />Location: Callanwolde Mansion</p>
    </div>
  </body>
</html>
"""


def test_parse_rows_extracts_weekly_creative_camps() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 2
    assert rows[0]["title"].startswith("Callanwolde Creative Camp:")
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[0]["reg_code"] == "CCMP01"
    assert rows[1]["end_date"] == "2026-06-18"
    assert "crafts" in rows[1]["tags"]


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(17, 18, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["ticket_url"].startswith("https://campscui.active.com/")
