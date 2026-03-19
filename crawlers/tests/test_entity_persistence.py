from entity_lanes import TypedEntityEnvelope
from entity_persistence import persist_typed_entity_envelope


def test_persist_typed_entity_envelope_resolves_destination_anchors(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "entity_persistence.get_or_create_venue",
        lambda record: 101,
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_venue_destination_details",
        lambda venue_id, details: calls.append(("details", venue_id, details)) or venue_id,
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_venue_feature",
        lambda venue_id, details: calls.append(("feature", venue_id, details)) or 55,
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_venue_special",
        lambda venue_id, details: calls.append(("special", venue_id, details["title"])) or 77,
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_editorial_mention",
        lambda venue_id, details: calls.append(
            ("mention", venue_id, details["article_url"])
        ) or 88,
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_venue_occasion",
        lambda venue_id, details: calls.append(
            ("occasion", venue_id, details["occasion"])
        ) or 89,
    )
    monkeypatch.setattr(
        "entity_persistence.insert_program",
        lambda record: calls.append(("program", record["venue_id"], record["_venue_name"])) or "program-1",
    )
    monkeypatch.setattr(
        "entity_persistence.insert_event",
        lambda record: calls.append(("event", record["venue_id"], record["title"])) or 12,
    )
    monkeypatch.setattr(
        "entity_persistence.insert_exhibition",
        lambda record, artists=None: calls.append(("exhibition", record["venue_id"], artists)) or "exh-1",
    )
    monkeypatch.setattr(
        "entity_persistence.insert_open_call",
        lambda record: calls.append(("open_call", record.get("venue_id"), record["title"])) or "call-1",
    )
    monkeypatch.setattr(
        "entity_persistence.upsert_volunteer_opportunity",
        lambda record: calls.append(
            ("volunteer_opportunity", record["organization_slug"], record["title"])
        ) or "opp-1",
    )

    envelope = TypedEntityEnvelope(
        destinations=[
            {
                "name": "High Museum",
                "slug": "high-museum",
                "city": "Atlanta",
                "state": "GA",
                "venue_type": "museum",
            }
        ],
        destination_details=[
            {
                "destination_slug": "high-museum",
                "destination_type": "museum",
                "commitment_tier": "halfday",
            }
        ],
        venue_features=[
            {
                "destination_slug": "high-museum",
                "title": "Roof Garden",
                "feature_type": "experience",
            }
        ],
        venue_specials=[
            {
                "destination_slug": "high-museum",
                "title": "Friday Happy Hour",
                "type": "happy_hour",
            }
        ],
        editorial_mentions=[
            {
                "destination_slug": "high-museum",
                "source_key": "eater_atlanta",
                "article_url": "https://example.com/high-museum-guide",
                "article_title": "The High Museum Guide",
                "mention_type": "guide_inclusion",
            }
        ],
        venue_occasions=[
            {
                "destination_slug": "high-museum",
                "occasion": "family_friendly",
                "source": "editorial",
                "confidence": 0.91,
            }
        ],
        programs=[
            {
                "destination_slug": "high-museum",
                "name": "Spring Art Camp",
                "program_type": "camp",
            }
        ],
        events=[
            {
                "destination_slug": "high-museum",
                "title": "Friday Jazz",
                "start_date": "2026-04-01",
                "source_url": "https://example.com/friday-jazz",
                "category": "music",
            }
        ],
        exhibitions=[
            {
                "destination_slug": "high-museum",
                "title": "Lines of Motion",
                "artists": [{"artist_name": "Artist One"}],
            }
        ],
        open_calls=[
            {
                "destination_slug": "high-museum",
                "title": "Artist Residency",
                "application_url": "https://example.com/apply",
                "call_type": "residency",
            }
        ],
        volunteer_opportunities=[
            {
                "organization_slug": "high-museum-volunteers",
                "slug": "high-museum-greeter",
                "title": "Gallery Greeter",
                "application_url": "https://example.com/volunteer",
                "commitment_level": "ongoing",
            }
        ],
    )

    result = persist_typed_entity_envelope(envelope)

    assert result.persisted["destinations"] == 1
    assert result.persisted["destination_details"] == 1
    assert result.persisted["venue_features"] == 1
    assert result.persisted["venue_specials"] == 1
    assert result.persisted["editorial_mentions"] == 1
    assert result.persisted["venue_occasions"] == 1
    assert result.persisted["programs"] == 1
    assert result.persisted["events"] == 1
    assert result.persisted["exhibitions"] == 1
    assert result.persisted["open_calls"] == 1
    assert result.persisted["volunteer_opportunities"] == 1
    assert ("details", 101, envelope.destination_details[0]) in calls
    assert ("feature", 101, envelope.venue_features[0]) in calls
    assert ("special", 101, "Friday Happy Hour") in calls
    assert ("mention", 101, "https://example.com/high-museum-guide") in calls
    assert ("occasion", 101, "family_friendly") in calls
    assert ("program", 101, "High Museum") in calls
    assert (
        "volunteer_opportunity",
        "high-museum-volunteers",
        "Gallery Greeter",
    ) in calls


def test_persist_typed_entity_envelope_reports_unsupported_and_unresolved_lanes(monkeypatch):
    monkeypatch.setattr("entity_persistence.get_or_create_venue", lambda record: 0)
    monkeypatch.setattr("entity_persistence.insert_event", lambda record: None)
    monkeypatch.setattr("entity_persistence.insert_program", lambda record: None)
    monkeypatch.setattr("entity_persistence.insert_exhibition", lambda record, artists=None: None)
    monkeypatch.setattr("entity_persistence.insert_open_call", lambda record: None)
    monkeypatch.setattr("entity_persistence.upsert_venue_feature", lambda venue_id, details: None)
    monkeypatch.setattr("entity_persistence.upsert_venue_special", lambda venue_id, details: None)
    monkeypatch.setattr("entity_persistence.upsert_editorial_mention", lambda venue_id, details: None)
    monkeypatch.setattr("entity_persistence.upsert_venue_occasion", lambda venue_id, details: None)
    monkeypatch.setattr("entity_persistence.upsert_venue_destination_details", lambda venue_id, details: None)
    monkeypatch.setattr("entity_persistence.upsert_volunteer_opportunity", lambda record: None)

    envelope = TypedEntityEnvelope(
        destination_details=[{"destination_slug": "missing"}],
        venue_specials=[{"title": "Happy Hour"}],
        editorial_mentions=[{"article_url": "https://example.com/guide"}],
        venue_occasions=[{"occasion": "date_night"}],
        volunteer_opportunities=[{"title": "Volunteer Day"}],
    )

    result = persist_typed_entity_envelope(envelope)

    assert result.skipped["destination_details"] == 1
    assert result.skipped["venue_specials"] == 1
    assert result.skipped["editorial_mentions"] == 1
    assert result.skipped["venue_occasions"] == 1
    assert result.skipped["volunteer_opportunities"] == 1
    assert "destination_details" in result.unresolved
    assert "venue_specials" in result.unresolved
    assert "editorial_mentions" in result.unresolved
    assert "venue_occasions" in result.unresolved
    assert "volunteer_opportunities" in result.unresolved
