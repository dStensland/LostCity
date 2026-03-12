from scripts.seed_atlanta_activity_overlays_wave3 import (
    ATLANTA_ACTIVITY_OVERLAYS_WAVE3,
)


def test_wave3_overlay_seed_covers_expected_destinations() -> None:
    assert len(ATLANTA_ACTIVITY_OVERLAYS_WAVE3) == 7
    assert "andretti-marietta" in ATLANTA_ACTIVITY_OVERLAYS_WAVE3
    assert "main-event-alpharetta" in ATLANTA_ACTIVITY_OVERLAYS_WAVE3
    assert "white-water-atlanta" in ATLANTA_ACTIVITY_OVERLAYS_WAVE3


def test_wave3_overlay_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE3.items():
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
