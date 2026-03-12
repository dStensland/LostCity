from sources.piedmont_park_enviroventures_camp import _build_event_record, _parse_week_rows


HTML = """
<html>
  <body>
    <p><span><strong>June 1-5: Into the Wild</strong></span><br />Kick off your summer with a week full of exploration in the park.</p>
    <p><span><strong>June 15-18: Mad Scientist</strong></span></p>
    <p>*4 DAY CAMP WEEK-NO CAMP ON FRIDAY, JUNE 19*</p>
    <p>Get messy with us as we learn about the scientific method.</p>
    <table>
      <tr><td>Regular Rates: $350/week per camper **The week of June 15-18 is a 4 day week and is prorated to a cost of $280 per camper**</td></tr>
    </table>
    <p>Our Park Leadership Team is a great option for those ages 14-17 that are interested in serving as Park ambassadors.</p>
    <p>The Park Leadership Team meets for one training week Monday, July 6th - Friday, July 10th from 1:00PM to 5:00PM. The fee is $260 for participants.</p>
    <a href="https://forms.office.com/Pages/ResponsePage.aspx?id=test">Access the 2026 application here!</a>
  </body>
</html>
"""


def test_parse_week_rows_extracts_camp_and_training_rows() -> None:
    rows = _parse_week_rows(HTML)

    assert len(rows) == 3
    assert rows[0]["title"] == "EnviroVentures Summer Camp: Into the Wild"
    assert rows[1]["price_min"] == 280.0
    assert "scientific method" in rows[1]["description"]
    assert rows[2]["title"] == "Piedmont Park Leadership Team Training Week"
    assert rows[2]["ticket_url"].startswith("https://forms.office.com/")


def test_build_event_record_shapes_program_event() -> None:
    row = _parse_week_rows(HTML)[0]
    record = _build_event_record(7, 8, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["title"] == "EnviroVentures Summer Camp: Into the Wild"
