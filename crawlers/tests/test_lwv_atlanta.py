from dedupe import generate_content_hash
from sources.lwv_atlanta import _normalize_detail_url, _normalize_title


def test_normalize_title_fixes_runoff_typo() -> None:
    assert (
        _normalize_title("General Primary Election/Nonpartisan Eunoff")
        == "General Primary Election/Nonpartisan Runoff"
    )


def test_normalize_title_keeps_canonical_titles_stable() -> None:
    title = "General Primary Election/Nonpartisan Election"
    assert _normalize_title(title) == title


def test_normalized_title_hash_differs_from_legacy_typo_hash() -> None:
    raw_title = "General Primary Election/Nonpartisan Eunoff"
    normalized_title = _normalize_title(raw_title)

    assert normalized_title != raw_title
    assert generate_content_hash(raw_title, "League of Women Voters Atlanta-Fulton", "2026-06-16") != generate_content_hash(
        normalized_title, "League of Women Voters Atlanta-Fulton", "2026-06-16"
    )


def test_normalize_detail_url_ignores_www_and_trailing_slash() -> None:
    assert (
        _normalize_detail_url("https://www.lwvaf.org/calendar/general-primary-electionnonpartisan-election-1/")
        == _normalize_detail_url("https://lwvaf.org/calendar/general-primary-electionnonpartisan-election-1")
    )
