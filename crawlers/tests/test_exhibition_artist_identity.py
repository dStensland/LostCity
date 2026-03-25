"""
Tests for unified artist identity across exhibitions and the canonical artists table.

Covers:
- _upsert_exhibition_artists includes artist_id when resolution succeeds
- _upsert_exhibition_artists proceeds gracefully when resolution raises
- get_or_create_and_enrich with discipline="visual_artist" does NOT call enrich_artist
"""

import pytest
from unittest.mock import MagicMock, patch, call


# ---------------------------------------------------------------------------
# _upsert_exhibition_artists: artist_id included on success
# ---------------------------------------------------------------------------

def test_upsert_exhibition_artists_includes_artist_id_on_success(monkeypatch):
    """When get_or_create_artist resolves, artist_id is set in the upsert payload."""
    fake_artist = {"id": "uuid-1234", "name": "Kara Walker", "slug": "kara-walker"}

    # Patch get_or_create_artist in the artists module's namespace
    monkeypatch.setattr(
        "artists.get_or_create_artist",
        lambda name, discipline="musician": fake_artist,
    )

    captured_payloads = []

    fake_table = MagicMock()
    fake_table.upsert.return_value.execute.return_value = MagicMock(data=[])

    fake_client = MagicMock()
    fake_client.table.return_value = fake_table

    import db.exhibitions as ex_module

    monkeypatch.setattr(ex_module, "writes_enabled", lambda: True)
    monkeypatch.setattr(ex_module, "get_client", lambda: fake_client)

    # Capture payload passed to upsert
    original_upsert = fake_table.upsert

    def capturing_upsert(payload, **kwargs):
        captured_payloads.extend(payload)
        return original_upsert(payload, **kwargs)

    fake_table.upsert = capturing_upsert

    ex_module._upsert_exhibition_artists(
        "exhibition-uuid-abc",
        [{"artist_name": "Kara Walker", "role": "artist"}],
    )

    assert len(captured_payloads) == 1
    row = captured_payloads[0]
    assert row["artist_id"] == "uuid-1234"
    assert row["artist_name"] == "Kara Walker"
    assert row["exhibition_id"] == "exhibition-uuid-abc"


# ---------------------------------------------------------------------------
# _upsert_exhibition_artists: graceful degradation on resolution failure
# ---------------------------------------------------------------------------

def test_upsert_exhibition_artists_proceeds_without_artist_id_on_failure(monkeypatch):
    """When get_or_create_artist raises, the row is still upserted without artist_id."""

    def exploding_resolve(name, discipline="musician"):
        raise RuntimeError("DB connection refused")

    monkeypatch.setattr("artists.get_or_create_artist", exploding_resolve)

    captured_payloads = []

    fake_table = MagicMock()
    original_upsert = fake_table.upsert

    def capturing_upsert(payload, **kwargs):
        captured_payloads.extend(payload)
        return original_upsert(payload, **kwargs)

    fake_table.upsert = capturing_upsert
    fake_table.upsert.return_value = MagicMock()
    fake_table.upsert.return_value.execute.return_value = MagicMock(data=[])

    fake_client = MagicMock()
    fake_client.table.return_value = fake_table

    import db.exhibitions as ex_module

    monkeypatch.setattr(ex_module, "writes_enabled", lambda: True)
    monkeypatch.setattr(ex_module, "get_client", lambda: fake_client)

    # Should not raise
    ex_module._upsert_exhibition_artists(
        "exhibition-uuid-xyz",
        [{"artist_name": "Benny Andrews", "role": "artist"}],
    )

    assert len(captured_payloads) == 1
    row = captured_payloads[0]
    assert "artist_id" not in row
    assert row["artist_name"] == "Benny Andrews"


# ---------------------------------------------------------------------------
# get_or_create_and_enrich: visual_artist discipline does NOT call enrich_artist
# ---------------------------------------------------------------------------

def test_get_or_create_and_enrich_skips_enrich_for_visual_artist(monkeypatch):
    """enrich_artist must not be called when discipline is 'visual_artist'."""
    import artists as artists_module

    fake_artist_row = {"id": "uuid-va-001", "name": "Radcliffe Bailey", "slug": "radcliffe-bailey"}

    monkeypatch.setattr(artists_module, "get_or_create_artist", lambda name, discipline="musician": fake_artist_row)

    enrich_called = []

    def fake_enrich(artist):
        enrich_called.append(artist)
        return artist

    monkeypatch.setattr(artists_module, "enrich_artist", fake_enrich)

    result = artists_module.get_or_create_and_enrich("Radcliffe Bailey", discipline="visual_artist")

    assert enrich_called == [], "enrich_artist must not be called for visual_artist discipline"
    assert result["id"] == "uuid-va-001"


def test_get_or_create_and_enrich_calls_enrich_for_musician(monkeypatch):
    """Sanity check: enrich_artist IS called for musician discipline."""
    import artists as artists_module

    fake_artist_row = {"id": "uuid-m-001", "name": "Leon Bridges", "slug": "leon-bridges"}

    monkeypatch.setattr(artists_module, "get_or_create_artist", lambda name, discipline="musician": fake_artist_row)

    enrich_called = []

    def fake_enrich(artist):
        enrich_called.append(artist)
        return artist

    monkeypatch.setattr(artists_module, "enrich_artist", fake_enrich)

    artists_module.get_or_create_and_enrich("Leon Bridges", discipline="musician")

    assert len(enrich_called) == 1, "enrich_artist must be called for musician discipline"
