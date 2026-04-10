"""Tests for venue feature type validation."""


def test_valid_feature_types_constant_exists():
    """_VALID_FEATURE_TYPES must exist and match the TypeScript FeatureType union."""
    from db.places import _VALID_FEATURE_TYPES

    expected = {"attraction", "exhibition", "collection", "experience", "amenity"}
    assert _VALID_FEATURE_TYPES == expected


def test_valid_feature_types_excludes_space():
    """'space' is not a valid feature type — should be mapped to 'amenity'."""
    from db.places import _VALID_FEATURE_TYPES

    assert "space" not in _VALID_FEATURE_TYPES
