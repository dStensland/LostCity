from types import SimpleNamespace

from db.programs import (
    _extract_program_identity_seed,
    _generate_disambiguated_program_slug,
    build_program_family_key,
    find_program_by_hash,
    find_program_by_identity,
    generate_program_hash,
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


def test_find_program_by_identity_prefers_activity_id_over_session_start(monkeypatch) -> None:
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

    assert (
        find_program_by_identity(
            name="Developmental Swim Team",
            venue_id=5436,
            session_start="2026-03-27",
            source_id=1437,
            metadata={"activity_id": 11874},
        )
        is None
    )
    assert ("metadata->>activity_id", "11874") in executed["eq"]
    assert ("session_start", "2026-03-27") not in executed["eq"]


def test_generate_program_hash_prefers_stable_identity_seed() -> None:
    stable_a = generate_program_hash(
        "Developmental Swim Team",
        5436,
        "2026-03-27",
        source_id=1437,
        identity_seed="activity_id:11874",
    )
    stable_b = generate_program_hash(
        "Developmental Swim Team",
        5436,
        "2026-03-28",
        source_id=1437,
        identity_seed="activity_id:11874",
    )

    assert stable_a == stable_b


def test_extract_program_identity_seed_prefers_activity_id() -> None:
    assert _extract_program_identity_seed({"activity_id": 11874, "session_id": 999}) == "activity_id:11874"


def test_build_program_family_key_is_stable_across_session_dates() -> None:
    program_a = {
        "source_id": 1305,
        "place_id": 5657,
        "name": "Code Coaching for Kids at theCoderSchool Marietta",
        "provider_name": "theCoderSchool Atlanta",
        "program_type": "enrichment",
        "season": "spring",
        "age_min": 8,
        "age_max": 14,
        "session_start": "2026-03-16",
    }
    program_b = {**program_a, "session_start": "2026-04-06"}

    assert build_program_family_key(program_a) == build_program_family_key(program_b)


def test_build_program_family_key_separates_age_bands() -> None:
    toddler = {
        "source_id": 1306,
        "place_id": 5611,
        "name": "Baby Blue Swim Lessons",
        "provider_name": "Big Blue Swim Johns Creek",
        "program_type": "class",
        "season": "spring",
        "age_min": 1,
        "age_max": 2,
    }
    preschool = {**toddler, "age_min": 3, "age_max": 5}

    assert build_program_family_key(toddler) != build_program_family_key(preschool)


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
    assert "program_family_key" in updated["payload"]["metadata"]
    assert updated["payload"]["metadata"]["session_id"] == 4127902


def test_insert_program_uses_activity_id_as_stable_identity(monkeypatch) -> None:
    reset_program_identity_cache()
    updated = {}

    monkeypatch.setattr("db.programs.find_program_by_hash", lambda _hash: None)
    monkeypatch.setattr(
        "db.programs.find_program_by_identity",
        lambda **kwargs: {"id": "program-activity"} if kwargs["metadata"]["activity_id"] == 11874 else None,
    )
    monkeypatch.setattr(
        "db.programs.update_program",
        lambda program_id, payload: updated.update({"id": program_id, "payload": payload}),
    )

    program_id = insert_program(
        {
            "source_id": 1437,
            "place_id": 5436,
            "name": "2025/2026 Developmental Swim Team-CTM",
            "program_type": "class",
            "session_start": "2026-03-27",
            "metadata": {"activity_id": 11874},
            "_venue_name": "CT Martin Recreation & Aquatic Center",
        }
    )

    assert program_id == "program-activity"
    assert updated["payload"]["metadata"]["activity_id"] == 11874
    assert "content_hash" in updated["payload"]["metadata"]
    assert "program_family_key" in updated["payload"]["metadata"]


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
