from scripts.seed_atlanta_activity_overlays_wave4 import (
    ATLANTA_ACTIVITY_OVERLAYS_WAVE4,
    ENSURE_VENUES,
)


def test_wave4_overlay_seed_covers_expected_new_operator_destinations() -> None:
    assert len(ATLANTA_ACTIVITY_OVERLAYS_WAVE4) == 4
    assert sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE4.keys()) == [
        "ready-set-fun",
        "treetop-quest-dunwoody",
        "treetop-quest-gwinnett",
        "yellow-river-wildlife-sanctuary",
    ]
    assert sorted(ENSURE_VENUES.keys()) == sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE4.keys())


def test_wave4_overlay_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE4.items():
        seen_slugs: set[str] = set()
        assert len(features) == 3, f"{venue_slug} should have three overlay features"

        for feature in features:
            assert feature["title"].strip()
            assert feature["slug"].strip()
            assert feature["url"].strip()
            assert feature["feature_type"] in {
                "attraction",
                "experience",
                "collection",
                "amenity",
                "exhibition",
            }
            assert feature["slug"] not in seen_slugs
            seen_slugs.add(feature["slug"])
