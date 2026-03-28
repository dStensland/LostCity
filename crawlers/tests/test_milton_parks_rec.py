from sources._rec1_base import VenueInfo
from sources.milton_parks_rec import _build_destination_envelope, _build_tenant


def test_build_tenant_targets_family_tabs_only() -> None:
    tenant = _build_tenant()

    assert tenant.tenant_slug == "city-of-milton"
    assert tenant.crawl_tab_ids == ["1357", "16620", "22636", "26452", "26453", "22291"]
    assert "after camp care" in tenant.skip_group_keywords
    assert tenant.default_venue.city == "Milton"
    assert tenant.venue_enrichment_builder is _build_destination_envelope


def test_build_destination_envelope_for_default_rec_center() -> None:
    envelope = _build_destination_envelope(
        VenueInfo(
            name="City of Milton Parks & Recreation",
            slug="city-of-milton-parks-rec",
            address="2006 Heritage Walk",
            neighborhood="Milton",
            city="Milton",
            state="GA",
            zip_code="30004",
            lat=34.1642,
            lng=-84.3266,
            venue_type="recreation",
        ),
        1501,
    )

    assert envelope is not None
    assert envelope.destination_details[0]["place_id"] == 1501
    assert envelope.destination_details[0]["destination_type"] == "community_recreation_center"
    assert envelope.destination_details[0]["family_suitability"] == "yes"
    assert envelope.destination_details[0]["parking_type"] == "free_lot"
    assert envelope.destination_details[0]["practical_notes"]
    assert envelope.destination_details[0]["accessibility_notes"]
    assert {feature["slug"] for feature in envelope.venue_features} == {
        "indoor-family-recreation-space",
        "family-classes-and-seasonal-camps",
    }
