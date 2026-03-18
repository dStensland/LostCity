from sources.piedmont_classes import (
    _build_description,
    _build_detail_url,
    _parse_occurrence_datetime,
)


def test_parse_occurrence_datetime_returns_date_and_time() -> None:
    assert _parse_occurrence_datetime("2026-04-13T17:15:00") == (
        "2026-04-13",
        "17:15:00",
    )


def test_build_detail_url_uses_item_level_route() -> None:
    assert _build_detail_url(84901, "84901-2-32") == (
        "https://classes.inquicker.com/details/?ClientID=12422"
        "&ClassID=84901&OccurrenceID=84901-2-32&lang=en-US"
    )


def test_build_description_stitches_notes_without_duplicates() -> None:
    assert _build_description(
        {
            "ClassDescription": "Learn newborn basics.",
            "ParkingNotes": "Park in deck A.",
            "SupplyNotes": "Bring a notebook.",
            "EnrolleeNotes": "Bring a notebook.",
        }
    ) == "Learn newborn basics. Park in deck A. Bring a notebook."
