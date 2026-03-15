from entity_lanes import (
    DESTINATION_ATTACHMENT_LANES,
    SourceEntityCapabilities,
    TypedEntityEnvelope,
)


def test_source_entity_capabilities_report_enabled_lanes():
    capabilities = SourceEntityCapabilities(
        destinations=True,
        destination_details=True,
        events=True,
        programs=True,
        venue_features=True,
    )

    assert capabilities.enabled_lanes() == (
        "destinations",
        "destination_details",
        "events",
        "programs",
        "venue_features",
    )


def test_typed_entity_envelope_tracks_non_empty_lanes_and_destination_attachments():
    envelope = TypedEntityEnvelope()
    envelope.add("destinations", {"slug": "high-museum"})
    envelope.add("destination_details", {"destination_type": "museum"})
    envelope.extend("events", [{"title": "Friday Jazz"}, {"title": "Family Day"}])
    envelope.add("venue_features", {"title": "Roof Garden"})

    assert envelope.has_records() is True
    assert envelope.has_destination_attachments() is True
    assert DESTINATION_ATTACHMENT_LANES[-1] == "venue_occasions"
    assert envelope.counts()["events"] == 2
    assert set(envelope.non_empty_lanes()) == {
        "destinations",
        "destination_details",
        "events",
        "venue_features",
    }
