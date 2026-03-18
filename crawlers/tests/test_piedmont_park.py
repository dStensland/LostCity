from sources.piedmont_park import RECURRING_SCHEDULE, _build_destination_envelope, categorize_event


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


def test_build_destination_envelope_adds_playgrounds_and_splash_pad() -> None:
    envelope = _build_destination_envelope(2201)

    assert envelope.destination_details[0]["venue_id"] == 2201
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "garage"
    assert "restroom" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "playgrounds-and-kid-play-areas",
        "pool-and-splash-pad",
        "restrooms-and-picnic-table-support",
        "stroller-friendly-paved-park-loops",
        "shade-lawns-and-flexible-basecamp-day",
    }


def test_build_destination_envelope_supports_official_alias_rows() -> None:
    envelope = _build_destination_envelope(
        9,
        venue_name="Piedmont Park Greystone",
        alias_of="piedmont-park",
    )

    assert envelope.destination_details[0]["venue_id"] == 9
    assert envelope.destination_details[0]["metadata"]["alias_of"] == "piedmont-park"
    assert envelope.destination_details[0]["metadata"]["source_slug"] == "piedmont-park"
    assert "Piedmont Park Greystone" in envelope.destination_details[0]["practical_notes"]
