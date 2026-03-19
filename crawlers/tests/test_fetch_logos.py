from fetch_logos import _resolve_producer_table


class _FakeQuery:
    def select(self, _columns):
        return self

    def limit(self, _n):
        return self

    def execute(self):
        return self


class _FakeClient:
    def __init__(self, available):
        self.available = set(available)

    def table(self, name):
        if name not in self.available:
            raise Exception("PGRST205 missing table")
        return _FakeQuery()


def test_resolve_producer_table_prefers_event_producers() -> None:
    client = _FakeClient({"event_producers", "organizations"})

    assert _resolve_producer_table(client) == "event_producers"


def test_resolve_producer_table_falls_back_to_organizations() -> None:
    client = _FakeClient({"organizations"})

    assert _resolve_producer_table(client) == "organizations"
