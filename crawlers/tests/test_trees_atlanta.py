from unittest.mock import Mock, patch

from sources.trees_atlanta import EVENTS_URL, is_canceled_event, resolve_public_event_url


def test_is_canceled_event_detects_prefixed_title():
    assert is_canceled_event("CANCELED Tree Care in John Lewis Flowering Forest")


def test_is_canceled_event_detects_cancellation_in_description():
    assert is_canceled_event(
        "Tree Care in John Lewis Flowering Forest",
        "This workday has been cancelled due to weather.",
    )


def test_is_canceled_event_allows_normal_live_event():
    assert not is_canceled_event(
        "Tree Planting in Emma Millican Park",
        "Help us plant native trees in the park.",
    )


def test_resolve_public_event_url_keeps_live_detail_url():
    response = Mock(status_code=200)
    with patch("sources.trees_atlanta.requests.get", return_value=response):
        resolved = resolve_public_event_url(
            "https://www.treesatlanta.org/get-involved/events/tree-care-in-downtown-a0VUd00000VF7P7MAL"
        )

    assert resolved.endswith("tree-care-in-downtown-a0VUd00000VF7P7MAL")


def test_resolve_public_event_url_falls_back_for_dead_detail_url():
    response = Mock(status_code=404)
    with patch("sources.trees_atlanta.requests.get", return_value=response):
        resolved = resolve_public_event_url(
            "https://www.treesatlanta.org/get-involved/events/tree-pruning-in-vine-city-a0VUd00000VP37JMAT"
        )

    assert resolved == EVENTS_URL
