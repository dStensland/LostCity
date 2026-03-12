from sources.mobilize_api import infer_civic_process_tags


def test_infer_civic_process_tags_marks_fulton_elections_meeting() -> None:
    tags = infer_civic_process_tags(
        "Fulton County: Join us for the Board of Registrations and Elections Meeting",
        "Join us to monitor election administration and support voters.",
    )

    assert "government" in tags
    assert "public-meeting" in tags
    assert "election" in tags


def test_infer_civic_process_tags_marks_school_board_event() -> None:
    tags = infer_civic_process_tags(
        "Public School Strong: Atlanta School Board Meeting",
        "Show up at the school board meeting to support public schools.",
    )

    assert "school-board" in tags
    assert "government" in tags
    assert "public-meeting" in tags


def test_infer_civic_process_tags_adds_jurisdiction_tags() -> None:
    tags = infer_civic_process_tags(
        "Join the Fulton County Board of Commissioners Meetings",
        "Learn how to show up for Fulton County government process.",
    )

    assert "government" in tags
    assert "public-meeting" in tags
    assert "fulton" in tags


def test_infer_civic_process_tags_is_empty_for_general_activist_event() -> None:
    tags = infer_civic_process_tags(
        "Hands Off Africa March and Rally",
        "Join the rally downtown.",
    )

    assert tags == []
