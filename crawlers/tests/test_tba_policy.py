from tba_policy import classify_tba_event


def test_classify_tba_event_marks_dream_schedule_as_non_actionable() -> None:
    actionable, reason = classify_tba_event(
        {"source_url": "https://dream.wnba.com/2026-schedule-release"}
    )

    assert actionable is False
    assert reason == "official_date_only_schedule"


def test_classify_tba_event_marks_generic_class_hub_as_non_actionable() -> None:
    actionable, reason = classify_tba_event(
        {"source_url": "https://classes.inquicker.com/?ClientID=12422"}
    )

    assert actionable is False
    assert reason == "generic_hub_url"


def test_classify_tba_event_keeps_detail_pages_actionable() -> None:
    actionable, reason = classify_tba_event(
        {
            "source_url": (
                "https://classes.inquicker.com/details/?ClientID=12422"
                "&ClassID=84901&OccurrenceID=84901-2-32&lang=en-US"
            )
        }
    )

    assert actionable is True
    assert reason is None


def test_classify_tba_event_accepts_real_event_detail_page() -> None:
    actionable, reason = classify_tba_event(
        {"source_url": "https://www.atlantaoutdoorclub.com/event/details.asp?eventid=27741"}
    )

    assert actionable is True
    assert reason is None
