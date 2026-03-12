from sources.mjcca_day_camps import _build_event_record, _parse_page


HTML = """
<html>
  <body>
    <div class="camp-box">
      <div class="info-wrapper">
        <div class="info">
          <h5><a href="https://www.mjccadaycamps.org/camps/art-jam-camp/">Week 1 – Art Jam Camp</a></h5>
          <ul>
            <li>Type: Theme</li>
            <li>Location: Dunwoody</li>
            <li>Grades: K - 2nd</li>
            <li>Dates: Week 01: 5/26 - 5/29 (4 Days) <a href="#">View All Sessions</a></li>
            <li>Member Fee: $415</li>
            <li>Community Fee: $490</li>
          </ul>
        </div>
      </div>
      <div class="content">
        <p>Unleash your young artist's inner Picasso.</p>
        <a href="https://www.mjccadaycamps.org/camps/art-jam-camp/">Learn more</a>
      </div>
    </div>
    <div class="camp-box">
      <div class="info-wrapper">
        <div class="info">
          <h5><a href="https://www.mjccadaycamps.org/camps/ultimate-sports-camp/">Week 1 – Ultimate Sports Camp</a></h5>
          <ul>
            <li>Type: Sports, Teen</li>
            <li>Location: Dunwoody</li>
            <li>Grades: 3rd - 8th</li>
            <li>Dates: Week 01: 5/26 - 5/29 (4 Days) <a href="#">View All Sessions</a></li>
            <li>Member Fee: $415</li>
            <li>Community Fee: $490</li>
          </ul>
        </div>
      </div>
      <div class="content">
        <p>Every athlete's favorite sports.</p>
        <a href="https://www.mjccadaycamps.org/camps/ultimate-sports-camp/">Learn more</a>
      </div>
    </div>
  </body>
</html>
"""


def test_parse_page_extracts_session_cards() -> None:
    rows = _parse_page(HTML)

    assert len(rows) == 2
    assert rows[0]["title"] == "Art Jam Camp"
    assert rows[0]["start_date"] == "2026-05-26"
    assert rows[0]["end_date"] == "2026-05-29"
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 7
    assert rows[0]["price_min"] == 415.0
    assert rows[0]["price_max"] == 490.0
    assert rows[1]["class_category"] == "fitness"
    assert "sports" in rows[1]["tags"]


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_page(HTML)[0]
    record = _build_event_record(93, 12, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["title"].startswith("Art Jam Camp")
