"""Tests for State Farm Arena crawler categorization."""

from sources.state_farm_arena import determine_category


def test_artist_name_title_defaults_to_music():
    category, subcategory, _tags = determine_category("Mumford & Sons")
    assert category == "music"
    assert subcategory == "concert"


def test_vs_titles_classified_as_sports():
    category, subcategory, _tags = determine_category("Atlanta Dream vs New York Liberty")
    assert category == "sports"
    assert subcategory == "basketball"


def test_graduation_remains_community():
    category, subcategory, _tags = determine_category("Georgia State Graduation Ceremony")
    assert category == "community"
    assert subcategory == "event"
