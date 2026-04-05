from scripts.repair_program_identities import (
    ProgramIdentity,
    _metadata_updates,
    build_identity,
    rank_program_row,
    select_duplicate_deletes,
)


def test_build_identity_uses_source_portal_venue_name_and_session() -> None:
    row = {
        "id": "program-1",
        "source_id": 11,
        "portal_id": "atlanta-families-portal",
        "place_id": 22,
        "name": "Spring Swim Lessons",
        "session_start": "2026-03-23",
        "metadata": {},
    }

    assert build_identity(row) == ProgramIdentity(
        source_id=11,
        portal_id="atlanta-families-portal",
        venue_id=22,
        name="Spring Swim Lessons",
        identity_token="2026-03-23",
    )


def test_build_identity_prefers_activity_id_over_session_start() -> None:
    row = {
        "id": "program-2",
        "source_id": 1437,
        "portal_id": "atlanta-families-portal",
        "place_id": 5436,
        "name": "Developmental Swim Team",
        "session_start": "2026-03-23",
        "metadata": {"activity_id": 11874},
    }

    assert build_identity(row) == ProgramIdentity(
        source_id=1437,
        portal_id="atlanta-families-portal",
        venue_id=5436,
        name="Developmental Swim Team",
        identity_token="activity_id:11874",
    )


def test_rank_program_row_prefers_richer_program_data() -> None:
    legacy = {
        "id": "legacy",
        "metadata": {},
        "schedule_days": None,
        "registration_opens": None,
        "registration_closes": None,
        "updated_at": "2026-03-15T11:00:00+00:00",
        "created_at": "2026-03-01T11:00:00+00:00",
    }
    rich = {
        "id": "rich",
        "metadata": {"activity_id": 11874, "session_id": 4127902, "content_hash": "abc123"},
        "schedule_days": [1, 3],
        "registration_opens": "2026-01-28",
        "registration_closes": "2026-04-06",
        "updated_at": "2026-03-10T11:00:00+00:00",
        "created_at": "2026-03-01T11:00:00+00:00",
    }

    assert rank_program_row(rich) > rank_program_row(legacy)


def test_select_duplicate_deletes_keeps_best_program_row() -> None:
    rows = [
        {
            "id": "keep-me",
            "source_id": 1,
            "portal_id": "atlanta-families-portal",
            "place_id": 5624,
            "name": "Level 1 - Mon 3:30 - 8 weeks",
            "session_start": "2026-03-23",
            "schedule_days": [1],
            "registration_opens": "2026-01-28",
            "registration_closes": "2026-04-06",
            "metadata": {"activity_id": 11874, "session_id": 4127902, "content_hash": "hash-1"},
            "updated_at": "2026-03-15T12:00:00+00:00",
            "created_at": "2026-03-01T12:00:00+00:00",
        },
        {
            "id": "delete-me",
            "source_id": 1,
            "portal_id": "atlanta-families-portal",
            "place_id": 5624,
            "name": "Level 1 - Mon 3:30 - 8 weeks",
            "session_start": "2026-03-24",
            "schedule_days": None,
            "registration_opens": None,
            "registration_closes": None,
            "metadata": {"activity_id": 11874},
            "updated_at": "2026-03-14T12:00:00+00:00",
            "created_at": "2026-03-01T10:00:00+00:00",
        },
        {
            "id": "keep-too",
            "source_id": 1,
            "portal_id": "atlanta-families-portal",
            "place_id": 5625,
            "name": "Different Program",
            "session_start": "2026-03-24",
            "schedule_days": None,
            "registration_opens": None,
            "registration_closes": None,
            "metadata": {"content_hash": "hash-2"},
            "updated_at": "2026-03-14T12:00:00+00:00",
            "created_at": "2026-03-01T10:00:00+00:00",
        },
    ]

    assert select_duplicate_deletes(rows) == ["delete-me"]


def test_metadata_updates_backfills_program_family_key() -> None:
    rows = [
        {
            "id": "program-1",
            "source_id": 1305,
            "portal_id": "atlanta-families-portal",
            "place_id": 5657,
            "name": "Code Coaching for Kids at theCoderSchool Marietta",
            "provider_name": "theCoderSchool Atlanta",
            "program_type": "enrichment",
            "age_min": 8,
            "age_max": 14,
            "season": "spring",
            "session_start": "2026-03-16",
            "metadata": {"content_hash": "hash-1"},
        }
    ]

    updates, content_hash_updates, family_key_updates = _metadata_updates(rows)

    assert len(updates) == 1
    assert content_hash_updates == 0
    assert family_key_updates == 1
    assert updates[0][1]["program_family_key"]
