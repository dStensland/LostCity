from sources.the_masquerade import (
    _extract_artist_from_event_url,
    _repair_description_from_artist_bio,
    _resolve_better_event_url,
    EVENTS_URL,
    _title_needs_slug_artist_fallback,
)
from unittest.mock import patch


def test_title_needs_slug_artist_fallback_for_tour_title() -> None:
    assert _title_needs_slug_artist_fallback("ACT III Tour")


def test_title_needs_slug_artist_fallback_for_experience_title() -> None:
    assert _title_needs_slug_artist_fallback("Afterhour Experience")


def test_title_needs_slug_artist_fallback_for_anniversary_title() -> None:
    assert _title_needs_slug_artist_fallback("Celebrating 10 years of the album 'Much Love'")


def test_extract_artist_from_event_url_basic_slug() -> None:
    assert (
        _extract_artist_from_event_url(
            "https://www.masqueradeatlanta.com/events/choker/"
        )
        == "Choker"
    )


def test_extract_artist_from_event_url_strips_numeric_suffix() -> None:
    assert (
        _extract_artist_from_event_url(
            "https://www.masqueradeatlanta.com/events/the-dear-hunter-2/"
        )
        == "The Dear Hunter"
    )


def test_extract_artist_from_event_url_uses_special_slug_mapping() -> None:
    assert (
        _extract_artist_from_event_url(
            "https://www.masqueradeatlanta.com/events/theartit-2/"
        )
        == "TheARTI$T"
    )


def test_extract_artist_from_event_url_rejects_non_artist_template_slug() -> None:
    assert (
        _extract_artist_from_event_url(
            "https://www.masqueradeatlanta.com/events/emo-night-karaoke/"
        )
        is None
    )


def test_resolve_better_event_url_for_listing_placeholder() -> None:
    links = {
        "starbenders": "https://www.masqueradeatlanta.com/events/starbenders-6/",
    }
    assert (
        _resolve_better_event_url("STARBENDERS", links, EVENTS_URL)
        == "https://www.masqueradeatlanta.com/events/starbenders-6/"
    )


def test_resolve_better_event_url_skips_non_listing_current_url() -> None:
    links = {
        "starbenders": "https://www.masqueradeatlanta.com/events/starbenders-6/",
    }
    assert (
        _resolve_better_event_url(
            "STARBENDERS",
            links,
            "https://www.masqueradeatlanta.com/events/starbenders-6/",
        )
        is None
    )


@patch("sources.the_masquerade.fetch_artist_info")
def test_repair_description_from_artist_bio_replaces_truncated_excerpt(mock_fetch_artist_info) -> None:
    mock_fetch_artist_info.return_value = type(
        "ArtistInfo",
        (),
        {
            "bio": "A full artist biography pulled from canonical music metadata.",
            "image_url": "https://images.example.com/artist.jpg",
        },
    )()

    record = {
        "title": "Afterhour Experience",
        "description": (
            "As a teenager, she gravitated toward darker textures and cinematic pop, "
            "building a style that would eventually define her breakout sound…"
        ),
        "source_url": "https://www.masqueradeatlanta.com/events/lithe/",
        "image_url": None,
        "_parsed_artists": [{"name": "Lithe"}],
    }

    _repair_description_from_artist_bio(record)

    assert record["description"] == "A full artist biography pulled from canonical music metadata."
    assert record["image_url"] == "https://images.example.com/artist.jpg"
