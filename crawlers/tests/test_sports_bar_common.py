from sources._sports_bar_common import detect_sports_watch_party


def test_detect_sports_watch_party_identifies_soccer_inventory():
    detected = detect_sports_watch_party(
        "USMNT vs Belgium Watch Party",
        "Official viewing party with sound on.",
        extra_tags=["downtown"],
    )

    assert detected == (
        "sports",
        "watch_party",
        ["sports", "watch-party", "soccer", "downtown"],
    )


def test_detect_sports_watch_party_identifies_rugby_inventory():
    detected = detect_sports_watch_party(
        "Six Nations Viewing Party",
        "Catch all the rugby action live.",
        extra_tags=["buckhead"],
    )

    assert detected == (
        "sports",
        "watch_party",
        ["sports", "watch-party", "rugby", "buckhead"],
    )


def test_detect_sports_watch_party_identifies_basketball_inventory():
    detected = detect_sports_watch_party(
        "March Madness Tip-Off Party",
        "College hoops all day on the big screens.",
        extra_tags=["sports-bar"],
    )

    assert detected == (
        "sports",
        "watch_party",
        ["sports", "watch-party", "basketball", "sports-bar"],
    )


def test_detect_sports_watch_party_returns_none_for_non_sports_programming():
    assert detect_sports_watch_party(
        "Trivia Night",
        "Weekly pub quiz with prizes.",
        extra_tags=["downtown"],
    ) is None
