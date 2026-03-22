from scripts.seed_atlanta_activity_overlays_urban_air import (
    URBAN_AIR_ACTIVITY_OVERLAYS,
)


def test_urban_air_overlay_seed_covers_three_location_venues() -> None:
    assert sorted(URBAN_AIR_ACTIVITY_OVERLAYS.keys()) == [
        "urban-air-buford",
        "urban-air-kennesaw",
        "urban-air-snellville",
    ]


def test_urban_air_overlay_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in URBAN_AIR_ACTIVITY_OVERLAYS.items():
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
