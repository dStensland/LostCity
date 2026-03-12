from sources.piedmont_park import RECURRING_SCHEDULE, categorize_event


def test_recurring_pickup_sports_use_sports_category():
    sports_titles = {
        "Piedmont Park Pickleball Open Play",
        "Piedmont Park Ultimate Frisbee Pickup",
        "Piedmont Park Pickup Soccer",
    }

    matched = [item for item in RECURRING_SCHEDULE if item["title"] in sports_titles]

    assert matched
    assert all(item["category"] == "sports" for item in matched)
    assert all(item["tags"][0] == "sports" for item in matched)


def test_categorize_event_marks_pickup_sports_as_sports():
    assert categorize_event(
        "Pickup Soccer Saturday",
        "Free open play at Piedmont Park for all skill levels.",
    ) == "sports"

    assert categorize_event(
        "Ultimate Frisbee Pickup",
        "Weekly pickup at the Active Oval.",
    ) == "sports"
