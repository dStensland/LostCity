from sources.concrete_jungle import determine_category, is_full_event


def test_is_full_event_detects_prefixed_full_title():
    assert is_full_event("FULL: Farm Volunteer - Farm Day at Doghead Farm")


def test_is_full_event_detects_zero_spots_remaining():
    assert is_full_event("Farm Volunteer - Farm Day at Doghead Farm", "0")


def test_determine_category_marks_workshops_as_learning_not_volunteer():
    category, subcategory, tags = determine_category(
        "Workshop - Strawberry Workshop at Doghead Farm",
        "Hands-on workshop experience at the farm.",
    )

    assert category == "learning"
    assert subcategory == "workshop"
    assert "volunteer" not in tags
    assert "education" in tags


def test_determine_category_keeps_farm_days_as_volunteer():
    category, subcategory, tags = determine_category(
        "Farm Volunteer - Farm Day at Doghead Farm",
        "Join us to help plant, cultivate, and harvest produce.",
    )

    assert category == "community"
    assert subcategory == "volunteer"
    assert "volunteer" in tags
