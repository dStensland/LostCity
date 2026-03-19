from types import SimpleNamespace

from db import sources as source_db


def test_refresh_available_filters_prefers_direct_sql(monkeypatch):
    calls = []

    monkeypatch.setattr(source_db, "writes_enabled", lambda: True)
    monkeypatch.setattr(source_db, "_run_direct_sql", lambda sql, params=None: calls.append((sql, params)))
    monkeypatch.setattr(source_db, "get_client", lambda: (_ for _ in ()).throw(AssertionError("RPC fallback should not run")))

    assert source_db.refresh_available_filters() is True
    assert calls == [("SELECT refresh_available_filters();", None)]


def test_refresh_search_suggestions_prefers_direct_sql(monkeypatch):
    calls = []
    fake_when = object()

    monkeypatch.setattr(source_db, "writes_enabled", lambda: True)
    monkeypatch.setattr(source_db, "_run_direct_sql", lambda sql, params=None: calls.append((sql, params)))
    monkeypatch.setattr(source_db, "get_client", lambda: (_ for _ in ()).throw(AssertionError("RPC fallback should not run")))

    assert source_db.refresh_search_suggestions("Atlanta", since=fake_when) is True
    assert calls == [("SELECT refresh_search_suggestions_incremental(%s, %s);", ("Atlanta", fake_when))]


def test_refresh_search_suggestions_falls_back_to_rpc(monkeypatch):
    calls = []

    class _FakeRpc:
        def execute(self):
            calls.append("execute")
            return SimpleNamespace(data=None)

    class _FakeClient:
        def rpc(self, name, payload):
            calls.append((name, payload))
            return _FakeRpc()

    monkeypatch.setattr(source_db, "writes_enabled", lambda: True)
    monkeypatch.setattr(source_db, "_run_direct_sql", lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("db unavailable")))
    monkeypatch.setattr(source_db, "get_client", lambda: _FakeClient())

    assert source_db.refresh_search_suggestions("Atlanta") is True
    assert calls == [
        ("refresh_search_suggestions_incremental", {"p_city": "Atlanta"}),
        "execute",
    ]
