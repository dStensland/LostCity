from sources.the_masquerade import (
    _extract_artist_from_event_url,
    _is_schedule_image,
    _repair_description_from_artist_bio,
    _resolve_better_event_url,
    EVENTS_URL,
    _title_needs_slug_artist_fallback,
)
from unittest.mock import patch
from utils import is_likely_non_event_image


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


# ---------------------------------------------------------------------------
# Schedule-image blocklist
# ---------------------------------------------------------------------------

_KNOWN_SCHEDULE_URLS = [
    "https://www.masqueradeatlanta.com/wp-content/uploads/2026/02/weeklyservice_0202slider-360x555.jpg",
    "https://www.masqueradeatlanta.com/wp-content/uploads/2026/03/weeklyservice_0309slider-360x555.jpg",
    "https://www.masqueradeatlanta.com/wp-content/uploads/2026/04/WEEKLYSERVICE_0401slider.jpg",
]

_REAL_EVENT_IMAGE_URLS = [
    "https://www.masqueradeatlanta.com/wp-content/uploads/2026/03/heavy-steppin-tour-poster.jpg",
    "https://cdn.example.com/events/breaking-ice-tour.jpg",
    # A URL that contains "weekly" in a different context — must NOT be blocked.
    "https://cdn.example.com/images/weekly-roundup-photo.jpg",
]


def test_is_schedule_image_blocks_known_weeklyservice_urls() -> None:
    for url in _KNOWN_SCHEDULE_URLS:
        assert _is_schedule_image(url), f"Should be blocked: {url}"


def test_is_schedule_image_passes_real_event_images() -> None:
    for url in _REAL_EVENT_IMAGE_URLS:
        assert not _is_schedule_image(url), f"Should NOT be blocked: {url}"


def test_is_schedule_image_handles_none_and_empty() -> None:
    assert not _is_schedule_image(None)
    assert not _is_schedule_image("")


def test_utils_is_likely_non_event_image_blocks_weeklyservice() -> None:
    """Central gate in utils.py must also reject weeklyservice URLs."""
    url = "https://www.masqueradeatlanta.com/wp-content/uploads/2026/02/weeklyservice_0202slider-360x555.jpg"
    assert is_likely_non_event_image(url), (
        "weeklyservice pattern should be in _IMAGE_SKIP_PATTERNS so that "
        "smart_update_existing_event treats existing bad rows as replaceable."
    )


def test_utils_is_likely_non_event_image_does_not_block_event_posters() -> None:
    """Guard must not false-positive on legitimate event poster URLs."""
    for url in _REAL_EVENT_IMAGE_URLS:
        assert not is_likely_non_event_image(url), f"False positive: {url}"


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
