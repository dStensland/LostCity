from sources.nami_georgia import (
    _transform_nami_record,
    determine_category_and_tags,
    is_public_event,
)


def test_is_public_event_skips_internal_items() -> None:
    assert is_public_event("Board Meeting", "Internal committee session.") is False
    assert is_public_event("Peer Support Group", "Public support group.") is True


def test_determine_category_and_tags_detects_training() -> None:
    category, subcategory, tags = determine_category_and_tags(
        "Family Support Training",
        "Mental health education workshop for caregivers.",
    )

    assert category == "learning"
    assert subcategory == "workshop"
    assert "training" in tags


def test_transform_nami_record_marks_public_support_as_free() -> None:
    transformed = _transform_nami_record(
        {},
        {
            "title": "Peer Support Group",
            "description": "Weekly peer support meeting.",
            "source_url": "https://namiga.org/event/peer-support-group/",
            "is_free": False,
        },
    )

    assert transformed is not None
    assert transformed["category"] == "wellness"
    assert transformed["ticket_url"] == "https://namiga.org/event/peer-support-group/"
    assert transformed["is_free"] is True


def test_transform_nami_record_skips_far_future_rows() -> None:
    transformed = _transform_nami_record(
        {},
        {
            "title": "Peer Support Group",
            "description": "Weekly peer support meeting.",
            "start_date": "2099-01-01",
        },
    )

    assert transformed is None
