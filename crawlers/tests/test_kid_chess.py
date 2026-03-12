from bs4 import BeautifulSoup

from sources.kid_chess import (
    _build_event_record,
    _parse_date_text,
    _parse_grade_range,
    _parse_page,
    _parse_price_options,
)


KID_CHESS_HTML = """
<h6>Spring Break Camp 2026</h6>
<div>
  <p>Please call us or <a href="/register/">Register Online</a></p>
  <table>
    <tr>
      <th>Camp</th><th>Dates</th><th>Grades</th><th>Sessions</th><th>Times</th><th>Tuition</th>
    </tr>
    <tr>
      <td><a href="https://goo.gl/maps/example">Chess.Zone</a></td>
      <td>April 6 – April 10</td>
      <td>0K – 8th Grade</td>
      <td>Morning<br/>Morning w/ Lunch<br/>Afternoon<br/>Full Day<br/>Full Day w/ Lunch</td>
      <td>9:00am – 1:00pm<br/>^^^<br/>1:00pm – 5:00pm<br/>9:00am – 5:00pm<br/>^^^</td>
      <td>$295<br/>$345<br/>$295<br/>$415<br/>$465</td>
    </tr>
  </table>
</div>
<h6>Girls' Camp & Tournament 2026</h6>
<div>
  <p><a href="https://www.kidchess.com/register/">Register Online Here</a></p>
  <table>
    <tr>
      <th>Camp</th><th>Dates</th><th>Grades</th><th>Sessions</th><th>Times</th><th>Tuition</th>
    </tr>
    <tr>
      <td><a href="https://goo.gl/maps/example">Chess.Zone</a></td>
      <td>Saturday, March 21st</td>
      <td>Kindergarten – 8th Grade Girls Only</td>
      <td>Morning Camp<br/>Morning Camp w/ Lunch<br/>Afternoon Tournament</td>
      <td>9:00am – 1:00pm<br/>^^^<br/>1:15pm – 4:30pm</td>
      <td>$60<br/>$70<br/>$35</td>
    </tr>
  </table>
</div>
<h6>Summer Camps 2026</h6>
<div>
  <p><a href="/register">Register Online</a></p>
  <table>
    <tr>
      <th>Camp</th><th>Dates</th><th>Grades</th><th>Sessions</th><th>Times</th><th>Tuition</th>
    </tr>
    <tr>
      <td>
        <a href="https://goo.gl/maps/ei29iiMEMvk55dv5A">Chess Zone Summer Camp</a><br/>
        2500 Old Alabama Rd Suite 11<br/>
        Roswell, GA 30076
      </td>
      <td>June 1 – June 5</td>
      <td>Rising 1st – Rising 9th Grade</td>
      <td>Morning<br/>Morning w/ Lunch<br/>Afternoon<br/>Full Day<br/>Full Day w/ Lunch</td>
      <td>9:00am – 1:00pm<br/>^^^<br/>1:00pm – 5:00pm<br/>9:00am – 5:00pm<br/>^^^</td>
      <td>$295<br/>$345<br/>$295<br/>$415<br/>$465</td>
    </tr>
    <tr>
      <td>
        <a href="https://goo.gl/maps/walker">The Walker School Summer Camp</a><br/>
        700 Cobb Pkwy N<br/>
        Marietta, GA 30062
      </td>
      <td>June 15 – June 19</td>
      <td>Rising 1st – Rising 9th Grade</td>
      <td>Morning<br/>Afternoon</td>
      <td>9:00am – 1:00pm<br/>1:00pm – 5:00pm</td>
      <td>$295<br/>$295</td>
    </tr>
  </table>
</div>
"""


def test_parse_date_text_supports_ranges_and_single_days() -> None:
    assert _parse_date_text("April 6 – April 10", 2026) == ("2026-04-06", "2026-04-10")
    assert _parse_date_text("Saturday, March 21st", 2026) == (
        "2026-03-21",
        "2026-03-21",
    )


def test_parse_grade_range_normalizes_age_bounds() -> None:
    assert _parse_grade_range("0K – 8th Grade") == (
        4,
        14,
        ["preschool", "elementary", "tween", "teen"],
    )
    assert _parse_grade_range("Rising 1st – Rising 9th Grade") == (
        6,
        15,
        ["elementary", "tween", "teen"],
    )


def test_parse_price_options_reuses_previous_time_for_caret_rows() -> None:
    soup = BeautifulSoup(
        """
        <table><tr>
          <td>Morning<br/>Morning w/ Lunch<br/>Afternoon</td>
          <td>9:00am – 1:00pm<br/>^^^<br/>1:00pm – 5:00pm</td>
          <td>$295<br/>$345<br/>$295</td>
        </tr></table>
        """,
        "html.parser",
    )
    cells = soup.find_all("td")

    options, price_min, price_max, price_note, is_free = _parse_price_options(
        cells[0],
        cells[1],
        cells[2],
    )

    assert options[1]["time"] == "9:00am – 1:00pm"
    assert price_min == 295.0
    assert price_max == 345.0
    assert "Morning w/ Lunch (9:00am – 1:00pm) $345" in price_note
    assert is_free is False


def test_parse_page_backfills_chess_zone_address_and_flags_girls_only() -> None:
    rows = _parse_page(BeautifulSoup(KID_CHESS_HTML, "html.parser"))

    assert len(rows) == 4

    spring_row = rows[0]
    girls_row = rows[1]
    summer_row = rows[2]

    assert spring_row["venue_name"] == "Chess.Zone"
    assert spring_row["address"] == "2500 Old Alabama Rd Suite 11"
    assert spring_row["city"] == "Roswell"
    assert girls_row["girls_only"] is True
    assert summer_row["program_label"] == "Kid Chess Summer Camp"
    assert summer_row["venue_name"] == "Chess Zone"


def test_build_event_record_uses_program_label_and_grade_ages() -> None:
    row = {
        "section_title": "Summer Camps 2026",
        "program_label": "Kid Chess Summer Camp",
        "venue_name": "The Walker School",
        "start_date": "2026-06-15",
        "end_date": "2026-06-19",
        "grade_text": "Rising 1st – Rising 9th Grade",
        "age_min": 6,
        "age_max": 15,
        "age_tags": ["elementary", "tween", "teen"],
        "girls_only": False,
        "options": [
            {"label": "Morning", "time": "9:00am – 1:00pm", "tuition": "$295"},
            {"label": "Afternoon", "time": "1:00pm – 5:00pm", "tuition": "$295"},
        ],
        "price_min": 295.0,
        "price_max": 295.0,
        "price_note": "Options: Morning (9:00am – 1:00pm) $295; Afternoon (1:00pm – 5:00pm) $295",
        "is_free": False,
        "registration_url": "https://www.kidchess.com/register/",
    }

    record = _build_event_record(10, 20, row)

    assert record["title"] == "Kid Chess Summer Camp at The Walker School"
    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["class_category"] == "education"
    assert record["age_min"] == 6
    assert record["age_max"] == 15
    assert record["ticket_url"] == "https://www.kidchess.com/register/"
    assert "Morning / 9:00am – 1:00pm / $295" in record["raw_text"]
