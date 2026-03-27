"""Tests for taxonomy constants alignment between old and new categories."""
from tags import VALID_CATEGORIES
from genre_normalize import GENRES_BY_CATEGORY, VALID_GENRES


def test_new_categories_present():
    new_cats = {
        "music", "film", "comedy", "theater", "art", "dance",
        "sports", "fitness", "outdoors", "games",
        "food_drink", "conventions",
        "workshops", "education", "words",
        "volunteer", "civic", "support", "religious",
    }
    for cat in new_cats:
        assert cat in VALID_CATEGORIES, f"Missing new category: {cat}"


def test_old_categories_still_present():
    old_cats = {
        "nightlife", "community", "family", "recreation",
        "wellness", "exercise", "learning", "support_group", "other",
    }
    for cat in old_cats:
        assert cat in VALID_CATEGORIES, f"Old category prematurely removed: {cat}"


def test_new_genre_sets_exist():
    new_cats_with_genres = [
        "games", "workshops", "education", "conventions",
        "support", "fitness", "words", "religious", "volunteer", "civic",
    ]
    for cat in new_cats_with_genres:
        assert cat in GENRES_BY_CATEGORY, f"Missing genre set for: {cat}"
        assert len(GENRES_BY_CATEGORY[cat]) > 0, f"Empty genre set for: {cat}"


def test_karaoke_and_dj_in_music():
    music = GENRES_BY_CATEGORY.get("music", set())
    assert "karaoke" in music
    assert "dj" in music


def test_volleyball_in_sports():
    sports = GENRES_BY_CATEGORY.get("sports", set())
    assert "volleyball" in sports


def test_all_genre_sets_are_subsets_of_valid():
    for cat, genres in GENRES_BY_CATEGORY.items():
        for g in genres:
            assert g in VALID_GENRES, f"Genre '{g}' in {cat} not in VALID_GENRES"
