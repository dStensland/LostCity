from scripts.normalize_atlanta_activity_legacy_packs import LEGACY_PACKS


def test_legacy_packs_normalize_to_three_features_each() -> None:
    assert set(LEGACY_PACKS.keys()) == {
        "chattahoochee-nature-center",
        "stone-mountain-park",
    }
    for pack in LEGACY_PACKS.values():
        assert len(pack["features"]) == 3


def test_replacement_features_all_have_price_notes_and_urls() -> None:
    for pack in LEGACY_PACKS.values():
        for feature in pack["features"]:
            assert feature["price_note"]
            assert feature["url"].startswith("https://")
            assert feature["sort_order"] in {10, 20, 30}
