from scripts.content_health_audit import participant_expected_for_event


def test_sports_premium_seating_is_not_actionable_participant_gap() -> None:
    assert (
        participant_expected_for_event(
            "Atlanta Braves v. Athletics * Premium Seating *",
            "sports",
        )
        is False
    )


def test_music_party_title_is_not_actionable_participant_gap() -> None:
    assert participant_expected_for_event("Saint Patrick's Day Party", "music") is False


def test_music_worship_title_is_not_actionable_participant_gap() -> None:
    assert participant_expected_for_event("Holy Thursday Choral Eucharist", "music") is False


def test_music_live_music_template_is_not_actionable() -> None:
    assert participant_expected_for_event("Live Music", "music") is False


def test_music_symphony_program_title_is_not_actionable() -> None:
    assert participant_expected_for_event("Sibelius Symphony No. 5", "music") is False


def test_music_celebration_program_title_is_not_actionable() -> None:
    assert (
        participant_expected_for_event(
            "PLAY: A Celebration of Chinese Music – Bridging East and West",
            "music",
        )
        is False
    )


def test_music_saturday_night_live_template_is_not_actionable() -> None:
    assert participant_expected_for_event("SNL: Saturday Night Live at SoHo Lounge", "music") is False


def test_comedy_template_show_title_is_not_actionable_participant_gap() -> None:
    assert participant_expected_for_event("Saturday Night Live Comedy Show", "comedy") is False


def test_named_comedian_is_actionable_participant_gap() -> None:
    assert participant_expected_for_event("Tahir Moore", "comedy") is True
