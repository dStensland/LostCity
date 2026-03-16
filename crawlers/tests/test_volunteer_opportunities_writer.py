from db.volunteer_opportunities import (
    deactivate_stale_volunteer_opportunities,
    upsert_volunteer_opportunity,
)


class _FakeResult:
    def __init__(self, data):
        self.data = data


class _FakeQuery:
    def __init__(self, table_name, state):
        self.table_name = table_name
        self.state = state
        self.filters = []
        self.payload = None

    def select(self, fields):
        self.state["selects"].append((self.table_name, fields))
        return self

    def eq(self, field, value):
        self.filters.append(("eq", field, value))
        return self

    def limit(self, value):
        self.filters.append(("limit", value))
        return self

    def upsert(self, payload, on_conflict=None):
        self.payload = payload
        self.state["upserts"].append((self.table_name, payload, on_conflict))
        return self

    def update(self, payload):
        self.payload = payload
        self.state["updates"].append((self.table_name, payload))
        return self

    def in_(self, field, values):
        self.filters.append(("in", field, tuple(values)))
        return self

    def execute(self):
        if self.table_name == "organizations":
            return _FakeResult([{"id": "org-1"}])
        if self.table_name == "volunteer_opportunities" and self.state["mode"] == "upsert":
            return _FakeResult([{"id": "opp-1"}])
        if self.table_name == "volunteer_opportunities" and self.state["mode"] == "select":
            return _FakeResult(
                [
                    {"id": "opp-a", "slug": "keep-me"},
                    {"id": "opp-b", "slug": "stale-me"},
                ]
            )
        return _FakeResult([])


class _FakeClient:
    def __init__(self, state):
        self.state = state

    def table(self, table_name):
        return _FakeQuery(table_name, self.state)


def test_upsert_volunteer_opportunity_resolves_organization_slug(monkeypatch):
    state = {"selects": [], "upserts": [], "updates": [], "mode": "upsert"}
    monkeypatch.setattr("db.volunteer_opportunities.get_client", lambda: _FakeClient(state))
    monkeypatch.setattr("db.volunteer_opportunities.writes_enabled", lambda: True)

    record_id = upsert_volunteer_opportunity(
        {
            "slug": "gallery-greeter",
            "organization_slug": "high-museum-volunteers",
            "title": "Gallery Greeter",
            "application_url": "https://example.com/volunteer",
            "commitment_level": "ongoing",
        }
    )

    assert record_id == "opp-1"
    assert state["upserts"][0][0] == "volunteer_opportunities"
    assert state["upserts"][0][1]["organization_id"] == "org-1"
    assert state["upserts"][0][2] == "slug"


def test_deactivate_stale_volunteer_opportunities_updates_missing_slugs(monkeypatch):
    state = {"selects": [], "upserts": [], "updates": [], "mode": "select"}
    monkeypatch.setattr("db.volunteer_opportunities.get_client", lambda: _FakeClient(state))
    monkeypatch.setattr("db.volunteer_opportunities.writes_enabled", lambda: True)

    stale_count = deactivate_stale_volunteer_opportunities(12, {"keep-me"})

    assert stale_count == 1
    assert state["updates"][0][0] == "volunteer_opportunities"
    assert state["updates"][0][1] == {"is_active": False}
