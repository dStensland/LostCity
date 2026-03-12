from sources.recurring_social_events import (
    EVENT_TEMPLATES,
    _build_display_title,
    _source_blocks_recurring_suppression,
)


def _template(title: str) -> dict:
    return next(event for event in EVENT_TEMPLATES if event["title"] == title)


def test_epl_watch_templates_are_sports_watch_parties():
    template = _template("EPL Saturday Morning Watch at Brewhouse Cafe")

    assert template["category"] == "sports"
    assert template["subcategory"] == "watch_party"
    assert "sports" in template["tags"]
    assert "watch-party" in template["tags"]
    assert "soccer" in template["tags"]


def test_ri_ra_watch_template_uses_consumer_safe_title():
    template = _template("EPL Morning Watch at Ri Ra Irish Pub Midtown")

    assert template["category"] == "sports"
    assert template["subcategory"] == "watch_party"
    assert "watch-party" in template["tags"]


def test_build_display_title_expands_short_venue_alias_without_duplication():
    assert (
        _build_display_title(
            "EPL Morning Watch at Ri Ra",
            "Ri Ra Irish Pub Midtown",
        )
        == "EPL Morning Watch at Ri Ra Irish Pub Midtown"
    )
    assert (
        _build_display_title(
            "EPL Morning Watch at Ri Ra Irish Pub Midtown",
            "Ri Ra Irish Pub Midtown",
        )
        == "EPL Morning Watch at Ri Ra Irish Pub Midtown"
    )


def test_nfl_watch_template_is_sports_watch_party():
    template = _template("NFL Sunday Watch Party at Park Tavern")

    assert template["category"] == "sports"
    assert template["subcategory"] == "watch_party"
    assert "sports" in template["tags"]
    assert "watch-party" in template["tags"]
    assert "nfl" in template["tags"]


def test_source_blocks_recurring_suppression_skips_zero_signal_sources():
    assert (
        _source_blocks_recurring_suppression(
            {"health_tags": ["profile-hardened-zero-signal"]}
        )
        is False
    )
    assert (
        _source_blocks_recurring_suppression({"health_tags": ["inactive-gated-crawler"]})
        is False
    )
    assert _source_blocks_recurring_suppression({"health_tags": []}) is True
