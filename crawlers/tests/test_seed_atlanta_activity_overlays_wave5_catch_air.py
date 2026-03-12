from scripts.seed_atlanta_activity_overlays_wave5_catch_air import (
    CATCH_AIR_OVERLAYS,
    ENSURE_VENUES,
)


def test_catch_air_seed_covers_expected_active_georgia_locations() -> None:
    assert sorted(CATCH_AIR_OVERLAYS.keys()) == [
        "catch-air-dacula",
        "catch-air-johns-creek",
        "catch-air-marietta",
        "catch-air-snellville",
        "catch-air-tucker",
    ]
    assert sorted(ENSURE_VENUES.keys()) == sorted(CATCH_AIR_OVERLAYS.keys())


def test_catch_air_overlay_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in CATCH_AIR_OVERLAYS.items():
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
