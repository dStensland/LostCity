from sources.colony_square import build_occurrences, parse_schedule_dates, parse_time_range


def test_parse_schedule_dates_extracts_concrete_dates():
    lines = [
        "Upcoming Movie Schedule:",
        "April 2nd: Grease",
        "May 7th: Twisters",
        "Additional Event Details:",
    ]

    assert parse_schedule_dates(lines, 2026) == [
        ("2026-04-02", "Grease"),
        ("2026-05-07", "Twisters"),
    ]


def test_parse_time_range_applies_end_period_to_start():
    start_time, end_time = parse_time_range("6-7 PM")

    assert start_time == "18:00"
    assert end_time == "19:00"


def test_build_occurrences_skips_tba_select_dates():
    occurrences = build_occurrences(
        {
            "time_label": "Times Vary",
            "schedule_dates": [],
            "ics_start": None,
            "ics_end": None,
            "date_label": "Select Dates",
            "description": "Viewing Schedule: TBA",
        }
    )

    assert occurrences == []


def test_build_occurrences_uses_schedule_dates_when_present():
    occurrences = build_occurrences(
        {
            "time_label": "6-7 PM",
            "schedule_dates": [("2026-04-01", "Dancing Dogs Yoga"), ("2026-04-08", "Exhale")],
            "ics_start": None,
            "ics_end": None,
            "date_label": "Wednesdays",
            "description": "Yoga every Wednesday from April to October.",
        }
    )

    assert occurrences == [
        ("2026-04-01", "2026-04-01", "18:00", "19:00", False),
        ("2026-04-08", "2026-04-08", "18:00", "19:00", False),
    ]
