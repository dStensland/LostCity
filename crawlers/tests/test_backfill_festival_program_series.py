from scripts.backfill_festival_program_series import _program_for_event


def test_program_for_event_falls_back_to_festival_name_for_generic_bucket():
    title = _program_for_event(
        {"title": "Toylanta Lobby Swap", "tags": []},
        "Toylanta",
    )

    assert title == "Toylanta"


def test_program_for_event_falls_back_to_festival_name_for_one_off_program_rows():
    title = _program_for_event(
        {"title": "Discovery Walk Emory", "tags": []},
        "Atlanta Science Festival",
    )

    assert title == "Atlanta Science Festival"


def test_program_for_event_keeps_specific_tracks():
    title = _program_for_event(
        {"title": "Keynotes: The Future of AI", "tags": ["keynote"]},
        "Render ATL",
    )

    assert title == "Keynotes"
