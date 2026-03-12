from scripts.seed_atlanta_activity_overlays_wave9_trampoline_and_farms import (
    ATLANTA_ACTIVITY_OVERLAYS_WAVE9,
    ENSURE_VENUES,
)


def test_wave9_trampoline_and_farms_targets_match_expected_venues() -> None:
    assert sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE9.keys()) == [
        "sky-zone-atlanta",
        "sky-zone-roswell",
        "uncle-shucks-corn-maze-and-pumpkin-patch",
        "warbington-farms",
    ]
    assert sorted(ENSURE_VENUES.keys()) == sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE9.keys())


def test_wave9_trampoline_and_farms_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE9.items():
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
