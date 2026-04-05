from datetime import date

from sources.dekalb_line_dance_101 import parse_item, parse_schedule


def test_parse_schedule_extracts_tuesday_evening_window():
    html = """
    <div>Every Tuesday from 5:45pm-6:45pm</div>
    """

    assert parse_schedule(html) == ([1], "17:45", "18:45")


def test_parse_item_builds_recurring_line_dance_occurrences():
    item = {
        "name": "East Central - Line Dance 101 - Winter 2026 Session",
        "date_range_start": "2026-01-20",
        "date_range_end": "2026-03-31",
        "detail_url": "https://example.com/detail",
        "action_link": {"href": "https://example.com/enroll"},
        "fee": {"label": "Free"},
        "location": {"label": "East Central DeKalb Cmty & Senior Ctr"},
        "desc": """
            <div>Cost: Free</div>
            <div>Every Tuesday from 5:45pm-6:45pm</div>
        """,
    }

    parsed = parse_item(item, date(2026, 3, 10))

    assert parsed is not None
    assert parsed["title"] == "Line Dance 101 at East Central DeKalb Community & Senior Center"
    assert (
        parsed["description"]
        == "Line Dance 101 at East Central DeKalb Community & Senior Center. "
        "Public line dance class through DeKalb County Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_time"] == "17:45"
    assert parsed["end_time"] == "18:45"
    assert parsed["is_free"] is True
    assert parsed["occurrences"][:3] == [
        (date(2026, 3, 10), 1),
        (date(2026, 3, 17), 1),
        (date(2026, 3, 24), 1),
    ]
