from scripts.seed_atlanta_activity_overlays import ATLANTA_ACTIVITY_OVERLAYS


def test_overlay_seed_covers_expected_first_twelve_venues() -> None:
    assert len(ATLANTA_ACTIVITY_OVERLAYS) == 12
    assert "georgia-aquarium" in ATLANTA_ACTIVITY_OVERLAYS
    assert "stone-mountain-park" in ATLANTA_ACTIVITY_OVERLAYS
    assert "fernbank-science-center" in ATLANTA_ACTIVITY_OVERLAYS


def test_overlay_seed_features_have_required_fields_and_unique_slugs() -> None:
    for venue_slug, features in ATLANTA_ACTIVITY_OVERLAYS.items():
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
