from datetime import datetime

from sources import united_way_atlanta as uwa
from sources.united_way_atlanta import (
    _parse_opportunity_detail,
    _parse_structured_opportunity_detail,
    _upsert_organization,
)


def test_parse_opportunity_detail_extracts_future_happens_on_event():
    html = """
    <html>
      <body>
        <h1>Virtual FAFSA Volunteer Training</h1>
        <div>Happens On Mar 14, 2026</div>
        <div>6pm</div>
        <div>Description</div>
        <p>Help students and families complete FAFSA applications.</p>
        <div>Details</div>
        <div>Partner Agency</div>
        <div>United Way of Greater Atlanta: College and Career Ready</div>
      </body>
    </html>
    """

    parsed = _parse_opportunity_detail(
        html,
        "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1162522",
        reference_dt=datetime(2026, 3, 10, 9, 0),
    )

    assert parsed == {
        "title": "Virtual FAFSA Volunteer Training",
        "description": "Help students and families complete FAFSA applications.",
        "start_date": "2026-03-14",
        "start_time": "18:00",
        "partner_agency": "United Way of Greater Atlanta: College and Career Ready",
        "location_text": None,
        "source_url": "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1162522",
        "ticket_url": "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1162522",
    }


def test_parse_opportunity_detail_skips_ongoing_roles():
    html = """
    <html>
      <body>
        <h1>Distribute books to Little Free Libraries near you</h1>
        <div>ongoing</div>
        <div>Description</div>
        <p>Flexible volunteer role.</p>
      </body>
    </html>
    """

    parsed = _parse_opportunity_detail(
        html,
        "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1194681",
        reference_dt=datetime(2026, 3, 10, 9, 0),
    )

    assert parsed is None


def test_parse_structured_opportunity_detail_extracts_ongoing_role():
    html = """
    <html>
      <body>
        <h1>Mentor the Next Generation: Make an Impact at Our Teen Center!</h1>
        <div>ongoing</div>
        <div>5:30PM-7:30PM</div>
        <div>Description</div>
        <p>Volunteer weekly with students in metro Atlanta.</p>
        <div>Details</div>
        <div>16 and older</div>
        <div>Virtual Opportunity</div>
        <div>Partner Agency</div>
        <div>LaAmistad Inc</div>
      </body>
    </html>
    """

    parsed = _parse_structured_opportunity_detail(
        html,
        "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1192373",
        reference_dt=datetime(2026, 3, 10, 9, 0),
    )

    assert parsed is not None
    assert parsed["status_kind"] == "ongoing"
    assert parsed["title"] == "Mentor the Next Generation: Make an Impact at Our Teen Center!"
    assert parsed["start_time"] == "17:30"
    assert parsed["partner_agency"] == "LaAmistad Inc"
    assert parsed["remote_allowed"] is True
    assert parsed["min_age"] == 16


def test_parse_opportunity_detail_skips_past_happens_on_events():
    html = """
    <html>
      <body>
        <h1>Virtual FAFSA Volunteer Training</h1>
        <div>Happens On Mar 4, 2026</div>
        <div>6pm</div>
      </body>
    </html>
    """

    parsed = _parse_opportunity_detail(
        html,
        "https://volunteer.unitedwayatlanta.org/need/detail/?need_id=1162522",
        reference_dt=datetime(2026, 3, 10, 9, 0),
    )

    assert parsed is None


class _FakeExecuteResult:
    def __init__(self, data):
        self.data = data


class _FakeOrganizationsTable:
    def __init__(self, existing_rows):
        self._existing_rows = existing_rows
        self.last_update_payload = None
        self.insert_payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.last_update_payload = payload
        return self

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def execute(self):
        if self.insert_payload is not None:
            return _FakeExecuteResult([self.insert_payload])
        return _FakeExecuteResult(self._existing_rows)


class _FakeClient:
    def __init__(self, existing_rows):
        self.organizations = _FakeOrganizationsTable(existing_rows)

    def table(self, name):
        assert name == "organizations"
        return self.organizations


def test_upsert_organization_preserves_existing_org_metadata(monkeypatch):
    client = _FakeClient(
        [
            {
                "id": "org-1",
                "slug": "laamistad",
                "portal_id": "existing-portal",
                "hidden": False,
            }
        ]
    )
    monkeypatch.setattr(uwa, "get_client", lambda: client)
    monkeypatch.setattr(uwa, "writes_enabled", lambda: True)

    organization_id, organization_slug = _upsert_organization("LaAmistad Inc", "helpatl-portal")

    assert organization_id == "org-1"
    assert organization_slug == "laamistad"
    assert client.organizations.last_update_payload is None


def test_upsert_organization_fills_missing_portal_id_without_overwriting_name(monkeypatch):
    client = _FakeClient(
        [
            {
                "id": "org-2",
                "slug": "little-free-library",
                "portal_id": None,
                "hidden": True,
            }
        ]
    )
    monkeypatch.setattr(uwa, "get_client", lambda: client)
    monkeypatch.setattr(uwa, "writes_enabled", lambda: True)

    organization_id, organization_slug = _upsert_organization("Little Free Library", "helpatl-portal")

    assert organization_id == "org-2"
    assert organization_slug == "little-free-library"
    assert client.organizations.last_update_payload == {
        "portal_id": "helpatl-portal",
        "hidden": False,
    }


def test_upsert_organization_uses_cache_before_querying_client(monkeypatch):
    client = _FakeClient([])
    monkeypatch.setattr(uwa, "get_client", lambda: client)
    monkeypatch.setattr(uwa, "writes_enabled", lambda: True)

    organization_id, organization_slug = _upsert_organization(
        "Little Free Library",
        "helpatl-portal",
        organization_cache={"little-free-library": ("cached-org", "little-free-library")},
    )

    assert organization_id == "cached-org"
    assert organization_slug == "little-free-library"
    assert client.organizations.last_update_payload is None
    assert client.organizations.insert_payload is None
