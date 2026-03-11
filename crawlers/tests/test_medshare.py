from sources.medshare import (
    _build_volunteer_session_title,
    _legacy_volunteer_session_title,
    _sync_existing_volunteer_session,
    _volunteer_session_tags,
)
from dedupe import generate_content_hash


def test_build_volunteer_session_title_is_descriptive_and_12_hour():
    session = {"day": "Thursday", "start_time": "13:00", "end_time": "16:00"}

    assert (
        _build_volunteer_session_title(session)
        == "Medical Supply Volunteer Session - Thursday 1:00 PM"
    )


def test_legacy_volunteer_session_title_preserves_existing_hash_shape():
    session = {"day": "Thursday", "start_time": "13:00", "end_time": "16:00"}

    legacy_title = _legacy_volunteer_session_title(session)

    assert legacy_title == "Volunteer Session - Thursday 13:00 PM"
    assert generate_content_hash(legacy_title, "MedShare", "2026-03-12") == (
        "b58e30b69231d1bd20866886853e62e7"
    )


def test_sync_existing_volunteer_session_updates_title_before_shared_update(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "sources.medshare.update_event",
        lambda event_id, payload: calls.append(("update", event_id, payload)),
    )
    monkeypatch.setattr(
        "sources.medshare.smart_update_existing_event",
        lambda existing, incoming: calls.append(("smart", existing["title"], incoming["title"])),
    )

    _sync_existing_volunteer_session(
        {"id": 42, "title": "Volunteer Session - Thursday 13:00 PM"},
        {"title": "Medical Supply Volunteer Session - Thursday 1:00 PM"},
    )

    assert calls == [
        (
            "update",
            42,
            {
                "title": "Medical Supply Volunteer Session - Thursday 1:00 PM",
                "tags": _volunteer_session_tags(),
            },
        ),
        (
            "smart",
            "Medical Supply Volunteer Session - Thursday 1:00 PM",
            "Medical Supply Volunteer Session - Thursday 1:00 PM",
        ),
    ]


def test_sync_existing_volunteer_session_scrubs_stale_fundraiser_tag(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "sources.medshare.update_event",
        lambda event_id, payload: calls.append(("update", event_id, payload)),
    )
    monkeypatch.setattr(
        "sources.medshare.smart_update_existing_event",
        lambda existing, incoming: calls.append(("smart", existing["tags"], incoming["tags"])),
    )

    _sync_existing_volunteer_session(
        {
            "id": 99,
            "title": "Medical Supply Volunteer Session - Thursday 1:00 PM",
            "tags": [
                "volunteer",
                "medical-supplies",
                "global-health",
                "family-friendly",
                "youth-welcome",
                "near-emory",
                "fundraiser",
            ],
        },
        {
            "title": "Medical Supply Volunteer Session - Thursday 1:00 PM",
            "tags": _volunteer_session_tags(),
        },
    )

    assert calls == [
        ("update", 99, {"tags": _volunteer_session_tags()}),
        ("smart", _volunteer_session_tags(), _volunteer_session_tags()),
    ]
