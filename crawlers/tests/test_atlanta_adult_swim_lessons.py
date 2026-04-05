from datetime import date

from sources.atlanta_adult_swim_lessons import parse_item


def test_parse_item_builds_washington_adult_swim_occurrences():
    item = {
        "name": "Washington Beginner Adult Swim Lessons Mon./Wed.",
        "date_range_start": "2026-03-16",
        "date_range_end": "2026-04-08",
        "age_min_year": 18,
        "location": {"label": "Washington Park Aquatic Center"},
        "desc": """
            <div>
              Activity Times: Mon. & Wed 5 :00 p.m. to 5:45 pm.
              Registration Fees: Resident $65.00 | Non-resident $80.00
            </div>
        """,
        "detail_url": "https://example.com/washington",
    }

    parsed = parse_item(item, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Adult Swim Lessons (5:00 PM) at Washington Park Aquatic Center"
    assert (
        parsed["description"]
        == "Adult Swim Lessons (5:00 PM) at Washington Park Aquatic Center. "
        "Public adult swim lessons through Atlanta DPR. "
        "Reserve through the official city registration catalog for current availability."
    )
    assert parsed["weekdays"] == [0, 2]
    assert parsed["start_time"] == "17:00"
    assert parsed["end_time"] == "17:45"


def test_parse_item_rejects_youth_swim():
    item = {
        "name": "Youth Swim Lessons",
        "date_range_start": "2026-03-16",
        "date_range_end": "2026-04-08",
        "age_min_year": 5,
        "location": {"label": "Washington Park Aquatic Center"},
        "desc": "<div>Activity Times: Mon. & Wed 5 :00 p.m. to 5:45 pm.</div>",
    }

    assert parse_item(item, date(2026, 3, 11)) is None
