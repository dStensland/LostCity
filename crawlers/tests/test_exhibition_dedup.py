"""Tests for exhibition dedup: hash normalization and title validation."""

from db.exhibitions import generate_exhibition_hash, insert_exhibition


def test_hash_normalizes_internal_whitespace():
    """Titles with different internal whitespace should produce same hash."""
    h1 = generate_exhibition_hash("Jean  Shon : Bleed", 42, "2026-03-01")
    h2 = generate_exhibition_hash("Jean Shon : Bleed", 42, "2026-03-01")
    assert h1 == h2, "Internal whitespace differences should not change hash"


def test_hash_normalizes_leading_trailing_whitespace():
    h1 = generate_exhibition_hash("  Some Show  ", 42, "2026-03-01")
    h2 = generate_exhibition_hash("Some Show", 42, "2026-03-01")
    assert h1 == h2


def test_hash_case_insensitive():
    h1 = generate_exhibition_hash("RADCLIFFE BAILEY", 42, None)
    h2 = generate_exhibition_hash("Radcliffe Bailey", 42, None)
    assert h1 == h2


import pytest
from unittest.mock import patch


def test_insert_exhibition_rejects_junk_titles():
    """Titles that are navigation/UI artifacts should be rejected."""
    junk_titles = [
        "View Fullsize",
        "view fullsize",
        "Download Press Release",
        "CLICK HERE TO DOWNLOAD PRESS RELEASE",
        "Read More",
        "Learn More",
    ]
    for title in junk_titles:
        result = insert_exhibition({"title": title, "venue_id": 1})
        assert result is None, f"Junk title {title!r} should be rejected"


def test_insert_exhibition_accepts_real_titles():
    """Real exhibition titles should not be rejected by title validation."""
    from db.exhibitions import _JUNK_TITLE_RE

    real_titles = [
        "Radcliffe Bailey: The Great Migration",
        "View from the Mountain",
        "Learning to See",
        "Download Festival: 10 Years",
    ]
    for title in real_titles:
        assert not _JUNK_TITLE_RE.match(title), f"Real title {title!r} should not be blocked by junk filter"


from db.exhibitions import find_exhibition_by_title_venue


def test_find_exhibition_by_title_venue_exists():
    """find_exhibition_by_title_venue should be importable and callable."""
    assert callable(find_exhibition_by_title_venue)


def test_cdn_url_regex_matches_cdn_urls():
    """CDN image URLs should be caught by the regex pattern."""
    from db.exhibitions import _CDN_URL_RE

    cdn_urls = [
        "https://res.cloudinary.com/gallery/image/upload/v123/photo.jpg",
        "https://bucket.s3.amazonaws.com/exhibitions/img.png",
        "https://gallery.com/wp-content/uploads/2026/03/show.jpg",
        "https://cdn.imgix.net/photos/exhibit.jpg",
        "https://d1234.cloudfront.net/images/show.jpg",
    ]
    for url in cdn_urls:
        assert _CDN_URL_RE.search(url), f"CDN URL {url!r} should match"


def test_cdn_url_regex_does_not_match_real_urls():
    """Real exhibition page URLs should not match the CDN pattern."""
    from db.exhibitions import _CDN_URL_RE

    real_urls = [
        "https://gallery.com/exhibitions/my-show",
        "https://www.mocaga.org/2026-exhibitions/",
        "https://high.org/exhibition/radcliffe-bailey",
        "https://atlantacontemporary.org/exhibitions/current",
    ]
    for url in real_urls:
        assert not _CDN_URL_RE.search(url), f"Real URL {url!r} should not match CDN pattern"
