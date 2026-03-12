from sources.annual_tentpoles import CONFIGS


def test_esfna_is_modeled_as_sports_tentpole():
    config = CONFIGS["esfna-atlanta"]

    assert config.category == "sports"
    assert config.subcategory == "festival"
    assert "sports" in config.tags
