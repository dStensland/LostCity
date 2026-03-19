from __future__ import annotations

import sys
from types import SimpleNamespace


class _FakeVenueUpdateQuery:
    def __init__(self, client):
        self.client = client

    def eq(self, field, value):
        self.client.eq_calls.append((field, value))
        return self

    def execute(self):
        self.client.executed = True
        return SimpleNamespace(data=[{"id": 1}])


class _FakeVenueTable:
    def __init__(self, client):
        self.client = client

    def update(self, payload):
        self.client.updates.append(payload)
        return _FakeVenueUpdateQuery(self.client)


class _FakeClient:
    def __init__(self):
        self.updates = []
        self.eq_calls = []
        self.executed = False

    def table(self, name):
        assert name == "venues"
        return _FakeVenueTable(self)


def test_ensure_venue_destination_fields_updates_missing_planning(monkeypatch):
    import source_destination_sync as sync

    client = _FakeClient()
    monkeypatch.setattr(
        sync,
        "_fetch_venue_row",
        lambda venue_id: {
            "id": venue_id,
            "slug": "the-earl",
            "name": "The EARL",
            "planning_notes": None,
            "description": None,
            "short_description": None,
            "image_url": None,
        },
    )
    monkeypatch.setattr(sync, "get_client", lambda: client)
    monkeypatch.setattr(sync, "writes_enabled", lambda: True)

    updated = sync.ensure_venue_destination_fields(
        42,
        planning_notes="Arrive early for dinner and room position.",
    )

    assert updated is True
    assert client.executed is True
    assert client.eq_calls == [("id", 42)]
    assert client.updates[0]["planning_notes"] == "Arrive early for dinner and room position."
    assert "last_verified_at" in client.updates[0]


def test_ensure_venue_destination_fields_leaves_existing_planning_without_force(monkeypatch):
    import source_destination_sync as sync

    client = _FakeClient()
    monkeypatch.setattr(
        sync,
        "_fetch_venue_row",
        lambda venue_id: {
            "id": venue_id,
            "slug": "helium-comedy",
            "name": "Helium Comedy Club Atlanta",
            "planning_notes": "Existing planning note.",
            "description": None,
            "short_description": None,
            "image_url": None,
        },
    )
    monkeypatch.setattr(sync, "get_client", lambda: client)
    monkeypatch.setattr(sync, "writes_enabled", lambda: True)

    updated = sync.ensure_venue_destination_fields(
        77,
        planning_notes="New planning note.",
    )

    assert updated is False
    assert client.updates == []


def test_refresh_venue_specials_from_website_skips_fresh_venues(monkeypatch):
    import source_destination_sync as sync

    fake_specials_module = SimpleNamespace(
        get_venues=lambda venue_ids, limit=1: [
            {
                "id": venue_ids[0],
                "slug": "the-vortex",
                "name": "The Vortex Bar & Grill",
                "website": "https://www.thevortexatl.com",
                "last_verified_at": "2026-03-17T10:00:00",
            }
        ],
        scrape_venue=lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not scrape fresh venue")),
        upsert_results=lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError("should not upsert fresh venue")),
    )
    monkeypatch.setitem(sys.modules, "scrape_venue_specials", fake_specials_module)

    class _FrozenDatetime:
        @staticmethod
        def utcnow():
            from datetime import datetime

            return datetime(2026, 3, 17, 12, 0, 0)

        @staticmethod
        def fromisoformat(value):
            from datetime import datetime

            return datetime.fromisoformat(value)

    monkeypatch.setattr(sync, "datetime", _FrozenDatetime)

    stats = sync.refresh_venue_specials_from_website(99, max_age_days=7)

    assert stats == {"skipped": "fresh"}
