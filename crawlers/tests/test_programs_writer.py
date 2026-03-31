from types import SimpleNamespace

from db.programs import (
    _generate_disambiguated_program_slug,
    find_program_by_hash,
    insert_program,
    reset_program_identity_cache,
    update_program,
)


def test_generate_disambiguated_program_slug_stays_within_length_limit() -> None:
    reset_program_identity_cache()
    base_slug = "cobb-county-parks-recreation-camp-sewell-clay-creatives-pm-ages-10-13-summer"
    content_hash = "6c1d3459fa0c8f14566edaf9115580be"

    slug = _generate_disambiguated_program_slug(base_slug, content_hash, 0)

    assert len(slug) <= 80
    assert slug.endswith("-6c1d3459")


def test_find_program_by_hash_queries_place_id_column(monkeypatch) -> None:
    executed: dict[str, object] = {}

    class FakeQuery:
        def select(self, columns):
            executed["columns"] = columns
            return self

        def eq(self, column, value):
            executed["eq"] = (column, value)
            return self

        def limit(self, value):
            executed["limit"] = value
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeClient:
        def table(self, name):
            executed["table"] = name
            return FakeQuery()

    monkeypatch.setattr("db.programs.get_client", lambda: FakeClient())

    assert find_program_by_hash("hash-123") is None
    assert executed["table"] == "programs"
    assert executed["columns"] == "id, name, place_id, session_start, updated_at"


def test_find_program_by_identity_uses_is_null_for_null_session_start(monkeypatch) -> None:
    executed: dict[str, object] = {}

    class FakeQuery:
        def select(self, columns):
            executed["columns"] = columns
            return self

        def eq(self, column, value):
            executed.setdefault("eq", []).append((column, value))
            return self

        def is_(self, column, value):
            executed["is"] = (column, value)
            return self

        def limit(self, value):
            executed["limit"] = value
            return self

        def execute(self):
            return SimpleNamespace(data=[])

    class FakeClient:
        def table(self, name):
            executed["table"] = name
            return FakeQuery()

    monkeypatch.setattr("db.programs.get_client", lambda: FakeClient())

    from db.programs import find_program_by_identity

    assert (
        find_program_by_identity(
            name="Evergreen Swim Lessons",
            venue_id=5488,
            session_start=None,
            source_id=1315,
        )
        is None
    )
    assert executed["table"] == "programs"
    assert executed["is"] == ("session_start", "null")


def test_insert_program_retries_slug_collisions(monkeypatch) -> None:
    reset_program_identity_cache()
    calls: list[str] = []

    def fake_insert(_client, program_data):
        calls.append(program_data["slug"])
        if len(calls) < 3:
            raise Exception('duplicate key value violates unique constraint "programs_slug_key"')
        return SimpleNamespace(data=[{"id": "program-123"}])

    monkeypatch.setattr("db.programs.find_program_by_hash", lambda _hash: None)
    monkeypatch.setattr("db.programs.find_program_by_identity", lambda **_kwargs: None)
    monkeypatch.setattr("db.programs.get_client", lambda: object())
    monkeypatch.setattr("db.programs._insert_program_record", fake_insert)
    monkeypatch.setattr("db.programs.writes_enabled", lambda: True)

    program_id = insert_program(
        {
            "portal_id": "atlanta-families-portal",
            "source_id": 1,
            "place_id": 5624,
            "name": "Camp Sewell-Clay Creatives-PM-Ages 10-13",
            "description": "Arts camp",
            "program_type": "camp",
            "provider_name": "Cobb Parks",
            "age_min": 10,
            "age_max": 13,
            "season": "summer",
            "session_start": "2026-06-08",
            "status": "active",
            "metadata": {},
            "_venue_name": "Cobb County Parks & Recreation",
        }
    )

    assert program_id == "program-123"
    assert len(calls) == 3
    assert calls[0] == "cobb-county-parks-recreation-camp-sewell-clay-creatives-pm-ages-10-13-summer"
    assert calls[1].endswith("-6c1d3459")
    assert calls[2].endswith("-6c1d3459fa0c")


