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


def test_upsert_venue_feature_row_includes_new_columns():
    """upsert_venue_feature must include all 7 new schema columns."""
    import inspect
    from db.places import upsert_venue_feature

    source = inspect.getsource(upsert_venue_feature)
    for col in ["source_id", "portal_id", "admission_type", "admission_url", "source_url", "tags", "metadata"]:
        assert f'"{col}"' in source, f"upsert_venue_feature must include '{col}'"


def test_upsert_venue_feature_does_not_null_overwrite_image():
    """When image_url is None in incoming data, it should be omitted from upsert."""
    import inspect
    from db.places import upsert_venue_feature

    source = inspect.getsource(upsert_venue_feature)
    assert "protect_field" in source or ("image_url" in source and "pop" in source), (
        "upsert_venue_feature must protect existing image_url from NULL overwrite"
    )
