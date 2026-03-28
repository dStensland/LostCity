from datetime import date

from sources.atlanta_aquatic_fitness import _build_destination_envelope, parse_item


def test_parse_item_builds_rosel_fann_water_aerobics():
    item = {
        "name": "Water Aerobics @ Rosel Fann",
        "date_range_start": "2026-02-02",
        "date_range_end": "2026-05-01",
        "age_min_year": 18,
        "location": {"label": "Rosel Fann Recreation Center"},
        "desc": """
            <div>
              Activity Times: Monday - Friday - 12:00 p.m. to 1:00 p.m.
              Registration Fees: Resident $0
            </div>
        """,
        "detail_url": "https://example.com/rosel-fann",
    }

    parsed = parse_item(item, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Water Aerobics at Rosel Fann Recreation & Aquatic Center"
    assert parsed["weekdays"] == [0, 1, 2, 3, 4]
    assert parsed["start_time"] == "12:00"
    assert parsed["is_free"] is True


def test_parse_item_builds_ct_martin_water_awareness():
    item = {
        "name": "C.T. Martin Senior Water Awareness: Wed",
        "date_range_start": "2026-03-18",
        "date_range_end": "2026-04-08",
        "age_min_year": 55,
        "location": {"label": "C.T. Martin Recreation & Aquatic Center"},
        "desc": """
            <div>
              Activity Times: Wed. 1 :00 p.m. to 2:00 pm.
              Registration Fees: $0 - with Prime-time Membership
            </div>
        """,
    }

    parsed = parse_item(item, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Senior Water Awareness at CT Martin Recreation & Aquatic Center"
    assert parsed["weekdays"] == [2]
    assert "seniors" in parsed["tags"]


def test_parse_item_builds_rosel_fann_ms_hayes_title_without_duplication():
    item = {
        "name": "Water Aerobics with Ms. Hayes at Rosel Fann",
        "date_range_start": "2026-03-11",
        "date_range_end": "2026-06-02",
        "age_min_year": 18,
        "location": {"label": "Rosel Fann Natatorium"},
        "desc": """
            <div>
              Activity Times: Monday - Friday - 12:00 p.m. to 1:00 p.m.
              Registration Fees: Resident $0
            </div>
        """,
    }

    parsed = parse_item(item, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Water Aerobics with Ms. Hayes at Rosel Fann Recreation & Aquatic Center"


def test_build_destination_envelope_marks_aquatic_center() -> None:
    place_data = {
        "name": "CT Martin Recreation & Aquatic Center",
        "slug": "ct-martin-recreation-aquatic-center",
        "venue_type": "recreation",
    }

    envelope = _build_destination_envelope(place_data, 2201)

    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.venue_features[0]["slug"] == "public-pool-and-aquatics-programs"
