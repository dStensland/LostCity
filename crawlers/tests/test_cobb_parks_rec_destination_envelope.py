from sources._rec1_base import VenueInfo
from sources.cobb_parks_rec import _DEFAULT_VENUE, _build_destination_envelope


def test_build_destination_envelope_for_cobb_aquatic_center() -> None:
    envelope = _build_destination_envelope(
        VenueInfo(
            name="Cobb Aquatic Center",
            slug="cobb-aquatic-center",
            address="3996 South Hurt Rd SW",
            neighborhood="Smyrna",
            city="Smyrna",
            state="GA",
            zip_code="30082",
            lat=33.8593,
            lng=-84.5219,
            venue_type="recreation",
        ),
        1301,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["venue_id"] == 1301
    assert envelope.destination_details[0]["destination_type"] == "aquatic_center"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.venue_features[0]["slug"] == "public-pool-and-aquatics-programs"


def test_build_destination_envelope_for_cobb_rec_center() -> None:
    envelope = _build_destination_envelope(
        VenueInfo(
            name="Smyrna Recreation Center",
            slug="smyrna-recreation-center",
            address="200 Village Green Circle SE",
            neighborhood="Smyrna",
            city="Smyrna",
            state="GA",
            zip_code="30082",
            lat=33.8836,
            lng=-84.5144,
            venue_type="recreation",
        ),
        1302,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["venue_id"] == 1302
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"


def test_default_cobb_fallback_is_not_modeled_as_destination() -> None:
    assert _DEFAULT_VENUE.slug == "cobb-county-parks-recreation"
    assert _DEFAULT_VENUE.venue_type == "organization"
