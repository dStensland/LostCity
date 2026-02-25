from db import validate_event_title


def test_rejects_prefixed_weekday_month_titles():
    assert validate_event_title("23Monday, February 23") is False
    assert validate_event_title("7Tue, Mar 7") is False


def test_accepts_normal_event_titles():
    assert validate_event_title("Evensong with Concert Choir") is True
    assert validate_event_title("Atlanta Jazz Festival Opening Night") is True
