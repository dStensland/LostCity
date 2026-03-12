from sources.girl_scouts_greater_atlanta_camps import (
    _age_data_from_title,
    _build_event_record,
    _build_rows,
    _extract_detail_page_fields,
)


DETAIL_HTML = """
<html>
  <body>
    <h1>Brownie Critter Campers</h1>
    <div class="et_pb_text_inner"><p>Calling all animal lovers! In Critter Campers, girls will go wild learning about furry, feathered, scaly, and slimy friends.</p></div>
    <div class="et_pb_text_inner"><h3>Cost $465-1025</h3></div>
    <div class="et_pb_text_inner"><h2>Available at the Following Camp Location(s)</h2></div>
    <div class="et_pb_text_inner">Timber Ridge Day Camp</div>
    <div class="et_pb_text_inner">Timber Ridge Sleepaway</div>
    <table>
      <thead>
        <tr><th>Start Date</th><th>End Date</th><th>Session Duration</th><th>Cost</th></tr>
      </thead>
      <tbody>
        <tr><td>06/15/2026</td><td>06/19/2026</td><td>One Week - Day Camp Sessions</td><td>$ 465</td></tr>
        <tr><td>06/14/2026</td><td>06/19/2026</td><td>One Week - Sleepaway Camp Sessions</td><td>$ 1025</td></tr>
      </tbody>
    </table>
  </body>
</html>
"""


def test_age_data_from_title_handles_girl_scout_levels_and_leadership() -> None:
    assert _age_data_from_title("Brownie Critter Campers")[:2] == (7, 8)
    assert _age_data_from_title("Cadette Camp Survivor Quest Mini - Platform Tent")[:2] == (11, 13)
    assert _age_data_from_title("Counselor in Training I (CIT I)")[:2] == (14, 16)


def test_extract_detail_page_fields_reads_session_table() -> None:
    fields = _extract_detail_page_fields(DETAIL_HTML)

    assert fields["title"] == "Brownie Critter Campers"
    assert fields["cost_text"] == "Cost $465-1025"
    assert len(fields["sessions"]) == 2
    assert fields["sessions"][0]["start_date"] == "2026-06-15"
    assert fields["sessions"][1]["price_min"] == 1025.0


def test_build_rows_maps_day_and_sleepaway_sessions_to_same_site() -> None:
    item = {
        "title": {"rendered": "Brownie Critter Campers"},
        "link": "https://girlscoutsummer.com/camp/brownie-critter-campers/",
        "categories": [10],
        "camp-location": [38, 36],
    }
    category_lookup = {10: {"slug": "specialty"}}
    location_lookup = {
        38: {"slug": "timber-ridge-day-camp", "name": "Timber Ridge Day Camp"},
        36: {"slug": "timber-ridge-sleepaway", "name": "Timber Ridge Sleepaway"},
    }
    rows = _build_rows(item, _extract_detail_page_fields(DETAIL_HTML), category_lookup, location_lookup)

    assert len(rows) == 2
    assert rows[0]["venue_data"]["name"] == "Camp Timber Ridge"
    assert rows[1]["venue_data"]["name"] == "Camp Timber Ridge"
    assert rows[0]["price_min"] == 465.0
    assert rows[1]["price_min"] == 1025.0
    assert "day-camp" in rows[0]["tags"]
    assert "sleepaway" in rows[1]["tags"]


def test_build_event_record_shapes_girl_scout_camp() -> None:
    item = {
        "title": {"rendered": "Brownie Critter Campers"},
        "link": "https://girlscoutsummer.com/camp/brownie-critter-campers/",
        "categories": [10],
        "camp-location": [38],
    }
    category_lookup = {10: {"slug": "specialty"}}
    location_lookup = {38: {"slug": "timber-ridge-day-camp", "name": "Timber Ridge Day Camp"}}
    row = _build_rows(item, _extract_detail_page_fields(DETAIL_HTML), category_lookup, location_lookup)[0]
    record = _build_event_record(18, 33, row)

    assert record["category"] == "programs"
    assert record["subcategory"] == "camp"
    assert record["price_min"] == 465.0
    assert record["age_min"] == 7
    assert record["age_max"] == 8
    assert record["title"].startswith("Brownie Critter Campers at Camp Timber Ridge")