def test_insert_program_updates_identity_match_when_hash_metadata_missing(monkeypatch) -> None:
    reset_program_identity_cache()
    updated = {}

    monkeypatch.setattr("db.programs.find_program_by_hash", lambda _hash: None)
    monkeypatch.setattr(
        "db.programs.find_program_by_identity",
        lambda **kwargs: {"id": "program-identity"} if kwargs["name"] == "Legacy Program" else None,
    )
    monkeypatch.setattr(
        "db.programs.update_program",
        lambda program_id, payload: updated.update({"id": program_id, "payload": payload}),
    )

    program_id = insert_program(
        {
            "source_id": 1,
            "place_id": 5624,
            "name": "Legacy Program",
            "program_type": "camp",
            "session_start": "2026-06-08",
            "metadata": {"session_id": 4127902},
            "_venue_name": "Cobb County Parks & Recreation",
        }
    )

    assert program_id == "program-identity"
    assert updated["id"] == "program-identity"
    assert "content_hash" in updated["payload"]["metadata"]
    assert updated["payload"]["metadata"]["session_id"] == 4127902


def test_insert_program_uses_in_process_cache_to_avoid_same_run_duplicates(monkeypatch) -> None:
    reset_program_identity_cache()
    inserted_payloads: list[dict] = []
    updated = {}

    monkeypatch.setattr("db.programs.find_program_by_hash", lambda _hash: None)
    monkeypatch.setattr("db.programs.find_program_by_identity", lambda **_kwargs: None)
    monkeypatch.setattr("db.programs.get_client", lambda: object())
    monkeypatch.setattr("db.programs.writes_enabled", lambda: True)
    monkeypatch.setattr(
        "db.programs._insert_program_record",
        lambda _client, payload: inserted_payloads.append(dict(payload)) or SimpleNamespace(data=[{"id": "program-123"}]),
    )
    monkeypatch.setattr(
        "db.programs.update_program",
        lambda program_id, payload: updated.update({"id": program_id, "payload": payload}),
    )

    payload = {
        "portal_id": "atlanta-families-portal",
        "source_id": 1303,
        "place_id": 5624,
        "name": "Legacy Program",
        "program_type": "camp",
        "session_start": "2026-06-08",
        "metadata": {"session_id": 4127902},
        "_venue_name": "Cobb County Parks & Recreation",
    }

    assert insert_program(dict(payload)) == "program-123"
    assert insert_program(dict(payload)) == "program-123"
    assert len(inserted_payloads) == 1
    assert updated["id"] == "program-123"
    assert updated["payload"]["metadata"]["session_id"] == 4127902


def test_insert_program_overrides_stale_portal_id_from_source_owner(monkeypatch) -> None:
    reset_program_identity_cache()
    inserted_payloads: list[dict] = []

    monkeypatch.setattr("db.programs.find_program_by_hash", lambda _hash: None)
    monkeypatch.setattr("db.programs.find_program_by_identity", lambda **_kwargs: None)
    monkeypatch.setattr("db.programs.get_client", lambda: object())
    monkeypatch.setattr("db.programs.writes_enabled", lambda: True)
    monkeypatch.setattr(
        "db.programs.get_source_info",
        lambda _source_id: {"owner_portal_id": "atlanta-families-portal"},
    )
    monkeypatch.setattr(
        "db.programs._insert_program_record",
        lambda _client, payload: inserted_payloads.append(dict(payload)) or SimpleNamespace(data=[{"id": "program-456"}]),
    )

    program_id = insert_program(
        {
            "portal_id": "hooky-portal",
            "source_id": 1303,
            "place_id": 5624,
            "name": "Portal Repair Program",
            "program_type": "camp",
            "session_start": "2026-06-08",
            "metadata": {},
            "_venue_name": "Cobb County Parks & Recreation",
        }
    )

    assert program_id == "program-456"
    assert inserted_payloads[0]["portal_id"] == "atlanta-families-portal"


def test_update_program_overrides_stale_portal_id_from_source_owner(monkeypatch) -> None:
    executed: dict[str, object] = {}

    class FakeQuery:
        def update(self, payload):
            executed["payload"] = payload
            return self

        def eq(self, column, value):
            executed["eq"] = (column, value)
            return self

        def execute(self):
            executed["executed"] = True
            return SimpleNamespace(data=[])

    class FakeClient:
        def table(self, name):
            executed["table"] = name
            return FakeQuery()

    monkeypatch.setattr("db.programs.writes_enabled", lambda: True)
    monkeypatch.setattr("db.programs.get_client", lambda: FakeClient())
    monkeypatch.setattr(
        "db.programs.get_source_info",
        lambda _source_id: {"owner_portal_id": "atlanta-families-portal"},
    )

    update_program(
        "program-123",
        {
            "portal_id": "hooky-portal",
            "source_id": 1303,
            "registration_status": "open",
        },
    )

    assert executed["table"] == "programs"
    assert executed["payload"]["portal_id"] == "atlanta-families-portal"
    assert executed["eq"] == ("id", "program-123")
