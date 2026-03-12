from sources.georgia_aquarium_camp_h2o import _build_event_record, _parse_rows


HTML = """
<html>
  <body>
    <ul class="accordion">
      <li>
        <a class="js-accordion-trigger" href="#" id="June 1–5: Campers 5–13 yrs">
          <span>June 1–5: Campers 5–13 yrs</span>
        </a>
        <div class="submenu wysiwyg" aria-labeledby="June 1–5: Campers 5–13 yrs">
          <p><strong>Ages 5–7:</strong> <em>On Ocean Time</em></p>
          <p><strong>Ages 8–10:</strong> <em>Myth-Busters</em></p>
          <p><strong>Ages 11–13:</strong> <em>Ocean Odyssey</em></p>
          <p><a class="button" href="https://www.georgiaaquarium.org/events/event/summer-camp-h2o-june-1-5/">Register Today</a></p>
        </div>
      </li>
      <li>
        <a class="js-accordion-trigger" href="#" id="June 29–July 2: Campers 5–10 and 14–16 yrs">
          <span>June 29–July 2: Campers 5–10 and 14–16 yrs</span>
        </a>
        <div class="submenu wysiwyg" aria-labeledby="June 29–July 2: Campers 5–10 and 14–16 yrs">
          <p><strong>Ages 5–7:</strong> <em>Aquatic Artists</em></p>
          <p><strong>Ages 8–10:</strong> <em>Taxonomy Trailblazers</em></p>
          <p><strong>Ages 14–16:</strong> <em>Pathways of the High Seas</em></p>
          <p><a class="button" href="https://www.georgiaaquarium.org/events/event/summer-camp-h2o-june-29-july-3/">Register Today</a></p>
        </div>
      </li>
    </ul>
  </body>
</html>
"""


def test_parse_rows_extracts_weekly_age_track_rows() -> None:
    rows = _parse_rows(HTML)

    assert len(rows) == 6
    assert rows[0]["title"] == "Camp H2O: On Ocean Time"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[0]["end_date"] == "2026-06-05"
    assert rows[2]["age_min"] == 11
    assert rows[2]["age_max"] == 13
    assert rows[-1]["start_date"] == "2026-06-29"
    assert rows[-1]["end_date"] == "2026-07-02"
    assert rows[-1]["age_min"] == 14


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_rows(HTML)[0]
    record = _build_event_record(91, 8, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["title"].startswith("Camp H2O")
