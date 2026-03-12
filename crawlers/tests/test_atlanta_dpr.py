from sources.atlanta_dpr import _should_skip_dedicated_item


def test_should_skip_dedicated_item_for_specialized_public_play_sources():
    assert _should_skip_dedicated_item("Beginner Adult Swim Lessons CT Martin Sat.", "") is True
    assert _should_skip_dedicated_item("Water Aerobics @ Rosel Fann", "") is True
    assert _should_skip_dedicated_item("Community Open Gym at Coan Park", "") is True
    assert _should_skip_dedicated_item("Basketball 101 at Peachtree Hills", "") is False
