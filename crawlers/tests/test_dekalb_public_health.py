from sources.dekalb_public_health import classify_event, parse_eventon_datetime


def test_parse_eventon_datetime_valid():
    date_value, time_value = parse_eventon_datetime("2026-2-19T14:00-5:00")
    assert date_value == "2026-02-19"
    assert time_value == "14:00"


def test_parse_eventon_datetime_invalid():
    date_value, time_value = parse_eventon_datetime("invalid")
    assert date_value is None
    assert time_value is None


def test_classify_training_event():
    category, tags = classify_event(
        "Naloxone Training",
        "Learn overdose prevention and receive naloxone.",
    )
    assert category == "learning"
    assert "public-health" in tags
    assert "naloxone" in tags


def test_classify_wellness_event():
    category, tags = classify_event(
        "Community Care Van",
        "Breast and cervical cancer screenings and immunizations.",
    )
    assert category == "wellness"
    assert "screening" in tags
    assert "immunization" in tags
