from datetime import date

from sources.dekalb_midway_pickleball import parse_item, parse_schedule


def test_parse_schedule_extracts_monday_midday_window():
    html = """
    <div>Midway Pickleball Program Schedule: Mondays 11:00 AM – 2:30 PM</div>
    """

    assert parse_schedule(html) == ([0], "11:00", "14:30")


def test_parse_item_builds_recurring_midway_pickleball_occurrences():
    item = {
        "name": "Midway Pickleball",
        "date_range_start": "2025-09-01",
        "date_range_end": "2026-04-06",
        "detail_url": "https://example.com/detail",
        "enroll_now": {"href": "https://example.com/enroll"},
        "fee": {"label": "Free"},
        "desc": """
            <div>Midway Pickleball Program Schedule: Mondays 11:00 AM – 2:30 PM</div>
            <div>Ages: 18 and up</div>
        """,
    }

    parsed = parse_item(item, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Midway Pickleball at Midway Recreation Center"
    assert parsed["start_time"] == "11:00"
    assert parsed["end_time"] == "14:30"
    assert parsed["is_free"] is True
    assert parsed["occurrences"][:4] == [
        (date(2026, 3, 16), 0),
        (date(2026, 3, 23), 0),
        (date(2026, 3, 30), 0),
        (date(2026, 4, 6), 0),
    ]
