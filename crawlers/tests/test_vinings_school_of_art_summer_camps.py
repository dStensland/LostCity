from bs4 import BeautifulSoup

from sources.vinings_school_of_art_summer_camps import (
    _build_event_record,
    _build_program_record,
    _parse_sections,
)


VININGS_HTML = """
<html>
  <head><title>Summer Camps 2026| Vinings School of Art in Smyrna, GA</title></head>
  <body>
    <h1>Summer 2026: Choice of drop-off time &amp; pick-up time. We have 2 different age groups for age 5 1/2 to 8 &amp; for age 8 to 12. Pay online on our website or call/text 678-213-4278.</h1>
    <a href="https://www.myprocare.com/Default/Index?aWtuPTIwMDAxMDc5OTcmc2NoSWQ9Mg==">After paying, CLICK HERE to provide contact information in ProCare for 1st time students</a>
    <span class="timeframes">Full Days = $390 per week</span>
    <span class="timeframes">Four Full Days = $340</span>

    <div class="tab-pane active" id="may30june2">
      <div class="row">
        <div class="col-md-12"><h2 class="camp-tab-header">June 1 to June 5</h2></div>
        <div class="col-lg-4 col-xs-12">
          <h3>Prices</h3>
          <ul><li>Our Weekly Rates are above</li></ul>
        </div>
        <div class="col-lg-4 col-xs-12">
          <h3>Art Camp</h3>
          <ul>
            <li><span>Time Slots &amp; Themes</span>
              <ul>
                <li><span>Learning Activities</span>
                  <ul>
                    <li>Clay camp + watercolor painting with beach themes.</li>
                  </ul>
                </li>
                <li><span>Additional Learning Activities</span>
                  <ul>
                    <li>Students also improve drawing techniques with perspective lessons.</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </div>
        <div class="col-lg-4 col-xs-12">
          <h3>Extended Day</h3>
          <ul><li>Later pick-up by 4pm or 5pm for an additional fee.</li></ul>
        </div>
      </div>
    </div>

    <div class="tab-pane" id="june2630">
      <div class="row">
        <div class="col-md-12"><h2 class="camp-tab-header">June 29 to July 2 (4-days)</h2></div>
        <div class="col-lg-4 col-xs-12">
          <h3>PRICES</h3>
          <ul><li>$340 for 4 days (holiday week)</li></ul>
        </div>
        <div class="col-lg-4 col-xs-12">
          <h3>Little Monet Art Camp</h3>
          <ul>
            <li><span>Time Slots &amp; Themes</span>
              <ul>
                <li><span>Learning Activities</span>
                  <ul>
                    <li>Large canvas painting inspired by Claude Monet.</li>
                  </ul>
                </li>
                <li><span>Additional Learning Activities</span>
                  <ul>
                    <li>Students draw people and pets.</li>
                  </ul>
                </li>
              </ul>
            </li>
          </ul>
        </div>
      </div>
    </div>

    <div class="tab-pane" id="future">
      <div class="row">
        <div class="col-md-12"><h2 class="camp-tab-header">Future camp weeks might be added.</h2></div>
        <div class="col-lg-4 col-xs-12"><h3>Art Camp</h3></div>
      </div>
    </div>

    <div class="tab-pane" id="placeholder">
      <div class="row">
        <div class="col-md-12"><h2 class="camp-tab-header">*</h2></div>
        <div class="col-lg-4 col-xs-12"><h3>Art Camp</h3></div>
      </div>
    </div>
  </body>
</html>
"""


def test_parse_sections_extracts_only_real_dated_weeks() -> None:
    rows = _parse_sections(BeautifulSoup(VININGS_HTML, "html.parser"))

    assert len(rows) == 2
    assert rows[0]["title"] == "Art Camp"
    assert rows[0]["start_date"] == "2026-06-01"
    assert rows[1]["title"] == "Little Monet Art Camp"
    assert rows[1]["start_date"] == "2026-06-29"


def test_parse_sections_applies_pricing_and_age_fit() -> None:
    rows = _parse_sections(BeautifulSoup(VININGS_HTML, "html.parser"))

    assert rows[0]["price_min"] == 390.0
    assert rows[1]["price_min"] == 340.0
    assert rows[0]["age_min"] == 5
    assert rows[0]["age_max"] == 12
    assert "elementary" in rows[0]["tags"]
    assert "tween" in rows[0]["tags"]


def test_build_event_record_shapes_vinings_camp() -> None:
    row = _parse_sections(BeautifulSoup(VININGS_HTML, "html.parser"))[0]
    record = _build_event_record(12, 21, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "arts"
    assert record["start_time"] == "09:15"
    assert record["end_time"] == "14:30"
    assert record["price_min"] == 390.0
    assert record["ticket_url"] == "https://viningsschoolofart.com/summer-camps.html"


def test_build_program_record_shapes_vinings_camp() -> None:
    row = _parse_sections(BeautifulSoup(VININGS_HTML, "html.parser"))[0]
    record = _build_program_record(12, 21, row)

    assert record["program_type"] == "camp"
    assert record["session_start"] == "2026-06-01"
    assert record["session_end"] == "2026-06-05"
    assert record["schedule_start_time"] == "09:15"
    assert record["schedule_end_time"] == "14:30"
    assert record["cost_amount"] == 390.0
    assert record["cost_period"] == "per_session"
    assert record["registration_url"] == "https://viningsschoolofart.com/summer-camps.html"
