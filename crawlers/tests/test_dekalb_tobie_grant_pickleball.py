from datetime import date

from sources.dekalb_tobie_grant_pickleball import parse_item


def test_parse_item_builds_tuesday_open_play_occurrences():
    item = {
        "name": "Pickle Ball at Tobie Grant",
        "date_range_start": "2026-01-06",
        "date_range_end": "2026-03-25",
        "desc": (
            "Join us for open play, friendly matches, and skill-building sessions. "
            "Every Tuesday - 10AM-12Noon "
            "Every Wednesday - 6:30PM - 7:45PM (Class TBA due to basketball season)"
        ),
        "detail_url": "https://example.com/pickleball",
    }

    parsed = parse_item(item, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Tobie Grant Pickleball Open Play at Tobie Grant Gymnasium"
    assert parsed["start_time"] == "10:00"
    assert parsed["end_time"] == "12:00"
    assert parsed["occurrences"] == [
        (date(2026, 3, 17), 1),
        (date(2026, 3, 24), 1),
    ]
