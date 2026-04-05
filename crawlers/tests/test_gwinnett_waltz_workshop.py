from datetime import date

from sources.gwinnett_waltz_workshop import parse_session


def test_parse_session_builds_single_workshop_event():
    session = {
        "text": "Waltz Workshop",
        "price": 22,
        "features": [
            {"name": "location", "value": "Gwinnett Historic Courthouse"},
            {"name": "dates", "value": "04/07/26"},
            {"name": "times", "value": "7pm-8pm"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Waltz Workshop at Gwinnett Historic Courthouse"
    assert (
        parsed["description"]
        == "Waltz Workshop at Gwinnett Historic Courthouse. "
        "Public ballroom workshop through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_date"] == "2026-04-07"
    assert parsed["start_time"] == "19:00"
    assert parsed["end_time"] == "20:00"
