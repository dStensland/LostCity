from sources.atlanta_dpr import _derive_schedule_fields, _should_skip_dedicated_item


def test_should_skip_dedicated_item_for_specialized_public_play_sources():
    assert _should_skip_dedicated_item("Beginner Adult Swim Lessons CT Martin Sat.", "") is True
    assert _should_skip_dedicated_item("Water Aerobics @ Rosel Fann", "") is True
    assert _should_skip_dedicated_item("Community Open Gym at Coan Park", "") is True
    assert _should_skip_dedicated_item("Basketball 101 at Peachtree Hills", "") is False


def test_derive_schedule_fields_extracts_times_from_activity_description() -> None:
    assert _derive_schedule_fields(
        start_raw="2026-06-08",
        end_raw="2026-06-12",
        date_range_description="Jun 8 to Jun 12",
        desc_text="Activity Times: Mon. & Wed 4 :00 p.m. to 5:00 pm.",
    ) == ("16:00:00", "17:00:00", False)
