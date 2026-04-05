from datetime import date

from sources.gwinnett_basic_meditation import parse_session


def test_parse_session_builds_basic_meditation_workshop():
    session = {
        "text": "Basic Meditation: Inner Peace",
        "price": 0,
        "features": [
            {"name": "location", "value": "Community Resource Center at Georgia Belle Court"},
            {"name": "dates", "value": "05/09/26"},
            {"name": "times", "value": "10am-11am"},
        ],
    }

    parsed = parse_session(session, date(2026, 3, 11))

    assert parsed is not None
    assert parsed["title"] == "Basic Meditation: Inner Peace at Community Resource Center at Georgia Belle Court"
    assert (
        parsed["description"]
        == "Basic Meditation: Inner Peace at Community Resource Center at Georgia Belle Court. "
        "Public meditation workshop through Gwinnett County Parks & Recreation. "
        "Reserve through the official county catalog for current availability."
    )
    assert parsed["start_date"] == "2026-05-09"
    assert parsed["is_free"] is True
