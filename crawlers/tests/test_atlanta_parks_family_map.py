import pytest

from sources.atlanta_parks_family_map import (
    _build_overlay_envelope,
    _catalog_entries,
    _parse_official_park_feature,
)


def test_catalog_entries_merge_playground_and_splash_overlays() -> None:
    entries = {entry["slug"]: entry for entry in _catalog_entries()}

    center_hill = entries["center-hill-park"]
    assert center_hill["overlay_types"] == {"playground", "water_play"}

    washington = entries["washington-park-aquatic-center"]
    assert washington["destination_type"] == "aquatic_center"
    assert washington["overlay_types"] == {"water_play"}

    chastain = entries["chastain-park"]
    assert chastain["official_lookup_name"] == "Chastain Memorial Park"

    assert "crawford-long-middle-school" not in entries
    assert "atlanta-childrens-theme-park" not in entries
    assert "civic-center-playground" not in entries


def test_build_overlay_envelope_adds_generic_features() -> None:
    entry = {
        "name": "Center Hill Park",
        "slug": "center-hill-park",
        "destination_type": "park",
        "overlay_types": {"playground", "water_play"},
        "source_labels": ["Center Hill Park"],
    }

    envelope = _build_overlay_envelope(
        entry,
        venue_id=41,
        add_destination_details=True,
        add_playground_feature=True,
        add_water_play_feature=True,
    )

    assert envelope.destination_details[0]["destination_type"] == "park"
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "official-city-playground",
        "official-city-splash-pad",
    }


def test_build_overlay_envelope_marks_aquatic_center() -> None:
    entry = {
        "name": "Washington Park Aquatic Center",
        "slug": "washington-park-aquatic-center",
        "destination_type": "aquatic_center",
        "overlay_types": {"water_play"},
        "source_labels": ["ATL Natatorium at Washington Park"],
    }

    envelope = _build_overlay_envelope(
        entry,
        venue_id=84,
        add_destination_details=True,
        add_playground_feature=False,
        add_water_play_feature=True,
    )

    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.venue_features[0]["slug"] == "official-city-splash-pad"


def test_parse_official_park_feature_reads_address_and_centroid() -> None:
    feature = {
        "attributes": {
            "NAME": "Anderson Park",
            "ADDRESS": "98 Anderson Ave. NW",
            "ZIP": "30314",
            "NEIGHBOR": "Dixie Hills",
        },
        "geometry": {
            "rings": [
                [
                    [-84.451, 33.759],
                    [-84.449, 33.759],
                    [-84.449, 33.758],
                    [-84.451, 33.758],
                    [-84.451, 33.759],
                ]
            ]
        },
    }

    parsed = _parse_official_park_feature(feature)

    assert parsed["name"] == "Anderson Park"
    assert parsed["address"] == "98 Anderson Ave. NW"
    assert parsed["city"] == "Atlanta"
    assert parsed["state"] == "GA"
    assert parsed["zip"] == "30314"
    assert parsed["neighborhood"] == "Dixie Hills"
    assert parsed["lng"] == pytest.approx(-84.45)
    assert parsed["lat"] == pytest.approx(33.7585)
