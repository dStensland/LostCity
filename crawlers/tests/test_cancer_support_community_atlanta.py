from sources.cancer_support_community_atlanta import _extract_event_fields


def test_extract_event_fields_prefers_forward_title_over_status_labels():
    lines = [
        "18",
        "11:00 AM",
        "Online",
        "Ostomy Support Group",
        "Support group for people affected by cancer.",
    ]

    title, start_time, description = _extract_event_fields(lines, 0)

    assert title == "Ostomy Support Group"
    assert start_time == "11:00"
    assert description == "Support group for people affected by cancer."


def test_extract_event_fields_ignores_in_person_title_noise():
    lines = [
        "25",
        "12:00 PM",
        "Event requires registration",
        "In Person",
        "Cooking Demo with Chef Kip",
        "Join Chef Kip for a live cooking demonstration focused on easy meals.",
    ]

    title, start_time, description = _extract_event_fields(lines, 0)

    assert title == "Cooking Demo with Chef Kip"
    assert start_time == "12:00"
    assert description == "Join Chef Kip for a live cooking demonstration focused on easy meals."


def test_extract_event_fields_ignores_virtual_and_offsite_labels():
    lines = [
        "17",
        "01:00 PM",
        "Offsite",
        "Beyond Cancer Support Group",
        "Support group for people with a cancer diagnosis.",
    ]

    title, start_time, description = _extract_event_fields(lines, 0)

    assert title == "Beyond Cancer Support Group"
    assert start_time == "13:00"
    assert description == "Support group for people with a cancer diagnosis."
