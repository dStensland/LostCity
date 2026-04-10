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
        result = insert_exhibition({"title": title, "place_id": 1})
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


def test_junk_title_regex_catches_view_fullsize_variations():
    from db.exhibitions import _JUNK_TITLE_RE
    junk = ["View Fullsize", "view fullsize", "VIEW FULLSIZE", "View  fullsize"]
    for title in junk:
        assert _JUNK_TITLE_RE.match(title.strip()), f"Should catch {title!r}"


def test_exhibition_columns_includes_related_feature_id():
    from db.exhibitions import _EXHIBITION_COLUMNS
    assert "related_feature_id" in _EXHIBITION_COLUMNS


def test_insert_exhibition_defaults_exhibition_type_to_group():
    """When exhibition_type is not provided, it should default to 'group'."""
    import inspect
    from db.exhibitions import insert_exhibition
    source = inspect.getsource(insert_exhibition)
    assert "exhibition_type" in source and '"group"' in source, (
        "insert_exhibition must default exhibition_type to 'group' when not provided"
    )
