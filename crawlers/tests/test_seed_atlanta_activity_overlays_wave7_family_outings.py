from scripts.seed_atlanta_activity_overlays_wave7_family_outings import (
    ATLANTA_ACTIVITY_OVERLAYS_WAVE7,
    ENSURE_VENUES,
)


def test_wave7_family_outings_targets_match_expected_venues() -> None:
    assert sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE7.keys()) == [
        "noahs-ark-animal-sanctuary",
        "sparkles-family-fun-center-kennesaw",
        "yule-forest",
    ]
    assert sorted(ENSURE_VENUES.keys()) == sorted(ATLANTA_ACTIVITY_OVERLAYS_WAVE7.keys())


def test_wave7_family_outings_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS_WAVE7.items():
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
