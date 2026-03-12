from sources.goldfish_swim import (
    LOCATIONS as GOLDFISH_LOCATIONS,
    _build_jump_start_event_record,
    _build_swim_lessons_event_record,
)
from sources.swim_atlanta import LOCATIONS as SWIM_ATLANTA_LOCATIONS, _build_lessons_event_record


def test_swim_atlanta_lessons_use_fitness_class_category():
    event = _build_lessons_event_record(
        SWIM_ATLANTA_LOCATIONS[0],
        venue_id=1,
        source_id=2,
        start_date_str="2026-03-14",
    )

    assert event["category"] == "fitness"
    assert event["subcategory"] == "fitness.swim"
    assert event["is_class"] is True
    assert event["class_category"] == "fitness"
    assert event["ticket_url"] == SWIM_ATLANTA_LOCATIONS[0]["location_url"]


def test_goldfish_jump_start_uses_fitness_class_category():
    event = _build_jump_start_event_record(
        GOLDFISH_LOCATIONS[0],
        venue_id=1,
        source_id=2,
        session_name="JSC 04/06/26 - 04/10/26",
        start_date_str="2026-04-06",
        end_date_str="2026-04-10",
    )

    assert event["category"] == "fitness"
    assert event["subcategory"] == "fitness.swim"
    assert event["is_class"] is True
    assert event["class_category"] == "fitness"
    assert event["ticket_url"] == GOLDFISH_LOCATIONS[0]["portal_url"]


def test_goldfish_lessons_use_fitness_class_category():
    event = _build_swim_lessons_event_record(
        GOLDFISH_LOCATIONS[0],
        venue_id=1,
        source_id=2,
        start_date_str="2026-03-14",
    )

    assert event["category"] == "fitness"
    assert event["subcategory"] == "fitness.swim"
    assert event["is_class"] is True
    assert event["class_category"] == "fitness"
    assert event["price_min"] == 32.50
