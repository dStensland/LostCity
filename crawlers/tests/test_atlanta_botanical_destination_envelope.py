from sources.atlanta_botanical import (
    _CAT_EXHIBITION,
    _VENUE_MIDTOWN,
    _build_destination_envelope,
    _build_exhibition_record,
)


def test_build_destination_envelope_projects_family_garden_details() -> None:
    envelope = _build_destination_envelope(1602, _VENUE_MIDTOWN)

    assert envelope.destination_details[0]["place_id"] == 1602
    assert envelope.destination_details[0]["destination_type"] == "botanical_garden"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "paid_lot"
    assert "timed-entry" in envelope.destination_details[0]["practical_notes"].lower()
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "childrens-garden-and-kids-programming",
        "paved-garden-paths-and-stroller-friendly-circulation",
        "indoor-conservatories-and-weather-flex-space",
        "shade-and-conservatory-reset-flex",
    }
    assert {special["slug"] for special in envelope.venue_specials} == {
        "children-under-3-free-daytime-admission",
    }


def test_build_exhibition_record_projects_multi_day_exhibit() -> None:
    record = _build_exhibition_record(
        title="Enchanted Trees by Poetic Kinetics",
        tribe_cats=_CAT_EXHIBITION,
        category="art",
        subcategory="exhibition",
        start_date="2026-05-10",
        end_date="2026-09-15",
        place_id=1602,
        source_id=8,
        venue_name="Atlanta Botanical Garden",
        description="A seasonal outdoor exhibition.",
        image_url="https://example.com/exhibit.jpg",
        source_url="https://atlantabg.org/events/exhibit",
        is_free=False,
        tags=["garden", "seasonal"],
    )

    assert record is not None
    assert record["place_id"] == 1602
    assert record["opening_date"] == "2026-05-10"
    assert record["closing_date"] == "2026-09-15"
    assert record["admission_type"] == "ticketed"
    assert "exhibition" in record["tags"]


def test_build_exhibition_record_skips_single_day_event() -> None:
    assert _build_exhibition_record(
        title="Exhibition Opening Talk",
        tribe_cats=_CAT_EXHIBITION,
        category="art",
        subcategory="exhibition",
        start_date="2026-05-10",
        end_date=None,
        place_id=1602,
        source_id=8,
        venue_name="Atlanta Botanical Garden",
        description="One-night opening talk.",
        image_url=None,
        source_url="https://atlantabg.org/events/opening-talk",
        is_free=True,
        tags=["garden"],
    ) is None
