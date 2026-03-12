from scripts.seed_atlanta_activity_overlays_wave2 import (
    ATLANTA_ACTIVITY_OVERLAYS_WAVE2,
    ENSURE_VENUES,
)


def test_wave2_overlay_seed_covers_expected_destinations() -> None:
    assert len(ATLANTA_ACTIVITY_OVERLAYS_WAVE2) == 5
    assert "world-of-coca-cola" in ATLANTA_ACTIVITY_OVERLAYS_WAVE2
    assert "stone-summit" in ATLANTA_ACTIVITY_OVERLAYS_WAVE2
    assert "stone-summit" in ENSURE_VENUES


def test_wave2_overlay_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE2.items():
        seen_slugs: set[str] = set()
        assert features, f"{venue_slug} should have at least one feature"

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
