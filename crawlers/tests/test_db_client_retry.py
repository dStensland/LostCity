from __future__ import annotations

from types import SimpleNamespace



def _fake_config():
    return SimpleNamespace(
        database=SimpleNamespace(
            missing_active_credentials=lambda: [],
            active_target="production",
            active_supabase_url="https://example.supabase.co",
            active_supabase_service_key="test-key",
        )
    )


class _FakeQuery:
    def __init__(self, client):
        self.client = client

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    @property
    def not_(self):
        return self

    def is_(self, *_args, **_kwargs):
        return self

    def execute(self):
        self.client.execute_attempts += 1
        if self.client.raise_exc is not None:
            raise self.client.raise_exc
        if self.client.fail_first and self.client.execute_attempts == 1:
            raise OSError(35, "Resource temporarily unavailable")
        return SimpleNamespace(data=[{"id": 1}])


class _FakeClient:
    def __init__(self, *, fail_first: bool = False, raise_exc: Exception | None = None):
        self.fail_first = fail_first
        self.raise_exc = raise_exc
        self.execute_attempts = 0
        self.table_calls: list[str] = []

    def table(self, name: str):
        self.table_calls.append(name)
        return _FakeQuery(self)


class _TrackingSemaphore:
    def __init__(self):
        self.enter_count = 0
        self.exit_count = 0

    def __enter__(self):
        self.enter_count += 1
        return self

    def __exit__(self, exc_type, exc, tb):
        self.exit_count += 1
        return False


def test_get_client_retries_transient_execute_failures(monkeypatch):
    import db.client as dbc

    fake_client = _FakeClient(fail_first=True)
    sleeps: list[float] = []

    monkeypatch.setattr(dbc, "get_config", _fake_config)
    monkeypatch.setattr(dbc, "create_client", lambda *_args, **_kwargs: fake_client)
    monkeypatch.setattr(dbc.time, "sleep", lambda seconds: sleeps.append(seconds))
    dbc.reset_client()

    try:
        result = (
            dbc.get_client()
            .table("events")
            .select("id")
            .eq("id", 1)
            .execute()
        )
    finally:
        dbc.reset_client()

    assert result.data == [{"id": 1}]
    assert fake_client.execute_attempts == 2
    assert len(fake_client.table_calls) >= 2
    assert set(fake_client.table_calls) == {"events"}
    assert sleeps == [0.5]


def test_get_client_query_proxy_supports_property_chains(monkeypatch):
    import db.client as dbc

    fake_client = _FakeClient()

    monkeypatch.setattr(dbc, "get_config", _fake_config)
    monkeypatch.setattr(dbc, "create_client", lambda *_args, **_kwargs: fake_client)
    dbc.reset_client()

    try:
        result = (
            dbc.get_client()
            .table("places")
            .select("id")
            .not_
            .is_("website", "null")
            .execute()
        )
    finally:
        dbc.reset_client()

    assert result.data == [{"id": 1}]
    assert fake_client.execute_attempts == 1


def test_get_client_does_not_retry_non_transient_execute_failures(monkeypatch):
    import db.client as dbc

    fake_client = _FakeClient(raise_exc=ValueError("bad payload"))
    sleeps: list[float] = []

    monkeypatch.setattr(dbc, "get_config", _fake_config)
    monkeypatch.setattr(dbc, "create_client", lambda *_args, **_kwargs: fake_client)
    monkeypatch.setattr(dbc.time, "sleep", lambda seconds: sleeps.append(seconds))
    dbc.reset_client()

    try:
        try:
            dbc.get_client().table("events").select("id").execute()
            assert False, "expected ValueError"
        except ValueError as exc:
            assert str(exc) == "bad payload"
    finally:
        dbc.reset_client()

    assert fake_client.execute_attempts == 1
    assert sleeps == []


def test_get_client_execute_uses_backpressure_semaphore(monkeypatch):
    import db.client as dbc

    fake_client = _FakeClient()
    tracking = _TrackingSemaphore()

    monkeypatch.setattr(dbc, "get_config", _fake_config)
    monkeypatch.setattr(dbc, "create_client", lambda *_args, **_kwargs: fake_client)
    monkeypatch.setattr(dbc, "_DB_EXECUTE_SEMAPHORE", tracking)
    dbc.reset_client()

    try:
        result = dbc.get_client().table("events").select("id").execute()
    finally:
        dbc.reset_client()

    assert result.data == [{"id": 1}]
    assert tracking.enter_count == 1
    assert tracking.exit_count == 1
