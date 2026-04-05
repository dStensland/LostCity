from scripts.cleanup_festival_yearly_wrappers import (
    is_safe_wrapper_candidate,
    looks_like_yearly_wrapper,
)


def test_looks_like_yearly_wrapper_matches_true_festival_wrapper() -> None:
    assert looks_like_yearly_wrapper(
        "BronzeLens Film Festival 2026",
        "BronzeLens Film Festival",
    )


def test_looks_like_yearly_wrapper_rejects_panel_titles_with_year() -> None:
    assert not looks_like_yearly_wrapper(
        "ATLFF Presents Page to Stage: 2026 Screenplay Competition Winners",
        "Atlanta Film Festival",
    )


def test_is_safe_wrapper_candidate_requires_single_matching_event() -> None:
    series_row = {
        "title": "Dragon Con 2026",
        "festival_name": "Dragon Con",
    }
    linked_events = [{"title": "Dragon Con 2026"}]

    assert is_safe_wrapper_candidate(series_row, linked_events)


def test_is_safe_wrapper_candidate_rejects_non_matching_event_title() -> None:
    series_row = {
        "title": "Dragon Con 2026",
        "festival_name": "Dragon Con",
    }
    linked_events = [{"title": "Dragon Con"}]

    assert not is_safe_wrapper_candidate(series_row, linked_events)
