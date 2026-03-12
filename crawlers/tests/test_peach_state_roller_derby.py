from sources.peach_state_roller_derby import canonicalize_event_title


def test_canonicalize_event_title_collapses_recruitment_copy():
    raw = (
        "Contact recruitment@peachstaterollerderby.com to learn about how you can get in on "
        "the action and save the dates for our next Crash Course! 8pm-10pm at Sparkles of Kennesaw!"
    )

    assert canonicalize_event_title(raw) == "Peach State Roller Derby Crash Course"
