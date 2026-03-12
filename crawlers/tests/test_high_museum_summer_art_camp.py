from sources.high_museum_summer_art_camp import (
    _build_event_record,
    _parse_main_rows,
    _parse_rising_kindergarten_rows,
)


MAIN_HTML = """
<html>
  <body>
    <div id="tab-grades-1-2">
      <div class="at-accordion-content-container">
        <div class="at-accordion-top-row">
          <h3 class="at-accordion-title">Week 2: HogwARTs!</h3>
          <p class="at-accordion-price">Members: $360 | Not-Yet-Members: $460</p>
          <a class="at-accordion-cta" href="https://my.high.org/162921/163147">Buy Now</a>
        </div>
        <div class="at-accordion-bottom-row">
          <p class="at-accordion-info"><strong>June 8-12</strong><br/>Accio, campers! Art wizardry all week.</p>
        </div>
      </div>
    </div>
    <div id="tab-grades-7-8">
      <div class="at-accordion-content-container">
        <div class="at-accordion-top-row">
          <h3 class="at-accordion-title">Week 9: Makers Space</h3>
          <p class="at-accordion-price"><span><strong>Sold Out</strong></span></p>
          <a class="at-accordion-cta" href="https://hmaatl.wufoo.com/forms/rdf4oaq1961iel/">Waitlist</a>
        </div>
        <div class="at-accordion-bottom-row">
          <p class="at-accordion-info"><strong>July 27-31</strong><br/>Creative freedom takes the lead.</p>
        </div>
      </div>
    </div>
  </body>
</html>
"""


RISING_HTML = """
<html>
  <body>
    <div class="at-accordion-content-container">
      <div class="at-accordion-top-row">
        <h3 class="at-accordion-title">Week 1: Animals in Art</h3>
        <p class="at-accordion-price">Full Day: Members: $360 | Not-Yet-Members: $460<br/>Half Day: Members: $180 | Not-Yet-Members: $230</p>
        <a class="at-accordion-cta" href="https://my.high.org/162921/163069">Buy Now</a>
      </div>
      <div class="at-accordion-bottom-row">
        <p class="at-accordion-info"><strong>June 1-5</strong><br/>Lions and monkeys and art-oh, my!<br/><b>Camper must be at least 5 years old to attend.</b></p>
      </div>
    </div>
  </body>
</html>
"""


def test_parse_main_rows_extracts_grade_band_sessions() -> None:
    rows = _parse_main_rows(MAIN_HTML)

    assert len(rows) == 2
    assert rows[0]["title"] == "High Museum Summer Art Camp: Week 2: HogwARTs! (Grades 1-2)"
    assert rows[0]["start_date"] == "2026-06-08"
    assert rows[0]["price_min"] == 360.0
    assert rows[1]["ticket_url"].startswith("https://hmaatl.wufoo.com/")
    assert rows[1]["age_min"] == 12
    assert rows[1]["age_max"] == 14


def test_parse_rising_kindergarten_rows_extracts_half_day_price_range() -> None:
    rows = _parse_rising_kindergarten_rows(RISING_HTML)

    assert len(rows) == 1
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 5
    assert rows[0]["price_min"] == 360.0
    assert rows[0]["price_max"] == 460.0
    assert "rising-kindergarten" in rows[0]["tags"]


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_main_rows(MAIN_HTML)[0]
    record = _build_event_record(22, 91, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "arts"
    assert record["title"].startswith("High Museum Summer Art Camp")
