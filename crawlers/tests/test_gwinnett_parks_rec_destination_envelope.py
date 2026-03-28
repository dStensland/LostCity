from sources._rec1_base import VenueInfo
from sources.gwinnett_parks_rec import _build_destination_envelope


def test_build_destination_envelope_for_rec_center() -> None:
    envelope = _build_destination_envelope(
        VenueInfo(
            name="Bogan Park Community Recreation Center",
            slug="bogan-park-crc",
            address="2723 N Bogan Rd",
            neighborhood="Buford",
            city="Buford",
            state="GA",
            zip_code="30519",
            lat=34.0979,
            lng=-83.9948,
            venue_type="community_center",
        ),
        901,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 901
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }


def test_build_destination_envelope_for_park() -> None:
    envelope = _build_destination_envelope(
        VenueInfo(
            name="Shorty Howell Park",
            slug="shorty-howell-park",
            address="2750 Pleasant Hill Rd",
            neighborhood="Duluth",
            city="Duluth",
            state="GA",
            zip_code="30096",
            lat=33.9796,
            lng=-84.1245,
            venue_type="park",
        ),
        902,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 902
    assert envelope.destination_details[0]["destination_type"] == "park"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert envelope.venue_features[0]["slug"] == "free-outdoor-play-space"
