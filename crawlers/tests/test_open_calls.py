from types import SimpleNamespace


def test_insert_open_call_updates_existing_record_on_base_slug_conflict(monkeypatch):
    import db.open_calls as open_calls

    updates = []

    monkeypatch.setattr(open_calls, "writes_enabled", lambda: True)
    monkeypatch.setattr(open_calls, "find_open_call_by_hash", lambda _hash: None)
    monkeypatch.setattr(
        open_calls,
        "find_open_call_by_slug",
        lambda slug: {
            "id": "existing-base",
            "slug": slug,
            "application_url": "https://example.com/apply",
            "metadata": {},
        },
    )
    monkeypatch.setattr(open_calls, "update_open_call", lambda call_id, payload: updates.append((call_id, payload)))
    monkeypatch.setattr(open_calls, "get_client", lambda: object())

    def fail_insert(_client, _payload):
        raise Exception('duplicate key value violates unique constraint "open_calls_slug_key"')

    monkeypatch.setattr(open_calls, "_insert_open_call_record", fail_insert)

    inserted_id = open_calls.insert_open_call(
        {
            "title": "Writer Advice Flash Fiction Contest",
            "application_url": "https://example.com/apply",
            "call_type": "submission",
            "_org_name": "Writer Advice",
        }
    )

    assert inserted_id == "existing-base"
    assert updates[0][0] == "existing-base"


def test_insert_open_call_updates_existing_record_on_slug_fix_conflict(monkeypatch):
    import db.open_calls as open_calls

    updates = []
    content_hash = open_calls.generate_open_call_hash(
        "Writer Advice Flash Fiction Contest",
        "https://example.com/apply",
    )
    expected_slug = f"writer-advice-writer-advice-flash-fiction-contest-{content_hash[:6]}"

    monkeypatch.setattr(open_calls, "writes_enabled", lambda: True)
    monkeypatch.setattr(open_calls, "find_open_call_by_hash", lambda _hash: None)

    def find_by_slug(slug):
        if slug == expected_slug:
            return {
                "id": "existing-fixed",
                "slug": slug,
                "application_url": "https://example.com/apply",
                "metadata": {"content_hash": content_hash},
            }
        return None

    monkeypatch.setattr(open_calls, "find_open_call_by_slug", find_by_slug)
    monkeypatch.setattr(open_calls, "update_open_call", lambda call_id, payload: updates.append((call_id, payload)))
    monkeypatch.setattr(open_calls, "get_client", lambda: object())

    def fail_insert(_client, _payload):
        raise Exception('duplicate key value violates unique constraint "open_calls_slug_key"')

    monkeypatch.setattr(open_calls, "_insert_open_call_record", fail_insert)

    inserted_id = open_calls.insert_open_call(
        {
            "title": "Writer Advice Flash Fiction Contest",
            "application_url": "https://example.com/apply",
            "call_type": "submission",
            "_org_name": "Writer Advice",
        }
    )

    assert inserted_id == "existing-fixed"
    assert updates[0][0] == "existing-fixed"
